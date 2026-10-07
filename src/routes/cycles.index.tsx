import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, Sprout } from "lucide-react";

import { AiConcierge } from "@/components/ndh/AiConcierge";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { CycleCard } from "@/components/agri/CycleCard";
import { listPublicCycles } from "@/lib/agri.public.functions";
import { COMMODITIES } from "@/lib/agri/commodities";
import { moneyCompact } from "@/lib/agri/format";
import { NUMBER_HINT } from "@/lib/agri/plain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cycles/")({
  head: () => ({
    meta: [
      { title: "Farm Cycles You Can Join | NDH AgriCapital" },
      {
        name: "description",
        content:
          "Every farm cycle currently raising money: catfish and tilapia ponds, broiler and layer houses, grain fields and greenhouses. See what each one needs, how much is raised and how long it runs.",
      },
      { property: "og:title", content: "Farm Cycles You Can Join | NDH AgriCapital" },
    ],
  }),
  loader: async () => await listPublicCycles(),
  component: Marketplace,
});

/** Filters use the words a visitor would use, not the database's. */
const STATUS_FILTERS = [
  { id: "all", label: "Show everything" },
  { id: "open", label: "Open for funding" },
  { id: "active", label: "Growing on the farm" },
  { id: "harvested", label: "Harvested" },
  { id: "settled", label: "Paid out" },
] as const;

function Marketplace() {
  const { cycles, ledgerReachable } = Route.useLoaderData();
  const [commodity, setCommodity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(
    () =>
      cycles.filter((card) => {
        if (commodity !== "all" && card.commodity !== commodity) return false;
        if (status !== "all" && card.status !== status) return false;
        return true;
      }),
    [cycles, commodity, status],
  );

  const totals = useMemo(
    () => ({
      open: cycles.filter((card) => card.status === "open").length,
      // Public totals are rounded the same way the cards are, so no page shows
      // a more precise figure than another.
      raised: cycles.reduce((sum, card) => sum + card.raisedRounded, 0),
      produce: new Set(cycles.map((card) => card.commodity)).size,
    }),
    [cycles],
  );

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/cycles" />

      <section className="band-dark">
        <div className="bg-grid-pattern absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="hero-glow left-1/3 top-[-160px] h-[340px] w-[660px] -translate-x-1/2"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--grad-master)] opacity-70" />

        <div className="relative z-10 mx-auto max-w-[var(--page)] px-[var(--gutter)] py-12">
          <p className="pg-kicker pg-kicker--onDark">Farm cycles</p>
          <h1 className="animate-rise-in mt-2 font-display text-[1.8rem] font-bold leading-tight md:text-[2.4rem]">
            Pick a farm cycle to back
          </h1>
          <p className="animate-rise-in animate-rise-in--1 mt-3 max-w-2xl text-[0.88rem] leading-7 text-slate-300">
            Each card tells you what the cycle needs, how much members have already put in, the
            smallest amount you can add, and how long it runs for. Nothing is hidden behind a
            spinner and nothing is promised that we cannot show you.
          </p>

          <dl className="mt-7 grid gap-4 border-t border-navy-line pt-6 sm:grid-cols-3">
            {[
              {
                label: "Open to join now",
                value: String(totals.open),
                caption: NUMBER_HINT.openNow,
              },
              {
                label: "Money put in so far",
                value: moneyCompact(totals.raised),
                caption: NUMBER_HINT.moneyInvested,
              },
              {
                label: "Types of produce",
                value: String(totals.produce),
                caption: "The different things growing across our cycles, from fish to grain.",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-2xl border border-navy-line bg-white/[0.06] p-4 shadow-lg backdrop-blur-md"
              >
                <dt className="pg-kicker pg-kicker--onDark">{stat.label}</dt>
                <dd className="mt-1.5">
                  <span className="fig block text-[1.4rem] font-semibold leading-none text-white">
                    {stat.value}
                  </span>
                  <span className="mt-1.5 block text-[0.68rem] leading-5 text-slate-400">
                    {stat.caption}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-9">
        {/* Filters — two labelled rows that wrap, never a horizontal scroller. */}
        <div className="flex flex-col gap-4 border-b border-hairline pb-5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="pg-kicker mr-1 flex items-center gap-1.5">
              <Filter size={12} aria-hidden="true" />
              Produce
            </span>
            <FilterChip active={commodity === "all"} onClick={() => setCommodity("all")}>
              All produce
            </FilterChip>
            {COMMODITIES.map((item) => (
              <FilterChip
                key={item.id}
                active={commodity === item.id}
                onClick={() => setCommodity(item.id)}
              >
                {item.name}
              </FilterChip>
            ))}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="pg-kicker mr-1">Stage</span>
            {STATUS_FILTERS.map((filter) => (
              <FilterChip
                key={filter.id}
                active={status === filter.id}
                onClick={() => setStatus(filter.id)}
              >
                {filter.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <>
            <p className="mt-4 text-[0.75rem] text-ink-mute">
              Showing <span className="fig font-semibold text-ink-soft">{filtered.length}</span> of{" "}
              <span className="fig">{cycles.length}</span> published cycles.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((card) => (
                <CycleCard key={card.id} card={card} />
              ))}
            </div>
          </>
        ) : (
          <div className="pg-card mt-6 flex flex-col items-center gap-3 px-5 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-porcelain text-ink-mute">
              <Sprout size={20} />
            </span>
            <p className="font-display text-base font-semibold text-ink-deep">
              {!ledgerReachable
                ? "We could not reach the ledger just now"
                : cycles.length === 0
                  ? "No cycles have been published yet"
                  : "No cycles match what you picked"}
            </p>
            <p className="max-w-md text-[0.82rem] leading-6 text-ink-mute">
              {!ledgerReachable
                ? "Nothing is wrong with the marketplace itself — the ledger service did not answer this request. Reload in a moment and the live figures will come back."
                : cycles.length === 0
                  ? "A cycle is only published once its costs, stocking plan and profit share are agreed and locked. Open a free member account and you will see each new cycle the moment it goes live."
                  : "Try choosing a different produce or stage. Every cycle's terms are locked, so we cannot change one to fit a search."}
            </p>
            <Link to="/" className="pg-btn pg-btn--ghost mt-1">
              Back to the overview
            </Link>
          </div>
        )}
      </section>

      <FamilyFooter />
      <AiConcierge />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "max-w-full rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold transition-colors",
        active
          ? "border-navy bg-navy text-white"
          : "border-hairline bg-white text-ink-soft hover:border-hairline-strong hover:text-ink-deep",
      )}
    >
      {children}
    </button>
  );
}
