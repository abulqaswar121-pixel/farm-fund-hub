import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Lock, Sprout, Users } from "lucide-react";

import { COMMODITIES, CYCLE_STATUS_LABEL, type CycleStatus } from "@/lib/agri/commodities";
import { money, moneyCompact, number, percent } from "@/lib/agri/format";
import type { PublicCycleCard } from "@/lib/agri.public.functions";
import { readRules, rulesChip } from "@/lib/agri/rules";

/**
 * Status → indicator colour, by meaning:
 *   emerald — funding or active, per the platform's status language;
 *   cyan    — a live technology state (fully subscribed, streaming figures);
 *   amber   — the cycle is closing or awaits verification.
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

/** How long a cycle has left before funding closes; null when it is not tied to a date. */
function closingLabel(closesOn: string | null) {
  if (!closesOn) return null;
  const days = Math.ceil((new Date(closesOn).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (Number.isNaN(days)) return null;
  if (days > 21) {
    return {
      text: `Closes ${new Date(closesOn).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      closing: false,
    };
  }
  if (days > 0) return { text: `Closing in ${days}d`, closing: true };
  return { text: "Closing now", closing: true };
}

/**
 * An elevated marketplace card.
 *
 * Everything printed here is either a locked term the member is asked to
 * accept or a figure counted from the ledger. The projected harvest window is
 * labelled as projected because that is exactly what it is.
 */
export function CycleCard({ card }: { card: PublicCycleCard }) {
  const { cycle, raised, fundedPercent, investorCount, projectedRevenue } = card;
  const commodity = COMMODITIES.find((item) => item.id === cycle.commodity);
  const Icon = commodity?.icon ?? Sprout;
  const rules = readRules(cycle);
  const closing = cycle.status === "open" ? closingLabel(cycle.funding_closes_on) : null;

  return (
    <Link
      to="/cycles/$cycleId"
      params={{ cycleId: cycle.id }}
      className="pg-card pg-card--lift group flex flex-col overflow-hidden no-underline"
    >
      {/* Commodity photo banner with the species tag and status chip. */}
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
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-navy/70 px-3 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
            <Icon size={12} aria-hidden="true" className="text-signal" />
            {commodity?.species ?? "Farm stock"}
          </span>
          <span className={`pg-chip ${STATUS_TONE[cycle.status] ?? "pg-chip"}`}>
            {CYCLE_STATUS_LABEL[cycle.status as CycleStatus] ?? cycle.status}
          </span>
        </div>

        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-navy/70 px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-widest text-signal backdrop-blur-sm">
          {cycle.code}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div>
          <p className="font-display text-[1.05rem] font-bold leading-tight text-ink-deep">
            {cycle.name}
          </p>
          <p className="mt-1 text-[0.74rem] text-ink-mute">
            {commodity?.name ?? "Farm stock"} · {cycle.farm_site}
          </p>
        </div>

        {/* Capital raised against target. */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="pg-kicker">Capital raised</span>
            <span className="fig text-[0.95rem] font-semibold text-ink-deep">
              {percent(fundedPercent, 1)}
            </span>
          </div>
          <div className="pg-meter mt-2">
            <span style={{ width: `${Math.min(100, fundedPercent)}%` }} />
          </div>
          <p className="mt-1.5 text-[0.72rem] text-ink-mute">
            <span className="fig font-semibold text-ink-soft">{moneyCompact(raised)}</span> of{" "}
            <span className="fig">{moneyCompact(cycle.target_capital)}</span> target ·{" "}
            <span className="fig">{number(investorCount)}</span> investors
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-xl border border-hairline bg-porcelain p-3 text-[0.72rem]">
          <div>
            <dt className="pg-kicker">Min. ticket</dt>
            <dd className="fig mt-1 font-semibold text-ink-deep">{money(cycle.minimum_ticket)}</dd>
          </div>
          <div>
            <dt className="pg-kicker">Duration</dt>
            <dd className="fig mt-1 font-semibold text-ink-deep">{cycle.cycle_weeks} wks</dd>
          </div>
          <div>
            <dt className="pg-kicker">Projected revenue</dt>
            <dd className="fig mt-1 font-semibold text-mint-deep">
              {moneyCompact(projectedRevenue)}
            </dd>
          </div>
        </dl>

        <p className="pg-chip pg-chip--locked self-start">
          <Lock size={10} aria-hidden="true" />
          {rulesChip(rules)}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-cyan-50 px-3 py-1.5 text-[0.74rem] font-semibold text-signal-deep transition-colors group-hover:border-signal group-hover:bg-cyan-100">
            Inspect Cycle Ledger
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
          {closing ? (
            <span
              className={`inline-flex items-center gap-1 text-[0.7rem] font-semibold ${
                closing.closing ? "text-amber-alert" : "text-ink-mute"
              }`}
            >
              <CalendarClock size={12} aria-hidden="true" />
              {closing.text}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[0.7rem] text-ink-mute">
              <Users size={12} aria-hidden="true" />
              {commodity?.targetYieldLabel ?? "Target yield set per cycle"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
