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
import { FarmHero } from "@/components/agri/FarmHero";
import { HowItWorks } from "@/components/agri/HowItWorks";
import { OpportunityCard } from "@/components/agri/OpportunityCard";
import { PhotoProofStrip } from "@/components/agri/PhotoProofStrip";
import { ReturnCalculator } from "@/components/agri/ReturnCalculator";
import { WhatsAppBanner } from "@/components/agri/WhatsAppBanner";
import { LiveFarmTicker } from "@/components/agri/LiveFarmTicker";
import { HowWeKeepThisHonest } from "@/components/agri/HowWeKeepThisHonest";
import { TransparencyFeed, IncidentRegister } from "@/components/agri/TransparencyFeed";
import { ClimatePanel } from "@/components/agri/ClimatePanel";
import { StageRail } from "@/components/agri/StageRail";
import { Figure } from "@/components/ndh/ledger-ui";
import { getPlatformPulse, listPublicCycles } from "@/lib/agri.public.functions";
import { COMMODITIES } from "@/lib/agri/commodities";
import { moneyCompact, moneyPublic, number, percent } from "@/lib/agri/format";
import { useLocale } from "@/lib/agri/i18n";
import { NUMBER_HINT, PLAIN_PAYOUT_ORDER } from "@/lib/agri/plain";
import { DEFAULT_RULES } from "@/lib/agri/rules";

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
  const { t } = useLocale();

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
      <FarmHero
        pulse={{
          capitalDeployed: pulse.capitalDeployed,
          livestockOnFarm: pulse.livestockOnFarm,
          settledCycles: pulse.settledCycles,
          activeCycles: pulse.activeCycles,
          openCycles: pulse.openCycles,
          membersCount: pulse.membersCount,
        }}
        ledgerReachable={ledgerReachable}
      />

      {/* Live farm ticker — the strip directly under the hero band. */}
      <LiveFarmTicker
        cycles={cycles.map((card) => ({
          code: card.code,
          commodity: card.commodity,
          status: card.status,
        }))}
      />

      {/* ---------------------------------------------------------------- *
       * Open farm opportunities — target, days left, timeline, live bar,
       * and the visitor's own return calculator beside them.
       * ---------------------------------------------------------------- */}
      <section
        id="opportunities"
        className="mx-auto max-w-[var(--page)] scroll-mt-20 px-[var(--gutter)] py-14 sm:py-16"
      >
        <div className="flex flex-col gap-3 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="pg-kicker">{t("opps.kicker")}</p>
            <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
              {t("opps.title")}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[0.85rem] leading-6 text-ink-soft">
              {t("opps.blurb")}
            </p>
          </div>
          <Link to="/cycles" className="pg-btn pg-btn--ghost shrink-0">
            See every farm
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0">
            {featured.length > 0 ? (
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {featured.map((card) => (
                  <OpportunityCard key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <div className="pg-card flex h-full flex-col items-center justify-center gap-3 px-6 py-14 text-center">
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
                <Link
                  to="/signin"
                  search={{ intent: "invest" }}
                  className="pg-btn pg-btn--primary mt-1"
                >
                  Open a member account
                </Link>
              </div>
            )}
          </div>
          <ReturnCalculator className="self-start lg:sticky lg:top-20" />
        </div>
      </section>

      {/* ---------------------------------------------------------------- *
       * How it works — three steps, then the six-stage farm-side rail so a
       * curious visitor can see the record-keeping is real.
       * ---------------------------------------------------------------- */}
      <HowItWorks showFooterNotes={false} />

      <section className="border-b border-hairline bg-white py-12">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
          <div className="rounded-2xl border border-hairline bg-porcelain p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="pg-kicker">On the farm side</p>
                <p className="mt-1.5 max-w-2xl text-[0.8rem] leading-6 text-ink-soft">
                  Behind every card the farm team works through six logged stages, from collecting
                  money to sharing the profit. Members watch the rail move on any cycle they back.
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

          <div className="mt-8 min-w-0">
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <PhotoProofStrip onDark />

      <WhatsAppBanner inviteUrl={null} />

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
              This is not a promise to be reasonable at harvest. It is the order our payout engine
              runs in, and it cannot run in any other order.
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
                href="#opportunities"
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
