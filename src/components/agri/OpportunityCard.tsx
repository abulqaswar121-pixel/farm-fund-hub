import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Clock3, Target, Users } from "lucide-react";

import { COMMODITIES } from "@/lib/agri/commodities";
import { moneyPublic } from "@/lib/agri/format";
import { useLocale } from "@/lib/agri/i18n";
import { plainStatus } from "@/lib/agri/plain";
import type { PublicCycleCard } from "@/lib/agri.public.functions";
import { cn } from "@/lib/utils";

/**
 * An "open farm opportunity" card.
 *
 * The brief asks for four things on every card — target capital, days
 * remaining, expected timeline and a live funding bar — and this delivers
 * exactly those, in that order, above the fold on a 360px screen. Everything is
 * a published term or a rounded aggregate: no cycle projection, no member
 * amount, nothing a passer-by could use to infer what somebody put in.
 */

const STATUS_TONE: Record<string, string> = {
  open: "pg-chip--mint",
  funded: "pg-chip--signal",
  active: "pg-chip--signal",
  harvested: "pg-chip--closing",
  settled: "pg-chip--locked",
};

function daysRemaining(closesOn: string | null): number | null {
  if (!closesOn) return null;
  const end = new Date(`${closesOn.length === 10 ? `${closesOn}T23:59:59` : closesOn}`).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

function monthsLabel(weeks: number): string {
  const months = weeks / 4.345;
  if (months < 1.6) return `${weeks} weeks`;
  return `${Math.round(months)} months`;
}

export function OpportunityCard({
  card,
  className,
}: {
  card: PublicCycleCard;
  className?: string;
}) {
  const { t } = useLocale();
  const commodity = COMMODITIES.find((item) => item.id === card.commodity);
  const status = plainStatus(card.status);
  const days = daysRemaining(card.fundingClosesOn);
  const isOpen = card.status === "open";

  return (
    <article
      className={cn("pg-card pg-card--lift group flex min-w-0 flex-col overflow-hidden", className)}
    >
      {/* Photograph + tags ------------------------------------------------ */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-navy">
        <img
          src={commodity?.image ?? "/images/commodities/catfish.jpg"}
          alt={`${commodity?.name ?? "Farm stock"} — ${commodity?.species ?? "farm produce"}`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,48,0.10)_0%,rgba(10,26,48,0.05)_38%,rgba(10,26,48,0.80)_100%)]" />
        <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-navy/75 px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-signal backdrop-blur-sm">
          {card.code}
        </span>
        <span
          className={cn(
            "pg-chip absolute right-3 top-3 backdrop-blur-sm",
            STATUS_TONE[card.status],
          )}
        >
          {status.label}
        </span>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-[1rem] font-bold leading-tight text-white drop-shadow">
              {card.name}
            </p>
            <p className="mt-0.5 truncate text-[0.68rem] text-slate-200">
              {commodity?.species ?? "Farm stock"} · {card.farmSite}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        {/* The four figures the brief asks for ---------------------------- */}
        <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
          <Cell
            icon={<Target size={12} />}
            label={t("opps.target")}
            value={moneyPublic(card.targetCapital, 10_000)}
          />
          <Cell
            icon={<Clock3 size={12} />}
            label={t("opps.daysLeft")}
            value={
              !isOpen
                ? "Closed"
                : days === null
                  ? "Open until funded"
                  : `${days} day${days === 1 ? "" : "s"}`
            }
            tone={isOpen && days !== null && days <= 7 ? "closing" : "plain"}
          />
          <Cell
            icon={<CalendarClock size={12} />}
            label={t("opps.timeline")}
            value={`${monthsLabel(card.cycleWeeks)}`}
            hint={`${card.cycleWeeks} weeks`}
          />
        </dl>

        {/* Live funding progress ----------------------------------------- */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="pg-kicker">{t("opps.progress")}</span>
            <span className="fig text-[0.86rem] font-semibold text-ink-deep">
              {card.fundedPercent}%
            </span>
          </div>
          <div
            className="pg-meter mt-1.5"
            role="progressbar"
            aria-valuenow={card.fundedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${card.code} is ${card.fundedPercent}% funded`}
          >
            <span style={{ width: `${Math.min(100, card.fundedPercent)}%` }} />
          </div>
          <p className="mt-1.5 text-[0.7rem] text-ink-soft">
            {moneyPublic(card.raisedRounded, 10_000)} of {moneyPublic(card.targetCapital, 10_000)}{" "}
            raised · {t("common.from")} {moneyPublic(card.minimumTicket, 500)}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-hairline pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-ink-mute">
            <Users size={12} aria-hidden="true" />
            {card.publicUpdateCount > 0
              ? `${card.publicUpdateCount} farm update${card.publicUpdateCount === 1 ? "" : "s"}`
              : "New cycle"}
          </span>
          <Link
            to="/cycles/$cycleId"
            params={{ cycleId: card.id }}
            className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-[0.74rem] font-semibold text-white no-underline transition-colors hover:bg-navy-soft"
          >
            {t("opps.join")}
            <ArrowRight
              size={13}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

function Cell({
  icon,
  label,
  value,
  hint,
  tone = "plain",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "plain" | "closing";
}) {
  return (
    <div className="min-w-0">
      <dt className="pg-kicker flex items-center gap-1">
        <span className="text-signal-deep" aria-hidden="true">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </dt>
      <dd
        className={cn(
          "fig mt-1 truncate text-[0.82rem] font-semibold",
          tone === "closing" ? "text-amber-700" : "text-ink-deep",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="mt-0.5 text-[0.62rem] text-ink-mute">{hint}</dd> : null}
    </div>
  );
}
