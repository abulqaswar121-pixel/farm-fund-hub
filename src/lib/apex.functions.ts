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
      const { data: bootstrapRole, error: bootstrapError } = await supabaseAdmin.rpc("ensure_profile", {
        _user_id: context.userId,
        _full_name: (user.user.user_metadata?.["full_name"] as string | undefined) ?? undefined,
      });
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
    const { error } = await supabaseAdmin.rpc("ensure_profile", { _user_id: data.userId, _full_name: data.fullName ?? undefined });
    if (error) throw new Error("Unable to create member profile");
    return { ok: true };
  });
