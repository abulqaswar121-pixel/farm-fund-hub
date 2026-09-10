import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ClipboardList, Plus, Sprout, Wallet } from "lucide-react";

import {
  EmptyLedger,
  formatDate,
  Kicker,
  Money,
  Notice,
  PageHeader,
  StatusPill,
} from "@/components/ledger";
import { Input } from "@/components/ui/input";
import { usePortalContext } from "../portal";
import { addOperatorExpense, addStockLog, getPortalData } from "@/lib/apex.functions";

export const Route = createFileRoute("/portal/operator")({
  component: OperatorPortal,
});

type PortalData = Awaited<ReturnType<typeof getPortalData>>;

function OperatorPortal() {
  const { role } = usePortalContext();
  const [data, setData] = useState<PortalData | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPortal = useServerFn(getPortalData);
  const saveExpense = useServerFn(addOperatorExpense);
  const saveStock = useServerFn(addStockLog);

  useEffect(() => {
    loadPortal()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  async function refresh() {
    setData(await loadPortal());
  }

  async function handleExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      await saveExpense({
        data: {
          amount: Number(form.get("amount")),
          category: String(form.get("category")),
          note: String(form.get("note") || ""),
          date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
        },
      });
      setMessage({ tone: "success", text: "Expense added to the ledger." });
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to save expense",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      await saveStock({
        data: {
          count: Number(form.get("count")),
          note: String(form.get("note") || ""),
          date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
        },
      });
      setMessage({ tone: "success", text: "Stock / growth log entry added." });
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to save stock log",
      });
    } finally {
      setBusy(false);
    }
  }

  if (role !== "admin" && role !== "operator") {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl text-ink">This portal is for operators.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your role does not permit access here, and the server refuses these actions too.
        </p>
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-ink-soft">
          {failed ? "We could not load the operator ledger." : "Opening the operator ledger…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Operator portal"
        title="Log the work. Watch the books."
        blurb="Expenses and stock counts go on the record here; everything else in the cooperative's finances is shown to you read-only."
      />

      {message && (
        <Notice tone={message.tone} className="mt-6">
          {message.text}
        </Notice>
      )}

      {/* Entry forms */}
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section className="ledger-panel p-6">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-rust" />
            <Kicker>Operator entry</Kicker>
          </div>
          <h2 className="mt-1 text-xl">Log an expense</h2>
          <form className="mt-5 space-y-3" onSubmit={handleExpense}>
            <Field label="Amount (NGN)">
              <Input
                className="ledger-input"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
              />
            </Field>
            <Field label="Category">
              <Input
                className="ledger-input"
                name="category"
                placeholder="Feed, vet, labour…"
                required
              />
            </Field>
            <Field label="Date">
              <Input
                className="ledger-input"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Short note (optional)">
              <Input
                className="ledger-input"
                name="note"
                placeholder="e.g. 25 bags of layer mash"
              />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep disabled:opacity-60"
            >
              <Plus className="size-4" /> Add expense
            </button>
          </form>
        </section>

        <section className="ledger-panel p-6">
          <div className="flex items-center gap-2">
            <Sprout className="size-4 text-leaf" />
            <Kicker>Operator entry</Kicker>
          </div>
          <h2 className="mt-1 text-xl">Log stock / growth</h2>
          <form className="mt-5 space-y-3" onSubmit={handleStock}>
            <Field label="Count (head)">
              <Input
                className="ledger-input"
                name="count"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 120"
                required
              />
            </Field>
            <Field label="Date">
              <Input
                className="ledger-input"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Short note (optional)">
              <Input
                className="ledger-input"
                name="note"
                placeholder="e.g. 12 chicks lost to culling"
              />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep disabled:opacity-60"
            >
              <ClipboardList className="size-4" /> Add stock entry
            </button>
          </form>
        </section>
      </div>

      {/* Read-only financials */}
      <section className="mt-10">
        <div className="border-b border-rule pb-3">
          <Kicker>Read-only · the full record</Kicker>
          <h2 className="mt-1 text-xl md:text-2xl">Current position &amp; history</h2>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Stat
            label="Pool contributed"
            value={<Money value={data.totals.totalContributed} tone="credit" />}
          />
          <Stat label="Expenses" value={<Money value={data.totals.totalExpenses} tone="debit" />} />
          <Stat label="Net pool" value={<Money value={data.totals.netPool} />} />
          <Stat label="Members" value={<span className="fig">{data.totals.memberCount}</span>} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <LedgerTable
            title={`Contributions (${data.contributions.length})`}
            columns={["Date", "Member", "Status", "Amount"]}
            empty="No contributions recorded yet."
            rows={data.contributions.map((item) => [
              <span key="d" className="fig">
                {formatDate(item.date)}
              </span>,
              <span key="m" className="font-medium">
                {item.memberName}
              </span>,
              <StatusPill key="s" status={item.payment_status} />,
              <Money
                key="a"
                value={Number(item.amount)}
                tone={item.payment_status === "success" ? "credit" : "plain"}
                className="font-semibold"
              />,
            ])}
          />
          <LedgerTable
            title={`Expenses (${data.expenses.length})`}
            columns={["Date", "Category", "By", "Amount"]}
            empty="No expenses recorded yet."
            rows={data.expenses.map((item) => [
              <span key="d" className="fig">
                {formatDate(item.date)}
              </span>,
              <span key="c" className="font-medium">
                {item.category}
              </span>,
              <span key="b" className="text-ink-soft">
                {item.recorderName}
              </span>,
              <Money key="a" value={Number(item.amount)} tone="debit" className="font-semibold" />,
            ])}
          />
        </div>

        <div className="mt-8">
          <LedgerTable
            title={`Stock / growth log (${data.stockLogs.length})`}
            columns={["Date", "Count", "Note", "Recorded by"]}
            empty="No stock entries yet."
            rows={data.stockLogs.map((item) => [
              <span key="d" className="fig">
                {formatDate(item.date)}
              </span>,
              <span key="c" className="fig font-semibold">
                {item.count.toLocaleString()}
              </span>,
              <span key="n" className="max-w-64 truncate text-ink-soft">
                {item.note ?? "—"}
              </span>,
              <span key="b" className="text-ink-soft">
                {item.recorderName}
              </span>,
            ])}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ledger-panel px-5 py-4">
      <Kicker>{label}</Kicker>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function LedgerTable({
  title,
  columns,
  rows,
  empty,
}: {
  title: string;
  columns: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <div className="ledger-panel overflow-hidden">
      <div className="border-b border-rule px-5 py-4">
        <Kicker>Ledger</Kicker>
        <h3 className="mt-1 text-lg">{title}</h3>
      </div>
      <div className="table-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyLedger>{empty}</EmptyLedger>
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={index}>{row}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
