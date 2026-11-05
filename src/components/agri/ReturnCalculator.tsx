import { useMemo, useState } from "react";
import { Calculator, Info, PiggyBank, Sprout } from "lucide-react";

import { MIN_CONTRIBUTION, QUICK_AMOUNTS, nairaWhole, parseAmount } from "@/lib/agri/contribution";
import { money, percent } from "@/lib/agri/format";
import { useLocale } from "@/lib/agri/i18n";
import { DEFAULT_RULES } from "@/lib/agri/rules";
import { cn } from "@/lib/utils";

/**
 * The visitor's return calculator.
 *
 * It runs the published 70/30 harvest split on numbers the visitor chooses —
 * the amount they would put in, and the yield they think the batch will make.
 * It is deliberately *not* tied to a real cycle: a public page may not publish
 * what a cycle expects to earn, so pretending to model one would be a lie with
 * a currency symbol in front of it.
 *
 * What it does do is show the mechanism honestly:
 *   * the profit pool is the harvest profit *after* bills and members' capital,
 *   * the member's share of that pool is their money ÷ the pool,
 *   * the net return is principal + their slice, less what they put in.
 */
export function ReturnCalculator({ className }: { className?: string }) {
  const { t } = useLocale();
  const [raw, setRaw] = useState("25,000");
  const [harvestProfit, setHarvestProfit] = useState(2_500_000);

  const parsed = useMemo(() => parseAmount(raw), [raw]);
  const amount = parsed.ok ? parsed.amount : 0;

  // The example pool is the amount plus a plausible field of other members,
  // scaled so the visitor's own share stays readable at any ticket size.
  const examplePool = Math.max(2_000_000, Math.round((amount * 40) / 100_000) * 100_000);

  const memberSharePercent = examplePool > 0 ? (amount / examplePool) * 100 : 0;
  const memberProfitPool = (harvestProfit * DEFAULT_RULES.investorSharePercent) / 100;
  const yourProfit = (memberProfitPool * memberSharePercent) / 100;
  const netReturn = amount + yourProfit;

  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[image:var(--grad-master)] text-navy-deep">
          <Calculator size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="pg-kicker">{t("calc.kicker")}</p>
          <h3 className="mt-0.5 font-display text-[1.05rem] font-bold leading-tight text-ink-deep sm:text-[1.2rem]">
            {t("calc.title")}
          </h3>
        </div>
      </div>

      <div className="mt-5">
        <label className="block">
          <span className="pg-label">{t("calc.amount")}</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[0.95rem] font-semibold text-ink-mute">
              ₦
            </span>
            <input
              className="pg-input h-12 pl-7 text-[1rem]"
              inputMode="decimal"
              value={raw}
              aria-invalid={!parsed.ok}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="25,000"
            />
          </div>
        </label>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRaw(value.toLocaleString("en-NG"))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold transition-colors",
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
          <p className="mt-2 text-[0.72rem] font-medium text-amber-700">{parsed.message}</p>
        ) : (
          <p className="mt-2 text-[0.7rem] text-ink-mute">
            {t("common.minimum")} {nairaWhole(MIN_CONTRIBUTION)}. No card details are asked for on
            this page.
          </p>
        )}
      </div>

      <label className="mt-4 block">
        <span className="pg-label">Harvest profit in the example</span>
        <input
          type="range"
          min={500_000}
          max={12_000_000}
          step={250_000}
          value={harvestProfit}
          onChange={(event) => setHarvestProfit(Number(event.target.value))}
          className="pg-range mt-2 w-full"
          aria-valuetext={money(harvestProfit)}
        />
        <span className="fig mt-1 block text-[0.78rem] font-semibold text-ink-deep">
          {money(harvestProfit)}
        </span>
        <span className="mt-0.5 block text-[0.68rem] leading-4 text-ink-mute">
          Profit left after bills and every member&apos;s capital has been returned.
        </span>
      </label>

      <dl className="mt-5 grid gap-3 rounded-xl border border-hairline bg-porcelain p-4">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[0.74rem] text-ink-soft">Your share of the example pool</dt>
          <dd className="fig text-[0.82rem] font-semibold text-ink-deep">
            {percent(memberSharePercent, 2)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[0.74rem] text-ink-soft">{t("calc.profitShare")}</dt>
          <dd className="fig text-[0.82rem] font-semibold text-mint-deep">
            {money(amount > 0 ? yourProfit : 0)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
          <dt className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink-deep">
            <PiggyBank size={14} className="text-mint-deep" aria-hidden="true" />
            {t("calc.netReturn")}
          </dt>
          <dd className="fig text-[1.05rem] font-bold text-ink-deep">
            {money(amount > 0 ? netReturn : 0)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="inline-flex items-center gap-1.5 text-[0.7rem] text-ink-mute">
            <Sprout size={12} className="text-mint-deep" aria-hidden="true" />
            {DEFAULT_RULES.investorSharePercent}% of profit goes to members
          </dt>
          <dd className="fig text-[0.7rem] text-ink-mute">
            {DEFAULT_RULES.operatorSharePercent}% caretaker
          </dd>
        </div>
      </dl>

      <p className="mt-3 flex gap-2 text-[0.68rem] leading-5 text-ink-mute">
        <Info size={12} className="mt-0.5 shrink-0 text-signal-deep" aria-hidden="true" />
        <span>{t("calc.disclaimer")}</span>
      </p>
    </div>
  );
}
