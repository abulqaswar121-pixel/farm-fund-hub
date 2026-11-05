import { Camera, Clock3, MapPin } from "lucide-react";

import { useLocale } from "@/lib/agri/i18n";

/**
 * Farm photo proof — a visual strip, not a gallery.
 *
 * Three real moments from the working day (feeding, sorting, biosecurity),
 * each with the caption the farm team would write on it. The strip is the
 * answer to the question every first-time investor asks: "is there actually a
 * farm?" — so the images are photographs of work being done, not of produce on
 * a table.
 *
 * They sit on the navy band so they read as evidence rather than decoration:
 * the porcelain canvas is where the argument lives, and this is the appendix
 * the argument is built on.
 */
const PROOF = [
  {
    src: "/images/farm/proof-feeding.jpg",
    alt: "A farm worker feeding a catfish pond by hand at sunrise",
    tag: "Feeding",
    title: "6:20am — first feed of the day",
    body: "Feed is weighed before it goes in and logged the same morning, so the cost and the growth stay in step.",
  },
  {
    src: "/images/farm/proof-sorting.jpg",
    alt: "Two workers grading harvested catfish by size on a stainless table",
    tag: "Sorting",
    title: "Harvest day — graded by size",
    body: "Fish are graded on a stainless table with the hanging scale in shot, and the scale ticket is kept as proof of the sale.",
  },
  {
    src: "/images/farm/proof-biosecurity.jpg",
    alt: "A worker in coveralls stepping through a disinfection footbath at a poultry house door",
    tag: "Biosecurity",
    title: "Before anyone enters the house",
    body: "Footbath, coveralls, a visitors' book. It is the least photogenic part of the farm and the one that protects the flock.",
  },
] as const;

export function PhotoProofStrip({ onDark = true }: { onDark?: boolean } = {}) {
  const { t } = useLocale();

  return (
    <section
      id="farm-proof"
      className={
        onDark
          ? "band-dark scroll-mt-20 py-14 sm:py-16"
          : "scroll-mt-20 border-y border-hairline bg-white py-14 sm:py-16"
      }
    >
      <div className="relative z-10 mx-auto max-w-[var(--page)] px-[var(--gutter)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className={onDark ? "pg-kicker pg-kicker--onDark" : "pg-kicker"}>
              {t("proof.kicker")}
            </p>
            <h2
              className={
                onDark
                  ? "mt-1.5 font-display text-[1.45rem] font-bold leading-tight text-white sm:text-[1.95rem]"
                  : "mt-1.5 text-[1.45rem] leading-tight text-ink-deep sm:text-[1.95rem]"
              }
            >
              {t("proof.title")}
            </h2>
            <p
              className={
                onDark
                  ? "mt-2 max-w-2xl text-[0.85rem] leading-6 text-slate-300"
                  : "mt-2 max-w-2xl text-[0.85rem] leading-6 text-ink-soft"
              }
            >
              {t("proof.blurb")}
            </p>
          </div>
          <span
            className={`${onDark ? "" : "self-start md:self-end "}pg-chip pg-chip--onDark${onDark ? "" : " !border-hairline !bg-porcelain !text-ink-soft"}`.trim()}
          >
            <Camera size={11} aria-hidden="true" />
            Members upload the originals
          </span>
        </div>

        <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROOF.map((item) => (
            <figure
              key={item.src}
              className={
                onDark
                  ? "group min-w-0 overflow-hidden rounded-2xl border border-navy-line bg-white/[0.05]"
                  : "pg-card pg-card--lift group min-w-0 overflow-hidden"
              }
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,48,0)_45%,rgba(10,26,48,0.85)_100%)]" />
                <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-navy/75 px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-signal backdrop-blur-sm">
                  {item.tag}
                </span>
                <span className="absolute inset-x-3 bottom-2.5 inline-flex items-center gap-1.5 text-[0.66rem] font-medium text-slate-200">
                  <MapPin size={11} className="text-signal" aria-hidden="true" />
                  Tunga Magajiya, Niger State
                </span>
              </div>
              <figcaption className="p-4">
                <p
                  className={
                    onDark
                      ? "flex items-center gap-1.5 font-display text-[0.85rem] font-semibold leading-snug text-white"
                      : "flex items-center gap-1.5 font-display text-[0.85rem] font-semibold leading-snug text-ink-deep"
                  }
                >
                  <Clock3 size={12} className="shrink-0 text-signal" aria-hidden="true" />
                  {item.title}
                </p>
                <p
                  className={
                    onDark
                      ? "mt-1.5 text-[0.74rem] leading-5 text-slate-400"
                      : "mt-1.5 text-[0.74rem] leading-5 text-ink-soft"
                  }
                >
                  {item.body}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        <p
          className={
            onDark
              ? "mt-4 text-[0.68rem] leading-5 text-slate-500"
              : "mt-4 text-[0.68rem] leading-5 text-ink-mute"
          }
        >
          These are photographs of the co-operative&apos;s own farm work. Members see the daily set
          — with the date and time each was taken — on their dashboard, before an admin approves it
          for this page.
        </p>
      </div>
    </section>
  );
}
