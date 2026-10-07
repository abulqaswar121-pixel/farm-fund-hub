import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Info,
  Lock,
  MapPin,
  Scale,
  Sprout,
} from "lucide-react";

import { AiConcierge } from "@/components/ndh/AiConcierge";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { StageRail } from "@/components/agri/StageRail";
import { TransparencyFeed, IncidentRegister } from "@/components/agri/TransparencyFeed";
import { ClimatePanel } from "@/components/agri/ClimatePanel";
import { getPublicCycle, type PublicCycleDetail } from "@/lib/agri.public.functions";
import { COMMODITIES } from "@/lib/agri/commodities";
import { moneyPublic, number } from "@/lib/agri/format";
import { NUMBER_HINT, PLAIN_PAYOUT_ORDER, plainStatus } from "@/lib/agri/plain";
import { DEFAULT_RULES } from "@/lib/agri/rules";
import { dateLabel } from "@/lib/agri/format";

export const Route = createFileRoute("/cycles/$cycleId")({
  head: ({ loaderData }) => {
    const cycle = (loaderData as { detail: PublicCycleDetail | null } | undefined)?.detail?.cycle;
    return {
      meta: [
        {
          title: cycle
            ? `${cycle.code} · ${cycle.name} | NDH AgriCapital`
            : "Farm cycle | NDH AgriCapital",
        },
        {
          name: "description",
          content: cycle
            ? `${cycle.name} — what the cycle needs, how much has been raised so far, how long it runs and what the farm has published so far.`
            : "A published NDH AgriCapital farm cycle.",
        },
      ],
    };
  },
  loader: async ({ params }): Promise<{ detail: PublicCycleDetail | null }> => ({
    detail: await getPublicCycle({ data: { cycleId: params.cycleId } }),
  }),
  component: CycleDetail,
});

/**
 * A published cycle, written for a first-time visitor.
 *
 * This page is an advertisement and a trust record, not a ledger dump. It shows
 * what the cycle needs, how far along it is, how the payout rule works and what
 * the farm has published. The cycle's own money — what it expects to earn, what
 * it owes, what it actually paid out — belongs to the members who funded it and
 * lives in their portal.
 */
function CycleDetail() {
  // The router's loader inference collapses to `undefined` on this path-param
  // route; the loader above guarantees the shape, so assert it once here.
  const { detail } = Route.useLoaderData() as { detail: PublicCycleDetail | null };

  if (!detail) return <CycleUnavailable />;

  const { cycle } = detail;
  const commodity = COMMODITIES.find((item) => item.id === cycle.commodity);
  const Icon = commodity?.icon ?? Scale;
  const status = plainStatus(cycle.status);
  const remaining = Math.max(0, cycle.targetCapital - cycle.raisedRounded);
  const canJoin = cycle.status === "open";

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/cycles" />

      <section className="band-dark">
        <div className="bg-grid-pattern absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="hero-glow left-1/4 top-[-170px] h-[320px] w-[620px]" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--grad-master)] opacity-70" />

        <div className="relative z-10 mx-auto max-w-[var(--page)] px-[var(--gutter)] py-8">
          <Link
            to="/cycles"
            className="inline-flex items-center gap-1.5 text-[0.76rem] font-semibold text-slate-400 no-underline hover:text-white"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            All cycles
          </Link>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-signal">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[0.66rem] uppercase tracking-widest text-signal">
                    {cycle.code}
                  </p>
                  <p className="font-display text-[1.05rem] font-bold">
                    {commodity?.name ?? "Farm stock"}
                  </p>
                </div>
                <span className="pg-chip pg-chip--signal">{status.label}</span>
              </div>

              <h1 className="mt-4 font-display text-[1.6rem] font-bold leading-tight sm:text-[1.85rem] lg:text-[2.15rem]">
                {cycle.name}
              </h1>
              <p className="mt-2.5 max-w-2xl text-[0.88rem] leading-7 text-slate-300">
                {cycle.summary ?? `${commodity?.summary ?? "A farm cycle"} raised by members.`}
              </p>
              <p className="mt-2 text-[0.8rem] leading-6 text-slate-400">{status.blurb}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.74rem] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} className="shrink-0 text-signal" aria-hidden="true" />
                  {cycle.farmSite}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock size={13} className="shrink-0 text-signal" aria-hidden="true" />
                  Runs {cycle.cycleWeeks} weeks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sprout size={13} className="shrink-0 text-signal" aria-hidden="true" />
                  Harvest expected {dateLabel(cycle.projectedHarvestOn)}
                </span>
              </div>
            </div>

            {/* What a visitor actually needs to decide. */}
            <div className="w-full min-w-0 rounded-2xl border border-navy-line bg-white/[0.05] p-5 shadow-lg backdrop-blur-md lg:max-w-sm">
              <p className="pg-kicker pg-kicker--onDark">How the funding is going</p>
              <p className="fig mt-1.5 text-[1.6rem] font-bold text-white">
                {cycle.fundedPercent}%
              </p>
              <div className="pg-meter mt-3 bg-white/15">
                <span style={{ width: `${Math.min(100, cycle.fundedPercent)}%` }} />
              </div>
              <p className="mt-2 text-[0.8rem] text-slate-300">
                <span className="fig font-semibold text-white">
                  {moneyPublic(cycle.raisedRounded)}
                </span>{" "}
                raised of <span className="fig">{moneyPublic(cycle.targetCapital)}</span>
              </p>
              <p className="mt-1.5 text-[0.72rem] leading-5 text-slate-400">
                {NUMBER_HINT.raisedSoFar}{" "}
                {remaining > 0 ? `${moneyPublic(remaining)} still needed.` : "The target is met."}
              </p>

              <dl className="mt-4 space-y-3 border-t border-navy-line pt-4 text-[0.76rem]">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-400">Smallest amount you can put in</dt>
                  <dd className="fig shrink-0 font-semibold text-white">
                    {moneyPublic(cycle.minimumTicket, 500)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-400">Funding closes</dt>
                  <dd className="shrink-0 font-semibold text-white">
                    {dateLabel(cycle.fundingClosesOn)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-slate-400">Harvest expected</dt>
                  <dd className="shrink-0 font-semibold text-white">
                    {dateLabel(cycle.projectedHarvestOn)}
                  </dd>
                </div>
              </dl>

              {canJoin ? (
                <>
                  <Link
                    to="/signin"
                    className="pg-btn pg-btn--signal mt-4 w-full"
                    search={{ cycle: cycle.id }}
                  >
                    Join this cycle
                  </Link>
                  <p className="mt-2 text-center text-[0.68rem] leading-4 text-slate-400">
                    Opening a member account is free. You only pay when you decide to put money in.
                  </p>
                </>
              ) : (
                <p className="mt-4 rounded-xl border border-navy-line bg-navy-deep/50 px-3 py-2.5 text-[0.74rem] leading-5 text-slate-400">
                  This cycle is no longer collecting money. It stays published so its record can be
                  checked by anyone.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-9">
        {/* Where the cycle has got to, in plain words. */}
        <div className="rounded-2xl border border-hairline bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="pg-kicker">Where this cycle has got to</p>
            <p className="text-[0.72rem] text-ink-mute">{NUMBER_HINT.cycleProgress}</p>
          </div>
          <div className="mt-3">
            <StageRail currentStage={cycle.currentStage} />
          </div>
        </div>

        {/* The three things a newcomer asks about. */}
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PlainFigure
            label="What the cycle needs"
            value={moneyPublic(cycle.targetCapital)}
            hint={NUMBER_HINT.target}
          />
          <PlainFigure
            label="How long it runs"
            value={`${cycle.cycleWeeks} weeks`}
            hint={NUMBER_HINT.duration}
          />
          <PlainFigure
            label="Harvest expected"
            value={dateLabel(cycle.projectedHarvestOn)}
            hint={NUMBER_HINT.harvestWindow}
          />
        </dl>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* The payout rule, in plain words. No real cycle figures. */}
          <div className="pg-card min-w-0 p-5">
            <h2 className="font-display text-[1.1rem] font-semibold text-ink-deep">
              How profit is shared
            </h2>
            <p className="mt-1.5 text-[0.82rem] leading-6 text-ink-soft">
              When the harvest is sold, the money is shared out in this order. The same order
              applies to every cycle on this platform, and it cannot be changed once a cycle has
              started.
            </p>

            <ol className="mt-4 space-y-3">
              {PLAIN_PAYOUT_ORDER.map((step) => (
                <li
                  key={step.step}
                  className="relative min-w-0 rounded-xl border border-hairline bg-white p-3.5 pl-11"
                >
                  <span className="absolute left-3.5 top-3.5 grid size-6 place-items-center rounded-full bg-navy font-mono text-[0.68rem] font-bold text-white">
                    {step.step}
                  </span>
                  <p className="font-display text-[0.85rem] font-semibold text-ink-deep">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[0.78rem] leading-6 text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>

            <p className="pg-chip pg-chip--locked mt-4">
              <Lock size={10} aria-hidden="true" />
              Members share {DEFAULT_RULES.investorSharePercent}% of profit · the safety slice is{" "}
              {DEFAULT_RULES.minimumReservePercent}–{DEFAULT_RULES.maximumReservePercent}%
            </p>
            <p className="mt-3 flex gap-2 rounded-xl border border-hairline bg-porcelain px-3.5 py-3 text-[0.76rem] leading-6 text-ink-soft">
              <Info size={14} className="mt-0.5 shrink-0 text-signal-deep" aria-hidden="true" />
              <span>
                This cycle&apos;s own figures — what it expects to earn, what it owes, what it pays
                out — are shown to the members who put money in. They are visible in full once you
                are signed in and part of the cycle.
              </span>
            </p>
          </div>

          {/* What the farm is doing, and what we record. */}
          <div className="min-w-0 space-y-5">
            <div className="pg-card p-5">
              <h2 className="font-display text-[1.1rem] font-semibold text-ink-deep">
                What we record on the farm
              </h2>
              <p className="mt-1.5 text-[0.82rem] leading-6 text-ink-soft">
                The farm team writes down the same things every day or week. A supervisor approves
                each entry before it is published, and the public only ever sees the short summary —
                never the raw counts or the bills behind it.
              </p>
              <ul className="mt-4 grid gap-2">
                {(commodity?.telemetryPlain ?? []).map((line) => (
                  <li
                    key={line.label}
                    className="flex min-w-0 gap-2.5 rounded-xl border border-hairline bg-white px-3.5 py-2.5"
                  >
                    <BadgeCheck
                      size={15}
                      className="mt-0.5 shrink-0 text-mint"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <strong className="block text-[0.8rem] font-semibold text-ink-deep">
                        {line.label}
                      </strong>
                      <span className="mt-0.5 block text-[0.75rem] leading-5 text-ink-mute">
                        {line.hint}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {commodity ? (
                <p className="mt-3 rounded-xl border border-hairline bg-porcelain px-3.5 py-3 text-[0.76rem] leading-6 text-ink-soft">
                  <strong className="font-semibold text-ink-deep">How this cycle earns.</strong>{" "}
                  {commodity.revenueBasis}
                </p>
              ) : null}
            </div>

            {detail.harvest ? (
              <div className="pg-card p-5">
                <p className="pg-kicker">Harvest weighed in</p>
                <p className="fig mt-2 text-[1.3rem] font-semibold text-ink-deep">
                  {detail.harvest.totalWeightKg === null
                    ? dateLabel(detail.harvest.harvestDate)
                    : `${number(detail.harvest.totalWeightKg, 1)} kg`}
                </p>
                <p className="mt-1.5 text-[0.78rem] leading-6 text-ink-soft">
                  The harvest was weighed on {dateLabel(detail.harvest.harvestDate)} and the weight
                  recorded here. Selling price and the money it brought in are shared with the
                  members of this cycle.
                </p>
              </div>
            ) : null}

            <ClimatePanel logged={detail.weather} />
          </div>
        </div>

        {/* What the farm has published — the simple, public record. */}
        <div className="mt-9 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="pg-card min-w-0 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="pg-kicker">What the farm has posted</p>
              <span className="pg-chip pg-chip--mint">
                <span className="pg-live-dot" aria-hidden="true" />
                Updated as work happens
              </span>
            </div>
            <TransparencyFeed milestones={detail.milestones} limit={10} />
          </div>
          <div className="pg-card min-w-0 p-5">
            <p className="pg-kicker mb-3">Problems we have logged</p>
            <IncidentRegister incidents={detail.incidents} />
          </div>
        </div>
      </section>

      <FamilyFooter />
      <AiConcierge />
    </div>
  );
}

/** A number with the sentence that says what it counts. */
function PlainFigure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="pg-card min-w-0 p-5">
      <dt className="pg-kicker">{label}</dt>
      <dd className="mt-2">
        <span className="fig block text-[1.25rem] font-semibold leading-tight text-ink-deep">
          {value}
        </span>
        <span className="mt-1.5 block text-[0.75rem] leading-5 text-ink-mute">{hint}</span>
      </dd>
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
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-white text-ink-mute shadow-[var(--shadow-soft)]">
          <Scale size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-[1.4rem] font-bold text-ink-deep sm:text-[1.5rem]">
          We could not find that cycle
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[0.86rem] leading-7 text-ink-soft">
          Either the code does not match a published cycle, or the ledger did not answer this
          request. Only published cycles appear here — a cycle still being planned stays private
          until its terms are locked.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/cycles" className="pg-btn pg-btn--primary">
            Browse the farm cycles
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
