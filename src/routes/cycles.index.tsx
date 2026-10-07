import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, Sprout } from "lucide-react";

import { AiConcierge } from "@/components/ndh/AiConcierge";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { CycleCard } from "@/components/agri/CycleCard";
import { listPublicCycles } from "@/lib/agri.public.functions";
import { COMMODITIES, CYCLE_STATUS_LABEL, type CycleStatus } from "@/lib/agri/commodities";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cycles/")({
  head: () => ({
    meta: [
      { title: "Farm Marketplace | NDH AgriCapital" },
      {
        name: "description",
        content:
          "Browse every open and running NDH AgriCapital production cycle: catfish, broiler, layer, grain and greenhouse stock with locked profit splits and live funding progress.",
      },
      { property: "og:title", content: "Farm Marketplace | NDH AgriCapital" },
    ],
  }),
  loader: async () => await listPublicCycles(),
  component: Marketplace,
});

const STATUS_FILTERS: { id: "all" | CycleStatus; label: string }[] = [
  { id: "all", label: "All cycles" },
  { id: "open", label: CYCLE_STATUS_LABEL.open },
  { id: "active", label: CYCLE_STATUS_LABEL.active },
  { id: "harvested", label: CYCLE_STATUS_LABEL.harvested },
  { id: "settled", label: CYCLE_STATUS_LABEL.settled },
];

function Marketplace() {
  const { cycles, ledgerReachable } = Route.useLoaderData();
  const [commodity, setCommodity] = useState<string>("all");
  const [status, setStatus] = useState<"all" | CycleStatus>("all");

  const filtered = useMemo(
    () =>
      cycles.filter((card) => {
        if (commodity !== "all" && card.cycle.commodity !== commodity) return false;
        if (status !== "all" && card.cycle.status !== status) return false;
        return true;
      }),
    [cycles, commodity, status],
  );

  const totals = useMemo(
    () => ({
      raised: cycles.reduce((sum, card) => sum + card.raised, 0),
      investors: cycles.reduce((sum, card) => sum + card.investorCount, 0),
      open: cycles.filter((card) => card.cycle.status === "open").length,
    }),
    [cycles],
  );

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/cycles" />

      <section className="border-b border-navy-line bg-navy text-white">
        <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-11">
          <p className="pg-kicker pg-kicker--onDark">Farm marketplace</p>
          <h1 className="mt-2 font-display text-[1.8rem] font-bold leading-tight md:text-[2.3rem]">
            Choose the stock you want to back
          </h1>
          <p className="mt-3 max-w-2xl text-[0.88rem] leading-7 text-slate-300">
            Every cycle below publishes its target capital, its minimum entry ticket, its locked
            profit split and its projected harvest window before it takes a single naira.
          </p>

          <dl className="mt-7 grid grid-cols-3 gap-5 border-t border-navy-line pt-6">
            <div>
              <dt className="pg-kicker pg-kicker--onDark">Open now</dt>
              <dd className="fig mt-1 text-[1.3rem] font-semibold">{totals.open}</dd>
            </div>
            <div>
              <dt className="pg-kicker pg-kicker--onDark">Capital raised</dt>
              <dd className="fig mt-1 text-[1.3rem] font-semibold">
                ₦{(totals.raised / 1_000_000).toFixed(1)}M
              </dd>
            </div>
            <div>
              <dt className="pg-kicker pg-kicker--onDark">Member positions</dt>
              <dd className="fig mt-1 text-[1.3rem] font-semibold">{totals.investors}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-9">
        <div className="flex flex-col gap-4 border-b border-hairline pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="pg-kicker mr-1 flex items-center gap-1.5">
              <Filter size={12} aria-hidden="true" />
              Stock
            </span>
            <FilterChip active={commodity === "all"} onClick={() => setCommodity("all")}>
              All stock
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

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="pg-kicker mr-1">Status</span>
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
              <span className="fig">{cycles.length}</span> published cycles
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((card) => (
                <CycleCard key={card.cycle.id} card={card} />
              ))}
            </div>
          </>
        ) : (
          <div className="pg-card mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-porcelain text-ink-mute">
              <Sprout size={20} />
            </span>
            <p className="font-display text-base font-semibold text-ink-deep">
              {!ledgerReachable
                ? "The ledger could not be reached"
                : cycles.length === 0
                  ? "No cycles published yet"
                  : "No cycles match those filters"}
            </p>
            <p className="max-w-md text-[0.82rem] leading-6 text-ink-mute">
              {!ledgerReachable
                ? "Nothing is wrong with the marketplace — the ledger service did not answer this request. Reload in a moment and the live figures will return."
                : cycles.length === 0
                  ? "The co-operative publishes a cycle only once its costs, stocking plan and locked split are settled. New cycles appear here the moment they go live."
                  : "Try widening the stock or status filter — the terms on each cycle cannot be changed to suit a search."}
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
        "rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold transition-colors",
        active
          ? "border-navy bg-navy text-white"
          : "border-hairline bg-white text-ink-soft hover:border-hairline-strong hover:text-ink-deep",
      )}
    >
      {children}
    </button>
  );
}
