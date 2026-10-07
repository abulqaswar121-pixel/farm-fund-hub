import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LogIn, Sprout } from "lucide-react";

import { NdhFamilySymbol } from "./NdhFamilySymbol";
import { FamilyMenu, type FamilyMenuLink } from "./FamilyMenu";

export type PrecisionHeaderProps = {
  /** Marks the current top-level section in the nav. */
  activePath?: string;
  /** Signed-in members get the portal call to action instead of sign-in. */
  session?: { name: string } | null;
  links?: FamilyMenuLink[];
};

const DEFAULT_LINKS: FamilyMenuLink[] = [
  { label: "Marketplace", href: "/cycles" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Transparency", href: "/#transparency" },
];

/**
 * The "Precision Gateway" header every NDH surface shares: master mark with
 * the AgriCapital sprout badge, the NAJEEB / AGRICAPITAL lockup, section nav
 * and the family dropdown.
 */
export function PrecisionHeader({ activePath, session, links = DEFAULT_LINKS }: PrecisionHeaderProps) {
  return (
    <header className="pg-header">
      <div className="pg-header-inner">
        <Link to="/" className="pg-brand" aria-label="NDH AgriCapital home">
          <NdhFamilySymbol SectorIcon={Sprout} size={38} />
          <span className="pg-brand-lockup">
            <strong>NAJEEB</strong>
            <small>AgriCapital</small>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Sections">
          {links.map((link) =>
            link.href.startsWith("/") && !link.href.includes("#") ? (
              <Link
                key={link.href}
                to={link.href as never}
                className="pg-nav-link"
                aria-current={activePath === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href} className="pg-nav-link">
                {link.label}
              </a>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <FamilyMenu links={links} />
          {session ? (
            <Link to="/portal" className="pg-btn pg-btn--signal h-9 px-4 text-[0.78rem]">
              My portal
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <Link to="/signin" className="pg-btn pg-btn--signal h-9 px-4 text-[0.78rem]">
              <LogIn size={14} aria-hidden="true" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
