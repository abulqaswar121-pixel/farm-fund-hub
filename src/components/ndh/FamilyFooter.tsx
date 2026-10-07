import {
  ArrowUpRight,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sprout,
} from "lucide-react";

import { NDH_CONTACT, SUBSIDIARIES } from "@/lib/ndh/ecosystem";
import { NdhFamilySymbol } from "./NdhFamilySymbol";

/**
 * The shared NDH family footer: ecosystem navigation, legal links, contact
 * details and the status badge strip. Deliberately quiet — the data tables
 * above it are the loudest thing on any AgriCapital page.
 */
export function FamilyFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy text-slate-300">
      <div className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <NdhFamilySymbol SectorIcon={Sprout} size={36} />
              <span className="pg-brand-lockup">
                <strong className="text-white">NAJEEB</strong>
                <small>AgriCapital</small>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
              The multi-commodity agricultural capital ledger of the Najeeb Digital Hub family —
              every naira, kilogram and equity share accounted for in the open.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Head office in Sokoto State; farm operations at Tunga Magajiya, Niger State. Built for
              Nigeria&apos;s farm economy.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href={NDH_CONTACT.whatsapp}
                aria-label="WhatsApp"
                className="grid size-9 place-items-center rounded-full border border-navy-line text-slate-300 transition-colors hover:border-signal hover:text-white"
              >
                <MessageCircle size={16} />
              </a>
              <a
                href={NDH_CONTACT.facebook}
                aria-label="Facebook"
                className="grid size-9 place-items-center rounded-full border border-navy-line text-slate-300 transition-colors hover:border-signal hover:text-white"
              >
                <Facebook size={16} />
              </a>
              <a
                href={NDH_CONTACT.instagram}
                aria-label="Instagram"
                className="grid size-9 place-items-center rounded-full border border-navy-line text-slate-300 transition-colors hover:border-signal hover:text-white"
              >
                <Instagram size={16} />
              </a>
            </div>
          </div>

          <nav aria-label="Platform">
            <h2 className="pg-kicker pg-kicker--onDark">Platform</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/cycles" className="text-slate-300 no-underline hover:text-white">
                  Farm marketplace
                </a>
              </li>
              <li>
                <a href="/#calculator" className="text-slate-300 no-underline hover:text-white">
                  Return calculator
                </a>
              </li>
              <li>
                <a href="/#transparency" className="text-slate-300 no-underline hover:text-white">
                  Transparency feed
                </a>
              </li>
              <li>
                <a href="/#rules" className="text-slate-300 no-underline hover:text-white">
                  Locked cycle rules
                </a>
              </li>
              <li>
                <a href="/signin" className="text-slate-300 no-underline hover:text-white">
                  Member sign in
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Our businesses">
            <h2 className="pg-kicker pg-kicker--onDark">NDH businesses</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {SUBSIDIARIES.map((item) =>
                item.state === "coming" ? (
                  <li key={item.id} className="text-slate-500">
                    {item.name} <span className="text-[0.65rem]">· soon</span>
                  </li>
                ) : (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      rel={item.external ? "noreferrer" : undefined}
                      className="inline-flex items-center gap-1.5 text-slate-300 no-underline hover:text-white"
                    >
                      {item.name}
                      {item.external ? <ArrowUpRight size={12} aria-hidden="true" /> : null}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div>
            <h2 className="pg-kicker pg-kicker--onDark">Talk to the co-operative</h2>
            <address className="mt-4 space-y-3 text-sm not-italic">
              <a
                href={NDH_CONTACT.map}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-2.5 text-slate-300 no-underline hover:text-white"
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-signal" />
                <span>{NDH_CONTACT.address}</span>
              </a>
              <a
                href={`tel:${NDH_CONTACT.telephone}`}
                className="flex gap-2.5 text-slate-300 no-underline hover:text-white"
              >
                <Phone size={16} className="shrink-0 text-signal" />
                <span>{NDH_CONTACT.phone}</span>
              </a>
              <a
                href={`mailto:${NDH_CONTACT.support}`}
                className="flex gap-2.5 text-slate-300 no-underline hover:text-white"
              >
                <Mail size={16} className="mt-0.5 shrink-0 text-signal" />
                <span>
                  <small className="block text-[0.65rem] uppercase tracking-widest text-slate-500">
                    Support
                  </small>
                  {NDH_CONTACT.support}
                </span>
              </a>
            </address>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="pg-chip pg-chip--mint">
                <span className="pg-live-dot" /> Ledger live
              </span>
              <a className="pg-chip" href="/api/health" rel="noreferrer">
                System status
              </a>
              <span className="pg-chip pg-chip--signal">Paystack secured</span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-navy-line pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>
            © {year} {NDH_CONTACT.legalName}. AgriCapital is a co-operative agricultural investment
            programme, not a bank.
          </span>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-4">
            <a href="/legal/terms" className="no-underline hover:text-white">
              Terms
            </a>
            <a href="/legal/privacy" className="no-underline hover:text-white">
              Privacy
            </a>
            <a href="/legal/risk" className="no-underline hover:text-white">
              Risk statement
            </a>
            <a href="#top" className="no-underline hover:text-white">
              Back to top ↑
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
