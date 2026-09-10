import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { BadgeMark, RolePill } from "@/components/ledger";
import { getDashboardData } from "@/lib/apex.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

export type PortalRole = "admin" | "operator" | "contributor";

interface PortalContextValue {
  role: PortalRole;
  userName: string;
  signOut: () => void;
}

const PortalContext = createContext<PortalContextValue>({
  role: "contributor",
  userName: "Member",
  signOut: () => {},
});

export function usePortalContext() {
  return useContext(PortalContext);
}

function PortalLayout() {
  const [session, setSession] = useState<{ id?: string } | null>(null);
  const [role, setRole] = useState<PortalRole | null>(null);
  const [userName, setUserName] = useState("Member");
  const [failed, setFailed] = useState(false);

  const loadDashboard = useServerFn(getDashboardData);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: sessionData }) => setSession(sessionData.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession?.user ?? null),
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadDashboard()
      .then((data) => {
        setRole(data.role as PortalRole);
        setUserName(data.user.name);
      })
      .catch(() => setFailed(true));
  }, [session]);

  // No session (or one that no longer exists) → public home.
  if (!session) return <Navigate to="/home" />;

  if (failed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <div className="max-w-md">
          <BadgeMark className="mx-auto size-12" />
          <h1 className="mt-4 text-2xl text-ink">We could not load your ledger.</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Refresh the page to try again, or sign out and back in.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="ledger-link mt-6 text-sm">
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper text-ink-soft">
        <p className="fig text-sm">Opening your ledger…</p>
      </main>
    );
  }

  const signOut = () => supabase.auth.signOut();

  return (
    <PortalContext.Provider value={{ role, userName, signOut }}>
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <PortalHeader role={role} userName={userName} signOut={signOut} />
        <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-8 md:py-10">
          <Outlet />
        </div>
        <PortalFooter />
      </div>
    </PortalContext.Provider>
  );
}

function PortalHeader({
  role,
  userName,
  signOut,
}: {
  role: PortalRole;
  userName: string;
  signOut: () => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const tabs = [
    { to: "/portal", label: "Overview", visible: true },
    { to: "/portal/admin", label: "Admin portal", visible: role === "admin" },
    {
      to: "/portal/operator",
      label: "Operator portal",
      visible: role === "admin" || role === "operator",
    },
    {
      to: "/portal/member",
      label: "Member portal",
      visible: role === "admin" || role === "contributor",
    },
  ].filter((tab) => tab.visible);

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
        <Link to="/portal" className="flex items-center gap-3">
          <BadgeMark className="size-9" />
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold tracking-tight">Apex Agri-Capital</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Cooperative ledger
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-ink-soft sm:inline">Good day, {userName}</span>
          <RolePill role={role} />
          <button
            aria-label="Sign out"
            onClick={signOut}
            className="inline-flex size-8 items-center justify-center rounded-md border border-rule bg-card text-ink-soft transition-colors hover:border-rust/50 hover:text-rust"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
      <nav className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="ledger-tabs" role="tablist" aria-label="Portal sections">
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              role="tab"
              aria-selected={pathname === tab.to}
              className={cn("ledger-tab", pathname === tab.to && "aria-selected:true")}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}

function PortalFooter() {
  return (
    <footer className="border-t border-rule bg-paper-deep">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 text-[11px] text-ink-soft md:px-8">
        <span>Apex Agri-Capital · shared farm ledger</span>
        <span>Figures &amp; equity are computed live from the ledger.</span>
      </div>
    </footer>
  );
}
