import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Activity,
  Baby,
  Bird,
  CalendarDays,
  CloudRain,
  Coins,
  Droplets,
  Flame,
  Leaf,
  Loader2,
  Pill,
  Receipt,
  Scale,
  ShieldAlert,
  Skull,
  Wheat,
} from "lucide-react";

import { Card, EmptyState, Figure, Notice, StatusChip } from "@/components/ndh/ledger-ui";
import { COMMODITIES } from "@/lib/agri/commodities";
import { dateLabel, dateTimeLabel, money, number } from "@/lib/agri/format";
import {
  fileFarmExpense,
  fileHarvestWeighIn,
  fileOperationalLog,
  getOperatorWorkspace,
  logIncident,
  logWeatherSnapshot,
  type OperatorWorkspace,
} from "@/lib/agri.ops.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/operator")({
  component: OperatorPortal,
});

type QuickAction =
  | "feed"
  | "growth"
  | "mortality"
  | "medication"
  | "crates"
  | "expense"
  | "harvest"
  | "incident"
  | "weather";

const ACTIONS: {
  id: QuickAction;
  label: string;
  hint: string;
  icon: typeof Flame;
  tone: string;
}[] = [
  { id: "feed", label: "Feed", hint: "Bags or kilos given out", icon: Flame, tone: "tone-cyan" },
  { id: "growth", label: "Sample weight", hint: "10 fish sampled: 450 g avg", icon: Scale, tone: "tone-emerald" },
  { id: "mortality", label: "Mortality", hint: "Count and cause", icon: Skull, tone: "tone-rose" },
  { id: "medication", label: "Medication", hint: "What was administered", icon: Pill, tone: "tone-violet" },
  { id: "crates", label: "Eggs / yield", hint: "Crates or bags collected", icon: Bird, tone: "tone-amber" },
  { id: "expense", label: "Expense", hint: "Direct spend with receipt", icon: Receipt, tone: "tone-sky" },
  { id: "harvest", label: "Weigh-in", hint: "Total harvest weight", icon: Baby, tone: "tone-emerald" },
  { id: "incident", label: "Incident", hint: "Flood, outage, breakdown", icon: ShieldAlert, tone: "tone-rose" },
  { id: "weather", label: "Weather", hint: "Rain, temperature, humidity", icon: CloudRain, tone: "tone-cyan" },
];

function OperatorPortal() {
  const load = useServerFn(getOperatorWorkspace);
  const [workspace, setWorkspace] = useState<OperatorWorkspace | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<QuickAction>("feed");
  const [cycleId, setCycleId] = useState("");
  const [flash, setFlash] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  async function refresh() {
    try {
      const data = await load();
      setWorkspace(data);
      setCycleId((current) => current || data.cycles.find((c) => c.status === "active")?.id || data.cycles[0]?.id || "");
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
        <EmptyState icon={<ShieldAlert size={18} />} title="The farm console did not load">
          Your role may not include farm operations, or the page hit a temporary error. Refresh to
          try again.
        </EmptyState>
      </Card>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center gap-2 py-16 text-ink-mute">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="fig text-[0.8rem]">Opening the farm console…</span>
      </div>
    );
  }

  const activeCycle = workspace.cycles.find((cycle) => cycle.id === cycleId);
  const commodity = COMMODITIES.find((item) => item.id === activeCycle?.commodity);

  return (
    <div className="space-y-6">
      <div className="border-b border-hairline pb-5">
        <p className="pg-kicker">Farm operator portal</p>
        <h1 className="mt-1.5 text-[1.6rem] leading-tight text-ink-deep md:text-[1.9rem]">
          Daily quick-log
        </h1>
        <p className="mt-1.5 max-w-2xl text-[0.83rem] leading-6 text-ink-soft">
          Built for one hand and bright sunlight: pick the cycle, tap what happened, save. You can
          file logs and expenses — you cannot verify a payment, touch equity or run a settlement.
        </p>
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

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <Figure
            label="Logged today"
            value={number(workspace.totals.loggedToday)}
            caption="Entries filed"
            tone={workspace.totals.loggedToday > 0 ? "credit" : "plain"}
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Awaiting review"
            value={number(workspace.awaitingReview)}
            caption="Admin approval queue"
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Feed this cycle"
            value={`${number(workspace.totals.feedKgThisCycle, 1)} kg`}
            caption={commodity ? commodity.feedUnit : "Across approved logs"}
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Mortality this cycle"
            value={number(workspace.totals.mortalityThisCycle)}
            caption="Reason logged each time"
          />
        </Card>
      </dl>

      <Card className="p-5">
        <label className="block max-w-md">
          <span className="pg-label">Which cycle are you standing in?</span>
          <select
            className="pg-input h-12 text-[0.95rem]"
            value={cycleId}
            onChange={(event) => setCycleId(event.target.value)}
          >
            {workspace.cycles.map((cycle) => {
              const item = COMMODITIES.find((entry) => entry.id === cycle.commodity);
              return (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.code} · {item?.name ?? cycle.commodity} · {cycle.status}
                </option>
              );
            })}
          </select>
        </label>

        {activeCycle ? (
          <p className="mt-2 text-[0.72rem] text-ink-mute">
            {activeCycle.name} · {activeCycle.currentStage.replace(/_/g, " ")} ·{" "}
            {activeCycle.rulesChip}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const isActive = active === action.id;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => setActive(action.id)}
                aria-pressed={isActive}
                className={cn(
                  "flex min-h-[5.5rem] flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-all",
                  isActive
                    ? "border-signal bg-cyan-50 shadow-[var(--shadow-soft)]"
                    : "border-hairline bg-white hover:border-hairline-strong",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl",
                    isActive ? "bg-navy text-signal" : "bg-porcelain text-ink-soft",
                  )}
                >
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span>
                  <strong className="block font-display text-[0.85rem] font-semibold text-ink-deep">
                    {action.label}
                  </strong>
                  <span className="mt-0.5 block text-[0.68rem] leading-4 text-ink-mute">
                    {action.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {cycleId ? (
        <QuickLogForm
          key={active}
          action={active}
          cycleId={cycleId}
          feedUnit={commodity?.feedUnit ?? "kg"}
          growthUnit={commodity?.growthUnit ?? "g"}
          onDone={(tone, text) => {
            setFlash({ tone, text });
            void refresh();
          }}
        />
      ) : (
        <Notice tone="warning">
          No cycle is available to log against yet. A cycle must be published before its field
          records can be filed.
        </Notice>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <p className="pg-kicker border-b border-hairline px-4 py-3">Recent entries</p>
          {workspace.recentLogs.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-hairline p-0">
              {workspace.recentLogs.slice(0, 12).map((log) => (
                <li key={log.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[0.8rem] font-semibold capitalize text-ink-deep">
                      {log.cycleCode} · {log.logType.replace(/_/g, " ")}
                    </p>
                    <p className="fig mt-0.5 text-[0.68rem] text-ink-mute">
                      {dateLabel(log.logDate)}
                      {log.feedKg !== null ? ` · ${number(log.feedKg, 1)} kg feed` : ""}
                      {log.feedBags !== null ? ` · ${number(log.feedBags, 1)} bags` : ""}
                      {log.sampleAvgWeightG !== null
                        ? ` · sample ${number(log.sampleAvgWeightG, 0)} g`
                        : ""}
                      {log.mortalityCount !== null ? ` · ${log.mortalityCount} dead` : ""}
                      {log.cratesCollected !== null
                        ? ` · ${number(log.cratesCollected, 0)} crates`
                        : ""}
                      {log.bagsHarvested !== null
                        ? ` · ${number(log.bagsHarvested, 0)} bags`
                        : ""}
                    </p>
                    {log.notes ? (
                      <p className="mt-1 text-[0.72rem] leading-5 text-ink-soft">{log.notes}</p>
                    ) : null}
                    {log.reviewerNote ? (
                      <p className="mt-1 text-[0.7rem] leading-5 text-amber-700">
                        Admin: {log.reviewerNote}
                      </p>
                    ) : null}
                  </div>
                  <StatusChip
                    status={log.reviewStatus === "approved" ? "success" : log.reviewStatus === "flagged" ? "failed" : "pending"}
                    label={log.reviewStatus}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Activity size={18} />} title="No entries filed yet">
              Your first quick-log will appear here, and on the public transparency feed once an
              admin approves it.
            </EmptyState>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <p className="pg-kicker border-b border-hairline px-4 py-3">Expenses recorded</p>
            {workspace.expenses.length > 0 ? (
              <ul className="m-0 list-none divide-y divide-hairline p-0">
                {workspace.expenses.slice(0, 8).map((expense) => (
                  <li key={expense.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[0.78rem] font-semibold text-ink-deep">
                        {expense.category}
                        {expense.vendor ? ` · ${expense.vendor}` : ""}
                      </p>
                      <p className="fig mt-0.5 text-[0.68rem] text-ink-mute">
                        {expense.cycleCode} · {dateLabel(expense.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="fig text-[0.8rem] font-semibold text-ink-deep">
                        {money(expense.amount)}
                      </p>
                      {expense.isPayable ? (
                        <span className="pg-chip pg-chip--amber mt-1">
                          <Coins size={10} aria-hidden="true" />
                          payable
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Receipt size={18} />} title="No expenses recorded">
                Log direct farm spend here with the category and vendor so Level 1 of the waterfall
                can settle it at harvest.
              </EmptyState>
            )}
          </Card>

          <Card className="overflow-hidden">
            <p className="pg-kicker border-b border-hairline px-4 py-3">Incident register</p>
            {workspace.incidents.length > 0 ? (
              <ul className="m-0 list-none divide-y divide-hairline p-0">
                {workspace.incidents.slice(0, 6).map((incident) => (
                  <li key={incident.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[0.8rem] font-semibold text-ink-deep">{incident.title}</p>
                      <span
                        className={cn(
                          "pg-chip",
                          incident.status === "resolved"
                            ? "pg-chip--mint"
                            : incident.severity === "critical" || incident.severity === "serious"
                              ? "pg-chip--rose"
                              : "pg-chip--amber",
                        )}
                      >
                        {incident.status} · {incident.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.72rem] leading-5 text-ink-soft">
                      {incident.description}
                    </p>
                    <p className="fig mt-1 text-[0.66rem] text-ink-mute">
                      {incident.cycleCode ?? "General"} · {dateLabel(incident.occurredOn)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ShieldAlert size={18} />} title="Nothing on the register">
                Log flooding, power cuts, disease or equipment failure here — the register is
                published openly, so members hear it from the farm first.
              </EmptyState>
            )}
          </Card>

          <Card className="p-4">
            <p className="pg-kicker">Today&apos;s entries</p>
            {workspace.todayLogs.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {workspace.todayLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-2 rounded-xl border border-mint/30 bg-mint-soft px-3 py-2 text-[0.74rem] text-mint-deep"
                  >
                    <CalendarDays size={13} aria-hidden="true" />
                    <span className="capitalize">{log.logType.replace(/_/g, " ")}</span>
                    <span className="fig ml-auto text-[0.66rem] opacity-80">
                      {dateTimeLabel(log.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.76rem] leading-5 text-ink-mute">
                Nothing filed today yet. The daily log is the farm&apos;s heartbeat — investors see
                approved entries live on the transparency feed.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * The quick-log form
 * -------------------------------------------------------------------------- */

function QuickLogForm({
  action,
  cycleId,
  feedUnit,
  growthUnit,
  onDone,
}: {
  action: QuickAction;
  cycleId: string;
  feedUnit: string;
  growthUnit: string;
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const log = useServerFn(fileOperationalLog);
  const expense = useServerFn(fileFarmExpense);
  const harvest = useServerFn(fileHarvestWeighIn);
  const incident = useServerFn(logIncident);
  const weather = useServerFn(logWeatherSnapshot);

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const value = (key: string) => form[key] ?? "";
  const set = (key: string, next: string) => setForm((prev) => ({ ...prev, [key]: next }));
  const num = (key: string) => (value(key) ? Number(value(key)) : undefined);

  const description = ACTIONS.find((item) => item.id === action);
  const Icon = description?.icon ?? Activity;

  async function submit() {
    setBusy(true);
    try {
      const publicSummary = value("publicSummary").trim() || undefined;

      if (action === "expense") {
        await expense({
          data: {
            cycleId,
            amount: Number(value("amount")),
            category: value("category") || "Operational",
            vendor: value("vendor") || undefined,
            note: value("note") || undefined,
            isPayable: value("isPayable") === "yes",
            receiptUrl: value("receiptUrl") || undefined,
          },
        });
      } else if (action === "harvest") {
        await harvest({
          data: {
            cycleId,
            totalWeightKg: Number(value("totalWeightKg")),
            totalCount: num("totalCount"),
            scaleTicketRef: value("scaleTicketRef") || undefined,
            buyer: value("buyer") || undefined,
            buyerNote: value("buyerNote") || undefined,
          },
        });
      } else if (action === "incident") {
        await incident({
          data: {
            cycleId,
            title: value("title"),
            category: value("category") || "Operational",
            severity: (value("severity") || "low") as "low" | "moderate" | "serious" | "critical",
            description: value("description"),
            estimatedImpact: num("estimatedImpact"),
            insuranceClaimRef: value("insuranceClaimRef") || undefined,
          },
        });
      } else if (action === "weather") {
        await weather({
          data: {
            cycleId,
            rainfallMm: num("rainfallMm"),
            tempMinC: num("tempMinC"),
            tempMaxC: num("tempMaxC"),
            humidityPercent: num("humidityPercent"),
            note: value("note") || undefined,
          },
        });
      } else if (action === "feed") {
        await log({
          data: {
            cycleId,
            logType: "feed",
            feedKg: num("feedKg"),
            feedBags: num("feedBags"),
            notes: value("notes") || undefined,
            publicSummary,
          },
        });
      } else if (action === "growth") {
        await log({
          data: {
            cycleId,
            logType: "growth_sample",
            sampleCount: num("sampleCount"),
            sampleAvgWeightG: num("sampleAvgWeightG"),
            biomassKg: num("biomassKg"),
            populationCount: num("populationCount"),
            notes: value("notes") || undefined,
            publicSummary,
          },
        });
      } else if (action === "mortality") {
        await log({
          data: {
            cycleId,
            logType: "mortality",
            mortalityCount: num("mortalityCount"),
            mortalityReason: value("mortalityReason") || undefined,
            populationCount: num("populationCount"),
            notes: value("notes") || undefined,
            publicSummary,
          },
        });
      } else if (action === "medication") {
        await log({
          data: {
            cycleId,
            logType: "medication",
            medication: value("medication"),
            notes: value("notes") || undefined,
            publicSummary,
          },
        });
      } else {
        await log({
          data: {
            cycleId,
            logType: "general",
            cratesCollected: num("cratesCollected"),
            bagsHarvested: num("bagsHarvested"),
            areaSqm: num("areaSqm"),
            notes: value("notes") || undefined,
            publicSummary,
          },
        });
      }

      setForm({});
      onDone(
        "success",
        action === "incident"
          ? "Incident published to the register. Members can see it immediately."
          : "Entry filed. It is pending admin review before it appears publicly.",
      );
    } catch (error) {
      onDone("error", error instanceof Error ? error.message : "That entry could not be saved");
    }
    setBusy(false);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 border-b border-hairline pb-4">
        <span className="grid size-10 place-items-center rounded-xl bg-navy text-signal">
          <Icon size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="pg-kicker">Quick log</p>
          <h2 className="mt-0.5 font-display text-[1.1rem] font-semibold text-ink-deep">
            {description?.label}
          </h2>
          <p className="text-[0.72rem] text-ink-mute">{description?.hint}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {action === "feed" ? (
          <>
            <Field label={`Feed given (kg)`} hint={`Logged against ${feedUnit}`}>
              <input
                className="pg-input h-12 text-[0.95rem]"
                inputMode="decimal"
                value={value("feedKg")}
                onChange={(event) => set("feedKg", event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 24.5"
              />
            </Field>
            <Field label="Or in bags">
              <input
                className="pg-input h-12 text-[0.95rem]"
                inputMode="decimal"
                value={value("feedBags")}
                onChange={(event) => set("feedBags", event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 2"
              />
            </Field>
          </>
        ) : null}

        {action === "growth" ? (
          <>
            <Field label="Fish / birds sampled">
              <input
                className="pg-input h-12"
                inputMode="numeric"
                value={value("sampleCount")}
                onChange={(event) => set("sampleCount", event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 10"
              />
            </Field>
            <Field label={`Average weight (${growthUnit.replace("/ fish", "").trim() || "g"})`}>
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("sampleAvgWeightG")}
                onChange={(event) =>
                  set("sampleAvgWeightG", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="e.g. 450"
              />
            </Field>
            <Field label="Biomass (kg)" hint="Total live weight in the pond or house">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("biomassKg")}
                onChange={(event) => set("biomassKg", event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 610"
              />
            </Field>
            <Field label="Current head count" hint="Used for feed conversion and survival">
              <input
                className="pg-input h-12"
                inputMode="numeric"
                value={value("populationCount")}
                onChange={(event) =>
                  set("populationCount", event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="e.g. 2860"
              />
            </Field>
          </>
        ) : null}

        {action === "mortality" ? (
          <>
            <Field label="Number lost">
              <input
                className="pg-input h-12 text-[0.95rem]"
                inputMode="numeric"
                value={value("mortalityCount")}
                onChange={(event) =>
                  set("mortalityCount", event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="e.g. 12"
              />
            </Field>
            <Field label="Cause">
              <input
                className="pg-input h-12"
                value={value("mortalityReason")}
                onChange={(event) => set("mortalityReason", event.target.value)}
                placeholder="e.g. low dissolved oxygen after rainfall"
              />
            </Field>
            <Field label="Remaining head count">
              <input
                className="pg-input h-12"
                inputMode="numeric"
                value={value("populationCount")}
                onChange={(event) =>
                  set("populationCount", event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="e.g. 2848"
              />
            </Field>
          </>
        ) : null}

        {action === "medication" ? (
          <Field label="What was administered" className="sm:col-span-2">
            <input
              className="pg-input h-12"
              value={value("medication")}
              onChange={(event) => set("medication", event.target.value)}
              placeholder="e.g. oxytetracycline bath, 250 g"
            />
          </Field>
        ) : null}

        {action === "crates" ? (
          <>
            <Field label="Crates collected today">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("cratesCollected")}
                onChange={(event) =>
                  set("cratesCollected", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="e.g. 47"
              />
            </Field>
            <Field label="Or bags harvested" hint="For grain cycles">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("bagsHarvested")}
                onChange={(event) =>
                  set("bagsHarvested", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="e.g. 62"
              />
            </Field>
            <Field label="Area under production (m²)" className="sm:col-span-2">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("areaSqm")}
                onChange={(event) => set("areaSqm", event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 1200"
              />
            </Field>
          </>
        ) : null}

        {action === "expense" ? (
          <>
            <Field label="Amount (₦)">
              <input
                className="pg-input h-12 text-[0.95rem]"
                inputMode="decimal"
                value={value("amount")}
                onChange={(event) => set("amount", event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 145000"
              />
            </Field>
            <Field label="Category">
              <input
                className="pg-input h-12"
                value={value("category")}
                onChange={(event) => set("category", event.target.value)}
                placeholder="e.g. Feed, transport, medication"
              />
            </Field>
            <Field label="Vendor / payee">
              <input
                className="pg-input h-12"
                value={value("vendor")}
                onChange={(event) => set("vendor", event.target.value)}
                placeholder="e.g. Sokoto Feeds Depot"
              />
            </Field>
            <Field label="Still owing?" hint="Feeds Level 1 of the settlement waterfall">
              <select
                className="pg-input h-12"
                value={value("isPayable") || "no"}
                onChange={(event) => set("isPayable", event.target.value)}
              >
                <option value="no">No — paid already</option>
                <option value="yes">Yes — supplier balance outstanding</option>
              </select>
            </Field>
            <Field label="Receipt image URL" className="sm:col-span-2">
              <input
                className="pg-input h-12"
                value={value("receiptUrl")}
                onChange={(event) => set("receiptUrl", event.target.value)}
                placeholder="https://…"
              />
            </Field>
          </>
        ) : null}

        {action === "harvest" ? (
          <>
            <Field label="Total harvest weight (kg)" hint="From the batch scale ticket">
              <input
                className="pg-input h-12 text-[0.95rem]"
                inputMode="decimal"
                value={value("totalWeightKg")}
                onChange={(event) =>
                  set("totalWeightKg", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="e.g. 1180.5"
              />
            </Field>
            <Field label="Pieces / birds">
              <input
                className="pg-input h-12"
                inputMode="numeric"
                value={value("totalCount")}
                onChange={(event) => set("totalCount", event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 1064"
              />
            </Field>
            <Field label="Scale ticket reference">
              <input
                className="pg-input h-12"
                value={value("scaleTicketRef")}
                onChange={(event) => set("scaleTicketRef", event.target.value)}
                placeholder="e.g. SCALE-2026-1042"
              />
            </Field>
            <Field label="Buyer">
              <input
                className="pg-input h-12"
                value={value("buyer")}
                onChange={(event) => set("buyer", event.target.value)}
                placeholder="e.g. Sokoto Frozen Foods"
              />
            </Field>
          </>
        ) : null}

        {action === "incident" ? (
          <>
            <Field label="What happened" className="sm:col-span-2">
              <input
                className="pg-input h-12"
                value={value("title")}
                onChange={(event) => set("title", event.target.value)}
                placeholder="e.g. Pond 3 pump failure overnight"
              />
            </Field>
            <Field label="Category">
              <input
                className="pg-input h-12"
                value={value("category")}
                onChange={(event) => set("category", event.target.value)}
                placeholder="e.g. Equipment, flooding, disease, power"
              />
            </Field>
            <Field label="Severity">
              <select
                className="pg-input h-12"
                value={value("severity") || "low"}
                onChange={(event) => set("severity", event.target.value)}
              >
                <option value="low">Low — no material impact</option>
                <option value="moderate">Moderate — contained</option>
                <option value="serious">Serious — affects yield</option>
                <option value="critical">Critical — threatens the cycle</option>
              </select>
            </Field>
            <Field label="Full description" className="sm:col-span-2">
              <textarea
                className="pg-input h-24 py-2"
                value={value("description")}
                onChange={(event) => set("description", event.target.value)}
                placeholder="What happened, what was done immediately, and what is needed next."
              />
            </Field>
            <Field label="Estimated financial impact (₦)">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("estimatedImpact")}
                onChange={(event) =>
                  set("estimatedImpact", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="e.g. 80000"
              />
            </Field>
            <Field label="Insurance claim reference">
              <input
                className="pg-input h-12"
                value={value("insuranceClaimRef")}
                onChange={(event) => set("insuranceClaimRef", event.target.value)}
                placeholder="e.g. NAIC-2026-7712"
              />
            </Field>
          </>
        ) : null}

        {action === "weather" ? (
          <>
            <Field label="Rainfall (mm)">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("rainfallMm")}
                onChange={(event) => set("rainfallMm", event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="e.g. 14.5"
              />
            </Field>
            <Field label="Humidity (%)">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("humidityPercent")}
                onChange={(event) =>
                  set("humidityPercent", event.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder="e.g. 78"
              />
            </Field>
            <Field label="Lowest temperature (°C)">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("tempMinC")}
                onChange={(event) => set("tempMinC", event.target.value.replace(/[^0-9.-]/g, ""))}
                placeholder="e.g. 22.4"
              />
            </Field>
            <Field label="Highest temperature (°C)">
              <input
                className="pg-input h-12"
                inputMode="decimal"
                value={value("tempMaxC")}
                onChange={(event) => set("tempMaxC", event.target.value.replace(/[^0-9.-]/g, ""))}
                placeholder="e.g. 35.1"
              />
            </Field>
            <Field label="Field note" className="sm:col-span-2">
              <input
                className="pg-input h-12"
                value={value("note")}
                onChange={(event) => set("note", event.target.value)}
                placeholder="e.g. heavy overnight rain, pond levels high"
              />
            </Field>
          </>
        ) : null}

        {action === "feed" || action === "growth" || action === "mortality" || action === "medication" || action === "crates" ? (
          <>
            <Field label="Internal note (not published)" className="sm:col-span-2">
              <input
                className="pg-input h-12"
                value={value("notes")}
                onChange={(event) => set("notes", event.target.value)}
                placeholder="Anything the treasury should know about this entry"
              />
            </Field>
            <Field
              label="Public summary line"
              hint="Shown verbatim on the transparency feed once approved"
              className="sm:col-span-2"
            >
              <input
                className="pg-input h-12"
                value={value("publicSummary")}
                onChange={(event) => set("publicSummary", event.target.value)}
                placeholder="e.g. Catfish Pond 3 reached 650 g average weight today"
              />
            </Field>
          </>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="pg-btn pg-btn--mint mt-5 h-12 w-full text-[0.95rem] sm:w-auto sm:px-8"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        Save {description?.label.toLowerCase()} entry
      </button>

      <p className="mt-3 text-[0.68rem] leading-5 text-ink-mute">
        Entries are filed against {`the selected cycle`} and are reviewed by an admin before they
        reach the public feed. You cannot edit member balances, change equity, or trigger a payout
        from this console.
      </p>
    </Card>
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
