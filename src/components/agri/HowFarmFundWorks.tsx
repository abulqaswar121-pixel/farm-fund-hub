import { Coins, HeartHandshake, NotebookPen } from "lucide-react";

import { moneyPublic } from "@/lib/agri/format";
import { MIN_CONTRIBUTION } from "@/lib/agri/contribution";

/**
 * Section 3 — three cards, three ideas.
 *
 * Kept to three on purpose. The old homepage had a six-card "parts you meet
 * later" grid explaining reinvestment, share transfers and farm visits before a
 * visitor had worked out what any of it was for. Those features still exist;
 * they are explained in the portal, when a member has a reason to want them.
 */
const STEPS = [
  {
    icon: Coins,
    title: "Choose your share",
    body: `Deposit any amount from ${moneyPublic(MIN_CONTRIBUTION, 500)} — one-time or monthly — by card through Paystack, or by bank transfer the treasury verifies. Your equity is worked out live from verified money, never from a number you typed.`,
    note: "Equity is never stored, so it cannot be edited by anyone, including us.",
  },
  {
    icon: NotebookPen,
    title: "Follow weekly pond logs",
    body: "Farm operators log feed bags, water changes, fish weights and photos directly from the pond. Every entry is checked by a second person before it reaches you.",
    note: "Feed, weight, mortality, water — dated as it happened.",
  },
  {
    icon: HeartHandshake,
    title: "Receive capital & profit",
    body: "At harvest the fish are weighed and sold. Your original capital is returned first, then 70% of the harvest net profit is shared across members in proportion to what each put in. The farm takes 30%.",
    note: "Debts to suppliers are paid before either of you.",
  },
];

export function HowFarmFundWorks() {
  return (
    <section className="border-y border-hairline bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="pg-kicker">How FarmFund works</p>
          <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
            Three steps, no small print you have not seen
          </h2>
          <p className="mt-2 text-[0.85rem] leading-6 text-ink-soft">
            The same three steps apply whether you put in {moneyPublic(MIN_CONTRIBUTION, 500)} or a
            hundred times that.
          </p>
        </div>

        <ol className="mt-8 grid min-w-0 list-none gap-4 p-0 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="pg-card pg-card--lift min-w-0 p-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-[image:var(--grad-master)] text-navy-deep">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="fig text-[0.68rem] font-bold text-hairline-strong">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-3.5 font-display text-[1rem] font-semibold leading-snug text-ink-deep">
                  {step.title}
                </p>
                <p className="mt-2 text-[0.8rem] leading-6 text-ink-soft">{step.body}</p>
                <p className="mt-3 border-t border-hairline pt-2.5 text-[0.68rem] leading-5 text-ink-mute">
                  {step.note}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
