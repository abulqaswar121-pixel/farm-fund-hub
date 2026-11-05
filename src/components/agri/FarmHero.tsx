import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Coins, ShieldCheck, Sprout } from "lucide-react";

import { moneyPublic, number } from "@/lib/agri/format";
import { useLocale } from "@/lib/agri/i18n";
import { NUMBER_HINT } from "@/lib/agri/plain";
import { DEFAULT_RULES } from "@/lib/agri/rules";

/**
 * The public hero.
 *
 * A real photograph of the farm at golden hour, under a navy wash at 75% so the
 * headline stays crisp at any width — the one image on the site that is both
 * the product and the promise. The overlay is deliberately a flat navy at 75%
 * with a gradient underneath, not a gradient that starts at 75%: on a bright
 * phone screen a fading scrim is where white text goes to die.
 *
 * Every figure below the copy is counted from the ledger on each request. If
 * the co-operative has not published a cycle yet, they read zero, and the copy
 * says so rather than filling the space with an illustration.
 */
export function FarmHero({
  pulse,
  ledgerReachable,
}: {
  pulse: {
    capitalDeployed: number;
    livestockOnFarm: number;
    settledCycles: number;
    activeCycles: number;
    openCycles: number;
    membersCount: number;
  };
  ledgerReachable: boolean;
}) {
  const { t } = useLocale();

  return (
    <section className="relative isolate overflow-hidden bg-navy">
      {/* Photograph ------------------------------------------------------- */}
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src="/images/farm/hero-catfish-ponds.jpg"
          alt=""
          className="size-full object-cover object-center"
          loading="eager"
          decoding="async"
          // The hero image is the largest paint on the page; let the browser
          // fetch it first rather than behind the font files.
          fetchPriority="high"
        />
        {/* Navy at 75% across the whole band, deepening to the left where the
            copy sits so the headline is legible even on a maximised monitor. */}
        <div className="absolute inset-0 bg-navy/75" />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(10,26,48,0.94)_0%,rgba(10,26,48,0.80)_42%,rgba(10,26,48,0.46)_78%,rgba(10,26,48,0.30)_100%)]" />
        <div className="bg-grid-pattern absolute inset-0 opacity-40" />
        <div className="absolute inset-x-0 top-0 h-px bg-[image:var(--grad-master)] opacity-80" />
      </div>

      <div className="relative z-10 mx-auto grid min-w-0 max-w-[var(--page)] gap-10 px-[var(--gutter)] py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
        {/* Copy --------------------------------------------------------- */}
        <div className="min-w-0">
          <p className="animate-rise-in inline-flex max-w-full items-center gap-2 rounded-full border border-signal/30 bg-white/[0.06] px-4 py-1.5 text-[0.68rem] font-semibold text-signal shadow-lg backdrop-blur-md">
            <Sprout size={13} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0">{t("hero.badge")}</span>
          </p>

          <h1 className="animate-rise-in animate-rise-in--1 mt-5 font-display text-[2.15rem] font-bold leading-[1.05] tracking-tight text-white sm:text-[2.9rem] lg:text-[3.3rem]">
            {t("hero.headline")}
            <br />
            <span className="pg-gradient-text">{t("hero.headlineAccent")}</span>
          </h1>

          <p className="animate-rise-in animate-rise-in--2 mt-5 max-w-xl text-[0.95rem] leading-7 text-slate-300">
            {t("hero.sub")}
          </p>

          <div className="animate-rise-in animate-rise-in--3 mt-7 flex flex-wrap items-center gap-3">
            <Link to="/cycles" className="pg-btn pg-btn--signal">
              <Sprout size={16} aria-hidden="true" />
              {t("hero.ctaExplore")}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link to="/signin" search={{ intent: "invest" }} className="pg-btn pg-btn--mint">
              <Coins size={16} aria-hidden="true" />
              {t("hero.ctaInvest")} · from ₦5,000
            </Link>
          </div>

          <p className="mt-3 text-[0.68rem] text-slate-400">
            {DEFAULT_RULES.investorSharePercent}/{DEFAULT_RULES.operatorSharePercent} harvest split,
            locked before you pay · paid out in a fixed order · every figure on this page comes from
            the ledger.
          </p>

          {/* Ledger-counted pulse ---------------------------------------- */}
          <dl className="mt-8 grid min-w-0 gap-3 sm:grid-cols-3">
            <HeroStat
              label="Capital deployed"
              value={moneyPublic(pulse.capitalDeployed, 10_000)}
              caption={NUMBER_HINT.moneyInvested}
            />
            <HeroStat
              label="Livestock on farm"
              value={number(pulse.livestockOnFarm)}
              caption={NUMBER_HINT.animals}
            />
            <HeroStat
              label="Cycles paid out"
              value={number(pulse.settledCycles)}
              caption={NUMBER_HINT.cyclesFinished}
            />
          </dl>

          <p className="mt-3 text-[0.67rem] leading-5 text-slate-500">
            {number(pulse.activeCycles)} growing on a farm today · {number(pulse.openCycles)} open
            to new members · {number(pulse.membersCount)} registered members.{" "}
            {ledgerReachable
              ? "These counters read zero until the co-operative publishes its first cycle — we never fill them with an illustration."
              : "The ledger is briefly unreachable, so these read zero rather than a stale figure."}
          </p>
        </div>

        {/* Trust panel --------------------------------------------------- */}
        <div className="min-w-0 rounded-2xl border border-navy-line bg-white/[0.06] p-5 shadow-[var(--shadow-deep)] backdrop-blur-md">
          <p className="pg-kicker pg-kicker--onDark">What is fixed before you pay</p>
          <ul className="mt-3 space-y-3.5">
            <Promise
              icon={<ShieldCheck size={15} />}
              title={`${DEFAULT_RULES.investorSharePercent}% of harvest profit to members`}
              body="Written into the cycle at publication. It cannot be renegotiated at harvest, by anyone."
            />
            <Promise
              icon={<Coins size={15} />}
              title="Bills first, then members' capital, then profit"
              body="A fixed order of payment. Nobody shares profit until every member has their money back."
            />
            <Promise
              icon={<CalendarClock size={15} />}
              title="Daily photo logs from the farm"
              body="Feeding, sorting and biosecurity, photographed and dated by the farm team."
            />
          </ul>

          <div className="mt-4 border-t border-navy-line pt-4">
            <p className="text-[0.7rem] leading-5 text-slate-400">
              Smallest amount you can join with: <strong className="text-white">₦5,000</strong>.
              Monthly Agri-Save plans start at the same figure.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-navy-line bg-white/[0.06] p-4 shadow-lg backdrop-blur-md">
      <dt className="pg-kicker pg-kicker--onDark">{label}</dt>
      <dd className="mt-1.5 min-w-0">
        <span className="fig block text-[1.45rem] font-semibold leading-none text-white">
          {value}
        </span>
        <span className="mt-1.5 block text-[0.66rem] leading-4 text-slate-400">{caption}</span>
      </dd>
    </div>
  );
}

function Promise({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
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
