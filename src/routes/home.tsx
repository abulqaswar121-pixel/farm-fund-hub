import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, Landmark, Scale, Sprout } from "lucide-react";

import {
  BadgeMark,
  EmptyLedger,
  Figure,
  formatDate,
  Kicker,
  Money,
  PageHeader,
} from "@/components/ledger";
import { getPublicCompanyData } from "@/lib/apex.functions";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Apex Agri-Capital | The Shared Farm Ledger" },
      {
        name: "description",
        content:
          "Apex Agri-Capital is a shared ledger for a small agriculture investment cooperative — one account book for capital, costs, stock and payouts.",
      },
      { property: "og:title", content: "Apex Agri-Capital | The Shared Farm Ledger" },
      {
        property: "og:description",
        content:
          "One account book for a small agriculture investment cooperative. Capital, costs, stock and payouts — all on the record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

type PublicData = Awaited<ReturnType<typeof getPublicCompanyData>>;

function HomePage() {
  const loadPublic = useServerFn(getPublicCompanyData);
  const [data, setData] = useState<PublicData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadPublic()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const totals = data?.totals;

  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <BadgeMark className="size-9" />
            <div className="leading-tight">
              <p className="font-display text-base font-bold tracking-tight">Apex Agri-Capital</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                Cooperative farm ledger
              </p>
            </div>
          </div>
          <Link to="/" className="ledger-link text-sm">
            Member sign in <ArrowRight className="ml-1 inline size-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-14 md:px-8 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="max-w-xl">
          <Kicker>Shared ledger · Single source of truth</Kicker>
          <h1 className="mt-4 text-4xl leading-[1.12] tracking-tight md:text-[3.4rem]">
            One account book for the whole farm venture.
          </h1>
          <p className="mt-6 text-base leading-7 text-ink-soft">
            Apex Agri-Capital keeps a single, trusted record of the capital our members contribute,
            the costs of running the operation, the stock we raise, and the harvest proceeds
            distributed back. Every figure below is read live from that ledger — nothing is stated
            here that is not on the record.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-leaf px-5 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep"
            >
              Sign in to your ledger <ArrowRight className="size-4" />
            </Link>
            <a href="#how-it-works" className="ledger-link text-sm">
              How contributions &amp; equity work
            </a>
          </div>
        </div>

        {/* Live ledger sheet — the one bold gesture */}
        <aside className="ledger-panel ruled overflow-hidden">
          <div className="border-b border-rule bg-card/70 px-6 pb-4 pt-5">
            <div className="flex items-center justify-between">
              <Kicker>Current position · live</Kicker>
              <span className="ledger-seal">Verified records only</span>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Totals are computed from contributions with <span className="fig">paid</span> status.
            </p>
          </div>
          <div className="px-6 py-6">
            {totals ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-7">
                <Figure
                  label="Pool contributed"
                  value={<Money value={totals.totalContributed} tone="credit" />}
                  caption={
                    totals.latestContributionDate
                      ? `Latest entry ${formatDate(totals.latestContributionDate)}`
                      : "No entries recorded yet"
                  }
                />
                <Figure
                  label="Cooperative expenses"
                  value={<Money value={totals.totalExpenses} tone="debit" />}
                />
                <Figure
                  label="Net pool"
                  value={<Money value={totals.netPool} />}
                  caption={
                    totals.memberCount === 1
                      ? "1 member on the books"
                      : `${totals.memberCount} members on the books`
                  }
                />
                <Figure
                  label="Distributed to members"
                  value={<Money value={totals.totalDistributed} tone="gold" />}
                  caption={
                    totals.cyclesClosed === 1
                      ? "1 harvest cycle closed"
                      : `${totals.cyclesClosed} harvest cycles closed`
                  }
                />
                <div className="col-span-2 border-t border-rule pt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <Kicker>Latest stock count</Kicker>
                    {totals.latestStockCount !== null ? (
                      <p className="fig text-xl font-semibold text-ink">
                        {totals.latestStockCount.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-ink-soft">head</span>
                        <span className="ml-2 text-xs font-normal text-ink-soft">
                          {totals.latestStockDate ? formatDate(totals.latestStockDate) : ""}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-ink-soft">Not logged yet</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyLedger>
                {failed
                  ? "Ledger figures are unavailable right now — check back shortly."
                  : "Reading the ledger…"}
              </EmptyLedger>
            )}
          </div>
          <div className="border-t border-rule bg-paper-deep px-6 py-3 text-[11px] text-ink-soft">
            Figures update as the cooperative records activity.
          </div>
        </aside>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-rule bg-card">
        <div className="mx-auto max-w-6xl px-6 py-14 md:px-8 md:py-16">
          <PageHeader
            kicker="How the venture runs"
            title="Contribute. Equity accrues. Harvest pays out."
            blurb="The rules below are the rules the ledger enforces — they are not a pitch."
          />
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule md:grid-cols-3">
            {[
              {
                icon: <Landmark className="size-5" />,
                step: "01",
                title: "Members contribute",
                body: "Contributors pay into the pool through Paystack or a recorded manual entry. Only verified contributions count toward equity.",
              },
              {
                icon: <Scale className="size-5" />,
                step: "02",
                title: "Equity follows the money",
                body: "Your share is computed live: verified contributed ÷ the verified pool total. It is never stored or edited — it recalculates with every entry.",
              },
              {
                icon: <Sprout className="size-5" />,
                step: "03",
                title: "Cycles close to payouts",
                body: "When a harvest cycle closes, revenue is recorded and the split to members is derived from the equity percentages on the record.",
              },
            ].map((item) => (
              <article key={item.step} className="bg-card p-7">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-full border border-leaf/40 text-leaf">
                    {item.icon}
                  </span>
                  <span className="font-display text-sm italic text-gold">{item.step}</span>
                </div>
                <h3 className="mt-5 text-lg">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Roles & governance */}
      <section className="mx-auto max-w-6xl px-6 py-14 md:px-8 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Kicker>Governance</Kicker>
            <h2 className="mt-3 text-2xl md:text-3xl">Three roles, enforced at the database.</h2>
            <p className="mt-4 text-sm leading-6 text-ink-soft">
              Permissions are enforced by the database itself, not hidden buttons — if a role cannot
              act, the action is refused server-side too. Equity percentages are always calculated
              live from the contributions table.
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-rule pt-5 text-xs text-ink-soft">
              <BookOpenCheck className="size-4 text-leaf" />
              Payments are verified server-side before they reach the ledger.
            </div>
          </div>
          <div className="table-scroll rounded-lg border border-rule">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Can do</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-semibold">Admin</td>
                  <td>
                    Manage members and roles · record any entry · close harvest cycles and confirm
                    payout splits
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold">Operator</td>
                  <td>Log expenses and stock/growth entries · view the full ledger read-only</td>
                </tr>
                <tr>
                  <td className="font-semibold">Contributor</td>
                  <td>Contribute via Paystack · view the ledger and their own equity, read-only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <BadgeMark className="size-8" />
            <div>
              <p className="font-display text-sm font-bold tracking-tight">Apex Agri-Capital</p>
              <p className="text-[11px] text-sidebar-foreground/70">
                A shared ledger for a small agriculture investment cooperative
              </p>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-sidebar-primary/60 px-4 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            Member sign in <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </footer>
    </main>
  );
}
