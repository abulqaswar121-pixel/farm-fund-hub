import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Camera,
  Coins,
  Filter,
  RefreshCw,
  Sprout,
  Wallet,
} from "lucide-react";

import { Card, EmptyState, Figure, Money, Notice } from "@/components/ndh/ledger-ui";
import { dateTimeLabel, money } from "@/lib/agri/format";
import {
  getMemberCommunity,
  type ActivityEntry,
  type CycleTreasury,
  type TreasurySnapshot,
} from "@/lib/agri.community.functions";
import { PortalHeading, PortalLoading } from "./portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/feed")({
  head: () => ({
    meta: [
      { title: "Farm Feed & Live Ledger | NDH AgriCapital" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FarmFeedPage,
});

/**
 * Farm feed — the member's running record.
 *
 * Three things, in the order a member looks for them:
 *   1. the treasury, live: what has come in, what has been spent, what is left;
 *   2. the activity log: every expense, every verified contribution, every
 *      payout, with who filed it, when, and what it was for;
 *   3. the cycle-by-cycle breakdown, so a member can see one pond's own book.
 *
 * The feed is append-only in the database. Nothing here is editable, and every
 * figure is read from rows that were written by the ledger itself.
 */

type KindFilter = "all" | "expense" | "capital" | "payout";

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "expense", label: "Expenses" },
  { id: "capital", label: "Money in" },
  { id: "payout", label: "Payouts" },
];

function matches(entry: ActivityEntry, filter: KindFilter): boolean {
  if (filter === "all") return true;
  if (filter === "expense") return entry.kind === "expense" || entry.kind === "expense_out";
  if (filter === "capital") return entry.kind === "capital_in" || entry.kind === "top_up";
  return entry.kind === "payout" || entry.kind === "payout_out";
}

function FarmFeedPage() {
  const load = useServerFn(getMemberCommunity);
  const [data, setData] = useState<Awaited<ReturnType<typeof getMemberCommunity>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<KindFilter>("all");

  async function refresh() {
    try {
      setData(await load());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = useMemo(
    () => (data?.activity ?? []).filter((entry) => matches(entry, filter)),
    [data, filter],
  );

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={18} />}
          title="The feed could not reach the ledger"
          action={
            <button
              type="button"
              className="pg-btn pg-btn--ghost mt-1"
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
          }
        >
          Nothing has been lost — this page only reads. Reload in a moment and the record will be
          back.
        </EmptyState>
      </Card>
    );
  }

  if (!data) return <PortalLoading label="Opening the farm feed…" />;

  return (
    <div className="space-y-6">
      <PortalHeading
        kicker="Farm feed"
        title="Everything that happened, as it happened"
        blurb="An expense is published the moment the farm team logs it — who filed it, what for and how much. Contributions, payouts and settlements appear in the same list, so the good news and the costs are read together."
        action={
          <button type="button" className="pg-btn pg-btn--ghost" onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <TreasuryFigures snapshot={data.treasury} />

      <div className="grid min-w-0 gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* Activity feed ------------------------------------------------- */}
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <p className="pg-kicker">Activity log</p>
            <div className="flex items-center gap-1">
              <Filter size={12} className="text-ink-mute" aria-hidden="true" />
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  aria-pressed={filter === item.id}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
                    filter === item.id
                      ? "bg-navy text-white"
                      : "bg-porcelain text-ink-soft hover:text-ink-deep",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {entries.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-hairline p-0">
              {entries.map((entry) => (
                <li key={entry.id} className="flex min-w-0 items-start gap-3 px-4 py-3">
                  <EntryIcon kind={entry.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="min-w-0 text-[0.82rem] font-semibold leading-5 text-ink-deep">
                        {entry.category ?? humanKind(entry.kind)}
                        {entry.cycleCode ? (
                          <span className="ml-1.5 font-mono text-[0.66rem] font-medium text-ink-mute">
                            {entry.cycleCode}
                          </span>
                        ) : null}
                      </p>
                      {entry.amount !== null ? (
                        <Money
                          value={entry.amount}
                          tone={
                            entry.kind === "capital_in" || entry.kind === "top_up"
                              ? "credit"
                              : entry.kind === "expense" || entry.kind === "expense_out"
                                ? "debit"
                                : "plain"
                          }
                          className="shrink-0 text-[0.82rem] font-semibold"
                        />
                      ) : null}
                    </div>
                    {entry.note ? (
                      <p className="mt-0.5 text-[0.74rem] leading-5 text-ink-soft">{entry.note}</p>
                    ) : null}
                    <p className="fig mt-1 text-[0.63rem] text-ink-mute">
                      {dateTimeLabel(entry.createdAt)} · logged by {entry.actorName}
                      {entry.reference ? ` · ref ${entry.reference.slice(0, 22)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Coins size={18} />} title="Nothing in this view yet">
              The feed fills itself: every verified contribution, every expense the farm team logs
              and every payout appears here the moment it is recorded. Try another filter.
            </EmptyState>
          )}
        </Card>

        <div className="min-w-0 space-y-5">
          {/* Per-cycle book ---------------------------------------------- */}
          <Card className="min-w-0 overflow-hidden">
            <p className="pg-kicker border-b border-hairline px-4 py-3">
              Each farm&apos;s own book
            </p>
            {data.cycleTreasury.length > 0 ? (
              <div className="table-scroll">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Cycle</th>
                      <th className="num">Funded</th>
                      <th className="num">Spent</th>
                      <th className="num">Cash left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cycleTreasury.map((row) => (
                      <CycleTreasuryRow key={row.cycleId} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<Sprout size={18} />} title="No published cycles yet">
                A farm&apos;s own figures appear here once the co-operative opens its first cycle.
              </EmptyState>
            )}
          </Card>

          {/* Where the money sits ---------------------------------------- */}
          <Card className="p-4">
            <p className="pg-kicker">How to read these figures</p>
            <ul className="mt-2.5 list-none space-y-2.5 p-0 text-[0.75rem] leading-5 text-ink-soft">
              <li>
                <strong className="text-ink-deep">Capital funded</strong> counts every contribution
                the ledger has <em>verified</em> — a pending card payment is not in it.
              </li>
              <li>
                <strong className="text-ink-deep">Expenses incurred</strong> counts money that has
                actually left the treasury to pay a supplier.
              </li>
              <li>
                <strong className="text-ink-deep">Cash on hand</strong> is what came in less what
                went out. The emergency reserve is set aside but still held, so it is not deducted.
              </li>
            </ul>
            <Link
              to="/portal/investor"
              className="mt-3.5 inline-flex items-center gap-1.5 text-[0.76rem] font-semibold text-signal-deep no-underline"
            >
              See your own position
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </Card>
        </div>
      </div>

      <Notice tone="info">
        Every figure on this page is computed from ledger rows when you load it. There is no stored
        total for anybody to adjust, and an expense cannot be deleted — a correction is a new entry
        with its own date.
      </Notice>
    </div>
  );
}

function EntryIcon({ kind }: { kind: string }) {
  const Icon =
    kind === "expense" || kind === "expense_out"
      ? Banknote
      : kind === "capital_in" || kind === "top_up"
        ? Wallet
        : kind === "payout" || kind === "payout_out"
          ? Coins
          : Camera;
  const tone =
    kind === "expense" || kind === "expense_out"
      ? "bg-amber-50 text-amber-700"
      : kind === "capital_in" || kind === "top_up"
        ? "bg-mint-soft text-mint-deep"
        : "bg-cyan-50 text-signal-deep";
  return (
    <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", tone)}>
      <Icon size={14} aria-hidden="true" />
    </span>
  );
}

function humanKind(kind: string): string {
  switch (kind) {
    case "expense":
    case "expense_out":
      return "Farm expense";
    case "capital_in":
      return "Contribution verified";
    case "payout":
    case "payout_out":
      return "Member payout";
    case "reserve_in":
      return "Emergency reserve";
    case "top_up":
      return "Treasury top-up";
    default:
      return "Ledger entry";
  }
}

function TreasuryFigures({ snapshot }: { snapshot: TreasurySnapshot }) {
  return (
    <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="p-4">
        <Figure
          label="Total capital funded"
          value={money(snapshot.totalCapitalFunded)}
          caption="Verified contributions, all cycles"
          tone="plain"
        />
      </Card>
      <Card className="p-4">
        <Figure
          label="Total expenses incurred"
          value={money(snapshot.totalExpensesIncurred)}
          caption="Money actually paid to suppliers"
          tone={snapshot.totalExpensesIncurred > 0 ? "debit" : "plain"}
        />
      </Card>
      <Card className="p-4">
        <Figure
          label="Cash on hand"
          value={money(snapshot.operatingCashOnHand)}
          caption="In, less what has gone out"
          tone="credit"
        />
      </Card>
    </dl>
  );
}

function CycleTreasuryRow({ row }: { row: CycleTreasury }) {
  return (
    <tr>
      <td>
        <span className="font-mono text-[0.72rem] font-semibold text-ink-soft">{row.code}</span>
      </td>
      <td className="num">
        <Money value={row.capitalFunded} />
      </td>
      <td className="num">
        <Money value={row.expensesPaid} tone={row.expensesPaid > 0 ? "debit" : "plain"} />
      </td>
      <td className="num font-semibold">
        <Money value={row.cashOnHand} />
      </td>
    </tr>
  );
}
