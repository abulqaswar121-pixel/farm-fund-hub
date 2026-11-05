import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Card, EmptyState, Figure, Money, Notice, StatusChip } from "@/components/ndh/ledger-ui";
import { dateLabel, money } from "@/lib/agri/format";
import {
  getTreasuryConsole,
  recordTreasuryMovement,
  reviewExpense,
  type TreasuryConsole,
} from "@/lib/agri.community.functions";
import { PortalHeading, PortalLoading, usePortalContext } from "./portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/treasury")({
  head: () => ({
    meta: [{ title: "Treasury Desk | NDH AgriCapital" }, { name: "robots", content: "noindex" }],
  }),
  component: TreasuryDesk,
});

/**
 * The treasury desk.
 *
 * The three figures the brief calls for sit at the top, then two working areas:
 *
 *   1. **Expense approval.** An operator files a receipt; a treasury admin
 *      approves, marks the money as actually paid, or rejects it with a reason.
 *      Approving with a settlement date is what moves the treasury — filing a
 *      bill is not spending money.
 *   2. **The movement book.** Every naira in and out, append-only, with the
 *      source row it came from. Nothing here is editable.
 *
 * Recording a manual movement needs a reason in words. A treasury that moves
 * money without saying why is a treasury nobody should trust.
 */
function TreasuryDesk() {
  const { role } = usePortalContext();
  const load = useServerFn(getTreasuryConsole);
  const review = useServerFn(reviewExpense);
  const record = useServerFn(recordTreasuryMovement);

  const [data, setData] = useState<TreasuryConsole | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );
  const [manual, setManual] = useState({
    kind: "top_up" as "top_up" | "reserve_in",
    amount: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    category: "",
    note: "",
    reference: "",
  });

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

  async function decide(expenseId: string, decision: "approve" | "reject", settled: boolean) {
    setBusy(true);
    try {
      await review({
        data: {
          expenseId,
          decision,
          ...(decision === "approve" && settled
            ? { settledOn: new Date().toISOString().slice(0, 10) }
            : {}),
        },
      });
      setFlash({
        tone: "success",
        text:
          decision === "approve"
            ? settled
              ? "Approved and marked paid. The treasury movement is recorded."
              : "Approved. It will move the treasury only when you mark the money as paid."
            : "Rejected with the reason on the row. Nothing was deleted.",
      });
      await refresh();
    } catch (error) {
      setFlash({
        tone: "error",
        text: error instanceof Error ? error.message : "That decision could not be saved",
      });
    }
    setBusy(false);
  }

  async function submitMovement() {
    setBusy(true);
    try {
      await record({
        data: {
          kind: manual.kind,
          amount: Number(manual.amount),
          occurredOn: manual.occurredOn,
          category: manual.category.trim(),
          note: manual.note.trim(),
          reference: manual.reference.trim() || undefined,
        },
      });
      setFlash({ tone: "success", text: "Movement recorded in the treasury book." });
      setManual((prev) => ({ ...prev, amount: "", category: "", note: "", reference: "" }));
      await refresh();
    } catch (error) {
      setFlash({
        tone: "error",
        text: error instanceof Error ? error.message : "That movement could not be recorded",
      });
    }
    setBusy(false);
  }

  if (role !== "admin") {
    return (
      <Card>
        <EmptyState icon={<ShieldCheck size={18} />} title="The treasury desk is admin only">
          Your account does not carry the treasury permission. Ask an admin if you need it — the
          role lives in the database and cannot be granted from a browser.
        </EmptyState>
      </Card>
    );
  }

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={18} />}
          title="The treasury desk could not reach the ledger"
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
          No movement has been recorded or changed. This page only reads until you press a button.
        </EmptyState>
      </Card>
    );
  }

  if (!data) return <PortalLoading label="Counting the treasury…" />;

  return (
    <div className="space-y-6">
      <PortalHeading
        kicker="Treasury desk"
        title="The co-operative's money, counted out loud"
        blurb="Capital in, expenses out, cash left. Every figure is derived from the movement book below, and every movement carries the ledger row it came from."
        action={
          <button type="button" className="pg-btn pg-btn--ghost" onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {flash ? (
        <Notice tone={flash.tone}>
          {flash.text}
          <button
            type="button"
            onClick={() => setFlash(null)}
            className="ml-2 font-semibold underline underline-offset-2"
          >
            dismiss
          </button>
        </Notice>
      ) : null}

      {/* The three figures ---------------------------------------------- */}
      <dl className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <Figure
            label="Capital funded"
            value={money(data.snapshot.totalCapitalFunded)}
            caption="Verified contributions received"
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Expenses incurred"
            value={money(data.snapshot.totalExpensesIncurred)}
            caption="Actually paid to suppliers"
            tone={data.snapshot.totalExpensesIncurred > 0 ? "debit" : "plain"}
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Operating cash on hand"
            value={money(data.snapshot.operatingCashOnHand)}
            caption="In, less what has gone out"
            tone="credit"
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Reserve held"
            value={money(data.snapshot.totalReserveHeld)}
            caption="Set aside, not spent"
          />
        </Card>
      </dl>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="min-w-0 space-y-5">
          {/* Approval queue ---------------------------------------------- */}
          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
              <p className="pg-kicker">Expenses awaiting approval</p>
              <span className="pg-chip pg-chip--amber">
                {data.pendingExpenses.length} in the queue
              </span>
            </div>

            {data.pendingExpenses.length > 0 ? (
              <ul className="m-0 list-none divide-y divide-hairline p-0">
                {data.pendingExpenses.map((expense) => (
                  <li key={expense.id} className="px-4 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[0.84rem] font-semibold text-ink-deep">
                          {expense.category}
                          {expense.vendor ? (
                            <span className="font-normal text-ink-soft"> · {expense.vendor}</span>
                          ) : null}
                        </p>
                        <p className="fig mt-0.5 text-[0.68rem] text-ink-mute">
                          {expense.cycleCode} · {dateLabel(expense.date)} · filed by{" "}
                          {expense.loggedBy}
                        </p>
                        {expense.note ? (
                          <p className="mt-1 text-[0.74rem] leading-5 text-ink-soft">
                            {expense.note}
                          </p>
                        ) : null}
                        {expense.isPayable ? (
                          <span className="pg-chip pg-chip--amber mt-1.5">
                            Supplier balance still outstanding
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <Money
                          value={expense.amount}
                          tone="debit"
                          className="text-[0.92rem] font-semibold"
                        />
                        {expense.receiptUrl ? (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block text-[0.66rem] font-semibold text-signal-deep no-underline"
                          >
                            View receipt
                          </a>
                        ) : (
                          <span className="mt-1 block text-[0.64rem] text-ink-mute">
                            No receipt
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(expense.id, "approve", true)}
                        className="pg-btn pg-btn--mint h-8 px-3 text-[0.7rem]"
                      >
                        <CheckCircle2 size={12} aria-hidden="true" />
                        Approve & mark paid
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(expense.id, "approve", false)}
                        className="pg-btn pg-btn--ghost h-8 px-3 text-[0.7rem]"
                      >
                        <ClipboardCheck size={12} aria-hidden="true" />
                        Approve, still owing
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(expense.id, "reject", false)}
                        className="pg-btn pg-btn--ghost h-8 px-3 text-[0.7rem] text-rose-700"
                      >
                        <XCircle size={12} aria-hidden="true" />
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ClipboardCheck size={18} />} title="Nothing waiting">
                Every expense filed by the farm team has been reviewed. New entries appear here the
                moment an operator saves them — and on members&apos; screens at the same time.
              </EmptyState>
            )}
          </Card>

          {/* Movement book ------------------------------------------------ */}
          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
              <p className="pg-kicker">Movement book</p>
              <span className="text-[0.68rem] text-ink-mute">
                {data.snapshot.movements} movements · last {dateLabel(data.snapshot.lastMovementOn)}
              </span>
            </div>
            {data.movements.length > 0 ? (
              <div className="table-scroll">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Movement</th>
                      <th>Cycle</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movements.map((row) => (
                      <tr key={row.id}>
                        <td className="fig whitespace-nowrap">{dateLabel(row.occurredOn)}</td>
                        <td>
                          <span className="text-[0.76rem] font-medium text-ink-deep">
                            {row.category ?? humanKind(row.kind)}
                          </span>
                          {row.note ? (
                            <span className="mt-0.5 block text-[0.68rem] text-ink-mute">
                              {row.note}
                            </span>
                          ) : null}
                        </td>
                        <td className="font-mono text-[0.7rem] text-ink-mute">
                          {row.cycleCode ?? "—"}
                        </td>
                        <td className="num">
                          <Money
                            value={
                              row.kind === "expense_out" || row.kind === "payout_out"
                                ? -row.amount
                                : row.amount
                            }
                            tone={
                              row.kind === "expense_out" || row.kind === "payout_out"
                                ? "debit"
                                : "credit"
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<Banknote size={18} />} title="No movements yet">
                The first verified contribution, or the first expense marked as paid, will appear
                here.
              </EmptyState>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {/* Manual movement -------------------------------------------- */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-signal">
                <Coins size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="pg-kicker">Record a movement</p>
                <h2 className="mt-0.5 font-display text-[0.98rem] font-semibold text-ink-deep">
                  Only for what the ledger cannot derive
                </h2>
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="pg-label">What is this?</span>
                <select
                  className="pg-input mt-1 h-10"
                  value={manual.kind}
                  onChange={(event) =>
                    setManual((prev) => ({
                      ...prev,
                      kind: event.target.value as "top_up" | "reserve_in",
                    }))
                  }
                >
                  <option value="top_up">Top-up — money added from outside the ledger</option>
                  <option value="reserve_in">Reserve — moved into the emergency reserve</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="pg-label">Amount (₦)</span>
                  <input
                    className="pg-input mt-1 h-10"
                    inputMode="decimal"
                    value={manual.amount}
                    onChange={(event) =>
                      setManual((prev) => ({
                        ...prev,
                        amount: event.target.value.replace(/[^0-9.]/g, ""),
                      }))
                    }
                    placeholder="e.g. 250000"
                  />
                </label>
                <label className="block">
                  <span className="pg-label">Date</span>
                  <input
                    type="date"
                    className="pg-input mt-1 h-10"
                    value={manual.occurredOn}
                    onChange={(event) =>
                      setManual((prev) => ({ ...prev, occurredOn: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className="block">
                <span className="pg-label">Category</span>
                <input
                  className="pg-input mt-1 h-10"
                  value={manual.category}
                  onChange={(event) =>
                    setManual((prev) => ({ ...prev, category: event.target.value }))
                  }
                  placeholder="e.g. Bank interest, founder top-up, reserve transfer"
                />
              </label>

              <label className="block">
                <span className="pg-label">Why — in words</span>
                <textarea
                  className="pg-input mt-1 h-20 py-2 text-[0.82rem]"
                  value={manual.note}
                  onChange={(event) => setManual((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="This is published to members. Say plainly what the money is and where it came from."
                />
              </label>

              <button
                type="button"
                className="pg-btn pg-btn--primary h-10"
                disabled={
                  busy ||
                  Number(manual.amount) <= 0 ||
                  manual.category.trim().length < 3 ||
                  manual.note.trim().length < 10
                }
                onClick={() => void submitMovement()}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                Record movement
              </button>
            </div>
          </Card>

          {/* Per cycle --------------------------------------------------- */}
          <Card className="min-w-0 overflow-hidden">
            <p className="pg-kicker border-b border-hairline px-4 py-3">Per-cycle treasury</p>
            {data.perCycle.length > 0 ? (
              <ul className="m-0 list-none divide-y divide-hairline p-0">
                {data.perCycle.map((row) => (
                  <li key={row.cycleId} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[0.74rem] font-semibold text-ink-soft">
                        {row.code}
                      </span>
                      <StatusChip status="info" label={`${money(row.cashOnHand)} left`} />
                    </div>
                    <p className="fig mt-1 text-[0.66rem] text-ink-mute">
                      {money(row.capitalFunded)} in · {money(row.expensesPaid)} out
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Coins size={18} />} title="No published cycles">
                A cycle&apos;s own treasury appears once it is published.
              </EmptyState>
            )}
          </Card>

          <Card className="p-4">
            <p className="pg-kicker">Elsewhere in the console</p>
            <ul className="mt-2 list-none space-y-2 p-0 text-[0.76rem]">
              <li>
                <Link
                  to="/portal/admin"
                  className="inline-flex items-center gap-1.5 font-semibold text-signal-deep no-underline"
                >
                  Cycle launcher & settlement engine
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link
                  to="/portal/feed"
                  className="inline-flex items-center gap-1.5 font-semibold text-signal-deep no-underline"
                >
                  The activity feed members read
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </li>
            </ul>
            <p className={cn("mt-3 text-[0.68rem] leading-5 text-ink-mute")}>
              Rejecting an expense keeps the row and its reason. The co-operative&apos;s rule is
              that a correction is a new entry, never a deletion.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function humanKind(kind: string): string {
  switch (kind) {
    case "capital_in":
      return "Contribution verified";
    case "expense_out":
      return "Supplier paid";
    case "payout_out":
      return "Member payout";
    case "reserve_in":
      return "Emergency reserve";
    case "top_up":
      return "Treasury top-up";
    default:
      return kind;
  }
}
