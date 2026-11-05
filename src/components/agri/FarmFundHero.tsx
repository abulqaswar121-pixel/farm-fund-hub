import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Fish,
  MessageCircle,
  Percent,
  Sprout,
} from "lucide-react";

import { whatsappGroupUrl } from "@/lib/agri/whatsapp";

/**
 * The FarmFund hero.
 *
 * Four stat cards, and not one of them is a counter that reads zero. An earlier
 * version of this page led with "₦0 capital deployed" and "0 cycles paid out",
 * because those figures are counted from the ledger and the co-operative had
 * not settled a cycle yet. True, and fatal: a visitor's first impression was of
 * a platform that had never done anything.
 *
 * So the first row now describes the venture that is actually running — its
 * name, how long a pond takes, the split agreed before anyone paid, and the
 * fact that the fish are alive in water today. Progress against the funding
 * target appears in the spotlight below, where it means something, and the
 * counted totals live on `/rules` and `/cycles` for anyone who wants proof.
 */
export function FarmFundHero({ cycleCode }: { cycleCode: string | null }) {
  return (
    <section className="relative isolate overflow-hidden bg-navy">
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src="/images/farm/hero-catfish-ponds.jpg"
          alt=""
          className="size-full object-cover object-center"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-navy/75" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(10,26,48,0.95)_0%,rgba(10,26,48,0.82)_45%,rgba(10,26,48,0.45)_80%,rgba(10,26,48,0.30)_100%)]" />
        <div className="bg-grid-pattern absolute inset-0 opacity-40" />
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--grad-master)] opacity-80" />
      </div>

      <div className="relative z-10 mx-auto min-w-0 max-w-[var(--page)] px-[var(--gutter)] py-14 sm:py-16 lg:py-20">
        <div className="max-w-3xl min-w-0">
          <p className="animate-rise-in inline-flex max-w-full items-center gap-2 rounded-full border border-signal/30 bg-white/[0.06] px-4 py-1.5 text-[0.68rem] font-semibold text-signal shadow-lg backdrop-blur-md">
            <Sprout size={13} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0">
              NDH Co-operative Farming{cycleCode ? ` · Active Cycle ${cycleCode}` : ""}
            </span>
          </p>

          <h1 className="animate-rise-in animate-rise-in--1 mt-5 font-display text-[2.05rem] font-bold leading-[1.06] tracking-tight text-white sm:text-[2.75rem] lg:text-[3.2rem]">
            Real farm investments with <span className="pg-gradient-text">open books.</span>
          </h1>

          <p className="animate-rise-in animate-rise-in--2 mt-5 max-w-2xl text-[0.95rem] leading-7 text-slate-300">
            Join our communal catfish cycle. Transparent weekly pond logs, direct WhatsApp updates,
            and capital + profit returned at harvest.
          </p>

          <div className="animate-rise-in animate-rise-in--3 mt-7 flex flex-wrap items-center gap-3">
            <a href="#catfish" className="pg-btn pg-btn--signal">
              View Catfish Batch
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href={whatsappGroupUrl(null)}
              target="_blank"
              rel="noopener noreferrer"
              className="pg-btn pg-btn--mint"
            >
              <MessageCircle size={16} aria-hidden="true" />
              Join WhatsApp Group
            </a>
          </div>
        </div>

        {/* Four facts about the venture that is running right now. */}
        <dl className="mt-10 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact
            icon={<Fish size={14} aria-hidden="true" />}
            label="Active venture"
            value="Catfish Growout"
            caption="Cycle 01 · main tank and auxiliary container"
          />
          <Fact
            icon={<CalendarClock size={14} aria-hidden="true" />}
            label="Pond duration"
            value="16–20 weeks"
            caption="Fingerling to table size, water-dependent"
          />
          <Fact
            icon={<Percent size={14} aria-hidden="true" />}
            label="Profit split"
            value="70% Members / 30% Farm"
            caption="Agreed upfront and frozen before anyone pays"
          />
          <Fact
            icon={<CheckCircle2 size={14} aria-hidden="true" />}
            label="Status"
            value="Live & Growing"
            caption="Stocked, feeding daily, logs published weekly"
            tone="live"
          />
        </dl>

        <p className="mt-4 text-[0.68rem] leading-5 text-slate-500">
          Every figure on this page is read from the farm ledger on each request. Nothing here is
          seeded, mocked or inflated.
        </p>
      </div>
    </section>
  );
}

function Fact({
  icon,
  label,
  value,
  caption,
  tone = "plain",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  tone?: "plain" | "live";
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-navy-line bg-white/[0.06] p-4 shadow-lg backdrop-blur-md">
      <dt className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
        <span className="text-signal">{icon}</span>
        {label}
      </dt>
      <dd className="mt-2 min-w-0">
        <span
          className={
            tone === "live"
              ? "flex items-center gap-2 font-display text-[1.02rem] font-bold leading-tight text-mint"
              : "block font-display text-[1.02rem] font-bold leading-tight text-white"
          }
        >
          {tone === "live" ? <span className="pg-live-dot" aria-hidden="true" /> : null}
          <span className="min-w-0">{value}</span>
        </span>
        <span className="mt-1.5 block text-[0.67rem] leading-4 text-slate-400">{caption}</span>
      </dd>
    </div>
  );
}
