import { AlertTriangle, Bell, CheckCheck, Coins, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { dateTimeLabel } from "@/lib/agri/format";
import { dismissAlerts, type MemberAlert } from "@/lib/agri.community.functions";
import { cn } from "@/lib/utils";

/**
 * "New farm expense logged: ₦X for [Category]".
 *
 * The banner is the promise in the brief made visible: the moment an admin or
 * an operator logs an expense, a member finds out. The alert rows are written by
 * a database trigger on the expense itself, so there is no code path where an
 * expense is saved and the alert is forgotten.
 *
 * Dismissing marks it read for that member only. The record of the expense stays
 * in the feed forever — the banner is a notification, not the ledger.
 */
export function AlertBanner({
  alerts,
  onDismissed,
}: {
  alerts: MemberAlert[];
  onDismissed?: () => void;
}) {
  const dismiss = useServerFn(dismissAlerts);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);

  const visible = alerts.filter((alert) => !hidden.includes(alert.id));
  if (visible.length === 0) return null;

  async function dismissAll() {
    setBusy(true);
    try {
      await dismiss({ data: {} });
      setHidden(alerts.map((alert) => alert.id));
      onDismissed?.();
    } catch {
      // Leave the banner up: an alert that cannot be stored as read should not
      // silently vanish from the member's screen either.
    }
    setBusy(false);
  }

  const toneStyles: Record<string, string> = {
    expense: "border-amber-300 bg-amber-50",
    payout: "border-mint/40 bg-mint-soft",
    success: "border-mint/40 bg-mint-soft",
    info: "border-signal/35 bg-cyan-50",
  };

  return (
    <section aria-live="polite" aria-label="New activity on your account" className="space-y-2">
      {visible.slice(0, 3).map((alert) => {
        const Icon =
          alert.tone === "expense" ? AlertTriangle : alert.tone === "payout" ? Coins : Bell;
        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3.5 py-3",
              toneStyles[alert.tone] ?? toneStyles["info"],
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
                alert.tone === "expense"
                  ? "bg-amber-200/70 text-amber-800"
                  : "bg-mint/20 text-mint-deep",
              )}
            >
              <Icon size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.82rem] font-semibold leading-5 text-ink-deep">{alert.title}</p>
              {alert.body ? (
                <p className="mt-0.5 text-[0.74rem] leading-5 text-ink-soft">{alert.body}</p>
              ) : null}
              <p className="fig mt-1 text-[0.64rem] text-ink-mute">
                {dateTimeLabel(alert.createdAt)} · from the live ledger
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss this alert"
              onClick={() => setHidden((prev) => [...prev, alert.id])}
              className="mt-0.5 rounded-md p-1 text-ink-mute transition-colors hover:bg-white/60 hover:text-ink-deep"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[0.68rem] text-ink-mute">
          {visible.length} unread {visible.length === 1 ? "alert" : "alerts"} · dismissal hides it
          for you only; the entry stays on the record.
        </p>
        <button
          type="button"
          onClick={() => void dismissAll()}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 text-[0.7rem] font-semibold text-ink-soft transition-colors hover:text-ink-deep disabled:opacity-50"
        >
          <CheckCheck size={12} aria-hidden="true" />
          Mark all read
        </button>
      </div>
    </section>
  );
}
