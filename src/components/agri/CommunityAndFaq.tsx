import { Link } from "@tanstack/react-router";
import { ChevronDown, MessageCircle, ShieldQuestion, Smartphone, Users } from "lucide-react";

import { moneyPublic } from "@/lib/agri/format";
import { MIN_CONTRIBUTION } from "@/lib/agri/contribution";
import { whatsappGroupUrl } from "@/lib/agri/whatsapp";

/**
 * Section 4 — the group, the questions, and out of the way.
 *
 * The accordion uses the native `<details>` element. No state, no JavaScript, no
 * layout shift, and it works with a screen reader and with the browser's own
 * find-in-page. A FAQ is not a place to be clever.
 *
 * The four questions here are the four a first-time visitor actually asks. The
 * long-form answers — the waterfall, the reserve band, what happens if the fish
 * die — live on `/rules`, which this section links to rather than reproducing.
 */
export function CommunityAndFaq() {
  return (
    <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-14 sm:py-16">
      <div className="grid min-w-0 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        {/* WhatsApp --------------------------------------------------- */}
        <div className="relative isolate min-w-0 overflow-hidden rounded-2xl border border-mint/25 bg-[linear-gradient(125deg,#053b2e_0%,#065f46_48%,#0a1a30_100%)] p-6 shadow-[var(--shadow-lift)] sm:p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-mint/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
              <MessageCircle size={12} aria-hidden="true" />
              Official group
            </p>
            <h2 className="mt-3 font-display text-[1.3rem] font-bold leading-tight text-white sm:text-[1.55rem]">
              Daily video snippets, straight from the pond
            </h2>
            <p className="mt-2.5 text-[0.84rem] leading-6 text-emerald-50/90">
              Members and anyone still deciding are welcome in the NDH FarmFund WhatsApp group. The
              farm team posts feeding clips, water checks and harvest news there first — often
              before the portal catches up.
            </p>

            <ul className="mt-4 space-y-2 text-[0.76rem] text-emerald-50/85">
              <li className="flex items-center gap-2">
                <Smartphone size={13} aria-hidden="true" className="shrink-0 text-mint" />
                Works on any phone, no app to install
              </li>
              <li className="flex items-center gap-2">
                <Users size={13} aria-hidden="true" className="shrink-0 text-mint" />
                Farmers, members and the treasury team in one thread
              </li>
              <li className="flex items-center gap-2">
                <ShieldQuestion size={13} aria-hidden="true" className="shrink-0 text-mint" />
                No card details, no amounts, ever posted in the group
              </li>
            </ul>

            <a
              href={whatsappGroupUrl(null)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-[0.88rem] font-semibold text-[#075E54] no-underline shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              <MessageCircle size={17} aria-hidden="true" />
              Join the WhatsApp group
            </a>
            <p className="mt-2 text-center text-[0.64rem] text-emerald-50/60">
              Opens in WhatsApp. Leave whenever you like.
            </p>
          </div>
        </div>

        {/* FAQ -------------------------------------------------------- */}
        <div className="min-w-0">
          <p className="pg-kicker">Before you pay</p>
          <h2 className="mt-1.5 text-[1.3rem] leading-tight text-ink-deep sm:text-[1.5rem]">
            Four honest answers
          </h2>

          <div className="mt-4 space-y-2">
            <Faq q="What is the minimum amount I can start with?">
              {moneyPublic(MIN_CONTRIBUTION, 500)}. The platform refuses anything smaller, in the
              form and again on the server, so you cannot accidentally under-fund a share.
            </Faq>
            <Faq q="Can I invest monthly?" a>
              Yes. Monthly Agri-Save runs from {moneyPublic(MIN_CONTRIBUTION, 500)} a month, and
              each contribution is verified the same way a one-off deposit is — so a missed month
              costs you nothing except that month&apos;s share.
            </Faq>
            <Faq q="How is my money protected?">
              Three things happen in a fixed order. Supplier debts are paid first so no supplier is
              left holding the cycle&apos;s risk. Then 100% of member capital is returned. Only what
              survives both is split as profit — 70% to members, 30% to the farm — and a safety
              reserve is set aside before that split. If a harvest cannot return your capital, the
              shortfall is printed on your statement rather than quietly absorbed.
            </Faq>
            <Faq q="How do I inspect the farm?">
              Follow the live logs in your portal — photos, feed weights and pond readings, dated as
              they were taken. Or request a weekend visit from the portal and the farm team confirms
              a slot; we never publish a visit we cannot host.
            </Faq>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/rules" className="pg-btn pg-btn--ghost">
              Full payout rules
            </Link>
            <Link to="/cycles" className="pg-btn pg-btn--ghost">
              Every batch, past and planned
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq({
  q,
  children,
  a = false,
}: {
  q: string;
  children: React.ReactNode;
  /** Opens on first paint — the question people ask most. */
  a?: boolean;
}) {
  return (
    <details
      open={a}
      className="group rounded-xl border border-hairline bg-white px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[0.84rem] font-semibold text-ink-deep">
        {q}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className="shrink-0 text-ink-mute transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-2 text-[0.79rem] leading-6 text-ink-soft">{children}</div>
    </details>
  );
}
