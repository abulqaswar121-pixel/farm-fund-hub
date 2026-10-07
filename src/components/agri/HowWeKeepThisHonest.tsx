import { ArrowRight, BadgeCheck, Info, Lock, ShieldAlert, Waves } from "lucide-react";

/**
 * How we keep this honest — the four promises, in plain words.
 *
 * This band exists because "we are transparent" is a claim, not evidence. Each
 * card states a rule a visitor can check elsewhere on the page (the locked
 * split, the order of payments, the dated register, the incident log) and then,
 * just as importantly, says what the co-operative keeps private and why. A
 * platform that will not say where its privacy line is should not be trusted to
 * hold one.
 */
export function HowWeKeepThisHonest() {
  return (
    <section className="border-y border-hairline bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
        <div className="min-w-0">
          <p className="pg-kicker">How we keep this honest</p>
          <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.75rem]">
            Four promises you can actually check
          </h2>
          <p className="mt-2 max-w-3xl text-[0.85rem] leading-6 text-ink-soft">
            Every rule below is enforced by the platform itself, not by good intentions: the
            settlement engine refuses to run outside the order, and the public pages cannot read
            what they are not supposed to see.
          </p>
        </div>

        <div className="mt-7 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Promise
            icon={<Lock size={17} aria-hidden="true" />}
            title="The rules are frozen before you pay"
            body="The profit split, the safety slice and the smallest amount are written into a cycle when it is published. Nobody can quietly edit them at harvest — the arithmetic is fixed while you can still walk away."
          />
          <Promise
            icon={<Waves size={17} aria-hidden="true" />}
            title="Your money comes back before anyone profits"
            body="Bills are paid first, then every member gets their money back in full, then a small slice is set aside, and only then is profit shared. Profit is last in the queue, always."
          />
          <Promise
            icon={<BadgeCheck size={17} aria-hidden="true" />}
            title="Every farm record is dated and checked"
            body="The farm team's logs — feed, weight samples, losses, treatments — are approved by a second person before they appear on this site, and each one carries the date it was taken."
          />
          <Promise
            icon={<ShieldAlert size={17} aria-hidden="true" />}
            title="Bad news goes on the register too"
            body="Flooding, disease, feed price shocks, breakdowns and power cuts are published with how serious they are, what is being done, and whether they are resolved."
          />
        </div>

        <div className="mt-6 rounded-2xl border border-hairline bg-porcelain p-5">
          <p className="pg-kicker">What we keep private, and why</p>
          <ul className="mt-3 grid min-w-0 list-none gap-3 p-0 sm:grid-cols-2">
            <Private
              title="What any member put in"
              body="Your position is nobody else's business. Totals are rounded so no one can work out your share by watching the figure move."
            />
            <Private
              title="What a cycle expects to earn, and what it owes"
              body="A forecast is a guess about the future. We publish what actually happened — the harvest weight, the sale, the payout — instead of dressing up optimism as evidence."
            />
            <Private
              title="Who supplies the farm and who takes the harvest"
              body="The co-operative's commercial terms are its own. The scale ticket and the trader's collection note are kept for audit, not published."
            />
            <Private
              title="Each member's payout"
              body="Once you contribute, your own share, its arithmetic and every payout are in your member portal — visible to you, and to nobody else."
            />
          </ul>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4 text-[0.76rem]">
            <a
              href="#transparency"
              className="inline-flex items-center gap-1.5 font-semibold text-signal-deep no-underline"
            >
              Read the public register
              <ArrowRight size={13} aria-hidden="true" />
            </a>
            <a
              href="/legal/risk"
              className="inline-flex items-center gap-1.5 font-semibold text-ink-soft no-underline"
            >
              <Info size={13} aria-hidden="true" />
              Read the risk statement
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

function Promise({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="pg-card pg-card--lift min-w-0 p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-[image:var(--grad-master)] text-navy-deep">
        {icon}
      </span>
      <p className="mt-3.5 font-display text-[0.92rem] font-semibold leading-snug text-ink-deep">
        {title}
      </p>
      <p className="mt-1.5 text-[0.78rem] leading-6 text-ink-soft">{body}</p>
    </div>
  );
}

function Private({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex min-w-0 gap-2.5">
      <Lock size={14} className="mt-0.5 shrink-0 text-signal-deep" aria-hidden="true" />
      <span className="min-w-0">
        <strong className="block font-display text-[0.82rem] font-semibold text-ink-deep">
          {title}
        </strong>
        <span className="mt-0.5 block text-[0.75rem] leading-5 text-ink-soft">{body}</span>
      </span>
    </li>
  );
}
