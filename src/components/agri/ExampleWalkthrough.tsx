import { useMemo, useState } from "react";
import { AlertTriangle, Info, Lock } from "lucide-react";

import { money, percent } from "@/lib/agri/format";
import { NUMBER_HINT } from "@/lib/agri/plain";
import { runExample } from "@/lib/agri/example";

/**
 * The public calculator — an example, driven by the visitor.
 *
 * There is no real cycle behind these numbers, and that is the point: a public
 * page may not publish what a cycle expects to earn or what it owes, so it does
 * not pretend to model one. Instead the visitor moves four sliders on a
 * made-up cycle and watches the same four-level settlement the platform will
 * run at a real harvest.
 *
 * It is deliberately dressed as a white bordered container on the porcelain
 * canvas, so it reads as a working tool rather than a black box — and every
 * figure carries a sentence saying what it is.
 */
export function ExampleWalkthrough() {
  const [youPutIn, setYouPutIn] = useState(200_000);
  const [capitalPool, setCapitalPool] = useState(5_000_000);
  const [saleTotal, setSaleTotal] = useState(9_000_000);
  const [billsOwed, setBillsOwed] = useState(2_000_000);

  const outcome = useMemo(
    () => runExample({ youPutIn, saleTotal, billsOwed, capitalPool }),
    [youPutIn, saleTotal, billsOwed, capitalPool],
  );

  return (
    <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="min-w-0">
        <p className="pg-kicker">Example only · change any number</p>
        <h3 className="mt-1.5 font-display text-[1.15rem] font-bold leading-tight text-ink-deep sm:text-[1.3rem]">
          See where the money goes before you put any in
        </h3>
        <p className="mt-2 max-w-2xl text-[0.83rem] leading-6 text-ink-soft">
          Move the sliders to build a made-up cycle. The order of payments never changes: bills
          first, then everyone&apos;s money back, then a small safety slice, then profit.{" "}
          {NUMBER_HINT.example}
        </p>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* The controls. */}
        <div className="min-w-0 space-y-5">
          <Slider
            label="You put in"
            hint={NUMBER_HINT.minTicket}
            value={youPutIn}
            min={10_000}
            max={2_000_000}
            step={10_000}
            onChange={setYouPutIn}
          />
          <Slider
            label="The cycle's whole pool"
            hint="Everyone's contributions added together. Your share is your money divided by this."
            value={capitalPool}
            min={500_000}
            max={50_000_000}
            step={500_000}
            onChange={setCapitalPool}
          />
          <Slider
            label="The harvest sells for"
            hint="One figure for the whole harvest, every sale added together."
            value={saleTotal}
            min={100_000}
            max={60_000_000}
            step={500_000}
            onChange={setSaleTotal}
          />
          <Slider
            label="Bills still owed at harvest"
            hint="Feed balances, vet bills and transport the cycle has not paid yet."
            value={billsOwed}
            min={0}
            max={20_000_000}
            step={250_000}
            onChange={setBillsOwed}
          />

          <p className="pg-chip pg-chip--locked">
            <Lock size={10} aria-hidden="true" />
            {percent(outcome.rules.investorSharePercent, 0)} to members ·{" "}
            {percent(outcome.rules.operatorSharePercent, 0)} to the farm caretaker ·{" "}
            {percent(outcome.rules.reservePercent, 0)} safety slice — all fixed before you pay
          </p>
        </div>

        {/* The result. */}
        <div className="min-w-0 rounded-2xl border border-hairline bg-porcelain p-4 sm:p-5">
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">
            <Result
              label="Your money back"
              value={money(outcome.yourMoneyBack)}
              caption={outcome.shareOfPoolText}
            />
            <Result
              label="Your share of the profit"
              value={money(outcome.yourProfitShare)}
              caption="Your slice of the members' 70%"
              tone="mint"
            />
            <Result
              label="You would get back"
              value={money(outcome.yourTotal)}
              caption={
                outcome.gainOrLoss >= 0
                  ? `${money(outcome.gainOrLoss)} more than you put in`
                  : `${money(Math.abs(outcome.gainOrLoss))} less than you put in`
              }
              tone={outcome.gainOrLoss >= 0 ? "mint" : "coral"}
            />
          </div>

          <ol className="mt-5 list-none space-y-3 p-0">
            {outcome.levels.map((level) => (
              <li
                key={level.step}
                className="min-w-0 rounded-xl border border-hairline bg-white p-3.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 font-display text-[0.84rem] font-semibold text-ink-deep">
                    <span className="fig mr-1.5 text-[0.7rem] text-ink-mute">{level.step}</span>
                    {level.title}
                  </p>
                  <span className="fig shrink-0 text-[0.85rem] font-semibold text-ink-deep">
                    {money(level.amount)}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.74rem] leading-5 text-ink-soft">{level.note}</p>
              </li>
            ))}
          </ol>

          {outcome.harvestFallsShort ? (
            <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[0.76rem] leading-5 text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                In this example the harvest does not cover the bills and everyone&apos;s money back
                — short by {money(outcome.shortfall)}. That is the real risk in farming. The rules
                pay suppliers first, so a bad harvest lands on profit before it lands on
                anyone&apos;s capital.
              </span>
            </p>
          ) : null}

          <p className="mt-4 flex gap-2 text-[0.7rem] leading-5 text-ink-mute">
            <Info size={13} className="mt-0.5 shrink-0 text-signal-deep" aria-hidden="true" />
            <span>
              These are round example numbers on a cycle that does not exist. They show how the
              maths works — they are not a real cycle, not a forecast and not a promise. Real
              cycles, and the money actually paid out, are on the{" "}
              <a href="#transparency" className="font-semibold text-signal-deep no-underline">
                transparency register
              </a>
              .
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="pg-kicker">{label}</span>
        <span className="fig text-[0.9rem] font-semibold text-ink-deep">{money(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-[var(--signal)]"
      />
      <span className="mt-1 block text-[0.7rem] leading-5 text-ink-mute">{hint}</span>
    </label>
  );
}

function Result({
  label,
  value,
  caption,
  tone = "plain",
}: {
  label: string;
  value: string;
  caption: string;
  tone?: "plain" | "mint" | "coral";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-hairline bg-white p-3.5">
      <p className="pg-kicker">{label}</p>
      <p
        className={`fig mt-1.5 text-[1.05rem] font-bold leading-tight ${
          tone === "mint" ? "text-mint-deep" : tone === "coral" ? "text-coral" : "text-ink-deep"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[0.68rem] leading-4 text-ink-mute">{caption}</p>
    </div>
  );
}
