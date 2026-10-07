import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Lock,
  MapPin,
  Scale,
  Users,
} from "lucide-react";

import { AiConcierge } from "@/components/ndh/AiConcierge";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { StageRail } from "@/components/agri/StageRail";
import { WaterfallLadder } from "@/components/agri/WaterfallLadder";
import { TransparencyFeed, IncidentRegister } from "@/components/agri/TransparencyFeed";
import { ClimatePanel } from "@/components/agri/ClimatePanel";
import { Figure } from "@/components/ndh/ledger-ui";
import { getPublicCycle, type PublicCycleDetail } from "@/lib/agri.public.functions";
import { COMMODITIES, CYCLE_STATUS_LABEL, stageName, type CycleStatus } from "@/lib/agri/commodities";
import { dateLabel, money, moneyCompact, number, percent } from "@/lib/agri/format";
import { readRules, rulesChip } from "@/lib/agri/rules";

export const Route = createFileRoute("/cycles/$cycleId")({
  head: ({ loaderData }) => {
    const cycle = (loaderData as { detail: PublicCycleDetail | null } | undefined)?.detail?.cycle;
    return {
      meta: [
        { title: cycle ? `${cycle.code} · ${cycle.name} | NDH AgriCapital` : "Farm cycle | NDH AgriCapital" },
        {
          name: "description",
          content: cycle
            ? `${cycle.name} — target capital, live funding progress, locked profit split and the published farm record for this ${cycle.commodity} cycle.`
            : "A published NDH AgriCapital production cycle.",
        },
      ],
    };
  },
  loader: async ({ params }): Promise<{ detail: PublicCycleDetail | null }> => ({
    detail: await getPublicCycle({ data: { cycleId: params.cycleId } }),
  }),
  component: CycleDetail,
});

function CycleDetail() {
  // The router's loader inference collapses to `undefined` on this path-param
  // route; the loader above guarantees the shape, so assert it once here.
  const { detail } = Route.useLoaderData() as { detail: PublicCycleDetail | null };

  // Null means either "no such cycle" or "the ledger did not answer". Both are
  // shown honestly in place rather than as a hard error page.
  if (!detail) return <CycleUnavailable />;

  const { cycle } = detail;
  const commodity = COMMODITIES.find((item) => item.id === cycle.commodity);
  const Icon = commodity?.icon ?? Scale;
  const rules = readRules(cycle);

  const settlementAmounts = detail.settlement
    ? [
        { level: 1, amount: detail.settlement.liabilitiesPaid },
        { level: 2, amount: detail.settlement.principalReturned },
        { level: 3, amount: detail.settlement.reserveSetAside },
        { level: 4, amount: detail.settlement.netProfit },
      ]
    : undefined;

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/cycles" />

      <section className="border-b border-navy-line bg-navy text-white">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-9">
          <Link
            to="/cycles"
            className="inline-flex items-center gap-1.5 text-[0.76rem] font-semibold text-slate-400 no-underline hover:text-white"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            All cycles
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-signal">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-mono text-[0.66rem] uppercase tracking-widest text-signal">
                    {cycle.code}
                  </p>
                  <p className="font-display text-[1.05rem] font-bold">
                    {commodity?.name ?? "Farm stock"}
                  </p>
                </div>
                <span className="pg-chip pg-chip--signal">
                  {CYCLE_STATUS_LABEL[cycle.status as CycleStatus] ?? cycle.status}
                </span>
                <span className="pg-chip pg-chip--mint">
                  Stage {stageName(cycle.current_stage)}
                </span>
              </div>

              <h1 className="mt-4 font-display text-[1.7rem] font-bold leading-tight md:text-[2.15rem]">
                {cycle.name}
              </h1>
              {cycle.summary ? (
                <p className="mt-2.5 max-w-2xl text-[0.88rem] leading-7 text-slate-300">
                  {cycle.summary}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.74rem] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} className="text-signal" aria-hidden="true" />
                  {cycle.farm_site}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock size={13} className="text-signal" aria-hidden="true" />
                  {cycle.cycle_weeks} weeks · harvest{" "}
                  {cycle.projected_harvest_on ? dateLabel(cycle.projected_harvest_on) : "TBC"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} className="text-signal" aria-hidden="true" />
                  {detail.investorCount} investor{detail.investorCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-2xl border border-navy-line bg-white/[0.04] p-5">
              <p className="pg-kicker pg-kicker--onDark">Funding progress</p>
              <p className="fig mt-1.5 text-[1.6rem] font-bold">{percent(detail.fundedPercent, 1)}</p>
              <div className="pg-meter mt-3 bg-white/15">
                <span style={{ width: `${Math.min(100, detail.fundedPercent)}%` }} />
              </div>
              <p className="mt-2 text-[0.76rem] text-slate-300">
                <span className="fig font-semibold text-white">{money(detail.raised)}</span> raised of{" "}
                <span className="fig">{money(cycle.target_capital)}</span>
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-[0.72rem] text-slate-400">
                <BadgeCheck size={13} className="text-mint" aria-hidden="true" />
                Minimum ticket{" "}
                <span className="fig font-semibold text-white">{money(cycle.minimum_ticket)}</span>
              </p>

              {cycle.status === "open" ? (
                <Link
                  to="/signin"
                  className="pg-btn pg-btn--signal mt-4 w-full"
                  search={{ cycle: cycle.id }}
                >
                  Contribute to this cycle
                </Link>
              ) : (
                <p className="mt-4 rounded-xl border border-navy-line bg-navy-deep/50 px-3 py-2.5 text-[0.72rem] leading-5 text-slate-400">
                  This cycle is no longer accepting capital. It remains published so its full record
                  stays auditable.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-9">
        <StageRail currentStage={cycle.current_stage} />

        <dl className="mt-7 grid grid-cols-2 gap-5 rounded-2xl border border-hairline bg-white p-5 md:grid-cols-4">
          <Figure
            label="Target capital"
            value={moneyCompact(cycle.target_capital)}
            caption="Locked at publication"
          />
          <Figure
            label="Projected revenue"
            value={moneyCompact(cycle.projected_revenue)}
            caption="From the costed plan"
          />
          <Figure
            label="Investor share"
            value={`${rules.investorSharePercent}%`}
            caption="Of net profit, pro-rata"
            tone="credit"
          />
          <Figure
            label="Emergency reserve"
            value={`${rules.reservePercent}%`}
            caption="Of gross, held in escrow"
          />
        </dl>

        {detail.settlement ? (
          <div className="mt-6 rounded-2xl border border-hairline bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="pg-kicker">Settled cycle</p>
                <p className="mt-1 font-display text-[1.05rem] font-semibold text-ink-deep">
                  The waterfall has run
                </p>
              </div>
              <span className={`pg-chip ${detail.settlement.principalAtRisk ? "pg-chip--rose" : "pg-chip--mint"}`}>
                {detail.settlement.principalAtRisk
                  ? "Principal returned in part"
                  : "Principal returned in full"}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Figure label="Gross revenue" value={money(detail.settlement.grossRevenue)} />
              <Figure
                label="Principal returned"
                value={money(detail.settlement.principalReturned)}
                tone="credit"
              />
              <Figure label="Reserve held" value={money(detail.settlement.reserveSetAside)} />
              <Figure label="Net profit" value={money(detail.settlement.netProfit)} tone="credit" />
            </dl>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-hairline bg-porcelain p-4">
                <p className="pg-kicker">Distributed to members</p>
                <p className="fig mt-1 text-[1.1rem] font-semibold text-mint-deep">
                  {money(detail.settlement.investorProfitPool)}
                </p>
                <p className="mt-1 text-[0.72rem] text-ink-mute">
                  {detail.settlement.investorPercent}% of net profit, split pro-rata by equity
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-porcelain p-4">
                <p className="pg-kicker">Farm caretaker fee</p>
                <p className="fig mt-1 text-[1.1rem] font-semibold text-ink-deep">
                  {money(detail.settlement.operatorFee)}
                </p>
                <p className="mt-1 text-[0.72rem] text-ink-mute">
                  {detail.settlement.operatorPercent}% of net profit for running the stock
                </p>
              </div>
            </div>
            <p className="mt-3 text-[0.68rem] text-ink-mute">
              Settled {dateLabel(detail.settlement.executedAt)}
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="font-display text-[1.1rem] font-semibold text-ink-deep">
              Locked settlement terms
            </h2>
            <p className="mt-1.5 text-[0.8rem] leading-6 text-ink-soft">
              These were frozen the moment this cycle was published. The database itself refuses to
              change them afterwards.
            </p>
            <p className="pg-chip pg-chip--locked mt-3">
              <Lock size={10} aria-hidden="true" />
              {rulesChip(rules)}
            </p>
            <div className="mt-4">
              <WaterfallLadder
                rules={rules}
                {...(settlementAmounts ? { amounts: settlementAmounts } : {})}
                compact
              />
            </div>
          </div>

          <div>
            <h2 className="font-display text-[1.1rem] font-semibold text-ink-deep">
              Growth telemetry
            </h2>
            <p className="mt-1.5 text-[0.8rem] leading-6 text-ink-soft">
              What the farm operator records for this stock every day or week.
            </p>

            {detail.harvest ? (
              <div className="mt-4 rounded-xl border border-hairline bg-white p-4">
                <p className="pg-kicker">Harvest weigh-in</p>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <Figure
                    label="Total weight"
                    value={detail.harvest.totalWeightKg === null ? "—" : `${number(detail.harvest.totalWeightKg, 1)} kg`}
                  />
                  <Figure
                    label="Pieces"
                    value={detail.harvest.totalCount === null ? "—" : number(detail.harvest.totalCount)}
                  />
                  <Figure label="Weighed on" value={dateLabel(detail.harvest.harvestDate)} />
                  <Figure
                    label="Banked revenue"
                    value={money(detail.harvest.grossRevenue)}
                    tone={detail.harvest.grossRevenue > 0 ? "credit" : "plain"}
                  />
                </dl>
                {detail.harvest.scaleTicketRef ? (
                  <p className="mt-3 font-mono text-[0.68rem] text-ink-mute">
                    Batch scale ticket {detail.harvest.scaleTicketRef}
                    {detail.harvest.buyer ? ` · buyer ${detail.harvest.buyer}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            <ul className="mt-4 space-y-2">
              {(commodity?.telemetry ?? []).map((line) => (
                <li
                  key={line}
                  className="flex gap-2 rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-[0.78rem] text-ink-soft"
                >
                  <BadgeCheck size={14} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>

            <p className="mt-4 rounded-xl border border-hairline bg-porcelain px-3.5 py-3 text-[0.74rem] leading-5 text-ink-soft">
              <strong className="font-semibold text-ink-deep">Revenue basis.</strong>{" "}
              {commodity?.revenueBasis}
            </p>

            <div className="mt-5">
              <ClimatePanel logged={detail.weather} />
            </div>
          </div>
        </div>

        <div className="mt-9 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="pg-card p-5">
            <p className="pg-kicker mb-4">Published farm record</p>
            <TransparencyFeed milestones={detail.milestones} limit={10} />
          </div>
          <div className="pg-card p-5">
            <p className="pg-kicker mb-3">Incident register</p>
            <IncidentRegister incidents={detail.incidents} />
          </div>
        </div>
      </section>

      <FamilyFooter />
      <AiConcierge />
    </div>
  );
}

/**
 * Shown when a cycle id has no published cycle behind it — or when the ledger
 * could not be reached at all. Rendered in place so a transient outage never
 * looks like a missing page.
 */
function CycleUnavailable() {
  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/cycles" />
      <section className="mx-auto max-w-3xl px-[var(--gutter)] py-20 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-white text-ink-mute shadow-card">
          <Scale size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-[1.5rem] font-bold text-ink-deep">
          This cycle is not on the public register
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[0.86rem] leading-7 text-ink-soft">
          Either the code does not match a published cycle, or the ledger did not answer this
          request. Only published cycles are visible here — drafts stay private until an
          administrator freezes their terms.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/cycles" className="pg-btn pg-btn--primary">
            Browse the marketplace
          </Link>
          <Link to="/" className="pg-btn pg-btn--ghost">
            Back to the overview
          </Link>
        </div>
      </section>
      <FamilyFooter />
    </div>
  );
}
