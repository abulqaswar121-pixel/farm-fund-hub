import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarCheck,
  Coins,
  Gauge,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Repeat,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  X,
} from "lucide-react";

import { StageRail } from "@/components/agri/StageRail";
import { WaterfallLadder } from "@/components/agri/WaterfallLadder";
import {
  Card,
  EmptyState,
  Figure,
  Money,
  Notice,
  SectionHeader,
  StatusChip,
} from "@/components/ndh/ledger-ui";
import { COMMODITIES, CYCLE_STATUS_LABEL, type CycleStatus } from "@/lib/agri/commodities";
import { dateLabel, dateTimeLabel, money, number, percent } from "@/lib/agri/format";
import { DEFAULT_RULES, runWaterfall, validateRules, type CycleRules } from "@/lib/agri/rules";
import {
  advanceCycleStage,
  applyRollovers,
  createFarmCycle,
  decideFarmVisit,
  getAdminConsole,
  getCyclePositionBook,
  getSettlementLines,
  markPayoutPaid,
  publishFarmCycle,
  recordHarvestSale,
  rejectInvestment,
  resolveIncident,
  reviewOperationalLog,
  runSettlement,
  setMemberRole,
  settleShareTransfer,
  verifyOfflineInvestment,
  type AdminConsole,
} from "@/lib/agri.ops.functions";
import { ROLE_LABEL } from "@/lib/agri/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/admin")({
  component: AdminPortal,
});

type Tab = "overview" | "cycles" | "verification" | "logs" | "settlement" | "members" | "board";

const TABS: { id: Tab; label: string; icon: typeof Gauge }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "cycles", label: "Cycle launcher", icon: Layers },
  { id: "verification", label: "Contribution verifier", icon: Banknote },
  { id: "logs", label: "Log auditor", icon: ShieldCheck },
  { id: "settlement", label: "Settlement engine", icon: Scale },
  { id: "members", label: "Members & roles", icon: BadgeCheck },
  { id: "board", label: "Board & register", icon: Coins },
];

function AdminPortal() {
  const load = useServerFn(getAdminConsole);
  const [console_, setConsole] = useState<AdminConsole | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [flash, setFlash] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  async function refresh() {
    try {
      setConsole(await load());
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<Lock size={18} />}
          title="Treasury console unavailable"
          action={
            <button
              type="button"
              className="pg-btn pg-btn--ghost mt-1"
              onClick={() => {
                setFailed(false);
                void refresh();
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
          }
        >
          Admin access is required for this console, and the ledger must be reachable. The
          permission check is enforced in the database as well as here.
        </EmptyState>
      </Card>
    );
  }

  if (!console_) {
    return (
      <div className="flex items-center gap-2 py-16 text-ink-mute">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="fig text-[0.8rem]">Opening treasury console…</span>
      </div>
    );
  }

  const done = (tone: "success" | "error" | "info", text: string) => {
    setFlash({ tone, text });
    void refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-hairline pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="pg-kicker">Admin &amp; treasury portal</p>
          <h1 className="mt-1.5 text-[1.6rem] leading-tight text-ink-deep md:text-[1.9rem]">
            Cycle control, verification and settlement
          </h1>
          <p className="mt-1.5 max-w-2xl text-[0.83rem] leading-6 text-ink-soft">
            Publishing a cycle freezes its terms permanently. Verifying a transfer credits equity.
            Running a settlement pays everyone. There is no undo on any of the three.
          </p>
        </div>
        <span className="pg-chip pg-chip--violet">
          <ShieldCheck size={12} aria-hidden="true" />
          {ROLE_LABEL.admin}
        </span>
      </div>

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

      <div className="pg-portal-tabs border-b border-hairline pb-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={cn(
                "pg-portal-tab text-ink-soft hover:!bg-porcelain hover:!text-ink-deep",
                tab === item.id && "!bg-navy !text-white",
              )}
            >
              <Icon size={14} aria-hidden="true" />
              {item.label}
              {item.id === "verification" && console_.kpis.awaitingVerification > 0 ? (
                <span className="fig rounded-full bg-coral px-1.5 text-[0.62rem] font-bold text-white">
                  {console_.kpis.awaitingVerification}
                </span>
              ) : null}
              {item.id === "logs" && console_.kpis.logsToReview > 0 ? (
                <span className="fig rounded-full bg-amber-alert px-1.5 text-[0.62rem] font-bold text-white">
                  {console_.kpis.logsToReview}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Card className="p-4">
              <Figure
                label="Capital under management"
                value={money(console_.kpis.capitalUnderManagement)}
                caption="Verified, net of transfers"
              />
            </Card>
            <Card className="p-4">
              <Figure
                label="Awaiting verification"
                value={number(console_.kpis.awaitingVerification)}
                tone={console_.kpis.awaitingVerification > 0 ? "debit" : "plain"}
                caption="Offline transfers to check"
              />
            </Card>
            <Card className="p-4">
              <Figure
                label="Logs to review"
                value={number(console_.kpis.logsToReview)}
                tone={console_.kpis.logsToReview > 0 ? "debit" : "plain"}
                caption="Operator entries in queue"
              />
            </Card>
            <Card className="p-4">
              <Figure
                label="Open incidents"
                value={number(console_.kpis.openIncidents)}
                caption="Published on the register"
              />
            </Card>
            <Card className="p-4">
              <Figure
                label="Members"
                value={number(console_.kpis.members)}
                caption="Excluding staff"
              />
            </Card>
            <Card className="p-4">
              <Figure
                label="Settled cycles"
                value={number(console_.kpis.settledCycles)}
                caption="Waterfall completed"
              />
            </Card>
          </dl>

          <SectionHeader
            kicker="Portfolio of cycles"
            title="Every cycle, including unpublished drafts"
            blurb="Drafts are invisible to the public and to members. Publishing freezes the target capital, the profit split, the reserve and the minimum ticket."
          />

          {console_.cycles.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="table-scroll">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Cycle</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th className="num">Raised</th>
                      <th className="num">Target</th>
                      <th className="num">Funded</th>
                      <th className="num">Investors</th>
                      <th>Locked rules</th>
                    </tr>
                  </thead>
                  <tbody>
                    {console_.cycles.map((cycle) => (
                      <tr key={cycle.id}>
                        <td>
                          <span className="font-mono text-[0.72rem] font-semibold text-ink-deep">
                            {cycle.code}
                          </span>
                          <span className="ml-2 text-[0.72rem] text-ink-mute">{cycle.name}</span>
                        </td>
                        <td className="capitalize">{cycle.commodity}</td>
                        <td>
                          <StatusChip
                            status={
                              cycle.status === "settled"
                                ? "success"
                                : cycle.status === "draft"
                                  ? "pending"
                                  : "info"
                            }
                            label={CYCLE_STATUS_LABEL[cycle.status as CycleStatus] ?? cycle.status}
                          />
                        </td>
                        <td className="num">
                          <Money value={cycle.raised} />
                        </td>
                        <td className="num">
                          <Money value={cycle.targetCapital} />
                        </td>
                        <td className="num fig">{percent(cycle.fundedPercent, 1)}</td>
                        <td className="num fig">{cycle.investorCount}</td>
                        <td>
                          <span className="pg-chip pg-chip--locked">
                            {cycle.locked ? <Lock size={10} aria-hidden="true" /> : null}
                            {cycle.rulesChip}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState icon={<Layers size={18} />} title="No cycles yet">
                Use the cycle launcher to create the co-operative&apos;s first production cycle.
              </EmptyState>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "cycles" ? <CycleLauncher console_={console_} onDone={done} /> : null}

      {tab === "verification" ? (
        <div className="space-y-5">
          <SectionHeader
            kicker="Offline contribution verifier"
            title="Credit equity only against money that actually landed"
            blurb="Members raise a pending record when they make a bank transfer. Confirm the teller reference appears on the co-operative account before you verify — verifying is what credits equity."
            action={
              <span className="pg-chip pg-chip--amber">
                {console_.pendingInvestments.length} awaiting
              </span>
            }
          />
          <VerificationQueue console_={console_} onDone={done} />
        </div>
      ) : null}

      {tab === "logs" ? (
        <div className="space-y-5">
          <SectionHeader
            kicker="Operator log auditor"
            title="Approve what the farm filed"
            blurb="Approving a log publishes the operator's public summary line to the transparency feed. Flagging it sends it back with your note — the entry itself is never deleted."
            action={
              <span className="pg-chip pg-chip--amber">
                {console_.logsAwaitingReview.length} in queue
              </span>
            }
          />
          {console_.logsAwaitingReview.length > 0 ? (
            <div className="space-y-3">
              {console_.logsAwaitingReview.map((log) => (
                <AdminLogRow key={log.id} log={log} onDone={done} />
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState icon={<ShieldCheck size={18} />} title="The review queue is clear">
                Every operator entry has been reviewed. New logs appear here the moment they are
                filed.
              </EmptyState>
            </Card>
          )}
        </div>
      ) : null}

      {tab === "settlement" ? <SettlementEngine console_={console_} onDone={done} /> : null}

      {tab === "members" ? (
        <div className="space-y-5">
          <SectionHeader
            kicker="Members & roles"
            title="Who can do what"
            blurb="Roles live in the dedicated user_roles table and are checked by a security-definer function. Promoting someone to admin gives them the settlement engine — treat it accordingly."
          />
          <Card className="overflow-hidden">
            <div className="table-scroll">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th className="num">Verified capital</th>
                    <th className="num">Cycles</th>
                    <th>Joined</th>
                    <th>Change role</th>
                  </tr>
                </thead>
                <tbody>
                  {console_.members.map((member) => (
                    <MemberRow key={member.userId} member={member} onDone={done} />
                  ))}
                </tbody>
              </table>
            </div>
            {console_.members.length === 0 ? (
              <EmptyState icon={<BadgeCheck size={18} />} title="No accounts yet">
                Members appear here as soon as they register.
              </EmptyState>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "board" ? <BoardAndRegister console_={console_} onDone={done} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Cycle launcher
 * -------------------------------------------------------------------------- */

function CycleLauncher({
  console_,
  onDone,
}: {
  console_: AdminConsole;
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const create = useServerFn(createFarmCycle);
  const publish = useServerFn(publishFarmCycle);
  const advance = useServerFn(advanceCycleStage);

  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    commodity: "catfish",
    summary: "",
    farmSite: "Main farm",
    targetCapital: "",
    minimumTicket: "",
    projectedRevenue: "",
    projectedLiabilities: "",
    investorPercent: String(DEFAULT_RULES.investorSharePercent),
    operatorPercent: String(DEFAULT_RULES.operatorSharePercent),
    reservePercent: String(DEFAULT_RULES.reservePercent),
    cycleWeeks: "16",
    fundingClosesOn: "",
    stockingOn: "",
    projectedHarvestOn: "",
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const rules: CycleRules = {
    investorSharePercent: Number(form.investorPercent) || 0,
    operatorSharePercent: Number(form.operatorPercent) || 0,
    reservePercent: Number(form.reservePercent) || 0,
  };
  const problems = validateRules(rules);

  const preview = runWaterfall({
    grossRevenue: Number(form.projectedRevenue) || 0,
    capitalRaised: Number(form.targetCapital) || 0,
    operationalLiabilities: Number(form.projectedLiabilities) || 0,
    rules,
  });

  async function submit() {
    setBusy(true);
    try {
      await create({
        data: {
          code: form.code,
          name: form.name,
          commodity: form.commodity as "catfish" | "broiler" | "layer" | "grain" | "greenhouse",
          summary: form.summary || undefined,
          farmSite: form.farmSite,
          targetCapital: Number(form.targetCapital),
          minimumTicket: Number(form.minimumTicket),
          projectedRevenue: Number(form.projectedRevenue) || 0,
          projectedLiabilities: Number(form.projectedLiabilities) || 0,
          investorPercent: rules.investorSharePercent,
          operatorPercent: rules.operatorSharePercent,
          reservePercent: rules.reservePercent,
          cycleWeeks: Number(form.cycleWeeks),
          fundingClosesOn: form.fundingClosesOn || undefined,
          stockingOn: form.stockingOn || undefined,
          projectedHarvestOn: form.projectedHarvestOn || undefined,
        },
      });
      setOpen(false);
      setForm((prev) => ({ ...prev, code: "", name: "", summary: "" }));
      onDone("success", "Cycle created as a draft. Publish it when the terms are final.");
    } catch (error) {
      onDone("error", error instanceof Error ? error.message : "Unable to create that cycle");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Cycle launcher"
        title="Publish a cycle with its terms already frozen"
        blurb="Everything typed here is written into the cycle at creation. The moment you publish, the target capital, split, reserve and minimum ticket become immutable — the database will reject any later change."
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="pg-btn pg-btn--primary"
          >
            {open ? <X size={15} /> : <Plus size={15} />}
            {open ? "Close launcher" : "New cycle"}
          </button>
        }
      />

      {open ? (
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cycle code" hint="Public identifier, e.g. CAT-004">
              <input
                className="pg-input"
                value={form.code}
                onChange={(event) => set("code", event.target.value.toUpperCase())}
                placeholder="CAT-004"
              />
            </Field>
            <Field label="Display name">
              <input
                className="pg-input"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Catfish Pond 4 — 2026 grow-out"
              />
            </Field>
            <Field label="Commodity">
              <select
                className="pg-input"
                value={form.commodity}
                onChange={(event) => set("commodity", event.target.value)}
              >
                {COMMODITIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Farm site">
              <input
                className="pg-input"
                value={form.farmSite}
                onChange={(event) => set("farmSite", event.target.value)}
              />
            </Field>
            <Field label="Summary" className="md:col-span-2">
              <textarea
                className="pg-input h-20 py-2"
                value={form.summary}
                onChange={(event) => set("summary", event.target.value)}
                placeholder="What is being produced, where, and how the revenue is realised."
              />
            </Field>

            <Field label="Target capital (₦)" hint="Total capital required for the cycle">
              <input
                className="pg-input"
                inputMode="decimal"
                value={form.targetCapital}
                onChange={(event) =>
                  set("targetCapital", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="3000000"
              />
            </Field>
            <Field label="Minimum entry ticket (₦)">
              <input
                className="pg-input"
                inputMode="decimal"
                value={form.minimumTicket}
                onChange={(event) =>
                  set("minimumTicket", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="50000"
              />
            </Field>
            <Field
              label="Projected harvest revenue (₦)"
              hint="From the costed plan — drives the public calculator"
            >
              <input
                className="pg-input"
                inputMode="decimal"
                value={form.projectedRevenue}
                onChange={(event) =>
                  set("projectedRevenue", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="4200000"
              />
            </Field>
            <Field
              label="Projected supplier liabilities (₦)"
              hint="Expected unpaid balances at settlement (Level 1)"
            >
              <input
                className="pg-input"
                inputMode="decimal"
                value={form.projectedLiabilities}
                onChange={(event) =>
                  set("projectedLiabilities", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="180000"
              />
            </Field>

            <Field label="Investor profit share (%)">
              <input
                className="pg-input"
                inputMode="decimal"
                value={form.investorPercent}
                onChange={(event) => {
                  const value = event.target.value.replace(/[^0-9.]/g, "");
                  set("investorPercent", value);
                  set("operatorPercent", value ? String(100 - Number(value)) : "");
                }}
              />
            </Field>
            <Field label="Farm caretaker share (%)" hint="Auto-completes so the split totals 100%">
              <input
                className="pg-input"
                inputMode="decimal"
                value={form.operatorPercent}
                onChange={(event) => {
                  const value = event.target.value.replace(/[^0-9.]/g, "");
                  set("operatorPercent", value);
                  set("investorPercent", value ? String(100 - Number(value)) : "");
                }}
              />
            </Field>
            <Field label="Emergency reserve (%)" hint="Must sit between 5% and 10%">
              <input
                className="pg-input"
                inputMode="decimal"
                value={form.reservePercent}
                onChange={(event) =>
                  set("reservePercent", event.target.value.replace(/[^0-9.]/g, ""))
                }
              />
            </Field>
            <Field label="Cycle duration (weeks)">
              <input
                className="pg-input"
                inputMode="numeric"
                value={form.cycleWeeks}
                onChange={(event) => set("cycleWeeks", event.target.value.replace(/[^0-9]/g, ""))}
              />
            </Field>
            <Field label="Funding closes">
              <input
                type="date"
                className="pg-input"
                value={form.fundingClosesOn}
                onChange={(event) => set("fundingClosesOn", event.target.value)}
              />
            </Field>
            <Field label="Stocking date">
              <input
                type="date"
                className="pg-input"
                value={form.stockingOn}
                onChange={(event) => set("stockingOn", event.target.value)}
              />
            </Field>
            <Field label="Projected harvest date" className="md:col-span-2">
              <input
                type="date"
                className="pg-input"
                value={form.projectedHarvestOn}
                onChange={(event) => set("projectedHarvestOn", event.target.value)}
              />
            </Field>
          </div>

          {problems.length > 0 ? (
            <Notice tone="error" className="mt-4">
              {problems.join(" ")}
            </Notice>
          ) : null}

          {Number(form.projectedRevenue) > 0 && Number(form.targetCapital) > 0 ? (
            <div className="mt-5 rounded-xl border border-hairline bg-porcelain p-4">
              <p className="pg-kicker">Preview: how this cycle would settle</p>
              <p className="mt-1 text-[0.74rem] text-ink-mute">
                Run with the projected figures above, at 100% funding. This is the exact arithmetic
                the settlement engine will perform.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                <Figure label="Level 1 liabilities" value={money(preview.liabilitiesPaid)} />
                <Figure label="Level 2 principal" value={money(preview.principalReturned)} />
                <Figure label="Level 3 reserve" value={money(preview.reserveSetAside)} />
                <Figure
                  label="Level 4 net profit"
                  value={money(preview.netProfit)}
                  tone={preview.netProfit > 0 ? "credit" : "plain"}
                />
              </div>
              {preview.principalAtRisk ? (
                <Notice tone="warning" className="mt-3">
                  At this projected revenue the harvest would not return 100% of principal. Members
                  will see this honestly in the calculator — set the plan accordingly.
                </Notice>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            disabled={busy || problems.length > 0}
            onClick={() => void submit()}
            className="pg-btn pg-btn--primary mt-5"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Create cycle as draft
          </button>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <p className="pg-kicker border-b border-hairline px-4 py-3">Publish & advance</p>
        {console_.cycles.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-hairline p-0">
            {console_.cycles.map((cycle) => (
              <li key={cycle.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[0.72rem] font-semibold text-ink-deep">
                      {cycle.code}
                    </p>
                    <p className="mt-0.5 font-display text-[0.88rem] font-semibold text-ink-deep">
                      {cycle.name}
                    </p>
                    <p className="fig mt-1 text-[0.7rem] text-ink-mute">
                      {money(cycle.raised)} of {money(cycle.targetCapital)} · {cycle.investorCount}{" "}
                      investor{cycle.investorCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip
                      status={
                        cycle.status === "settled"
                          ? "success"
                          : cycle.status === "draft"
                            ? "pending"
                            : "info"
                      }
                      label={CYCLE_STATUS_LABEL[cycle.status as CycleStatus] ?? cycle.status}
                    />
                    {!cycle.locked ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await publish({ data: { cycleId: cycle.id } });
                            onDone(
                              "success",
                              `${cycle.code} published. Its terms are now frozen and it is publicly visible.`,
                            );
                          } catch (error) {
                            onDone(
                              "error",
                              error instanceof Error ? error.message : "Unable to publish",
                            );
                          }
                        }}
                        className="pg-btn pg-btn--signal h-8 px-3 text-[0.72rem]"
                      >
                        <Lock size={12} aria-hidden="true" />
                        Publish &amp; freeze terms
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3">
                  <StageRail currentStage={cycle.currentStage} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="pg-kicker mr-1">Move to</span>
                  {[
                    { status: "open", stage: "funding_open", label: "Funding open" },
                    { status: "active", stage: "stocking", label: "Stocked" },
                    { status: "active", stage: "operational", label: "Operational" },
                    { status: "harvested", stage: "harvest_weighin", label: "Weighed in" },
                    { status: "harvested", stage: "sale_settlement", label: "Sold" },
                  ].map((option) => (
                    <button
                      key={`${option.status}-${option.stage}`}
                      type="button"
                      disabled={!cycle.locked}
                      onClick={async () => {
                        try {
                          await advance({
                            data: {
                              cycleId: cycle.id,
                              status: option.status as "open" | "funded" | "active" | "harvested",
                              stage: option.stage as
                                | "funding_open"
                                | "stocking"
                                | "operational"
                                | "harvest_weighin"
                                | "sale_settlement",
                            },
                          });
                          onDone("success", `${cycle.code} moved to ${option.label}.`);
                        } catch (error) {
                          onDone(
                            "error",
                            error instanceof Error ? error.message : "Unable to advance",
                          );
                        }
                      }}
                      className="rounded-full border border-hairline bg-white px-3 py-1 text-[0.7rem] font-semibold text-ink-soft transition-colors hover:border-signal hover:text-ink-deep disabled:opacity-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Layers size={18} />} title="No cycles to manage">
            Create the first cycle above.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="pg-label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[0.66rem] text-ink-mute">{hint}</span> : null}
    </label>
  );
}

/* -------------------------------------------------------------------------- *
 * Verification queue
 * -------------------------------------------------------------------------- */

function VerificationQueue({
  console_,
  onDone,
}: {
  console_: AdminConsole;
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const verify = useServerFn(verifyOfflineInvestment);
  const reject = useServerFn(rejectInvestment);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [references, setReferences] = useState<Record<string, string>>({});

  if (console_.pendingInvestments.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Banknote size={18} />} title="Nothing waiting for verification">
          When a member submits a bank transfer, it appears here with the teller reference they
          supplied. Only a verified row carries equity.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {console_.pendingInvestments.map((investment) => (
        <Card key={investment.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[0.9rem] font-semibold text-ink-deep">
                {investment.memberName}
              </p>
              <p className="fig mt-0.5 text-[0.7rem] text-ink-mute">
                {investment.cycleCode} · {dateLabel(investment.date)} · via {investment.method}
              </p>
              {investment.bankReference ? (
                <p className="mt-1 font-mono text-[0.7rem] text-ink-soft">
                  Teller ref: {investment.bankReference}
                </p>
              ) : null}
              {investment.paystackReference ? (
                <p className="mt-1 font-mono text-[0.7rem] text-ink-soft">
                  Paystack ref: {investment.paystackReference}
                </p>
              ) : null}
              {investment.note ? (
                <p className="mt-1 text-[0.72rem] text-ink-soft">“{investment.note}”</p>
              ) : null}
            </div>
            <div className="text-right">
              <Money value={investment.amount} className="text-[1.05rem] font-semibold" />
              <p className="mt-0.5 text-[0.66rem] text-ink-mute">
                {dateTimeLabel(investment.date)} · awaiting
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
            <label className="min-w-[14rem] flex-1">
              <span className="pg-label">Bank reference confirmed on the account</span>
              <input
                className="pg-input h-10"
                value={references[investment.id] ?? investment.bankReference ?? ""}
                onChange={(event) =>
                  setReferences((prev) => ({ ...prev, [investment.id]: event.target.value }))
                }
                placeholder="Confirmed teller / transfer reference"
              />
            </label>
            <button
              type="button"
              disabled={
                busyId === investment.id ||
                !(references[investment.id] ?? investment.bankReference ?? "").trim()
              }
              onClick={async () => {
                setBusyId(investment.id);
                try {
                  await verify({
                    data: {
                      investmentId: investment.id,
                      bankReference: (
                        references[investment.id] ??
                        investment.bankReference ??
                        ""
                      ).trim(),
                    },
                  });
                  onDone(
                    "success",
                    `Verified. ${investment.memberName}'s equity in ${investment.cycleCode} now appears in the live ledger.`,
                  );
                } catch (error) {
                  onDone(
                    "error",
                    error instanceof Error ? error.message : "Unable to verify that contribution",
                  );
                }
                setBusyId(null);
              }}
              className="pg-btn pg-btn--mint h-10"
            >
              {busyId === investment.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <BadgeCheck size={14} />
              )}
              Verify &amp; credit
            </button>
            <button
              type="button"
              disabled={busyId === investment.id}
              onClick={async () => {
                setBusyId(investment.id);
                try {
                  await reject({
                    data: {
                      investmentId: investment.id,
                      reason: "Transfer not found on the co-operative account.",
                    },
                  });
                  onDone("info", "Contribution declined. No equity was credited.");
                } catch (error) {
                  onDone("error", error instanceof Error ? error.message : "Unable to decline");
                }
                setBusyId(null);
              }}
              className="pg-btn pg-btn--ghost h-10"
            >
              Decline
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Log review
 * -------------------------------------------------------------------------- */

function AdminLogRow({
  log,
  onDone,
}: {
  log: AdminConsole["logsAwaitingReview"][number];
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const review = useServerFn(reviewOperationalLog);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[0.88rem] font-semibold capitalize text-ink-deep">
            {log.cycleCode} · {log.logType.replace(/_/g, " ")}
          </p>
          <p className="fig mt-0.5 text-[0.68rem] text-ink-mute">
            {dateLabel(log.logDate)} · filed {dateTimeLabel(log.createdAt)}
          </p>
          <ul className="fig mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-ink-soft">
            {log.feedKg !== null ? <li>Feed {number(log.feedKg, 1)} kg</li> : null}
            {log.feedBags !== null ? <li>{number(log.feedBags, 1)} bags</li> : null}
            {log.sampleAvgWeightG !== null ? (
              <li>Sample avg {number(log.sampleAvgWeightG, 0)} g</li>
            ) : null}
            {log.sampleCount !== null ? <li>{log.sampleCount} sampled</li> : null}
            {log.biomassKg !== null ? <li>Biomass {number(log.biomassKg, 1)} kg</li> : null}
            {log.mortalityCount !== null ? <li>Mortality {log.mortalityCount}</li> : null}
            {log.cratesCollected !== null ? <li>{number(log.cratesCollected, 0)} crates</li> : null}
            {log.bagsHarvested !== null ? <li>{number(log.bagsHarvested, 0)} bags</li> : null}
            {log.medication ? <li>{log.medication}</li> : null}
          </ul>
          {log.notes ? (
            <p className="mt-2 text-[0.74rem] leading-5 text-ink-soft">
              <strong>Internal note.</strong> {log.notes}
            </p>
          ) : null}
          {log.mortalityReason ? (
            <p className="mt-1 text-[0.74rem] leading-5 text-ink-soft">
              <strong>Mortality cause.</strong> {log.mortalityReason}
            </p>
          ) : null}
          <p className="mt-2 rounded-lg border border-hairline bg-porcelain px-3 py-2 text-[0.74rem] leading-5 text-ink-soft">
            <strong>Public line.</strong>{" "}
            {log.publicSummary ?? "— none supplied; the feed will show a generic milestone —"}
          </p>
        </div>
        <StatusChip status="pending" label="pending review" />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
        <label className="min-w-[14rem] flex-1">
          <span className="pg-label">Review note (sent back on a flag)</span>
          <input
            className="pg-input h-10"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. feed figure does not match the depot invoice"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await review({
                data: { logId: log.id, decision: "approved", note: note.trim() || undefined },
              });
              onDone("success", "Approved. The milestone is now live on the public feed.");
            } catch (error) {
              onDone("error", error instanceof Error ? error.message : "Unable to approve");
            }
            setBusy(false);
          }}
          className="pg-btn pg-btn--mint h-10"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Approve &amp; publish
        </button>
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await review({ data: { logId: log.id, decision: "flagged", note: note.trim() } });
              onDone("info", "Flagged. The operator sees your note and can refile the entry.");
            } catch (error) {
              onDone("error", error instanceof Error ? error.message : "Unable to flag");
            }
            setBusy(false);
          }}
          className="pg-btn pg-btn--ghost h-10"
        >
          Flag for correction
        </button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- *
 * Settlement engine
 * -------------------------------------------------------------------------- */

function SettlementEngine({
  console_,
  onDone,
}: {
  console_: AdminConsole;
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const loadBook = useServerFn(getCyclePositionBook);
  const loadLines = useServerFn(getSettlementLines);
  const sell = useServerFn(runSettlement);
  const recordSale = useServerFn(recordHarvestSale);
  const payLine = useServerFn(markPayoutPaid);
  const rollover = useServerFn(applyRollovers);

  const [cycleId, setCycleId] = useState("");
  const [grossRevenue, setGrossRevenue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState<
    { memberId: string; fullName: string; capital: number; equityPercent: number }[] | null
  >(null);
  const [lines, setLines] = useState<Awaited<ReturnType<typeof loadLines>>>([]);

  const cycle = console_.cycles.find((row) => row.id === cycleId);
  const settlement = console_.settlements.find((row) => row.cycleId === cycleId);
  const harvests = console_.harvestsAwaitingSale.filter((row) => row.cycleId === cycleId);

  const rules: CycleRules = settlement
    ? {
        investorSharePercent:
          settlement.investorProfitPool + settlement.operatorFee > 0
            ? (settlement.investorProfitPool /
                (settlement.investorProfitPool + settlement.operatorFee)) *
              100
            : DEFAULT_RULES.investorSharePercent,
        operatorSharePercent:
          settlement.investorProfitPool + settlement.operatorFee > 0
            ? (settlement.operatorFee / (settlement.investorProfitPool + settlement.operatorFee)) *
              100
            : DEFAULT_RULES.operatorSharePercent,
        reservePercent: DEFAULT_RULES.reservePercent,
      }
    : DEFAULT_RULES;

  const preview = runWaterfall({
    grossRevenue: Number(grossRevenue) || 0,
    capitalRaised: cycle?.raised ?? 0,
    operationalLiabilities: 0,
    rules,
  });

  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Harvest settlement engine"
        title="Run the waterfall and disburse"
        blurb="The settlement is computed inside the database, in strict priority order. It refuses to run twice for the same cycle, because a double payout is the one mistake this system must never make."
      />

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="pg-label">Cycle to settle</span>
            <select
              className="pg-input"
              value={cycleId}
              onChange={async (event) => {
                const next = event.target.value;
                setCycleId(next);
                setBook(null);
                if (!next) return;
                try {
                  const [positionBook, payoutLines] = await Promise.all([
                    loadBook({ data: { cycleId: next } }).catch(() => []),
                    loadLines({ data: { cycleId: next } }).catch(() => []),
                  ]);
                  setBook(positionBook);
                  setLines(payoutLines);
                } catch {
                  setBook([]);
                  setLines([]);
                }
              }}
            >
              <option value="">Select a cycle…</option>
              {console_.cycles
                .filter((row) => row.locked)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} · {row.name} · {money(row.raised)} raised
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="pg-label">Gross harvest revenue banked (₦)</span>
            <input
              className="pg-input"
              inputMode="decimal"
              value={grossRevenue}
              onChange={(event) => setGrossRevenue(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 4200000"
            />
          </label>
          <label className="block">
            <span className="pg-label">Settlement note (recorded on the run)</span>
            <input
              className="pg-input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Harvest of 7 Oct, Sokoto Frozen Foods"
            />
          </label>
        </div>

        {cycle ? (
          <div className="mt-5 rounded-xl border border-hairline bg-porcelain p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="pg-kicker">Preview — strict four-level waterfall</p>
              <span className="text-[0.7rem] text-ink-mute">
                Capital raised <span className="fig">{money(cycle.raised)}</span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Figure label="Level 1 · liabilities" value={money(preview.liabilitiesPaid)} />
              <Figure label="Level 2 · principal" value={money(preview.principalReturned)} />
              <Figure label="Level 3 · reserve" value={money(preview.reserveSetAside)} />
              <Figure
                label="Level 4 · net profit"
                value={money(preview.netProfit)}
                tone={preview.netProfit > 0 ? "credit" : "plain"}
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-hairline bg-white p-3">
                <p className="pg-kicker">To members</p>
                <p className="fig mt-1 text-[0.95rem] font-semibold text-mint-deep">
                  {money(preview.investorProfitPool)}
                </p>
              </div>
              <div className="rounded-lg border border-hairline bg-white p-3">
                <p className="pg-kicker">Farm caretaker fee</p>
                <p className="fig mt-1 text-[0.95rem] font-semibold text-ink-deep">
                  {money(preview.operatorFee)}
                </p>
              </div>
            </div>
            {preview.principalAtRisk ? (
              <Notice tone="warning" className="mt-3">
                This revenue would not return 100% of principal. The run will report the shortfall
                openly on every member&apos;s statement rather than hiding it.
              </Notice>
            ) : null}
          </div>
        ) : null}

        {harvests.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="pg-kicker">Weigh-ins awaiting a recorded sale</p>
            {harvests.map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-white p-3"
              >
                <div>
                  <p className="fig text-[0.78rem] font-semibold text-ink-deep">
                    {record.totalWeightKg === null
                      ? "weight not recorded"
                      : `${number(record.totalWeightKg, 1)} kg`}{" "}
                    · {dateLabel(record.harvestDate)}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                    {record.scaleTicketRef ? `Ticket ${record.scaleTicketRef}` : "No scale ticket"}
                    {record.buyer ? ` · ${record.buyer}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !Number(grossRevenue)}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await recordSale({
                        data: {
                          harvestId: record.id,
                          grossRevenue: Number(grossRevenue),
                          revenueReceivedOn: new Date().toISOString().slice(0, 10),
                          buyer: record.buyer ?? undefined,
                        },
                      });
                      onDone("success", "Sale recorded against the weigh-in.");
                    } catch (error) {
                      onDone(
                        "error",
                        error instanceof Error ? error.message : "Unable to record the sale",
                      );
                    }
                    setBusy(false);
                  }}
                  className="pg-btn pg-btn--ghost h-9 px-3 text-[0.72rem]"
                >
                  Record sale at the figure above
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          disabled={busy || !cycleId || !Number(grossRevenue) || Boolean(settlement)}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await sell({
                data: { cycleId, grossRevenue: Number(grossRevenue), note: note || undefined },
              });
              onDone(
                "success",
                `Settlement executed. Net profit ${money(result.netProfit)} was split and every member's line recorded.`,
              );
            } catch (error) {
              onDone(
                "error",
                error instanceof Error ? error.message : "The settlement could not be run",
              );
            }
            setBusy(false);
          }}
          className="pg-btn pg-btn--primary mt-5"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Scale size={15} />}
          {settlement ? "Already settled" : "Run the waterfall now"}
        </button>
        <p className="mt-2 text-[0.68rem] text-ink-mute">
          This computes and records every member&apos;s payout line. It does not move money — mark
          each line as paid below once the transfer is made.
        </p>
      </Card>

      {book && book.length > 0 ? (
        <Card className="overflow-hidden">
          <p className="pg-kicker border-b border-hairline px-4 py-3">
            Contribution book · live equity per member
          </p>
          <div className="table-scroll">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="num">Verified capital</th>
                  <th className="num">Equity %</th>
                  <th className="num">Level 2 principal</th>
                  <th className="num">Level 4 profit share</th>
                </tr>
              </thead>
              <tbody>
                {book.map((row) => (
                  <tr key={row.memberId}>
                    <td className="font-medium text-ink-deep">{row.fullName}</td>
                    <td className="num">
                      <Money value={row.capital} />
                    </td>
                    <td className="num fig text-signal-deep">{percent(row.equityPercent, 4)}</td>
                    <td className="num fig">
                      {money((row.equityPercent / 100) * preview.principalReturned)}
                    </td>
                    <td className="num fig">
                      {money((row.equityPercent / 100) * preview.investorProfitPool)}
                    </td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="num fig">
                    {money(book.reduce((sum, row) => sum + row.capital, 0))}
                  </td>
                  <td className="num fig">100.0000%</td>
                  <td className="num fig">{money(preview.principalReturned)}</td>
                  <td className="num fig">{money(preview.investorProfitPool)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {settlement ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="pg-kicker">Executed settlement · {settlement.cycleCode}</p>
              <p className="mt-1 font-display text-[1rem] font-semibold text-ink-deep">
                {dateTimeLabel(settlement.executedAt)}
              </p>
            </div>
            <StatusChip
              status={settlement.principalAtRisk ? "failed" : "success"}
              label={
                settlement.principalAtRisk
                  ? "principal part-returned"
                  : "principal returned in full"
              }
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <WaterfallLadder
              rules={rules}
              amounts={[
                {
                  level: 1,
                  amount: settlement.grossRevenue > 0 ? settlement.principalReturned * 0 : 0,
                },
                { level: 2, amount: settlement.principalReturned },
                { level: 3, amount: settlement.reserveSetAside },
                { level: 4, amount: settlement.netProfit },
              ]}
              compact
            />
            <div className="space-y-3">
              <div className="rounded-xl border border-hairline bg-porcelain p-4">
                <p className="pg-kicker">Distribution</p>
                <dl className="mt-2 space-y-1.5">
                  <Row label="Gross revenue" value={settlement.grossRevenue} />
                  <Row label="Principal returned" value={settlement.principalReturned} />
                  <Row label="Reserve held in escrow" value={settlement.reserveSetAside} />
                  <Row label="Net profit" value={settlement.netProfit} />
                  <Row label="To members (pro-rata)" value={settlement.investorProfitPool} />
                  <Row label="Farm caretaker fee" value={settlement.operatorFee} />
                </dl>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const destination = console_.cycles.find(
                    (row) =>
                      row.id !== cycleId && (row.status === "open" || row.status === "funded"),
                  );
                  if (!destination) {
                    onDone("info", "No open cycle to roll into yet.");
                    return;
                  }
                  setBusy(true);
                  try {
                    const result = await rollover({
                      data: { sourceCycleId: cycleId, destinationCycleId: destination.id },
                    });
                    onDone(
                      "success",
                      result.moved > 0
                        ? `Rolled ${result.moved} member payout${result.moved === 1 ? "" : "s"} into ${result.destination}.`
                        : "No member had a reinvestment instruction for that cycle.",
                    );
                  } catch (error) {
                    onDone(
                      "error",
                      error instanceof Error ? error.message : "Unable to apply rollovers",
                    );
                  }
                  setBusy(false);
                }}
                className="pg-btn pg-btn--ghost w-full"
              >
                <Repeat size={15} aria-hidden="true" />
                Apply member rollover instructions
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {lines.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <p className="pg-kicker">Payout register — mark each line as paid</p>
            <span className="text-[0.7rem] text-ink-mute">
              <span className="fig font-semibold text-ink-soft">
                {money(lines.reduce((sum, line) => sum + line.total, 0))}
              </span>{" "}
              across {lines.length} member{lines.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="table-scroll">
            <table className="pg-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="num">Capital</th>
                  <th className="num">Equity %</th>
                  <th className="num">Level 2 principal</th>
                  <th className="num">Level 4 profit</th>
                  <th className="num">Total due</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <PayoutRow key={line.id} line={line} payLine={payLine} onDone={onDone} />
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="num fig">
                    {money(lines.reduce((sum, line) => sum + line.capital, 0))}
                  </td>
                  <td className="num fig">100.0000%</td>
                  <td className="num fig">
                    {money(lines.reduce((sum, line) => sum + line.principal, 0))}
                  </td>
                  <td className="num fig">
                    {money(lines.reduce((sum, line) => sum + line.profit, 0))}
                  </td>
                  <td className="num fig">
                    {money(lines.reduce((sum, line) => sum + line.total, 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-hairline bg-porcelain px-4 py-2 text-[0.68rem] text-ink-mute">
            Lines are written by the settlement run; this register confirms each transfer went out.
            Members see the same figures on their own statement.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[0.74rem] text-ink-soft">{label}</dt>
      <dd className="fig text-[0.76rem] font-semibold text-ink-deep">{money(value)}</dd>
    </div>
  );
}

function PayoutRow({
  line,
  onDone,
  payLine,
}: {
  line: {
    id: string;
    memberName: string;
    capital: number;
    equityPercent: number;
    principal: number;
    profit: number;
    total: number;
    payoutStatus: string;
    payoutReference: string | null;
    paidAt: string | null;
  };
  onDone: (tone: "success" | "error" | "info", text: string) => void;
  payLine: (args: { data: { lineId: string; payoutReference: string } }) => Promise<unknown>;
}) {
  const [reference, setReference] = useState(line.payoutReference ?? "");
  const [busy, setBusy] = useState(false);
  const paid = line.payoutStatus === "paid";

  return (
    <tr>
      <td className="font-medium text-ink-deep">{line.memberName}</td>
      <td className="num">
        <Money value={line.capital} />
      </td>
      <td className="num fig">{percent(line.equityPercent, 4)}</td>
      <td className="num fig">{money(line.principal)}</td>
      <td className="num fig">{money(line.profit)}</td>
      <td className="num font-semibold">
        <Money value={line.total} />
      </td>
      <td>
        {paid ? (
          <div>
            <StatusChip status="success" label="paid" />
            {line.payoutReference ? (
              <span className="mt-1 block font-mono text-[0.62rem] text-ink-mute">
                {line.payoutReference}
              </span>
            ) : null}
            {line.paidAt ? (
              <span className="mt-0.5 block text-[0.62rem] text-ink-mute">
                {dateLabel(line.paidAt)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              className="pg-input h-8 w-32 text-[0.72rem]"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Transfer ref"
              aria-label={`Payout reference for ${line.memberName}`}
            />
            <button
              type="button"
              disabled={busy || !reference.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await payLine({
                    data: { lineId: line.id, payoutReference: reference.trim() },
                  });
                  onDone("success", `${line.memberName}'s payout marked as paid.`);
                } catch (error) {
                  onDone(
                    "error",
                    error instanceof Error ? error.message : "Unable to mark as paid",
                  );
                }
                setBusy(false);
              }}
              className="pg-btn pg-btn--ghost h-8 px-2.5 text-[0.7rem]"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : "Mark paid"}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- *
 * Members
 * -------------------------------------------------------------------------- */

function MemberRow({
  member,
  onDone,
}: {
  member: AdminConsole["members"][number];
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const setRole = useServerFn(setMemberRole);
  const [busy, setBusy] = useState(false);

  return (
    <tr>
      <td className="font-medium text-ink-deep">{member.fullName}</td>
      <td>
        <StatusChip
          status={
            member.role === "admin" ? "failed" : member.role === "operator" ? "info" : "success"
          }
          label={ROLE_LABEL[member.role]}
        />
      </td>
      <td className="num">
        <Money value={member.verifiedCapital} />
      </td>
      <td className="num fig">{member.cycles}</td>
      <td className="fig text-[0.72rem]">{dateLabel(member.joinedAt)}</td>
      <td>
        <select
          className="pg-input h-8 w-40 text-[0.72rem]"
          value={member.role}
          disabled={busy}
          onChange={async (event) => {
            setBusy(true);
            try {
              await setRole({
                data: {
                  userId: member.userId,
                  role: event.target.value as "admin" | "operator" | "member",
                },
              });
              onDone(
                "success",
                `${member.fullName} is now ${ROLE_LABEL[event.target.value as "admin"].toLowerCase()}.`,
              );
            } catch (error) {
              onDone("error", error instanceof Error ? error.message : "Unable to change role");
            }
            setBusy(false);
          }}
        >
          <option value="member">Investor / Member</option>
          <option value="operator">Farm Operator</option>
          <option value="admin">Admin &amp; Treasury</option>
        </select>
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- *
 * Board & register
 * -------------------------------------------------------------------------- */

function BoardAndRegister({
  console_,
  onDone,
}: {
  console_: AdminConsole;
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const settle = useServerFn(settleShareTransfer);
  const decide = useServerFn(decideFarmVisit);
  const incident = useServerFn(resolveIncident);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader
          kicker="Secondary co-op share transfer"
          title="Settle a transfer once the buyer has actually paid"
          blurb="Settling credits the buyer with a verified investment row and offsets the seller's capital by the same amount. The cycle's total is unchanged — a transfer moves ownership, not money."
        />
        <Card className="mt-4 overflow-hidden">
          {console_.transfers.length > 0 ? (
            <div className="table-scroll">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th className="num">Par value</th>
                    <th className="num">Asking price</th>
                    <th>Status</th>
                    <th>Offered</th>
                    <th>Settle</th>
                  </tr>
                </thead>
                <tbody>
                  {console_.transfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td className="font-mono text-[0.72rem] font-semibold text-ink-deep">
                        {transfer.cycleCode}
                      </td>
                      <td className="num">
                        <Money value={transfer.capitalAmount} />
                      </td>
                      <td className="num">
                        <Money value={transfer.askingPrice} />
                      </td>
                      <td>
                        <StatusChip
                          status={
                            transfer.status === "settled"
                              ? "success"
                              : transfer.status === "claimed"
                                ? "info"
                                : "pending"
                          }
                          label={transfer.status}
                        />
                      </td>
                      <td className="fig text-[0.72rem]">{dateLabel(transfer.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          disabled={busy || transfer.status !== "claimed"}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await settle({ data: { transferId: transfer.id } });
                              onDone(
                                "success",
                                "Transfer settled. Equity has moved in the ledger.",
                              );
                            } catch (error) {
                              onDone(
                                "error",
                                error instanceof Error ? error.message : "Unable to settle",
                              );
                            }
                            setBusy(false);
                          }}
                          className="pg-btn pg-btn--ghost h-8 px-2.5 text-[0.7rem]"
                        >
                          Settle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Coins size={18} />} title="No offers on the board">
              Members can offer their verified equity at par from the investor portal.
            </EmptyState>
          )}
        </Card>
      </div>

      <div>
        <SectionHeader
          kicker="Farm visit requests"
          title="Confirm what the farm can genuinely host"
          blurb="A confirmed visit is a promise. Decline with a reason rather than letting a request sit."
        />
        <Card className="mt-4 overflow-hidden">
          {console_.visits.length > 0 ? (
            <div className="table-scroll">
              <table className="pg-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Slot</th>
                    <th>Cycle</th>
                    <th className="num">Guests</th>
                    <th>Request</th>
                    <th>Status</th>
                    <th>Decide</th>
                  </tr>
                </thead>
                <tbody>
                  {console_.visits.map((visit) => (
                    <tr key={visit.id}>
                      <td className="fig whitespace-nowrap">{dateLabel(visit.visitDate)}</td>
                      <td>{visit.slot}</td>
                      <td className="font-mono text-[0.72rem]">{visit.cycleCode ?? "General"}</td>
                      <td className="num fig">{visit.guests}</td>
                      <td className="max-w-xs text-ink-mute">{visit.memberNote ?? "—"}</td>
                      <td>
                        <StatusChip
                          status={
                            visit.status === "confirmed" || visit.status === "completed"
                              ? "success"
                              : visit.status === "declined" || visit.status === "cancelled"
                                ? "failed"
                                : "pending"
                          }
                          label={visit.status}
                        />
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          {(["confirmed", "declined", "completed"] as const).map((decision) => (
                            <button
                              key={decision}
                              type="button"
                              disabled={busy || visit.status === decision}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await decide({ data: { visitId: visit.id, decision } });
                                  onDone("success", `Visit ${decision}.`);
                                } catch (error) {
                                  onDone(
                                    "error",
                                    error instanceof Error ? error.message : "Unable to decide",
                                  );
                                }
                                setBusy(false);
                              }}
                              className="rounded-full border border-hairline bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-ink-soft hover:border-signal disabled:opacity-40"
                            >
                              {decision}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<CalendarCheck size={18} />} title="No visit requests">
              Verified investors can request inspections from the investor portal.
            </EmptyState>
          )}
        </Card>
      </div>

      <div>
        <SectionHeader
          kicker="Incident & insurance register"
          title="Resolve outstanding incidents in public"
          blurb="Operators log incidents; only an admin can move them to resolved and attach the resolution note that members will read."
          action={
            <span className="pg-chip pg-chip--amber">{console_.kpis.openIncidents} open</span>
          }
        />
        <div className="mt-4 space-y-3">
          {console_.incidents.length > 0 ? (
            console_.incidents.map((incident) => (
              <IncidentAdminRow
                key={incident.id}
                incident={incident}
                onDone={onDone}
                resolveFn={resolveIncident}
              />
            ))
          ) : (
            <Card>
              <EmptyState icon={<ShieldAlert size={18} />} title="Nothing on the register">
                A clear register is good news — it means no member is being kept in the dark.
              </EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function IncidentAdminRow({
  incident,
  onDone,
  resolveFn,
}: {
  incident: AdminConsole["incidents"][number];
  onDone: (tone: "success" | "error" | "info", text: string) => void;
  resolveFn: (args: {
    data: {
      incidentId: string;
      status: "open" | "mitigating" | "resolved";
      resolutionNote?: string;
      insuranceClaimRef?: string;
    };
  }) => Promise<unknown>;
}) {
  const [note, setNote] = useState(incident.resolutionNote ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[0.9rem] font-semibold text-ink-deep">{incident.title}</p>
          <p className="fig mt-0.5 text-[0.68rem] text-ink-mute">
            {incident.category} · {incident.cycleCode ?? "General"} ·{" "}
            {dateLabel(incident.occurredOn)}
            {incident.estimatedImpact !== null
              ? ` · est. impact ${money(incident.estimatedImpact)}`
              : ""}
          </p>
          <p className="mt-1.5 text-[0.78rem] leading-6 text-ink-soft">{incident.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusChip
            status={incident.status === "resolved" ? "success" : "pending"}
            label={incident.status}
          />
          <span
            className={cn(
              "pg-chip",
              incident.severity === "critical" || incident.severity === "serious"
                ? "pg-chip--rose"
                : "pg-chip--amber",
            )}
          >
            {incident.severity}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-hairline pt-3">
        <label className="min-w-[16rem] flex-1">
          <span className="pg-label">Resolution note (published to members)</span>
          <input
            className="pg-input h-10"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What was done, what it cost, and what changed to prevent a repeat"
          />
        </label>
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await resolveFn({
                data: {
                  incidentId: incident.id,
                  status: "resolved",
                  resolutionNote: note.trim(),
                  ...(incident.insuranceClaimRef
                    ? { insuranceClaimRef: incident.insuranceClaimRef }
                    : {}),
                },
              });
              onDone("success", "Incident resolved and published.");
            } catch (error) {
              onDone("error", error instanceof Error ? error.message : "Unable to resolve");
            }
            setBusy(false);
          }}
          className="pg-btn pg-btn--mint h-10"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Mark resolved
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await resolveFn({
                data: {
                  incidentId: incident.id,
                  status: "mitigating",
                  ...(note.trim() ? { resolutionNote: note.trim() } : {}),
                  ...(incident.insuranceClaimRef
                    ? { insuranceClaimRef: incident.insuranceClaimRef }
                    : {}),
                },
              });
              onDone("info", "Incident marked as being mitigated.");
            } catch (error) {
              onDone("error", error instanceof Error ? error.message : "Unable to update");
            }
            setBusy(false);
          }}
          className="pg-btn pg-btn--ghost h-10"
        >
          Mitigating
        </button>
      </div>
    </Card>
  );
}
