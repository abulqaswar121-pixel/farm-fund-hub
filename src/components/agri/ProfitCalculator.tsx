import { useMemo, useState } from "react";
import { Info, Lock, TrendingUp } from "lucide-react";

import { money, percent } from "@/lib/agri/format";
import { projectInvestment, type CycleRules } from "@/lib/agri/rules";

export type CalculatorCycle = {
  id: string;
  code: string;
  name: string;
  targetCapital: number;
  raised: number;
  minimumTicket: number;
  projectedRevenue: number;
  projectedLiabilities: number;
  rules: CycleRules;
};

/**
 * The interactive ROI calculator.
 *
 * It does not invent a return. It runs the *same* waterfall the settlement
 * engine will run, against the cycle's own published plan, and shows every
 * level of that arithmetic so a member can see exactly where their money would
 * come from — and where it would not.
 */
export function ProfitCalculator({ cycles }: { cycles: CalculatorCycle[] }) {
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? "");
  const active = cycles.find((cycle) => cycle.id === cycleId) ?? cycles[0];

  const [amount, setAmount] = useState(() => Math.max(active?.minimumTicket ?? 50_000, 50_000));

  const result = useMemo(() => {
    if (!active) return null;
    const invested = Math.min(Math.max(amount, active.minimumTicket), active.targetCapital);
    return {
      ...projectInvestment({
        amount: invested,
        projectedRevenue: active.projectedRevenue,
        targetCapital: active.targetCapital,
        raisedCapital: active.raised,
        operationalLiabilities: active.projectedLiabilities,
        rules: active.rules,
      }),
      invested,
    };
  }, [active, amount]);

  if (!active || !result) {
    return (
      <div className="pg-panel-dark p-6">
        <p className="pg-kicker pg-kicker--onDark">Return calculator</p>
        <p className="mt-2 text-sm text-slate-400">
          The calculator opens with the first published cycle. There is nothing to model yet.
        </p>
      </div>
    );
  }

  const min = active.minimumTicket;
  const max = active.targetCapital;
  const step = Math.max(1000, Math.round(min / 10 / 1000) * 1000);

  return (
    <div className="pg-panel-dark overflow-hidden">
      <div className="border-b border-navy-line px-5 py-4">
        <p className="pg-kicker pg-kicker--onDark">Interactive return calculator</p>
        <h3 className="mt-1 font-display text-lg font-bold text-white">
          Model a contribution against {active.code}
        </h3>
        <p className="mt-1 text-[0.75rem] leading-5 text-slate-400">
          Runs the same four-level waterfall the settlement engine runs, against this cycle&apos;s
          own published plan — never a promised return.
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5 border-navy-line p-5 lg:border-r">
          {cycles.length > 1 ? (
            <label className="block">
              <span className="pg-kicker pg-kicker--onDark">Cycle</span>
              <select
                value={cycleId}
                onChange={(event) => setCycleId(event.target.value)}
                className="pg-input mt-1.5 border-navy-line bg-navy-soft text-white"
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.code} · {cycle.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="pg-kicker pg-kicker--onDark">Your contribution</span>
              <span className="fig text-lg font-bold text-white">{money(result.invested)}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={result.invested}
              onChange={(event) => setAmount(Number(event.target.value))}
              aria-label="Contribution amount"
              className="mt-3 w-full accent-[var(--signal)]"
            />
            <div className="fig mt-1 flex justify-between text-[0.68rem] text-slate-500">
              <span>{money(min)}</span>
              <span>{money(max)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-navy-line bg-navy-soft/60 p-3">
              <p className="pg-kicker pg-kicker--onDark">Your equity</p>
              <p className="fig mt-1 text-lg font-bold text-signal">
                {percent(result.equityPercent, 2)}
              </p>
              <p className="mt-1 text-[0.66rem] leading-4 text-slate-400">
                Of {(active.targetCapital / 1_000_000).toFixed(1)}M fully funded
              </p>
            </div>
            <div className="rounded-xl border border-navy-line bg-navy-soft/60 p-3">
              <p className="pg-kicker pg-kicker--onDark">Projected ROI</p>
              <p
                className={`fig mt-1 text-lg font-bold ${
                  result.roiPercent >= 0 ? "text-mint" : "text-coral"
                }`}
              >
                {result.roiPercent >= 0 ? "+" : ""}
                {percent(result.roiPercent, 1)}
              </p>
              <p className="mt-1 text-[0.66rem] leading-4 text-slate-400">If the plan holds</p>
            </div>
          </div>

          <p className="pg-chip pg-chip--locked">
            <Lock size={10} aria-hidden="true" />
            {active.rules.investorSharePercent}/{active.rules.operatorSharePercent} split ·{" "}
            {active.rules.reservePercent}% reserve · locked at publication
          </p>
        </div>

        <div className="p-5">
          <p className="pg-kicker pg-kicker--onDark">Where your money would come from</p>
          <ul className="mt-3 space-y-2.5">
            <Row label="Your principal returned" value={result.investorPrincipal} />
            <Row
              label={`Your ${active.rules.investorSharePercent}% profit share`}
              value={result.investorProfit}
              highlight
            />
            <li className="flex items-baseline justify-between gap-3 border-t border-navy-line pt-3">
              <span className="text-[0.8rem] font-semibold text-white">Your total payout</span>
              <span className="fig text-xl font-bold text-mint">{money(result.investorTotal)}</span>
            </li>
          </ul>

          <div className="mt-5 space-y-1.5 rounded-xl border border-navy-line bg-navy-deep/60 p-3.5">
            <p className="pg-kicker pg-kicker--onDark">The cycle&apos;s waterfall</p>
            {[
              ["Level 1 · supplier debts", result.liabilitiesPaid],
              ["Level 2 · all principal", result.principalReturned],
              ["Level 3 · co-op reserve", result.reserveSetAside],
              ["Level 4 · net profit", result.netProfit],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-3">
                <span className="text-[0.7rem] text-slate-400">{label as string}</span>
                <span className="fig text-[0.72rem] text-slate-300">{money(value as number)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-t border-navy-line pt-1.5">
              <span className="text-[0.7rem] text-slate-400">Farm caretaker fee</span>
              <span className="fig text-[0.72rem] text-slate-300">{money(result.operatorFee)}</span>
            </div>
          </div>

          <p className="mt-4 flex gap-2 text-[0.68rem] leading-4 text-slate-500">
            <Info size={13} className="mt-0.5 shrink-0 text-amber-alert" aria-hidden="true" />
            <span>
              A projection, not a promise. Agriculture carries disease, weather and market risk: a
              harvest can return less than plan, and Level 2 principal depends on the harvest
              realising enough revenue. Read the{" "}
              <a href="/legal/risk" className="font-semibold text-signal no-underline">
                risk statement
              </a>
              .
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-1.5 text-[0.78rem] text-slate-300">
        {highlight ? <TrendingUp size={12} className="text-mint" aria-hidden="true" /> : null}
        {label}
      </span>
      <span
        className={`fig text-[0.85rem] font-semibold ${highlight ? "text-mint" : "text-white"}`}
      >
        {money(value)}
      </span>
    </li>
  );
}
