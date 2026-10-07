import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  Calculator,
  Coins,
  Fish,
  Gauge,
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
import { ProfitCalculator, type CalculatorCycle } from "@/components/agri/ProfitCalculator";
import { TransparencyFeed, IncidentRegister } from "@/components/agri/TransparencyFeed";
import { ClimatePanel } from "@/components/agri/ClimatePanel";
import { StageRail } from "@/components/agri/StageRail";
import { WaterfallLadder } from "@/components/agri/WaterfallLadder";
import { Figure } from "@/components/ndh/ledger-ui";
import { getPlatformPulse, listPublicCycles } from "@/lib/agri.public.functions";
import { COMMODITIES } from "@/lib/agri/commodities";
import { money, moneyCompact, number, percent } from "@/lib/agri/format";
import { DEFAULT_RULES, readRules, type CycleRules } from "@/lib/agri/rules";

/**
 * The four-step cycle lifecycle, in the Academy's numbered language.
 *
 * The six-stage operator rail still exists on every cycle page — this is the
 * investor-facing arc of the same journey, compressed to the four things a
 * member actually experiences.
 */
const LIFECYCLE_STEPS = [
  {
    n: "01",
    icon: PiggyBank,
    title: "Capital Pooling",
    body: "Verified member funding with locked profit splits. The split, the reserve and the entry ticket are frozen the moment the cycle is published.",
    chip: "Funding open",
    tone: "mint" as const,
  },
  {
    n: "02",
    icon: Fish,
    title: "Stocking & Growth",
    body: "Real-time feed conversion, biomass sampling and dated farm photo logs from the operator, approved before they reach the public record.",
    chip: "Live on farm",
    tone: "signal" as const,
  },
  {
    n: "03",
    icon: Scale,
    title: "Harvest & Off-Take",
    body: "Verified scale weigh-in at the pond bank or pen, with batch scale tickets and institutional buyer off-take confirmed against the pick-up note.",
    chip: "Weigh-in logged",
    tone: "amber" as const,
  },
  {
    n: "04",
    icon: Waves,
    title: "Waterfall Settlement",
    body: "Principal capital returned first, then net profits distributed at the locked split — a strict four-level priority order, audited and published.",
    chip: "Settled",
    tone: "mint" as const,
  },
];

const STEP_CHIP_CLASS = {
  mint: "pg-chip--mint",
  signal: "pg-chip--signal",
  amber: "pg-chip--closing",
} as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NDH AgriCapital | Multi-Commodity Farm Investment Ledger" },
      {
        name: "description",
        content:
          "Back Nigeria's farm economy with a ledger you can audit. Catfish, tilapia, poultry, grain and greenhouse cycles with locked profit splits, a strict settlement waterfall and live verified equity.",
      },
      { property: "og:title", content: "NDH AgriCapital | The Shared Farm Ledger" },
      {
        property: "og:description",
        content:
          "Multi-commodity agricultural investment with locked-from-start rules and live, audited equity.",
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

  const openCycles = cycles.filter(
    (card) => card.cycle.status === "open" || card.cycle.status === "funded",
  );
  const featured = (openCycles.length > 0 ? openCycles : cycles).slice(0, 3);

  const calculatorCycles: CalculatorCycle[] = cycles
    .filter((card) => card.projectedRevenue > 0)
    .slice(0, 8)
    .map((card) => ({
      id: card.cycle.id,
      code: card.cycle.code,
      name: card.cycle.name,
      targetCapital: Number(card.cycle.target_capital),
      raised: card.raised,
      minimumTicket: Number(card.cycle.minimum_ticket),
      projectedRevenue: Number(card.cycle.projected_revenue),
      projectedLiabilities: Number(card.cycle.projected_liabilities),
      rules: readRules(card.cycle) as CycleRules,
    }));

  const hasSettlements = pulse.settledCycles > 0;

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/" />

      {/* ---------------------------------------------------------------- *
       * Hero — the gateway moment: deep navy, ambient glow, the platform
       * pulse counted live from the ledger.
       * ---------------------------------------------------------------- */}
      <section className="band-dark">
        <div className="bg-grid-pattern absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="hero-glow left-1/2 top-[-140px] h-[380px] w-[720px] -translate-x-1/2"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--grad-master)] opacity-70" />

        <div className="relative z-10 mx-auto grid max-w-[var(--page)] gap-10 px-[var(--gutter)] py-14 lg:grid-cols-[1.12fr_0.88fr] lg:py-20">
          <div>
            <p className="animate-rise-in inline-flex items-center gap-2 rounded-full border border-signal/30 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-signal shadow-lg backdrop-blur-md">
              <Sparkles size={13} aria-hidden="true" />
              The Agricultural Investment Ledger of Najeeb Digital Hub
            </p>

            <h1 className="animate-rise-in animate-rise-in--1 mt-5 font-display text-[2.1rem] font-bold leading-[1.06] tracking-tight sm:text-[2.8rem] lg:text-[3.15rem]">
              Farm capital with the
              <br />
              <span className="pg-gradient-text">books left open.</span>
            </h1>

            <p className="animate-rise-in animate-rise-in--2 mt-5 max-w-xl text-[0.95rem] leading-7 text-slate-300">
              NDH AgriCapital pools member capital into real production cycles — catfish and tilapia
              ponds, broiler and layer houses, grain fields and greenhouses — and runs every one of
              them on a ledger you can audit: locked profit splits, a strict settlement waterfall,
              and equity calculated live from verified contributions.
            </p>

            <div className="animate-rise-in animate-rise-in--3 mt-7 flex flex-wrap items-center gap-3">
              <Link to="/cycles" className="pg-btn pg-btn--signal">
                <Sprout size={16} aria-hidden="true" />
                Browse open cycles
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/signin" className="pg-btn pg-btn--onDark">
                Member Sign In
              </Link>
              <a href="#calculator" className="pg-btn pg-btn--onDark">
                <Calculator size={16} aria-hidden="true" />
                Model a return
              </a>
            </div>

            {/* Platform pulse — every counter is counted from the ledger. */}
            <dl className="mt-9 grid gap-4 sm:grid-cols-3">
              <HeroCounter
                label="Capital Deployed"
                value={moneyCompact(pulse.capitalDeployed)}
                caption="Verified member contributions"
              />
              <HeroCounter
                label="Livestock On Farm"
                value={number(pulse.livestockOnFarm)}
                caption="Head, birds and crates logged"
              />
              <HeroCounter
                label="Settled Cycles"
                value={number(pulse.settledCycles)}
                caption={
                  hasSettlements
                    ? `${moneyCompact(pulse.capitalReturned + pulse.profitDistributed)} returned`
                    : "Waterfall not run yet"
                }
              />
            </dl>

            <p className="mt-3 text-[0.68rem] leading-5 text-slate-500">
              {number(pulse.activeCycles)} cycles active on farm · {number(pulse.openCycles)}{" "}
              raising capital now · {number(pulse.membersCount)} registered members. Counters read
              zero until the co-operative&apos;s first cycle is published — we never seed them with
              an illustration.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-navy-line bg-white/[0.05] p-5 shadow-lg backdrop-blur-md">
              <p className="pg-kicker pg-kicker--onDark">What is locked before you pay</p>
              <ul className="mt-3 space-y-3">
                <LockedRow
                  icon={<Lock size={15} />}
                  title={`${DEFAULT_RULES.investorSharePercent}/${DEFAULT_RULES.operatorSharePercent} net profit split`}
                  body="Frozen at publication. Not renegotiable after harvest."
                />
                <LockedRow
                  icon={<Waves size={15} />}
                  title="Strict four-level waterfall"
                  body="Suppliers, then your principal, then the reserve, then profit."
                />
                <LockedRow
                  icon={<Gauge size={15} />}
                  title="Live equity, never stored"
                  body="Your share is derived from verified contributions on every read."
                />
              </ul>
              <a
                href="#rules"
                className="mt-4 inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-signal no-underline"
              >
                Read the full rulebook
                <ArrowRight size={13} aria-hidden="true" />
              </a>
            </div>

            <div className="rounded-2xl border border-navy-line bg-white/[0.05] p-5 shadow-lg backdrop-blur-md">
              <p className="pg-kicker pg-kicker--onDark">Co-operative today</p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="fig text-[1.35rem] font-semibold text-white">
                    {number(pulse.membersCount)}
                  </p>
                  <p className="text-[0.68rem] text-slate-400">Registered members</p>
                </div>
                <div>
                  <p className="fig text-[1.35rem] font-semibold text-white">
                    {number(pulse.settledCycles)}
                  </p>
                  <p className="text-[0.68rem] text-slate-400">Settled cycles</p>
                </div>
                <div>
                  <p className="fig text-[1.35rem] font-semibold text-white">
                    {moneyCompact(pulse.profitDistributed)}
                  </p>
                  <p className="text-[0.68rem] text-slate-400">Profit distributed</p>
                </div>
                <div>
                  <p className="fig text-[1.35rem] font-semibold text-white">
                    {COMMODITIES.length}
                  </p>
                  <p className="text-[0.68rem] text-slate-400">Stock families</p>
                </div>
              </div>
              {!hasSettlements ? (
                <p className="mt-4 border-t border-navy-line pt-3 text-[0.68rem] leading-4 text-slate-400">
                  Counters read zero because the co-operative has not closed its first cycle yet. We
                  do not seed these numbers with illustrations.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Live farm ticker — the strip directly under the hero band.
       * ---------------------------------------------------------------- */}
      <LiveFarmTicker
        cycles={cycles.map((card) => ({
          code: card.cycle.code,
          commodity: card.cycle.commodity,
          status: card.cycle.status,
        }))}
      />

      {/* ---------------------------------------------------------------- *
       * Marketplace
       * ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-16">
        <div className="flex flex-col gap-3 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="pg-kicker">Live farm stock marketplace</p>
            <h2 className="mt-1.5 text-[1.5rem] leading-tight text-ink-deep md:text-[1.85rem]">
              Cycles raising capital right now
            </h2>
            <p className="mt-1.5 max-w-2xl text-[0.85rem] leading-6 text-ink-soft">
              Each card carries the terms that are frozen the moment it is published — the split,
              the reserve, the entry ticket and the projected harvest window.
            </p>
          </div>
          <Link to="/cycles" className="pg-btn pg-btn--ghost shrink-0">
            All cycles
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((card) => (
              <CycleCard key={card.cycle.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="pg-card mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-porcelain text-ink-mute">
              <Sprout size={20} />
            </span>
            <p className="font-display text-base font-semibold text-ink-deep">
              {ledgerReachable
                ? "No cycles are open for funding yet"
                : "The ledger could not be reached"}
            </p>
            <p className="max-w-md text-[0.82rem] leading-6 text-ink-mute">
              {ledgerReachable
                ? "The co-operative publishes a cycle only once its costs, stocking plan and locked split are settled. Create a member account and you will see each new cycle the moment it goes live."
                : "The marketplace service did not answer this request, so no live figures can be shown. Reload in a moment — the ledger itself is unaffected."}
            </p>
            <Link to="/signin" className="pg-btn pg-btn--primary mt-1">
              Create a member account
            </Link>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- *
       * Lifecycle — the four-step investment journey, Academy numeral grid.
       * ---------------------------------------------------------------- */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-hairline bg-white">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-16">
          <p className="pg-kicker">How it works</p>
          <h2 className="mt-1.5 text-[1.5rem] leading-tight text-ink-deep md:text-[1.95rem]">
            Your capital&apos;s journey, in four steps
          </h2>
          <p className="mt-1.5 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
            Every commodity — catfish, tilapia, broilers, layers, grain or greenhouse — travels the
            same arc. The terms are locked before step one and the arithmetic is published at step
            four.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {LIFECYCLE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="pg-card relative p-6">
                  <div className="pg-numeral absolute right-5 top-4" aria-hidden="true">
                    {step.n}
                  </div>
                  <span className="grid size-11 place-items-center rounded-xl bg-[image:var(--grad-master)] text-navy-deep">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-display text-[1rem] font-bold text-ink-deep">
                    <span className="fig mr-1.5 text-[0.72rem] text-ink-mute">{step.n}</span>
                    {step.title}
                  </p>
                  <p className="mt-2 text-[0.8rem] leading-6 text-ink-soft">{step.body}</p>
                  <p className={`pg-chip mt-3.5 ${STEP_CHIP_CLASS[step.tone]}`}>{step.chip}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-2xl border border-hairline bg-porcelain p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="pg-kicker">On the farm side</p>
                <p className="mt-1.5 max-w-2xl text-[0.8rem] leading-6 text-ink-soft">
                  The operator works the same journey through six logged stages. A member can watch
                  the rail advance on any cycle they have backed.
                </p>
              </div>
              <Link to="/cycles" className="pg-btn pg-btn--ghost shrink-0">
                See it on a live cycle
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-4">
              <StageRail currentStage="operational" />
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {COMMODITIES.map((commodity) => {
              const Icon = commodity.icon;
              return (
                <div key={commodity.id} className="pg-card pg-card--lift p-4">
                  <span className="grid size-9 place-items-center rounded-lg bg-mint-soft text-mint-deep">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <p className="mt-3 font-display text-[0.85rem] font-semibold text-ink-deep">
                    {commodity.name}
                  </p>
                  <p className="mt-1.5 text-[0.72rem] leading-5 text-ink-mute">
                    {commodity.summary}
                  </p>
                  <ul className="mt-2.5 space-y-1">
                    {commodity.telemetry.slice(0, 2).map((line) => (
                      <li key={line} className="flex gap-1.5 text-[0.68rem] text-ink-soft">
                        <BadgeCheck
                          size={11}
                          className="mt-0.5 shrink-0 text-mint"
                          aria-hidden="true"
                        />
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="fig mt-2.5 text-[0.68rem] text-ink-mute">
                    ~{commodity.typicalDurationWeeks} weeks · {commodity.feedUnit}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Locked rules
       * ---------------------------------------------------------------- */}
      <section
        id="rules"
        className="mx-auto max-w-[var(--page)] scroll-mt-20 px-[var(--gutter)] py-14"
      >
        <p className="pg-kicker">Locked from the start</p>
        <h2 className="mt-1.5 text-[1.5rem] leading-tight text-ink-deep md:text-[1.85rem]">
          Zero post-harvest disputes, by construction
        </h2>
        <p className="mt-1.5 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
          Every term below is written into the cycle at publication and enforced by the database,
          not by good intentions. Nothing here can be edited once a cycle has taken a single naira.
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <WaterfallLadder rules={DEFAULT_RULES} />
          </div>

          <div className="space-y-3">
            <RuleCard
              icon={<Coins size={16} />}
              title="Equity is calculated, never stored"
              body={
                <>
                  Your share is always{" "}
                  <span className="fig text-[0.72rem] text-ink-deep">
                    (your verified contributions ÷ all verified contributions) × 100
                  </span>
                  , recomputed on every read. There is no equity column for anyone to edit — not
                  even an administrator.
                </>
              }
            />
            <RuleCard
              icon={<Scale size={16} />}
              title="Invariant balance transparency"
              body="Your dashboard shows your exact verified balance, your locked equity share and the live state of the cycle. Contributions are credited only by the Paystack webhook or by an admin verifying a bank transfer against a teller reference."
            />
            <RuleCard
              icon={<ShieldCheck size={16} />}
              title="Row Level Security is the boundary"
              body="Members can read only their own investment records. Operators can file farm logs and expenses but cannot verify a payment, touch equity or run a settlement. Only an admin can publish a cycle or execute a waterfall run — and the database refuses the settlement twice."
            />
            <RuleCard
              icon={<Lock size={16} />}
              title="The emergency reserve sits in escrow"
              body={`Each cycle sets aside ${DEFAULT_RULES.minimumReservePercent}–${DEFAULT_RULES.maximumReservePercent}% of gross revenue at Level 3 to buffer the next cycle against feed price spikes, disease and repairs.`}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Calculator — laid on the porcelain canvas inside a bordered white
       * container, so the modeler reads as a tool and not as a terminal.
       * ---------------------------------------------------------------- */}
      <section
        id="calculator"
        className="mx-auto max-w-[var(--page)] scroll-mt-20 px-[var(--gutter)] py-16"
      >
        <p className="pg-kicker">Run the numbers yourself</p>
        <h2 className="mt-1.5 text-[1.5rem] leading-tight text-ink-deep md:text-[1.95rem]">
          Model a contribution before you commit
        </h2>
        <p className="mt-1.5 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
          The calculator uses the same settlement arithmetic the platform will run at harvest,
          against the cycle&apos;s own costed plan. It is a projection of the plan — never a promise
          of a return.
        </p>

        <div className="mt-6 rounded-2xl border border-hairline bg-white p-2 shadow-[var(--shadow-soft)] sm:p-3">
          <ProfitCalculator cycles={calculatorCycles} />
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Transparency, incidents, climate
       * ---------------------------------------------------------------- */}
      <section id="transparency" className="scroll-mt-20 border-t border-hairline py-16">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
          <p className="pg-kicker">Farm transparency · the register</p>
          <h2 className="mt-1.5 text-[1.5rem] leading-tight text-ink-deep md:text-[1.95rem]">
            The field record, published as it happens
          </h2>
          <p className="mt-1.5 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
            Growth samples, feed logs, mortality and harvest weigh-ins — approved by an admin and
            published with the date they were taken. Bad news is published too, with its severity
            and its resolution.
          </p>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="pg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="pg-kicker">Recent milestones</p>
                <span className="pg-chip pg-chip--mint">
                  <span className="pg-live-dot" />
                  Ledger live
                </span>
              </div>
              <TransparencyFeed milestones={pulse.milestones} limit={7} />
            </div>

            <div className="space-y-5">
              <ClimatePanel logged={[]} />
              <div className="pg-card p-4">
                <p className="pg-kicker mb-3">Incident &amp; insurance register</p>
                <IncidentRegister incidents={pulse.incidents} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Innovation surfaces
       * ---------------------------------------------------------------- */}
      <section className="border-y border-hairline bg-white py-16">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
          <p className="pg-kicker">Beyond the basics</p>
          <h2 className="mt-1.5 text-[1.5rem] leading-tight text-ink-deep md:text-[1.85rem]">
            Designed to keep members in for the long run
          </h2>
          <p className="mt-1.5 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
            Capital that is easy to hold is capital that stays. These surfaces are built into the
            platform, not bolted on afterwards.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Innovation
              icon={<Repeat size={17} />}
              title="Automatic rollover"
              body="Set it once and your principal, your profit or both roll straight into the next open cycle. Each movement is recorded with the source cycle attached, so the money is traceable end to end."
            />
            <Innovation
              icon={<Coins size={17} />}
              title="Co-op share transfer board"
              body="Need liquidity mid-cycle? Offer your verified equity to other registered members at par. The database refuses any offer larger than what you actually hold."
            />
            <Innovation
              icon={<CalendarCheck size={17} />}
              title="Farm visit booking"
              body="Verified investors request weekend inspection visits from the portal. The operator on the ground confirms the slot — we never publish a visit we cannot host."
            />
            <Innovation
              icon={<ShieldCheck size={17} />}
              title="Incident & insurance register"
              body="Flooding, power cuts, disease and equipment failure are logged with severity, impact and resolution status, then published openly on this page."
            />
            <Innovation
              icon={<Fish size={17} />}
              title="Multi-stock telemetry"
              body="Biomass and feed conversion for catfish, live weight and vaccination for broilers, crate yield for layers, bags per hectare for grain, kilograms per square metre for greenhouses."
            />
            <Innovation
              icon={<Waves size={17} />}
              title="Satellite & weather context"
              body="Live rainfall, temperature and humidity for each farm site, shown beside the operator's own field observations for the cycle."
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * Close
       * ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-16">
        <div className="band-dark pg-contour rounded-2xl border border-navy-line p-7 md:p-10">
          <div className="hero-glow left-1/4 top-[-120px] h-[240px] w-[520px]" aria-hidden="true" />
          <div className="relative z-10 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <p className="pg-kicker pg-kicker--onDark">Ready when you are</p>
              <h2 className="mt-2 font-display text-[1.5rem] font-bold leading-tight text-white md:text-[1.9rem]">
                Open a member account and read the book
              </h2>
              <p className="mt-3 max-w-xl text-[0.85rem] leading-6 text-slate-300">
                Membership is free and takes a minute. You will see every published cycle, the full
                settlement history, and — once you contribute — your exact equity, computed live
                from the ledger.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link to="/signin" className="pg-btn pg-btn--signal">
                Create a member account
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to="/cycles" className="pg-btn pg-btn--onDark">
                See open cycles
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-7 grid gap-4 border-t border-navy-line pt-6 sm:grid-cols-3">
            <Figure
              onDark
              label="Minimum entry"
              value={featured[0] ? money(featured[0].cycle.minimum_ticket) : "Set per cycle"}
              caption="Published with every cycle"
            />
            <Figure
              onDark
              label="Profit to members"
              value={percent(DEFAULT_RULES.investorSharePercent, 0)}
              caption="Of net profit, pro-rata to equity"
            />
            <Figure onDark label="Settlement levels" value="4" caption="Strict priority, audited" />
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
 * Numbers are monospace and tabular; the label is the Academy's quiet kicker
 * so a visitor reads the figure first and the caption second.
 */
function HeroCounter({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-2xl border border-navy-line bg-white/[0.06] p-4 shadow-lg backdrop-blur-md">
      <dt className="pg-kicker pg-kicker--onDark">{label}</dt>
      <dd className="mt-1.5">
        <span className="fig block text-[1.5rem] font-semibold leading-none text-white">
          {value}
        </span>
        <span className="mt-1.5 block text-[0.68rem] leading-4 text-slate-400">{caption}</span>
      </dd>
    </div>
  );
}

function LockedRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-signal">
        {icon}
      </span>
      <span>
        <strong className="block font-display text-[0.82rem] font-semibold text-white">
          {title}
        </strong>
        <span className="mt-0.5 block text-[0.72rem] leading-5 text-slate-400">{body}</span>
      </span>
    </li>
  );
}

function RuleCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="pg-card p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-navy text-signal">
          {icon}
        </span>
        <p className="font-display text-[0.88rem] font-semibold text-ink-deep">{title}</p>
      </div>
      <p className="mt-2.5 text-[0.78rem] leading-6 text-ink-soft">{body}</p>
    </div>
  );
}

function Innovation({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="pg-card pg-card--lift p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-[image:var(--grad-master)] text-navy-deep">
        {icon}
      </span>
      <p className="mt-3.5 font-display text-[0.95rem] font-semibold text-ink-deep">{title}</p>
      <p className="mt-1.5 text-[0.78rem] leading-6 text-ink-soft">{body}</p>
    </div>
  );
}
