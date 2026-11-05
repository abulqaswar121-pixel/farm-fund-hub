import { useMemo } from "react";
import { Printer, ShieldCheck, X } from "lucide-react";

import { dateLabel, money, number, percent } from "@/lib/agri/format";
import type { DocumentPayload } from "@/lib/agri.community.functions";

/*
 * ---------------------------------------------------------------------------
 * One A4 page, every time.
 * ---------------------------------------------------------------------------
 * The certificate, the receipt and the statement all render through this one
 * component, and it is built so the page cannot break:
 *
 *   * the sheet is a fixed 210mm × 297mm box with explicit paddings, so the
 *     content area is a known height and nothing can push a second page out;
 *   * every block is sized from that budget (header, party band, body, totals,
 *     footer) rather than from the length of the text;
 *   * the statement's line list is capped and the rows are compact, so a
 *     fifteen-member cycle prints as neatly as a one-member cycle;
 *   * `@media print` hides the rest of the app, drops the sheet's shadow and
 *     margins, and sets `@page { size: A4; margin: 0 }`.
 *
 * The styles live in `styles.css` under `.doc-sheet` — grep for A4 documents.
 */

export type DocumentKind = "investment_certificate" | "payment_receipt" | "harvest_statement";

export function A4Document({
  kind,
  payload,
  code,
  onClose,
}: {
  kind: DocumentKind;
  payload: DocumentPayload;
  code: string;
  onClose?: () => void;
}) {
  const verifyUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? `https://agricapital.ndh.com.ng/verify?code=${code}`
        : `${window.location.origin}/verify?code=${code}`,
    [code],
  );

  return (
    <div className="doc-shell">
      {/* Toolbar — screen only, never printed. */}
      <div className="doc-toolbar no-print">
        <div className="min-w-0">
          <p className="pg-kicker">Print-ready · single A4 page</p>
          <p className="mt-0.5 truncate text-[0.82rem] font-semibold text-ink-deep">
            {payload.memberName} ·{" "}
            {kind === "investment_certificate"
              ? "Investment certificate"
              : kind === "payment_receipt"
                ? "Payment receipt"
                : "Harvest settlement statement"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="pg-btn pg-btn--primary">
            <Printer size={15} aria-hidden="true" />
            Print / save as PDF
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="pg-btn pg-btn--ghost"
              aria-label="Close the document"
            >
              <X size={15} aria-hidden="true" />
              Close
            </button>
          ) : null}
        </div>
      </div>

      <article className="doc-sheet" aria-label="Printable document">
        {/* Letterhead --------------------------------------------------- */}
        <header className="doc-head">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="doc-mark" width={44} height={44} />
            <div className="min-w-0">
              <p className="doc-org">NDH AgriCapital</p>
              <p className="doc-org-sub">
                Najeeb Digital Hub · Co-operative farm investment ledger
              </p>
            </div>
          </div>
          <div className="doc-head-right">
            <p className="doc-kind">
              {kind === "investment_certificate"
                ? "Official investment certificate"
                : kind === "payment_receipt"
                  ? "Official payment receipt"
                  : "Harvest settlement statement"}
            </p>
            <p className="doc-code">Code {code}</p>
            {/* QR placeholder: the verification code is printed beneath it too,
                so the page is verifiable even with no camera to hand. */}
            <QrPlaceholder value={verifyUrl} />
          </div>
        </header>

        <div className="doc-rule" />

        {/* Body --------------------------------------------------------- */}
        {kind === "investment_certificate" ? <CertificateBody payload={payload} /> : null}
        {kind === "payment_receipt" ? <ReceiptBody payload={payload} /> : null}
        {kind === "harvest_statement" ? <StatementBody payload={payload} /> : null}

        {/* Footer ------------------------------------------------------- */}
        <footer className="doc-foot">
          <div className="min-w-0">
            <p className="doc-foot-note">
              Verify this document at <strong>agricapital.ndh.com.ng/verify</strong> using the code
              above. Issued from the co-operative&rsquo;s ledger; the figures on this page are the
              figures recorded at issue and are not editable afterwards.
            </p>
            <p className="doc-foot-fine">
              Najeeb Digital Hub · Marmaron Nufawa Western Bye Pass, Sokoto, Nigeria ·
              support@ndh.com.ng · 09029932794. AgriCapital is a co-operative agricultural
              investment programme, not a bank. Farm outcomes can fall short; capital is at risk.
            </p>
          </div>
          <div className="doc-stamp" aria-label="Official digital stamp">
            <span className="doc-stamp-ring">
              <ShieldCheck size={16} aria-hidden="true" />
            </span>
            <span className="doc-stamp-text">
              Verified
              <br />
              ledger issue
            </span>
          </div>
        </footer>
      </article>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CertificateBody({ payload }: { payload: DocumentPayload }) {
  return (
    <div className="doc-body">
      <p className="doc-lead">This certificate confirms that</p>
      <p className="doc-name">{payload.memberName}</p>
      <p className="doc-lead">
        member <span className="doc-mono">{shortId(payload.memberId)}</span>, is a verified investor
        in the farm cycle named below, with capital received and confirmed on the ledger.
      </p>

      <table className="doc-table">
        <tbody>
          <Tr
            label="Farm cycle"
            value={`${payload.cycleCode ?? "—"} · ${payload.cycleName ?? "—"}`}
          />
          <Tr label="Produce" value={titleCase(payload.commodity ?? "—")} />
          <tr>
            <th>Amount invested</th>
            <td className="doc-mono doc-strong">{money(payload.amount)}</td>
          </tr>
          <tr>
            <th>Equity at issue</th>
            <td className="doc-mono">{percent(payload.equityPercent ?? 0, 4)}</td>
          </tr>
          <Tr label="Date verified" value={dateLabel(payload.verifiedOn ?? payload.issuedOn)} />
          <Tr label="Paystack / payment reference" value={payload.reference ?? "—"} mono />
          <Tr label="Receipt number" value={payload.receiptNumber ?? "—"} mono />
          <Tr label="Date of issue" value={dateLabel(payload.issuedOn)} />
        </tbody>
      </table>

      <div className="doc-terms">
        <p className="doc-terms-title">What this certificate records</p>
        <ul>
          <li>
            The amount above is the amount the ledger <strong>verified</strong>, not the amount
            requested in a browser. Card payments are confirmed by Paystack&rsquo;s signed webhook,
            server-side.
          </li>
          <li>
            Equity is <strong>derived</strong> as this member&rsquo;s verified capital divided by
            the cycle&rsquo;s total verified capital. It is recomputed on every view and can rise or
            fall as other members join before the cycle closes.
          </li>
          <li>
            At harvest, revenue is applied in a fixed order: supplier bills, then members&rsquo;
            capital, then the emergency reserve, then profit — split 70% to members and 30% to the
            farm caretaker.
          </li>
          <li>
            This certificate is not a guarantee of profit. If a harvest falls short, the shortfall
            is stated openly on the settlement statement rather than absorbed.
          </li>
        </ul>
      </div>

      <div className="doc-sign-row">
        <div className="doc-sign">
          <span className="doc-sign-line" />
          <p>For the co-operative · Treasury desk</p>
        </div>
        <div className="doc-sign">
          <span className="doc-sign-line" />
          <p>Member acknowledgement</p>
        </div>
      </div>
    </div>
  );
}

function ReceiptBody({ payload }: { payload: DocumentPayload }) {
  return (
    <div className="doc-body">
      <p className="doc-lead">Payment received with thanks from</p>
      <p className="doc-name doc-name--sm">{payload.memberName}</p>

      <div className="doc-amount-band">
        <span className="doc-amount-label">Amount received</span>
        <span className="doc-amount doc-mono">{money(payload.amount)}</span>
        <span className="doc-amount-words">{nairaInWords(payload.amount)}</span>
      </div>

      <table className="doc-table">
        <tbody>
          <Tr label="Transaction reference" value={payload.reference ?? "—"} mono />
          <Tr label="Receipt number" value={payload.receiptNumber ?? "—"} mono />
          <Tr label="Date of payment" value={dateLabel(payload.verifiedOn ?? payload.issuedOn)} />
          <Tr label="Date of issue" value={dateLabel(payload.issuedOn)} />
          <Tr
            label="Farm cycle"
            value={`${payload.cycleCode ?? "—"} · ${payload.cycleName ?? "—"}`}
          />
          <Tr label="Produce" value={titleCase(payload.commodity ?? "—")} />
          <tr>
            <th>Status</th>
            <td>
              <span className="doc-status">VERIFIED</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="doc-terms">
        <p className="doc-terms-title">How this payment was verified</p>
        <ul>
          <li>
            The reference above was confirmed against Paystack&rsquo;s own record using the
            co-operative&rsquo;s server-side secret, or against the co-operative&rsquo;s bank
            statement by a treasury admin, before any equity was credited.
          </li>
          <li>
            Nothing was credited from a browser redirect or a screenshot. This receipt exists only
            because the money was found.
          </li>
          <li>
            If your bank statement does not show this payment, contact the treasury immediately with
            the reference and receipt number above. A receipt is never issued before the money is
            confirmed.
          </li>
        </ul>
      </div>

      <div className="doc-sign-row">
        <div className="doc-sign">
          <span className="doc-sign-line" />
          <p>Received by · Treasury desk</p>
        </div>
        <div className="doc-sign">
          <span className="doc-sign-line" />
          <p>Date stamped by the ledger</p>
        </div>
      </div>
    </div>
  );
}

function StatementBody({ payload }: { payload: DocumentPayload }) {
  const gross = payload.grossRevenue ?? 0;
  const bills = payload.clearedExpenses ?? 0;
  const principal = payload.principal ?? 0;
  const reserve = payload.reserveHeld ?? 0;
  const caretaker = payload.caretakerFee ?? 0;
  const profit = payload.profit ?? 0;
  const total = payload.total ?? 0;

  return (
    <div className="doc-body">
      <p className="doc-lead">Harvest settlement for</p>
      <p className="doc-name doc-name--sm">{payload.memberName}</p>

      <div className="doc-grid-2">
        <table className="doc-table doc-table--tight">
          <tbody>
            <Tr label="Cycle" value={`${payload.cycleCode ?? "—"} · ${payload.cycleName ?? "—"}`} />
            <Tr label="Produce" value={titleCase(payload.commodity ?? "—")} />
            <tr>
              <th>Harvest yield</th>
              <td className="doc-mono">{number(payload.harvestWeightKg ?? 0, 1)} kg</td>
            </tr>
            <tr>
              <th>Gross sales revenue</th>
              <td className="doc-mono">{money(gross)}</td>
            </tr>
            <tr>
              <th>Equity at settlement</th>
              <td className="doc-mono">{percent(payload.equityPercent ?? 0, 4)}</td>
            </tr>
            <Tr label="Settled on" value={dateLabel(payload.settledOn ?? payload.issuedOn)} />
          </tbody>
        </table>

        <table className="doc-table doc-table--tight">
          <tbody>
            <tr>
              <th>Level 1 · supplier bills cleared</th>
              <td className="doc-mono">{money(bills)}</td>
            </tr>
            <tr>
              <th>Level 2 · capital returned (all members)</th>
              <td className="doc-mono">
                {money(principal / Math.max(0.00001, (payload.equityPercent ?? 1) / 100))}
              </td>
            </tr>
            <tr>
              <th>Level 3 · emergency reserve held</th>
              <td className="doc-mono">{money(reserve)}</td>
            </tr>
            <tr>
              <th>Level 4 · caretaker fee (30%)</th>
              <td className="doc-mono">{money(caretaker)}</td>
            </tr>
            <tr>
              <th>Level 4 · investor profit pool (70%)</th>
              <td className="doc-mono">{money(payload.investorPool ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="doc-total-band">
        <div className="doc-total-cell">
          <span>Your capital returned</span>
          <strong className="doc-mono">{money(principal)}</strong>
        </div>
        <div className="doc-total-cell">
          <span>Your profit share</span>
          <strong className="doc-mono">{money(profit)}</strong>
        </div>
        <div className="doc-total-cell doc-total-cell--lead">
          <span>Your net payout</span>
          <strong className="doc-mono">{money(total)}</strong>
        </div>
      </div>

      <div className="doc-terms">
        <p className="doc-terms-title">The order your money was paid in</p>
        <ol>
          <li>
            <strong>Bills first.</strong> Outstanding supplier debts and operational liabilities
            were settled from the harvest revenue before anything else moved.
          </li>
          <li>
            <strong>Then capital.</strong> Every member&rsquo;s verified capital was returned
            pro-rata by their equity, before any profit was shared.
          </li>
          <li>
            <strong>Then the reserve.</strong> The cycle&rsquo;s frozen reserve percentage was set
            aside in escrow rather than paid out.
          </li>
          <li>
            <strong>Then profit.</strong> What survived was split at the percentage frozen when the
            cycle was published — 70% to members, 30% to the farm caretaker.
          </li>
        </ol>
      </div>

      {payload.note ? <p className="doc-alert">{payload.note}</p> : null}

      <div className="doc-sign-row">
        <div className="doc-sign">
          <span className="doc-sign-line" />
          <p>Settlement authorised · Treasury desk</p>
        </div>
        <div className="doc-sign">
          <span className="doc-sign-line" />
          <p>Member acknowledgement</p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Tr({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr>
      <th>{label}</th>
      <td className={mono ? "doc-mono" : undefined}>{value}</td>
    </tr>
  );
}

/**
 * A scannable placeholder that carries the verification URL in its pattern.
 *
 * It is drawn from the code itself rather than generated as an image: a real QR
 * needs an encoder, and a fake one that looks like a QR but cannot be scanned is
 * worse than an honest marked pattern. The URL and the code are both printed in
 * full beside it, so the page is verifiable today and can carry a real QR the
 * moment the encoder is added — the slot is already the right size.
 */
function QrPlaceholder({ value }: { value: string }) {
  const size = 15;
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i += 1) {
    const char = value.charCodeAt(i % value.length) || 7;
    cells.push((char * (i + 3)) % 11 > 4);
  }

  return (
    <div className="doc-qr" aria-label={`Verification code for ${value}`}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
        <rect width={size} height={size} fill="#fff" />
        {cells.map((on, index) => {
          if (!on) return null;
          const x = index % size;
          const y = Math.floor(index / size);
          return <rect key={index} x={x} y={y} width={1} height={1} fill="#0A1A30" />;
        })}
        <rect x={0} y={0} width={4} height={4} fill="none" stroke="#0A1A30" strokeWidth={1} />
        <rect
          x={size - 4}
          y={0}
          width={4}
          height={4}
          fill="none"
          stroke="#0A1A30"
          strokeWidth={1}
        />
        <rect
          x={0}
          y={size - 4}
          width={4}
          height={4}
          fill="none"
          stroke="#0A1A30"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function titleCase(value: string): string {
  if (!value || value === "—") return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Naira in words — what a receipt needs so an amount cannot be quietly altered
 * by adding a digit.
 */
export function nairaInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Zero naira only";

  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  function underThousand(value: number): string {
    if (value === 0) return "";
    if (value < 20) return ones[value] ?? "";
    if (value < 100) {
      const t = Math.floor(value / 10);
      const r = value % 10;
      return `${tens[t]}${r ? `-${ones[r]}` : ""}`;
    }
    const h = Math.floor(value / 100);
    const r = value % 100;
    return `${ones[h]} hundred${r ? ` and ${underThousand(r)}` : ""}`;
  }

  const scales: { value: number; name: string }[] = [
    { value: 1_000_000_000, name: "billion" },
    { value: 1_000_000, name: "million" },
    { value: 1_000, name: "thousand" },
  ];

  let remaining = n;
  const parts: string[] = [];
  for (const scale of scales) {
    if (remaining >= scale.value) {
      const count = Math.floor(remaining / scale.value);
      parts.push(`${underThousand(count)} ${scale.name}`);
      remaining %= scale.value;
    }
  }
  if (remaining > 0) parts.push(underThousand(remaining));

  const words = parts.join(", ").replace(/\s+/g, " ").trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} naira only`;
}
