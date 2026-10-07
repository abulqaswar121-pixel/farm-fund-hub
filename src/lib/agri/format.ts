/** Shared display formatting. Every figure the platform prints goes through here. */

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nairaCompact = new Intl.NumberFormat("en-NG", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

export function money(value: number | string | null | undefined): string {
  return naira.format(Number(value ?? 0));
}

/** "₦3.0M" — for headline stats, never for ledger rows. */
export function moneyCompact(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (Math.abs(amount) < 1000) return naira.format(amount);
  return `₦${nairaCompact.format(amount)}`;
}

/**
 * A public-page amount: whole naira, rounded down, no decimals.
 *
 * Public pages never need the kobo, and rounding down means a figure can only
 * ever understate how far a cycle has come — never overstate it. `step` is the
 * rounding unit (₦1,000 by default, coarser where the caller asks for it).
 */
export function moneyPublic(value: number | string | null | undefined, step = 1000): string {
  const amount = Math.max(0, Number(value ?? 0));
  const rounded = Math.floor(amount / step) * step;
  return `₦${rounded.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

/**
 * The public progress figure: exact naira never leaves the server.
 *
 * A member's own contribution must not be guessable by watching this number
 * move, so the platform publishes it rounded to the nearest ₦10,000 (down).
 */
export function raisedPublic(value: number | string | null | undefined): number {
  const amount = Math.max(0, Number(value ?? 0));
  return Math.floor(amount / 10_000) * 10_000;
}

export function kg(value: number | string | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} kg`;
}

export function number(value: number | string | null | undefined, digits = 0): string {
  return Number(value ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function percent(value: number | string | null | undefined, digits = 2): string {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Weeks between two dates, used for cycle progress rails. */
export function weeksBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / (7 * 24 * 60 * 60 * 1000)));
}

export function relativeDays(value: string | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

/** The initials used in member avatars. */
export function initials(fullName: string | null | undefined, fallback = "?"): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return fallback;
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
