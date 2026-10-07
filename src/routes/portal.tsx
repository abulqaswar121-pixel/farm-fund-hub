import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import { LogOut, Sprout } from "lucide-react";

import { FamilyMenu } from "@/components/ndh/FamilyMenu";
import { NdhFamilySymbol } from "@/components/ndh/NdhFamilySymbol";
import { AiConcierge } from "@/components/ndh/AiConcierge";
import { supabase } from "@/integrations/supabase/client";
import { resolveCallerRole, ROLE_LABEL, type AppRole } from "@/lib/agri/roles";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [{ title: "Member Portal | NDH AgriCapital" }, { name: "robots", content: "noindex" }],
  }),
  component: PortalLayout,
});

type PortalContextValue = {
  role: AppRole;
  userId: string;
  email: string;
  signOut: () => void;
};

const PortalContext = createContext<PortalContextValue>({
  role: "member",
  userId: "",
  email: "",
  signOut: () => {},
});

export function usePortalContext() {
  return useContext(PortalContext);
}

function PortalLayout() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "signedout" }
    | { status: "ready"; role: AppRole; userId: string; email: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load(userId: string, email: string) {
      // The role is read from user_roles via RLS. If the row is missing (a
      // brand-new account), the member portal will provision it server-side.
      const role = await resolveCallerRole(supabase, userId);
      if (cancelled) return;
      setState({ status: "ready", role: role ?? "member", userId, email });
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) {
        if (!cancelled) setState({ status: "signedout" });
        return;
      }
      void load(user.id, user.email ?? "");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (!user) {
        if (!cancelled) setState({ status: "signedout" });
        return;
      }
      void load(user.id, user.email ?? "");
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state.status === "signedout") return <Navigate to="/signin" />;

  if (state.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-navy">
        <div className="flex flex-col items-center gap-3">
          <NdhFamilySymbol SectorIcon={Sprout} size={48} />
          <p className="fig text-[0.8rem] text-slate-400">Opening your ledger…</p>
        </div>
      </main>
    );
  }

  const signOut = () => {
    void supabase.auth.signOut();
  };

  return (
    <PortalContext.Provider
      value={{ role: state.role, userId: state.userId, email: state.email, signOut }}
    >
      <div className="flex min-h-screen flex-col bg-porcelain" id="top">
        <PortalHeader role={state.role} email={state.email} signOut={signOut} />
        <main className="mx-auto w-full max-w-[var(--page)] flex-1 px-[var(--gutter)] py-7">
          <Outlet />
        </main>
        <PortalFooter />
      </div>
      <AiConcierge />
    </PortalContext.Provider>
  );
}

function PortalHeader({
  role,
  email,
  signOut,
}: {
  role: AppRole;
  email: string;
  signOut: () => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const tabs = [
    { to: "/portal/investor", label: "Investor", visible: true },
    {
      to: "/portal/operator",
      label: "Farm operator",
      visible: role === "admin" || role === "operator",
    },
    { to: "/portal/admin", label: "Admin & treasury", visible: role === "admin" },
  ].filter((tab) => tab.visible);

  return (
    <header className="pg-header">
      <div className="pg-header-inner">
        <Link to="/portal" className="pg-brand" aria-label="NDH AgriCapital portal">
          <NdhFamilySymbol SectorIcon={Sprout} size={36} />
          <span className="pg-brand-lockup">
            <strong>NAJEEB</strong>
            <small>AgriCapital portal</small>
          </span>
        </Link>

        <nav className="pg-portal-tabs" aria-label="Portal sections">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className="pg-portal-tab"
              aria-current={pathname === tab.to ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="pg-chip pg-chip--onDark hidden border-navy-line bg-white/10 text-slate-200 sm:inline-flex">
            {ROLE_LABEL[role]}
          </span>
          <FamilyMenu links={[{ label: "Marketplace", href: "/cycles" }]} />
          <button
            type="button"
            onClick={signOut}
            aria-label={`Sign out of ${email || "your account"}`}
            className="grid size-9 place-items-center rounded-full border border-navy-line text-slate-300 transition-colors hover:border-coral hover:text-white"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

function PortalFooter() {
  return (
    <footer className="border-t border-hairline bg-white">
      <div className="mx-auto flex max-w-[var(--page)] flex-col gap-2 px-[var(--gutter)] py-4 text-[0.7rem] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
        <span>
          NDH AgriCapital · every figure on this page is computed from the ledger, never stored.
        </span>
        <span className="flex flex-wrap items-center gap-4">
          <Link to="/cycles" className="no-underline hover:text-ink-deep">
            Marketplace
          </Link>
          <Link
            to="/legal/$doc"
            params={{ doc: "risk" }}
            className="no-underline hover:text-ink-deep"
          >
            Risk statement
          </Link>
          <a href="/legal/terms" className="no-underline hover:text-ink-deep">
            Terms
          </a>
        </span>
      </div>
    </footer>
  );
}
