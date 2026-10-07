import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquare, Send, X } from "lucide-react";

/**
 * Floating AI concierge for investor FAQs.
 *
 * It is a scripted, rules-based assistant: it answers from a fixed knowledge
 * base of the platform's locked rules, so it can never invent a return figure
 * or promise a payout. Anything it does not know is handed to the human
 * support channel.
 */

type Topic = {
  id: string;
  question: string;
  answer: string;
};

const TOPICS: Topic[] = [
  {
    id: "start",
    question: "How do I invest in a cycle?",
    answer:
      "Open the Farm Marketplace, choose an open cycle and enter an amount at or above its minimum entry ticket. You can pay with Paystack instantly or request an offline bank transfer. Your equity only appears in the ledger after the payment is verified — Paystack payments are confirmed by our server webhook, never by the browser.",
  },
  {
    id: "split",
    question: "What does the 70/30 split mean?",
    answer:
      "At the moment a cycle is published, its profit split is frozen. 70% of net profit is shared across investors in proportion to their verified contribution in that cycle; 30% pays the farm management and caretaker operator who ran the stock. Because it is locked at publication, no one can renegotiate it after harvest.",
  },
  {
    id: "waterfall",
    question: "In what order is harvest money paid out?",
    answer:
      "A strict four-level waterfall: Level 1 settles outstanding operational liabilities such as feed supplier balances; Level 2 returns 100% of capital principal pro-rata to verified contributors; Level 3 sets aside the cycle's emergency co-operative reserve for future input price shocks; Level 4 distributes remaining net profit at the locked split.",
  },
  {
    id: "equity",
    question: "How is my equity percentage calculated?",
    answer:
      "Live, and only from the ledger: your verified contributions in that cycle divided by all verified contributions in that cycle, times 100. Equity is never stored as an editable field, so no administrator can nudge your share up or down.",
  },
  {
    id: "risk",
    question: "Could I lose money?",
    answer:
      "Yes. Agriculture carries biological, weather and market risk — disease, flooding, feed price spikes or buyer price drops can reduce or eliminate profit, and the principal return at Level 2 depends on the harvest realising enough revenue. Every cycle carries a weather and insurance record, and AgriCapital publishes incidents openly, but no return is guaranteed.",
  },
  {
    id: "cycles",
    question: "Which commodities can I back?",
    answer:
      "Five stock families: catfish aquaculture, broiler poultry, layer poultry, grain and field crops such as maize, soya and rice, and greenhouse horticulture including tomatoes and bell peppers. Each has its own growth telemetry — biomass and FCR for catfish, crate yield for layers, bags harvested for grain.",
  },
  {
    id: "liquidity",
    question: "Can I get my money out mid-cycle?",
    answer:
      "Capital is committed for the life of the cycle. If you need liquidity, the Co-op Share Transfer board lets you offer your verified equity to other registered members at par; the transfer only settles when the buyer's payment is verified and an admin confirms it, and the ledger records both sides.",
  },
  {
    id: "visit",
    question: "Can I visit the farm?",
    answer:
      "Yes. Verified investors can book a weekend inspection visit from the investor portal. Bookings are confirmed by the operator on the ground, so we only publish visit slots we can genuinely host.",
  },
];

function replyFor(input: string): { answer: string; followUps: Topic[] } {
  const text = input.toLowerCase();
  const scored = TOPICS.map((topic) => {
    const words = topic.question
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3);
    const hits = words.filter((word) => text.includes(word)).length;
    const keywordHit = topic.id !== "start" && text.includes(topic.id.replace("-", " "));
    return { topic, score: hits + (keywordHit ? 2 : 0) };
  }).sort((a, b) => b.score - a.score);

  if (!scored[0] || scored[0].score === 0) {
    return {
      answer:
        "I can only answer from AgriCapital's published rules — cycle mechanics, the waterfall, equity, risk and visits. I do not give personalised financial advice or quote a projected return. For anything else, our support team replies on support@ndh.com.ng.",
      followUps: TOPICS.slice(0, 3),
    };
  }

  const answered = scored[0].topic;
  return {
    answer: answered.answer,
    followUps: TOPICS.filter((topic) => topic.id !== answered.id).slice(0, 3),
  };
}

type Message = { id: number; role: "user" | "bot"; text: string; followUps?: Topic[] };

export function AiConcierge() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "bot",
      text: "Good day. I am the AgriCapital concierge. I answer from the platform's locked rules only — no projections, no promises. What would you like to check?",
      followUps: TOPICS.slice(0, 3),
    },
  ]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function send(text: string) {
    const value = text.trim();
    if (!value) return;
    const { answer, followUps } = replyFor(value);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: "user", text: value },
      // a beat of latency so the reply reads as considered rather than canned
      { id: nextId.current++, role: "bot", text: answer, followUps },
    ]);
    setDraft("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close the AgriCapital concierge" : "Ask the AgriCapital concierge"}
        className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center overflow-hidden rounded-full border border-navy-line bg-navy shadow-[var(--shadow-deep)] transition-transform hover:scale-105"
      >
        {open ? (
          <X size={20} className="text-white" />
        ) : (
          <img
            src="/ndh-ai-assistant.png"
            alt=""
            className="size-full object-cover"
            width={56}
            height={56}
          />
        )}
        {!open ? (
          <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full border-2 border-navy bg-mint" />
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed bottom-24 right-5 z-50 flex max-h-[min(78vh,34rem)] w-[min(92vw,23rem)] flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-[var(--shadow-deep)]"
          role="dialog"
          aria-label="AgriCapital concierge"
        >
          <div className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
            <img
              src="/ndh-ai-assistant.png"
              alt=""
              className="size-9 rounded-full object-cover ring-2 ring-signal/40"
              width={36}
              height={36}
            />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold">AgriCapital Concierge</p>
              <p className="flex items-center gap-1.5 text-[0.68rem] text-slate-400">
                <span className="pg-live-dot" /> Answers from locked cycle rules
              </p>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-porcelain px-3.5 py-4"
          >
            {messages.map((message) => (
              <div key={message.id}>
                <div
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-3.5 py-2.5 text-[0.8rem] leading-6 text-white"
                      : "max-w-[92%] rounded-2xl rounded-bl-sm border border-hairline bg-white px-3.5 py-2.5 text-[0.8rem] leading-6 text-ink-soft"
                  }
                >
                  {message.text}
                </div>
                {message.followUps?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.followUps.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => send(topic.question)}
                        className="rounded-full border border-hairline bg-white px-2.5 py-1 text-left text-[0.68rem] font-medium text-ink-soft transition-colors hover:border-signal hover:text-ink-deep"
                      >
                        {topic.question}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form
            className="flex items-center gap-2 border-t border-hairline bg-white px-3 py-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <MessageSquare size={15} className="shrink-0 text-ink-mute" aria-hidden="true" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about rules, equity, risk…"
              aria-label="Your question"
              className="h-9 flex-1 border-0 bg-transparent text-[0.8rem] outline-none placeholder:text-ink-mute"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-white disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </form>
          <p className="border-t border-hairline bg-porcelain px-3 py-2 text-[0.62rem] leading-4 text-ink-mute">
            General information only — not financial advice.{" "}
            <a
              href="#top"
              className="inline-flex items-center gap-0.5 font-semibold text-signal-deep no-underline"
            >
              Back to top <ArrowUp size={10} aria-hidden="true" />
            </a>
          </p>
        </div>
      ) : null}
    </>
  );
}
