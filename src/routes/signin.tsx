import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, Lock, ShieldCheck, Waves } from "lucide-react";
import { z } from "zod";

import { BrandLockup } from "@/components/ndh/BrandLockup";
import { FamilyFooter } from "@/components/ndh/FamilyFooter";
import { Notice } from "@/components/ndh/ledger-ui";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ cycle: z.string().uuid().optional() });

export const Route = createFileRoute("/signin")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Member Sign In | NDH AgriCapital" },
      {
        name: "description",
        content:
          "Sign in to the NDH AgriCapital member portal to see your verified balance, your live equity share and the state of every cycle you back.",
      },
      { property: "og:title", content: "Member Sign In | NDH AgriCapital" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const { cycle } = Route.useSearch();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"error" | "success" | "info">("error");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/portal" });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate({ to: "/portal" });
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
          });

    if (result.error) {
      setTone("error");
      setMessage(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setTone("success");
      setMessage(
        "Account created. Check your inbox to confirm your email address, then sign in — your member role is assigned automatically.",
      );
    } else {
      navigate({ to: "/portal" });
    }
    setBusy(false);
  }

  const isSignIn = mode === "signin";

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 lg:grid-cols-[1.02fr_0.98fr]">
        {/* Co-operative standing */}
        <section className="pg-node-texture relative flex flex-col justify-between bg-navy px-7 py-9 text-white lg:px-12 lg:py-12">
          <BrandLockup size="lg" />

          <div className="max-w-lg py-12">
            <p className="pg-chip border-navy-line bg-white/10 text-signal">
              Member portal · agricapital.ndh.com.ng
            </p>
            <h1 className="mt-5 font-display text-[1.9rem] font-bold leading-[1.1] tracking-tight lg:text-[2.4rem]">
              Your capital, your share,
              <br />
              <span className="pg-gradient-text">on the record.</span>
            </h1>
            <p className="mt-5 max-w-md text-[0.9rem] leading-7 text-slate-300">
              Sign in to see what you put in, what it is worth today, and how far every cycle you
              have backed has got — worked out from the ledger each time you look.
            </p>

            <ul className="mt-7 space-y-3.5">
              <Assurance
                icon={<Lock size={16} />}
                title="Your share is worked out, not typed in"
                body="Nobody can edit it. Your percentage is calculated from payments we have confirmed, every single time."
              />
              <Assurance
                icon={<Waves size={16} />}
                title="A fixed order of payments"
                body="Bills first, then every member's money back, then a small safety slice, then the 70/30 profit share."
              />
              <Assurance
                icon={<ShieldCheck size={16} />}
                title="Payments checked on our side"
                body="A payment only counts once our server has confirmed it with the payment provider — never because a browser said so."
              />
              <Assurance
                icon={<Eye size={16} />}
                title="Your position stays yours"
                body="What you put in, and what you are paid, is visible to you in your portal. Other members never see your amounts."
              />
            </ul>

            <div className="mt-7 rounded-2xl border border-navy-line bg-white/[0.05] p-4">
              <p className="pg-kicker pg-kicker--onDark">What we ask for, and what we do not</p>
              <p className="mt-2 text-[0.76rem] leading-5 text-slate-400">
                To open an account we need a name, an email address and a password. We do not ask
                for your bank details or your card on this page, and we never publish what any
                member has put in. If you would rather just look, the marketplace and the farm
                register are open to everyone without an account.
              </p>
            </div>
          </div>

          <p className="text-[0.68rem] leading-5 text-slate-500">
            NDH AgriCapital is a co-operative agricultural investment programme, not a bank.
            Contributions are capital at risk — read the{" "}
            <a href="/legal/risk" className="text-slate-300 no-underline">
              risk statement
            </a>
            .
          </p>
        </section>

        {/* Form */}
        <section className="flex items-center bg-porcelain px-6 py-12 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <p className="pg-kicker">{isSignIn ? "Welcome back" : "New member"}</p>
            <h2 className="mt-2 font-display text-[1.6rem] font-bold leading-tight text-ink-deep">
              {isSignIn ? "Sign in to your ledger" : "Open a member account"}
            </h2>
            <p className="mt-2 text-[0.83rem] leading-6 text-ink-soft">
              {isSignIn
                ? "Use the account your contribution was recorded against."
                : "Membership is free. Your access level is assigned securely on creation — everyone who joins starts as a member."}
            </p>

            {cycle ? (
              <Notice tone="info" className="mt-5">
                Sign in to continue with your contribution. Your place in the cycle is held as a
                pending record until the payment is verified.
              </Notice>
            ) : null}

            <form className="mt-7 space-y-4" onSubmit={submit}>
              {!isSignIn ? (
                <label className="block">
                  <span className="pg-label">Full name</span>
                  <input
                    className="pg-input"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Amina Yusuf"
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="pg-label">Email address</span>
                <input
                  className="pg-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="pg-label">Password</span>
                <input
                  className="pg-input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete={isSignIn ? "current-password" : "new-password"}
                  placeholder="At least 6 characters"
                />
              </label>

              {message ? <Notice tone={tone}>{message}</Notice> : null}

              <button type="submit" disabled={busy} className="pg-btn pg-btn--primary w-full">
                {busy ? "Please wait…" : isSignIn ? "Sign in" : "Create my account"}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(isSignIn ? "signup" : "signin");
                setMessage("");
              }}
              className="mt-5 text-[0.83rem] font-semibold text-signal-deep underline underline-offset-4"
            >
              {isSignIn
                ? "New to the co-operative? Create an account"
                : "Already a member? Sign in"}
            </button>

            <p className="mt-9 border-t border-hairline pt-5 text-[0.75rem] leading-5 text-ink-mute">
              Just browsing? The{" "}
              <Link to="/cycles" className="font-semibold text-signal-deep no-underline">
                farm marketplace
              </Link>{" "}
              and the{" "}
              <Link
                to="/"
                hash="transparency"
                className="font-semibold text-signal-deep no-underline"
              >
                transparency feed
              </Link>{" "}
              are fully public — no account needed.
            </p>
          </div>
        </section>
      </div>

      <FamilyFooter />
    </div>
  );
}

function Assurance({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-signal">
        {icon}
      </span>
      <span>
        <strong className="block font-display text-[0.82rem] font-semibold text-white">
          {title}
        </strong>
        <span className="mt-0.5 block text-[0.74rem] leading-5 text-slate-400">{body}</span>
      </span>
    </li>
  );
}
