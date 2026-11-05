import { Check, Languages } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { LOCALES, useLocale, type Locale } from "@/lib/agri/i18n";
import { cn } from "@/lib/utils";

/**
 * The language control in the top navigation.
 *
 * Four languages, always visible in the header rather than buried in a menu,
 * because a member who cannot read the navigation is not going to go looking
 * for the switch inside it. Each option is printed in its own language — Hausa,
 * Yorùbá, Igbo — so somebody scanning for their own tongue recognises it without
 * reading the English around it.
 */
export function LanguageSwitcher({ onDark = true }: { onDark?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = LOCALES.find((item) => item.id === locale) ?? LOCALES[0]!;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${t("common.language")}: ${current.label}`}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[0.72rem] font-semibold transition-colors",
          onDark
            ? "border-navy-line bg-white/[0.06] text-slate-200 hover:border-signal hover:text-white"
            : "border-hairline bg-white text-ink-soft hover:border-hairline-strong hover:text-ink-deep",
        )}
      >
        <Languages size={14} aria-hidden="true" />
        <span className="fig">{current.short}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label="Choose a language"
          className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-xl border border-hairline bg-white p-1 shadow-[var(--shadow-lift)]"
        >
          {LOCALES.map((item) => {
            const active = item.id === locale;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setLocale(item.id as Locale);
                  setOpen(false);
                }}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[0.8rem] no-underline transition-colors",
                  active ? "bg-navy text-white" : "text-ink-soft hover:bg-porcelain",
                )}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{item.native}</span>
                  <span
                    className={cn(
                      "block text-[0.66rem]",
                      active ? "text-slate-300" : "text-ink-mute",
                    )}
                  >
                    {item.label}
                  </span>
                </span>
                {active ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
