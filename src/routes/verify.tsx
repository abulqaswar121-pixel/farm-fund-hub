import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BadgeCheck, FileSearch, Loader2, Lock, ShieldCheck, Sprout } from "lucide-react";

import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { PrecisionHeader } from "@/components/ndh/PrecisionHeader";
import { Card, EmptyState, Notice } from "@/components/ndh/ledger-ui";
import { dateLabel, money, percent } from "@/lib/agri/format";
import { lookupDocument } from "@/lib/agri.community.functions";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a Document | NDH FarmFund" },
      {
        name: "description",
        content:
          "Check any NDH FarmFund investment certificate, payment receipt or harvest settlement statement against the live register using the code printed on it.",
      },
      { property: "og:title", content: "Verify a Document | NDH FarmFund" },
    ],
  }),
  component: VerifyPage,
});

/**
 * Document verification.
 *
 * Every certificate, receipt and statement carries a code and a QR that points
 * here. A co-operative member, a family member checking on somebody, or an
 * official looking at a printed page can confirm that the document was issued
 * by the ledger — rather than typed in a word processor.
 *
 * The page deliberately shows *less* to a stranger than to the document's
 * owner. Anyone can confirm a code is real and see which cycle it belongs to;
 * the figures on the paper are returned only to the member or to treasury. That
 * rule lives in the `document_register` view, not in this component.
 */
function VerifyPage() {
  const lookup = useServerFn(lookupDocument);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | { state: "idle" }
    | { state: "error"; message: string }
    | {
        state: "found";
        document: NonNullable<Awaited<ReturnType<typeof lookupDocument>>["document"]>;
      }
    | { state: "missing" }
  >({ state: "idle" });

  async function check() {
    setBusy(true);
    try {
      const response = await lookup({ data: { code: code.trim().toUpperCase() } });
      if (!response.found) {
        setResult({ state: "missing" });
      } else {
        setResult({ state: "found", document: response.document! });
      }
    } catch (error) {
      setResult({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "The register could not be reached. Try again in a moment.",
      });
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-porcelain" id="top">
      <PrecisionHeader activePath="/verify" />

      <section className="band-dark">
        <div className="bg-grid-pattern absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[var(--page)] px-[var(--gutter)] py-12">
          <p className="pg-kicker pg-kicker--onDark">Document register</p>
          <h1 className="mt-2 font-display text-[1.7rem] font-bold leading-tight text-white md:text-[2.2rem]">
            Check a certificate, receipt or statement
          </h1>
          <p className="mt-2 max-w-2xl text-[0.86rem] leading-6 text-slate-300">
            Every page this platform prints carries a code and a QR. Type the code to confirm the
            document was issued by the ledger — and, if it is your own document, to see the figures
            printed on it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--page)] px-[var(--gutter)] py-10">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-5">
            <label className="block">
              <span className="pg-label">Document code</span>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  className="pg-input h-12 font-mono text-[0.92rem] tracking-wide"
                  value={code}
                  placeholder="AGC-CERT-XXXXXXXX"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && code.trim().length >= 6) void check();
                  }}
                />
                <button
                  type="button"
                  className="pg-btn pg-btn--primary h-12 shrink-0"
                  disabled={busy || code.trim().length < 6}
                  onClick={() => void check()}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSearch size={15} />}
                  Check code
                </button>
              </div>
              <span className="mt-1.5 block text-[0.68rem] text-ink-mute">
                The code is printed under the QR in the top-right corner of every document.
              </span>
            </label>

            <div className="mt-5">
              {result.state === "idle" ? (
                <EmptyState icon={<ShieldCheck size={18} />} title="Waiting for a code">
                  Nothing is looked up until you enter a code. The register never publishes a list
                  of documents, so nobody can browse other members&apos; paperwork.
                </EmptyState>
              ) : null}

              {result.state === "missing" ? (
                <Notice tone="warning">
                  No document with that code is on the register. Check the characters — O and 0, and
                  I and 1, are easy to mix up. If you were given a printed page with this code on
                  it, do not rely on it until the co-operative confirms it.
                </Notice>
              ) : null}

              {result.state === "error" ? <Notice tone="error">{result.message}</Notice> : null}

              {result.state === "found" ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl border border-mint/40 bg-mint-soft px-3.5 py-3">
                    <BadgeCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-mint-deep"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[0.85rem] font-semibold text-mint-deep">
                        This document is on the register
                      </p>
                      <p className="mt-0.5 text-[0.74rem] leading-5 text-ink-soft">
                        {result.document.title} · issued {dateLabel(result.document.issuedOn)}
                      </p>
                    </div>
                  </div>

                  <dl className="rounded-xl border border-hairline bg-white p-4 text-[0.78rem]">
                    <Row label="Code" value={result.document.code} mono />
                    <Row label="Kind" value={humanKind(result.document.kind)} />
                    {result.document.cycleCode ? (
                      <Row
                        label="Cycle"
                        value={`${result.document.cycleCode}${result.document.cycleName ? ` · ${result.document.cycleName}` : ""}`}
                      />
                    ) : null}
                    <Row label="Issued" value={dateLabel(result.document.issuedOn)} />
                  </dl>

                  {result.document.payload && Object.keys(result.document.payload).length > 0 ? (
                    <dl className="rounded-xl border border-hairline bg-porcelain p-4 text-[0.78rem]">
                      <p className="pg-kicker mb-2">Figures printed on the document</p>
                      <Row label="Member" value={result.document.payload.memberName ?? "—"} />
                      <Row label="Amount" value={money(result.document.payload.amount ?? 0)} mono />
                      {result.document.payload.equityPercent != null ? (
                        <Row
                          label="Equity at issue"
                          value={percent(result.document.payload.equityPercent, 4)}
                          mono
                        />
                      ) : null}
                      {result.document.payload.receiptNumber ? (
                        <Row label="Receipt" value={result.document.payload.receiptNumber} mono />
                      ) : null}
                      {result.document.payload.reference ? (
                        <Row label="Reference" value={result.document.payload.reference} mono />
                      ) : null}
                    </dl>
                  ) : (
                    <p className="flex items-start gap-2 rounded-xl border border-hairline bg-porcelain p-3.5 text-[0.72rem] leading-5 text-ink-mute">
                      <Lock
                        size={13}
                        className="mt-0.5 shrink-0 text-signal-deep"
                        aria-hidden="true"
                      />
                      <span>
                        The document is real and belongs to the cycle above. The figures printed on
                        it are shown only to its owner, signed in to their own account, and to the
                        treasury.
                      </span>
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </Card>

          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <p className="pg-kicker">What this proves, and what it does not</p>
              <ul className="mt-2.5 list-none space-y-2.5 p-0 text-[0.76rem] leading-5 text-ink-soft">
                <li>
                  <strong className="text-ink-deep">Proves</strong> that the page was issued by the
                  co-operative&apos;s own ledger, on the date shown, for the cycle shown.
                </li>
                <li>
                  <strong className="text-ink-deep">Proves</strong> that the document has not been
                  reissued with different figures: the code is bound to the figures it was printed
                  from.
                </li>
                <li>
                  <strong className="text-ink-deep">Does not prove</strong> that the money has been
                  banked. A receipt states what the ledger verified; your bank statement states what
                  your bank saw.
                </li>
                <li>
                  <strong className="text-ink-deep">Does not prove</strong> a harvest will be
                  profitable. A certificate records a contribution; it is not a guarantee of return.
                </li>
              </ul>
            </Card>

            <Card className="p-5">
              <p className="pg-kicker">Where documents come from</p>
              <p className="mt-2 text-[0.78rem] leading-6 text-ink-soft">
                Signed-in members print all three from their dashboard — an investment certificate,
                a payment receipt and a harvest settlement statement. Each is laid out to fit one A4
                page.
              </p>
              <Link to="/signin" className="pg-btn pg-btn--ghost mt-3 h-9 text-[0.78rem]">
                <Sprout size={14} aria-hidden="true" />
                Open my dashboard
              </Link>
            </Card>
          </div>
        </div>
      </section>

      <FamilyFooter />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 last:border-0">
      <dt className="shrink-0 text-ink-mute">{label}</dt>
      <dd
        className={
          mono
            ? "fig min-w-0 truncate text-right text-ink-deep"
            : "min-w-0 text-right text-ink-deep"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function humanKind(kind: string): string {
  if (kind === "investment_certificate") return "Investment certificate";
  if (kind === "payment_receipt") return "Payment receipt";
  if (kind === "harvest_statement") return "Harvest settlement statement";
  return kind;
}
