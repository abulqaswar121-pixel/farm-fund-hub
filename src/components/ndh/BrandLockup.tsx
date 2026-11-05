import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

import { NdhFamilySymbol } from "./NdhFamilySymbol";
import { cn } from "@/lib/utils";

export type BrandLockupSize = "sm" | "md" | "lg";

/** Master tile dimensions per lockup size, in pixels. */
const TILE_SIZE: Record<BrandLockupSize, number> = { sm: 34, md: 40, lg: 48 };

/**
 * The NDH FarmFund brand lockup — the same construction the Academy and the
 * Agency use, so every NDH property signs its name identically:
 *
 *   - the Open Gateway master mark, wearing this property's sector badge
 *     (Sprout, the agricultural sector) in its lower-right corner;
 *   - top line: NAJEEB DIGITAL HUB — small, uppercase, crisp tracking;
 *   - bottom line: NDH FARMFUND — large and bold, in display type, white on the
 *     navy bands and navy on porcelain, with the signal-cyan / emerald accent.
 *
 * Renamed from the old AgriCapital wordmark: a farm co-operative that asks
 * people for ₦5,000 should say "FarmFund" on its own sign. The old secondary
 * badge is gone too — the ledger is not a badge, it is the product.
 *
 * `tone` switches the same lockup between the navy bands (header, footer, hero)
 * and the porcelain canvas.
 */
export function BrandLockup({
  size = "md",
  tone = "onDark",
  showBadge: _showBadge = true,
  showSubtitle = true,
  className,
  asLink = true,
}: {
  size?: BrandLockupSize;
  tone?: "onDark" | "onLight";
  showBadge?: boolean;
  showSubtitle?: boolean;
  className?: string;
  asLink?: boolean;
}) {
  const content = (
    <>
      <NdhFamilySymbol SectorIcon={Sprout} size={TILE_SIZE[size]} />
      <span className="ndh-brand-copy">
        <span className="ndh-brand-line">
          <span className="ndh-brand-name">NAJEEB&nbsp;DIGITAL&nbsp;HUB</span>
        </span>
        {showSubtitle ? (
          <span className="ndh-brand-sub">
            NDH&nbsp;<em>FARMFUND</em>
          </span>
        ) : null}
      </span>
    </>
  );

  const classes = cn(
    "ndh-brand",
    `ndh-brand--${size}`,
    tone === "onLight" && "ndh-brand--onLight",
    className,
  );

  if (!asLink) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Link to="/" className={classes} aria-label="Najeeb Digital Hub — NDH FarmFund home">
      {content}
    </Link>
  );
}
