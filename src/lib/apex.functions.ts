import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const roleSchema = z.enum(["admin", "operator", "contributor"]);

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: user, error: userError } = await context.supabase.auth.getUser();
    if (userError || !user.user) throw new Error("Unable to load the signed-in account");

    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();

    let role = roleRow?.role ?? null;
    if (!role) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const fullName = user.user.user_metadata?.["full_name"] as string | undefined;
      const { data: bootstrapRole, error: bootstrapError } = await supabaseAdmin.rpc("ensure_profile", fullName ? {
        _user_id: context.userId,
        _full_name: fullName,
      } : { _user_id: context.userId });
      if (bootstrapError) throw new Error("Unable to finish account setup");
      role = roleSchema.parse(bootstrapRole);
    }

    const [{ data: profiles }, { data: contributions }, { data: expenses }, { data: stockLogs }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name"),
      context.supabase.from("contributions").select("id, member_id, amount, date, category, payment_method, payment_status, note, paystack_reference").order("date", { ascending: false }).limit(10),
      context.supabase.from("expenses").select("id, amount, date, category, note").order("date", { ascending: false }).limit(10),
      context.supabase.from("stock_logs").select("id, date, count, note").order("date", { ascending: false }).limit(10),
    ]);

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile["full_name"] || "Unnamed member"]));
    const successfulContributions = (contributions ?? []).filter((item) => item.payment_status === "success");
    const totalContributed = successfulContributions.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = (expenses ?? []).reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      user: { id: context.userId, email: user.user.email ?? "", name: user.user.user_metadata?.["full_name"] ?? "Member" },
      role,
      totals: { totalContributed, totalExpenses, netPool: totalContributed - totalExpenses, memberCount: profiles?.length ?? 0 },
      contributions: (contributions ?? []).map((item) => ({ ...item, memberName: profileMap.get(item.member_id) ?? "Member" })),
      expenses: expenses ?? [],
      stockLogs: stockLogs ?? [],
    };
  });

export const addOperatorExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; category: string; note?: string; date?: string }) => input)
  .handler(async ({ context, data }) => {
    const { data: roleRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (roleRow?.role !== "admin" && roleRow?.role !== "operator") throw new Error("You do not have permission to add expenses");
    const { error } = await context.supabase.from("expenses").insert({ amount: data.amount, category: data.category, note: data.note ?? null, date: data.date ?? new Date().toISOString().slice(0, 10), recorded_by: context.userId });
    if (error) throw new Error("Unable to save expense");
    return { ok: true };
  });

export const startPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; email: string }) => input)
  .handler(async ({ context, data }) => {
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Enter a valid amount");
    const publishableKey = process.env["PAYSTACK_PUBLIC_KEY"];
    if (!publishableKey) throw new Error("Payments are not configured yet");
    return { publicKey: publishableKey, email: data.email, reference: `${context.userId}-${crypto.randomUUID()}` };
  });

export const verifyPaystackContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => input)
  .handler(async ({ context, data }) => {
    const secretKey = process.env["PAYSTACK_SECRET_KEY"];
    if (!secretKey) throw new Error("Payments are not configured yet");
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, { headers: { Authorization: `Bearer ${secretKey}` } });
    if (!response.ok) throw new Error("Unable to verify payment");
    const result = (await response.json()) as { status: boolean; data?: { status?: string; amount?: number; reference?: string; customer?: { email?: string } } };
    if (!result.status || result.data?.status !== "success" || result.data.reference !== data.reference) throw new Error("Payment was not verified");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contributions").upsert({ member_id: context.userId, amount: Number(result.data.amount ?? 0) / 100, category: "Contribution", payment_method: "paystack", paystack_reference: data.reference, payment_status: "success", verified_at: new Date().toISOString(), recorded_by: context.userId }, { onConflict: "paystack_reference", ignoreDuplicates: true });
    if (error) throw new Error("Payment verified but could not be recorded");
    return { ok: true };
  });

export const adminEnsureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; fullName?: string }) => input)
  .handler(async ({ context, data }) => {
    const { data: callerRole } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).maybeSingle();
    if (callerRole?.role !== "admin") throw new Error("Admin access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("ensure_profile", data.fullName ? { _user_id: data.userId, _full_name: data.fullName } : { _user_id: data.userId });
    if (error) throw new Error("Unable to create member profile");
    return { ok: true };
  });
/* ---------------------------------------------------------------------------
 * Portal data & admin/operator actions.
 *
 * Same pattern as the functions above: requireSupabaseAuth middleware,
 * role checks re-verified server-side (RLS stays the final gate), and
 * supabaseAdmin only where the existing code already uses it (profile
 * bootstrap, Paystack verification, member creation).
 * ------------------------------------------------------------------------- */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = "admin" | "operator" | "contributor";

async function getCallerRole(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AppRole | null> {
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (roleRow?.role as AppRole) ?? null;
}

async function requireCallerRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  allowed: AppRole[],
): Promise<AppRole> {
  const role = await getCallerRole(supabase, userId);
  if (!role || !allowed.includes(role)) {
    throw new Error("You do not have permission to perform this action");
  }
  return role;
}

export interface PortalCycleRow {
  id: string;
  date: string;
  revenue: number;
  note: string | null;
  payouts: {
    id: string;
    memberId: string;
    memberName: string;
    percent: number;
    amount: number;
  }[];
}

export const getPortalData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [
      { data: profiles },
      { data: contributions },
      { data: expenses },
      { data: stockLogs },
      { data: equityRows },
      { data: cycles },
      { data: payouts },
    ] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name"),
      context.supabase
        .from("contributions")
        .select(
          "id, member_id, amount, date, category, note, payment_method, paystack_reference, payment_status, verified_at, recorded_by",
        )
        .order("date", { ascending: false })
        .limit(500),
      context.supabase
        .from("expenses")
        .select("id, amount, date, category, note, recorded_by")
        .order("date", { ascending: false })
        .limit(500),
      context.supabase
        .from("stock_logs")
        .select("id, date, count, note, recorded_by")
        .order("date", { ascending: false })
        .limit(500),
      context.supabase.from("member_equity").select("member_id, contributed, equity_percent"),
      context.supabase
        .from("harvest_cycles")
        .select("id, date, revenue, note")
        .order("date", { ascending: false })
        .limit(100),
      context.supabase
        .from("harvest_payouts")
        .select("id, harvest_cycle_id, member_id, percent, amount")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile["full_name"] || "Unnamed member"]),
    );
    const roleMap = new Map<string, AppRole>();
    const { data: roleRows } = await context.supabase.from("user_roles").select("user_id, role");
    for (const row of roleRows ?? []) roleMap.set(row.user_id, row.role as AppRole);

    const verified = (contributions ?? []).filter((item) => item.payment_status === "success");
    const totalContributed = verified.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = (expenses ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const totalDistributed = (payouts ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const newestStock = (stockLogs ?? [])[0] ?? null;

    const myEquity = (equityRows ?? []).find((row) => row.member_id === context.userId);
    const { data: authUser } = await context.supabase.auth.getUser();

    return {
      user: {
        id: context.userId,
        email: authUser?.user?.email ?? "",
        name: profileMap.get(context.userId) ?? "Member",
      },
      role: (await getCallerRole(context.supabase, context.userId)) ?? "contributor",
      totals: {
        totalContributed,
        totalExpenses,
        netPool: totalContributed - totalExpenses,
        totalDistributed,
        memberCount: profiles?.length ?? 0,
        latestStockCount: newestStock ? Number(newestStock.count) : null,
        latestStockDate: newestStock?.date ?? null,
      },
      my: myEquity
        ? {
            contributed: Number(myEquity.contributed),
            equityPercent: Number(myEquity.equity_percent),
          }
        : { contributed: 0, equityPercent: 0 },
      contributions: (contributions ?? []).map((item) => ({
        ...item,
        memberName: profileMap.get(item.member_id) ?? "Member",
        recorderName: item.recorded_by ? (profileMap.get(item.recorded_by) ?? "Member") : null,
      })),
      expenses: (expenses ?? []).map((item) => ({
        ...item,
        recorderName: profileMap.get(item.recorded_by) ?? "Member",
      })),
      stockLogs: (stockLogs ?? []).map((item) => ({
        ...item,
        recorderName: profileMap.get(item.recorded_by) ?? "Member",
      })),
      equity: (equityRows ?? [])
        .flatMap((row) =>
          row.member_id
            ? [
                {
                  id: row.member_id,
                  name: profileMap.get(row.member_id) ?? "Member",
                  contributed: Number(row.contributed),
                  equityPercent: Number(row.equity_percent),
                  role: roleMap.get(row.member_id) ?? null,
                },
              ]
            : [],
        )
        .sort((a, b) => b.contributed - a.contributed),
      cycles: (cycles ?? []).map((cycle) => ({
        id: cycle.id,
        date: cycle.date,
        revenue: Number(cycle.revenue),
        note: cycle.note,
        payouts: (payouts ?? [])
          .filter((payout) => payout.harvest_cycle_id === cycle.id)
          .map((payout) => ({
            id: payout.id,
            memberId: payout.member_id,
            memberName: profileMap.get(payout.member_id) ?? "Member",
            percent: Number(payout.percent),
            amount: Number(payout.amount),
          }))
          .sort((a, b) => b.amount - a.amount),
      })),
    };
  });

export const addStockLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { count: number; note?: string; date?: string }) => input)
  .handler(async ({ context, data }) => {
    await requireCallerRole(context.supabase, context.userId, ["admin", "operator"]);
    if (!Number.isFinite(data.count) || data.count < 0)
      throw new Error("Enter a valid stock count");
    const { error } = await context.supabase.from("stock_logs").insert({
      count: Math.round(data.count),
      note: data.note ?? null,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      recorded_by: context.userId,
    });
    if (error) throw new Error("Unable to save stock log");
    return { ok: true };
  });

export const adminAddContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      memberId: string;
      amount: number;
      category?: string;
      note?: string;
      date?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    await requireCallerRole(context.supabase, context.userId, ["admin"]);
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error("Enter a valid amount");
    const { error } = await context.supabase.from("contributions").insert({
      member_id: data.memberId,
      amount: data.amount,
      category: data.category?.trim() || "Contribution",
      note: data.note ?? null,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      payment_method: "manual",
      payment_status: "success",
      verified_at: new Date().toISOString(),
      recorded_by: context.userId,
    });
    if (error) throw new Error("Unable to record contribution");
    return { ok: true };
  });

export const adminSetMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; role: AppRole }) => input)
  .handler(async ({ context, data }) => {
    await requireCallerRole(context.supabase, context.userId, ["admin"]);
    if (!roleSchema.safeParse(data.role).success) throw new Error("Invalid role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: clearError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.memberId);
    if (clearError) throw new Error("Unable to update member role");
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.memberId, role: data.role });
    if (roleError) throw new Error("Unable to update member role");
    return { ok: true };
  });

export const adminRenameMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; fullName: string }) => input)
  .handler(async ({ context, data }) => {
    await requireCallerRole(context.supabase, context.userId, ["admin"]);
    if (!data.fullName.trim()) throw new Error("Name cannot be empty");
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName.trim() })
      .eq("id", data.memberId);
    if (error) throw new Error("Unable to update member");
    return { ok: true };
  });

export const adminInviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { email: string; fullName: string; password: string; role: AppRole }) => input,
  )
  .handler(async ({ context, data }) => {
    await requireCallerRole(context.supabase, context.userId, ["admin"]);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))
      throw new Error("Enter a valid email address");
    if (!data.fullName.trim()) throw new Error("Name cannot be empty");
    if ((data.password ?? "").length < 8)
      throw new Error("Temporary password must be at least 8 characters");
    if (!roleSchema.safeParse(data.role).success) throw new Error("Invalid role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName.trim() },
    });
    if (createError || !created.user) throw new Error("Unable to create member account");
    const memberId = created.user.id;
    const { error: profileError } = await supabaseAdmin.rpc("ensure_profile", {
      _user_id: memberId,
      _full_name: data.fullName.trim(),
    });
    if (profileError) throw new Error("Account created but profile could not be initialised");
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: memberId, role: data.role });
    if (roleError) throw new Error("Account created but role could not be assigned");
    return { ok: true, memberId };
  });

export const adminCloseHarvestCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date?: string; revenue: number; note?: string }) => input)
  .handler(async ({ context, data }) => {
    await requireCallerRole(context.supabase, context.userId, ["admin"]);
    if (!Number.isFinite(data.revenue) || data.revenue < 0)
      throw new Error("Enter a valid revenue figure");
    // Split is computed live from verified contributions — equity is never stored.
    const { data: equityRows } = await context.supabase
      .from("member_equity")
      .select("member_id, contributed, equity_percent");
    const eligible = (equityRows ?? []).filter(
      (row): row is typeof row & { member_id: string } =>
        Number(row.contributed) > 0 && row.member_id != null,
    );
    const cents = (value: number) => Math.round(value * 100) / 100;
    const payouts = eligible.map((row) => ({
      member_id: row.member_id,
      percent: Number(row.equity_percent),
      amount: cents((data.revenue * Number(row.equity_percent)) / 100),
    }));
    const { data: cycle, error: cycleError } = await context.supabase
      .from("harvest_cycles")
      .insert({
        date: data.date ?? new Date().toISOString().slice(0, 10),
        revenue: data.revenue,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (cycleError || !cycle) throw new Error("Unable to open harvest cycle");
    if (payouts.length > 0) {
      const { error: payoutError } = await context.supabase.from("harvest_payouts").insert(
        payouts.map((payout) => ({
          ...payout,
          harvest_cycle_id: cycle.id,
        })),
      );
      if (payoutError) throw new Error("Cycle recorded but payout split could not be saved");
    }
    return {
      ok: true,
      cycleId: cycle.id,
      totalDistributed: payouts.reduce((sum, payout) => sum + payout.amount, 0),
    };
  });

export const adminUpdatePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payoutId: string; percent: number; amount: number }) => input)
  .handler(async ({ context, data }) => {
    await requireCallerRole(context.supabase, context.userId, ["admin"]);
    if (!Number.isFinite(data.percent) || data.percent < 0 || data.percent > 100)
      throw new Error("Percent must be between 0 and 100");
    if (!Number.isFinite(data.amount) || data.amount < 0) throw new Error("Enter a valid amount");
    const { error } = await context.supabase
      .from("harvest_payouts")
      .update({ percent: data.percent, amount: data.amount })
      .eq("id", data.payoutId);
    if (error) throw new Error("Unable to update payout");
    return { ok: true };
  });

export const getPublicCompanyData = createServerFn({ method: "GET" }).handler(async () => {
  // Public homepage figures, read server-side. anon has no table grants,
  // so this uses the same service-role client the existing code uses for
  // ensure_profile / Paystack verification.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [
    { data: profiles },
    { data: contributions },
    { data: expenses },
    { data: stockLogs },
    { data: cycles },
    { data: payouts },
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id"),
    supabaseAdmin.from("contributions").select("amount, payment_status, date"),
    supabaseAdmin.from("expenses").select("amount, date"),
    supabaseAdmin
      .from("stock_logs")
      .select("count, date")
      .order("date", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("harvest_cycles")
      .select("id, revenue")
      .order("date", { ascending: false })
      .limit(100),
    supabaseAdmin.from("harvest_payouts").select("amount"),
  ]);
  const verified = (contributions ?? []).filter((item) => item.payment_status === "success");
  const totalContributed = verified.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  const totalDistributed = (payouts ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  return {
    totals: {
      totalContributed,
      totalExpenses,
      netPool: totalContributed - totalExpenses,
      totalDistributed,
      memberCount: profiles?.length ?? 0,
      cyclesClosed: cycles?.length ?? 0,
      latestStockCount: stockLogs?.[0] ? Number(stockLogs[0].count) : null,
      latestStockDate: stockLogs?.[0]?.date ?? null,
      latestContributionDate: verified[0]?.date ?? null,
    },
  };
});
