import type { ComponentType, SVGProps } from "react";
import gatewayMark from "@/assets/brand/ndh-gateway-mark.png";

type SectorIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * The NDH master mark — the Open Gateway symbol, optionally carrying the
 * sector badge of the business it represents. AgriCapital renders it with the
 * Sprout badge everywhere the platform signs its name.
 */
export function NdhFamilySymbol({
  className = "",
  SectorIcon,
  size = 36,
}: {
  className?: string;
  SectorIcon?: SectorIcon;
  size?: number;
}) {
  return (
    <span
      className={`ndh-family-symbol${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img src={gatewayMark} alt="" width={size} height={size} className="size-full object-contain" />
      {SectorIcon ? (
        <span className="ndh-family-sector" style={{ width: size * 0.46, height: size * 0.46 }}>
          <SectorIcon strokeWidth={2.4} />
        </span>
      ) : null}
    </span>
  );
}
