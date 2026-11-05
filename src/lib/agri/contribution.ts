/**
 * Contribution rules, in one place.
 *
 * The floor is ₦5,000 for a one-time deposit *and* for a monthly Agri-Save
 * commitment. It is checked here, checked again in the server function, and —
 * for the monthly plan — enforced by a CHECK constraint on `profiles`. Three
 * layers, because the one a member sees should never be the only one.
 */

export const MIN_CONTRIBUTION = 5_000;

/** The chips shown under every amount field, in naira. */
export const QUICK_AMOUNTS = [10_000, 25_000, 50_000, 100_000] as const;

/** The monthly plans the co-operative advertises. Anyone may type their own. */
export const MONTHLY_PLAN_OPTIONS = [5_000, 10_000, 25_000, 50_000] as const;

export type ContributionMode = "none" | "monthly";

export type AmountCheck =
  | { ok: true; amount: number }
  | { ok: false; reason: "empty" | "not-a-number" | "below-minimum"; message: string };

/**
 * Parse what a member typed into the amount box.
 *
 * Accepts the ways people actually type naira: "25,000", "₦25000", "25 000",
 * "25000.00". Rejects anything else rather than silently coercing it, because a
 * payment amount is not a place to guess.
 */
export function parseAmount(raw: string): AmountCheck {
  const cleaned = raw.replace(/[₦,\s]/g, "").trim();
  if (cleaned === "") {
    return { ok: false, reason: "empty", message: "Enter an amount." };
  }
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) {
    return {
      ok: false,
      reason: "not-a-number",
      message: "Enter an amount in naira, for example 25,000.",
    };
  }
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "not-a-number", message: "Enter an amount in naira." };
  }
  if (amount < MIN_CONTRIBUTION) {
    return {
      ok: false,
      reason: "below-minimum",
      message: `The smallest amount the co-operative accepts is ₦${MIN_CONTRIBUTION.toLocaleString("en-NG")}.`,
    };
  }
  return { ok: true, amount };
}

/**
 * Equity is never stored, so this is only ever used for the *preview* on a
 * contribution form. The number that counts is the one the database computes
 * from verified rows after the payment lands.
 */
export function previewEquity(amount: number, cycleTotalAfter: number): number {
  if (!Number.isFinite(amount) || cycleTotalAfter <= 0) return 0;
  return (amount / cycleTotalAfter) * 100;
}

/** "₦5,000" — whole naira, for chips and helper text. */
export function nairaWhole(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}
