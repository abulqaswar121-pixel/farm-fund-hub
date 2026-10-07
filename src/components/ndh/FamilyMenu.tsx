import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, LayoutGrid } from "lucide-react";

import {
  ECOSYSTEM_CATEGORIES,
  NDH_CONTACT,
  SUBSIDIARIES,
  type CategoryId,
  type Subsidiary,
} from "@/lib/ndh/ecosystem";

export type FamilyMenuLink = { label: string; href: string };

/**
 * The gateway dropdown that connects every NDH surface.
 *
 * It server-renders closed and touches no browser API until opened, so the
 * public pages stay fast. On small screens this is the whole menu.
 */
export function FamilyMenu({ links = [] }: { links?: FamilyMenuLink[] }) {
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

  const grouped = ECOSYSTEM_CATEGORIES.map((category) => ({
    category,
    items: SUBSIDIARIES.filter((item) => item.categories.includes(category.id as CategoryId)),
  })).filter((group) => group.items.length > 0);

  function close() {
    setOpen(false);
  }

  function ItemBody({ item }: { item: Subsidiary }) {
    const Icon = item.icon;
    return (
      <>
        <span className={`pg-menu-icon tone-${item.accent}`}>
          <Icon size={15} />
        </span>
        <span className="pg-menu-copy">
          <strong>
            {item.name}
            {item.current ? " ·" : ""}
          </strong>
          <small>{item.current ? "You are here" : item.tagline}</small>
        </span>
        {item.state === "coming" ? (
          <span className="pg-chip pg-chip--signal">Soon</span>
        ) : item.current ? (
          <span className="pg-chip pg-chip--mint">Current</span>
        ) : (
          <ArrowUpRight size={14} aria-hidden="true" className="text-ink-mute" />
        )}
      </>
    );
  }

  return (
    <div className="pg-menu" ref={rootRef}>
      <button
        type="button"
        className="pg-menu-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <LayoutGrid size={13} aria-hidden="true" />
        NDH Gateway
        <ChevronDown size={13} aria-hidden="true" />
      </button>

      {open ? (
        <div className="pg-menu-panel" id={panelId} role="group" aria-label="NDH ecosystem">
          <div className="pg-menu-head">
            <p>Najeeb Digital Hub</p>
            <strong>The NDH family of businesses</strong>
          </div>

          <div className="pg-menu-list">
            {grouped.map(({ category, items }) => {
              const CategoryIcon = category.icon;
              return (
                <div key={category.id} className="mb-1">
                  <p className="pg-kicker flex items-center gap-1.5 px-2.5 py-2 text-[0.58rem]">
                    <CategoryIcon size={12} aria-hidden="true" />
                    {category.label}
                  </p>
                  <ul className="m-0 list-none p-0">
                    {items.map((item) => (
                      <li key={item.id}>
                        {item.current ? (
                          <span className="pg-menu-item" aria-current="page">
                            <ItemBody item={item} />
                          </span>
                        ) : item.state === "coming" ? (
                          <span className="pg-menu-item" aria-disabled="true">
                            <ItemBody item={item} />
                          </span>
                        ) : (
                          <a
                            className="pg-menu-item"
                            href={item.href}
                            rel={item.external ? "noreferrer" : undefined}
                            onClick={close}
                          >
                            <ItemBody item={item} />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="pg-menu-foot">
            <a href={NDH_CONTACT.parent} rel="noreferrer" onClick={close}>
              ndh.com.ng →
            </a>
            {links.length > 0 ? (
              <span className="flex items-center gap-3">
                {links.map((link) =>
                  link.href.startsWith("/") ? (
                    <Link
                      key={link.href}
                      to={link.href as never}
                      className="text-xs font-semibold text-ink-soft no-underline hover:text-ink-deep"
                      onClick={close}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      className="text-xs font-semibold text-ink-soft no-underline hover:text-ink-deep"
                      onClick={close}
                    >
                      {link.label}
                    </a>
                  ),
                )}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
