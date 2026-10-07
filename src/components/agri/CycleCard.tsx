import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Info, Sprout, Users } from "lucide-react";

import { COMMODITIES } from "@/lib/agri/commodities";
import { moneyPublic } from "@/lib/agri/format";
import { NUMBER_HINT, plainStatus, raisedSentence } from "@/lib/agri/plain";
import type { PublicCycleCard } from "@/lib/agri.public.functions";

/**
 * Status → indicator colour, by meaning:
 *   emerald — collecting money or growing, the states a member can join or follow;
 *   cyan    — a live technology state (fully subscribed, streaming figures);
 *   amber   — the harvest is in or the payout is still being worked through.
 */
const STATUS_TONE: Record<string, string> = {
  open: "pg-chip--mint",
  funded: "pg-chip--signal",
  active: "pg-chip--signal",
  harvested: "pg-chip--closing",
  settled: "pg-chip",
  cancelled: "pg-chip--rose",
  draft: "pg-chip",
};

function shortDate(value: string | null): string {
  if (!value) return "Date to be confirmed";
  const parsed = new Date(`${value.length === 10 ? `${value}T00:00:00` : value}`);
  if (Number.isNaN(parsed.getTime())) return "Date to be confirmed";
  return parsed.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * A marketplace card, written for someone who has never invested before.
 *
 * Everything on it is a published term (what the cycle needs, the smallest
 * amount you can put in, how long it runs, when the harvest is expected) or a
 * rounded progress figure. Nothing about the cycle's internal finances is here,
 * and no member's amount is guessable from it.
 */
export function CycleCard({ card }: { card: PublicCycleCard }) {
  const commodity = COMMODITIES.find((item) => item.id === card.commodity);
  const Icon = commodity?.icon ?? Sprout;
  const status = plainStatus(card.status);
  const remaining = Math.max(0, card.targetCapital - card.raisedRounded);

  return (
    <Link
      to="/cycles/$cycleId"
      params={{ cycleId: card.id }}
      className="pg-card pg-card--lift group flex min-w-0 flex-col overflow-hidden no-underline"
    >
      {/* Produce photo, species tag and status. */}
      <div className="pg-banner">
        {commodity ? (
          <img
            src={commodity.image}
            alt={`${commodity.name} — ${commodity.species}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="grid size-full place-items-center bg-navy">
            <Sprout size={28} className="text-signal" aria-hidden="true" />
          </div>
        )}
        <span className="pg-banner-scrim" aria-hidden="true" />

        <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-2">
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-navy/70 px-3 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
            <Icon size={12} aria-hidden="true" className="shrink-0 text-signal" />
            <span className="truncate">{commodity?.name ?? "Farm stock"}</span>
          </span>
          <span className={`pg-chip ${STATUS_TONE[card.status] ?? "pg-chip"}`}>{status.label}</span>
        </div>

        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-navy/70 px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-widest text-signal backdrop-blur-sm">
          {card.code}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          <p className="font-display text-[1.05rem] font-bold leading-tight text-ink-deep">
            {card.name}
          </p>
          <p className="mt-1 text-[0.74rem] text-ink-mute">
            {commodity?.species ?? "Farm stock"} · {card.farmSite}
          </p>
          <p className="mt-2 text-[0.78rem] leading-6 text-ink-soft">{status.blurb}</p>
        </div>

        {/* How the funding is going. */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="pg-kicker">Funding so far</span>
            <span className="fig text-[0.9rem] font-semibold text-ink-deep">
              {card.fundedPercent}%
            </span>
          </div>
          <div className="pg-meter mt-2">
            <span style={{ width: `${Math.min(100, card.fundedPercent)}%` }} />
          </div>
          <p className="mt-1.5 text-[0.74rem] text-ink-soft">
            {raisedSentence(card.raisedRounded, card.targetCapital)}
          </p>
          <p className="mt-1 text-[0.68rem] leading-5 text-ink-mute">
            {card.fundedPercent >= 100
              ? "The target has been reached, so this cycle is closed to new money."
              : `${moneyPublic(remaining)} still needed to reach the target. ${NUMBER_HINT.raisedSoFar}`}
          </p>
        </div>

        <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 rounded-xl border border-hairline bg-porcelain p-3.5 text-[0.72rem] sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="pg-kicker">Smallest amount</dt>
            <dd className="fig mt-1 font-semibold text-ink-deep">
              {moneyPublic(card.minimumTicket, 500)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="pg-kicker">Runs for</dt>
            <dd className="fig mt-1 font-semibold text-ink-deep">{card.cycleWeeks} weeks</dd>
          </div>
          <div className="min-w-0">
            <dt className="pg-kicker">Harvest expected</dt>
            <dd className="mt-1 font-semibold text-ink-deep">
              {shortDate(card.projectedHarvestOn)}
            </dd>
          </div>
        </dl>

        <p className="flex gap-2 text-[0.68rem] leading-5 text-ink-mute">
          <Info size={12} className="mt-0.5 shrink-0 text-signal-deep" aria-hidden="true" />
          <span>
            {NUMBER_HINT.minTicket} This one runs for {card.cycleWeeks} weeks before the harvest is
            sold.
          </span>
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-[0.74rem] font-semibold text-signal-deep">
            See the full cycle
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
          <span className="inline-flex items-center gap-1 text-[0.7rem] text-ink-mute">
            {card.publicUpdateCount > 0 ? (
              <>
                <Users size={12} aria-hidden="true" />
                {card.publicUpdateCount} farm update{card.publicUpdateCount === 1 ? "" : "s"}{" "}
                published
              </>
            ) : (
              <>
                <CalendarClock size={12} aria-hidden="true" />
                {card.fundingClosesOn
                  ? `Funding closes ${shortDate(card.fundingClosesOn)}`
                  : "Funding window open"}
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
