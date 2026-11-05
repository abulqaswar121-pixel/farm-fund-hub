import { Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Droplets, Fish, Scale, Soup, TrendingUp, Users } from "lucide-react";

import { moneyPublic, number, percent } from "@/lib/agri/format";
import type { PublicCycleCard } from "@/lib/agri.public.functions";

/**
 * Section 2 of the homepage — the cycle that is actually in the water.
 *
 * Design decision worth stating: the funding bar here shows a *percentage*,
 * never a naira figure. The exact amount raised is a member's business — with
 * seven contributors, publishing "₦54,500 raised" would let anyone subtract the
 * round numbers and work out what the last person put in. A percentage is
 * enough to answer the question a visitor is really asking ("is this thing
 * real and moving?"), and it cannot unmask anybody.
 *
 * The pond readings come from the same `cycle_stock_level` view the portal
 * uses, so the homepage cannot drift from the farm's own numbers.
 */
export function CatfishSpotlight({ card }: { card: PublicCycleCard | null }) {
  if (!card) {
    return (
      <section
        id="catfish"
        className="mx-auto max-w-[var(--page)] scroll-mt-20 px-[var(--gutter)] py-14 sm:py-16"
      >
        <div className="pg-card px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-porcelain text-ink-mute">
            <Fish size={20} aria-hidden="true" />
          </span>
          <p className="mt-3 font-display text-base font-semibold text-ink-deep">
            No cycle is published yet
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[0.82rem] leading-6 text-ink-mute">
            A cycle goes live once its costs, its stocking plan and its profit split are settled.
            Open an account and the next one will be waiting for you.
          </p>
          <Link to="/signin" search={{ intent: "invest" }} className="pg-btn pg-btn--primary mt-4">
            Open a member account
          </Link>
        </div>
      </section>
    );
  }

  const daysElapsed = card.fundingOpensOn
    ? Math.max(0, Math.round((Date.now() - new Date(card.fundingOpensOn).getTime()) / 86_400_000))
    : null;

  return (
    <section
      id="catfish"
      className="mx-auto max-w-[var(--page)] scroll-mt-20 px-[var(--gutter)] py-14 sm:py-16"
    >
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="pg-kicker">Live catfish showcase</p>
          <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
            {card.name}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[0.85rem] leading-6 text-ink-soft">
            {card.summary ??
              "A communal catfish batch, stocked from fingerlings and fed on floating pellets until it reaches table size."}
          </p>
        </div>
        <span className="pg-chip pg-chip--mint shrink-0">
          <span className="pg-live-dot" />
          {card.status === "active" ? "Growing in pond" : card.status}
        </span>
      </div>

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Photo ------------------------------------------------------- */}
        <div className="pg-card min-w-0 overflow-hidden">
          <div className="pg-banner aspect-[16/10]">
            <img
              src="/images/farm/proof-feeding.jpg"
              alt="A farm operator feeding the catfish pond at the NDH farm"
              loading="lazy"
              decoding="async"
            />
            <span className="pg-banner-scrim" aria-hidden="true" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-navy/75 px-2.5 py-1 font-mono text-[0.58rem] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
              <Camera size={11} aria-hidden="true" className="text-signal" />
              Pond proof · feeding
            </span>
            <span className="absolute inset-x-3 bottom-3 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/15 bg-navy/70 px-3 py-2 text-[0.66rem] font-medium text-white backdrop-blur-sm">
              <span className="inline-flex items-center gap-1.5">
                <Fish size={12} aria-hidden="true" className="text-signal" />
                {card.fishCount === null
                  ? "Stock counted weekly"
                  : `${number(card.fishCount)} catfish in the pond`}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Droplets size={12} aria-hidden="true" className="text-signal" />
                Water exchanged every 3 days
              </span>
            </span>
          </div>

          <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2">
            <Reading
              icon={<Soup size={14} />}
              label="Feeding"
              value={
                card.feedKg === null ? "1kg floating pellets" : `${number(card.feedKg, 1)}kg logged`
              }
              caption="Bag sizes and costs recorded per feed, not estimated."
            />
            <Reading
              icon={<Scale size={14} />}
              label="Growth stage"
              value={
                card.avgWeightG === null
                  ? "Juvenile → growout"
                  : `${number(card.avgWeightG, 0)}g avg`
              }
              caption="Fingerlings become juveniles around week four."
            />
            <Reading
              icon={<Users size={14} />}
              label="Community"
              value={`${number(card.publicUpdateCount)} pond updates`}
              caption="Published only after a second person checks the entry."
            />
            <Reading
              icon={<TrendingUp size={14} />}
              label="Growing for"
              value={
                daysElapsed === null
                  ? `${card.cycleWeeks} weeks planned`
                  : `${number(daysElapsed)} days`
              }
              caption={
                card.projectedHarvestOn
                  ? `Target harvest ${card.projectedHarvestOn}`
                  : `${card.cycleWeeks} weeks from stocking`
              }
            />
          </div>
        </div>

        {/* Funding ----------------------------------------------------- */}
        <div className="min-w-0 space-y-4">
          <div className="pg-card min-w-0 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="pg-kicker">Funding progress</p>
              <span className="fig text-[1.05rem] font-bold text-ink-deep">
                {percent(card.fundedPercent, 0)}
              </span>
            </div>
            <div className="pg-meter mt-3" aria-hidden="true">
              <span style={{ width: `${Math.max(2, Math.min(100, card.fundedPercent))}%` }} />
            </div>
            <p className="mt-2 text-[0.7rem] leading-5 text-ink-mute">
              {/* Rounded, and deliberately not the naira figure — see the note
                  at the top of this file. */}
              Rounded down to the nearest whole percent, so no single member&apos;s contribution can
              be worked out from it.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4">
              <div>
                <dt className="pg-kicker">Smallest share</dt>
                <dd className="fig mt-1 text-[0.95rem] font-semibold text-ink-deep">
                  {moneyPublic(card.minimumTicket, 500)}
                </dd>
              </div>
              <div>
                <dt className="pg-kicker">Cycle length</dt>
                <dd className="fig mt-1 text-[0.95rem] font-semibold text-ink-deep">
                  {card.cycleWeeks} weeks
                </dd>
              </div>
              <div>
                <dt className="pg-kicker">Farm site</dt>
                <dd className="mt-1 text-[0.85rem] font-semibold text-ink-deep">{card.farmSite}</dd>
              </div>
              <div>
                <dt className="pg-kicker">Stage</dt>
                <dd className="mt-1 text-[0.85rem] font-semibold capitalize text-ink-deep">
                  {card.currentStage.replace(/_/g, " ")}
                </dd>
              </div>
            </dl>

            <Link
              to="/signin"
              search={{ intent: "invest", cycle: card.code }}
              className="pg-btn pg-btn--primary mt-5 w-full"
            >
              Invest in This Batch (From {moneyPublic(card.minimumTicket, 500)})
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <p className="mt-2 text-center text-[0.66rem] leading-5 text-ink-mute">
              Card payment through Paystack, or a bank transfer the treasury verifies by hand.
              Equity is credited only when the money lands.
            </p>
          </div>

          <div className="rounded-2xl border border-hairline bg-white p-5">
            <p className="pg-kicker">Read before you pay</p>
            <ul className="mt-2.5 space-y-2 text-[0.76rem] leading-5 text-ink-soft">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-signal-deep" />
                Your capital is returned before profit is split, but only if the harvest earns
                enough. Fish can die; prices can fall.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-signal-deep" />
                The full payout order and the reserve rule are published on{" "}
                <Link to="/rules" className="font-semibold text-signal-deep no-underline">
                  /rules
                </Link>
                , not buried in this card.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Reading({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-mute">
        <span className="text-signal-deep">{icon}</span>
        {label}
      </p>
      <p className="mt-1 font-display text-[0.88rem] font-semibold text-ink-deep">{value}</p>
      <p className="mt-0.5 text-[0.66rem] leading-4 text-ink-mute">{caption}</p>
    </div>
  );
}
