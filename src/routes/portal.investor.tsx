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
  Loader2,
  Lock,
  RefreshCw,
  Repeat,
  Sprout,
  Wallet,
} from "lucide-react";

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
import { openPaystackCheckout } from "@/lib/paystack-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/investor")({
  component: InvestorPortal,
});

type Tab = "portfolio" | "telemetry" | "statement" | "liquidity" | "visits" | "settings";

const TABS: { id: Tab; label: string; icon: typeof Gauge }[] = [
  { id: "portfolio", label: "Portfolio", icon: Gauge },
  { id: "telemetry", label: "Live telemetry", icon: Sprout },
  { id: "statement", label: "Statement & payouts", icon: FileText },
  { id: "liquidity", label: "Share transfer", icon: Coins },
  { id: "visits", label: "Farm visits", icon: CalendarCheck },
  { id: "settings", label: "Reinvestment", icon: Repeat },
];

function InvestorPortal() {
  const loadWorkspace = useServerFn(getMemberWorkspace);
  const loadTelemetry = useServerFn(getCycleTelemetry);

  const [workspace, setWorkspace] = useState<MemberWorkspace | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("portfolio");
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
  const commodity = COMMODITIES.find((item) => item.id === activePosition?.commodity);

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

      {/* KPIs ------------------------------------------------------------ */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <Figure
            label="Total contributed"
            value={money(workspace.totals.invested)}
            caption="Verified capital, all time"
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Capital working"
            value={money(workspace.totals.activeCapital)}
            caption="In cycles yet to settle"
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Returned to you"
            value={money(workspace.totals.returned)}
            caption={
              workspace.totals.returned > 0 ? "Principal + profit paid" : "No settlement yet"
            }
            tone={workspace.totals.returned > 0 ? "credit" : "plain"}
          />
        </Card>
        <Card className="p-4">
          <Figure
            label="Profit earned"
            value={money(workspace.totals.profit)}
            caption="Your 70% share, after the waterfall"
            tone={workspace.totals.profit > 0 ? "credit" : "plain"}
          />
        </Card>
      </dl>

      {/* Tabs ------------------------------------------------------------ */}
      <div className="pg-portal-tabs border-b border-hairline pb-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
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
      {tab === "portfolio" ? (
        <div className="space-y-6">
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

      {/* Telemetry ------------------------------------------------------- */}
      {tab === "telemetry" ? (
        <div className="space-y-5">
          {!activeCycleId ? (
            <Card>
              <EmptyState title="No cycle selected">
                Contribute to a cycle and its live pond telemetry — growth samples, feed consumption
                and mortality — appears here.
              </EmptyState>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="pg-kicker">Live stock telemetry</p>
                    <h2 className="mt-1 font-display text-[1.15rem] font-semibold text-ink-deep">
                      {telemetry?.cycleName ?? "Loading…"}
                    </h2>
                    <p className="mt-1 text-[0.75rem] text-ink-mute">
                      {commodity?.growthUnit} · target {commodity?.targetYieldLabel}
                    </p>
                  </div>
                  <span className="pg-chip pg-chip--signal">
                    <span className="pg-live-dot" />
                    Operator-logged
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-4 border-b border-hairline pb-4 lg:grid-cols-5">
                  <Figure
                    label="Latest sample"
                    value={
                      telemetry?.totals.latestWeightG === null ||
                      telemetry?.totals.latestWeightG === undefined
                        ? "—"
                        : `${number(telemetry.totals.latestWeightG, 0)} g`
                    }
                    caption={`${telemetry?.totals.samples ?? 0} samples taken`}
                  />
                  <Figure
                    label="Feed consumed"
                    value={`${number(telemetry?.totals.feedKg ?? 0, 1)} kg`}
                    caption="Across all approved logs"
                  />
                  <Figure
                    label="Mortality"
                    value={number(telemetry?.totals.mortality ?? 0)}
                    caption="Counted, with reasons logged"
                  />
                  <Figure
                    label="Survival"
                    value={
                      telemetry?.totals.survivalPercent
                        ? percent(telemetry.totals.survivalPercent, 1)
                        : "—"
                    }
                    caption="First to latest head count"
                  />
                  <Figure
                    label="Feed conversion"
                    value={telemetry?.totals.fcr ? number(telemetry.totals.fcr, 2) : "—"}
                    caption="kg feed per kg biomass gained"
                  />
                </dl>

                <div className="mt-5">
                  <GrowthChart
                    points={telemetry?.points ?? []}
                    targetWeightG={telemetry?.targetWeightG ?? null}
                    {...(commodity?.growthUnit ? { unit: commodity.growthUnit } : {})}
                  />
                </div>
              </Card>

              {telemetry && telemetry.points.length > 0 ? (
                <Card className="overflow-hidden">
                  <p className="pg-kicker border-b border-hairline px-4 py-3">
                    Field log — most recent last
                  </p>
                  <div className="table-scroll">
                    <table className="pg-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th className="num">Feed kg</th>
                          <th className="num">Sample g</th>
                          <th className="num">Mortality</th>
                          <th>Note</th>
                          <th>Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {telemetry.points.slice(-14).map((point) => (
                          <tr key={`${point.logDate}-${point.logType}-${point.notes ?? ""}`}>
                            <td className="fig whitespace-nowrap">{dateLabel(point.logDate)}</td>
                            <td className="capitalize">{point.logType.replace(/_/g, " ")}</td>
                            <td className="num fig">
                              {point.feedKg === null ? "—" : number(point.feedKg, 1)}
                            </td>
                            <td className="num fig">
                              {point.sampleAvgWeightG === null
                                ? "—"
                                : number(point.sampleAvgWeightG, 0)}
                            </td>
                            <td className="num fig">{point.mortalityCount ?? "—"}</td>
                            <td className="max-w-xs text-ink-mute">{point.notes ?? "—"}</td>
                            <td>
                              <StatusChip
                                status={point.reviewStatus === "approved" ? "success" : "pending"}
                                label={point.reviewStatus}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Statement ------------------------------------------------------- */}
      {tab === "statement" ? (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
              <p className="pg-kicker">Itemised contribution ledger</p>
              <span className="text-[0.7rem] text-ink-mute">
                Every row is a record of money actually received
              </span>
            </div>
            {workspace.investments.length > 0 ? (
              <div className="table-scroll">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Cycle</th>
                      <th>Method</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                      <th>Reference</th>
                      <th>Receipt</th>
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
                        <td className="capitalize">{investment.method}</td>
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
                          {investment.reference ?? "—"}
                        </td>
                        <td className="font-mono text-[0.66rem] text-ink-mute">
                          {investment.receiptNumber ?? "—"}
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

          <Card className="overflow-hidden">
            <div className="border-b border-hairline px-4 py-3">
              <p className="pg-kicker">Waterfall settlement breakdown</p>
              <p className="mt-1 text-[0.72rem] text-ink-mute">
                What each settled cycle actually paid you, and the level it came from.
              </p>
            </div>
            {workspace.payouts.length > 0 ? (
              <div className="table-scroll">
                <table className="pg-table">
                  <thead>
                    <tr>
                      <th>Cycle</th>
                      <th className="num">Capital</th>
                      <th className="num">Equity at settlement</th>
                      <th className="num">Level 2 · principal</th>
                      <th className="num">Level 4 · profit</th>
                      <th className="num">Total</th>
                      <th>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.payouts.map((payout) => (
                      <tr key={payout.id}>
                        <td>
                          <span className="font-mono text-[0.72rem] font-semibold text-ink-soft">
                            {payout.cycleCode}
                          </span>
                          <span className="ml-2 text-[0.7rem] text-ink-mute">
                            {payout.cycleName}
                          </span>
                        </td>
                        <td className="num">
                          <Money value={payout.capital} />
                        </td>
                        <td className="num fig">{percent(payout.equityPercent, 4)}</td>
                        <td className="num">
                          <Money value={payout.principal} />
                        </td>
                        <td className="num">
                          <Money value={payout.profit} tone="credit" />
                        </td>
                        <td className="num font-semibold">
                          <Money value={payout.total} />
                        </td>
                        <td>
                          <StatusChip
                            status={payout.payoutStatus === "paid" ? "success" : "pending"}
                            label={
                              payout.payoutStatus === "paid"
                                ? `Paid ${dateLabel(payout.paidAt)}`
                                : payout.payoutStatus
                            }
                          />
                          {payout.reference ? (
                            <span className="mt-1 block font-mono text-[0.62rem] text-ink-mute">
                              {payout.reference}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<FileText size={18} />} title="No settlements yet">
                When a cycle you back reaches harvest and the waterfall runs, its full breakdown —
                level by level, down to your own line — is published in this table.
              </EmptyState>
            )}
          </Card>
        </div>
      ) : null}

      {/* Liquidity ------------------------------------------------------- */}
      {tab === "liquidity" ? (
        <LiquidityBoard
          workspace={workspace}
          busy={busy}
          setBusy={setBusy}
          onFlash={(tone, text) => setFlash({ tone, text })}
          onRefresh={refresh}
        />
      ) : null}

      {/* Visits ---------------------------------------------------------- */}
      {tab === "visits" ? (
        <VisitsPanel
          workspace={workspace}
          onFlash={(tone, text) => setFlash({ tone, text })}
          onRefresh={refresh}
        />
      ) : null}

      {/* Reinvestment ---------------------------------------------------- */}
      {tab === "settings" ? (
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
 * Contribute
 * -------------------------------------------------------------------------- */

function ContributeForm({
  cycleId,
  code,
  minimumTicket,
  onDone,
}: {
  cycleId: string;
  code: string;
  minimumTicket: number;
  onDone: (message: string, tone: "success" | "error" | "info") => Promise<void>;
}) {
  const start = useServerFn(startContribution);
  const confirm = useServerFn(confirmContribution);
  const bank = useServerFn(requestBankTransfer);

  const [amount, setAmount] = useState(String(minimumTicket));
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"card" | "transfer">("card");
  const [bankReference, setBankReference] = useState("");

  async function payWithCard() {
    setBusy(true);
    try {
      const session = await start({ data: { cycleId, amount: Number(amount) } });
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
        data: { cycleId, amount: Number(amount), bankReference: bankReference.trim() },
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
      <div className="flex gap-1">
        {(["card", "transfer"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
              mode === option ? "bg-navy text-white" : "bg-porcelain text-ink-soft",
            )}
          >
            {option === "card" ? "Pay with card" : "Bank transfer"}
          </button>
        ))}
      </div>

      <label className="mt-2.5 block">
        <span className="pg-label">Amount (₦)</span>
        <input
          className="pg-input h-10"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
        />
      </label>

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
        disabled={busy || Number(amount) < minimumTicket}
        onClick={() => (mode === "card" ? void payWithCard() : void submitTransfer())}
        className="pg-btn pg-btn--primary mt-3 h-10 w-full text-[0.78rem]"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        {mode === "card" ? "Contribute with Paystack" : "Submit for verification"}
      </button>
      <p className="mt-2 text-[0.64rem] leading-4 text-ink-mute">
        {code} · minimum {money(minimumTicket)}. Card payments are confirmed server-side by the
        Paystack webhook — never by this page.
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
