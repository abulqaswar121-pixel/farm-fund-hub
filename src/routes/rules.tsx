import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Calculator,
  FileText,
  Lock,
  Scale,
  ShieldCheck,
  Sprout,
  TriangleAlert,
} from "lucide-react";

import { ReturnCalculator } from "@/components/agri/ReturnCalculator";
import { StageRail } from "@/components/agri/StageRail";
import { WaterfallLadder } from "@/components/agri/WaterfallLadder";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { Card, Figure, Notice, SectionHeader } from "@/components/ndh/ledger-ui";
import { moneyPublic, percent } from "@/lib/agri/format";
import { NUMBER_HINT, PLAIN_PAYOUT_ORDER } from "@/lib/agri/plain";
import { DEFAULT_RULES, type CycleRules } from "@/lib/agri/rules";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Payout Rules & Locked Terms | NDH FarmFund" },
      {
        name: "description",
        content:
          "The exact order money leaves a FarmFund cycle: supplier debts, then 100% of member capital, then a safety reserve, then a 70/30 profit split. Plus what freezes at publication and what happens if the harvest falls short.",
      },
      { property: "og:title", content: "Payout Rules & Locked Terms | NDH FarmFund" },
    ],
  }),
  component: RulesPage,
});

const RULES: CycleRules = {
  investorSharePercent: DEFAULT_RULES.investorSharePercent,
  operatorSharePercent: DEFAULT_RULES.operatorSharePercent,
  reservePercent: DEFAULT_RULES.reservePercent,
};

/**
 * `/rules` — the page the homepage used to be three screens of.
 *
 * Everything here was previously crammed onto the landing page: the four-level
 * waterfall, the frozen terms, an example calculator, the six-stage farm rail
 * and a list of what happens when a harvest disappoints. All of it matters, and
 * none of it belongs between a visitor and the button that says "Invest".
 *
 * Keeping it at its own URL also makes it linkable. When a member asks "what
 * happens if the pond fails?", the answer is a link, not a paragraph they have
 * to scroll to find.
 */
function RulesPage() {
  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/rules" />

      <section className="band-dark relative overflow-hidden">
        <div className="bg-grid-pattern absolute inset-0 opacity-45" aria-hidden="true" />
        <div className="hero-glow left-1/4 top-[-140px] h-[260px] w-[540px]" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[var(--page)] px-[var(--gutter)] py-12 sm:py-14">
          <p className="pg-kicker pg-kicker--onDark">The rules</p>
          <h1 className="mt-2 max-w-3xl font-display text-[1.85rem] font-bold leading-tight text-white sm:text-[2.4rem]">
            The same four orders of payment, in every cycle
          </h1>
          <p className="mt-3 max-w-2xl text-[0.88rem] leading-6 text-slate-300">
            This is not a promise to be reasonable at harvest. It is the order our payout engine
            runs in, and it cannot run in any other order. Everything on this page is fixed before
            anyone pays in.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="pg-chip pg-chip--onDark">
              <Lock size={11} aria-hidden="true" /> Terms freeze at publication
            </span>
            <span className="pg-chip pg-chip--onDark">
              <ShieldCheck size={11} aria-hidden="true" /> Reserve{" "}
              {DEFAULT_RULES.minimumReservePercent}–{DEFAULT_RULES.maximumReservePercent}%
            </span>
            <span className="pg-chip pg-chip--onDark">
              <Scale size={11} aria-hidden="true" /> {DEFAULT_RULES.investorSharePercent}/
              {DEFAULT_RULES.operatorSharePercent} split
            </span>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[var(--page)] space-y-10 px-[var(--gutter)] py-12 sm:py-14">
        {/* The waterfall, twice: in plain words and as the engine's ladder. */}
        <div className="grid min-w-0 gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="min-w-0">
            <SectionHeader
              kicker="In plain words"
              title="Where the harvest money goes"
              blurb="Read this once and you can predict what your statement will say."
            />
            <ol className="mt-5 grid min-w-0 list-none gap-3 p-0">
              {PLAIN_PAYOUT_ORDER.map((step) => (
                <li key={step.step} className="pg-card min-w-0 p-5">
                  <span className="fig grid size-9 place-items-center rounded-full bg-porcelain text-[0.85rem] font-bold text-signal-deep">
                    {step.step}
                  </span>
                  <p className="mt-3 font-display text-[0.95rem] font-semibold leading-snug text-ink-deep">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-[0.79rem] leading-6 text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="min-w-0">
            <SectionHeader
              kicker="In the engine"
              title="What the settlement function actually does"
              blurb="Levels are evaluated in order. A shortfall at one level is reported rather than borrowed from the level below it."
            />
            <div className="mt-5">
              <WaterfallLadder rules={RULES} />
            </div>
            <Card className="mt-4 p-4">
              <p className="pg-kicker">Frozen before you pay</p>
              <ul className="mt-2.5 space-y-2.5">
                <Term
                  label="Profit split"
                  value={`${percent(RULES.investorSharePercent, 0)} / ${percent(
                    RULES.operatorSharePercent,
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
                  label="Target & smallest ticket"
                  value="Not editable"
                  body="Locked when a cycle is published. The database refuses a later change, even from an admin."
                />
              </ul>
            </Card>
          </div>
        </div>

        {/* When the harvest disappoints — the section that earns trust. */}
        <div className="grid min-w-0 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <SectionHeader
              kicker="When it goes wrong"
              title="What happens if the harvest falls short"
              blurb="Catfish die. Feed prices move. Buyers renegotiate at the gate. A co-operative that only describes the good outcome is not telling you anything."
            />
            <div className="mt-5 space-y-3">
              <Notice tone="warning">
                <strong>If revenue cannot return all principal.</strong> Every member&apos;s
                statement prints the shortfall against their own line. Nothing is quietly written
                off, and the cycle is marked &ldquo;principal part-returned&rdquo; in the register.
              </Notice>
              <Notice tone="warning">
                <strong>If revenue cannot pay the suppliers.</strong> Level 1 is capped at what the
                harvest actually earned. The unpaid balance stays on the books as an unsettled
                supplier claim against the cycle — it is never shifted onto members&apos; capital.
              </Notice>
              <Notice tone="info">
                <strong>If the whole batch is lost.</strong> An incident is logged with its cause,
                severity and resolution, and published. Members see it in the portal the same day.
                Capital is at risk; the platform does not insure against it.
              </Notice>
            </div>
          </div>

          <div className="min-w-0">
            <SectionHeader
              kicker="Farm side"
              title="Six logged stages"
              blurb="The rail a member watches move on any cycle they back."
            />
            <Card className="mt-5 p-5">
              <StageRail currentStage="operational" />
            </Card>
            <Card className="mt-4 p-5">
              <p className="pg-kicker">What the numbers mean</p>
              <ul className="mt-2.5 space-y-2 text-[0.74rem] leading-5 text-ink-soft">
                <li>{NUMBER_HINT.moneyInvested}</li>
                <li>{NUMBER_HINT.paidBack}</li>
                <li>{NUMBER_HINT.animals}</li>
                <li>{NUMBER_HINT.minTicket}</li>
              </ul>
            </Card>
          </div>
        </div>

        {/* The calculator, deep-linked here rather than cluttering the home. */}
        <div id="calculator" className="scroll-mt-20">
          <SectionHeader
            kicker="Try the maths"
            title="An example, on numbers you choose"
            blurb="This runs the same arithmetic the settlement engine runs, on a pretend harvest. It is an illustration, not a projection — no real cycle's figures are used."
          />
          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <ReturnCalculator />
            <div className="min-w-0 space-y-4">
              <Card className="p-5">
                <p className="flex items-center gap-2 pg-kicker">
                  <Calculator size={13} aria-hidden="true" /> What it assumes
                </p>
                <ul className="mt-2.5 space-y-2 text-[0.76rem] leading-5 text-ink-soft">
                  <li>
                    A member pool big enough that your own share stays realistic — the figure moves
                    with the amount you type.
                  </li>
                  <li>
                    A harvest profit after every member&apos;s capital has been returned and the
                    supplier bills are paid.
                  </li>
                  <li>
                    The {DEFAULT_RULES.investorSharePercent}/{DEFAULT_RULES.operatorSharePercent}{" "}
                    split, applied to profit only — never to your capital.
                  </li>
                </ul>
              </Card>
              <Card className="p-5">
                <p className="pg-kicker">The smallest share</p>
                <Figure
                  label="Minimum contribution"
                  value={moneyPublic(5000, 500)}
                  caption="Anything below this is refused by the form and again by the server."
                />
              </Card>
            </div>
          </div>
        </div>

        {/* Close */}
        <div className="band-dark pg-contour relative overflow-hidden rounded-2xl border border-navy-line p-7 md:p-9">
          <div className="relative z-10 grid min-w-0 gap-5 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div className="min-w-0">
              <p className="pg-kicker pg-kicker--onDark">Still reading?</p>
              <h2 className="mt-2 font-display text-[1.35rem] font-bold leading-tight text-white md:text-[1.6rem]">
                Good. Now look at the batch this applies to.
              </h2>
              <p className="mt-2 max-w-lg text-[0.83rem] leading-6 text-slate-300">
                The rules above are the same ones running on the cycle in the pond today. Every
                entry behind it is dated and checked by a second person.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Link to="/cycles" className="pg-btn pg-btn--signal">
                <Sprout size={15} aria-hidden="true" />
                See the batches
              </Link>
              <Link to="/" className="pg-btn pg-btn--onDark">
                Back to the homepage
              </Link>
            </div>
          </div>
        </div>

        <p className="flex gap-2 text-[0.72rem] leading-6 text-ink-mute">
          <TriangleAlert size={13} className="mt-1 shrink-0 text-signal-deep" aria-hidden="true" />
          <span>
            Agricultural production carries real risk and NDH FarmFund does not guarantee a return,
            a harvest, or the return of your capital. The formal terms are in the{" "}
            <Link
              to="/legal/$doc"
              params={{ doc: "risk" }}
              className="font-semibold text-signal-deep"
            >
              risk statement
            </Link>{" "}
            and the{" "}
            <Link
              to="/legal/$doc"
              params={{ doc: "terms" }}
              className="font-semibold text-signal-deep"
            >
              member terms
            </Link>
            .
          </span>
        </p>

        <div className="flex flex-wrap gap-2 border-t border-hairline pt-6">
          <Link to="/cycles" className="pg-btn pg-btn--ghost">
            <FileText size={14} aria-hidden="true" />
            Every batch
          </Link>
          <Link to="/legal/$doc" params={{ doc: "terms" }} className="pg-btn pg-btn--ghost">
            Member terms
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </main>

      <FamilyFooter />
    </div>
  );
}

function Term({ label, value, body }: { label: string; value: string; body: string }) {
  return (
    <li className="min-w-0 border-b border-hairline pb-2.5 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="pg-kicker">{label}</span>
        <span className="fig text-[0.88rem] font-semibold text-ink-deep">{value}</span>
      </div>
      <p className="mt-1 text-[0.72rem] leading-5 text-ink-soft">{body}</p>
    </li>
  );
}
