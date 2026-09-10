import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Save, UserPlus } from "lucide-react";

import {
  EmptyLedger,
  formatDate,
  formatNgn,
  formatPercent,
  Kicker,
  Money,
  Notice,
  PageHeader,
  StatusPill,
} from "@/components/ledger";
import { Input } from "@/components/ui/input";
import { usePortalContext } from "../portal";
import {
  adminAddContribution,
  adminCloseHarvestCycle,
  adminInviteMember,
  adminRenameMember,
  adminSetMemberRole,
  adminUpdatePayout,
  getPortalData,
  type PortalCycleRow,
} from "@/lib/apex.functions";

export const Route = createFileRoute("/portal/admin")({
  component: AdminPortal,
});

type PortalData = Awaited<ReturnType<typeof getPortalData>>;

type Tab = "members" | "capital" | "expenses" | "cycles";

function AdminPortal() {
  const { role } = usePortalContext();
  const [data, setData] = useState<PortalData | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("members");
  const [busy, setBusy] = useState(false);

  const loadPortal = useServerFn(getPortalData);

  useEffect(() => {
    loadPortal()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  async function refresh() {
    setData(await loadPortal());
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "members", label: "Members & roles" },
    { id: "capital", label: "Capital ledger" },
    { id: "expenses", label: "Expenses" },
    { id: "cycles", label: "Harvest & payouts" },
  ];

  if (role !== "admin") {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl text-ink">This portal is for administrators.</h1>
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
          {failed ? "We could not load the admin ledger." : "Opening the admin ledger…"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Admin portal"
        title="The cooperative's account book."
        blurb="Members & roles, every contribution and expense on the record, and harvest cycles with their payout splits — all from one table."
      />

      <div className="mt-8">
        <div className="ledger-tabs" role="tablist" aria-label="Admin sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              className="ledger-tab"
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "members" && <MembersTab data={data} refresh={refresh} />}
        {tab === "capital" && <CapitalTab data={data} refresh={refresh} />}
        {tab === "expenses" && <ExpensesTab data={data} />}
        {tab === "cycles" && <CyclesTab data={data} refresh={refresh} />}
      </div>
    </div>
  );
}

/* --------------------------------- Members --------------------------------- */

function MembersTab({ data, refresh }: { data: PortalData; refresh: () => Promise<void> }) {
  const rename = useServerFn(adminRenameMember);
  const setRole = useServerFn(adminSetMemberRole);
  const invite = useServerFn(adminInviteMember);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function handleRename(memberId: string) {
    setBusy(true);
    try {
      await rename({ data: { memberId, fullName: editingName } });
      setMessage({ tone: "success", text: "Member renamed." });
      setEditingId(null);
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to rename member",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(memberId: string, value: string) {
    setBusy(true);
    try {
      await setRole({ data: { memberId, role: value as "admin" | "operator" | "contributor" } });
      setMessage({ tone: "success", text: "Role updated. The database enforces it immediately." });
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to update role",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      await invite({
        data: {
          email: String(form.get("email")),
          fullName: String(form.get("fullName")),
          password: String(form.get("password")),
          role: String(form.get("role")) as "admin" | "operator" | "contributor",
        },
      });
      setMessage({ tone: "success", text: "Member account created and added to the roster." });
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to create member",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-6">
      {message && (
        <Notice tone={message.tone} className="mb-5">
          {message.text}
        </Notice>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="ledger-panel overflow-hidden">
          <div className="border-b border-rule px-5 py-4">
            <Kicker>Roster</Kicker>
            <h2 className="mt-1 text-xl">Members on the books</h2>
          </div>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="num">Contributed</th>
                  <th className="num">Equity</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {data.equity.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyLedger>Add a member below, or wait for the first sign-up.</EmptyLedger>
                    </td>
                  </tr>
                )}
                {data.equity.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {editingId === member.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            className="ledger-input h-8 max-w-44"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                          />
                          <button
                            className="inline-flex items-center gap-1 rounded-md bg-leaf px-2.5 py-1.5 text-xs font-semibold text-paper disabled:opacity-50"
                            disabled={busy}
                            onClick={() => handleRename(member.id)}
                          >
                            <Save className="size-3" /> Save
                          </button>
                        </div>
                      ) : (
                        <button
                          className="font-semibold text-ink underline-offset-4 hover:underline"
                          onClick={() => {
                            setEditingId(member.id);
                            setEditingName(member.name);
                          }}
                          title="Edit name"
                        >
                          {member.name}
                        </button>
                      )}
                    </td>
                    <td className="num">
                      <Money value={member.contributed} tone="credit" />
                    </td>
                    <td className="num fig">{formatPercent(member.equityPercent)}</td>
                    <td>
                      <select
                        className="rounded-md border border-input bg-card px-2 py-1.5 text-xs font-semibold capitalize text-ink focus:outline-none focus:ring-1 focus:ring-ring"
                        value={member.role ?? ""}
                        disabled={busy || member.id === data.user.id}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      >
                        <option value="">—</option>
                        <option value="admin">admin</option>
                        <option value="operator">operator</option>
                        <option value="contributor">contributor</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-rule bg-paper-deep px-5 py-2.5 text-[11px] text-ink-soft">
            Roles are enforced by the database (RLS) — the dropdown only changes what the server
            permits.
          </p>
        </div>

        <div className="ledger-panel h-fit p-6">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-leaf" />
            <Kicker>Add a member</Kicker>
          </div>
          <h2 className="mt-1 text-xl">Invite to the ledger</h2>
          <form className="mt-5 space-y-3" onSubmit={handleInvite}>
            <Field label="Full name">
              <Input className="ledger-input" name="fullName" placeholder="Amara Okafor" required />
            </Field>
            <Field label="Email">
              <Input
                className="ledger-input"
                name="email"
                type="email"
                placeholder="member@example.com"
                required
              />
            </Field>
            <Field label="Temporary password">
              <Input
                className="ledger-input"
                name="password"
                type="text"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </Field>
            <Field label="Role">
              <select
                name="role"
                className="ledger-input h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                defaultValue="contributor"
              >
                <option value="contributor">contributor</option>
                <option value="operator">operator</option>
                <option value="admin">admin</option>
              </select>
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep disabled:opacity-60"
            >
              <Plus className="size-4" /> Create member account
            </button>
            <p className="text-[11px] leading-5 text-ink-soft">
              Creates the account with the temporary password; the member can change it after their
              first sign-in.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Capital --------------------------------- */

function CapitalTab({ data, refresh }: { data: PortalData; refresh: () => Promise<void> }) {
  const addContribution = useServerFn(adminAddContribution);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      await addContribution({
        data: {
          memberId: String(form.get("memberId")),
          amount: Number(form.get("amount")),
          category: String(form.get("category") || "Contribution"),
          date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
          note: String(form.get("note") || ""),
        },
      });
      setMessage({ tone: "success", text: "Contribution recorded as verified (manual entry)." });
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to record contribution",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-8 pt-6">
      <div className="grid gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div className="ledger-panel overflow-hidden">
          <div className="border-b border-rule px-5 py-4">
            <Kicker>Full history · read from the record</Kicker>
            <h2 className="mt-1 text-xl">Every contribution ({data.contributions.length})</h2>
          </div>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Member</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.contributions.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyLedger>No contributions recorded yet.</EmptyLedger>
                    </td>
                  </tr>
                )}
                {data.contributions.map((item) => (
                  <tr key={item.id}>
                    <td className="fig">{formatDate(item.date)}</td>
                    <td className="font-medium">{item.memberName}</td>
                    <td>
                      {item.category}
                      {item.note ? (
                        <span className="block text-[11px] text-ink-soft">{item.note}</span>
                      ) : null}
                    </td>
                    <td className="fig capitalize">{item.payment_method}</td>
                    <td>
                      <StatusPill status={item.payment_status} />
                    </td>
                    <td className="num">
                      <Money
                        value={Number(item.amount)}
                        tone={item.payment_status === "success" ? "credit" : "plain"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan={5}>Verified total</td>
                  <td className="num">
                    <Money value={data.totals.totalContributed} tone="credit" />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="ledger-panel h-fit p-6">
          <Kicker>Admin entry</Kicker>
          <h2 className="mt-1 text-xl">Record a manual contribution</h2>
          <p className="mt-2 text-xs leading-5 text-ink-soft">
            Use this for bank transfers and cash received off-platform. It is recorded as verified,
            exactly like the Paystack webhook would.
          </p>
          {message && (
            <Notice tone={message.tone} className="mt-4">
              {message.text}
            </Notice>
          )}
          <form className="mt-4 space-y-3" onSubmit={handleAdd}>
            <Field label="Member">
              <select
                name="memberId"
                className="ledger-input h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                required
              >
                <option value="">Select member…</option>
                {data.equity.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>
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
              <Input className="ledger-input" name="category" placeholder="Contribution" />
            </Field>
            <Field label="Date">
              <Input
                className="ledger-input"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Note">
              <Input className="ledger-input" name="note" placeholder="Optional note" />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep disabled:opacity-60"
            >
              <Plus className="size-4" /> Record contribution
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Expenses -------------------------------- */

function ExpensesTab({ data }: { data: PortalData }) {
  const poolShare =
    data.totals.totalContributed > 0
      ? ((data.totals.totalExpenses / data.totals.totalContributed) * 100).toFixed(1) + "%"
      : "—";
  return (
    <section className="space-y-8 pt-6">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <FigureBlock
          label="Total expenses"
          value={<Money value={data.totals.totalExpenses} tone="debit" />}
        />
        <FigureBlock label="Entries" value={<span className="fig">{data.expenses.length}</span>} />
        <FigureBlock label="Of pool contributed" value={<span className="fig">{poolShare}</span>} />
      </div>
      <div className="ledger-panel overflow-hidden">
        <div className="border-b border-rule px-5 py-4">
          <Kicker>Full history · read-only here</Kicker>
          <h2 className="mt-1 text-xl">Every expense ({data.expenses.length})</h2>
        </div>
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th>Recorded by</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.expenses.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyLedger>No expenses recorded yet — the operator logs these.</EmptyLedger>
                  </td>
                </tr>
              )}
              {data.expenses.map((item) => (
                <tr key={item.id}>
                  <td className="fig">{formatDate(item.date)}</td>
                  <td className="font-medium">{item.category}</td>
                  <td className="max-w-64 truncate text-ink-soft">{item.note ?? "—"}</td>
                  <td>{item.recorderName}</td>
                  <td className="num">
                    <Money value={Number(item.amount)} tone="debit" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td colSpan={4}>Total</td>
                <td className="num">
                  <Money value={data.totals.totalExpenses} tone="debit" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

function FigureBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ledger-panel px-5 py-4">
      <Kicker>{label}</Kicker>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

/* ------------------------------ Harvest & payouts --------------------------- */

function CyclesTab({ data, refresh }: { data: PortalData; refresh: () => Promise<void> }) {
  const closeCycle = useServerFn(adminCloseHarvestCycle);
  const updatePayout = useServerFn(adminUpdatePayout);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage(null);
    try {
      const revenue = Number(form.get("revenue"));
      const result = await closeCycle({
        data: {
          revenue,
          date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
          note: String(form.get("note") || ""),
        },
      });
      setMessage({
        tone: "success",
        text: `Cycle closed at ${formatNgn(revenue)} revenue. Split of ${formatNgn(result.totalDistributed)} recorded across members, computed from live equity.`,
      });
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to close cycle",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePayoutSave(payoutId: string, percent: number, amount: number) {
    setBusy(true);
    setMessage(null);
    try {
      await updatePayout({ data: { payoutId, percent, amount } });
      setMessage({ tone: "success", text: "Payout split updated." });
      await refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to update payout",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-8 pt-6">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.7fr]">
        <div className="ledger-panel h-fit p-6">
          <Kicker>Close a harvest cycle</Kicker>
          <h2 className="mt-1 text-xl">Record revenue &amp; split by equity</h2>
          <p className="mt-2 text-xs leading-5 text-ink-soft">
            The split is computed live from each member's equity at the moment you close. You can
            adjust any line afterwards, then save.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleClose}>
            <Field label="Revenue (NGN)">
              <Input
                className="ledger-input"
                name="revenue"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
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
            <Field label="Note">
              <Input className="ledger-input" name="note" placeholder="e.g. Poultry cycle 3" />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep disabled:opacity-60"
            >
              <Plus className="size-4" /> Close cycle &amp; split
            </button>
          </form>
        </div>

        <div className="space-y-6">
          {data.cycles.length === 0 && (
            <div className="ledger-panel">
              <EmptyLedger>No harvest cycles closed yet.</EmptyLedger>
            </div>
          )}
          {data.cycles.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} busy={busy} onSave={handlePayoutSave} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CycleCard({
  cycle,
  busy,
  onSave,
}: {
  cycle: PortalCycleRow;
  busy: boolean;
  onSave: (payoutId: string, percent: number, amount: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, { percent: string; amount: string }>>({});
  const total = cycle.payouts.reduce((sum, p) => sum + p.amount, 0);

  const valueFor = (id: string) => {
    const row = cycle.payouts.find((p) => p.id === id);
    const current = draft[id];
    if (current) return current;
    return { percent: String(row?.percent ?? 0), amount: String(row?.amount ?? 0) };
  };

  const setValue = (id: string, field: "percent" | "amount", value: string) =>
    setDraft((prev) => ({ ...prev, [id]: { ...valueFor(id), [field]: value } }));

  return (
    <article className="ledger-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <Kicker>Harvest cycle</Kicker>
          <h3 className="mt-1 text-lg">{cycle.note || `Cycle of ${formatDate(cycle.date)}`}</h3>
          <p className="fig mt-0.5 text-xs text-ink-soft">{formatDate(cycle.date)}</p>
        </div>
        <div className="text-right">
          <Kicker>Revenue</Kicker>
          <p className="fig mt-1 text-xl font-semibold text-ink">
            <Money value={cycle.revenue} tone="credit" />
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Member</th>
              <th className="num">Equity % at close</th>
              <th className="num">Amount</th>
              <th>Adjust</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cycle.payouts.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyLedger>
                    No eligible members — no verified contributions at close.
                  </EmptyLedger>
                </td>
              </tr>
            )}
            {cycle.payouts.map((payout) => (
              <tr key={payout.id}>
                <td className="font-medium">{payout.memberName}</td>
                <td className="num fig">{formatPercent(payout.percent)}</td>
                <td className="num">
                  <Money value={Number(valueFor(payout.id).amount)} tone="credit" />
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-20 rounded-md border border-input bg-card px-2 py-1 text-right text-xs disabled:opacity-50"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      disabled={busy}
                      value={valueFor(payout.id).percent}
                      onChange={(e) => setValue(payout.id, "percent", e.target.value)}
                      aria-label="Payout percent"
                    />
                    <span className="text-xs text-ink-soft">%</span>
                    <span className="text-xs text-ink-soft">·</span>
                    <input
                      className="w-28 rounded-md border border-input bg-card px-2 py-1 text-right text-xs disabled:opacity-50"
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={busy}
                      value={valueFor(payout.id).amount}
                      onChange={(e) => setValue(payout.id, "amount", e.target.value)}
                      aria-label="Payout amount"
                    />
                  </div>
                </td>
                <td>
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-rule px-2.5 py-1.5 text-xs font-semibold text-leaf transition-colors hover:bg-sage disabled:opacity-50"
                    disabled={busy}
                    onClick={() =>
                      onSave(
                        payout.id,
                        Number(valueFor(payout.id).percent),
                        Number(valueFor(payout.id).amount),
                      )
                    }
                  >
                    <Save className="size-3" /> Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={2}>Distributed</td>
              <td className="num">
                <Money value={total} tone="gold" />
              </td>
              <td colSpan={2} className="text-[11px] text-ink-soft">
                {cycle.revenue > 0
                  ? `${((total / cycle.revenue) * 100).toFixed(2)}% of revenue`
                  : "No revenue this cycle"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
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
