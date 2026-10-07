import { Link } from "@tanstack/react-router";
import { CalendarClock, Lock, Sprout, Users, Waves } from "lucide-react";

import { COMMODITIES, CYCLE_STATUS_LABEL, type CycleStatus } from "@/lib/agri/commodities";
import { money, moneyCompact, percent } from "@/lib/agri/format";
import type { PublicCycleCard } from "@/lib/agri.public.functions";
import { readRules, rulesChip } from "@/lib/agri/rules";

const STATUS_TONE: Record<string, string> = {
  open: "pg-chip--mint",
  funded: "pg-chip--signal",
  active: "pg-chip--signal",
  harvested: "pg-chip--violet",
  settled: "pg-chip",
  cancelled: "pg-chip--rose",
  draft: "pg-chip",
};

/**
 * A stock card in the farm marketplace.
 *
 * Everything printed here is either a locked term the member is being asked to
 * accept or a figure counted from the ledger. The projected harvest window is
 * labelled as projected because that is exactly what it is.
 */
export function CycleCard({ card }: { card: PublicCycleCard }) {
  const { cycle, raised, fundedPercent, investorCount } = card;
  const commodity = COMMODITIES.find((item) => item.id === cycle.commodity);
  const Icon = commodity?.icon ?? Sprout;
  const rules = readRules(cycle);
  const daysToClose = cycle.funding_closes_on
    ? Math.ceil(
        (new Date(cycle.funding_closes_on).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <Link
      to="/cycles/$cycleId"
      params={{ cycleId: cycle.id }}
      className="pg-card pg-card--lift group flex flex-col overflow-hidden no-underline"
    >
      <div className="relative flex items-start justify-between gap-3 border-b border-hairline bg-navy px-4 py-3.5 text-white">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-signal">
            <Icon size={18} aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest text-signal">
              {cycle.code}
            </p>
            <p className="font-display text-[0.95rem] font-bold">{commodity?.name ?? "Farm stock"}</p>
          </div>
        </div>
        <span className={`pg-chip ${STATUS_TONE[cycle.status] ?? "pg-chip"}`}>
          {CYCLE_STATUS_LABEL[cycle.status as CycleStatus] ?? cycle.status}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="pg-kicker">Funded</span>
            <span className="fig text-[0.95rem] font-semibold text-ink-deep">
              {percent(fundedPercent, 1)}
            </span>
          </div>
          <div className="pg-meter mt-2">
            <span style={{ width: `${Math.min(100, fundedPercent)}%` }} />
          </div>
          <p className="mt-1.5 text-[0.72rem] text-ink-mute">
            <span className="fig font-semibold text-ink-soft">{moneyCompact(raised)}</span> of{" "}
            <span className="fig">{moneyCompact(cycle.target_capital)}</span> target
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[0.72rem]">
          <div>
            <dt className="pg-kicker">Min. ticket</dt>
            <dd className="fig mt-0.5 font-semibold text-ink-deep">
              {money(cycle.minimum_ticket)}
            </dd>
          </div>
          <div>
            <dt className="pg-kicker">Duration</dt>
            <dd className="fig mt-0.5 font-semibold text-ink-deep">{cycle.cycle_weeks} weeks</dd>
          </div>
          <div>
            <dt className="pg-kicker">Harvest window</dt>
            <dd className="fig mt-0.5 font-semibold text-ink-deep">
              {cycle.projected_harvest_on
                ? new Date(cycle.projected_harvest_on).toLocaleDateString("en-GB", {
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="pg-kicker">Investors</dt>
            <dd className="fig mt-0.5 flex items-center gap-1.5 font-semibold text-ink-deep">
              <Users size={12} className="text-ink-mute" aria-hidden="true" />
              {investorCount}
            </dd>
          </div>
        </dl>

        <p className="pg-chip pg-chip--locked mt-auto self-start">
          <Lock size={10} aria-hidden="true" />
          {rulesChip(rules)}
        </p>

        <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3 text-[0.7rem] text-ink-mute">
          <span className="inline-flex items-center gap-1.5">
            <Waves size={12} aria-hidden="true" />
            {commodity?.targetYieldLabel ?? "Target yield set per cycle"}
          </span>
          {cycle.status === "open" && daysToClose !== null ? (
            <span className="inline-flex items-center gap-1 font-semibold text-ink-soft">
              <CalendarClock size={12} aria-hidden="true" />
              {daysToClose > 0 ? `${daysToClose}d left` : "closing"}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
