/**
 * The public example — how the money is shared, run on numbers the visitor
 * types in themselves.
 *
 * A public page on this platform is not allowed to publish a cycle's projected
 * revenue, its supplier debts or what it expects to earn, so it cannot offer a
 * calculator that runs against a real cycle. What it *can* do — and what this
 * module does — is run the same four-level settlement on a made-up cycle the
 * visitor controls, so anybody can watch the arithmetic before they trust it
 * with a naira.
 *
 * Two rules hold this file honest:
 *
 *   1. No database access. This module never imports a Supabase client and
 *      never receives a cycle row; it only ever sees the numbers the visitor
 *      moved. (`scripts/check-public-surface.mjs` asserts exactly that.)
 *   2. The same function the settlement engine runs. `runWaterfall` is imported
 *      from `rules.ts`, not re-implemented, so the example cannot drift from
 *      the real thing.
 *
 * Because it is an illustration, nothing here is named like a member's own
 * position: `yourMoneyBack` is a hypothetical, and `shareOfPoolPercent` is a
 * share of the example's imaginary pool.
 */
import { money, percent } from "./format";
import { PLAIN_PAYOUT_ORDER } from "./plain";
import { DEFAULT_RULES, runWaterfall, type CycleRules } from "./rules";

export type ExampleInput = {
  /** What the visitor imagines putting in. */
  youPutIn: number;
  /** What the imaginary harvest sells for, in total. */
  saleTotal: number;
  /** What the imaginary cycle still owes its suppliers when it settles. */
  billsOwed: number;
  /** The imaginary cycle's whole capital pool, which sets the visitor's share. */
  capitalPool: number;
  /** Locked at publication in real life; the public example uses the defaults. */
  rules?: CycleRules;
};

export type ExampleLevel = {
  step: number;
  title: string;
  body: string;
  /** The naira that leaves the harvest revenue at this step. */
  amount: number;
  /** One plain sentence about what happened at this step in the example. */
  note: string;
};

export type ExampleOutcome = {
  /** The visitor's slice of the imaginary pool, e.g. "2.5% of the cycle". */
  shareOfPoolText: string;
  shareOfPoolPercent: number;
  /** Principal back, from Level 2. */
  yourMoneyBack: number;
  /** The visitor's share of the 70% profit pool, from Level 4. */
  yourProfitShare: number;
  yourTotal: number;
  /** yourTotal − youPutIn. Negative when the example harvest falls short. */
  gainOrLoss: number;
  /** True when the imaginary harvest cannot even cover bills plus capital. */
  harvestFallsShort: boolean;
  /** What the example could not pay, in naira — shown plainly, not hidden. */
  shortfall: number;
  /** The four steps, in priority order, with the example's amounts. */
  levels: ExampleLevel[];
  rules: CycleRules;
};

/**
 * Run one example. Everything returned is a hypothetical about a made-up cycle.
 */
export function runExample(input: ExampleInput): ExampleOutcome {
  const rules = input.rules ?? {
    investorSharePercent: DEFAULT_RULES.investorSharePercent,
    operatorSharePercent: DEFAULT_RULES.operatorSharePercent,
    reservePercent: DEFAULT_RULES.reservePercent,
  };

  const capitalPool = Math.max(0, input.capitalPool);
  const youPutIn = Math.min(Math.max(0, input.youPutIn), capitalPool || input.youPutIn);

  const result = runWaterfall({
    grossRevenue: Math.max(0, input.saleTotal),
    capitalRaised: capitalPool,
    operationalLiabilities: Math.max(0, input.billsOwed),
    rules,
  });

  const shareOfPoolPercent = capitalPool > 0 ? (youPutIn / capitalPool) * 100 : 0;
  const yourMoneyBack = result.principalReturned * (shareOfPoolPercent / 100);
  const yourProfitShare = (result.investorProfitPool * shareOfPoolPercent) / 100;
  const yourTotal = yourMoneyBack + yourProfitShare;

  const amounts = [
    result.liabilitiesPaid,
    result.principalReturned,
    result.reserveSetAside,
    result.netProfit,
  ];

  const notes = [
    result.liabilitiesShortfall > 0
      ? `The harvest only covered ${money(result.liabilitiesPaid)} of the ${money(input.billsOwed)} owed to suppliers.`
      : "Every bill the cycle owed is paid in full from the sale.",
    result.principalShortfall > 0
      ? `Only ${money(result.principalReturned)} of the ${money(capitalPool)} members put in could be returned.`
      : "Everyone's money goes back in full, in proportion to what they put in.",
    `A slice of the sale — here ${percent(rules.reservePercent, 0)} — is held back for the next rainy day.`,
    `What is left is split: ${percent(rules.investorSharePercent, 0)} to members, ${percent(
      rules.operatorSharePercent,
      0,
    )} to the farm caretaker who raised the stock.`,
  ];

  return {
    shareOfPoolText: `${percent(shareOfPoolPercent, 1)} of the cycle`,
    shareOfPoolPercent,
    yourMoneyBack,
    yourProfitShare,
    yourTotal,
    gainOrLoss: yourTotal - youPutIn,
    harvestFallsShort: result.principalAtRisk,
    shortfall: result.liabilitiesShortfall + result.principalShortfall,
    levels: PLAIN_PAYOUT_ORDER.map((definition, index) => ({
      step: definition.step,
      title: definition.title,
      body: definition.body,
      amount: amounts[index] ?? 0,
      note: notes[index] ?? "",
    })),
    rules,
  };
}
