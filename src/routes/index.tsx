import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, CheckCircle2, CircleDollarSign, Leaf, LogOut, Plus, ShieldCheck, Sprout, Users, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { addOperatorExpense, getDashboardData, startPaystackCheckout, verifyPaystackContribution } from "@/lib/apex.functions";

declare global {
  interface Window {
    PaystackPop?: { setup: (options: { key: string; email: string; amount: number; ref: string; callback: (response: { reference: string }) => void; onClose: () => void }) => { openIframe: () => void } };
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apex Agri-Capital | Shared Farm Ledger" },
      { name: "description", content: "A secure shared ledger for an agriculture investment cooperative." },
      { property: "og:title", content: "Apex Agri-Capital | Shared Farm Ledger" },
      { property: "og:description", content: "A secure shared ledger for an agriculture investment cooperative." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

function App() {
  const [session, setSession] = useState<{ email?: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const loadDashboard = useServerFn(getDashboardData);
  const saveExpense = useServerFn(addOperatorExpense);
  const beginPayment = useServerFn(startPaystackCheckout);
  const verifyPayment = useServerFn(verifyPaystackContribution);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => setSession(sessionData.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setData(null);
      return;
    }
    setIsBusy(true);
    loadDashboard().then(setData).catch(() => setMessage("We could not load the ledger yet.")).finally(() => setIsBusy(false));
  }, [session]);

  async function handleAuth(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setAuthMessage("");
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (result.error) setAuthMessage(result.error.message);
    else if (authMode === "signup" && !result.data.session) setAuthMessage("Check your email to confirm your account, then sign in.");
    setIsBusy(false);
  }

  async function handlePayment() {
    const amount = Number(window.prompt("How much would you like to contribute?"));
    if (!Number.isFinite(amount) || amount <= 0 || !session?.email) return;
    setIsBusy(true);
    setMessage("");
    try {
      const checkout = await beginPayment({ data: { amount, email: session.email } });
      if (!window.PaystackPop) {
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.onload = () => openPaystack(checkout.publicKey, checkout.email, amount, checkout.reference);
        document.body.appendChild(script);
      } else openPaystack(checkout.publicKey, checkout.email, amount, checkout.reference);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start payment");
      setIsBusy(false);
    }
  }

  function openPaystack(key: string, customerEmail: string, amount: number, reference: string) {
    window.PaystackPop?.setup({
      key, email: customerEmail, amount: Math.round(amount * 100), ref: reference,
      callback: async (response) => {
        try {
          await verifyPayment({ data: { reference: response.reference } });
          setMessage("Contribution verified and added to the ledger.");
          setData(await loadDashboard());
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Payment could not be verified");
        } finally { setIsBusy(false); }
      },
      onClose: () => setIsBusy(false),
    }).openIframe();
  }

  async function handleExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsBusy(true);
    try {
      await saveExpense({ data: { amount: Number(form.get("amount")), category: String(form.get("category")), note: String(form.get("note") || "") } });
      setMessage("Expense added to the ledger.");
      event.currentTarget.reset();
      setData(await loadDashboard());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save expense"); }
    finally { setIsBusy(false); }
  }

  if (!session) return <AuthScreen {...{ authMode, setAuthMode, email, setEmail, password, setPassword, fullName, setFullName, authMessage, handleAuth, isBusy }} />;
  if (!data || isBusy && !data) return <LoadingScreen />;
  return <Dashboard {...{ data, handlePayment, handleExpense, handleSignOut: () => supabase.auth.signOut(), message, isBusy }} />;
}

function AuthScreen(props: { authMode: "login" | "signup"; setAuthMode: (mode: "login" | "signup") => void; email: string; setEmail: (value: string) => void; password: string; setPassword: (value: string) => void; fullName: string; setFullName: (value: string) => void; authMessage: string; handleAuth: (event: React.FormEvent) => void; isBusy: boolean }) {
  return <main className="min-h-screen bg-background px-5 py-8 text-foreground md:px-10 md:py-12">
    <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative flex flex-col justify-between bg-sidebar p-8 text-sidebar-foreground md:p-12">
        <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground"><Sprout className="size-6" /></span><span className="font-display text-lg font-bold tracking-tight">APEX AGRI-CAPITAL</span></div>
        <div className="max-w-lg py-16"><Badge className="mb-6 bg-sidebar-accent text-sidebar-accent-foreground">Shared farm ledger</Badge><h1 className="text-4xl font-bold leading-[1.05] md:text-6xl">Grow together.<br /><span className="text-sidebar-primary">Account clearly.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-sidebar-foreground/75">A single, trusted view of the capital, costs, stock, and returns behind the cooperative.</p></div>
        <div className="grid grid-cols-3 gap-4 border-t border-sidebar-border pt-6 text-xs text-sidebar-foreground/70"><span><ShieldCheck className="mb-2 size-4 text-sidebar-primary" />Role secured</span><span><BarChart3 className="mb-2 size-4 text-sidebar-primary" />Live totals</span><span><Leaf className="mb-2 size-4 text-sidebar-primary" />Farm focused</span></div>
      </section>
      <section className="flex items-center p-8 md:p-14"><div className="w-full max-w-md"><p className="text-sm font-semibold uppercase tracking-[.18em] text-primary">Welcome back</p><h2 className="mt-3 text-3xl font-bold">{props.authMode === "login" ? "Sign in to your ledger" : "Create your member account"}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{props.authMode === "login" ? "Use your cooperative account to continue." : "Your access level will be assigned securely when your account is created."}</p>
        <form className="mt-8 space-y-4" onSubmit={props.handleAuth}>{props.authMode === "signup" && <Field label="Full name"><Input value={props.fullName} onChange={(e) => props.setFullName(e.target.value)} required placeholder="Amara Okafor" /></Field>}<Field label="Email"><Input type="email" value={props.email} onChange={(e) => props.setEmail(e.target.value)} required placeholder="you@example.com" /></Field><Field label="Password"><Input type="password" value={props.password} onChange={(e) => props.setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" /></Field>{props.authMessage && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{props.authMessage}</p>}<Button className="h-11 w-full" disabled={props.isBusy}>{props.isBusy ? "Please wait…" : props.authMode === "login" ? "Sign in" : "Create account"}<ArrowUpRight /></Button></form>
        <button className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => props.setAuthMode(props.authMode === "login" ? "signup" : "login")}>{props.authMode === "login" ? "New to Apex? Create an account" : "Already have an account? Sign in"}</button></div></section>
    </div></main>;
}

function Dashboard({ data, handlePayment, handleExpense, handleSignOut, message, isBusy }: { data: DashboardData; handlePayment: () => void; handleExpense: (event: React.FormEvent<HTMLFormElement>) => void; handleSignOut: () => void; message: string; isBusy: boolean }) {
  const total = data.totals.totalContributed;
  const mine = data.contributions.filter((item) => item.member_id === data.user.id && item.payment_status === "success").reduce((sum, item) => sum + Number(item.amount), 0);
  const equity = total > 0 ? (mine / total) * 100 : 0;
  const currency = useMemo(() => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }), []);
  return <main className="min-h-screen bg-background text-foreground"><header className="border-b border-border bg-card"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sprout className="size-5" /></span><div><p className="font-display text-base font-bold tracking-tight">APEX AGRI-CAPITAL</p><p className="text-xs text-muted-foreground">Cooperative ledger</p></div></div><div className="flex items-center gap-3"><Badge variant="secondary" className="capitalize">{data.role}</Badge><Button aria-label="Sign out" variant="ghost" size="icon" onClick={handleSignOut}><LogOut /></Button></div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-medium text-primary">Good to see you, {data.user.name}</p><h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">The farm, at a glance.</h1><p className="mt-3 text-muted-foreground">Your shared view of this season’s capital and activity.</p></div>{data.role === "contributor" && <Button onClick={handlePayment} disabled={isBusy}><WalletCards /> Make a contribution</Button>}</div>
      {message && <p className="mt-6 rounded-md border border-primary/20 bg-primary/10 p-3 text-sm text-primary">{message}</p>}
      <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric icon={<CircleDollarSign />} label="Total contributed" value={currency.format(total)} /><Metric icon={<ArrowUpRight />} label="Total expenses" value={currency.format(data.totals.totalExpenses)} /><Metric icon={<WalletCards />} label="Net pool" value={currency.format(data.totals.netPool)} /><Metric icon={<Users />} label="Members" value={String(data.totals.memberCount)} /></section>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_.75fr]"><section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-[.15em] text-muted-foreground">Contribution history</p><h2 className="mt-2 text-2xl font-bold">Capital movement</h2></div><Badge variant="outline"><CheckCircle2 className="mr-1 size-3" />Verified records</Badge></div><div className="mt-6 divide-y divide-border">{data.contributions.length ? data.contributions.map((item) => <div className="flex items-center justify-between gap-4 py-4" key={item.id}><div><p className="font-medium">{item.memberName}</p><p className="text-sm text-muted-foreground">{item.category} · {item.date}</p></div><div className="text-right"><p className="font-display font-bold">{currency.format(Number(item.amount))}</p><Badge variant={item.payment_status === "success" ? "secondary" : "outline"}>{item.payment_status}</Badge></div></div>) : <EmptyState text="No contributions have been recorded yet." />}</div></section>
        <div className="space-y-8">{data.role !== "contributor" && <section className="rounded-2xl border border-border bg-card p-6"><p className="text-sm font-semibold uppercase tracking-[.15em] text-muted-foreground">Operator action</p><h2 className="mt-2 text-2xl font-bold">Log an expense</h2><form className="mt-5 space-y-3" onSubmit={handleExpense}><Input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount (NGN)" required /><Input name="category" placeholder="Category" required /><Textarea name="note" placeholder="Short note (optional)" /><Button className="w-full" disabled={isBusy}><Plus /> Add expense</Button></form></section>}<section className="rounded-2xl border border-border bg-primary p-6 text-primary-foreground"><p className="text-sm font-semibold uppercase tracking-[.15em] text-primary-foreground/70">Your equity</p><p className="mt-3 font-display text-5xl font-bold">{equity.toFixed(2)}%</p><p className="mt-3 text-sm leading-6 text-primary-foreground/75">Calculated live from your verified contributions and the cooperative total.</p></section></div></div>
    </div></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-border bg-card p-5"><div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">{icon}</div><p className="mt-5 text-sm text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p></div>; }
function EmptyState({ text }: { text: string }) { return <p className="py-12 text-center text-sm text-muted-foreground">{text}</p>; }
function LoadingScreen() { return <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground"><div className="flex items-center gap-3"><Sprout className="size-5 animate-pulse text-primary" /> Loading your ledger…</div></main>; }