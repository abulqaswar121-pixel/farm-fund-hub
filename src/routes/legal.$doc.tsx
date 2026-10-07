import { createFileRoute, notFound } from "@tanstack/react-router";

import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { NDH_CONTACT } from "@/lib/ndh/ecosystem";

const DOCS = {
  terms: {
    title: "Member terms of use",
    updated: "7 October 2026",
    intro:
      "These terms govern your use of agricapital.ndh.com.ng, the multi-commodity agricultural investment ledger operated as part of the Najeeb Digital Hub family.",
  },
  privacy: {
    title: "Privacy notice",
    updated: "7 October 2026",
    intro:
      "This notice explains what NDH AgriCapital records about you, why, and who can see it. The short version: we hold what the ledger requires, and Row Level Security means other members cannot read your holdings.",
  },
  risk: {
    title: "Risk statement",
    updated: "7 October 2026",
    intro:
      "Read this before you contribute. Agricultural production carries real risk, and this platform does not guarantee a return, a harvest, or the return of your capital.",
  },
} as const;

type DocId = keyof typeof DOCS;

export const Route = createFileRoute("/legal/$doc")({
  head: (ctx: { params: { doc: string } }) => {
    const params = ctx.params;
    const doc = DOCS[params.doc as DocId];
    return {
      meta: [
        { title: doc ? `${doc.title} | NDH AgriCapital` : "Legal | NDH AgriCapital" },
        {
          name: "description",
          content: doc ? doc.intro.slice(0, 180) : "Legal information for NDH AgriCapital members.",
        },
      ],
    };
  },
  loader: ({ params }) => {
    const doc = DOCS[params.doc as DocId];
    if (!doc) throw notFound();
    return { id: params.doc as DocId, ...doc };
  },
  component: LegalPage,
});

function LegalPage() {
  const { id } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader />
      <article className="mx-auto max-w-3xl px-[var(--gutter)] py-12">
        {id === "terms" ? <Terms /> : id === "privacy" ? <Privacy /> : <Risk />}
        <p className="mt-10 border-t border-hairline pt-5 text-[0.72rem] leading-5 text-ink-mute">
          Questions about this page? Email{" "}
          <a href={`mailto:${NDH_CONTACT.support}`} className="font-semibold text-signal-deep no-underline">
            {NDH_CONTACT.support}
          </a>{" "}
          or call {NDH_CONTACT.phone}. Parent gateway:{" "}
          <a href={NDH_CONTACT.parent} className="font-semibold text-signal-deep no-underline">
            ndh.com.ng
          </a>
          .
        </p>
      </article>
      <FamilyFooter />
    </div>
  );
}

function Head({ title, updated, intro }: { title: string; updated: string; intro: string }) {
  return (
    <header className="border-b border-hairline pb-6">
      <p className="pg-kicker">Legal · updated {updated}</p>
      <h1 className="mt-2 font-display text-[1.8rem] font-bold leading-tight text-ink-deep">
        {title}
      </h1>
      <p className="mt-3 text-[0.88rem] leading-7 text-ink-soft">{intro}</p>
    </header>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-[1.05rem] font-semibold text-ink-deep">{heading}</h2>
      <div className="mt-2 space-y-3 text-[0.85rem] leading-7 text-ink-soft">{children}</div>
    </section>
  );
}

function Terms() {
  const doc = DOCS.terms;
  return (
    <>
      <Head {...doc} />
      <Section heading="1. What this platform is">
        <p>
          NDH AgriCapital is a co-operative agricultural investment programme. Members contribute
          capital to specific, individually identified production cycles — a pond of catfish, a house
          of broilers, a hectare of grain. Contributions buy an equity share of that cycle&apos;s
          outcome, not a deposit with a fixed interest rate.
        </p>
        <p>
          NDH AgriCapital is not a bank, a deposit-taking institution or a licensed fund manager. No
          regulator supervises member contributions as deposits, and no deposit insurance applies.
        </p>
      </Section>
      <Section heading="2. The terms of a cycle are locked at publication">
        <p>
          When a cycle is published, its target capital, minimum entry ticket, profit split,
          emergency reserve percentage and projected harvest window are frozen. The database refuses
          to change them afterwards, including by an administrator. The split and reserve shown on
          the cycle card at the moment you contribute are the ones that will be used at settlement.
        </p>
      </Section>
      <Section heading="3. Equity is derived, never assigned">
        <p>
          Your equity share in a cycle is calculated at read time as your verified contributions
          divided by all verified contributions in that cycle. There is no equity field that any
          person, including NDH staff, can edit. If a contribution is not verified, it carries no
          equity.
        </p>
      </Section>
      <Section heading="4. How settlement works">
        <p>
          At harvest, revenue is settled in a strict order: operational liabilities and supplier
          debts first; then 100% of capital principal pro-rata; then the cycle&apos;s emergency
          reserve into escrow; then net profit at the locked split. If revenue cannot satisfy a
          level, the shortfall is reported openly on every affected member&apos;s statement rather
          than absorbed or concealed.
        </p>
      </Section>
      <Section heading="5. Commitments and liquidity">
        <p>
          Capital is committed for the life of the cycle. Early withdrawal is not offered. The
          co-operative share transfer board allows you to offer your verified equity to another
          member at par; a transfer completes only when the buyer&apos;s payment is verified and an
          administrator confirms it. An offer that is published but not settled leaves your equity
          unchanged.
        </p>
      </Section>
      <Section heading="6. Your account">
        <p>
          You are responsible for the security of your sign-in credentials and for keeping your
          contact details current. You must not attempt to access another member&apos;s records,
          interfere with the platform, or submit information you know to be false. Account access
          levels are assigned by the co-operative; you may not assign yourself a role.
        </p>
      </Section>
      <Section heading="7. Records and corrections">
        <p>
          The ledger is append-oriented. Verified contributions, approved farm logs and executed
          settlements are not silently rewritten. If you believe a figure is wrong, contact{" "}
          <a href={`mailto:${NDH_CONTACT.support}`} className="font-semibold text-signal-deep no-underline">
            {NDH_CONTACT.support}
          </a>{" "}
          and the correction will be made as a new, visible entry rather than an edit.
        </p>
      </Section>
      <Section heading="8. Changes to these terms">
        <p>
          We may update these terms as the co-operative develops; the date at the top identifies the
          current version. A change to these terms does not change the locked terms of a cycle you
          have already contributed to.
        </p>
      </Section>
    </>
  );
}

function Privacy() {
  const doc = DOCS.privacy;
  return (
    <>
      <Head {...doc} />
      <Section heading="1. What we hold">
        <p>
          Your name and email address; your access level; records of contributions you make and their
          verification status; payout lines from settlements; any transfer offer, farm visit request
          or reinvestment instruction you create.
        </p>
      </Section>
      <Section heading="2. Who can see it">
        <p>
          Row Level Security is enforced in the database, not the interface. You can read only your
          own contribution records, your own payout lines and your own bookings. Other members cannot
          see your holdings. Farm operators can see farm logs and expenses but cannot see your
          capital. Administrators can see the contribution book in order to verify transfers and run
          settlements.
        </p>
        <p>
          Aggregate figures — how much a cycle has raised, how many members it has, what the harvest
          weighed — are published. Individual amounts are not.
        </p>
      </Section>
      <Section heading="3. Payments">
        <p>
          Card payments are processed by Paystack. NDH AgriCapital never receives or stores your card
          details. Your Paystack reference is stored on the ledger row so a payment can be traced and
          reconciled. Paystack secret keys are held server-side only and are never included in
          anything sent to your browser.
        </p>
      </Section>
      <Section heading="4. What is published about the farm">
        <p>
          Farm milestones, harvest weigh-ins, settlement totals, incidents and weather observations
          are published deliberately. Approved logs are published with the operator&apos;s own public
          summary line only — internal notes, costs and reasons are not published.
        </p>
      </Section>
      <Section heading="5. Retention and your requests">
        <p>
          Ledger records are retained for as long as the co-operative exists and you remain a member,
          because they are the evidence behind settled payouts. You may ask for a copy of your own
          records, or ask us to correct your name or contact details, by emailing{" "}
          <a href={`mailto:${NDH_CONTACT.support}`} className="font-semibold text-signal-deep no-underline">
            {NDH_CONTACT.support}
          </a>
          .
        </p>
      </Section>
    </>
  );
}

function Risk() {
  const doc = DOCS.risk;
  return (
    <>
      <Head {...doc} />
      <Section heading="1. You can lose money">
        <p>
          A cycle can fail. Disease, flooding, a feed price spike, power failure, theft or a collapse
          in buyer prices can reduce or eliminate the harvest, and can prevent even the return of
          100% of principal at Level 2 of the waterfall. There is no guarantee of capital return and
          no guarantee of profit.
        </p>
      </Section>
      <Section heading="2. Projections are not promises">
        <p>
          The projected revenue on a cycle card is the administrator&apos;s costed plan, and the
          calculator on the public site runs the real settlement arithmetic against it. Neither is a
          forecast, a promise or a fixed return. Treat every projection as an illustration of what
          would happen if the plan holds exactly.
        </p>
      </Section>
      <Section heading="3. Your capital is illiquid">
        <p>
          Contributions are committed for the life of the cycle, which may run from seven weeks for
          broilers to over a year for layers. There is no early withdrawal. The share transfer board
          may let you find another member to take your equity at par, but there is no guarantee that
          anyone will want to buy, and an unsettled offer does not release your capital.
        </p>
      </Section>
      <Section heading="4. Biological and weather risk">
        <p>
          Livestock and crops die, and weather does not follow a plan. The platform publishes
          incidents openly and holds an emergency reserve at Level 3 of each settlement precisely
          because these events are expected rather than exceptional. A reserve set aside for a future
          cycle is not available to rescue the cycle that is currently running.
        </p>
      </Section>
      <Section heading="5. Concentration">
        <p>
          Backing a single cycle concentrates your exposure in one stock, one site and one operator.
          If you would not be comfortable losing the whole of a contribution, do not commit it as a
          single position.
        </p>
      </Section>
      <Section heading="6. Not financial advice">
        <p>
          Nothing on this platform — including the concierge assistant, the calculator and the public
          transparency data — is financial, tax or legal advice. If you need advice, speak to someone
          qualified who knows your circumstances.
        </p>
      </Section>
    </>
  );
}
