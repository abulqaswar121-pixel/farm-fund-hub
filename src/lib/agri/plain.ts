/**
 * Plain language — the words the platform uses when it talks to the public.
 *
 * The ledger's own vocabulary (waterfall, equity, pro-rata, FCR) is precise, and
 * it stays inside the portals, the settlement engine and this file's comments.
 * On a public page we say the same thing in words a first-time visitor already
 * owns. One idea per sentence.
 *
 * Rules of the house:
 *   1. Never stack two technical terms in one sentence.
 *   2. Every figure gets a sentence underneath saying what it counts.
 *   3. Nothing here invents a number — these are labels, not values.
 */
import type { CycleStatus, StageId } from "./commodities";
import { moneyCompact } from "./format";

/* -------------------------------------------------------------------------- *
 * Cycle status, in everyday words
 * -------------------------------------------------------------------------- */

export type PlainStatus = {
  label: string;
  /** One sentence, shown under the status when there is room. */
  blurb: string;
};

export const PLAIN_STATUS: Record<CycleStatus, PlainStatus> = {
  open: {
    label: "Open for funding",
    blurb: "You can still put money into this cycle.",
  },
  funded: {
    label: "Fully funded",
    blurb: "The target was reached and the farm is about to start.",
  },
  active: {
    label: "Growing on the farm",
    blurb: "The work is happening on the farm right now.",
  },
  harvested: {
    label: "Harvested",
    blurb: "The harvest is in and the produce is being sold.",
  },
  settled: {
    label: "Paid out",
    blurb: "Members have been paid their money and their share of the profit.",
  },
  cancelled: {
    label: "Cancelled",
    blurb: "This cycle did not go ahead.",
  },
};

export function plainStatus(status: string): PlainStatus {
  return PLAIN_STATUS[status as CycleStatus] ?? { label: status, blurb: "" };
}

/* -------------------------------------------------------------------------- *
 * Where a cycle has got to
 * -------------------------------------------------------------------------- */

export const PLAIN_STAGE: Record<StageId, string> = {
  funding_open: "Collecting money",
  stocking: "Stocking the farm",
  operational: "Growing",
  harvest_weighin: "Weighing the harvest",
  sale_settlement: "Selling the produce",
  waterfall_distribution: "Sharing the profit",
};

export function plainStage(stage: string): string {
  return PLAIN_STAGE[stage as StageId] ?? stage;
}

/* -------------------------------------------------------------------------- *
 * The four things an investor goes through
 * -------------------------------------------------------------------------- */

export const PLAIN_JOURNEY = [
  {
    n: "01",
    title: "We collect the money",
    body: "Members put money into one cycle. Each person's amount is written down and confirmed. Nobody can change the agreed profit share afterwards.",
    chip: "Open for funding",
  },
  {
    n: "02",
    title: "The farm raises the stock",
    body: "We buy the fish, birds or seed and raise them. The farm team posts what they did each day or week, and a supervisor approves it before you see it.",
    chip: "Growing on the farm",
  },
  {
    n: "03",
    title: "We sell the harvest",
    body: "At harvest the produce is weighed on a scale and sold to traders. We keep the scale ticket and the collection note as proof.",
    chip: "Harvest weighed",
  },
  {
    n: "04",
    title: "Everyone gets paid",
    body: "First we pay the cycle's bills. Then every member gets their money back. What is left over is profit, and 70% of it is shared between members.",
    chip: "Paid out",
  },
] as const;

/* -------------------------------------------------------------------------- *
 * Where the money goes, in order — the general rule, in plain words
 * -------------------------------------------------------------------------- */

export const PLAIN_PAYOUT_ORDER = [
  {
    step: 1,
    title: "We pay the cycle's bills first",
    body: "Feed still owed, vet bills, transport. This stops the people who supplied the farm from carrying the risk.",
  },
  {
    step: 2,
    title: "Then every member gets their money back",
    body: "The full amount each person put in is returned, in proportion to what they put in. Nobody is paid profit before this step is finished.",
  },
  {
    step: 3,
    title: "We put a little aside for next time",
    body: "A small slice (5% of the sale, sometimes more, never more than 10%) is kept back to cover surprises like feed price rises or a breakdown.",
  },
  {
    step: 4,
    title: "Whatever is left is profit — and 70% goes to members",
    body: "Members share 70% of the profit between them, in proportion to what they put in. The farm caretaker who raised the stock keeps 30%.",
  },
] as const;

/* -------------------------------------------------------------------------- *
 * Farm updates, said simply
 * -------------------------------------------------------------------------- */

export type PlainLogStyle = {
  label: string;
  /** Short, friendly headline shown on the public feed. */
  headline: string;
};

export const PLAIN_LOG: Record<string, PlainLogStyle> = {
  feed: { label: "Feeding", headline: "Fed on schedule" },
  growth_sample: { label: "Growth check", headline: "Healthy growth" },
  mortality: { label: "Stock health", headline: "Health check done" },
  medication: { label: "Treatment", headline: "Treatment given" },
  general: { label: "Farm note", headline: "Farm update" },
  harvest: { label: "Harvest", headline: "Harvest finished" },
  sale: { label: "Sale", headline: "Produce sold" },
};

export function plainLog(logType: string | null | undefined): PlainLogStyle {
  return PLAIN_LOG[logType ?? ""] ?? { label: "Farm update", headline: "Farm update" };
}

/* -------------------------------------------------------------------------- *
 * What each figure counts — one sentence, always under the number
 * -------------------------------------------------------------------------- */

export const NUMBER_HINT = {
  moneyInvested: "All the money members have put in and we have confirmed reached the farm.",
  paidBack:
    "Money already paid back to members after a harvest — their stake plus their share of the profit.",
  cyclesFinished: "Cycles that finished growing, sold their produce and shared out the money.",
  openNow: "Cycles still collecting money, so you can join them today.",
  members: "People who have opened a member account with the co-operative.",
  animals:
    "Fish, birds and other stock being raised right now, counted from the farm's own records.",
  target: "The amount the cycle needs to run. It is fixed before anyone pays in.",
  raisedSoFar: "How much members have put in so far, out of the target.",
  minTicket: "The smallest amount you can put into this cycle.",
  duration: "How long the cycle runs before the harvest is sold and shared out.",
  harvestWindow: "When we expect the harvest. Weather and the markets can move this date.",
  cycleProgress: "How far along this cycle is, from collecting money to sharing the profit.",
  example:
    "Round example numbers, used only to show how the maths works. They are not a real cycle and not a promise.",
} as const;

/* -------------------------------------------------------------------------- *
 * Money, said the way people say it out loud
 * -------------------------------------------------------------------------- */

/**
 * "₦2.1M of ₦5M raised" — the house phrasing for progress.
 *
 * Deliberately vague at the top end: a public page does not need the exact
 * naira, and rounding keeps a member's own contribution unguessable.
 */
export function raisedSentence(raised: number, target: number): string {
  return `${moneyCompact(raised)} of ${moneyCompact(target)} raised`;
}

/** Whole-percent funding progress, never a false precision like 62.222%. */
export function plainPercent(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  if (clamped > 0 && clamped < 1) return "Under 1% funded";
  return `${Math.round(clamped)}% funded`;
}
