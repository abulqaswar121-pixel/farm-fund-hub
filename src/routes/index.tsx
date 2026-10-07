import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CalendarCheck,
  Coins,
  Fish,
  Lock,
  PiggyBank,
  Repeat,
  Scale,
  ShieldCheck,
  Sparkles,
  Sprout,
  Waves,
} from "lucide-react";

import { AiConcierge } from "@/components/ndh/AiConcierge";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { CycleCard } from "@/components/agri/CycleCard";
import { LiveFarmTicker } from "@/components/agri/LiveFarmTicker";
import { ExampleWalkthrough } from "@/components/agri/ExampleWalkthrough";
import { HowWeKeepThisHonest } from "@/components/agri/HowWeKeepThisHonest";
import { TransparencyFeed, IncidentRegister } from "@/components/agri/TransparencyFeed";
import { ClimatePanel } from "@/components/agri/ClimatePanel";
import { StageRail } from "@/components/agri/StageRail";
import { Figure } from "@/components/ndh/ledger-ui";
import { getPlatformPulse, listPublicCycles } from "@/lib/agri.public.functions";
import { COMMODITIES } from "@/lib/agri/commodities";
import { moneyCompact, moneyPublic, number, percent } from "@/lib/agri/format";
import { NUMBER_HINT, PLAIN_JOURNEY, PLAIN_PAYOUT_ORDER } from "@/lib/agri/plain";
import { DEFAULT_RULES } from "@/lib/agri/rules";

/**
 * The visitor's version of the four-step journey.
 *
 * The words are plain on purpose: a first-time visitor should not have to learn
 * the ledger's vocabulary before they can judge the offer. The ledger's own term
 * for each step still appears underneath, small and grey, because a member who
 * signs in will meet it in the portal and should recognise it.
 */
const JOURNEY_ICONS = [PiggyBank, Fish, Scale, Waves] as const;

const JOURNEY_LEDGER_TERM: Record<string, string> = {
  "01": "Capital pooling",
  "02": "Stocking & growth",
  "03": "Harvest & off-take",
  "04": "Waterfall settlement",
};

const JOURNEY_CHIP_TONE: Record<string, string> = {
  "01": "pg-chip--mint",
  "02": "pg-chip--signal",
  "03": "pg-chip--closing",
  "04": "pg-chip--mint",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NDH AgriCapital | Farm investment with the books left open" },
      {
        name: "description",
        content:
          "Put money into real farm cycles — catfish, tilapia, broilers, layers, grain and greenhouses — and see the books for every one: what the cycle needs, what the farm did, what the harvest weighed and who got paid.",
      },
      { property: "og:title", content: "NDH AgriCapital | Farm capital with the books left open" },
      {
        property: "og:description",
        content:
          "Real Nigerian farm cycles, funded by members, run on rules fixed before anyone pays and published as they happen.",
      },
    ],
  }),
  loader: async () => {
    const [pulse, marketplace] = await Promise.all([getPlatformPulse(), listPublicCycles()]);
    return { pulse, cycles: marketplace.cycles, ledgerReachable: marketplace.ledgerReachable };
  },
  component: PublicHome,
});

function PublicHome() {
  const { pulse, cycles, ledgerReachable } = Route.useLoaderData();

  const openCycles = cycles.filter((card) => card.status === "open" || card.status === "funded");
  const featured = (openCycles.length > 0 ? openCycles : cycles).slice(0, 3);
  const moneyBackToMembers = pulse.capitalReturned + pulse.profitDistributed;
  const hasTrackRecord = pulse.settledCycles > 0;

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/" />

      {/* ---------------------------------------------------------------- *
       * Hero — deep navy, ambient glow, and the platform's own numbers.
       * Every counter below is counted from the ledger on each request.
       * ---------------------------------------------------------------- */}
      <section className="band-dark">
        <div className="bg-grid-pattern absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="hero-glow left-1/2 top-[-140px] h-[380px] w-[720px] -translate-x-1/2"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--grad-master)] opacity-70" />

        <div className="relative z-10 mx-auto grid min-w-0 max-w-[var(--page)] gap-10 px-[var(--gutter)] py-14 lg:grid-cols-[1.12fr_0.88fr] lg:py-20">
          <div className="min-w-0">
            <p className="animate-rise-in inline-flex max-w-full items-center gap-2 rounded-full border border-signal/30 bg-white/[0.06] px-4 py-1.5 text-[0.7rem] font-semibold text-signal shadow-lg backdrop-blur-md">
              <Sparkles size={13} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0">
                The agricultural investment ledger of Najeeb Digital Hub
              </span>
            </p>

            <h1 className="animate-rise-in animate-rise-in--1 mt-5 font-display text-[2.1rem] font-bold leading-[1.06] tracking-tight sm:text-[2.8rem] lg:text-[3.15rem]">
              Farm capital with the
              <br />
              <span className="pg-gradient-text">books left open.</span>
            </h1>

            <p className="animate-rise-in animate-rise-in--2 mt-5 max-w-xl text-[0.95rem] leading-7 text-slate-300">
              Members put money into real farm cycles — catfish and tilapia ponds, broiler and layer
              houses, grain fields and greenhouses. For each one we publish what the cycle needs,
              what the farm actually did, what the harvest weighed, and who was paid. The rules that
              decide the split are written into the cycle before anybody pays in.
            </p>

            <div className="animate-rise-in animate-rise-in--3 mt-7 flex flex-wrap items-center gap-3">
              <Link to="/cycles" className="pg-btn pg-btn--signal">
                <Sprout size={16} aria-hidden="true" />
                See open cycles
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/signin" className="pg-btn pg-btn--onDark">
                Member Sign In
              </Link>
              <a href="#maths" className="pg-btn pg-btn--onDark">
                <Calculator size={16} aria-hidden="true" />
                Try the numbers
              </a>
            </div>

            {/* Platform pulse — counted from the ledger, never seeded. */}
            <dl className="mt-9 grid min-w-0 gap-4 sm:grid-cols-3">
              <HeroCounter
                label="Capital deployed"
                value={moneyCompact(pulse.capitalDeployed)}
                caption={NUMBER_HINT.moneyInvested}
              />
              <HeroCounter
                label="Livestock on farm"
                value={number(pulse.livestockOnFarm)}
                caption={NUMBER_HINT.animals}
              />
              <HeroCounter
                label="Cycles settled"
                value={number(pulse.settledCycles)}
                caption={NUMBER_HINT.cyclesFinished}
              />
            </dl>

            <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
              {number(pulse.activeCycles)} cycles growing on a farm right now ·{" "}
              {number(pulse.openCycles)} still open to new members · {number(pulse.membersCount)}{" "}
              registered members. These counters read zero until the co-operative publishes its
              first cycle — we never fill them with an illustration.
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-navy-line bg-white/[0.05] p-5 shadow-lg backdrop-blur-md">
              <p className="pg-kicker pg-kicker--onDark">Agreed before you pay</p>
              <ul className="mt-3 space-y-3">
                <LockedRow
                  icon={<Lock size={15} />}
                  title={`${percent(DEFAULT_RULES.investorSharePercent, 0)} of profit to members, ${percent(
                    DEFAULT_RULES.operatorSharePercent,
                    0,
                  )} to the farm caretaker`}
                  body="Written into the cycle when it is published. It cannot be renegotiated at harvest."
                />
                <LockedRow
                  icon={<Waves size={15} />}
                  title="Bills first, then members, then profit"
                  body="A fixed order of payments. Nothing is shared as profit until every member has their money back."
                />
                <LockedRow
                  icon={<Coins size={15} />}
                  title="Your share, counted from the ledger"
                  body="Your percentage is worked out from payments we have confirmed, every time you look — never stored, never guessed."
                />
              </ul>
              <a
                href="#how-it-works"
                className="mt-4 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-signal no-underline"
              >
                See how a cycle runs
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            </div>

            <div className="rounded-2xl border border-navy-line bg-white/[0.05] p-5 shadow-lg backdrop-blur-md">
              <p className="pg-kicker pg-kicker--onDark">Where the co-operative stands today</p>
              <div className="mt-3 grid min-w-0 grid-cols-2 gap-4">
                <MiniFigure
                  value={number(pulse.membersCount)}
                  label="Registered members"
                  caption={NUMBER_HINT.members}
                />
                <MiniFigure
                  value={number(pulse.settledCycles)}
                  label="Cycles paid out"
                  caption="Finished, sold and shared out."
                />
                <MiniFigure
                  value={moneyCompact(moneyBackToMembers)}
                  label="Money back to members"
                  caption={NUMBER_HINT.paidBack}
                />
                <MiniFigure
                  value={String(COMMODITIES.length)}
                  label="Stock families"
                  caption="Fish, poultry, grain and greenhouse produce."
                />
              </div>
              {!hasTrackRecord ? (
                <p className="mt-4 border-t border-navy-line pt-3 text-[0.68rem] leading-4 text-slate-400">
                  These are the co-operative&apos;s real totals, so they start at zero. We publish
                  no illustrative returns.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Live farm ticker — the strip directly under the hero band. */}
      <LiveFarmTicker
        cycles={cycles.map((card) => ({
          code: card.code,
          commodity: card.commodity,
          status: card.status,
        }))}
      />

      {/* ---------------------------------------------------------------- *
       * Marketplace
       * ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-14 sm:py-16">
        <div className="flex flex-col gap-3 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="pg-kicker">Cycles you can join</p>
            <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.85rem]">
              {openCycles.length > 0 ? "Open for funding right now" : "The marketplace today"}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[0.85rem] leading-6 text-ink-soft">
              Each card tells you what the cycle needs, how much has come in so far, the smallest
              amount you can put in and when the harvest is expected. Progress is rounded down, so
              it can only ever understate how far a cycle has come.
            </p>
          </div>
          <Link to="/cycles" className="pg-btn pg-btn--ghost shrink-0">
            See every cycle
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((card) => (
              <CycleCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="pg-card mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-porcelain text-ink-mute">
              <Sprout size={20} />
            </span>
            <p className="font-display text-base font-semibold text-ink-deep">
              {ledgerReachable
                ? "No cycles are published yet"
                : "We could not reach the ledger just now"}
            </p>
            <p className="max-w-md text-[0.82rem] leading-6 text-ink-mute">
              {ledgerReachable
                ? "A cycle is only published once its costs, its stocking plan and its locked profit split are settled. Open a member account and a new cycle will be waiting the moment it goes live."
                : "The marketplace service did not answer this request, so no live figures can be shown. Nothing has been lost — reload in a moment."}
            </p>
            <p className="max-w-md text-[0.78rem] leading-6 text-ink-mute">
              In the meantime, the {percent(DEFAULT_RULES.investorSharePercent, 0)}/
              {percent(DEFAULT_RULES.operatorSharePercent, 0)} split and the order of payments are
              fixed for every cycle — you can try them on made-up numbers below.
            </p>
            <Link to="/signin" className="pg-btn pg-btn--primary mt-1">
              Open a member account
            </Link>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- *
       * Lifecycle — the four-step journey, plain words over the ledger term.
       * ---------------------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-hairline bg-white">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-14 sm:py-16">
          <div className="min-w-0">
            <p className="pg-kicker">How it works</p>
            <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
              What happens to your money, in four steps
            </h2>
            <p className="mt-2 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
              Fish, poultry, grain and greenhouse cycles all follow the same arc. The terms are
              fixed before step one; the arithmetic is published at step four.
            </p>
          </div>

          <div className="mt-8 grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLAIN_JOURNEY.map((step, index) => {
              const Icon = JOURNEY_ICONS[index] ?? Sprout;
              return (
                <div key={step.n} className="pg-card relative min-w-0 p-6">
                  <div className="pg-numeral absolute right-5 top-4" aria-hidden="true">
                    {step.n}
                  </div>
                  <span className="grid size-11 place-items-center rounded-xl bg-[image:var(--grad-master)] text-navy-deep">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-display text-[1rem] font-bold leading-snug text-ink-deep">
                    <span className="fig mr-1.5 text-[0.72rem] text-ink-mute">{step.n}</span>
                    {step.title}
                  </p>
                  <p className="mt-2 text-[0.8rem] leading-6 text-ink-soft">{step.body}</p>
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <span className={`pg-chip ${JOURNEY_CHIP_TONE[step.n] ?? "pg-chip"}`}>
                      {step.chip}
                    </span>
                    <span className="font-mono text-[0.62rem] uppercase tracking-wider text-ink-mute">
                      {JOURNEY_LEDGER_TERM[step.n] ?? ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-2xl border border-hairline bg-porcelain p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="pg-kicker">On the farm side</p>
                <p className="mt-1.5 max-w-2xl text-[0.8rem] leading-6 text-ink-soft">
                  The farm team works through six logged stages, from collecting money to sharing
                  the profit. Members can watch the rail move on any cycle they have backed.
                </p>
              </div>
              <Link to="/cycles" className="pg-btn pg-btn--ghost shrink-0">
                See it on a live cycle
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4 min-w-0">
              <StageRail currentStage="operational" />
            </div>
          </div>

          <div className="mt-10 min-w-0">
            <p className="pg-kicker">What we raise</p>
            <h3 className="mt-1.5 text-[1.2rem] leading-tight text-ink-deep sm:text-[1.4rem]">
              Six stock families, each with its own record-keeping
            </h3>
            <p className="mt-1.5 max-w-3xl text-[0.82rem] leading-6 text-ink-soft">
              Whatever the stock, the same habit applies: somebody measures it, writes it down, and
              a second person checks it before it reaches you.
            </p>
            <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COMMODITIES.map((commodity) => {
                const Icon = commodity.icon;
                return (
                  <div key={commodity.id} className="pg-card min-w-0 overflow-hidden">
                    <div className="pg-banner">
                      <img
                        src={commodity.image}
                        alt={`${commodity.name} — ${commodity.species}`}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="pg-banner-scrim" aria-hidden="true" />
                      <span className="absolute inset-x-3 bottom-2.5 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/20 bg-navy/70 px-3 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
                        <Icon size={12} aria-hidden="true" className="shrink-0 text-signal" />
                        <span className="truncate">{commodity.species}</span>
                      </span>
                    </div>
                    <div className="min-w-0 p-4">
                      <p className="font-display text-[0.92rem] font-semibold text-ink-deep">
                        {commodity.name}
                      </p>
                      <p className="mt-1.5 text-[0.75rem] leading-5 text-ink-soft">
                        {commodity.summary}
                      </p>
                      <ul className="mt-3 list-none space-y-1.5 p-0">
                        {commodity.telemetryPlain.slice(0, 2).map((line) => (
                          <li key={line.label} className="min-w-0">
                            <span className="flex gap-1.5 text-[0.72rem] font-semibold text-mint-deep">
                              <ShieldCheck
                                size={12}
                                className="mt-0.5 shrink-0"
                                aria-hidden="true"
                              />
                              {line.label}
                            </span>
                            <span className="mt-0.5 block text-[0.7rem] leading-5 text-ink-mute">
                              {line.hint}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * The maths — an example the visitor drives, never a real cycle's plan.
       * ---------------------------------------------------------------- */}
      <section id="maths" className="scroll-mt-20 py-14 sm:py-16">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
          <div className="min-w-0">
            <p className="pg-kicker">The maths, in the open</p>
            <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
              Run the numbers yourself
            </h2>
            <p className="mt-2 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
              No real cycle&apos;s plans are used here, because what a cycle expects to earn is the
              co-operative&apos;s business and not a public claim. Instead, build a made-up cycle
              and watch the same order of payments that runs at a real harvest.
            </p>
          </div>

          <div className="mt-6">
            <ExampleWalkthrough />
          </div>
        </div>
      </section>

      <HowWeKeepThisHonest />

      {/* ---------------------------------------------------------------- *
       * The rules — the order money leaves a cycle, and what is frozen.
       * ---------------------------------------------------------------- */}
      <section id="rules" className="scroll-mt-20 py-14 sm:py-16">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
          <div className="min-w-0">
            <p className="pg-kicker">The rules</p>
            <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
              The same four orders of payment, in every cycle
            </h2>
            <p className="mt-2 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
              This is not a promise to be reasonable at harvest. It is the order the settlement
              engine runs, and it cannot run in any other order.
            </p>
          </div>

          <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <ol className="grid min-w-0 list-none gap-4 p-0 sm:grid-cols-2">
              {PLAIN_PAYOUT_ORDER.map((step) => (
                <li key={step.step} className="pg-card min-w-0 p-5">
                  <span className="fig grid size-9 place-items-center rounded-full bg-porcelain text-[0.85rem] font-bold text-signal-deep">
                    {step.step}
                  </span>
                  <p className="mt-3 font-display text-[0.92rem] font-semibold leading-snug text-ink-deep">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-[0.78rem] leading-6 text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[var(--shadow-soft)]">
              <p className="pg-kicker">Frozen before you pay</p>
              <ul className="mt-3 list-none space-y-3 p-0">
                <Term
                  label="Profit split"
                  value={`${percent(DEFAULT_RULES.investorSharePercent, 0)} / ${percent(
                    DEFAULT_RULES.operatorSharePercent,
                    0,
                  )}`}
                  body="Members share most of it, in proportion to what each person put in. The farm caretaker takes the rest."
                />
                <Term
                  label="Safety slice"
                  value={`${DEFAULT_RULES.minimumReservePercent}–${DEFAULT_RULES.maximumReservePercent}%`}
                  body="Taken out of the sale before profit, and held back for the next surprise. Each cycle publishes its exact figure."
                />
                <Term
                  label="Terms freeze at publication"
                  value="Not editable"
                  body="Target capital, smallest ticket, split and safety slice are locked when a cycle goes live. The database refuses later changes."
                />
              </ul>
              <a
                href="#maths"
                className="mt-4 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-signal-deep no-underline"
              >
                Try these rules on example numbers
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Transparency, incidents, weather
       * ---------------------------------------------------------------- */}
      <section id="transparency" className="scroll-mt-20 py-14 sm:py-16">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
          <div className="min-w-0">
            <p className="pg-kicker">The register</p>
            <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
              What the farm did, dated as it happened
            </h2>
            <p className="mt-2 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
              Feeding, weighing, treatments and losses — each entry is checked by a second person
              before it appears, and each carries the date it was taken. Bad news is published here
              too, with how serious it is and what was done about it.
            </p>
          </div>

          <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="pg-card min-w-0 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="pg-kicker">Latest farm entries</p>
                <span className="pg-chip pg-chip--mint">
                  <span className="pg-live-dot" />
                  Reading the ledger live
                </span>
              </div>
              <TransparencyFeed milestones={pulse.milestones} limit={7} />
            </div>

            <div className="min-w-0 space-y-5">
              <ClimatePanel logged={[]} />
              <div className="pg-card min-w-0 p-4">
                <p className="pg-kicker mb-3">Things that went wrong</p>
                <IncidentRegister incidents={pulse.incidents} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Beyond the basics
       * ---------------------------------------------------------------- */}
      <section className="border-y border-hairline bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
          <div className="min-w-0">
            <p className="pg-kicker">The parts you meet later</p>
            <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.85rem]">
              Built so a member can stay for years
            </h2>
            <p className="mt-2 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
              Money that is easy to hold is money that stays. These are part of the platform, not
              bolted on afterwards.
            </p>
          </div>

          <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Innovation
              icon={<Repeat size={17} />}
              title="Reinvest without doing anything"
              body="Choose once and your money, your profit or both can roll straight into the next open cycle. Each movement records where it came from, so you can follow it end to end."
            />
            <Innovation
              icon={<Coins size={17} />}
              title="Hand your place to another member"
              body="Need money before the harvest? Offer your confirmed holding to another registered member at face value. The database refuses any offer bigger than what you actually hold."
            />
            <Innovation
              icon={<CalendarCheck size={17} />}
              title="Come and see the farm"
              body="Members request a weekend visit from the portal and the farm team on the ground confirms the slot. We never publish a visit we cannot host."
            />
            <Innovation
              icon={<ShieldCheck size={17} />}
              title="Things that went wrong, written down"
              body="Flooding, power cuts, disease and breakdowns are logged with how serious they are and whether they are resolved — then published on this page."
            />
            <Innovation
              icon={<Fish size={17} />}
              title="A record for every kind of stock"
              body="Fish weights and feed, bird health and vaccinations, eggs collected daily, bags per hectare for grain, kilograms per square metre under cover."
            />
            <Innovation
              icon={<Waves size={17} />}
              title="Weather, measured where the farm is"
              body="Live rainfall, temperature and humidity for each farm site, shown beside the farm team's own written observations."
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Close
       * ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-14 sm:py-16">
        <div className="band-dark pg-contour rounded-2xl border border-navy-line p-7 md:p-10">
          <div className="hero-glow left-1/4 top-[-120px] h-[240px] w-[520px]" aria-hidden="true" />
          <div className="relative z-10 grid min-w-0 gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div className="min-w-0">
              <p className="pg-kicker pg-kicker--onDark">Ready when you are</p>
              <h2 className="mt-2 font-display text-[1.5rem] font-bold leading-tight text-white md:text-[1.9rem]">
                Open a member account and read the book
              </h2>
              <p className="mt-3 max-w-xl text-[0.85rem] leading-6 text-slate-300">
                Membership is free and takes a minute. You will see every published cycle, the full
                record of what has been paid out, and — once you put money in — your own share,
                worked out from the ledger.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/signin" className="pg-btn pg-btn--signal">
                Open a member account
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/cycles" className="pg-btn pg-btn--onDark">
                See open cycles
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-7 grid min-w-0 gap-4 border-t border-navy-line pt-6 sm:grid-cols-3">
            <Figure
              onDark
              label="Smallest amount"
              value={featured[0] ? moneyPublic(featured[0].minimumTicket, 500) : "Set per cycle"}
              caption={NUMBER_HINT.minTicket}
            />
            <Figure
              onDark
              label="Of profit to members"
              value={percent(DEFAULT_RULES.investorSharePercent, 0)}
              caption="Shared in proportion to what each member put in."
            />
            <Figure
              onDark
              label="Orders of payment"
              value="4"
              caption="Bills, then members' money, then a safety slice, then profit."
            />
          </div>
        </div>
      </section>

      <FamilyFooter />
      <AiConcierge />
    </div>
  );
}

/**
 * A platform pulse counter on the hero band.
 *
 * The figure is monospace and tabular, and the sentence underneath says what it
 * counts — so a visitor never has to guess how a number was arrived at.
 */
function HeroCounter({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-navy-line bg-white/[0.06] p-4 shadow-lg backdrop-blur-md">
      <dt className="pg-kicker pg-kicker--onDark">{label}</dt>
      <dd className="mt-1.5 min-w-0">
        <span className="fig block text-[1.5rem] font-semibold leading-none text-white">
          {value}
        </span>
        <span className="mt-1.5 block text-[0.68rem] leading-4 text-slate-400">{caption}</span>
      </dd>
    </div>
  );
}

function Term({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <li className="min-w-0 border-b border-hairline pb-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="pg-kicker">{label}</span>
        <span className="fig text-[0.92rem] font-semibold text-ink-deep">{value}</span>
      </div>
      <p className="mt-1 text-[0.74rem] leading-5 text-ink-soft">{body}</p>
    </li>
  );
}

function MiniFigure({ value, label, caption }: { value: string; label: string; caption: string }) {
  return (
    <div className="min-w-0">
      <p className="fig text-[1.35rem] font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-[0.72rem] font-semibold text-slate-200">{label}</p>
      <p className="mt-0.5 text-[0.66rem] leading-4 text-slate-400">{caption}</p>
    </div>
  );
}

function LockedRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex min-w-0 gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-signal">
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block font-display text-[0.82rem] font-semibold leading-snug text-white">
          {title}
        </strong>
        <span className="mt-0.5 block text-[0.72rem] leading-5 text-slate-400">{body}</span>
      </span>
    </li>
  );
}

function Innovation({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="pg-card pg-card--lift min-w-0 p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-[image:var(--grad-master)] text-navy-deep">
        {icon}
      </span>
      <p className="mt-3.5 font-display text-[0.95rem] font-semibold leading-snug text-ink-deep">
        {title}
      </p>
      <p className="mt-1.5 text-[0.78rem] leading-6 text-ink-soft">{body}</p>
    </div>
  );
}
