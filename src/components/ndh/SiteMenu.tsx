import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, X } from "lucide-react";

export type HeaderLink = { label: string; href: string };

/**
 * The compact AgriCapital menu — the whole navigation on small screens.
 *
 * It carries this property's pages and nothing else: no sibling business
 * links, no parent-directory links, no ecosystem switcher. Those live in the
 * footer (`FamilyFooter`), which is the only place on the platform where the
 * NDH family is advertised.
 */
export function SiteMenu({
  links,
  session,
}: {
  links: HeaderLink[];
  session?: { name: string } | null;
}) {
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

  return (
    <div className="pg-menu md:hidden" ref={rootRef}>
      <button
        type="button"
        className="pg-menu-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close the AgriCapital menu" : "Open the AgriCapital menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={14} aria-hidden="true" /> : <Menu size={14} aria-hidden="true" />}
        <span>Menu</span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      {open ? (
        <div className="pg-menu-panel" id={panelId} role="group" aria-label="AgriCapital pages">
          <div className="pg-menu-head">
            <p>NDH AgriCapital</p>
            <strong>Platform pages</strong>
          </div>
          <ul className="pg-menu-list m-0 list-none p-1">
            {links.map((link) => (
              <li key={link.href}>
                {link.href.startsWith("/") && !link.href.includes("#") ? (
                  <Link
                    className="pg-menu-item"
                    to={link.href as never}
                    onClick={() => setOpen(false)}
                  >
                    <span className="pg-menu-copy">
                      <strong>{link.label}</strong>
                    </span>
                  </Link>
                ) : (
                  <a className="pg-menu-item" href={link.href} onClick={() => setOpen(false)}>
                    <span className="pg-menu-copy">
                      <strong>{link.label}</strong>
                    </span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="pg-menu-foot">
            <Link
              to={session ? "/portal" : "/signin"}
              className="pg-btn pg-btn--signal h-8 px-3 text-[0.72rem]"
              onClick={() => setOpen(false)}
            >
              {session ? "My portal" : "Member Sign In"}
            </Link>
            <Link
              to="/cycles"
              className="text-xs font-semibold text-ink-soft no-underline hover:text-ink-deep"
              onClick={() => setOpen(false)}
            >
              Open cycles →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
