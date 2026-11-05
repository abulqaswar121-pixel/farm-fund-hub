import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck,
  Coins,
  FileText,
  Gauge,
  Landmark,
  Loader2,
  Lock,
  Play,
  Printer,
  Receipt,
  RefreshCw,
  Repeat,
  Sprout,
  TrendingDown,
  Wallet,
  Waves,
} from "lucide-react";

import { A4Document, type DocumentKind } from "@/components/agri/A4Document";
import { AlertBanner } from "@/components/agri/AlertBanner";
import { GrowthChart } from "@/components/agri/GrowthChart";
import { StageRail } from "@/components/agri/StageRail";
import { WaterfallLadder } from "@/components/agri/WaterfallLadder";
import { Card, EmptyState, Figure, Money, Notice, StatusChip } from "@/components/ndh/ledger-ui";
import { supabase } from "@/integrations/supabase/client";
import { COMMODITIES, stageName } from "@/lib/agri/commodities";
import { dateLabel, dateTimeLabel, money, number, percent } from "@/lib/agri/format";
import {
  cancelFarmVisit,
  claimShareOffer,
  confirmContribution,
  createShareOffer,
  getCycleTelemetry,
  getMemberWorkspace,
  bookFarmVisit,
  requestBankTransfer,
  saveRolloverInstruction,
  startContribution,
  withdrawShareOffer,
  type CycleTelemetry,
  type MemberWorkspace,
} from "@/lib/agri.member.functions";
import {
  getMemberCommunity,
  issueDocument,
  type DocumentPayload,
} from "@/lib/agri.community.functions";
import { MIN_CONTRIBUTION, QUICK_AMOUNTS, nairaWhole, parseAmount } from "@/lib/agri/contribution";
import { openPaystackCheckout } from "@/lib/paystack-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/investor")({
  component: InvestorPortal,
});

/**
 * Four tabs, in the order a member actually needs them.
 *
 * The previous version had six — Portfolio, Live telemetry, Statement &
 * payouts, Share transfer, Farm visits and Reinvestment — and opened on a
 * screen with two four-figure rows, a treasury strip, six KPI cards and a
 * stage rail before the member's own money appeared. A co-operative member
 * checking their phone on a bus wants three things: what have I put in, what is
 * it doing, and what did the farm do this week.
 *
 * So: My stake, Cycle tracker, Pond updates, Documents. Farm visits and
 * reinvestment are still there — they are buttons inside My stake, where they
 * are relevant, rather than tabs competing for attention.
 */
type Tab = "stake" | "tracker" | "updates" | "documents";

const TABS: { id: Tab; label: string; icon: typeof Gauge }[] = [
  { id: "stake", label: "My stake", icon: Gauge },
  { id: "tracker", label: "Cycle tracker", icon: Sprout },
  { id: "updates", label: "Pond updates", icon: Waves },
  { id: "documents", label: "Documents", icon: FileText },
];

function InvestorPortal() {
  const loadWorkspace = useServerFn(getMemberWorkspace);
  const loadTelemetry = useServerFn(getCycleTelemetry);
  const loadCommunity = useServerFn(getMemberCommunity);
  const issue = useServerFn(issueDocument);

  const [community, setCommunity] = useState<Awaited<ReturnType<typeof getMemberCommunity>> | null>(
    null,
  );
  const [document_, setDocument] = useState<{
    kind: DocumentKind;
    code: string;
    payload: DocumentPayload;
  } | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);

  const [workspace, setWorkspace] = useState<MemberWorkspace | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("stake");
  /**
   * The three tools that used to be tabs of their own. They are one tap away,
   * inside My stake, and close back to it — because none of them is why anybody
   * opens the portal on a Tuesday.
   */
  const [tool, setTool] = useState<null | "transfer" | "visits" | "rollover">(null);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<CycleTelemetry | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  async function refresh() {
    try {
      const data = await loadWorkspace();
      setWorkspace(data);
      setActiveCycleId((current) => current ?? data.positions[0]?.cycleId ?? null);
    } catch {
      setFailed(true);
    }
    // The treasury figures, alerts and documents are a second read: if the
    // community layer is not deployed yet the ledger view still works.
    try {
      setCommunity(await loadCommunity());
    } catch {
      setCommunity(null);
    }
  }

  /** Issue (or re-open) one of the three A4 documents for a ledger row. */
  async function openDocument(
    kind: DocumentKind,
    args: { investmentId?: string; cycleId?: string },
  ) {
    setDocumentBusy(true);
    try {
      const issued = await issue({ data: { kind, ...args } });
      const stored = community?.documents.find((doc) => doc.code === issued.code);
      // Prefer the payload the ledger just returned; fall back to the stored
      // document if the code already existed from an earlier print.
      const payload =
        stored?.payload ??
        community?.documents.find((doc) => doc.id === issued.documentId)?.payload ??
        null;
      if (!payload) {
        await refresh();
        const fresh = await loadCommunity();
        setCommunity(fresh);
        const found = fresh.documents.find((doc) => doc.code === issued.code);
        if (!found) throw new Error("That document could not be prepared");
        setDocument({ kind, code: issued.code, payload: found.payload });
      } else {
        setDocument({ kind, code: issued.code, payload });
      }
    } catch (error) {
      setFlash({
        tone: "error",
        text: error instanceof Error ? error.message : "That document could not be prepared",
      });
    }
    setDocumentBusy(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeCycleId) return;
    let cancelled = false;
    loadTelemetry({ data: { cycleId: activeCycleId } })
      .then((result) => {
        if (!cancelled) setTelemetry(result);
      })
      .catch(() => {
        if (!cancelled) setTelemetry(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCycleId]);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={18} />}
          title="We could not reach your ledger"
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
          Your positions are untouched — this is a read failure, not a ledger change. If it keeps
          failing, the service may be briefly unavailable; sign out and back in if it persists.
        </EmptyState>
      </Card>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center gap-2 py-16 text-ink-mute">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        <span className="fig text-[0.8rem]">Loading your positions…</span>
      </div>
    );
  }

  const activePosition = workspace.positions.find((row) => row.cycleId === activeCycleId) ?? null;
  // The most recent payment that actually cleared. Documents are issued against
  // a verified row, because a certificate for unverified money would be a lie
  // with a stamp on it.
  const latestVerified = workspace.investments.find((row) => row.status === "success") ?? null;
  const commodity = COMMODITIES.find((item) => item.id === activePosition?.commodity);

  // A document is a page, not a panel: it takes the screen so the print dialog
  // has nothing else in it and what prints is exactly what is on the sheet.
  if (document_) {
    return (
      <A4Document
        kind={document_.kind}
        payload={document_.payload}
        code={document_.code}
        onClose={() => setDocument(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header ---------------------------------------------------------- */}
      <div className="flex flex-col gap-4 border-b border-hairline pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="pg-kicker">Investor portal</p>
          <h1 className="mt-1.5 text-[1.6rem] leading-tight text-ink-deep md:text-[1.9rem]">
            Good day, {workspace.identity.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[0.83rem] leading-6 text-ink-soft">
            Your equity share below is recomputed from verified contributions on every load. There
            is no stored equity field for anyone to adjust.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status="info" label={workspace.identity.email} />
          <span className="pg-chip">
            <BadgeCheck size={11} className="text-mint" aria-hidden="true" />
            {workspace.totals.cycles} cycle{workspace.totals.cycles === 1 ? "" : "s"}
          </span>
        </div>
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

      {/* The expense alert the brief promises: pushed the moment it is logged. */}
      {community && community.alerts.length > 0 ? (
        <AlertBanner alerts={community.alerts} onDismissed={() => void refresh()} />
      ) : null}

      {/* My stake — one card, three figures, and the tools as buttons. */}
      <StakeCard
        workspace={workspace}
        community={community}
        activePosition={activePosition}
        onTool={(next) => {
          setTab("stake");
          setTool(next);
        }}
        onDocuments={() => {
          setTab("documents");
          setTool(null);
        }}
      />

      {/* Tabs ------------------------------------------------------------ */}
      <div className="pg-portal-tabs border-b border-hairline pb-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setTool(null);
              }}
              className={cn(
                "pg-portal-tab",
                tab === item.id && "!bg-navy !text-white",
                "text-ink-soft hover:!bg-porcelain hover:!text-ink-deep",
              )}
              aria-current={tab === item.id ? "page" : undefined}
            >
              <Icon size={14} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Portfolio ------------------------------------------------------- */}
      {tab === "stake" && tool === null ? (
        <div className="space-y-6">
          <CycleTracker position={activePosition} />
          {workspace.positions.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="pg-kicker mr-1">Stock switcher</span>
                {workspace.positions.map((position) => {
                  const item = COMMODITIES.find((entry) => entry.id === position.commodity);
                  const Icon = item?.icon ?? Sprout;
                  return (
                    <button
                      key={position.cycleId}
                      type="button"
                      onClick={() => setActiveCycleId(position.cycleId)}
                      aria-pressed={activeCycleId === position.cycleId}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold transition-colors",
                        activeCycleId === position.cycleId
                          ? "border-navy bg-navy text-white"
                          : "border-hairline bg-white text-ink-soft hover:border-hairline-strong",
                      )}
                    >
                      <Icon size={13} aria-hidden="true" />
                      {position.code}
                      <span className="fig opacity-70">{percent(position.equityPercent, 1)}</span>
                    </button>
                  );
                })}
              </div>

              {activePosition ? (
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="pg-kicker">
                        {activePosition.code} · {commodity?.name}
                      </p>
                      <h2 className="mt-1 font-display text-[1.2rem] font-semibold text-ink-deep">
                        {activePosition.name}
                      </h2>
                      <p className="mt-1 text-[0.75rem] text-ink-mute">
                        {activePosition.farmSite} · stage {stageName(activePosition.currentStage)} ·
                        harvest{" "}
                        {activePosition.projectedHarvestOn
                          ? dateLabel(activePosition.projectedHarvestOn)
                          : "TBC"}
                      </p>
                    </div>
                    <span className="pg-chip pg-chip--locked">
                      <Lock size={10} aria-hidden="true" />
                      {activePosition.rulesChip}
                    </span>
                  </div>

                  <div className="mt-5">
                    <StageRail currentStage={activePosition.currentStage} />
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-5 lg:grid-cols-4">
                    <Figure
                      label="Your verified capital"
                      value={money(activePosition.myCapital)}
                      caption="Counted only from verified payments"
                    />
                    <Figure
                      label="Your locked equity"
                      value={percent(activePosition.equityPercent, 4)}
                      caption="Derived live from the ledger"
                      tone="signal"
                    />
                    <Figure
                      label="Cycle funded"
                      value={percent(activePosition.fundedPercent, 1)}
                      caption={`${money(activePosition.raised)} of ${money(activePosition.targetCapital)}`}
                    />
                    <Figure
                      label="Co-investors"
                      value={number(activePosition.investorCount)}
                      caption="Including you"
                    />
                  </dl>

                  <div className="pg-meter pg-meter--mint mt-4">
                    <span style={{ width: `${Math.min(100, activePosition.fundedPercent)}%` }} />
                  </div>

                  {activePosition.settlement ? (
                    <div className="mt-5 rounded-xl border border-mint/30 bg-mint-soft p-4">
                      <p className="pg-kicker text-mint-deep">Settled — your payout</p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Figure
                          label="Principal"
                          value={money(activePosition.settlement.principal)}
                        />
                        <Figure
                          label="Profit"
                          value={money(activePosition.settlement.profit)}
                          tone="credit"
                        />
                        <Figure label="Total" value={money(activePosition.settlement.total)} />
                        <Figure
                          label="Status"
                          value={activePosition.settlement.payoutStatus}
                          caption={
                            activePosition.settlement.paidAt
                              ? dateLabel(activePosition.settlement.paidAt)
                              : "Awaiting disbursement"
                          }
                        />
                      </dl>
                      {activePosition.settlement.principalAtRisk ? (
                        <p className="mt-3 text-[0.74rem] leading-5 text-rose-700">
                          The harvest did not realise enough revenue to return 100% of principal on
                          this cycle. The shortfall is reported openly rather than absorbed quietly.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="pg-kicker mb-2">Your consent: the locked waterfall</p>
                      <WaterfallLadder rules={activePosition.rules} compact />
                    </div>
                    <div>
                      <p className="pg-kicker mb-2">Payout arithmetic for this cycle</p>
                      <div className="rounded-xl border border-hairline bg-porcelain p-4 text-[0.78rem] leading-6 text-ink-soft">
                        <p>
                          Level 2 returns{" "}
                          <strong className="text-ink-deep">100% of principal</strong> to every
                          verified contributor pro-rata. Your share is your capital divided by the
                          cycle&apos;s verified capital.
                        </p>
                        <p className="mt-2">
                          Level 4 splits what is left:{" "}
                          <span className="fig text-ink-deep">
                            {activePosition.rules.investorSharePercent}% to investors
                          </span>{" "}
                          by that same equity percentage,{" "}
                          <span className="fig text-ink-deep">
                            {activePosition.rules.operatorSharePercent}% to the farm caretaker
                          </span>
                          .
                        </p>
                        <p className="mt-2 text-ink-mute">
                          Both percentages were frozen when the cycle was published and cannot be
                          changed now — not even by an administrator.
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : null}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<Wallet size={18} />}
                title="You have no positions yet"
                action={
                  <Link to="/cycles" className="pg-btn pg-btn--primary">
                    Browse open cycles
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                }
              >
                Your first verified contribution appears here with its equity share, computed from
                the ledger the moment the payment clears.
              </EmptyState>
            </Card>
          )}

          {workspace.openCycles.length > 0 ? (
            <div>
              <p className="pg-kicker">Open for funding</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {workspace.openCycles.map((cycle) => (
                  <Card key={cycle.cycleId} className="p-4" lift>
                    <p className="font-mono text-[0.66rem] uppercase tracking-widest text-signal-deep">
                      {cycle.code}
                    </p>
                    <p className="mt-1 font-display text-[0.9rem] font-semibold text-ink-deep">
                      {cycle.name}
                    </p>
                    <p className="fig mt-2 text-[0.72rem] text-ink-mute">
                      {percent(cycle.fundedPercent, 1)} funded · min {money(cycle.minimumTicket)}
                    </p>
                    <div className="pg-meter mt-2">
                      <span style={{ width: `${Math.min(100, cycle.fundedPercent)}%` }} />
                    </div>
                    <p className="pg-chip pg-chip--locked mt-2.5">{cycle.rulesChip}</p>
                    <ContributeForm
                      cycleId={cycle.cycleId}
                      code={cycle.code}
                      minimumTicket={cycle.minimumTicket}
                      raised={cycle.raised}
                      targetCapital={cycle.targetCapital}
                      onDone={async (message, tone) => {
                        setFlash({ tone, text: message });
                        await refresh();
                      }}
                    />
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Pond updates ---------------------------------------------------- */}
      {tab === "updates" ? (
        <div className="space-y-5">
          {!activeCycleId ? (
            <Card>
              <EmptyState icon={<Waves size={18} />} title="No cycle selected">
                Contribute to a cycle and its pond updates — feed, weights, water and photos —
                appear here as the farm files them.
              </EmptyState>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="pg-kicker">Pond updates</p>
                    <h2 className="mt-1 font-display text-[1.1rem] font-semibold text-ink-deep">
                      {telemetry?.cycleName ?? activePosition?.name ?? "Loading…"}
                    </h2>
                    <p className="mt-0.5 text-[0.72rem] text-ink-mute">
                      Newest first · every entry is checked by a second person before it appears
                    </p>
                  </div>
                  <span className="pg-chip pg-chip--signal shrink-0">
                    <span className="pg-live-dot" />
                    Operator-logged
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-hairline pt-4 lg:grid-cols-4">
                  <Figure
                    label="Latest weight"
                    value={
                      telemetry?.totals.latestWeightG === null ||
                      telemetry?.totals.latestWeightG === undefined
                        ? "—"
                        : `${number(telemetry.totals.latestWeightG, 0)} g`
                    }
                    caption={`${telemetry?.totals.samples ?? 0} samples taken`}
                  />
                  <Figure
                    label="Feed logged"
                    value={`${number(telemetry?.totals.feedKg ?? 0, 1)} kg`}
                    caption="Across approved entries"
                  />
                  <Figure
                    label="Losses"
                    value={number(telemetry?.totals.mortality ?? 0)}
                    caption="Counted, with reasons"
                  />
                  <Figure
                    label="In the pond"
                    value={
                      telemetry?.totals.latestPopulation === null ||
                      telemetry?.totals.latestPopulation === undefined
                        ? "—"
                        : number(telemetry.totals.latestPopulation)
                    }
                    caption={
                      telemetry?.totals.survivalPercent
                        ? `${percent(telemetry.totals.survivalPercent, 1)} survival`
                        : "From the latest count"
                    }
                  />
                </dl>
              </Card>

              {telemetry && telemetry.points.length > 0 ? (
                <ol className="m-0 list-none space-y-3 p-0">
                  {[...telemetry.points].reverse().map((point) => (
                    <PondUpdate
                      key={`${point.logDate}-${point.logType}-${point.notes ?? ""}`}
                      point={point}
                    />
                  ))}
                </ol>
              ) : (
                <Card>
                  <EmptyState icon={<Waves size={18} />} title="No pond entries yet">
                    The farm files its first entry on stocking day. It will appear here the moment
                    it is checked.
                  </EmptyState>
                </Card>
              )}

              {telemetry && telemetry.points.length > 1 ? (
                <Card className="p-5">
                  <p className="pg-kicker">Growth curve</p>
                  <p className="mt-1 text-[0.72rem] text-ink-mute">
                    Only the sample weights the operator actually recorded — nothing smoothed or
                    filled in.
                  </p>
                  <div className="mt-4">
                    <GrowthChart
                      points={telemetry.points}
                      targetWeightG={telemetry.targetWeightG}
                      {...(commodity?.growthUnit ? { unit: commodity.growthUnit } : {})}
                    />
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Statement ------------------------------------------------------- */}
      {tab === "documents" ? (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="pg-kicker">Your paperwork</p>
                <h2 className="mt-1 font-display text-[1.1rem] font-semibold text-ink-deep">
                  Two documents, one page each
                </h2>
                <p className="mt-1 max-w-xl text-[0.78rem] leading-6 text-ink-soft">
                  Both are printed on a single A4 sheet with the co-operative&apos;s header, your
                  name, the cycle and a verification code a bank or a family member can check on{" "}
                  <span className="font-mono text-[0.72rem]">/verify</span>.
                </p>
              </div>
              {documentBusy ? (
                <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-ink-mute">
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  Preparing…
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DocumentButton
                icon={<Printer size={16} />}
                title="Investment certificate"
                body="Proof of your verified stake in a cycle: your name, investor ID, the amount, the date, the Paystack or bank reference and a digital stamp."
                disabled={documentBusy || !latestVerified}
                onClick={() =>
                  latestVerified &&
                  void openDocument("investment_certificate", {
                    investmentId: latestVerified.id,
                  })
                }
                note={
                  latestVerified
                    ? `Latest: ${latestVerified.cycleCode} · ${money(latestVerified.amount)}`
                    : "Available once your first contribution is verified."
                }
              />
              <DocumentButton
                icon={<Receipt size={16} />}
                title="Payment receipt"
                body="A receipt for one payment: the date it was received, the reference, the amount and the verification status — the page a member shows when somebody asks whether they really paid."
                disabled={documentBusy || !latestVerified}
                onClick={() =>
                  latestVerified &&
                  void openDocument("payment_receipt", { investmentId: latestVerified.id })
                }
                note={
                  latestVerified
                    ? (latestVerified.receiptNumber ?? "Receipt number issued on verification")
                    : "Available once your first contribution is verified."
                }
              />
            </div>
          </Card>

          {/* The full book, kept but demoted: a member who needs it scrolls. */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
              <p className="pg-kicker">Every payment you have made</p>
              <span className="text-[0.68rem] text-ink-mute">
                {workspace.investments.length} row{workspace.investments.length === 1 ? "" : "s"}
              </span>
            </div>
            {workspace.investments.length > 0 ? (
              <div className="table-scroll">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Cycle</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                      <th>Receipt</th>
                      <th className="no-print">Print</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.investments.map((investment) => (
                      <tr key={investment.id}>
                        <td className="fig whitespace-nowrap">{dateLabel(investment.date)}</td>
                        <td>
                          <span className="font-mono text-[0.72rem] font-semibold text-ink-soft">
                            {investment.cycleCode}
                          </span>
                        </td>
                        <td className="num">
                          <Money
                            value={investment.amount}
                            tone={investment.status === "success" ? "credit" : "plain"}
                          />
                        </td>
                        <td>
                          <StatusChip
                            status={
                              investment.status === "success"
                                ? "success"
                                : investment.status === "failed"
                                  ? "failed"
                                  : "pending"
                            }
                            label={
                              investment.status === "success"
                                ? "Verified"
                                : investment.status === "failed"
                                  ? "Declined"
                                  : "Awaiting verification"
                            }
                          />
                        </td>
                        <td className="font-mono text-[0.66rem] text-ink-mute">
                          {investment.receiptNumber ?? "—"}
                        </td>
                        <td className="no-print">
                          {investment.status === "success" ? (
                            <div className="flex flex-nowrap items-center gap-1">
                              <button
                                type="button"
                                disabled={documentBusy}
                                onClick={() =>
                                  void openDocument("payment_receipt", {
                                    investmentId: investment.id,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[0.64rem] font-semibold text-ink-soft transition-colors hover:border-hairline-strong hover:text-ink-deep disabled:opacity-50"
                              >
                                <Receipt size={11} aria-hidden="true" />
                                Receipt
                              </button>
                              <button
                                type="button"
                                disabled={documentBusy}
                                onClick={() =>
                                  void openDocument("investment_certificate", {
                                    investmentId: investment.id,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-hairline px-2 py-1 text-[0.64rem] font-semibold text-ink-soft transition-colors hover:border-hairline-strong hover:text-ink-deep disabled:opacity-50"
                              >
                                <Printer size={11} aria-hidden="true" />
                                Certificate
                              </button>
                            </div>
                          ) : (
                            <span className="text-[0.64rem] text-ink-mute">After verification</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<Banknote size={18} />} title="No contributions recorded yet">
                Contribute to an open cycle and the ledger row appears here — pending until the
                payment is verified.
              </EmptyState>
            )}
          </Card>

          {workspace.payouts.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="border-b border-hairline px-4 py-3">
                <p className="pg-kicker">Harvest statements</p>
                <p className="mt-1 text-[0.72rem] text-ink-mute">
                  One page per settled cycle: what it earned, what it cost, and what came to you.
                </p>
              </div>
              <ul className="m-0 list-none divide-y divide-hairline p-0">
                {workspace.payouts.map((payout) => (
                  <li
                    key={payout.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[0.78rem] font-semibold text-ink-deep">
                        {payout.cycleCode} · {payout.cycleName}
                      </p>
                      <p className="fig mt-0.5 text-[0.7rem] text-ink-mute">
                        Principal {money(payout.principal)} · profit {money(payout.profit)} · total{" "}
                        {money(payout.total)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={documentBusy}
                      onClick={() =>
                        void openDocument("harvest_statement", { cycleId: payout.cycleId })
                      }
                      className="pg-btn pg-btn--ghost h-9 text-[0.72rem]"
                    >
                      <Printer size={12} aria-hidden="true" />
                      Print statement
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Liquidity ------------------------------------------------------- */}
      {tab === "stake" && tool === "transfer" ? (
        <LiquidityBoard
          workspace={workspace}
          busy={busy}
          setBusy={setBusy}
          onFlash={(tone, text) => setFlash({ tone, text })}
          onRefresh={refresh}
        />
      ) : null}

      {/* Visits ---------------------------------------------------------- */}
      {tab === "stake" && tool === "visits" ? (
        <VisitsPanel
          workspace={workspace}
          onFlash={(tone, text) => setFlash({ tone, text })}
          onRefresh={refresh}
        />
      ) : null}

      {/* Reinvestment ---------------------------------------------------- */}
      {tab === "stake" && tool === "rollover" ? (
        <RolloverPanel
          workspace={workspace}
          onFlash={(tone, text) => setFlash({ tone, text })}
          onRefresh={refresh}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Document button
 * -------------------------------------------------------------------------- */

function DocumentButton({
  icon,
  title,
  body,
  note,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  note: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex h-full min-w-0 flex-col rounded-xl border border-hairline bg-white p-4 text-left transition-colors hover:border-signal hover:bg-porcelain/50 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-[image:var(--grad-master)] text-navy-deep">
        {icon}
      </span>
      <span className="mt-2.5 font-display text-[0.88rem] font-semibold text-ink-deep">
        {title}
      </span>
      <span className="mt-1 text-[0.72rem] leading-5 text-ink-soft">{body}</span>
      <span className="mt-auto pt-2.5 text-[0.66rem] font-medium text-signal-deep">{note}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- *
 * One pond update
 * -------------------------------------------------------------------------- */

/**
 * A single dated entry, shaped like a message rather than a database row.
 *
 * A feed of rows says "feed / 1.00 / 2026-09-02". A feed of updates says "the
 * farm gave 1kg of feed on 2 September, and here is the photograph". Same data,
 * and only one of them makes a member feel they know what is happening to their
 * money.
 */
function PondUpdate({ point }: { point: CycleTelemetry["points"][number] }) {
  const readings: { label: string; value: string }[] = [];
  if (point.feedKg !== null)
    readings.push({ label: "Feed", value: `${number(point.feedKg, 1)} kg` });
  if (point.sampleAvgWeightG !== null)
    readings.push({ label: "Avg weight", value: `${number(point.sampleAvgWeightG, 0)} g` });
  if (point.mortalityCount !== null && point.mortalityCount > 0)
    readings.push({ label: "Losses", value: number(point.mortalityCount) });
  if (point.populationCount !== null)
    readings.push({ label: "Head count", value: number(point.populationCount) });
  if (point.biomassKg !== null)
    readings.push({ label: "Biomass", value: `${number(point.biomassKg, 1)} kg` });

  const photos = point.media.filter((item) => item.kind === "photo");
  const videos = point.media.filter((item) => item.kind === "video");

  return (
    <li className="pg-card min-w-0 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-[0.78rem] font-semibold capitalize text-ink-deep">
          <span className="grid size-6 place-items-center rounded-full bg-porcelain text-signal-deep">
            <Waves size={12} aria-hidden="true" />
          </span>
          {point.logType.replace(/_/g, " ")}
        </p>
        <span className="fig text-[0.68rem] text-ink-mute">{dateLabel(point.logDate)}</span>
      </div>

      {readings.length > 0 ? (
        <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
          {readings.map((reading) => (
            <li key={reading.label} className="text-[0.72rem] text-ink-soft">
              <span className="text-ink-mute">{reading.label}</span>{" "}
              <span className="fig font-semibold text-ink-deep">{reading.value}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {point.notes ? (
        <p className="mt-2 text-[0.76rem] leading-6 text-ink-soft">{point.notes}</p>
      ) : null}

      {photos.length + videos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-hairline"
              title={photo.caption ?? "Open the full photograph"}
            >
              <img
                src={photo.url}
                alt={photo.caption ?? `Farm proof photograph from ${dateLabel(point.logDate)}`}
                loading="lazy"
                decoding="async"
                className="size-20 object-cover"
              />
            </a>
          ))}
          {videos.map((video) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-porcelain px-3 py-2 text-[0.7rem] font-semibold text-ink-soft no-underline"
            >
              <Play size={12} aria-hidden="true" />
              Watch clip
            </a>
          ))}
        </div>
      ) : null}

      {point.reviewStatus !== "approved" ? (
        <p className="mt-2 text-[0.66rem] text-ink-mute">
          Awaiting the second-person check — visible to you, not yet published.
        </p>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- *
 * Cycle tracker
 * -------------------------------------------------------------------------- */

/**
 * Where the batch actually is.
 *
 * Days are counted from **stocking**, not from the funding open date, and the
 * bar is capped at the cycle's planned length rather than filling to 100% on
 * day one. A cycle that spent twelve weeks collecting money before the
 * fingerlings went in would otherwise look half finished before it started.
 *
 * The remaining days are an estimate and labelled as one: catfish reach table
 * size between 16 and 20 weeks depending on water temperature and feed, and the
 * farm publishes the weigh-in when it happens rather than when the plan said.
 */
function CycleTracker({ position }: { position: MemberWorkspace["positions"][number] | null }) {
  if (!position) {
    return null;
  }

  const start = position.stockedOn ?? position.projectedHarvestOn;
  const harvest = position.projectedHarvestOn;
  const plannedDays = position.cycleWeeks * 7;

  const elapsed =
    position.stockedOn === null
      ? 0
      : Math.max(0, Math.round((Date.now() - new Date(position.stockedOn).getTime()) / 86_400_000));
  const progress = plannedDays > 0 ? Math.min(100, (elapsed / plannedDays) * 100) : 0;
  const remaining = harvest
    ? Math.max(0, Math.round((new Date(harvest).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="pg-kicker">Active cycle tracker</p>
          <h2 className="mt-1 font-display text-[1.1rem] font-semibold text-ink-deep">
            {position.name}
          </h2>
          <p className="mt-0.5 text-[0.72rem] text-ink-mute">
            {position.code} · {position.farmSite}
            {position.stockedOn ? ` · stocked ${dateLabel(position.stockedOn)}` : ""}
          </p>
        </div>
        <StatusChip
          status={position.status === "settled" ? "success" : "info"}
          label={position.status === "active" ? "Growing in pond" : position.status}
        />
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="fig text-[0.74rem] font-semibold text-ink-soft">
            Day {number(elapsed)} of ~{number(plannedDays)}
          </span>
          <span className="fig text-[0.74rem] font-semibold text-ink-deep">
            {percent(progress, 0)} of the planned grow-out
          </span>
        </div>
        <div className="pg-meter pg-meter--mint mt-2" aria-hidden="true">
          <span style={{ width: `${Math.max(2, progress)}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[0.66rem] text-ink-mute">
          <span>{position.stockedOn ? dateLabel(position.stockedOn) : "Stocking date TBC"}</span>
          <span>
            {harvest
              ? `Target harvest ${dateLabel(harvest)}${remaining !== null ? ` · ${number(remaining)} days` : ""}`
              : "Harvest date TBC"}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <StageRail currentStage={position.currentStage} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-hairline pt-4 lg:grid-cols-4">
        <Figure
          label="Your capital here"
          value={money(position.myCapital)}
          caption="Verified only"
        />
        <Figure
          label="Your equity"
          value={percent(position.equityPercent, 2)}
          caption="Derived live"
          tone="signal"
        />
        <Figure
          label="Cycle funded"
          value={percent(position.fundedPercent, 1)}
          caption={`${money(position.raised)} of ${money(position.targetCapital)}`}
        />
        <Figure
          label="Co-investors"
          value={number(position.investorCount)}
          caption="Including you"
        />
      </dl>

      <p className="mt-3 text-[0.68rem] leading-5 text-ink-mute">
        {start
          ? "Days are counted from the day the stock went into the pond, not from the day funding opened."
          : "The farm has not published a stocking date for this cycle yet."}{" "}
        Catfish reach table size between 16 and 20 weeks depending on water temperature and feed;
        the harvest date is an estimate until the weigh-in is recorded.
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- *
 * My stake
 * -------------------------------------------------------------------------- */

/**
 * The one card a member opens the portal to see.
 *
 * Three figures, in the order they matter:
 *
 *   1. what I have actually put in (verified only — pending money is not money),
 *   2. what slice of the cycle that buys me, derived on every read,
 *   3. when I should expect it back.
 *
 * Everything else — the treasury totals, the co-investor count, the waterfall
 * they agreed to — is available one tap down on the cycle tracker. Putting it
 * here would recreate the wall of numbers this screen replaces.
 */
function StakeCard({
  workspace,
  community,
  activePosition,
  onTool,
  onDocuments,
}: {
  workspace: MemberWorkspace;
  community: Awaited<ReturnType<typeof getMemberCommunity>> | null;
  activePosition: MemberWorkspace["positions"][number] | null;
  onTool: (tool: "transfer" | "visits" | "rollover") => void;
  onDocuments: () => void;
}) {
  const harvest = activePosition?.projectedHarvestOn ?? null;
  const daysToHarvest = harvest
    ? Math.max(0, Math.round((new Date(harvest).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="border-b border-hairline bg-porcelain/60 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="pg-kicker">My stake</p>
          {community ? (
            <Link
              to="/portal/feed"
              className="text-[0.7rem] font-semibold text-signal-deep no-underline"
            >
              Farm feed →
            </Link>
          ) : null}
        </div>
      </div>

      <dl className="grid min-w-0 gap-5 p-5 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="pg-kicker">Verified capital in</dt>
          <dd className="mt-1.5">
            <span className="fig block text-[1.7rem] font-bold leading-none text-ink-deep">
              {money(workspace.totals.invested)}
            </span>
            <span className="mt-1.5 block text-[0.68rem] leading-4 text-ink-mute">
              Only money the treasury has confirmed reached the farm.
            </span>
          </dd>
        </div>

        <div className="min-w-0 sm:border-l sm:border-hairline sm:pl-5">
          <dt className="pg-kicker">Your equity share</dt>
          <dd className="mt-1.5">
            <span className="fig block text-[1.7rem] font-bold leading-none text-signal-deep">
              {activePosition ? percent(activePosition.equityPercent, 2) : "—"}
            </span>
            <span className="mt-1.5 block text-[0.68rem] leading-4 text-ink-mute">
              {activePosition
                ? `Of ${activePosition.code}, worked out from the ledger on every load.`
                : "Appears the moment your first contribution is verified."}
            </span>
          </dd>
        </div>

        <div className="min-w-0 sm:border-l sm:border-hairline sm:pl-5">
          <dt className="pg-kicker">Expected payout</dt>
          <dd className="mt-1.5">
            <span className="fig block text-[1.7rem] font-bold leading-none text-ink-deep">
              {harvest ? dateLabel(harvest) : "—"}
            </span>
            <span className="mt-1.5 block text-[0.68rem] leading-4 text-ink-mute">
              {daysToHarvest === null
                ? "No harvest date has been set for your cycle yet."
                : daysToHarvest === 0
                  ? "Harvest window is open. The farm will publish the weigh-in."
                  : `About ${number(daysToHarvest)} days. Weather and market can move it.`}
            </span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-porcelain/40 px-5 py-3">
        <button
          type="button"
          onClick={onDocuments}
          className="pg-btn pg-btn--ghost h-9 text-[0.74rem]"
        >
          <Printer size={13} aria-hidden="true" />
          Print certificate &amp; receipt
        </button>
        <button
          type="button"
          onClick={() => onTool("transfer")}
          className="pg-btn pg-btn--ghost h-9 text-[0.74rem]"
        >
          <Coins size={13} aria-hidden="true" />
          Offer my share
        </button>
        <button
          type="button"
          onClick={() => onTool("visits")}
          className="pg-btn pg-btn--ghost h-9 text-[0.74rem]"
        >
          <CalendarCheck size={13} aria-hidden="true" />
          Visit the farm
        </button>
        <button
          type="button"
          onClick={() => onTool("rollover")}
          className="pg-btn pg-btn--ghost h-9 text-[0.74rem]"
        >
          <Repeat size={13} aria-hidden="true" />
          Reinvest at harvest
        </button>
      </div>

      {workspace.totals.returned > 0 ? (
        <p className="border-t border-hairline px-5 py-2.5 text-[0.7rem] text-ink-mute">
          {money(workspace.totals.returned)} has already come back to you, of which{" "}
          {money(workspace.totals.profit)} was profit.
        </p>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- *
 * Contribute
 * -------------------------------------------------------------------------- */

function ContributeForm({
  cycleId,
  code,
  minimumTicket,
  raised,
  targetCapital,
  onDone,
}: {
  cycleId: string;
  code: string;
  minimumTicket: number;
  /** Verified capital already in this cycle, so the equity preview is live. */
  raised: number;
  targetCapital: number;
  onDone: (message: string, tone: "success" | "error" | "info") => Promise<void>;
}) {
  const start = useServerFn(startContribution);
  const confirm = useServerFn(confirmContribution);
  const bank = useServerFn(requestBankTransfer);

  const [raw, setRaw] = useState(String(Math.max(MIN_CONTRIBUTION, minimumTicket)));
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"card" | "transfer">("card");
  const [bankReference, setBankReference] = useState("");
  const [frequency, setFrequency] = useState<"once" | "monthly">("once");

  // The floor is the brief's ₦5,000 and the cycle's own minimum ticket,
  // whichever is larger — a cycle may ask for more, never for less.
  const floor = Math.max(MIN_CONTRIBUTION, minimumTicket);
  const parsed = parseAmount(raw);
  const amount = parsed.ok ? parsed.amount : 0;
  const belowFloor = parsed.ok && amount < floor;

  // Live equity preview: this amount over the cycle's total once it lands.
  // It is a preview only — the number that counts is computed by the database
  // from verified rows after the payment is confirmed.
  const equityAfter = amount > 0 ? (amount / Math.max(raised + amount, 1)) * 100 : 0;

  async function payWithCard() {
    setBusy(true);
    try {
      const session = await start({ data: { cycleId, amount } });
      await openPaystackCheckout({
        publicKey: session.publicKey,
        email: session.email,
        amount: session.amount,
        reference: session.reference,
        onVerified: async (reference) => {
          await confirm({ data: { reference } });
          await onDone(
            "Payment verified. Your equity in this cycle has been credited from the ledger.",
            "success",
          );
        },
        onClose: () => setBusy(false),
        onError: (message) => {
          void onDone(message, "error");
          setBusy(false);
        },
      });
    } catch (error) {
      await onDone(
        error instanceof Error ? error.message : "Unable to start that payment",
        "error",
      );
      setBusy(false);
    }
  }

  async function submitTransfer() {
    setBusy(true);
    try {
      await bank({
        data: { cycleId, amount, bankReference: bankReference.trim() },
      });
      await onDone(
        "Transfer submitted for verification. No equity is credited until a treasury admin confirms the money landed.",
        "info",
      );
      setBankReference("");
    } catch (error) {
      await onDone(
        error instanceof Error ? error.message : "Unable to submit that transfer",
        "error",
      );
    }
    setBusy(false);
  }

  return (
    <div className="mt-3 border-t border-hairline pt-3">
      {/* Once or monthly ------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            { id: "once", label: "One-time deposit" },
            { id: "monthly", label: "Monthly Agri-Save" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFrequency(option.id)}
            aria-pressed={frequency === option.id}
            className={cn(
              "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
              frequency === option.id ? "bg-navy text-white" : "bg-porcelain text-ink-soft",
            )}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto flex gap-1">
          {(["card", "transfer"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
                mode === option ? "bg-navy text-white" : "bg-porcelain text-ink-soft",
              )}
            >
              {option === "card" ? "Card" : "Transfer"}
            </button>
          ))}
        </span>
      </div>

      {frequency === "monthly" ? (
        <p className="mt-2 rounded-lg border border-signal/30 bg-cyan-50 px-2.5 py-2 text-[0.68rem] leading-5 text-cyan-900">
          A monthly plan schedules this amount every month from ₦
          {MIN_CONTRIBUTION.toLocaleString("en-NG")}. This deposit is the first month. Manage the
          schedule in{" "}
          <Link to="/portal/profile" className="font-semibold underline underline-offset-2">
            Profile → Monthly Agri-Save
          </Link>
          .
        </p>
      ) : null}

      {/* Amount with quick chips ---------------------------------------- */}
      <label className="mt-2.5 block">
        <span className="pg-label">Amount (₦)</span>
        <input
          className="pg-input mt-1 h-11 text-[0.95rem]"
          inputMode="decimal"
          value={raw}
          aria-invalid={!parsed.ok || belowFloor}
          onChange={(event) => setRaw(event.target.value.replace(/[^0-9.]/g, ""))}
        />
      </label>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {QUICK_AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRaw(String(value))}
            aria-pressed={amount === value}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
              amount === value
                ? "border-navy bg-navy text-white"
                : "border-hairline bg-white text-ink-soft hover:border-hairline-strong",
            )}
          >
            {nairaWhole(value)}
          </button>
        ))}
      </div>

      {!parsed.ok ? (
        <p className="mt-1.5 text-[0.68rem] font-medium text-amber-700">{parsed.message}</p>
      ) : belowFloor ? (
        <p className="mt-1.5 text-[0.68rem] font-medium text-amber-700">
          The smallest amount for {code} is {nairaWhole(floor)}.
        </p>
      ) : (
        <p className="fig mt-1.5 text-[0.68rem] text-ink-mute">
          {money(amount)} · live equity after this deposit ≈ {percent(equityAfter, 4)} of{" "}
          {money(targetCapital)} target
        </p>
      )}

      {mode === "transfer" ? (
        <label className="mt-2.5 block">
          <span className="pg-label">Teller / transfer reference</span>
          <input
            className="pg-input h-10"
            value={bankReference}
            onChange={(event) => setBankReference(event.target.value)}
            placeholder="e.g. GTB/20261007/88213"
          />
        </label>
      ) : null}

      <button
        type="button"
        disabled={
          busy ||
          !parsed.ok ||
          belowFloor ||
          (mode === "transfer" && bankReference.trim().length < 4)
        }
        onClick={() => (mode === "card" ? void payWithCard() : void submitTransfer())}
        className="pg-btn pg-btn--primary mt-3 h-10 w-full text-[0.78rem]"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {mode === "card"
          ? `Contribute ${nairaWhole(Number.isFinite(amount) ? amount : 0)} with Paystack`
          : "Submit for verification"}
      </button>
      <p className="mt-2 text-[0.64rem] leading-4 text-ink-mute">
        {code} · minimum {money(floor)}. Card payments are confirmed server-side by the Paystack
        webhook — never by this page.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Liquidity board
 * -------------------------------------------------------------------------- */

function LiquidityBoard({
  workspace,
  busy,
  setBusy,
  onFlash,
  onRefresh,
}: {
  workspace: MemberWorkspace;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onFlash: (tone: "success" | "error" | "info", text: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const create = useServerFn(createShareOffer);
  const withdraw = useServerFn(withdrawShareOffer);
  const claim = useServerFn(claimShareOffer);

  const [heldId, setHeldId] = useState(workspace.heldByCycle[0]?.cycleId ?? "");
  const held = workspace.heldByCycle.find((row) => row.cycleId === heldId);
  const [capital, setCapital] = useState("");
  const [reason, setReason] = useState("");

  async function offer() {
    if (!held) return;
    setBusy(true);
    try {
      await create({
        data: {
          cycleId: held.cycleId,
          capitalAmount: Number(capital),
          askingPrice: Number(capital),
          reason: reason.trim() || undefined,
        },
      });
      onFlash("success", "Offer published to the co-op board at par.");
      setCapital("");
      setReason("");
      await onRefresh();
    } catch (error) {
      onFlash("error", error instanceof Error ? error.message : "Unable to publish that offer");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="pg-kicker">Secondary co-op share transfer</p>
        <h2 className="mt-1 font-display text-[1.1rem] font-semibold text-ink-deep">
          Offer your equity at par, inside the co-operative
        </h2>
        <p className="mt-2 max-w-3xl text-[0.8rem] leading-6 text-ink-soft">
          Capital is committed for the life of a cycle, so if you need liquidity the co-operative
          lets you offer your verified equity to another member. Offers are always at par — the
          platform refuses any premium — and the database refuses an offer larger than what you
          actually hold.
        </p>

        {workspace.heldByCycle.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="pg-label">Cycle you hold</span>
              <select
                className="pg-input"
                value={heldId}
                onChange={(event) => setHeldId(event.target.value)}
              >
                {workspace.heldByCycle.map((row) => (
                  <option key={row.cycleId} value={row.cycleId}>
                    {row.code} · holding {money(row.held)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="pg-label">Capital to offer (₦)</span>
              <input
                className="pg-input"
                inputMode="decimal"
                value={capital}
                onChange={(event) => setCapital(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={held ? String(held.held) : ""}
              />
            </label>
            <label className="block">
              <span className="pg-label">Reason (optional)</span>
              <input
                className="pg-input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. school fees"
              />
            </label>
            <button
              type="button"
              disabled={busy || !held || !Number(capital) || Number(capital) > (held?.held ?? 0)}
              onClick={() => void offer()}
              className="pg-btn pg-btn--primary"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Offer at par
            </button>
          </div>
        ) : (
          <Notice tone="info" className="mt-4">
            You have no verified holding to offer yet. Once a contribution to a running cycle is
            verified, you can offer that equity here.
          </Notice>
        )}

        {held && Number(capital) > held.held ? (
          <p className="mt-2 text-[0.72rem] font-semibold text-rose-600">
            You hold {money(held.held)} in {held.code}. The board will refuse anything above that.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <p className="pg-kicker border-b border-hairline px-4 py-3">Your offers</p>
          {workspace.offers.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-hairline p-0">
              {workspace.offers.map((offer) => (
                <li key={offer.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[0.8rem] font-semibold text-ink-deep">
                      {offer.cycleCode} · <Money value={offer.capitalAmount} />
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                      {dateLabel(offer.createdAt)} · {offer.reason ?? "no reason given"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip
                      status={
                        offer.status === "settled"
                          ? "success"
                          : offer.status === "offered"
                            ? "info"
                            : "pending"
                      }
                      label={offer.status}
                    />
                    {offer.status === "offered" ? (
                      <button
                        type="button"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await withdraw({ data: { offerId: offer.id } });
                            onFlash("info", "Offer withdrawn.");
                            await onRefresh();
                          } catch (error) {
                            onFlash(
                              "error",
                              error instanceof Error ? error.message : "Unable to withdraw",
                            );
                          }
                          setBusy(false);
                        }}
                        className="text-[0.7rem] font-semibold text-rose-600 underline underline-offset-2"
                      >
                        withdraw
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Coins size={18} />} title="You have not offered any equity">
              Any offer you publish appears here with its status and settlement date.
            </EmptyState>
          )}
        </Card>

        <Card className="overflow-hidden">
          <p className="pg-kicker border-b border-hairline px-4 py-3">
            Open offers from other members
          </p>
          {workspace.board.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-hairline p-0">
              {workspace.board.map((offer) => (
                <li key={offer.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[0.8rem] font-semibold text-ink-deep">
                      {offer.cycleCode} · <Money value={offer.capitalAmount} /> at par
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                      {offer.sellerLabel} · {dateLabel(offer.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await claim({ data: { offerId: offer.id } });
                        onFlash(
                          "info",
                          "Interest registered. A treasury admin will confirm your payment, and only then does the equity move in the ledger.",
                        );
                        await onRefresh();
                      } catch (error) {
                        onFlash(
                          "error",
                          error instanceof Error ? error.message : "Unable to claim that offer",
                        );
                      }
                      setBusy(false);
                    }}
                    className="pg-btn pg-btn--ghost h-8 px-3 text-[0.72rem]"
                  >
                    Claim
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Wallet size={18} />} title="No live offers on the board">
              When another member offers equity for liquidity, it appears here at par value.
            </EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Farm visits
 * -------------------------------------------------------------------------- */

function VisitsPanel({
  workspace,
  onFlash,
  onRefresh,
}: {
  workspace: MemberWorkspace;
  onFlash: (tone: "success" | "error" | "info", text: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const book = useServerFn(bookFarmVisit);
  const cancel = useServerFn(cancelFarmVisit);

  const [visitDate, setVisitDate] = useState("");
  const [slot, setSlot] = useState<"morning" | "afternoon">("morning");
  const [guests, setGuests] = useState("1");
  const [cycleId, setCycleId] = useState(workspace.positions[0]?.cycleId ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }, []);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="pg-kicker">Farm visit booking</p>
        <h2 className="mt-1 font-display text-[1.1rem] font-semibold text-ink-deep">
          Inspect the farm in person
        </h2>
        <p className="mt-2 max-w-3xl text-[0.8rem] leading-6 text-ink-soft">
          Verified investors can request a weekend inspection. The farm operator on the ground
          confirms the slot — we only publish visits we can genuinely host, and a declined request
          comes with a reason.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] md:items-end">
          <label className="block">
            <span className="pg-label">Cycle to inspect</span>
            <select
              className="pg-input"
              value={cycleId}
              onChange={(event) => setCycleId(event.target.value)}
            >
              <option value="">General farm visit</option>
              {workspace.positions.map((position) => (
                <option key={position.cycleId} value={position.cycleId}>
                  {position.code} · {position.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="pg-label">Preferred date</span>
            <input
              type="date"
              className="pg-input"
              min={tomorrow}
              value={visitDate}
              onChange={(event) => setVisitDate(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="pg-label">Slot</span>
            <select
              className="pg-input"
              value={slot}
              onChange={(event) => setSlot(event.target.value as "morning" | "afternoon")}
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
            </select>
          </label>
          <label className="block">
            <span className="pg-label">Guests</span>
            <input
              type="number"
              min={1}
              max={8}
              className="pg-input"
              value={guests}
              onChange={(event) => setGuests(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || !visitDate}
            onClick={async () => {
              setBusy(true);
              try {
                await book({
                  data: {
                    cycleId: cycleId || null,
                    visitDate,
                    slot,
                    guests: Number(guests),
                    memberNote: note.trim() || undefined,
                  },
                });
                onFlash("success", "Visit requested. The farm operator will confirm or decline.");
                setVisitDate("");
                await onRefresh();
              } catch (error) {
                onFlash(
                  "error",
                  error instanceof Error ? error.message : "Unable to request that visit",
                );
              }
              setBusy(false);
            }}
            className="pg-btn pg-btn--primary"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Request visit
          </button>
        </div>

        <label className="mt-3 block">
          <span className="pg-label">Anything the farm should know (optional)</span>
          <input
            className="pg-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. bringing two co-investors, arriving by 9am"
          />
        </label>
      </Card>

      <Card className="overflow-hidden">
        <p className="pg-kicker border-b border-hairline px-4 py-3">Your visit requests</p>
        {workspace.visits.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-hairline p-0">
            {workspace.visits.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-[0.82rem] font-semibold text-ink-deep">
                    {dateLabel(visit.visitDate)} · {visit.slot}
                  </p>
                  <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                    {visit.cycleCode ? `Cycle ${visit.cycleCode} · ` : ""}
                    {visit.guests} guest{visit.guests === 1 ? "" : "s"}
                    {visit.memberNote ? ` · ${visit.memberNote}` : ""}
                  </p>
                  {visit.decisionNote ? (
                    <p className="mt-1 text-[0.7rem] text-ink-soft">Farm: {visit.decisionNote}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
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
                  {visit.status === "requested" ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await cancel({ data: { visitId: visit.id } });
                          onFlash("info", "Visit request cancelled.");
                          await onRefresh();
                        } catch (error) {
                          onFlash(
                            "error",
                            error instanceof Error ? error.message : "Unable to cancel",
                          );
                        }
                      }}
                      className="text-[0.7rem] font-semibold text-rose-600 underline underline-offset-2"
                    >
                      cancel
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<CalendarCheck size={18} />} title="No visits booked">
            Request a weekend inspection and the farm will confirm what it can host.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Rollover
 * -------------------------------------------------------------------------- */

function RolloverPanel({
  workspace,
  onFlash,
  onRefresh,
}: {
  workspace: MemberWorkspace;
  onFlash: (tone: "success" | "error" | "info", text: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const save = useServerFn(saveRolloverInstruction);
  const [mode, setMode] = useState(workspace.rollover?.mode ?? "off");
  const [preferred, setPreferred] = useState(workspace.rollover?.preferredCycleId ?? "");
  const [busy, setBusy] = useState(false);

  const options: { id: string; label: string; body: string }[] = [
    { id: "off", label: "Do not reinvest", body: "Pay everything out to me at settlement." },
    {
      id: "principal",
      label: "Roll the principal",
      body: "Your capital goes back to work; profit is paid out.",
    },
    {
      id: "profit",
      label: "Roll the profit",
      body: "Profit compounds into the next cycle; principal is paid out.",
    },
    {
      id: "both",
      label: "Roll both",
      body: "Principal and profit both compound into the next cycle.",
    },
  ];

  return (
    <Card className="p-5">
      <p className="pg-kicker">Automatic rollover</p>
      <h2 className="mt-1 font-display text-[1.1rem] font-semibold text-ink-deep">
        Put your harvest straight back to work
      </h2>
      <p className="mt-2 max-w-3xl text-[0.8rem] leading-6 text-ink-soft">
        Choose what happens to your settlement before it is paid. When the treasury closes a cycle,
        members with an instruction have their chosen portion credited into the next open cycle —
        and the movement is recorded with the source cycle attached, so the money stays traceable.
      </p>

      <fieldset className="mt-4 space-y-2">
        <legend className="pg-label">Your instruction</legend>
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
              mode === option.id
                ? "border-signal bg-cyan-50/60"
                : "border-hairline bg-white hover:border-hairline-strong",
            )}
          >
            <input
              type="radio"
              name="rollover-mode"
              value={option.id}
              checked={mode === option.id}
              onChange={() => setMode(option.id)}
              className="mt-1 accent-[var(--signal)]"
            />
            <span>
              <strong className="block font-display text-[0.85rem] font-semibold text-ink-deep">
                {option.label}
              </strong>
              <span className="mt-0.5 block text-[0.75rem] leading-5 text-ink-mute">
                {option.body}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="mt-4 block max-w-md">
        <span className="pg-label">Preferred destination cycle (optional)</span>
        <select
          className="pg-input"
          value={preferred}
          onChange={(event) => setPreferred(event.target.value)}
        >
          <option value="">The next cycle to open</option>
          {workspace.openCycles.map((cycle) => (
            <option key={cycle.cycleId} value={cycle.cycleId}>
              {cycle.code} · {cycle.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save({
                data: {
                  mode: mode as "off" | "principal" | "profit" | "both",
                  preferredCycleId: preferred || null,
                },
              });
              onFlash("success", "Reinvestment instruction saved.");
              await onRefresh();
            } catch (error) {
              onFlash(
                "error",
                error instanceof Error ? error.message : "Unable to save that preference",
              );
            }
            setBusy(false);
          }}
          className="pg-btn pg-btn--primary"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          Save instruction
        </button>
        <span className="text-[0.72rem] text-ink-mute">
          {workspace.rollover
            ? `Currently: ${workspace.rollover.mode === "off" ? "pay out everything" : `roll ${workspace.rollover.mode}`}`
            : "No instruction saved yet"}
        </span>
      </div>

      <p className="mt-4 flex gap-2 rounded-xl border border-hairline bg-porcelain px-3.5 py-3 text-[0.72rem] leading-5 text-ink-soft">
        <Lock size={13} className="mt-0.5 shrink-0 text-ink-mute" aria-hidden="true" />
        <span>
          A rollover never bypasses the waterfall. It only moves money you have already been awarded
          by a completed settlement, and only into a cycle that is still open for funding.
        </span>
      </p>
    </Card>
  );
}
