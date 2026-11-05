import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_CONTRIBUTION } from "@/lib/agri/contribution";
import { dateLabel, money, number } from "@/lib/agri/format";
import { assertRole, resolveCallerRole, type AppRole } from "@/lib/agri/roles";
import { buildFarmUpdate } from "@/lib/agri/whatsapp";
import type { Database } from "@/integrations/supabase/types";

/*
 * ---------------------------------------------------------------------------
 * Community layer server functions
 * ---------------------------------------------------------------------------
 * Everything a signed-in member, a farm operator or a treasury admin needs
 * beyond the core ledger: their own settings, the contribution and Agri-Save
 * plans, the treasury figures, the activity feed and its alert banner, the
 * operator's WhatsApp update generator, and the three printable documents.
 *
 * Two invariants hold throughout:
 *   1. Money is never computed in the browser. Every total below is read from a
 *      view that derives it from ledger rows.
 *   2. Nothing about one member is ever returned to another member. The RLS
 *      policies are the boundary; the `eq("member_id", userId)` filters here are
 *      the second lock on the same door.
 * ---------------------------------------------------------------------------
 */

type CycleRow = Database["public"]["Tables"]["farm_cycles"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/* -------------------------------------------------------------------------- *\
 * Profile & settings
\* -------------------------------------------------------------------------- */

export type MemberProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  whatsappNumber: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankVerified: boolean;
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  monthlyPlanAmount: number | null;
  monthlyPlanActive: boolean;
  monthlyPlanStartedOn: string | null;
  role: AppRole;
};

export type PlanCharge = {
  id: string;
  dueOn: string;
  amount: number;
  status: string;
  paidOn: string | null;
  note: string | null;
};

export type ActivityEntry = {
  id: string;
  kind: string;
  amount: number | null;
  category: string | null;
  note: string | null;
  actorName: string;
  cycleCode: string | null;
  reference: string | null;
  createdAt: string;
};

export type MemberAlert = {
  id: string;
  title: string;
  body: string | null;
  tone: string;
  createdAt: string;
};

export type TreasurySnapshot = {
  totalCapitalFunded: number;
  totalExpensesIncurred: number;
  totalPayoutsPaid: number;
  totalReserveHeld: number;
  operatingCashOnHand: number;
  movements: number;
  lastMovementOn: string | null;
};

export type CycleTreasury = {
  cycleId: string;
  code: string;
  capitalFunded: number;
  expensesPaid: number;
  cashOnHand: number;
};

export type MemberDocumentRow = {
  id: string;
  kind: string;
  code: string;
  title: string;
  issuedOn: string;
  cycleCode: string | null;
  cycleName: string | null;
  memberName: string;
  payload: DocumentPayload;
};

/**
 * Everything the community layer needs for one member, in one round trip.
 *
 * The member portal already makes one call for the ledger (`getMemberWorkspace`);
 * this is its companion: the settings, the plan, the treasury, the feed and the
 * alerts. Splitting them keeps the ledger call unchanged for the pages that only
 * need the ledger.
 */
export const getMemberCommunity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      profile: MemberProfile;
      plan: { amount: number | null; active: boolean; startedOn: string | null };
      charges: PlanCharge[];
      treasury: TreasurySnapshot;
      cycleTreasury: CycleTreasury[];
      activity: ActivityEntry[];
      alerts: MemberAlert[];
      documents: MemberDocumentRow[];
      cycles: {
        id: string;
        code: string;
        name: string;
        commodity: string;
        minimumTicket: number;
        status: string;
      }[];
    }> => {
      const { supabase, userId } = context;
      const role = (await resolveCallerRole(supabase, userId)) ?? "member";

      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser.user?.email ?? "";

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      const profile = mapProfile(profileRow, userId, email, role);

      // A brand-new account has no profile row until the workspace call
      // provisions one. Rather than fail, return the empty defaults, and let
      // the settings form create the row on first save.
      const [
        { data: charges },
        { data: treasuryRow },
        { data: cycleTreasuryRows },
        { data: activityRows },
        { data: alertRows },
        { data: docRows },
        { data: cycleRows },
      ] = await Promise.all([
        supabase
          .from("monthly_plan_charges")
          .select("*")
          .eq("member_id", userId)
          .order("due_on", { ascending: false })
          .limit(24),
        supabase.from("treasury_position").select("*").maybeSingle(),
        supabase.from("cycle_treasury_position").select("*"),
        supabase
          .from("activity_feed")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("member_alerts")
          .select("*")
          .eq("member_id", userId)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("documents")
          .select("*")
          .eq("member_id", userId)
          .order("issued_on", { ascending: false })
          .limit(50),
        supabase
          .from("farm_cycles")
          .select("id, code, name, commodity, minimum_ticket, status")
          .in("status", ["open", "funded", "active"])
          .order("funding_opens_on", { ascending: false }),
      ]);

      const codeById = new Map<string, string>((cycleRows ?? []).map((row) => [row.id, row.code]));
      // The activity feed names the cycle; fetch the codes for any cycle it
      // mentions that is not in the open list above (a settled one, say).
      const missingIds = Array.from(
        new Set(
          (activityRows ?? [])
            .map((row) => row.cycle_id)
            .filter((id): id is string => Boolean(id) && !codeById.has(id as string)),
        ),
      );
      if (missingIds.length > 0) {
        const { data: extra } = await supabase
          .from("farm_cycles")
          .select("id, code")
          .in("id", missingIds);
        for (const row of extra ?? []) codeById.set(row.id, row.code);
      }

      const workspaceCycleIds = new Set((cycleRows ?? []).map((row) => row.id));
      const docCycleIds = Array.from(
        new Set(
          (docRows ?? [])
            .map((row) => row.cycle_id)
            .filter((id): id is string => Boolean(id) && !workspaceCycleIds.has(id as string)),
        ),
      );
      const cycleMeta = new Map<string, { code: string; name: string }>();
      if (docCycleIds.length > 0) {
        const { data: meta } = await supabase
          .from("farm_cycles")
          .select("id, code, name")
          .in("id", docCycleIds);
        for (const row of meta ?? []) cycleMeta.set(row.id, { code: row.code, name: row.name });
      }

      return {
        profile,
        plan: {
          amount: profile.monthlyPlanAmount,
          active: profile.monthlyPlanActive,
          startedOn: profile.monthlyPlanStartedOn,
        },
        charges: (charges ?? []).map((row) => ({
          id: row.id,
          dueOn: row.due_on,
          amount: Number(row.amount),
          status: row.status,
          paidOn: row.paid_on,
          note: row.note,
        })),
        treasury: {
          totalCapitalFunded: Number(treasuryRow?.total_capital_funded ?? 0),
          totalExpensesIncurred: Number(treasuryRow?.total_expenses_incurred ?? 0),
          totalPayoutsPaid: Number(treasuryRow?.total_payouts_paid ?? 0),
          totalReserveHeld: Number(treasuryRow?.total_reserve_held ?? 0),
          operatingCashOnHand: Number(treasuryRow?.operating_cash_on_hand ?? 0),
          movements: Number(treasuryRow?.movements ?? 0),
          lastMovementOn: treasuryRow?.last_movement_on ?? null,
        },
        cycleTreasury: (cycleTreasuryRows ?? []).map((row) => ({
          cycleId: row.cycle_id ?? "",
          code: row.code ?? "—",
          capitalFunded: Number(row.capital_funded ?? 0),
          expensesPaid: Number(row.expenses_paid ?? 0),
          cashOnHand: Number(row.cash_on_hand ?? 0),
        })),
        activity: (activityRows ?? []).map((row) => ({
          id: row.id,
          kind: row.kind,
          amount: row.amount === null ? null : Number(row.amount),
          category: row.category,
          note: row.note,
          actorName: row.actor_name,
          cycleCode: row.cycle_id ? (codeById.get(row.cycle_id) ?? null) : null,
          reference: row.reference,
          createdAt: row.created_at,
        })),
        alerts: (alertRows ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          tone: row.tone,
          createdAt: row.created_at,
        })),
        documents: (docRows ?? []).map((row) => ({
          id: row.id,
          kind: row.kind,
          code: row.code,
          title: row.title,
          issuedOn: row.issued_on,
          cycleCode: row.cycle_id
            ? (codeById.get(row.cycle_id) ?? cycleMeta.get(row.cycle_id)?.code ?? null)
            : null,
          cycleName: row.cycle_id ? (cycleMeta.get(row.cycle_id)?.name ?? null) : null,
          memberName: profile.fullName,
          payload: (row.payload ?? {}) as unknown as DocumentPayload,
        })),
        cycles: (cycleRows ?? []).map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          commodity: row.commodity,
          minimumTicket: Number(row.minimum_ticket),
          status: row.status,
        })),
      };
    },
  );

function mapProfile(
  row: ProfileRow | null,
  userId: string,
  email: string,
  role: AppRole,
): MemberProfile {
  return {
    id: userId,
    email,
    fullName: row?.full_name ?? "",
    phone: row?.phone ?? "",
    whatsappNumber: row?.whatsapp_number ?? "",
    bankName: row?.bank_name ?? "",
    accountNumber: row?.account_number ?? "",
    accountName: row?.account_name ?? "",
    bankVerified: Boolean(row?.bank_verified_at),
    notifyEmail: row?.notify_email ?? true,
    notifyWhatsapp: row?.notify_whatsapp ?? true,
    monthlyPlanAmount:
      row?.monthly_plan_amount === null ? null : Number(row?.monthly_plan_amount ?? 0),
    monthlyPlanActive: row?.monthly_plan_active ?? false,
    monthlyPlanStartedOn: row?.monthly_plan_started_on ?? null,
    role,
  };
}

/**
 * Save a member's own details.
 *
 * Deliberately narrow: the fields the member is allowed to change, and nothing
 * else. Not the role (it lives in user_roles and no client can write it), not
 * the verification stamp (a trigger pins it), not any ledger figure.
 */
export const saveMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z
        .string()
        .trim()
        .regex(/^[0-9+\s-]{7,20}$/, "Enter a phone number the farm can reach you on")
        .optional()
        .or(z.literal("")),
      whatsappNumber: z
        .string()
        .trim()
        .regex(/^[0-9+\s-]{7,20}$/, "Enter a WhatsApp number, for example 0803 123 4567")
        .optional()
        .or(z.literal("")),
      bankName: z.string().trim().max(80).optional().or(z.literal("")),
      accountNumber: z
        .string()
        .trim()
        .regex(/^[0-9]{10}$/, "A Nigerian account number is 10 digits")
        .optional()
        .or(z.literal("")),
      accountName: z.string().trim().min(3).max(120).optional().or(z.literal("")),
      notifyEmail: z.boolean(),
      notifyWhatsapp: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Payout details travel together: a bank without an account is not a
    // payout route, and half of one is worse than none.
    const hasBank = Boolean(data.bankName);
    const hasNumber = Boolean(data.accountNumber);
    const hasName = Boolean(data.accountName);
    if (hasBank || hasNumber || hasName) {
      if (!hasBank || !hasNumber || !hasName) {
        throw new Error(
          "Payout details need all three: the bank, the 10-digit account number and the account holder name.",
        );
      }
    }

    const patch = {
      full_name: data.fullName,
      phone: data.phone || null,
      whatsapp_number: data.whatsappNumber || null,
      bank_name: data.bankName || null,
      account_number: data.accountNumber || null,
      account_name: data.accountName || null,
      notify_email: data.notifyEmail,
      notify_whatsapp: data.notifyWhatsapp,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...patch }, { onConflict: "id" });

    if (error) {
      throw new Error(
        "Your details could not be saved. Check the account number is 10 digits and try again.",
      );
    }

    return { ok: true };
  });

/**
 * Start, change or pause the monthly Agri-Save commitment.
 *
 * A plan is a schedule, not a card on file: it records what the member means to
 * put in each month and generates the months that fall due. Every naira still
 * arrives as a normal contribution and is verified like any other, so equity
 * keeps coming from verified rows only.
 */
export const saveMonthlyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      action: z.enum(["start", "pause", "cancel"]),
      amount: z.number().min(MIN_CONTRIBUTION).max(50_000_000).optional(),
      cycleId: z.string().uuid().nullable().optional(),
      months: z.number().int().min(1).max(12).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    if (data.action === "cancel") {
      const { error: cancelError } = await supabase
        .from("profiles")
        .update({
          monthly_plan_active: false,
          monthly_plan_amount: null,
          monthly_plan_started_on: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (cancelError) throw new Error("The plan could not be cancelled");

      await supabase
        .from("monthly_plan_charges")
        .delete()
        .eq("member_id", userId)
        .eq("status", "due");

      return { ok: true, amount: null as number | null, scheduled: 0 };
    }

    if (data.action === "pause") {
      const { error: pauseError } = await supabase
        .from("profiles")
        .update({ monthly_plan_active: false, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (pauseError) throw new Error("The plan could not be paused");
      return { ok: true, amount: null as number | null, scheduled: 0 };
    }

    const amount = data.amount ?? MIN_CONTRIBUTION;
    if (amount < MIN_CONTRIBUTION) {
      throw new Error(
        `The smallest monthly plan the co-operative runs is ₦${MIN_CONTRIBUTION.toLocaleString("en-NG")}.`,
      );
    }

    const months = data.months ?? 6;
    const startedOn = new Date().toISOString().slice(0, 10);

    const { error: saveError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        monthly_plan_amount: amount,
        monthly_plan_active: true,
        monthly_plan_started_on: startedOn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (saveError) throw new Error("The monthly plan could not be saved");

    // Generate the months that are due, starting with this one. Re-running is
    // harmless: the unique (member, due_on) constraint makes it idempotent.
    const rows = Array.from({ length: months }, (_, index) => {
      const due = new Date(startedOn);
      due.setMonth(due.getMonth() + index);
      return {
        member_id: userId,
        cycle_id: data.cycleId ?? null,
        due_on: due.toISOString().slice(0, 10),
        amount,
        status: "due" as const,
        note: index === 0 ? "First month of your Agri-Save plan" : null,
      };
    });

    const { error: scheduleError } = await supabase
      .from("monthly_plan_charges")
      .upsert(rows, { onConflict: "member_id,due_on", ignoreDuplicates: true });

    if (scheduleError) throw new Error("The plan was saved but the schedule could not be built");

    return { ok: true, amount, scheduled: rows.length };
  });

/**
 * Credit the oldest unpaid Agri-Save month as soon as a contribution is
 * verified. Called from the member portal after a payment lands, and safe to
 * call at any time — it is idempotent and it never invents money.
 */
export const applyPlanToContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ investmentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await supabase.rpc("settle_monthly_plan", { _investment_id: data.investmentId });
    return { ok: true };
  });

/* -------------------------------------------------------------------------- *\
 * Alerts
\* -------------------------------------------------------------------------- */

/** Mark the member's alerts as read — the only way the banner goes away. */
export const dismissAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ ids: z.array(z.string().uuid()).max(50).optional() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("member_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("member_id", userId)
      .is("read_at", null);
    if (data.ids && data.ids.length > 0) query = query.in("id", data.ids);
    const { error } = await query;
    if (error) throw new Error("That alert could not be dismissed");
    return { ok: true };
  });

/* -------------------------------------------------------------------------- *\
 * Operator side: proof, WhatsApp text, and the unit list
\* -------------------------------------------------------------------------- */

export type OperatorUnit = {
  id: string;
  code: string;
  name: string;
  commodity: string;
  status: string;
  currentStage: string;
  weekNumber: number | null;
  restricted: boolean;
  assigned: boolean;
};

/**
 * The units a farm worker may log against, and whether their access to each is
 * restricted. A worker with no assignments sees every cycle, exactly as the
 * platform behaved before per-pond permissions existed.
 */
export const getOperatorUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ units: OperatorUnit[]; hasRestrictions: boolean }> => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const [{ data: cycles }, { data: assignments }] = await Promise.all([
      supabase
        .from("farm_cycles")
        .select("*")
        .in("status", ["open", "funded", "active", "harvested"])
        .order("funding_opens_on", { ascending: false }),
      supabase
        .from("operator_assignments")
        .select("cycle_id, revoked_at")
        .eq("operator_id", userId),
    ]);

    const active = new Set(
      (assignments ?? []).filter((row) => row.revoked_at === null).map((row) => row.cycle_id),
    );
    const hasRestrictions = active.size > 0;

    const units: OperatorUnit[] = (cycles ?? [])
      .filter((cycle) => !hasRestrictions || active.has(cycle.id))
      .map((cycle) => ({
        id: cycle.id,
        code: cycle.code,
        name: cycle.name,
        commodity: cycle.commodity,
        status: cycle.status,
        currentStage: cycle.current_stage,
        weekNumber: weekOf(cycle),
        restricted: hasRestrictions,
        assigned: !hasRestrictions || active.has(cycle.id),
      }));

    return { units, hasRestrictions };
  });

function weekOf(cycle: CycleRow): number | null {
  const start = cycle.stocking_on ?? cycle.funding_opens_on;
  if (!start) return null;
  const from = new Date(`${start}T00:00:00`).getTime();
  if (Number.isNaN(from)) return null;
  const weeks = Math.floor((Date.now() - from) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return weeks > 0 ? weeks : null;
}

/** Attach a photo or a short clip to a log the operator has just filed. */
export const attachLogProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      logId: z.string().uuid().nullable().optional(),
      kind: z.enum(["photo", "video"]),
      url: z.string().url().max(600),
      caption: z.string().trim().max(180).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const { error } = await supabase.from("log_media").insert({
      log_id: data.logId ?? null,
      cycle_id: data.cycleId,
      kind: data.kind,
      url: data.url,
      caption: data.caption ?? null,
      captured_by: userId,
    });
    if (error) throw new Error("That photo could not be attached to the log");
    return { ok: true };
  });

/**
 * The WhatsApp text for one log, built from the row that was just written.
 *
 * Returned rather than sent: the co-operative decides when and where to post,
 * and the operator still has to press send in WhatsApp. The platform never
 * posts to a group on its own.
 */
export const getLogWhatsAppText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      logType: z.string().min(2).max(40),
      logId: z.string().uuid().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const { data: cycle } = await supabase
      .from("farm_cycles")
      .select("*")
      .eq("id", data.cycleId)
      .maybeSingle();
    if (!cycle) throw new Error("That farm unit could not be found");

    // The newest matching log is the one the operator just filed.
    const { data: logs } = await supabase
      .from("operational_logs")
      .select("*")
      .eq("cycle_id", data.cycleId)
      .eq("log_type", data.logType as Database["public"]["Enums"]["log_type"])
      .order("created_at", { ascending: false })
      .limit(1);

    const log = (logs ?? [])[0] ?? null;

    const { data: media } = log
      ? await supabase.from("log_media").select("kind").eq("log_id", log.id)
      : { data: [] as { kind: string }[] };

    const text = buildFarmUpdate({
      cycleCode: cycle.code,
      cycleName: cycle.name,
      commodity: cycle.commodity,
      weekNumber: weekOf(cycle),
      logType: data.logType,
      avgWeightG:
        log?.sample_avg_weight_g === null ? null : Number(log?.sample_avg_weight_g ?? 0) || null,
      mortalityCount: log?.mortality_count ?? null,
      feedKg: log?.feed_kg === null ? null : Number(log?.feed_kg ?? 0) || null,
      cratesCollected:
        log?.crates_collected === null ? null : Number(log?.crates_collected ?? 0) || null,
      bagsHarvested: log?.bags_harvested === null ? null : Number(log?.bags_harvested ?? 0) || null,
      populationCount: log?.population_count ?? null,
      publicSummary: log?.public_summary ?? null,
      detail: log?.medication ?? log?.notes ?? null,
      hasPhoto: (media ?? []).some((row) => row.kind === "photo") || Boolean(log?.photo_url),
      hasVideo: (media ?? []).some((row) => row.kind === "video"),
    });

    return { text, logId: log?.id ?? null };
  });

/**
 * A draft broadcast for a whole cycle, for the admin who wants to post the
 * week's summary rather than one log at a time.
 */
export const getCycleBroadcastDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin", "operator"]);

    const { data: cycle } = await supabase
      .from("farm_cycles")
      .select("*")
      .eq("id", data.cycleId)
      .maybeSingle();
    if (!cycle) throw new Error("That farm unit could not be found");

    const { data: funding } = await supabase
      .from("cycle_funding")
      .select("funded_percent")
      .eq("cycle_id", cycle.id)
      .maybeSingle();

    const { data: logs } = await supabase
      .from("operational_logs")
      .select("*")
      .eq("cycle_id", cycle.id)
      .order("log_date", { ascending: false })
      .limit(1);

    const latest = (logs ?? [])[0] ?? null;
    const { data: media } = latest
      ? await supabase.from("log_media").select("kind").eq("log_id", latest.id)
      : { data: [] as { kind: string }[] };

    const text = buildFarmUpdate({
      cycleCode: cycle.code,
      cycleName: cycle.name,
      commodity: cycle.commodity,
      weekNumber: weekOf(cycle),
      logType: latest?.log_type ?? "general",
      avgWeightG:
        latest?.sample_avg_weight_g === null
          ? null
          : Number(latest?.sample_avg_weight_g ?? 0) || null,
      mortalityCount: latest?.mortality_count ?? null,
      feedKg: latest?.feed_kg === null ? null : Number(latest?.feed_kg ?? 0) || null,
      cratesCollected:
        latest?.crates_collected === null ? null : Number(latest?.crates_collected ?? 0) || null,
      bagsHarvested:
        latest?.bags_harvested === null ? null : Number(latest?.bags_harvested ?? 0) || null,
      populationCount: latest?.population_count ?? null,
      publicSummary: latest?.public_summary ?? null,
      detail: latest?.notes ?? latest?.medication ?? null,
      hasPhoto: (media ?? []).some((row) => row.kind === "photo") || Boolean(latest?.photo_url),
      hasVideo: (media ?? []).some((row) => row.kind === "video"),
    });

    const lines = [text];
    if (funding?.funded_percent != null) {
      lines.push(
        `📊 Funding: ${number(funding.funded_percent, 0)}% of ${money(Number(cycle.target_capital))} target`,
      );
    }
    return { text: lines.join("\n"), cycleCode: cycle.code };
  });

/* -------------------------------------------------------------------------- *\
 * Treasury (admin view)
\* -------------------------------------------------------------------------- */

export type TreasuryMovement = {
  id: string;
  kind: string;
  amount: number;
  occurredOn: string;
  category: string | null;
  note: string | null;
  reference: string | null;
  cycleCode: string | null;
};

export type PendingExpense = {
  id: string;
  cycleCode: string;
  amount: number;
  date: string;
  category: string;
  vendor: string | null;
  note: string | null;
  receiptUrl: string | null;
  loggedBy: string;
  isPayable: boolean;
};

export type TreasuryConsole = {
  snapshot: TreasurySnapshot;
  movements: TreasuryMovement[];
  pendingExpenses: PendingExpense[];
  perCycle: CycleTreasury[];
};

/** The treasury desk: the three figures, the movement book, and the queue. */
export const getTreasuryConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TreasuryConsole> => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const [{ data: snapshot }, { data: movements }, { data: pending }, { data: perCycle }] =
      await Promise.all([
        supabase.from("treasury_position").select("*").maybeSingle(),
        supabase
          .from("treasury_entries")
          .select("*")
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("farm_expenses")
          .select("*")
          .eq("status", "pending")
          .order("date", { ascending: true })
          .limit(60),
        supabase.from("cycle_treasury_position").select("*"),
      ]);

    const cycleIds = Array.from(
      new Set(
        [...(movements ?? []), ...(pending ?? [])]
          .map((row) => row.cycle_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const { data: cycles } = cycleIds.length
      ? await supabase.from("farm_cycles").select("id, code").in("id", cycleIds)
      : { data: [] as { id: string; code: string }[] };
    const codeById = new Map((cycles ?? []).map((row) => [row.id, row.code]));

    const loggerIds = Array.from(
      new Set(
        (pending ?? []).map((row) => row.recorded_by).filter((id): id is string => Boolean(id)),
      ),
    );
    const { data: loggers } = loggerIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", loggerIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((loggers ?? []).map((row) => [row.id, row.full_name ?? "Farm staff"]));

    return {
      snapshot: {
        totalCapitalFunded: Number(snapshot?.total_capital_funded ?? 0),
        totalExpensesIncurred: Number(snapshot?.total_expenses_incurred ?? 0),
        totalPayoutsPaid: Number(snapshot?.total_payouts_paid ?? 0),
        totalReserveHeld: Number(snapshot?.total_reserve_held ?? 0),
        operatingCashOnHand: Number(snapshot?.operating_cash_on_hand ?? 0),
        movements: Number(snapshot?.movements ?? 0),
        lastMovementOn: snapshot?.last_movement_on ?? null,
      },
      movements: (movements ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        amount: Number(row.amount),
        occurredOn: row.occurred_on,
        category: row.category,
        note: row.note,
        reference: row.reference,
        cycleCode: row.cycle_id ? (codeById.get(row.cycle_id) ?? null) : null,
      })),
      pendingExpenses: (pending ?? []).map((row) => ({
        id: row.id,
        cycleCode: codeById.get(row.cycle_id) ?? "—",
        amount: Number(row.amount),
        date: row.date,
        category: row.category,
        vendor: row.vendor,
        note: row.note,
        receiptUrl: row.receipt_url,
        loggedBy: nameById.get(row.recorded_by) ?? "Farm staff",
        isPayable: row.is_payable,
      })),
      perCycle: (perCycle ?? []).map((row) => ({
        cycleId: row.cycle_id ?? "",
        code: row.code ?? "—",
        capitalFunded: Number(row.capital_funded ?? 0),
        expensesPaid: Number(row.expenses_paid ?? 0),
        cashOnHand: Number(row.cash_on_hand ?? 0),
      })),
    };
  });

/**
 * Approve or reject an expense an operator filed.
 *
 * Approving stamps the reviewer; rejecting keeps the row and its reason, because
 * the co-operative's rule is that a correction is a new entry, never a deletion.
 * Marking the money as actually paid (`settledOn`) is what moves the treasury.
 */
export const reviewExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      expenseId: z.string().uuid(),
      decision: z.enum(["approve", "reject"]),
      settledOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const patch =
      data.decision === "approve"
        ? {
            status: "approved" as const,
            approved_by: userId,
            approved_at: new Date().toISOString(),
            review_note: data.note ?? null,
            settled_on: data.settledOn ?? null,
            updated_at: new Date().toISOString(),
          }
        : {
            status: "rejected" as const,
            approved_by: userId,
            approved_at: new Date().toISOString(),
            review_note: data.note ?? "Rejected by treasury",
            updated_at: new Date().toISOString(),
          };

    const { error } = await supabase.from("farm_expenses").update(patch).eq("id", data.expenseId);
    if (error) throw new Error("That expense could not be reviewed");
    return { ok: true };
  });

/**
 * Record a movement the ledger cannot produce on its own: a top-up from the
 * co-operative's own pocket, or a reserve transferred into escrow.
 *
 * Every entry needs a reason in words. A treasury that moves money without
 * saying why is not a treasury anybody should trust.
 */
export const recordTreasuryMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      kind: z.enum(["top_up", "reserve_in"]),
      amount: z.number().positive().max(1_000_000_000),
      cycleId: z.string().uuid().nullable().optional(),
      occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      category: z.string().trim().min(3).max(80),
      note: z.string().trim().min(10, "Say what this money was for").max(400),
      reference: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const { error } = await supabase.from("treasury_entries").insert({
      kind: data.kind,
      amount: data.amount,
      cycle_id: data.cycleId ?? null,
      occurred_on: data.occurredOn,
      category: data.category,
      note: data.note,
      reference: data.reference ?? null,
      source_table: "manual_entry",
      source_id: crypto.randomUUID(),
      recorded_by: userId,
    });
    if (error) throw new Error("That movement could not be recorded");
    return { ok: true };
  });

/* -------------------------------------------------------------------------- *\
 * Documents
\* -------------------------------------------------------------------------- */

export type DocumentPayload = {
  orgName: string;
  memberName: string;
  memberId: string;
  cycleCode: string | null;
  cycleName: string | null;
  commodity: string | null;
  amount: number;
  issuedOn: string;
  reference: string | null;
  receiptNumber: string | null;
  /** Certificate extras. */
  equityPercent?: number;
  verifiedOn?: string | null;
  /** Statement extras. */
  harvestWeightKg?: number;
  grossRevenue?: number;
  clearedExpenses?: number;
  caretakerFee?: number;
  investorPool?: number;
  principal?: number;
  profit?: number;
  total?: number;
  reserveHeld?: number;
  settledOn?: string | null;
  note?: string | null;
};

/**
 * Issue (or re-issue) a document for one of the member's own ledger rows.
 *
 * Re-using the same kind + source row returns the existing code, so a member
 * who prints twice gets one verifiable document rather than two that disagree.
 */
export const issueDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      kind: z.enum(["investment_certificate", "payment_receipt", "harvest_statement"]),
      investmentId: z.string().uuid().optional(),
      cycleId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<{ code: string; documentId: string }> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const memberName = profile?.full_name ?? "NDH FarmFund member";

    if (data.kind === "harvest_statement") {
      if (!data.cycleId) throw new Error("A settlement statement needs a cycle");

      const { data: cycle } = await supabase
        .from("farm_cycles")
        .select("*")
        .eq("id", data.cycleId)
        .maybeSingle();
      if (!cycle) throw new Error("That cycle could not be found");

      // The member's own settlement line. RLS makes this a one-row read for
      // anyone who is not the owner, and an empty read for a non-holder.
      const { data: lines } = await supabase
        .from("waterfall_lines")
        .select("*")
        .eq("cycle_id", data.cycleId)
        .eq("member_id", userId);

      const line = (lines ?? [])[0];
      if (!line) throw new Error("You have no settlement line in that cycle");

      // The cycle's settlement totals come from the aggregate view, so a member
      // never needs read access to the settlement book to print their own page.
      const { data: summary } = await supabase
        .from("cycle_settlement_summary")
        .select("*")
        .eq("cycle_id", data.cycleId)
        .maybeSingle();

      const payload: DocumentPayload = {
        orgName: "NDH FarmFund",
        memberName,
        memberId: userId,
        cycleCode: cycle.code,
        cycleName: cycle.name,
        commodity: cycle.commodity,
        amount: Number(line.total_amount),
        issuedOn: new Date().toISOString().slice(0, 10),
        reference: line.payout_reference ?? null,
        receiptNumber: null,
        equityPercent: Number(line.equity_percent),
        harvestWeightKg: Number(summary?.total_weight_kg ?? 0),
        grossRevenue: Number(summary?.gross_revenue ?? 0),
        clearedExpenses: Number(summary?.liabilities_paid ?? 0),
        caretakerFee: Number(summary?.operator_fee ?? 0),
        investorPool: Number(summary?.investor_profit_pool ?? 0),
        principal: Number(line.principal_amount),
        profit: Number(line.profit_amount),
        total: Number(line.total_amount),
        reserveHeld: Number(summary?.reserve_set_aside ?? 0),
        settledOn: summary?.executed_at ?? null,
        note: summary?.principal_at_risk
          ? "This cycle's harvest did not cover full principal. The shortfall is stated rather than absorbed."
          : null,
      };

      return await upsertDocument(supabase, {
        kind: data.kind,
        code: newDocumentCode(data.kind),
        memberId: userId,
        cycleId: data.cycleId,
        distributionId: null,
        title: `Harvest settlement statement · ${cycle.code}`,
        payload,
      });
    }

    if (!data.investmentId) throw new Error("Pick a contribution first");

    // RLS returns this row only if it belongs to the caller.
    const { data: investment } = await supabase
      .from("cycle_investments")
      .select("*")
      .eq("id", data.investmentId)
      .maybeSingle();

    if (!investment) throw new Error("That contribution is not on your ledger");
    if (investment.status !== "success") {
      throw new Error("A document is only issued for a verified contribution");
    }

    const { data: cycle } = await supabase
      .from("farm_cycles")
      .select("*")
      .eq("id", investment.cycle_id)
      .maybeSingle();
    if (!cycle) throw new Error("That cycle could not be found");

    // Equity at the moment of issue, from the funding view — the same figure
    // the portal shows, read once so the printed page and the screen agree.
    const { data: funding } = await supabase
      .from("cycle_funding")
      .select("raised_capital")
      .eq("cycle_id", cycle.id)
      .maybeSingle();
    const total = Number(funding?.raised_capital ?? 0);

    const payload: DocumentPayload = {
      orgName: "NDH FarmFund",
      memberName,
      memberId: userId,
      cycleCode: cycle.code,
      cycleName: cycle.name,
      commodity: cycle.commodity,
      amount: Number(investment.amount),
      issuedOn: new Date().toISOString().slice(0, 10),
      reference: investment.paystack_reference ?? investment.bank_reference ?? null,
      receiptNumber: investment.receipt_number,
      equityPercent: total > 0 ? (Number(investment.amount) / total) * 100 : 0,
      verifiedOn: investment.verified_at,
    };

    return await upsertDocument(supabase, {
      kind: data.kind,
      code: newDocumentCode(data.kind),
      memberId: userId,
      cycleId: cycle.id,
      investmentId: investment.id,
      title:
        data.kind === "investment_certificate"
          ? `Investment certificate · ${cycle.code}`
          : `Payment receipt · ${cycle.code}`,
      payload,
    });
  });

async function upsertDocument(
  supabase: SupabaseClient<Database>,
  input: {
    kind: "investment_certificate" | "payment_receipt" | "harvest_statement";
    code: string;
    memberId: string;
    cycleId: string | null;
    investmentId?: string | null;
    distributionId?: string | null;
    title: string;
    payload: DocumentPayload;
  },
): Promise<{ code: string; documentId: string }> {
  // One document per (kind, source row). Asking again returns the first one, so
  // two print-outs of "the receipt" can never carry different figures.
  // The natural key differs by document: a receipt and a certificate hang off
  // one contribution, a statement off one cycle. Keying on the right one is what
  // stops a second print-out from carrying different figures.
  const sourceColumn = input.investmentId
    ? "investment_id"
    : input.distributionId
      ? "distribution_id"
      : "cycle_id";
  const sourceValue = input.investmentId ?? input.distributionId ?? input.cycleId ?? null;

  if (sourceValue) {
    const { data: existing } = await supabase
      .from("documents")
      .select("id, code")
      .eq("kind", input.kind)
      .eq("member_id", input.memberId)
      .eq(sourceColumn as "investment_id", sourceValue)
      .maybeSingle();
    if (existing) return { code: existing.code, documentId: existing.id };
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      kind: input.kind,
      code: input.code,
      member_id: input.memberId,
      cycle_id: input.cycleId,
      investment_id: input.investmentId ?? null,
      distribution_id: input.distributionId ?? null,
      title: input.title,
      payload:
        input.payload as unknown as Database["public"]["Tables"]["documents"]["Row"]["payload"],
      issued_by: input.memberId,
    })
    .select("id, code")
    .single();

  if (error) throw new Error("That document could not be issued");
  return { code: data.code, documentId: data.id };
}

function newDocumentCode(kind: string): string {
  const prefix =
    kind === "investment_certificate" ? "CERT" : kind === "payment_receipt" ? "RCPT" : "STMT";
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `AGC-${prefix}-${rand}`;
}

/** Look up a document by the code printed on it. Signed-in members only. */
export const lookupDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ code: z.string().trim().min(6).max(40) }))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("document_register")
      .select("*")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw new Error("The register could not be read");
    if (!row)
      return {
        found: false as const,
        document: null,
      };
    return {
      found: true as const,
      document: {
        code: row.code ?? data.code,
        kind: row.kind ?? "payment_receipt",
        title: row.title ?? "Document",
        issuedOn: row.issued_on ?? "",
        cycleCode: row.cycle_code,
        cycleName: row.cycle_name,
        payload: (row.payload ?? {}) as unknown as DocumentPayload,
      },
    };
  });

/* -------------------------------------------------------------------------- *\
 * Small helpers shared by the UI
\* -------------------------------------------------------------------------- */

/** A one-line summary of a movement, for the feed. */
export function describeMovement(entry: {
  kind: string;
  amount: number | null;
  category: string | null;
}): string {
  const amount = entry.amount === null ? "" : money(entry.amount);
  switch (entry.kind) {
    case "expense":
    case "expense_out":
      return `${amount} spent on ${entry.category ?? "farm operations"}`;
    case "capital_in":
      return `${amount} verified into the treasury`;
    case "payout":
    case "payout_out":
      return `${amount} paid out to members`;
    case "reserve_in":
      return `${amount} moved into the emergency reserve`;
    case "top_up":
      return `${amount} added by treasury`;
    default:
      return `${amount} recorded`;
  }
}

export function activityWhen(value: string): string {
  return dateLabel(value.slice(0, 10));
}
