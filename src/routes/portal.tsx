import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  Bell,
  Gauge,
  Leaf,
  Loader2,
  LogOut,
  Settings,
  ShieldCheck,
  Sprout,
  Wallet,
} from "lucide-react";

import { BrandLockup } from "@/components/ndh/BrandLockup";
import { NdhFamilySymbol } from "@/components/ndh/NdhFamilySymbol";
import { AiConcierge } from "@/components/ndh/AiConcierge";
import { supabase } from "@/integrations/supabase/client";
import { resolveCallerRole, ROLE_LABEL, type AppRole } from "@/lib/agri/roles";
import { cn } from "@/lib/utils";

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

/**
 * A portal destination.
 *
 * `roles` is which account levels may open it. `mobile` decides whether it earns
 * one of the four bottom-bar slots on a phone — the brief asks for Dashboard,
 * My Stocks, Farm Feed and Profile, and everything else lives in the desktop
 * sidebar and in the "More" sheet on a narrow screen.
 */
type NavItem = {
  to: string;
  label: string;
  icon: typeof Gauge;
  roles: AppRole[];
  mobile?: boolean;
};

const NAV: NavItem[] = [
  {
    to: "/portal/investor",
    label: "Dashboard",
    icon: Gauge,
    roles: ["member", "operator", "admin"],
    mobile: true,
  },
  {
    to: "/portal/investor",
    label: "My Stocks",
    icon: Wallet,
    roles: ["member", "operator", "admin"],
    mobile: true,
  },
  {
    to: "/portal/feed",
    label: "Farm Feed",
    icon: Activity,
    roles: ["member", "operator", "admin"],
    mobile: true,
  },
  {
    to: "/portal/profile",
    label: "Profile",
    icon: Settings,
    roles: ["member", "operator", "admin"],
    mobile: true,
  },
  { to: "/portal/operator", label: "Farm log", icon: Leaf, roles: ["operator", "admin"] },
  { to: "/portal/treasury", label: "Treasury desk", icon: Banknote, roles: ["admin"] },
  { to: "/portal/admin", label: "Admin & treasury", icon: ShieldCheck, roles: ["admin"] },
];

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
      <div className="min-h-screen bg-porcelain" id="top">
        <PortalSidebar role={state.role} email={state.email} signOut={signOut} />
        <div className="lg:pl-[17rem]">
          <PortalTopBar role={state.role} signOut={signOut} />
          {/* pb-24 keeps the last row of a table clear of the phone's bottom bar. */}
          <main className="mx-auto w-full max-w-[var(--page)] px-[var(--gutter)] py-6 pb-28 lg:pb-10">
            <Outlet />
          </main>
          <PortalFooter />
        </div>
        <PortalBottomNav role={state.role} />
      </div>
      <AiConcierge />
    </PortalContext.Provider>
  );
}

/* -------------------------------------------------------------------------- *\
 * Desktop: a fixed left sidebar with an active-page indicator
\* -------------------------------------------------------------------------- */

function PortalSidebar({
  role,
  email,
  signOut,
}: {
  role: AppRole;
  email: string;
  signOut: () => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = NAV.filter((item) => item.roles.includes(role)).filter(
    // "Dashboard" and "My Stocks" both point at the investor page; on the
    // sidebar the second would read as a duplicate, so it is dropped here and
    // kept only for the phone bar where the labels are the four the brief asks
    // for.
    (item, index, all) => all.findIndex((other) => other.to === item.to) === index,
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-navy-line bg-navy lg:flex">
      <div className="border-b border-navy-line px-5 py-4">
        <BrandLockup size="md" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Portal sections">
        <p className="pg-kicker pg-kicker--onDark px-2">Your portal</p>
        <ul className="mt-2.5 list-none space-y-1 p-0">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <li key={`${item.to}-${item.label}`}>
                <Link
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.82rem] font-medium no-underline transition-colors",
                    active
                      ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_var(--signal)]"
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon
                    size={16}
                    aria-hidden="true"
                    className={active ? "text-signal" : "text-slate-500"}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="pg-kicker pg-kicker--onDark mt-6 px-2">Public pages</p>
        <ul className="mt-2.5 list-none space-y-1 p-0">
          <li>
            <Link
              to="/cycles"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8rem] text-slate-400 no-underline transition-colors hover:bg-white/5 hover:text-white"
            >
              <Sprout size={15} aria-hidden="true" className="text-slate-500" />
              Marketplace
            </Link>
          </li>
          <li>
            <Link
              to="/verify"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8rem] text-slate-400 no-underline transition-colors hover:bg-white/5 hover:text-white"
            >
              <ShieldCheck size={15} aria-hidden="true" className="text-slate-500" />
              Verify a document
            </Link>
          </li>
        </ul>
      </nav>

      <div className="border-t border-navy-line p-3">
        <div className="rounded-xl bg-white/[0.06] p-3">
          <span className="pg-chip pg-chip--mint mb-2">{ROLE_LABEL[role]}</span>
          <p className="truncate text-[0.72rem] text-slate-300">{email}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[0.74rem] font-semibold text-slate-400 transition-colors hover:text-white"
          >
            <LogOut size={13} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- *\
 * Phone: a compact top bar, and the fixed bottom navigation
\* -------------------------------------------------------------------------- */

function PortalTopBar({ role, signOut }: { role: AppRole; signOut: () => void }) {
  return (
    <header className="pg-header lg:hidden">
      <div className="pg-header-inner">
        <BrandLockup size="sm" />
        <div className="flex items-center gap-2">
          <span className="pg-chip pg-chip--onDark border-navy-line bg-white/10 text-slate-200">
            {ROLE_LABEL[role]}
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="grid size-9 place-items-center rounded-full border border-navy-line text-slate-300 transition-colors hover:border-coral hover:text-white"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

function PortalBottomNav({ role }: { role: AppRole }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // The four the brief asks for, plus the staff door for whoever needs one. On
  // a 360px screen that is five at most, which still fits at 72px a slot.
  const items: { to: string; label: string; icon: typeof Gauge }[] = [
    { to: "/portal/investor", label: "Dashboard", icon: Gauge },
    { to: "/portal/investor", label: "My Stocks", icon: Wallet },
    { to: "/portal/feed", label: "Farm Feed", icon: Activity },
  ];
  if (role === "operator" || role === "admin") {
    items.push({ to: "/portal/operator", label: "Farm log", icon: Leaf });
  } else {
    items.push({ to: "/portal/feed", label: "Alerts", icon: Bell });
  }
  items.push({ to: "/portal/profile", label: "Profile", icon: Settings });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/95 backdrop-blur-md lg:hidden"
      aria-label="Portal navigation"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="m-0 grid list-none grid-flow-col auto-cols-fr p-0">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.to ||
            (item.to !== "/portal/investor" && pathname.startsWith(`${item.to}/`));
          return (
            <li key={`${item.to}-${item.label}`} className="min-w-0">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.6rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6rem] font-semibold no-underline transition-colors",
                  active ? "text-navy" : "text-ink-mute",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-lg transition-colors",
                    active ? "bg-navy text-signal" : "text-ink-mute",
                  )}
                >
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
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
          <Link to="/verify" className="no-underline hover:text-ink-deep">
            Verify a document
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

/** A page-level heading used by every portal screen. */
export function PortalHeading({
  kicker,
  title,
  blurb,
  action,
}: {
  kicker: string;
  title: string;
  blurb?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="pg-kicker">{kicker}</p>
        <h1 className="mt-1.5 text-[1.45rem] leading-tight text-ink-deep md:text-[1.75rem]">
          {title}
        </h1>
        {blurb ? (
          <p className="mt-1.5 max-w-2xl text-[0.83rem] leading-6 text-ink-soft">{blurb}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PortalLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-16 text-ink-mute">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      <span className="fig text-[0.8rem]">{label}</span>
    </div>
  );
}
