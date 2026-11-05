import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BellRing,
  CalendarClock,
  Check,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Repeat,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";

import { Card, EmptyState, Figure, Notice, StatusChip } from "@/components/ndh/ledger-ui";
import { NIGERIAN_BANKS } from "@/lib/agri/banks";
import { MIN_CONTRIBUTION, MONTHLY_PLAN_OPTIONS, nairaWhole } from "@/lib/agri/contribution";
import { dateLabel, money } from "@/lib/agri/format";
import {
  getMemberCommunity,
  saveMemberProfile,
  saveMonthlyPlan,
  applyPlanToContribution,
} from "@/lib/agri.community.functions";
import { ROLE_LABEL } from "@/lib/agri/roles";
import { PortalHeading, PortalLoading } from "./portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Settings | NDH AgriCapital" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

/**
 * Profile settings, for every kind of account.
 *
 * Three panels, in the order a member fills them in: who they are, where their
 * money should be paid, and how they want to hear from the farm. Plus the
 * Agri-Save commitment, which is a setting in the same sense — it decides how
 * much is scheduled, not how much is credited. Only a verified payment ever
 * credits equity.
 */
function ProfilePage() {
  const load = useServerFn(getMemberCommunity);
  const save = useServerFn(saveMemberProfile);
  const savePlan = useServerFn(saveMonthlyPlan);

  const [data, setData] = useState<Awaited<ReturnType<typeof getMemberCommunity>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    whatsappNumber: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
    notifyEmail: true,
    notifyWhatsapp: true,
    monthlyAmount: String(MONTHLY_PLAN_OPTIONS[1]),
    planCycleId: "",
  });

  async function refresh() {
    try {
      const next = await load();
      setData(next);
      setForm({
        fullName: next.profile.fullName,
        phone: next.profile.phone,
        whatsappNumber: next.profile.whatsappNumber,
        bankName: next.profile.bankName,
        accountNumber: next.profile.accountNumber,
        accountName: next.profile.accountName,
        notifyEmail: next.profile.notifyEmail,
        notifyWhatsapp: next.profile.notifyWhatsapp,
        monthlyAmount: String(next.plan.amount ?? MONTHLY_PLAN_OPTIONS[1]),
        planCycleId: next.cycles[0]?.id ?? "",
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submitDetails() {
    setBusy(true);
    try {
      await save({
        data: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          whatsappNumber: form.whatsappNumber.trim(),
          bankName: form.bankName,
          accountNumber: form.accountNumber.trim(),
          accountName: form.accountName.trim(),
          notifyEmail: form.notifyEmail,
          notifyWhatsapp: form.notifyWhatsapp,
        },
      });
      setFlash({ tone: "success", text: "Your details are saved." });
      await refresh();
    } catch (error) {
      setFlash({
        tone: "error",
        text: error instanceof Error ? error.message : "Your details could not be saved",
      });
    }
    setBusy(false);
  }

  async function startPlan() {
    setBusy(true);
    try {
      const amount = Number(form.monthlyAmount);
      const result = await savePlan({
        data: {
          action: "start",
          amount,
          cycleId: form.planCycleId || null,
          months: 6,
        },
      });
      setFlash({
        tone: "success",
        text: `Agri-Save set up: ${nairaWhole(amount)} a month, ${result.scheduled} months scheduled. Each month is paid like any other contribution — equity is credited only when the payment is verified.`,
      });
      await refresh();
    } catch (error) {
      setFlash({
        tone: "error",
        text: error instanceof Error ? error.message : "The plan could not be saved",
      });
    }
    setBusy(false);
  }

  async function pausePlan() {
    setBusy(true);
    try {
      await savePlan({ data: { action: "pause" } });
      setFlash({
        tone: "info",
        text: "Agri-Save paused. The months already scheduled are untouched.",
      });
      await refresh();
    } catch {
      setFlash({ tone: "error", text: "The plan could not be paused" });
    }
    setBusy(false);
  }

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={18} />}
          title="Your settings could not be loaded"
          action={
            <button
              type="button"
              className="pg-btn pg-btn--ghost mt-1"
              onClick={() => void refresh()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
          }
        >
          Nothing has been changed. This page only reads and writes your own details.
        </EmptyState>
      </Card>
    );
  }

  if (!data) return <PortalLoading label="Opening your settings…" />;

  const payoutIncomplete =
    !form.bankName || !form.accountNumber || form.accountNumber.length !== 10 || !form.accountName;

  const dueCount = data.charges.filter((charge) => charge.status === "due").length;
  const paidCount = data.charges.filter((charge) => charge.status === "paid").length;

  return (
    <div className="space-y-6">
      <PortalHeading
        kicker="Profile & settings"
        title="Your details, your bank, your alerts"
        blurb="Used for exactly three things: paying you at harvest, reaching you when something happens on the farm, and printing a certificate with the right name on it."
        action={<StatusChip status="info" label={ROLE_LABEL[data.profile.role]} />}
      />

      {flash ? (
        <Notice tone={flash.tone}>
          {flash.text}
          <button
            type="button"
            onClick={() => setFlash(null)}
            className="ml-2 font-semibold underline underline-offset-2"
          >
            dismiss
          </button>
        </Notice>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 space-y-5">
          {/* Personal info ---------------------------------------------- */}
          <Card className="p-5">
            <PanelHead
              icon={<UserRound size={16} />}
              kicker="Personal information"
              title="Who the certificate should name"
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" hint="As you want it printed on your certificate" span>
                <input
                  className="pg-input h-11"
                  value={form.fullName}
                  autoComplete="name"
                  onChange={(event) => set("fullName", event.target.value)}
                />
              </Field>
              <Field label="Email" hint="Read-only — it is your sign-in">
                <input className="pg-input h-11 opacity-70" value={data.profile.email} readOnly />
              </Field>
              <Field label="Phone number">
                <input
                  className="pg-input h-11"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  placeholder="0803 123 4567"
                  onChange={(event) => set("phone", event.target.value)}
                />
              </Field>
              <Field label="WhatsApp number" hint="Where the farm's daily updates go" span>
                <input
                  className="pg-input h-11"
                  inputMode="tel"
                  value={form.whatsappNumber}
                  placeholder="0803 123 4567"
                  onChange={(event) => set("whatsappNumber", event.target.value)}
                />
              </Field>
            </div>
          </Card>

          {/* Payout bank ------------------------------------------------ */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <PanelHead
                icon={<Banknote size={16} />}
                kicker="Payout bank details"
                title="Where a harvest payout should land"
              />
              {data.profile.bankVerified ? (
                <span className="pg-chip pg-chip--mint">
                  <BadgeCheck size={11} aria-hidden="true" />
                  Name confirmed
                </span>
              ) : (
                <span className="pg-chip pg-chip--amber">Awaiting name check</span>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Bank" hint="Nigerian banks and licensed fintechs">
                <select
                  className="pg-input h-11"
                  value={form.bankName}
                  onChange={(event) => set("bankName", event.target.value)}
                >
                  <option value="">Choose your bank…</option>
                  {NIGERIAN_BANKS.map((bank) => (
                    <option key={`${bank.name}-${bank.code}`} value={bank.name}>
                      {bank.name}
                    </option>
                  ))}
                  {form.bankName && !NIGERIAN_BANKS.some((b) => b.name === form.bankName) ? (
                    <option value={form.bankName}>{form.bankName}</option>
                  ) : null}
                </select>
              </Field>

              <Field label="Account number" hint="10 digits, no spaces">
                <input
                  className="pg-input h-11"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.accountNumber}
                  placeholder="0123456789"
                  onChange={(event) =>
                    set("accountNumber", event.target.value.replace(/[^0-9]/g, "").slice(0, 10))
                  }
                />
              </Field>

              <Field
                label="Verified account holder name"
                hint="Exactly as your bank has it, including middle names"
                span
              >
                <input
                  className="pg-input h-11"
                  value={form.accountName}
                  placeholder="e.g. Aisha Bello Musa"
                  onChange={(event) => set("accountName", event.target.value)}
                />
              </Field>
            </div>

            {payoutIncomplete && (form.bankName || form.accountNumber || form.accountName) ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[0.72rem] leading-5 text-amber-800">
                Payout details need all three: the bank, the 10-digit account number and the account
                holder name. Save is refused until they are complete, because half a payout route is
                how a harvest payment gets stuck.
              </p>
            ) : null}

            <p className="mt-3 flex gap-2 text-[0.68rem] leading-5 text-ink-mute">
              <ShieldCheck
                size={12}
                className="mt-0.5 shrink-0 text-signal-deep"
                aria-hidden="true"
              />
              <span>
                Only the treasury desk can see these details. They are never shown on a public page,
                never posted to the WhatsApp group, and never included in a farm update.
              </span>
            </p>
          </Card>

          {/* Notifications ---------------------------------------------- */}
          <Card className="p-5">
            <PanelHead
              icon={<BellRing size={16} />}
              kicker="Notification preferences"
              title="How the farm should reach you"
            />
            <div className="mt-4 space-y-2.5">
              <Toggle
                label="Email notifications"
                hint={`Receipts, settlement statements and expense alerts to ${data.profile.email || "your email"}`}
                icon={<Mail size={14} />}
                checked={form.notifyEmail}
                onChange={(value) => set("notifyEmail", value)}
              />
              <Toggle
                label="WhatsApp alerts"
                hint="Daily farm updates and the moment an expense is logged"
                icon={<MessageCircle size={14} />}
                checked={form.notifyWhatsapp}
                onChange={(value) => set("notifyWhatsapp", value)}
              />
            </div>
            <p className="mt-2.5 text-[0.68rem] leading-5 text-ink-mute">
              Turning both off does not hide anything from your account — the alert banner and the
              farm feed stay exactly the same. It only stops us pushing to you.
            </p>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="pg-btn pg-btn--primary"
              onClick={() => void submitDetails()}
              disabled={busy || form.fullName.trim().length < 2}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save my details
            </button>
            <Link to="/portal/investor" className="pg-btn pg-btn--ghost">
              Back to my dashboard
            </Link>
          </div>
        </div>

        {/* Right column ----------------------------------------------- */}
        <div className="min-w-0 space-y-5">
          {/* Agri-Save -------------------------------------------------- */}
          <Card className="p-5">
            <PanelHead
              icon={<Repeat size={16} />}
              kicker="Monthly Agri-Save"
              title="Fund the next cycle without thinking about it"
            />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Figure
                label="Monthly amount"
                value={data.plan.active ? nairaWhole(data.plan.amount ?? 0) : "Not set"}
                caption={data.plan.active ? "Active plan" : "One-time only"}
              />
              <Figure
                label="Months scheduled"
                value={`${dueCount + paidCount}`}
                caption={`${paidCount} paid · ${dueCount} due`}
              />
            </div>

            <div className="mt-4">
              <span className="pg-label">Monthly amount</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MONTHLY_PLAN_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => set("monthlyAmount", String(amount))}
                    aria-pressed={Number(form.monthlyAmount) === amount}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold transition-colors",
                      Number(form.monthlyAmount) === amount
                        ? "border-navy bg-navy text-white"
                        : "border-hairline bg-white text-ink-soft hover:border-hairline-strong",
                    )}
                  >
                    {nairaWhole(amount)}
                  </button>
                ))}
              </div>
              <input
                className="pg-input mt-2 h-11"
                inputMode="decimal"
                value={form.monthlyAmount}
                onChange={(event) =>
                  set("monthlyAmount", event.target.value.replace(/[^0-9]/g, ""))
                }
              />
              {Number(form.monthlyAmount) < MIN_CONTRIBUTION ? (
                <p className="mt-1 text-[0.68rem] font-medium text-amber-700">
                  The smallest monthly plan is {nairaWhole(MIN_CONTRIBUTION)}.
                </p>
              ) : null}
            </div>

            <label className="mt-3 block">
              <span className="pg-label">Which farm should it fund?</span>
              <select
                className="pg-input mt-1.5 h-11"
                value={form.planCycleId}
                onChange={(event) => set("planCycleId", event.target.value)}
              >
                <option value="">Let the treasury decide the next open cycle</option>
                {data.cycles
                  .filter((cycle) => cycle.status === "open")
                  .map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.code} · {cycle.name}
                    </option>
                  ))}
              </select>
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="pg-btn pg-btn--mint"
                onClick={() => void startPlan()}
                disabled={busy || Number(form.monthlyAmount) < MIN_CONTRIBUTION}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Repeat size={14} />}
                {data.plan.active ? "Update my plan" : "Set up Agri-Save"}
              </button>
              {data.plan.active ? (
                <button
                  type="button"
                  className="pg-btn pg-btn--ghost"
                  onClick={() => void pausePlan()}
                  disabled={busy}
                >
                  Pause
                </button>
              ) : null}
            </div>

            <p className="mt-3 text-[0.68rem] leading-5 text-ink-mute">
              A plan is a schedule, not a standing order on your card. Each month shows up as due,
              you pay it like any other contribution, and your equity is credited only when the
              ledger verifies the money.
            </p>
          </Card>

          {/* Schedule --------------------------------------------------- */}
          <Card className="min-w-0 overflow-hidden">
            <p className="pg-kicker border-b border-hairline px-4 py-3">Agri-Save schedule</p>
            {data.charges.length > 0 ? (
              <ul className="m-0 list-none divide-y divide-hairline p-0">
                {data.charges.slice(0, 8).map((charge) => (
                  <li
                    key={charge.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="fig text-[0.76rem] font-semibold text-ink-deep">
                        {dateLabel(charge.dueOn)}
                      </p>
                      {charge.note ? (
                        <p className="text-[0.66rem] text-ink-mute">{charge.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="fig text-[0.76rem] text-ink-soft">
                        {money(charge.amount)}
                      </span>
                      <StatusChip
                        status={
                          charge.status === "paid"
                            ? "success"
                            : charge.status === "due"
                              ? "pending"
                              : "info"
                        }
                        label={charge.status}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CalendarClock size={18} />} title="No plan running">
                Set a monthly amount above and the next six months will be scheduled. You can pause
                at any time.
              </EmptyState>
            )}
          </Card>

          {/* Account facts --------------------------------------------- */}
          <Card className="p-4">
            <p className="pg-kicker">Account</p>
            <dl className="mt-2.5 space-y-2 text-[0.75rem]">
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-ink-mute">
                  <Phone size={12} aria-hidden="true" />
                  Member ID
                </dt>
                <dd className="fig truncate text-[0.68rem] text-ink-soft">
                  {data.profile.id.slice(0, 8).toUpperCase()}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-1.5 text-ink-mute">
                  <Wallet size={12} aria-hidden="true" />
                  Member since
                </dt>
                <dd className="fig text-[0.72rem] text-ink-soft">
                  {dateLabel(data.profile.monthlyPlanStartedOn ?? null)}
                </dd>
              </div>
            </dl>
            <Link
              to="/portal/investor"
              className="mt-3 inline-flex items-center gap-1.5 text-[0.74rem] font-semibold text-signal-deep no-underline"
            >
              Print a certificate or receipt
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PanelHead({
  icon,
  kicker,
  title,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy text-signal">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="pg-kicker">{kicker}</p>
        <h2 className="mt-0.5 font-display text-[0.98rem] font-semibold leading-snug text-ink-deep">
          {title}
        </h2>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  span = false,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <label className={cn("block min-w-0", span && "sm:col-span-2")}>
      <span className="pg-label">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint ? (
        <span className="mt-1 block text-[0.66rem] leading-4 text-ink-mute">{hint}</span>
      ) : null}
    </label>
  );
}

function Toggle({
  label,
  hint,
  icon,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-hairline bg-porcelain px-3.5 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink-deep">
          <span className="text-signal-deep" aria-hidden="true">
            {icon}
          </span>
          {label}
        </p>
        <p className="mt-0.5 text-[0.7rem] leading-5 text-ink-mute">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-mint" : "bg-hairline-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[1.4rem]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
