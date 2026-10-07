import { Sprout } from "lucide-react";

import {
  cycleTickerItems,
  FARM_STANDARDS,
  TICKER_TONE_CLASS,
  type TickerItem,
} from "@/lib/agri/ticker";

/**
 * The live farm ticker.
 *
 * An infinite-scroll strip sitting directly under the hero band. It carries
 * the co-operative's published operating standards for the stock programme,
 * and — as soon as real cycles are locked — the live ledger state of every
 * published cycle, interleaved. No member balance and no return figure is ever
 * placed on this strip.
 */
export function LiveFarmTicker({
  cycles = [],
  className,
}: {
  cycles?: { code: string; commodity: string; status: string }[];
  className?: string;
}) {
  const ledgerItems = cycleTickerItems(cycles);
  const items: TickerItem[] = [...ledgerItems, ...FARM_STANDARDS];

  // The strip loops by translating the track exactly half its width, so each
  // half has to be wider than the widest screen watching it. With a short
  // programme list (early days, few cycles) the list is repeated inside its
  // half so the loop never opens a gap.
  const repeats = Math.max(1, Math.ceil(9 / items.length));
  const half: TickerItem[] = Array.from({ length: repeats }).flatMap((_, index) =>
    items.map((item) => ({ ...item, id: `${index}-${item.id}` })),
  );

  return (
    <section className={className} aria-label="Live farm activity ticker">
      <div className="border-y border-hairline bg-white">
        <div className="mx-auto flex max-w-[var(--page)] items-stretch px-[var(--gutter)]">
          <p className="pg-ticker-label">
            <span className="pg-live-dot" aria-hidden="true" />
            Farm pulse
          </p>

          <div className="pg-marquee min-w-0 flex-1 py-3">
            <div className="pg-marquee-track">
              {[0, 1].map((pass) => (
                <div className="flex items-center" key={pass} aria-hidden={pass === 1}>
                  {half.map((item) => (
                    <span className="pg-ticker-item" key={`${pass}-${item.id}`}>
                      <span
                        className={`size-1.5 shrink-0 rounded-full bg-current ${TICKER_TONE_CLASS[item.tone]}`}
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-ink-deep">{item.subject}:</span>
                      <span className="text-ink-soft">{item.reading}</span>
                      <span className="pl-4 text-hairline-strong" aria-hidden="true">
                        •
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="border-b border-hairline bg-white px-[var(--gutter)] pb-3 text-center text-[0.68rem] leading-5 text-ink-mute">
        <Sprout size={11} className="mr-1 inline text-mint" aria-hidden="true" />
        Ledger lines are read from published cycles and approved field logs. Standards are the
        co-operative&apos;s published operating targets and observed conditions — never a return
        figure.
      </p>
    </section>
  );
}
