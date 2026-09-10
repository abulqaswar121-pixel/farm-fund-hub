import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BookOpenCheck, Leaf } from "lucide-react";

import { Input } from "@/components/ui/input";
import { BadgeMark, Kicker, Notice } from "@/components/ledger";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in | Apex Agri-Capital" },
      { name: "description", content: "Sign in to the Apex Agri-Capital cooperative farm ledger." },
      { property: "og:title", content: "Apex Agri-Capital | Shared Farm Ledger" },
      {
        property: "og:description",
        content: "Sign in to the shared ledger of an agriculture investment cooperative.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

function App() {
  const [session, setSession] = useState<{ email?: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: sessionData }) => setSession(sessionData.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession?.user ?? null),
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleAuth(event: React.FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    setAuthMessage("");
    const result =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });
    if (result.error) setAuthMessage(result.error.message);
    else if (authMode === "signup" && !result.data.session)
      setAuthMessage("Check your email to confirm your account, then sign in.");
    setIsBusy(false);
  }

  // Signed-in members go straight to their role portal.
  if (session) return <Navigate to="/portal" />;
  return (
    <AuthScreen
      {...{
        authMode,
        setAuthMode,
        email,
        setEmail,
        password,
        setPassword,
        fullName,
        setFullName,
        authMessage,
        handleAuth,
        isBusy,
      }}
    />
  );
}

function AuthScreen(props: {
  authMode: "login" | "signup";
  setAuthMode: (mode: "login" | "signup") => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
  authMessage: string;
  handleAuth: (event: React.FormEvent) => void;
  isBusy: boolean;
}) {
  const isLogin = props.authMode === "login";
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[1.08fr_.92fr]">
        {/* Ledger cover panel */}
        <section className="relative flex flex-col justify-between overflow-hidden border-r border-rule bg-sidebar p-8 text-sidebar-foreground md:p-12">
          <div className="flex items-center gap-3">
            <BadgeMark className="size-10" />
            <div className="leading-tight">
              <p className="font-display text-base font-bold tracking-tight">Apex Agri-Capital</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/70">
                Cooperative farm ledger
              </p>
            </div>
          </div>

          <div className="max-w-lg py-16">
            <span className="ledger-seal">Shared farm ledger</span>
            <h1 className="mt-6 text-4xl leading-[1.08] md:text-[3.4rem]">
              Grow together.
              <br />
              <span className="text-gold">Account clearly.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-sidebar-foreground/75">
              One trusted view of the capital, costs, stock, and returns behind the cooperative —
              kept like a well-kept account book.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-sidebar-border pt-6 text-[11px] text-sidebar-foreground/70">
            <span>
              <BarChart3 className="mb-2 size-4 text-gold" />
              Live totals
            </span>
            <span>
              <BookOpenCheck className="mb-2 size-4 text-gold" />
              Full history
            </span>
            <span>
              <Leaf className="mb-2 size-4 text-gold" />
              Farm focused
            </span>
          </div>
        </section>

        {/* Sign-in form */}
        <section className="flex items-center px-6 py-12 md:px-12">
          <div className="w-full max-w-md">
            <Kicker>{isLogin ? "Welcome back" : "New member"}</Kicker>
            <h2 className="mt-3 text-3xl leading-tight">
              {isLogin ? "Sign in to your ledger" : "Create your member account"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              {isLogin
                ? "Use your cooperative account to continue."
                : "Your access level is assigned securely when your account is created."}
            </p>

            <form className="mt-8 space-y-4" onSubmit={props.handleAuth}>
              {!isLogin && (
                <Field label="Full name">
                  <Input
                    className="ledger-input"
                    value={props.fullName}
                    onChange={(e) => props.setFullName(e.target.value)}
                    required
                    placeholder="Amara Okafor"
                  />
                </Field>
              )}
              <Field label="Email">
                <Input
                  className="ledger-input"
                  type="email"
                  value={props.email}
                  onChange={(e) => props.setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password">
                <Input
                  className="ledger-input"
                  type="password"
                  value={props.password}
                  onChange={(e) => props.setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                />
              </Field>
              {props.authMessage && <Notice tone="error">{props.authMessage}</Notice>}
              <button
                type="submit"
                disabled={props.isBusy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-leaf px-5 text-sm font-semibold text-paper transition-colors hover:bg-leaf-deep disabled:cursor-not-allowed disabled:opacity-60"
              >
                {props.isBusy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
                <ArrowRight className="size-4" />
              </button>
            </form>

            <button
              type="button"
              className="mt-6 text-sm font-medium text-leaf underline underline-offset-4 hover:text-leaf-deep"
              onClick={() => props.setAuthMode(isLogin ? "signup" : "login")}
            >
              {isLogin ? "New to Apex? Create an account" : "Already have an account? Sign in"}
            </button>

            <p className="mt-10 border-t border-rule pt-5 text-xs leading-5 text-ink-soft">
              Public figures? Read the{" "}
              <a href="/home" className="ledger-link">
                venture overview
              </a>{" "}
              — no account needed.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
