/**
 * NDH AgriCapital — locked cycle rules and the settlement waterfall.
 *
 * Everything in this file is a pure function so the same maths can be run in
 * three places without drifting:
 *   1. the marketplace card (what an investor is shown before paying),
 *   2. the investor portal (what their live equity actually is),
 *   3. the admin settlement engine (what is actually paid out).
 *
 * INVARIANT: equity is always derived from verified contributions. It is never
 * read from, or written to, a stored column.
 */

/** The four levels, in the order money must leave the harvest revenue. */
export const WATERFALL_LEVELS = [
  {
    level: 1,
    key: "liabilities",
    name: "Operational liabilities & supplier debts",
    description:
      "Outstanding feed balances, veterinary debts, transport and any other supplier claim is settled first so no supplier is left holding the cycle's risk.",
  },
  {
    level: 2,
    key: "principal",
    name: "Capital principal return",
    description:
      "100% of verified contribution capital is returned to every contributor pro-rata, before a single naira of profit is shared.",
  },
  {
    level: 3,
    key: "reserve",
    name: "Emergency co-operative reserve",
    description:
      "The cycle's locked reserve percentage is set aside in escrow to buffer future input price shocks, disease events and repairs.",
  },
  {
    level: 4,
    key: "profit",
    name: "Net profit distribution",
    description:
      "What remains is net profit, split at the percentage frozen when the cycle was published.",
  },
] as const;

export type WaterfallKey = (typeof WATERFALL_LEVELS)[number]["key"];

/** Defaults applied to a new cycle. Admins may pick within the permitted band. */
export const DEFAULT_RULES = {
  investorSharePercent: 70,
  operatorSharePercent: 30,
  reservePercent: 5,
  minimumReservePercent: 5,
  maximumReservePercent: 10,
} as const;

export type CycleRules = {
  /** Locked at publication. Both halves must total 100. */
  investorSharePercent: number;
  operatorSharePercent: number;
  /** Locked at publication. Must sit inside the co-operative band. */
  reservePercent: number;
};

export type RawRules = {
  profit_investor_percent: number | string;
  profit_operator_percent: number | string;
  reserve_percent: number | string;
};

export function readRules(row: RawRules): CycleRules {
  return {
    investorSharePercent: Number(row.profit_investor_percent),
    operatorSharePercent: Number(row.profit_operator_percent),
    reservePercent: Number(row.reserve_percent),
  };
}

/** A short chip label such as "70/30 Net Split | 5% Safety Reserve". */
export function rulesChip(rules: CycleRules): string {
  return `${rules.investorSharePercent}/${rules.operatorSharePercent} Net Split | ${rules.reservePercent}% Safety Reserve`;
}

export function validateRules(rules: CycleRules): string[] {
  const problems: string[] = [];
  const total = rules.investorSharePercent + rules.operatorSharePercent;
  if (Math.abs(total - 100) > 0.001) {
    problems.push(`The profit split must total 100% (currently ${total}%).`);
  }
  if (rules.investorSharePercent <= 0 || rules.operatorSharePercent <= 0) {
    problems.push("Both the investor share and the operator fee must be greater than zero.");
  }
  if (
    rules.reservePercent < DEFAULT_RULES.minimumReservePercent ||
    rules.reservePercent > DEFAULT_RULES.maximumReservePercent
  ) {
    problems.push(
      `The emergency reserve must sit between ${DEFAULT_RULES.minimumReservePercent}% and ${DEFAULT_RULES.maximumReservePercent}%.`,
    );
  }
  return problems;
}

/* -------------------------------------------------------------------------- *
 * Equity
 * -------------------------------------------------------------------------- */

export type ContributionLike = {
  member_id: string;
  amount: number | string;
  payment_status: string;
  /**
   * Capital already handed to another member through the co-op transfer board.
   * A member's live holding is (amount - transferred_out); at cycle level the
   * two sides cancel out, so the pool total is unchanged by a transfer.
   */
  transferred_out?: number | string | null;
};

/**
 * The capital a single ledger row currently represents for its own member.
 *
 * Note this is NOT the cycle's total: the same formula summed across every row
 * gives the cycle pool, because a buyer's new row offsets the seller's
 * transferred_out. That cancellation is what makes a transfer
 * ownership-neutral for the pool.
 */
export function netAmount(row: ContributionLike): number {
  return Number(row.amount) - Number(row.transferred_out ?? 0);
}

/**
 * Live equity for every contributor in a cycle.
 *
 * equity% = (member's verified contributions in cycle / all verified
 * contributions in cycle) × 100
 */
export function equityTable(contributions: ContributionLike[]): Map<string, number> {
  const verified = contributions.filter((item) => item.payment_status === "success");
  const cycleTotal = verified.reduce((sum, item) => sum + netAmount(item), 0);
  const perMember = new Map<string, number>();

  for (const item of verified) {
    perMember.set(item.member_id, (perMember.get(item.member_id) ?? 0) + netAmount(item));
  }

  const equity = new Map<string, number>();
  if (cycleTotal <= 0) {
    for (const memberId of perMember.keys()) equity.set(memberId, 0);
    return equity;
  }
  for (const [memberId, amount] of perMember) {
    equity.set(memberId, (amount / cycleTotal) * 100);
  }
  return equity;
}

/** Verified capital raised so far in a cycle. */
export function raisedCapital(contributions: ContributionLike[]): number {
  return contributions
    .filter((item) => item.payment_status === "success")
    .reduce((sum, item) => sum + netAmount(item), 0);
}

/** A single member's verified capital in a cycle. */
export function memberCapital(contributions: ContributionLike[], memberId: string): number {
  return contributions
    .filter((item) => item.payment_status === "success" && item.member_id === memberId)
    .reduce((sum, item) => sum + netAmount(item), 0);
}

export function fundedPercent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (raised / target) * 100);
}

/* -------------------------------------------------------------------------- *
 * The waterfall
 * -------------------------------------------------------------------------- */

export type WaterfallInput = {
  /** Gross revenue banked from selling the harvest. */
  grossRevenue: number;
  /** Total verified contribution capital raised during funding. */
  capitalRaised: number;
  /** Unpaid operational liabilities and supplier debts at settlement. */
  operationalLiabilities: number;
  rules: CycleRules;
};

export type WaterfallLevelResult = {
  level: number;
  key: WaterfallKey;
  name: string;
  amount: number;
  /** True when the level could not be fully funded by what was left. */
  shortfall: boolean;
  note: string;
};

export type WaterfallResult = {
  grossRevenue: number;
  levels: WaterfallLevelResult[];
  /** Level 1 — settled in full or short. */
  liabilitiesPaid: number;
  liabilitiesShortfall: number;
  /** Level 2 */
  principalReturned: number;
  principalShortfall: number;
  /** Level 3 */
  reserveSetAside: number;
  /** Level 4 */
  netProfit: number;
  investorProfitPool: number;
  operatorFee: number;
  /** Cash actually leaving the account. */
  totalDistributed: number;
  /** Left over if liabilities or principal could not be met (0 when solvent). */
  unallocated: number;
  /** True when the harvest could not even return 100% of principal. */
  principalAtRisk: boolean;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Run the strict four-level settlement.
 *
 * Priority is not a preference — each level takes what it needs before the next
 * is touched, and a shortfall at one level is honestly reported rather than
 * silently borrowing from the level below.
 */
export function runWaterfall(input: WaterfallInput): WaterfallResult {
  const gross = Math.max(0, input.grossRevenue);
  const liabilitiesDue = Math.max(0, input.operationalLiabilities);
  const capital = Math.max(0, input.capitalRaised);

  let remaining = gross;

  // Level 1 — pay the suppliers.
  const liabilitiesPaid = Math.min(remaining, liabilitiesDue);
  const liabilitiesShortfall = round2(liabilitiesDue - liabilitiesPaid);
  remaining -= liabilitiesPaid;

  // Level 2 — return 100% of principal, pro-rata by the ledger's equity table.
  const principalReturned = Math.min(remaining, capital);
  const principalShortfall = round2(capital - principalReturned);
  remaining -= principalReturned;

  // Level 3 — escrow the locked reserve, but only out of genuine surplus.
  const reserveTarget = round2((gross * input.rules.reservePercent) / 100);
  const reserveSetAside = Math.min(remaining, reserveTarget);
  remaining -= reserveSetAside;

  // Level 4 — whatever survives is net profit, split at the frozen ratio.
  const netProfit = round2(remaining);
  const investorProfitPool = round2((netProfit * input.rules.investorSharePercent) / 100);
  const operatorFee = round2(netProfit - investorProfitPool);

  const levels: WaterfallLevelResult[] = [
    {
      level: 1,
      key: "liabilities",
      name: WATERFALL_LEVELS[0].name,
      amount: round2(liabilitiesPaid),
      shortfall: liabilitiesShortfall > 0,
      note:
        liabilitiesShortfall > 0
          ? `Short by ${formatNaira(liabilitiesShortfall)} — recorded as an unsettled supplier claim.`
          : "Settled in full from harvest revenue.",
    },
    {
      level: 2,
      key: "principal",
      name: WATERFALL_LEVELS[1].name,
      amount: round2(principalReturned),
      shortfall: principalShortfall > 0,
      note:
        principalShortfall > 0
          ? `Only ${formatNaira(principalReturned)} of ${formatNaira(capital)} principal could be returned.`
          : "Full principal returned pro-rata to verified contributors.",
    },
    {
      level: 3,
      key: "reserve",
      name: WATERFALL_LEVELS[2].name,
      amount: round2(reserveSetAside),
      shortfall: reserveSetAside < reserveTarget,
      note: `${input.rules.reservePercent}% of gross revenue held in escrow for the next cycle's buffer.`,
    },
    {
      level: 4,
      key: "profit",
      name: WATERFALL_LEVELS[3].name,
      amount: netProfit,
      shortfall: false,
      note: `${input.rules.investorSharePercent}% distributed to investors, ${input.rules.operatorSharePercent}% to the farm caretaker.`,
    },
  ];

  return {
    grossRevenue: round2(gross),
    levels,
    liabilitiesPaid: round2(liabilitiesPaid),
    liabilitiesShortfall,
    principalReturned: round2(principalReturned),
    principalShortfall,
    reserveSetAside: round2(reserveSetAside),
    netProfit,
    investorProfitPool,
    operatorFee,
    totalDistributed: round2(liabilitiesPaid + principalReturned + reserveSetAside + netProfit),
    unallocated: 0,
    principalAtRisk: principalShortfall > 0,
  };
}

/**
 * What a single investor receives from a settled cycle.
 * Principal is returned in full at Level 2 before profit is touched, so a
 * member's payout is principal + their pro-rata slice of the profit pool.
 */
export function investorPayout(
  result: WaterfallResult,
  memberCapitalAmount: number,
  equityPercent: number,
  capitalRaised: number,
): {
  principal: number;
  profit: number;
  total: number;
  equityPercent: number;
} {
  const principalShare =
    capitalRaised > 0 ? (memberCapitalAmount / capitalRaised) * result.principalReturned : 0;
  const profitShare = (equityPercent / 100) * result.investorProfitPool;
  const principal = round2(principalShare);
  const profit = round2(profitShare);
  return { principal, profit, total: round2(principal + profit), equityPercent };
}

/** Pro-rata split of a pool across an equity table. Used by the admin engine. */
export function distributeProRata(
  pool: number,
  equity: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [memberId, percent] of equity) {
    out.set(memberId, round2((percent / 100) * pool));
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * Projection maths for the public calculator
 * -------------------------------------------------------------------------- */

export type ProjectionInput = {
  amount: number;
  /** The cycle's own projected harvest revenue, set by the admin at launch. */
  projectedRevenue: number;
  /** Total capital the cycle intends to raise (its funding goal). */
  targetCapital: number;
  /** Capital already committed, so the calculator reflects the real book. */
  raisedCapital: number;
  operationalLiabilities: number;
  rules: CycleRules;
};

export type ProjectionResult = WaterfallResult & {
  equityPercent: number;
  investorPrincipal: number;
  investorProfit: number;
  investorTotal: number;
  /** Return on the amount invested, as a percentage. */
  roiPercent: number;
};

/**
 * Project an investment against the cycle's own published plan.
 *
 * This deliberately runs the *same* waterfall the settlement will run, so the
 * public calculator cannot promise a number the settlement engine would not
 * produce. It assumes the cycle funds in full — the caller must label it as a
 * projection, never a guarantee.
 */
export function projectInvestment(input: ProjectionInput): ProjectionResult {
  const target = Math.max(input.targetCapital, input.raisedCapital, input.amount);
  const equityPercent = target > 0 ? (input.amount / target) * 100 : 0;

  const result = runWaterfall({
    grossRevenue: input.projectedRevenue,
    capitalRaised: target,
    operationalLiabilities: input.operationalLiabilities,
    rules: input.rules,
  });

  const principalShare = (input.amount / target) * result.principalReturned;
  const profitShare = (equityPercent / 100) * result.investorProfitPool;
  const investorPrincipal = round2(principalShare);
  const investorProfit = round2(profitShare);
  const investorTotal = round2(investorPrincipal + investorProfit);

  return {
    ...result,
    equityPercent,
    investorPrincipal,
    investorProfit,
    investorTotal,
    roiPercent: input.amount > 0 ? round2(((investorTotal - input.amount) / input.amount) * 100) : 0,
  };
}

/* -------------------------------------------------------------------------- *
 * Formatting helpers shared by the maths and the UI
 * -------------------------------------------------------------------------- */

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNaira(value: number): string {
  return naira.format(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}
