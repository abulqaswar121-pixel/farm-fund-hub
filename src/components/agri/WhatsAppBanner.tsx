import { MessageCircle, ShieldCheck, Smartphone } from "lucide-react";

import { useLocale } from "@/lib/agri/i18n";
import { whatsappGroupUrl } from "@/lib/agri/whatsapp";

/**
 * The community banner.
 *
 * A co-operative is a group of people who talk to each other, and in Nigeria
 * that conversation happens on WhatsApp. This is the single loudest invitation
 * on the site, because for a first-time investor the group is where the farm
 * stops being a webpage and becomes people posting pictures of feed sacks at
 * six in the morning.
 *
 * The number "500+" is the co-operative's own published claim, not a figure the
 * platform measures — so it is stated as the group's size, never as a ledger
 * total, and never mixed in with the counted counters in the hero.
 */
export function WhatsAppBanner({ inviteUrl }: { inviteUrl?: string | null }) {
  const { t } = useLocale();
  const href = whatsappGroupUrl(inviteUrl);

  return (
    <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-12 sm:py-14">
      <div className="relative isolate overflow-hidden rounded-2xl border border-mint/25 bg-[linear-gradient(120deg,#053b2e_0%,#065f46_46%,#0a1a30_100%)] p-6 shadow-[var(--shadow-lift)] sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-mint/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 grid min-w-0 items-center gap-6 md:grid-cols-[1.35fr_1fr]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
              <MessageCircle size={12} aria-hidden="true" />
              WhatsApp community
            </p>
            <h2 className="mt-3 font-display text-[1.3rem] font-bold leading-tight text-white sm:text-[1.6rem]">
              {t("whatsapp.title")}
            </h2>
            <p className="mt-2 max-w-xl text-[0.84rem] leading-6 text-emerald-50/90">
              {t("whatsapp.body")}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.7rem] text-emerald-50/80">
              <span className="inline-flex items-center gap-1.5">
                <Smartphone size={12} aria-hidden="true" />
                Works on any phone
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={12} aria-hidden="true" />
                No card details are ever posted in the group
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[0.88rem] font-semibold text-[#075E54] no-underline shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              <MessageCircle size={17} aria-hidden="true" />
              {t("whatsapp.cta")}
            </a>
            <p className="text-center text-[0.66rem] leading-4 text-emerald-50/70">
              Daily video and photo updates · expense alerts the moment they are logged
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
