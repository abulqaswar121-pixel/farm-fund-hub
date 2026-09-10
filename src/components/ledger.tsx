import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Shared ledger furniture — used by every page (public, auth, portals).
 * Money is always rendered through <Money /> so every figure is tabular.
 * ------------------------------------------------------------------------- */

const ngnFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNgn(value: number): string {
  return ngnFormatter.format(value);
}

export function formatDate(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return (
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** The single brand mark — the existing circular badge, used small only. */
export function BadgeMark({ className }: { className?: string }) {
  return (
    <img
      src="/apex-badge.png"
      alt="Apex Agri-Capital"
      className={cn("block select-none", className)}
    />
  );
}

export function BrandWordmark({ caption, className }: { caption?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BadgeMark className="size-8" />
      <div className="leading-tight">
        <p className="font-display text-[15px] font-bold tracking-tight text-ink">
          Apex Agri-Capital
        </p>
        {caption && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}

/** Money figure — monospace, tabular, sign/colour aware. */
export function Money({
  value,
  tone = "plain",
  signed = false,
  className,
}: {
  value: number;
  tone?: "plain" | "credit" | "debit" | "gold";
  signed?: boolean;
  className?: string;
}) {
  const prefix = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "fig",
        tone === "credit" && "fig--credit",
        tone === "debit" && "fig--debit",
        tone === "gold" && "fig--gold",
        className,
      )}
    >
      {prefix}
      {formatNgn(Math.abs(value))}
    </span>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("ledger-kicker", className)}>{children}</p>;
}

/** Headline block used atop every page. */
export function PageHeader({
  kicker,
  title,
  blurb,
  actions,
}: {
  kicker: string;
  title: string;
  blurb?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-rule pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <Kicker>{kicker}</Kicker>
        <h1 className="mt-2 text-3xl leading-tight text-ink md:text-4xl">{title}</h1>
        {blurb && <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{blurb}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** A single ledger figure block (label over monospace number). */
export function Figure({
  label,
  value,
  caption,
  tone = "plain",
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  tone?: "plain" | "credit" | "debit" | "gold";
}) {
  return (
    <div className="min-w-0">
      <Kicker>{label}</Kicker>
      <p
        className={cn(
          "mt-1.5 truncate text-2xl font-semibold text-ink",
          tone === "credit" && "text-leaf",
          tone === "debit" && "text-rust",
          tone === "gold" && "text-gold",
        )}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-xs text-ink-soft">{caption}</p>}
    </div>
  );
}

export function Notice({
  tone,
  children,
  className,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
  className?: string;
}) {
  const styles =
    tone === "success"
      ? "border-leaf/40 bg-leaf/8 text-leaf-deep"
      : tone === "error"
        ? "border-rust/40 bg-rust/8 text-rust"
        : "border-gold/40 bg-gold/10 text-[#6b501f]";
  return (
    <p className={cn("rounded-md border px-3 py-2.5 text-sm leading-6", styles, className)}>
      {children}
    </p>
  );
}

export function EmptyLedger({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <p className="font-display text-lg italic text-ink-soft">No entries yet</p>
      <p className="text-xs leading-5 text-ink-soft">{children}</p>
    </div>
  );
}

export function StatusPill({ status }: { status: "success" | "pending" | "failed" }) {
  return (
    <span
      className={cn(
        "ledger-pill",
        status === "success" && "ledger-pill--success",
        status === "pending" && "ledger-pill--pending",
        status === "failed" && "ledger-pill--failed",
      )}
    >
      {status}
    </span>
  );
}

export function RolePill({ role }: { role: "admin" | "operator" | "contributor" }) {
  return <span className="ledger-pill ledger-pill--pending capitalize">{role}</span>;
}

/** Thin gold rule used as a section divider. */
export function GoldRule({ className }: { className?: string }) {
  return <div className={cn("h-px bg-gold/50", className)} />;
}
