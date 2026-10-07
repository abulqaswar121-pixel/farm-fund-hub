import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

import { NdhFamilySymbol } from "./NdhFamilySymbol";
import { cn } from "@/lib/utils";

export type BrandLockupSize = "sm" | "md" | "lg";

/** Master tile dimensions per lockup size, in pixels. */
const TILE_SIZE: Record<BrandLockupSize, number> = { sm: 34, md: 40, lg: 48 };

/**
 * The AgriCapital brand lockup — the same construction the Academy uses, so
 * every NDH property signs its name identically:
 *
 *   - the Open Gateway master mark, wearing this property's sector badge
 *     (Sprout, the agricultural sector) in its lower-right corner;
 *   - top line: NAJEEB DIGITAL HUB — Space Grotesk, bold, tracking-tight, white;
 *   - bottom line: NDH AgriCapital, signal cyan with the emerald accent.
 *
 * `tone` switches the same lockup between the navy bands (header, footer, hero)
 * and the porcelain canvas.
 */
export function BrandLockup({
  size = "md",
  tone = "onDark",
  showBadge = true,
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
          <span className="ndh-brand-name">
            NAJEEB&nbsp;DIGITAL&nbsp;<em>HUB</em>
          </span>
          {showBadge ? <span className="ndh-brand-badge">Farm Ledger</span> : null}
        </span>
        {showSubtitle ? (
          <small className="ndh-brand-sub">
            NDH <em>AgriCapital</em>
          </small>
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
    <Link to="/" className={classes} aria-label="Najeeb Digital Hub — NDH AgriCapital home">
      {content}
    </Link>
  );
}
