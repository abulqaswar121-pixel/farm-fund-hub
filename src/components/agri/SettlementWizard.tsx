import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  Loader2,
  Lock,
  Scale,
  Wheat,
} from "lucide-react";
import { useEffect, useState } from "react";

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
import { dateLabel, money, number, percent } from "@/lib/agri/format";
import type { CycleRules } from "@/lib/agri/rules";
import { auditSettlement, describeShortfall } from "@/lib/agri/settlement";
import {
  executeSettlement,
  getSettlementReadiness,
  previewSettlement,
  type AdminConsole,
  type SettlementPreview,
  type SettlementReadiness,
} from "@/lib/agri.ops.functions";
import { cn } from "@/lib/utils";

/**
 * The harvest settlement wizard.
 *
 * Four steps, in the order money actually moves:
 *
 *   1. **What came off the farm** — the weigh-ins on file and the revenue the
 *      buyer actually banked. Nothing is typed that a weigh-in does not support.
 *   2. **What must be paid first** — supplier debts read off the books, the
 *      locked reserve, an optional extra the admin may hold back, and the
 *      frozen 70/30 split.
 *   3. **Who gets what** — one row per member, by live equity, computed by the
 *      database in test mode.
 *   4. **Confirm** — type the cycle code, then execute. There is no undo.
 *
 * The design rule: a preview and a payout must be produced by the same code.
 * Step 3 calls `run_cycle_waterfall_planned` with `_test = true`; step 4 calls
 * the same function with `_test = false`. If the two could disagree, the wizard
 * would be a promise rather than a tool.
 */

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: 1, label: "Yield & revenue", hint: "Weigh-ins and banked sale" },
  { id: 2, label: "Debts & split", hint: "Liabilities, reserve, 70/30" },
  { id: 3, label: "Member payouts", hint: "Live equity, per member" },
  { id: 4, label: "Confirm & execute", hint: "Final, no undo" },
];

export function SettlementWizard({
  console_,
  onDone,
}: {
  console_: AdminConsole;
  onDone: (tone: "success" | "error" | "info", text: string) => void;
}) {
  const loadReadiness = useServerFn(getSettlementReadiness);
  const runPreview = useServerFn(previewSettlement);
  const execute = useServerFn(executeSettlement);

  const [step, setStep] = useState<Step>(1);
  const [cycleId, setCycleId] = useState("");
  const [readiness, setReadiness] = useState<SettlementReadiness | null>(null);
  const [revenue, setRevenue] = useState("");
  const [topUp, setTopUp] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState<"load" | "preview" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only cycles with capital actually in them can be settled: settling an empty
  // cycle would divide by zero and, worse, print a statement for nobody.
  const candidates = console_.cycles.filter((row) => row.locked && row.raised > 0);
  const cycle = console_.cycles.find((row) => row.id === cycleId);

  async function chooseCycle(next: string) {
    setCycleId(next);
    setReadiness(null);
    setPreview(null);
    setStep(1);
    setError(null);
    setConfirmCode("");
    if (!next) return;
    setBusy("load");
    try {
      const figures = await loadReadiness({ data: { cycleId: next } });
      setReadiness(figures);
      if (figures.bankedRevenue > 0 && !revenue) setRevenue(String(figures.bankedRevenue));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to read that cycle");
    }
    setBusy(null);
  }

  async function buildPreview() {
    setBusy("preview");
    setError(null);
    try {
      const result = await runPreview({
        data: {
          cycleId,
          grossRevenue: Number(revenue) || 0,
          reserveTopUp: Number(topUp) || 0,
          ...(note.trim().length > 0 ? { note } : {}),
        },
      });
      setPreview(result);
      setStep(3);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The preview could not be built");
    }
    setBusy(null);
  }

  async function runIt() {
    setBusy("execute");
    setError(null);
    try {
      const result = await execute({
        data: {
          cycleId,
          grossRevenue: Number(revenue) || 0,
          reserveTopUp: Number(topUp) || 0,
          note,
        },
      });
      onDone(
        "success",
        `${readiness?.code ?? "Cycle"} settled. ${money(result.totalPaidOut)} across ${preview?.lines.length ?? 0} member payout${(preview?.lines.length ?? 0) === 1 ? "" : "s"} is now on the register, waiting to be marked paid.`,
      );
      // Re-read: the cycle now reports alreadySettled, and the wizard's job here
      // is done. It stays readable rather than resetting, so the admin can print
      // the statement straight away.
      const figures = await loadReadiness({ data: { cycleId } });
      setReadiness(figures);
      setStep(4);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The settlement could not be run");
    }
    setBusy(null);
  }

  const rules: CycleRules = {
    investorSharePercent: preview?.investorSharePercent ?? readiness?.investorSharePercent ?? 70,
    operatorSharePercent: preview?.operatorSharePercent ?? readiness?.operatorSharePercent ?? 30,
    reservePercent: preview?.reservePercent ?? readiness?.reservePercent ?? 5,
  };

  const revenueValue = Number(revenue) || 0;
  const topUpValue = Number(topUp) || 0;
  const canPreview =
    Boolean(cycleId) &&
    revenueValue > 0 &&
    Boolean(readiness) &&
    !readiness?.alreadySettled &&
    busy === null;

  const settled = readiness?.alreadySettled ?? false;

  // Every invariant checked before the final button can be pressed. An empty
  // list is the normal case; a populated one blocks execution, because the one
  // outcome this screen must never produce is a payout that does not add up.
  const audit = preview
    ? auditSettlement(
        {
          grossRevenue: preview.grossRevenue,
          liabilitiesPaid: preview.liabilitiesPaid,
          principalReturned: preview.principalReturned,
          reserveSetAside: preview.reserveSetAside,
          netProfit: preview.netProfit,
          investorProfitPool: preview.investorProfitPool,
          operatorFee: preview.operatorFee,
          totalPaidOut: preview.totalPaidOut,
        },
        preview.lines,
      )
    : [];
  const shortfallNote = preview
    ? describeShortfall(
        {
          grossRevenue: preview.grossRevenue,
          liabilitiesPaid: preview.liabilitiesPaid,
          principalReturned: preview.principalReturned,
          reserveSetAside: preview.reserveSetAside,
          netProfit: preview.netProfit,
          investorProfitPool: preview.investorProfitPool,
          operatorFee: preview.operatorFee,
          totalPaidOut: preview.totalPaidOut,
        },
        preview.capitalRaised,
      )
    : null;

  const canExecute =
    audit.length === 0 &&
    step === 4 &&
    Boolean(preview) &&
    confirmCode.trim().toUpperCase() === (readiness?.code ?? "").toUpperCase() &&
    note.trim().length >= 10 &&
    busy === null;

  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Harvest settlement wizard"
        title="Settle a cycle in four steps"
        blurb="Each step is read off the ledger rather than typed in. The payout table in step three is produced by the settlement engine itself, running in test mode — so what you approve is what gets written."
      />

      {/* Cycle chooser --------------------------------------------------- */}
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <label className="block">
            <span className="pg-label">Cycle to settle</span>
            <select
              className="pg-input mt-1"
              value={cycleId}
              onChange={(event) => void chooseCycle(event.target.value)}
            >
              <option value="">Select a funded or active cycle…</option>
              {candidates.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.name} · {money(row.raised)} raised
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {cycle ? (
              <>
                <span className="pg-chip">{cycle.status}</span>
                <span className="pg-chip">{cycle.currentStage.replace(/_/g, " ")}</span>
                <span className="pg-chip pg-chip--amber">{cycle.rulesChip}</span>
              </>
            ) : (
              <p className="text-[0.74rem] text-ink-mute">
                Only cycles with verified capital and a published term can be settled.
              </p>
            )}
          </div>
        </div>

        {candidates.length === 0 ? (
          <Notice tone="info" className="mt-4">
            No cycle is ready to settle yet. A cycle needs to be published and funded before its
            harvest can be distributed.
          </Notice>
        ) : null}

        {settled ? (
          <Notice tone="warning" className="mt-4">
            This cycle already has an executed settlement. A second run is refused by the database,
            so the remaining work is to mark each payout as paid on the payout register below.
          </Notice>
        ) : null}
      </Card>

      {cycleId ? (
        <>
          {/* Step rail -------------------------------------------------- */}
          <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((item) => {
              const done = item.id < step;
              const active = item.id === step;
              const reachable =
                item.id === 1 ||
                (item.id === 2 && Boolean(readiness)) ||
                (item.id === 3 && Boolean(preview)) ||
                (item.id === 4 && Boolean(preview));
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!reachable || busy !== null}
                    onClick={() => setStep(item.id)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-navy bg-navy text-white"
                        : done
                          ? "border-mint/40 bg-mint-soft/60"
                          : "border-hairline bg-white",
                      !reachable && "cursor-not-allowed opacity-55",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full font-mono text-[0.62rem] font-bold",
                        active
                          ? "bg-signal text-navy"
                          : done
                            ? "bg-mint-deep text-white"
                            : "bg-porcelain text-ink-soft",
                      )}
                    >
                      {done ? <Check size={11} aria-hidden="true" /> : item.id}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[0.76rem] font-semibold",
                          active ? "text-white" : "text-ink-deep",
                        )}
                      >
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[0.64rem]",
                          active ? "text-white/65" : "text-ink-mute",
                        )}
                      >
                        {item.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {error ? <Notice tone="error">{error}</Notice> : null}

          {busy === "load" ? (
            <Card className="flex items-center justify-center gap-2 py-12 text-ink-mute">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              <span className="fig text-[0.8rem]">Reading the cycle&apos;s figures…</span>
            </Card>
          ) : null}

          {/* Step 1 ----------------------------------------------------- */}
          {step === 1 && readiness && busy !== "load" ? (
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Wheat size={15} className="text-signal-deep" aria-hidden="true" />
                  <p className="pg-kicker">What came off the farm</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <Figure label="Weighed" value={`${number(readiness.weighedKg, 1)} kg`} />
                  <Figure label="Banked revenue" value={money(readiness.bankedRevenue)} />
                </div>

                {readiness.weighIns.length > 0 ? (
                  <ul className="m-0 mt-4 list-none divide-y divide-hairline border-y border-hairline p-0">
                    {readiness.weighIns.map((record) => (
                      <li
                        key={record.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                      >
                        <span className="fig text-[0.74rem] text-ink-deep">
                          {record.totalWeightKg === null
                            ? "weight not recorded"
                            : `${number(record.totalWeightKg, 1)} kg`}
                        </span>
                        <span className="text-[0.66rem] text-ink-mute">
                          {dateLabel(record.harvestDate)}
                          {record.scaleTicketRef ? ` · ticket ${record.scaleTicketRef}` : ""}
                          {record.buyer ? ` · ${record.buyer}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Notice tone="warning" className="mt-4">
                    No weigh-in is on file for this cycle. File one from the farm operator portal
                    first, so the settlement is anchored to a real scale reading rather than a
                    number typed into this screen.
                  </Notice>
                )}

                <label className="mt-4 block">
                  <span className="pg-label">Gross revenue actually received (₦)</span>
                  <input
                    className="pg-input mt-1"
                    inputMode="decimal"
                    value={revenue}
                    onChange={(event) => setRevenue(event.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder={
                      readiness.bankedRevenue > 0 ? String(readiness.bankedRevenue) : "e.g. 4200000"
                    }
                  />
                  <span className="mt-1 block text-[0.66rem] leading-5 text-ink-mute">
                    The figure on the buyer&apos;s payment advice, not the projected revenue. If it
                    is lower than the projection, the waterfall reports the shortfall rather than
                    hiding it.
                  </span>
                </label>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={!canPreview}
                    onClick={() => setStep(2)}
                    className="pg-btn pg-btn--primary"
                  >
                    Next · what must be paid first
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Scale size={15} className="text-signal-deep" aria-hidden="true" />
                  <p className="pg-kicker">Where this revenue will go</p>
                </div>
                <div className="mt-3">
                  <WaterfallLadder rules={rules} />
                </div>
                <p className="mt-3 text-[0.7rem] leading-5 text-ink-mute">
                  The order is not a preference. Suppliers are paid before capital, capital is
                  returned before the reserve is topped up, and profit is split only from what
                  survives all three.
                </p>
              </Card>
            </div>
          ) : null}

          {/* Step 2 ----------------------------------------------------- */}
          {step === 2 && readiness ? (
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="p-5">
                <p className="pg-kicker">Level 1 · supplier debts read off the books</p>
                <div className="mt-3 rounded-xl border border-hairline bg-porcelain p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.76rem] text-ink-soft">
                      Unpaid payables in this cycle
                    </span>
                    <span className="fig text-[0.95rem] font-semibold text-ink-deep">
                      {money(readiness.openLiabilities)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[0.66rem] leading-5 text-ink-mute">
                    {(readiness.openLiabilities === 0
                      ? "Every supplier has been paid. Level 1 takes nothing."
                      : "These rows are marked payable and unsettled. The settlement will pay them and stamp each as settled.") +
                      " Filing an expense is not spending: only expenses marked payable and still unsettled reach this level."}
                  </p>
                </div>

                <p className="pg-kicker mt-5">Level 3 · emergency reserve</p>
                <div className="mt-2 rounded-xl border border-hairline bg-white p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.76rem] text-ink-soft">
                      Locked at {percent(readiness.reservePercent, 0)} of gross revenue
                    </span>
                    <span className="fig text-[0.95rem] font-semibold text-ink-deep">
                      {money((revenueValue * readiness.reservePercent) / 100)}
                    </span>
                  </div>
                  {topUpValue > 0 ? (
                    <p className="mt-2 text-[0.68rem] leading-5 text-ink-deep">
                      With {money(topUpValue)} extra, Level 3 would hold{" "}
                      <span className="fig font-semibold">
                        {money((revenueValue * readiness.reservePercent) / 100 + topUpValue)}
                      </span>{" "}
                      — subject to there being surplus left after principal.
                    </p>
                  ) : null}
                  <label className="mt-3 block">
                    <span className="pg-label">Hold back extra (optional, ₦)</span>
                    <input
                      className="pg-input mt-1"
                      inputMode="decimal"
                      value={topUp}
                      onChange={(event) => setTopUp(event.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="0"
                    />
                  </label>
                  <p className="mt-1.5 text-[0.66rem] leading-5 text-ink-mute">
                    Only from genuine surplus after principal is returned, and only when the note in
                    step four explains why — a repaint, a disease buffer, a pond that needs
                    relining. The reason is published to members, so it cannot be a quiet
                    withholding.
                  </p>
                  {readiness.projectedHarvestOn ? (
                    <p className="mt-2 text-[0.66rem] text-ink-mute">
                      Projected harvest {dateLabel(readiness.projectedHarvestOn)}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap justify-between gap-2">
                  <button type="button" onClick={() => setStep(1)} className="pg-btn pg-btn--ghost">
                    <ArrowLeft size={14} aria-hidden="true" />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={!canPreview}
                    onClick={() => void buildPreview()}
                    className="pg-btn pg-btn--primary"
                  >
                    {busy === "preview" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Banknote size={14} />
                    )}
                    Price the payout per member
                  </button>
                </div>
              </Card>

              <Card className="p-5">
                <p className="pg-kicker">Level 4 · the frozen split</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-hairline bg-white p-3">
                    <p className="pg-kicker">Members</p>
                    <p className="fig mt-1 text-[1.05rem] font-semibold text-mint-deep">
                      {percent(rules.investorSharePercent, 0)}
                    </p>
                    <p className="mt-0.5 text-[0.62rem] text-ink-mute">of net profit, pro-rata</p>
                  </div>
                  <div className="rounded-xl border border-hairline bg-white p-3">
                    <p className="pg-kicker">Caretaker</p>
                    <p className="fig mt-1 text-[1.05rem] font-semibold text-ink-deep">
                      {percent(rules.operatorSharePercent, 0)}
                    </p>
                    <p className="mt-0.5 text-[0.62rem] text-ink-mute">
                      of net profit, to the farm
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[0.7rem] leading-5 text-ink-mute">
                  These two figures were frozen when the cycle was published and the database
                  refuses to move them. They are shown here so you can see them, not to be edited.
                </p>

                <div className="mt-4 rounded-xl border border-hairline bg-porcelain p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.74rem] text-ink-soft">Capital to return</span>
                    <span className="fig text-[0.9rem] font-semibold text-ink-deep">
                      {money(readiness.verifiedCapital)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[0.74rem] text-ink-soft">Contributing members</span>
                    <span className="fig text-[0.9rem] font-semibold text-ink-deep">
                      {readiness.contributingMembers}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[0.74rem] text-ink-soft">Revenue entered</span>
                    <span className="fig text-[0.9rem] font-semibold text-ink-deep">
                      {money(revenueValue)}
                    </span>
                  </div>
                </div>

                {revenueValue > 0 &&
                revenueValue < readiness.verifiedCapital + readiness.openLiabilities ? (
                  <Notice tone="warning" className="mt-3">
                    This revenue does not cover debts plus principal. The run will still be honest —
                    it reports a shortfall — but consider whether the sale is complete before
                    executing.
                  </Notice>
                ) : null}
              </Card>
            </div>
          ) : null}

          {/* Step 3 ----------------------------------------------------- */}
          {step === 3 && preview ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="p-4">
                  <Figure label="Level 1 · debts" value={money(preview.liabilitiesPaid)} />
                </Card>
                <Card className="p-4">
                  <Figure
                    label="Level 2 · principal"
                    value={money(preview.principalReturned)}
                    tone={preview.principalAtRisk ? "debit" : "plain"}
                  />
                </Card>
                <Card className="p-4">
                  <Figure label="Level 3 · reserve" value={money(preview.reserveSetAside)} />
                </Card>
                <Card className="p-4">
                  <Figure
                    label="Level 4 · net profit"
                    value={money(preview.netProfit)}
                    tone={preview.netProfit > 0 ? "credit" : "plain"}
                  />
                </Card>
              </div>

              {preview.reserveTopUpRequested > preview.reserveTopUpApplied ? (
                <Notice tone="warning">
                  You asked to hold back {money(preview.reserveTopUpRequested)} extra; only{" "}
                  {money(preview.reserveTopUpApplied)} was available after debts and principal. The
                  reserve is never funded out of a member&apos;s capital.
                </Notice>
              ) : null}

              {preview.principalAtRisk ? (
                <Notice tone="error">
                  This settlement cannot return 100% of principal. Each member&apos;s statement will
                  say so plainly, and the shortfall is recorded against the cycle rather than
                  absorbed silently.
                  {shortfallNote ? ` ${shortfallNote}` : ""}
                </Notice>
              ) : null}

              {audit.length > 0 ? (
                <Notice tone="error">
                  <strong>The figures do not reconcile, so execution is blocked.</strong>
                  <ul className="mt-1.5 list-disc pl-4">
                    {audit.map((problem) => (
                      <li key={problem} className="text-[0.74rem] leading-5">
                        {problem}
                      </li>
                    ))}
                  </ul>
                </Notice>
              ) : (
                <p className="text-[0.7rem] leading-5 text-ink-mute">
                  Checked: the four levels allocate the whole revenue, the profit split equals net
                  profit, and {preview.lines.length} member line
                  {preview.lines.length === 1 ? "" : "s"} add up to the total on screen. Rounded to
                  the kobo, so a one-kobo rounding difference is tolerated and nothing larger is.
                </p>
              )}

              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
                  <p className="pg-kicker">Per-member payout · by live equity</p>
                  <span className="text-[0.7rem] text-ink-mute">
                    <span className="fig font-semibold text-ink-soft">
                      {money(preview.totalPaidOut)}
                    </span>{" "}
                    across {preview.lines.length} member{preview.lines.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="table-scroll">
                  <table className="pg-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th className="num">Verified capital</th>
                        <th className="num">Equity %</th>
                        <th className="num">Principal</th>
                        <th className="num">Profit share</th>
                        <th className="num">Total due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.lines.map((line) => (
                        <tr key={line.memberId}>
                          <td className="font-medium text-ink-deep">{line.memberName}</td>
                          <td className="num">
                            <Money value={line.capital} />
                          </td>
                          <td className="num fig text-signal-deep">
                            {percent(line.equityPercent, 4)}
                          </td>
                          <td className="num fig">{money(line.principal)}</td>
                          <td className="num fig">{money(line.profit)}</td>
                          <td className="num fig font-semibold">{money(line.total)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td>Total</td>
                        <td className="num fig">
                          {money(preview.lines.reduce((sum, line) => sum + line.capital, 0))}
                        </td>
                        <td className="num fig">100.0000%</td>
                        <td className="num fig">
                          {money(preview.lines.reduce((sum, line) => sum + line.principal, 0))}
                        </td>
                        <td className="num fig">
                          {money(preview.lines.reduce((sum, line) => sum + line.profit, 0))}
                        </td>
                        <td className="num fig">
                          {money(preview.lines.reduce((sum, line) => sum + line.total, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-hairline bg-porcelain px-4 py-2 text-[0.68rem] text-ink-mute">
                  Produced by the settlement engine itself in test mode. Executing writes these same
                  figures onto the run, where they are frozen and can never be rewritten by a later
                  ledger change.
                </p>
              </Card>

              <div className="flex flex-wrap justify-between gap-2">
                <button type="button" onClick={() => setStep(2)} className="pg-btn pg-btn--ghost">
                  <ArrowLeft size={14} aria-hidden="true" />
                  Back to the figures
                </button>
                <button type="button" onClick={() => setStep(4)} className="pg-btn pg-btn--primary">
                  Continue to confirmation
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          {/* Step 4 ----------------------------------------------------- */}
          {step === 4 ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <AlertTriangle size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="pg-kicker">Final step</p>
                  <h3 className="mt-0.5 font-display text-[1.02rem] font-semibold text-ink-deep">
                    {settled ? "This cycle is already settled" : "This cannot be undone"}
                  </h3>
                </div>
              </div>

              {settled ? (
                <Notice tone="info" className="mt-4">
                  The run exists. Every member can already see their line and print their harvest
                  statement. What remains is marking each payout as paid once the transfer clears.
                </Notice>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-hairline bg-porcelain p-3">
                      <p className="pg-kicker">Paying out</p>
                      <p className="fig mt-1 text-[1rem] font-semibold text-ink-deep">
                        {money(preview?.totalPaidOut ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-hairline bg-porcelain p-3">
                      <p className="pg-kicker">Caretaker fee</p>
                      <p className="fig mt-1 text-[1rem] font-semibold text-ink-deep">
                        {money(preview?.operatorFee ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-hairline bg-porcelain p-3">
                      <p className="pg-kicker">Reserve held</p>
                      <p className="fig mt-1 text-[1rem] font-semibold text-ink-deep">
                        {money(preview?.reserveSetAside ?? 0)}
                      </p>
                    </div>
                  </div>

                  <label className="mt-4 block">
                    <span className="pg-label">Settlement note (required, shown to members)</span>
                    <textarea
                      className="pg-input mt-1 h-20 w-full resize-y py-2"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="e.g. Harvest of 7 Oct, 1,240 kg at ₦3,400/kg to Sokoto Frozen Foods. Reserve top-up for the pump replacement."
                    />
                    <span className="mt-1 block text-[0.66rem] text-ink-mute">
                      {note.trim().length < 10
                        ? `At least 10 characters — ${10 - note.trim().length} to go. This note is printed on every member's harvest statement.`
                        : "Good. This note appears on every member's statement."}
                    </span>
                  </label>

                  <label className="mt-4 block">
                    <span className="pg-label">
                      Type {readiness?.code ?? "the cycle code"} to confirm
                    </span>
                    <input
                      className="pg-input mt-1 font-mono uppercase"
                      value={confirmCode}
                      onChange={(event) => setConfirmCode(event.target.value)}
                      placeholder={readiness?.code ?? ""}
                      autoComplete="off"
                    />
                  </label>

                  {error ? (
                    <Notice tone="error" className="mt-3">
                      {error}
                    </Notice>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="pg-btn pg-btn--ghost"
                      disabled={busy !== null}
                    >
                      <ArrowLeft size={14} aria-hidden="true" />
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!canExecute}
                      onClick={() => void runIt()}
                      className="pg-btn pg-btn--primary"
                    >
                      {busy === "execute" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Lock size={14} />
                      )}
                      Execute settlement
                    </button>
                  </div>
                  <p className="mt-2 text-[0.66rem] leading-5 text-ink-mute">
                    Executing writes the payout lines, closes any payable supplier debt the run
                    covered, and moves the cycle to settled. It does not move money — each transfer
                    is marked paid on the register afterwards.
                  </p>
                </>
              )}
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <EmptyState icon={<BadgeCheck size={18} />} title="Choose a cycle to begin">
            The wizard reads the weigh-ins, the supplier debts and the live equity table for the
            cycle you pick, and nothing else.
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
