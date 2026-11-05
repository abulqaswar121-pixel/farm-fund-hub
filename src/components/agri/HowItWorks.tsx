import { ArrowRight, Coins, Fish, Receipt, Sprout, Wallet } from "lucide-react";

import { useLocale } from "@/lib/agri/i18n";

/**
 * How it works — three steps, in the words a first-time visitor owns.
 *
 * The ledger has a six-stage lifecycle and a four-level waterfall; none of that
 * belongs here. What a visitor needs is: pick something, pay into it, get paid
 * at harvest — with one sentence each about what actually happens and what
 * happens if it goes wrong.
 */
const STEPS = [
  {
    number: "01",
    icon: Fish,
    titleKey: "how.step1",
    bodyKey: "how.step1Body",
    tone: "signal",
    accent: "border-signal/40 bg-cyan-50 text-signal-deep",
  },
  {
    number: "02",
    icon: Wallet,
    titleKey: "how.step2",
    bodyKey: "how.step2Body",
    tone: "mint",
    accent: "border-mint/40 bg-mint-soft text-mint-deep",
  },
  {
    number: "03",
    icon: Coins,
    titleKey: "how.step3",
    bodyKey: "how.step3Body",
    tone: "amber",
    accent: "border-amber-200 bg-amber-50 text-amber-700",
  },
] as const;

export function HowItWorks({
  /**
   * `false` when this is embedded in the homepage, which already carries the
   * closing summary paragraph further down. The standalone page keeps both.
   */
  showFooterNotes = true,
}: {
  showFooterNotes?: boolean;
} = {}) {
  const { t } = useLocale();

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-y border-hairline bg-white py-14 sm:py-16"
    >
      <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)]">
        <div className="min-w-0">
          <p className="pg-kicker">{t("how.kicker")}</p>
          <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]">
            {t("how.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-[0.85rem] leading-6 text-ink-soft">
            Keeping money in is no harder than sending airtime. There is no lock-in and no
            paperwork: your certificate and every receipt can be printed from your dashboard the
            moment a payment is verified.
          </p>
        </div>

        <ol className="mt-7 grid min-w-0 list-none gap-4 p-0 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.number} className="min-w-0">
                <div className="relative h-full min-w-0 rounded-2xl border border-hairline bg-porcelain p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`grid size-11 place-items-center rounded-xl border ${step.accent}`}
                    >
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="fig text-[1.6rem] font-bold leading-none text-hairline-strong">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-3.5 font-display text-[1rem] font-bold leading-snug text-ink-deep">
                    {t(step.titleKey)}
                  </h3>
                  <p className="mt-1.5 text-[0.79rem] leading-6 text-ink-soft">{t(step.bodyKey)}</p>

                  {index < STEPS.length - 1 ? (
                    <span
                      className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 text-hairline-strong sm:block"
                      aria-hidden="true"
                    >
                      <ArrowRight size={18} />
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {showFooterNotes ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-hairline bg-porcelain px-4 py-3 text-[0.72rem] text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Sprout size={13} className="text-mint-deep" aria-hidden="true" />
              From ₦5,000, once or monthly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Receipt size={13} className="text-signal-deep" aria-hidden="true" />A receipt for
              every payment, printable on one A4 page
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Coins size={13} className="text-amber-600" aria-hidden="true" />
              70% of harvest profit to members
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
