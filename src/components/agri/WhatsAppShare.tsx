import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { useState } from "react";

import { getLogWhatsAppText } from "@/lib/agri.community.functions";
import { whatsappShareUrl } from "@/lib/agri/whatsapp";

/**
 * "Share to WhatsApp Group", one tap.
 *
 * The message is built on the server from the row that was just written — the
 * operator never types a summary — and shown in a box the worker can read
 * before sending. From there it is either copied or handed to WhatsApp with the
 * text already composed.
 *
 * The platform never posts to a group itself. A machine that can write into a
 * WhatsApp group unattended is a machine that can publish a wrong number to five
 * hundred people, so the last tap is always human.
 */
export function WhatsAppShare({
  cycleId,
  cycleCode,
  logType,
  logId,
  compact = false,
}: {
  cycleId: string;
  cycleCode: string;
  logType: string;
  logId?: string | null;
  compact?: boolean;
}) {
  const build = useServerFn(getLogWhatsAppText);
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await build({ data: { cycleId, logType, logId: logId ?? undefined } });
      setText(result.text);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The update could not be prepared");
    }
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked (insecure context or a denied permission). The text is
      // on screen and selectable, so the worker can still copy it by hand.
      setError("Your browser blocked the clipboard. Select the text above and copy it manually.");
    }
  }

  return (
    <div
      className={compact ? "min-w-0" : "min-w-0 rounded-xl border border-hairline bg-white p-3.5"}
    >
      {!compact ? (
        <p className="pg-label flex items-center gap-1.5">
          <MessageCircle size={12} className="text-[#25D366]" aria-hidden="true" />
          Share to WhatsApp group
        </p>
      ) : null}

      {!text ? (
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="mt-1.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#075E54] px-4 text-[0.8rem] font-semibold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <MessageCircle size={14} aria-hidden="true" />
          )}
          {busy ? "Writing the update…" : `Write the ${cycleCode || "farm"} update`}
        </button>
      ) : (
        <div className="mt-1.5 space-y-2">
          <label className="block">
            <span className="pg-label">The message to send</span>
            <textarea
              className="pg-input mt-1 h-40 w-full resize-y py-2 font-mono text-[0.72rem] leading-5"
              value={text}
              readOnly
              spellCheck={false}
              aria-label="Farm update message"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            <a
              href={whatsappShareUrl(text)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-[0.78rem] font-semibold text-[#04352c] no-underline transition-transform hover:-translate-y-0.5"
            >
              <MessageCircle size={14} aria-hidden="true" />
              Send to WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-white px-3 text-[0.74rem] font-semibold text-ink-soft transition-colors hover:border-hairline-strong hover:text-ink-deep"
            >
              {copied ? (
                <Check size={13} className="text-mint-deep" aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={busy}
              aria-label="Rebuild the message from the saved log"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-hairline bg-white text-ink-mute transition-colors hover:text-ink-deep disabled:opacity-60"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>

          <p className="text-[0.64rem] leading-4 text-ink-mute">
            Every figure was read from the entry you just saved. No cost, supplier or member amount
            is ever included, because a group message gets forwarded.
          </p>
        </div>
      )}

      {error ? (
        <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[0.68rem] leading-5 text-amber-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
