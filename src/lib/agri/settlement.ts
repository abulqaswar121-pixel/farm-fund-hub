/**
 * Settlement arithmetic checks, in one place.
 *
 * The settlement engine is written to conserve money: every naira of harvest
 * revenue leaves through exactly one of the four levels, and every naira of
 * member payout is principal plus a pro-rata slice of the investor pool. These
 * checks exist because "it looks right on the screen" is not the same as "the
 * rows add up", and because the one thing a member will do with a statement is
 * add up the column themselves.
 *
 * Everything here is pure. It runs in the wizard before an irreversible run,
 * and it would run just as well in a test.
 */

/**
 * Rounding is unavoidable: each member's share is rounded to the kobo, so the
 * sum of the lines can differ from the pool by a few kobo. The tolerance is
 * one kobo per member (with a floor of one naira) — enough to absorb honest
 * rounding, far too small to hide a missing payout.
 */
export const ROUNDING_FLOOR_NAIRA = 1;

export function roundingTolerance(memberCount: number): number {
  return Math.max(ROUNDING_FLOOR_NAIRA, Math.max(0, memberCount) * 0.01);
}

export type PayoutLineLike = {
  memberName: string;
  principal: number;
  profit: number;
  total: number;
};

export type SettlementTotalsLike = {
  grossRevenue: number;
  liabilitiesPaid: number;
  principalReturned: number;
  reserveSetAside: number;
  netProfit: number;
  investorProfitPool: number;
  operatorFee: number;
  totalPaidOut: number;
};

const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;

/**
 * Every invariant a settlement must satisfy before it is allowed to run.
 * Returns an empty array when the figures are sound.
 */
export function auditSettlement(totals: SettlementTotalsLike, lines: PayoutLineLike[]): string[] {
  const problems: string[] = [];
  const tolerance = roundingTolerance(lines.length);

  // 1. Money is conserved across the four levels.
  const allocated =
    totals.liabilitiesPaid + totals.principalReturned + totals.reserveSetAside + totals.netProfit;
  if (!near(allocated, totals.grossRevenue, tolerance)) {
    problems.push(
      `The four levels allocate ${allocated.toFixed(2)} against ${totals.grossRevenue.toFixed(2)} of revenue.`,
    );
  }

  // 2. The profit split adds back up to net profit, and to nothing more.
  if (!near(totals.investorProfitPool + totals.operatorFee, totals.netProfit, tolerance)) {
    problems.push(
      `The profit split (${totals.investorProfitPool.toFixed(2)} + ${totals.operatorFee.toFixed(2)}) does not equal net profit (${totals.netProfit.toFixed(2)}).`,
    );
  }

  // 3. Members receive principal plus pool — and the cycle keeps the caretaker
  //    fee. A run that pays out more than that has invented money.
  if (!near(totals.totalPaidOut, totals.principalReturned + totals.investorProfitPool, tolerance)) {
    problems.push("The total payout does not equal principal plus the member profit pool.");
  }

  // 4. The member lines add up to the totals the run reports.
  const linePrincipal = lines.reduce((sum, line) => sum + line.principal, 0);
  const lineProfit = lines.reduce((sum, line) => sum + line.profit, 0);
  const lineTotal = lines.reduce((sum, line) => sum + line.total, 0);

  if (!near(linePrincipal, totals.principalReturned, tolerance)) {
    problems.push("The member principal column does not add up to the principal returned.");
  }
  if (!near(lineProfit, totals.investorProfitPool, tolerance)) {
    problems.push("The member profit column does not add up to the member profit pool.");
  }
  if (!near(lineTotal, totals.totalPaidOut, tolerance)) {
    problems.push("The member payouts do not add up to the total being distributed.");
  }

  // 5. Each line must pay what it says it pays.
  for (const line of lines) {
    if (!near(line.principal + line.profit, line.total, 0.02)) {
      problems.push(`${line.memberName}'s line does not add up to its own total.`);
    }
    if (line.principal < 0 || line.profit < 0 || line.total < 0) {
      problems.push(`${line.memberName}'s line contains a negative amount.`);
    }
  }

  return problems;
}

/**
 * A single sentence an admin can read out loud before pressing the final
 * button. Deliberately plain: this is the last thing they see.
 */
export function describeShortfall(
  totals: SettlementTotalsLike,
  capitalRaised: number,
): string | null {
  if (capitalRaised <= 0) return null;
  const shortfall = Math.round((capitalRaised - totals.principalReturned) * 100) / 100;
  if (shortfall <= 0) return null;
  return `${shortfall.toFixed(2)} of member capital cannot be returned from this harvest. It will be reported openly on every statement rather than quietly written off.`;
}
