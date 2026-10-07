import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Shared ledger furniture for every AgriCapital surface.
 *
 * Rule of the house: any number a member might reconcile — money, kilograms,
 * crates, equity share — is rendered through <Figure> or <Money> so it is
 * monospace and tabular. Prose stays in DM Sans.
 * ------------------------------------------------------------------------- */

export function Money({
  value,
  tone = "plain",
  signed = false,
  className,
}: {
  value: number;
  tone?: "plain" | "credit" | "debit" | "signal";
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
        tone === "signal" && "fig--signal",
        className,
      )}
    >
      {prefix}
      {formatNairaLocal(Math.abs(value))}
    </span>
  );
}

function formatNairaLocal(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function Kicker({
  children,
  onDark = false,
  className,
}: {
  children: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return <p className={cn("pg-kicker", onDark && "pg-kicker--onDark", className)}>{children}</p>;
}

export function Figure({
  label,
  value,
  caption,
  tone = "plain",
  onDark = false,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  tone?: "plain" | "credit" | "debit" | "signal";
  onDark?: boolean;
}) {
  return (
    <div className="min-w-0">
      <Kicker onDark={onDark}>{label}</Kicker>
      <p
        className={cn(
          "fig mt-1.5 truncate text-[1.35rem] font-semibold leading-tight",
          onDark ? "text-white" : "text-ink-deep",
          tone === "credit" && "fig--credit",
          tone === "debit" && "fig--debit",
          tone === "signal" && "fig--signal",
        )}
      >
        {value}
      </p>
      {caption ? (
        <p
          className={cn(
            "mt-1 text-[0.7rem] leading-4",
            onDark ? "text-slate-400" : "text-ink-mute",
          )}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({
  tone,
  children,
  className,
}: {
  tone: "success" | "error" | "info" | "warning";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    success: "border-mint/35 bg-mint-soft text-mint-deep",
    error: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-signal/35 bg-cyan-50 text-cyan-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];

  return (
    <p className={cn("rounded-xl border px-3.5 py-2.5 text-[0.8rem] leading-6", styles, className)}>
      {children}
    </p>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      {icon ? (
        <span className="grid size-11 place-items-center rounded-full bg-porcelain text-ink-mute">
          {icon}
        </span>
      ) : null}
      <p className="font-display text-base font-semibold text-ink-deep">{title}</p>
      {children ? (
        <p className="max-w-sm text-[0.8rem] leading-6 text-ink-mute">{children}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function StatusChip({
  status,
  label,
}: {
  status: "success" | "pending" | "failed" | "info";
  label?: string;
}) {
  const tone =
    status === "success"
      ? "pg-chip--mint"
      : status === "pending"
        ? "pg-chip--amber"
        : status === "failed"
          ? "pg-chip--rose"
          : "pg-chip--signal";
  return <span className={cn("pg-chip", tone)}>{label ?? status}</span>;
}

export function Card({
  children,
  className,
  lift = false,
}: {
  children: ReactNode;
  className?: string;
  lift?: boolean;
}) {
  return <div className={cn("pg-card", lift && "pg-card--lift", className)}>{children}</div>;
}

export function SectionHeader({
  kicker,
  title,
  blurb,
  action,
  id,
}: {
  kicker: string;
  title: string;
  blurb?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="flex flex-col gap-3 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between"
    >
      <div className="min-w-0">
        <Kicker>{kicker}</Kicker>
        <h2 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep md:text-[1.7rem]">
          {title}
        </h2>
        {blurb ? (
          <p className="mt-1.5 max-w-2xl text-[0.83rem] leading-6 text-ink-soft">{blurb}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
