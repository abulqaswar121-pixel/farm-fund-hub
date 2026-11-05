import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { useState } from "react";

import { Card, EmptyState, Notice, SectionHeader } from "@/components/ndh/ledger-ui";
import { getCycleBroadcastDraft } from "@/lib/agri.community.functions";
import { whatsappShareUrl } from "@/lib/agri/whatsapp";
import { WhatsAppShare } from "./WhatsAppShare";
import type { AdminConsole } from "@/lib/agri.ops.functions";
import { cn } from "@/lib/utils";

/**
 * WhatsApp updates, from the admin side.
 *
 * Two tools, because the co-operative sends two kinds of message:
 *
 *   1. **One log, one message.** Pick the cycle and the log type and the same
 *      generator the operator uses writes the update — useful when a worker
 *      filed from a phone with no signal and asks the office to post it.
 *   2. **A weekly summary.** One button builds a cycle's standing update from
 *      its latest approved log plus the funding figure, so the group hears from
 *      the farm on a schedule rather than only when somebody remembers.
 *
 * Neither one sends anything. The admin reads it, then presses send in
 * WhatsApp — the last tap is always a person.
 */
export function BroadcastPanel({ console_ }: { console_: AdminConsole }) {
  const [cycleId, setCycleId] = useState(console_.cycles[0]?.id ?? "");
  const [logType, setLogType] = useState("feed");
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const build = useServerFn(getCycleBroadcastDraft);

  const cycle = console_.cycles.find((row) => row.id === cycleId);

  async function makeSummary() {
    if (!cycleId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await build({ data: { cycleId } });
      setDraft(result.text);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The summary could not be built");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="WhatsApp updates"
        title="Ready-to-send farm updates"
        blurb="Every message is written from the ledger row it describes, so a figure cannot drift between the book and the group. Nothing is posted automatically — you read it, then send it."
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        {/* One log ------------------------------------------------------ */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-signal">
              <MessageCircle size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="pg-kicker">Update from one entry</p>
              <h3 className="mt-0.5 font-display text-[0.98rem] font-semibold text-ink-deep">
                Re-post a worker&apos;s log
              </h3>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="pg-label">Cycle</span>
              <select
                className="pg-input mt-1 h-10"
                value={cycleId}
                onChange={(event) => setCycleId(event.target.value)}
              >
                {console_.cycles.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code} · {row.name} · {row.status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="pg-label">Which kind of log</span>
              <select
                className="pg-input mt-1 h-10"
                value={logType}
                onChange={(event) => setLogType(event.target.value)}
              >
                <option value="feed">Feed</option>
                <option value="growth_sample">Growth sample</option>
                <option value="mortality">Mortality</option>
                <option value="medication">Medication</option>
                <option value="general">Eggs / yield</option>
                <option value="harvest">Harvest weigh-in</option>
              </select>
            </label>
          </div>

          {cycleId ? (
            <div className="mt-4">
              <WhatsAppShare
                key={`${cycleId}-${logType}`}
                cycleId={cycleId}
                cycleCode={cycle?.code ?? ""}
                logType={logType}
                compact
              />
            </div>
          ) : (
            <EmptyState icon={<MessageCircle size={18} />} title="No cycles yet">
              Publish a cycle before sending an update about it.
            </EmptyState>
          )}
        </Card>

        {/* Weekly summary ---------------------------------------------- */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-signal">
              <Sparkles size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="pg-kicker">This week&apos;s summary</p>
              <h3 className="mt-0.5 font-display text-[0.98rem] font-semibold text-ink-deep">
                Latest log plus the funding figure
              </h3>
            </div>
          </div>

          <p className="mt-3 text-[0.78rem] leading-6 text-ink-soft">
            Builds one message from{" "}
            <strong className="text-ink-deep">{cycle?.code ?? "a cycle"}</strong>&apos;s most recent
            log and its live funding percentage. Good for a Sunday-evening post to the group.
          </p>

          <button
            type="button"
            onClick={() => void makeSummary()}
            disabled={busy || !cycleId}
            className="pg-btn pg-btn--primary mt-3 h-10"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Write the weekly summary
          </button>

          {error ? (
            <Notice tone="error" className="mt-3">
              {error}
            </Notice>
          ) : null}

          {draft ? (
            <div className="mt-3">
              <label className="block">
                <span className="pg-label">The message</span>
                <textarea
                  className="pg-input mt-1 h-44 w-full resize-y py-2 font-mono text-[0.72rem] leading-5"
                  value={draft}
                  readOnly
                  spellCheck={false}
                  aria-label="Weekly summary message"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <a
                  href={whatsappShareUrl(draft)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-[0.78rem] font-semibold text-[#04352c] no-underline transition-transform hover:-translate-y-0.5"
                >
                  <Send size={14} aria-hidden="true" />
                  Send to WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(draft).catch(() => undefined);
                  }}
                  className="inline-flex h-10 items-center rounded-lg border border-hairline bg-white px-3 text-[0.74rem] font-semibold text-ink-soft hover:text-ink-deep"
                >
                  Copy
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="p-4">
        <p className="pg-kicker">What never goes into a group message</p>
        <p className={cn("mt-1.5 text-[0.76rem] leading-6 text-ink-soft")}>
          No naira cost, no supplier name, no member balance, no equity figure. A WhatsApp group is
          the least private place a message can end up and the most likely to be forwarded, so the
          generator is written to emit farm readings only — and the same rule is enforced in one
          pure function, not in each button.
        </p>
      </Card>
    </div>
  );
}
