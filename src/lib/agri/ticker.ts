/**
 * The live farm ticker.
 *
 * Two kinds of line travel on this strip, and they are never blurred into
 * each other:
 *
 *   1. **Ledger lines** (tone `live` / `verified` / `closing`) — built from
 *      published cycles and approved operator logs. Codes, stages and
 *      percentages come straight from the ledger.
 *   2. **Operating standards** — the co-operative's published targets and
 *      observed field conditions, e.g. the biomass a batch is steered toward
 *      at week 12, the viability floor a flock is held to, the irrigation
 *      state on the greenhouse beds and the season's harvest window. These are
 *      the standard each cycle is measured against, stated before the cycle
 *      runs, not a realised result.
 *
 * Nothing here is a member balance, a return or a paid-out figure.
 */

export type TickerTone = "live" | "verified" | "closing";

export type TickerItem = {
  id: string;
  /** The batch, flock, bed or season the line refers to. */
  subject: string;
  /** The reading itself — a stage, a target, a condition or a window. */
  reading: string;
  tone: TickerTone;
};

/**
 * The operating standards the farm publishes for its stock programme. Each is
 * a threshold or condition the operator stewards toward; none is a return.
 */
export const FARM_STANDARDS: TickerItem[] = [
  {
    id: "std-catfish",
    subject: "Catfish Batch #04",
    reading: "Week 12 · biomass standard 1.4 kg",
    tone: "live",
  },
  {
    id: "std-broiler",
    subject: "Broiler Flock #09",
    reading: "Viability floor 98.4%",
    tone: "verified",
  },
  {
    id: "std-greenhouse",
    subject: "Greenhouse Batch",
    reading: "Drip irrigation optimal",
    tone: "live",
  },
  {
    id: "std-soya",
    subject: "Soya Harvest Window",
    reading: "Nov 2026",
    tone: "closing",
  },
];

export const TICKER_TONE_CLASS: Record<TickerTone, string> = {
  live: "text-signal",
  verified: "text-mint",
  closing: "text-amber-alert",
};

/** The cycle states that are worth announcing on a public ticker. */
const ANNOUNCED_STATUS: Record<string, { verb: string; tone: TickerTone }> = {
  open: { verb: "funding open", tone: "live" },
  funded: { verb: "fully subscribed", tone: "verified" },
  active: { verb: "active on farm", tone: "live" },
  harvested: { verb: "harvested · weigh-in logged", tone: "closing" },
  settled: { verb: "settled through the waterfall", tone: "verified" },
};

/**
 * Turn published cycles into ticker lines. Only real, locked cycles are
 * announced — an unpublished or cancelled draft never appears on the strip.
 */
export function cycleTickerItems(
  cycles: { code: string; commodity: string; status: string }[],
): TickerItem[] {
  return cycles
    .filter((cycle) => Boolean(ANNOUNCED_STATUS[cycle.status]))
    .slice(0, 10)
    .map((cycle, index) => {
      const announced = ANNOUNCED_STATUS[cycle.status];
      return {
        id: `cycle-${cycle.code}-${index}`,
        subject: cycle.code,
        reading: announced ? announced.verb : "published",
        tone: announced ? announced.tone : ("live" as TickerTone),
      };
    });
}
