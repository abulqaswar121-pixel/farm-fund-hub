import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Landmark, ReceiptText, Sprout } from "lucide-react";

import {
  EmptyLedger,
  formatDate,
  Kicker,
  Money,
  Notice,
  PageHeader,
  StatusPill,
} from "@/components/ledger";
import { Input } from "@/components/ui/input";
import { usePortalContext } from "../portal";
import {
  getPortalData,
  startPaystackCheckout,
  verifyPaystackContribution,
} from "@/lib/apex.functions";
import { openPaystackCheckout } from "@/lib/paystack-client";

export const Route = createFileRoute("/portal/member")({
  component: MemberPortal,
});

type PortalData = Awaited<ReturnType<typeof getPortalData>>;

function MemberPortal() {
  const { role } = usePortalContext();
  const [data, setData] = useState<PortalData | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPortal = useServerFn(getPortalData);
  const beginPayment = useServerFn(startPaystackCheckout);
  const verifyPayment = useServerFn(verifyPaystackContribution);

  useEffect(() => {
    loadPortal()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  async function refresh() {
    setData(await loadPortal());
  }

  async function handleContribute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage({ tone: "error", text: "Enter a valid amount to contribute." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // The exact existing flow: server-started checkout, Paystack popup, server-verified receipt.
      const checkout = await beginPayment({ data: { amount, email: data?.user.email ?? "" } });
      await openPaystackCheckout({
        publicKey: checkout.publicKey,
        email: checkout.email,
        amount,
        reference: checkout.reference,
        onVerified: async () => {
          await verifyPayment({ data: { reference: checkout.reference } });
          setMessage({ tone: "success", text: "Contribution verified and added to the ledger." });
          await refresh();
        },
        onClose: () => setBusy(false),
        onError: (text) => setMessage({ tone: "error", text }),
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to start payment",
      });
      setBusy(false);
    }
  }

  if (role !== "contributor" && role !== "admin") {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl text-ink">The member view is for contributors.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in as a contributor to see your own equity and contribution history.
        </p>
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-ink-soft">
          {failed ? "We could not load your ledger." : "Opening your ledger…"}
        </p>
      </div>
    );
  }

  const myContributions = data.contributions.filter((item) => item.member_id === data.user.id);
  const myPayouts = data.cycles.flatMap((cycle) =>
    cycle.payouts
      .filter((payout) => payout.memberId === data.user.id)
      .map((payout) => ({
        ...payout,
        cycleDate: cycle.date,
        cycleNote: cycle.note,
        cycleRevenue: cycle.revenue,
      })),
  );

  return (
    <div>
      <PageHeader
        kicker="Your ledger"
        title={`Welcome, ${data.user.name.split(" ")[0] || "member"}.`}
        blurb="Your standing in the cooperative — pool balance, what you have contributed, your share of equity, and the movement of the books."
        actions={
          <form className="flex items-center gap-2" onSubmit={handleContribute}>
            <Input
              className="ledger-input h-10 w-36"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Amount (₦)"
              disabled={busy}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-leaf px-4 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep disabled:opacity-60"
            >
              <Landmark className="size-4" /> {busy ? "Opening checkout…" : "Contribute"}
            </button>
          </form>
        }
      />

      {message && (
        <Notice tone={message.tone} className="mt-6">
          {message.text}
        </Notice>
      )}

      {/* Standing */}
      <section className="mt-8 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule md:grid-cols-3">
        <StandingBlock
          label="Pool balance (net)"
          value={<Money value={data.totals.netPool} />}
          caption={`${data.totals.memberCount} members share the pool`}
        />
        <StandingBlock
          label="Your contributions"
          value={<Money value={data.my.contributed} tone="credit" />}
          caption={`${myContributions.length} entries on the record`}
        />
        <StandingBlock
          label="Your equity share"
          value={<span className="fig">{data.my.equityPercent.toFixed(2)}%</span>}
          caption="Computed live · never stored"
          tone="gold"
        />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        {/* My contributions */}
        <div className="ledger-panel overflow-hidden">
          <div className="border-b border-rule px-5 py-4">
            <Kicker>Your history · read-only</Kicker>
            <h2 className="mt-1 text-lg">Contributions ({myContributions.length})</h2>
          </div>
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {myContributions.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyLedger>Make your first contribution with the button above.</EmptyLedger>
                    </td>
                  </tr>
                )}
                {myContributions.map((item) => (
                  <tr key={item.id}>
                    <td className="fig">{formatDate(item.date)}</td>
                    <td>
                      {item.category}
                      {item.note ? (
                        <span className="block text-[11px] text-ink-soft">{item.note}</span>
                      ) : null}
                    </td>
                    <td>
                      <StatusPill status={item.payment_status} />
                    </td>
                    <td className="num font-semibold">
                      <Money
                        value={Number(item.amount)}
                        tone={item.payment_status === "success" ? "credit" : "plain"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">
          {/* Payouts */}
          <div className="ledger-panel overflow-hidden">
            <div className="border-b border-rule px-5 py-4">
              <div className="flex items-center gap-2">
                <ReceiptText className="size-4 text-gold" />
                <Kicker>Your distributions</Kicker>
              </div>
              <h2 className="mt-1 text-lg">Harvest payouts ({myPayouts.length})</h2>
            </div>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th className="num">Equity</th>
                    <th className="num">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {myPayouts.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <EmptyLedger>
                          You will appear here when a harvest cycle is closed.
                        </EmptyLedger>
                      </td>
                    </tr>
                  )}
                  {myPayouts.map((payout) => (
                    <tr key={payout.id}>
                      <td>
                        <span className="font-medium">
                          {payout.cycleNote || `Cycle of ${formatDate(payout.cycleDate)}`}
                        </span>
                        <span className="block text-[11px] text-ink-soft">
                          {formatDate(payout.cycleDate)} · revenue{" "}
                          <Money value={payout.cycleRevenue} />
                        </span>
                      </td>
                      <td className="num fig">{payout.percent.toFixed(2)}%</td>
                      <td className="num font-semibold">
                        <Money value={payout.amount} tone="gold" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock updates */}
          <div className="ledger-panel overflow-hidden">
            <div className="border-b border-rule px-5 py-4">
              <div className="flex items-center gap-2">
                <Sprout className="size-4 text-leaf" />
                <Kicker>Growth updates</Kicker>
              </div>
              <h2 className="mt-1 text-lg">Latest stock counts</h2>
            </div>
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Count</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stockLogs.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <EmptyLedger>The operator logs stock counts here.</EmptyLedger>
                      </td>
                    </tr>
                  )}
                  {data.stockLogs.slice(0, 8).map((item) => (
                    <tr key={item.id}>
                      <td className="fig">{formatDate(item.date)}</td>
                      <td className="num fig font-semibold">{item.count.toLocaleString()}</td>
                      <td className="max-w-56 truncate text-ink-soft">{item.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StandingBlock({
  label,
  value,
  caption,
  tone = "plain",
}: {
  label: string;
  value: React.ReactNode;
  caption: string;
  tone?: "plain" | "gold";
}) {
  return (
    <div className={`bg-card px-6 py-5 ${tone === "gold" ? "" : ""}`}>
      <Kicker>{label}</Kicker>
      <p className={`mt-2 text-2xl font-semibold ${tone === "gold" ? "text-gold" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-soft">{caption}</p>
    </div>
  );
}
