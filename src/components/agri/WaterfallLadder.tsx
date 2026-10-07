import { Lock } from "lucide-react";

import { WATERFALL_LEVELS, type CycleRules } from "@/lib/agri/rules";
import { Money } from "@/components/ndh/ledger-ui";

/**
 * The strict order of settlement, shown as a ladder.
 *
 * With a settled cycle's figures attached it becomes the receipt: each level
 * shows what it actually took. Without them it is the contract the member is
 * being asked to accept.
 */
export function WaterfallLadder({
  rules,
  amounts,
  compact = false,
}: {
  rules: CycleRules;
  amounts?: { level: number; amount: number }[];
  compact?: boolean;
}) {
  const amountFor = (level: number) => amounts?.find((row) => row.level === level)?.amount;

  return (
    <ol className="m-0 list-none space-y-2 p-0">
      {WATERFALL_LEVELS.map((definition) => {
        const value = amountFor(definition.level);
        return (
          <li
            key={definition.key}
            className="relative rounded-xl border border-hairline bg-white p-3.5 pl-12"
          >
            <span className="absolute left-3.5 top-3.5 grid size-6 place-items-center rounded-full bg-navy font-mono text-[0.68rem] font-bold text-white">
              {definition.level}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-display text-[0.83rem] font-semibold text-ink-deep">
                {definition.name}
              </p>
              {value !== undefined ? (
                <Money value={value} className="text-[0.83rem] font-semibold text-ink-deep" />
              ) : null}
            </div>
            {!compact ? (
              <p className="mt-1 text-[0.75rem] leading-5 text-ink-mute">
                {definition.description}
              </p>
            ) : null}
            {definition.level === 4 ? (
              <p className="pg-chip pg-chip--locked mt-2">
                <Lock size={10} aria-hidden="true" />
                {rules.investorSharePercent}% investors · {rules.operatorSharePercent}% caretaker
              </p>
            ) : null}
            {definition.level === 3 ? (
              <p className="pg-chip pg-chip--locked mt-2">
                <Lock size={10} aria-hidden="true" />
                {rules.reservePercent}% of gross revenue held in escrow
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
