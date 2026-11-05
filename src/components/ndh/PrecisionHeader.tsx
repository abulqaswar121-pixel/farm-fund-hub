import { Link } from "@tanstack/react-router";
import { ArrowUpRight, LogIn } from "lucide-react";

import { LanguageSwitcher } from "@/components/agri/LanguageSwitcher";
import { BrandLockup } from "./BrandLockup";
import { SiteMenu, type HeaderLink } from "./SiteMenu";

export type PrecisionHeaderProps = {
  /** Marks the current top-level section in the nav. */
  activePath?: string;
  /** Signed-in members get the portal call to action instead of sign-in. */
  session?: { name: string } | null;
  links?: HeaderLink[];
};

/**
 * The FarmFund navigation, in full.
 *
 * The header is deliberately 100% about this platform: the marketplace, how
 * the cycles work, the transparency register, the locked rules and the member
 * sign-in. Sibling NDH businesses and the parent directory are advertised in
 * the footer (`FamilyFooter`) — never here.
 */
const DEFAULT_LINKS: HeaderLink[] = [
  { label: "Farm batches", href: "/cycles" },
  { label: "How it works", href: "/#catfish" },
  { label: "Payout rules", href: "/rules" },
  { label: "Verify a document", href: "/verify" },
];

export function PrecisionHeader({
  activePath,
  session = null,
  links = DEFAULT_LINKS,
}: PrecisionHeaderProps) {
  return (
    <header className="pg-header">
      <div className="pg-header-inner">
        <BrandLockup size="md" />

        <nav className="hidden items-center gap-6 lg:flex" aria-label="NDH FarmFund sections">
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
          {/* Language sits ahead of the menu on a phone: it is the one control
              somebody who cannot read the English navigation will look for. */}
          <LanguageSwitcher />
          <SiteMenu links={links} session={session} />
          {session ? (
            <Link
              to="/portal"
              className="pg-btn pg-btn--signal hidden h-9 px-4 text-[0.78rem] sm:inline-flex"
            >
              My portal
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <Link
              to="/signin"
              className="pg-btn pg-btn--signal hidden h-9 px-4 text-[0.78rem] sm:inline-flex"
            >
              <LogIn size={14} aria-hidden="true" />
              Member Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
