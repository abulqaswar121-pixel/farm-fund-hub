import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, resolveCallerRole, type AppRole } from "@/lib/agri/roles";
import { readRules, rulesChip, validateRules, type CycleRules } from "@/lib/agri/rules";
import type { Database } from "@/integrations/supabase/types";

type CycleRow = Database["public"]["Tables"]["farm_cycles"]["Row"];

/* ========================================================================== *
 * Shared shapes
 * ========================================================================== */

export type CycleOption = {
  id: string;
  code: string;
  name: string;
  commodity: string;
  status: string;
  currentStage: string;
  rulesChip: string;
};

export type OperatorLog = {
  id: string;
  cycleId: string;
  cycleCode: string;
  logType: string;
  logDate: string;
  feedKg: number | null;
  feedBags: number | null;
  mortalityCount: number | null;
  mortalityReason: string | null;
  sampleCount: number | null;
  sampleAvgWeightG: number | null;
  biomassKg: number | null;
  cratesCollected: number | null;
  bagsHarvested: number | null;
  medication: string | null;
  notes: string | null;
  publicSummary: string | null;
  reviewStatus: string;
  reviewerNote: string | null;
  recordedBy: string;
  createdAt: string;
};

export type OperatorExpense = {
  id: string;
  cycleId: string;
  cycleCode: string;
  amount: number;
  date: string;
  category: string;
  vendor: string | null;
  note: string | null;
  isPayable: boolean;
};

export type IncidentRecord = {
  id: string;
  cycleId: string | null;
  cycleCode: string | null;
  title: string;
  category: string;
  severity: string;
  status: string;
  occurredOn: string;
  description: string;
  estimatedImpact: number | null;
  insuranceClaimRef: string | null;
  resolutionNote: string | null;
  resolvedOn: string | null;
  loggedBy: string;
};

export type OperatorWorkspace = {
  role: AppRole;
  cycles: CycleOption[];
  todayLogs: OperatorLog[];
  recentLogs: OperatorLog[];
  expenses: OperatorExpense[];
  incidents: IncidentRecord[];
  awaitingReview: number;
  totals: {
    feedKgThisCycle: number;
    mortalityThisCycle: number;
    loggedToday: number;
    expensesThisCycle: number;
  };
};

/* ========================================================================== *
 * Operator — the mobile-first daily quick-log
 * ========================================================================== */

export const getOperatorWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OperatorWorkspace> => {
    const { supabase, userId } = context;
    const role = await assertRole(supabase, userId, ["operator", "admin"]);

    const { data: cycles } = await supabase
      .from("farm_cycles")
      .select("*")
      .order("funding_opens_on", { ascending: false });

    const cycleMap = new Map<string, CycleRow>((cycles ?? []).map((row) => [row.id, row]));
    const today = new Date().toISOString().slice(0, 10);

    const { data: logs } = await supabase
      .from("operational_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120);

    const mapped = (logs ?? []).map((row) => mapLog(row, cycleMap));

    const { data: expenses } = await supabase
      .from("farm_expenses")
      .select("*")
      .order("date", { ascending: false })
      .limit(60);

    const { data: incidents } = await supabase
      .from("incidents")
      .select("*")
      .order("occurred_on", { ascending: false })
      .limit(40);

    // "This cycle" means the most recently active one, which is what a field
    // worker is standing in front of.
    const running = (cycles ?? []).find((row) => row.status === "active");
    const cycleLogs = running ? mapped.filter((log) => log.cycleId === running.id) : [];

    return {
      role,
      cycles: (cycles ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        commodity: row.commodity,
        status: row.status,
        currentStage: row.current_stage,
        rulesChip: rulesChip(readRules(row)),
      })),
      todayLogs: mapped.filter((log) => log.logDate === today),
      recentLogs: mapped.slice(0, 40),
      expenses: (expenses ?? []).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleCode: cycleMap.get(row.cycle_id)?.code ?? "—",
        amount: Number(row.amount),
        date: row.date,
        category: row.category,
        vendor: row.vendor,
        note: row.note,
        isPayable: row.is_payable,
      })),
      incidents: (incidents ?? []).map((row) =>
        mapIncident(row, row.cycle_id ? (cycleMap.get(row.cycle_id)?.code ?? null) : null),
      ),
      awaitingReview: mapped.filter((log) => log.reviewStatus === "pending").length,
      totals: {
        feedKgThisCycle: cycleLogs.reduce((sum, log) => sum + Number(log.feedKg ?? 0), 0),
        mortalityThisCycle: cycleLogs.reduce(
          (sum, log) => sum + Number(log.mortalityCount ?? 0),
          0,
        ),
        loggedToday: mapped.filter((log) => log.logDate === today).length,
        expensesThisCycle: (expenses ?? [])
          .filter((row) => running && row.cycle_id === running.id)
          .reduce((sum, row) => sum + Number(row.amount), 0),
      },
    };
  });

function mapLog(
  row: Database["public"]["Tables"]["operational_logs"]["Row"],
  cycleMap: Map<string, CycleRow>,
): OperatorLog {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    cycleCode: cycleMap.get(row.cycle_id)?.code ?? "—",
    logType: row.log_type,
    logDate: row.log_date,
    feedKg: row.feed_kg === null ? null : Number(row.feed_kg),
    feedBags: row.feed_bags === null ? null : Number(row.feed_bags),
    mortalityCount: row.mortality_count,
    mortalityReason: row.mortality_reason,
    sampleCount: row.sample_count,
    sampleAvgWeightG: row.sample_avg_weight_g === null ? null : Number(row.sample_avg_weight_g),
    biomassKg: row.biomass_kg === null ? null : Number(row.biomass_kg),
    cratesCollected: row.crates_collected === null ? null : Number(row.crates_collected),
    bagsHarvested: row.bags_harvested === null ? null : Number(row.bags_harvested),
    medication: row.medication,
    notes: row.notes,
    publicSummary: row.public_summary,
    reviewStatus: row.review_status,
    reviewerNote: row.review_note,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
  };
}

function mapIncident(
  row: Database["public"]["Tables"]["incidents"]["Row"],
  cycleCode: string | null,
): IncidentRecord {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    cycleCode,
    title: row.title,
    category: row.category,
    severity: row.severity,
    status: row.status,
    occurredOn: row.occurred_on,
    description: row.description,
    estimatedImpact: row.estimated_impact === null ? null : Number(row.estimated_impact),
    insuranceClaimRef: row.insurance_claim_ref,
    resolutionNote: row.resolution_note,
    resolvedOn: row.resolved_on,
    loggedBy: row.logged_by,
  };
}

const optionalDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

/**
 * The single writer for every kind of operational log.
 *
 * Feed, growth samples, mortality and medication all land in one table so the
 * investor-facing telemetry charts have one honest source. `log_type` selects
 * which numbers are meaningful; the rest stay null.
 */
export const fileOperationalLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      logType: z.enum([
        "feed",
        "growth_sample",
        "mortality",
        "medication",
        "general",
        "harvest",
        "sale",
      ]),
      logDate: optionalDay,
      feedKg: z.number().nonnegative().optional(),
      feedBags: z.number().nonnegative().optional(),
      mortalityCount: z.number().int().nonnegative().optional(),
      mortalityReason: z.string().trim().max(300).optional(),
      populationCount: z.number().int().nonnegative().optional(),
      sampleCount: z.number().int().nonnegative().optional(),
      sampleAvgWeightG: z.number().nonnegative().optional(),
      biomassKg: z.number().nonnegative().optional(),
      cratesCollected: z.number().nonnegative().optional(),
      bagsHarvested: z.number().nonnegative().optional(),
      areaSqm: z.number().nonnegative().optional(),
      medication: z.string().trim().max(300).optional(),
      notes: z.string().trim().max(2000).optional(),
      publicSummary: z.string().trim().max(240).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const { error } = await supabase.from("operational_logs").insert({
      cycle_id: data.cycleId,
      log_type: data.logType,
      log_date: data.logDate ?? new Date().toISOString().slice(0, 10),
      feed_kg: data.feedKg ?? null,
      feed_bags: data.feedBags ?? null,
      mortality_count: data.mortalityCount ?? null,
      mortality_reason: data.mortalityReason ?? null,
      population_count: data.populationCount ?? null,
      sample_count: data.sampleCount ?? null,
      sample_avg_weight_g: data.sampleAvgWeightG ?? null,
      biomass_kg: data.biomassKg ?? null,
      crates_collected: data.cratesCollected ?? null,
      bags_harvested: data.bagsHarvested ?? null,
      area_sqm: data.areaSqm ?? null,
      medication: data.medication ?? null,
      notes: data.notes ?? null,
      public_summary: data.publicSummary ?? null,
      recorded_by: userId,
      review_status: "pending",
    });

    if (error) throw new Error("Unable to save that entry — check the figures and try again");
    return { ok: true };
  });

export const fileFarmExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      amount: z.number().positive(),
      date: optionalDay,
      category: z.string().trim().min(2).max(60),
      vendor: z.string().trim().max(120).optional(),
      note: z.string().trim().max(500).optional(),
      isPayable: z.boolean().optional(),
      receiptUrl: z.string().url().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const { error } = await supabase.from("farm_expenses").insert({
      cycle_id: data.cycleId,
      amount: data.amount,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      category: data.category,
      vendor: data.vendor ?? null,
      note: data.note ?? null,
      is_payable: data.isPayable ?? false,
      receipt_url: data.receiptUrl ?? null,
      recorded_by: userId,
    });

    if (error) throw new Error("Unable to save that expense");
    return { ok: true };
  });

/** The open harvest weigh-in. The operator files weight and scale ticket only. */
export const fileHarvestWeighIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      harvestDate: optionalDay,
      totalWeightKg: z.number().nonnegative(),
      totalCount: z.number().int().nonnegative().optional(),
      scaleTicketRef: z.string().trim().max(80).optional(),
      buyer: z.string().trim().max(120).optional(),
      buyerNote: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const { error } = await supabase.from("harvest_records").insert({
      cycle_id: data.cycleId,
      harvest_date: data.harvestDate ?? new Date().toISOString().slice(0, 10),
      total_weight_kg: data.totalWeightKg,
      total_count: data.totalCount ?? null,
      scale_ticket_ref: data.scaleTicketRef ?? null,
      buyer: data.buyer ?? null,
      buyer_note: data.buyerNote ?? null,
      gross_revenue: 0,
      recorded_by: userId,
    });

    if (error) throw new Error("Unable to file the harvest weigh-in");
    return { ok: true };
  });

export const logIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid().nullable().optional(),
      title: z.string().trim().min(4).max(140),
      category: z.string().trim().min(2).max(60),
      severity: z.enum(["low", "moderate", "serious", "critical"]),
      occurredOn: optionalDay,
      description: z.string().trim().min(10).max(2000),
      estimatedImpact: z.number().nonnegative().optional(),
      insuranceClaimRef: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const { error } = await supabase.from("incidents").insert({
      cycle_id: data.cycleId ?? null,
      title: data.title,
      category: data.category,
      severity: data.severity,
      occurred_on: data.occurredOn ?? new Date().toISOString().slice(0, 10),
      description: data.description,
      estimated_impact: data.estimatedImpact ?? null,
      insurance_claim_ref: data.insuranceClaimRef ?? null,
      logged_by: userId,
      status: "open",
    });

    if (error) throw new Error("Unable to log that incident");
    return { ok: true };
  });

export const logWeatherSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid().nullable().optional(),
      capturedOn: optionalDay,
      rainfallMm: z.number().nonnegative().optional(),
      tempMinC: z.number().optional(),
      tempMaxC: z.number().optional(),
      humidityPercent: z.number().min(0).max(100).optional(),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["operator", "admin"]);

    const { error } = await supabase.from("weather_snapshots").upsert(
      {
        cycle_id: data.cycleId ?? null,
        captured_on: data.capturedOn ?? new Date().toISOString().slice(0, 10),
        rainfall_mm: data.rainfallMm ?? null,
        temp_min_c: data.tempMinC ?? null,
        temp_max_c: data.tempMaxC ?? null,
        humidity_percent: data.humidityPercent ?? null,
        source: "operator observation",
        note: data.note ?? null,
        recorded_by: userId,
      },
      { onConflict: "cycle_id,captured_on" },
    );

    if (error) throw new Error("Unable to record that weather snapshot");
    return { ok: true };
  });

/* ========================================================================== *
 * Admin & treasury
 * ========================================================================== */

export type AdminCycle = {
  id: string;
  code: string;
  name: string;
  commodity: string;
  status: string;
  currentStage: string;
  targetCapital: number;
  minimumTicket: number;
  raised: number;
  fundedPercent: number;
  investorCount: number;
  rulesChip: string;
  locked: boolean;
  fundingClosesOn: string | null;
  projectedHarvestOn: string | null;
};

export type PendingInvestment = {
  id: string;
  cycleId: string;
  cycleCode: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string;
  method: string;
  bankReference: string | null;
  paystackReference: string | null;
  note: string | null;
};

export type AdminMember = {
  userId: string;
  fullName: string;
  role: AppRole;
  joinedAt: string;
  verifiedCapital: number;
  cycles: number;
};

export type AdminConsole = {
  role: AppRole;
  cycles: AdminCycle[];
  pendingInvestments: PendingInvestment[];
  logsAwaitingReview: OperatorLog[];
  harvestsAwaitingSale: {
    id: string;
    cycleId: string;
    cycleCode: string;
    harvestDate: string;
    totalWeightKg: number | null;
    scaleTicketRef: string | null;
    buyer: string | null;
  }[];
  settlements: {
    id: string;
    cycleId: string;
    cycleCode: string;
    grossRevenue: number;
    netProfit: number;
    investorProfitPool: number;
    operatorFee: number;
    reserveSetAside: number;
    principalReturned: number;
    principalAtRisk: boolean;
    status: string;
    executedAt: string;
  }[];
  members: AdminMember[];
  incidents: IncidentRecord[];
  transfers: {
    id: string;
    cycleId: string;
    cycleCode: string;
    capitalAmount: number;
    askingPrice: number;
    status: string;
    createdAt: string;
  }[];
  visits: {
    id: string;
    cycleId: string | null;
    cycleCode: string | null;
    visitDate: string;
    slot: string;
    guests: number;
    status: string;
    memberNote: string | null;
  }[];
  kpis: {
    capitalUnderManagement: number;
    awaitingVerification: number;
    logsToReview: number;
    openIncidents: number;
    members: number;
    settledCycles: number;
  };
};

export const getAdminConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminConsole> => {
    const { supabase, userId } = context;
    const role = await assertRole(supabase, userId, ["admin"]);

    const [
      { data: cycles },
      { data: funding },
      { data: pending },
      { data: logs },
      { data: harvests },
      { data: settlements },
      { data: roles },
      { data: profiles },
      { data: investmentRows },
      { data: incidents },
      { data: transfers },
      { data: visits },
    ] = await Promise.all([
      supabase.from("farm_cycles").select("*").order("funding_opens_on", { ascending: false }),
      supabase.from("cycle_funding").select("*"),
      supabase
        .from("cycle_investments")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("operational_logs")
        .select("*")
        .eq("review_status", "pending")
        .order("log_date", { ascending: true })
        .limit(80),
      supabase.from("harvest_records").select("*").eq("gross_revenue", 0),
      supabase
        .from("waterfall_distributions")
        .select("*")
        .order("executed_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role, created_at"),
      supabase.from("profiles").select("id, full_name"),
      supabase
        .from("cycle_investments")
        .select("member_id, cycle_id, amount, transferred_out, status"),
      supabase.from("incidents").select("*").order("occurred_on", { ascending: false }).limit(60),
      supabase.from("share_transfers").select("*").order("created_at", { ascending: false }),
      supabase.from("farm_visits").select("*").order("visit_date", { ascending: true }).limit(60),
    ]);

    const cycleMap = new Map<string, CycleRow>((cycles ?? []).map((row) => [row.id, row]));
    const fundingMap = new Map((funding ?? []).map((row) => [row.cycle_id ?? "", row]));
    const nameMap = new Map(
      (profiles ?? []).map((row) => [row.id, row.full_name ?? "Unnamed member"]),
    );

    const verified = (investmentRows ?? []).filter((row) => row.status === "success");

    const members: AdminMember[] = (roles ?? []).map((row) => {
      const mine = verified.filter((investment) => investment.member_id === row.user_id);
      return {
        userId: row.user_id,
        fullName: nameMap.get(row.user_id) ?? "Unnamed member",
        role: (row.role === "contributor" ? "member" : row.role) as AppRole,
        joinedAt: row.created_at,
        verifiedCapital: mine.reduce(
          (sum, item) => sum + Number(item.amount) - Number(item.transferred_out ?? 0),
          0,
        ),
        cycles: new Set(mine.map((item) => item.cycle_id)).size,
      };
    });

    const capitalUnderManagement = verified.reduce(
      (sum, row) => sum + Number(row.amount) - Number(row.transferred_out ?? 0),
      0,
    );

    return {
      role,
      cycles: (cycles ?? []).map((cycle) => ({
        id: cycle.id,
        code: cycle.code,
        name: cycle.name,
        commodity: cycle.commodity,
        status: cycle.status,
        currentStage: cycle.current_stage,
        targetCapital: Number(cycle.target_capital),
        minimumTicket: Number(cycle.minimum_ticket),
        raised: Number(fundingMap.get(cycle.id)?.raised_capital ?? 0),
        fundedPercent: Number(fundingMap.get(cycle.id)?.funded_percent ?? 0),
        investorCount: Number(fundingMap.get(cycle.id)?.investor_count ?? 0),
        rulesChip: rulesChip(readRules(cycle)),
        locked: cycle.locked_at !== null,
        fundingClosesOn: cycle.funding_closes_on,
        projectedHarvestOn: cycle.projected_harvest_on,
      })),
      pendingInvestments: (pending ?? []).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleCode: cycleMap.get(row.cycle_id)?.code ?? "—",
        memberId: row.member_id,
        memberName: nameMap.get(row.member_id) ?? "Unnamed member",
        amount: Number(row.amount),
        date: row.date,
        method: row.method,
        bankReference: row.bank_reference,
        paystackReference: row.paystack_reference,
        note: row.note,
      })),
      logsAwaitingReview: (logs ?? []).map((row) => mapLog(row, cycleMap)),
      harvestsAwaitingSale: (harvests ?? []).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleCode: cycleMap.get(row.cycle_id)?.code ?? "—",
        harvestDate: row.harvest_date,
        totalWeightKg: row.total_weight_kg === null ? null : Number(row.total_weight_kg),
        scaleTicketRef: row.scale_ticket_ref,
        buyer: row.buyer,
      })),
      settlements: (settlements ?? []).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleCode: cycleMap.get(row.cycle_id)?.code ?? "—",
        grossRevenue: Number(row.gross_revenue),
        netProfit: Number(row.net_profit),
        investorProfitPool: Number(row.investor_profit_pool),
        operatorFee: Number(row.operator_fee),
        reserveSetAside: Number(row.reserve_set_aside),
        principalReturned: Number(row.principal_returned),
        principalAtRisk: row.principal_at_risk,
        status: row.status,
        executedAt: row.executed_at,
      })),
      members: members.sort((a, b) => b.verifiedCapital - a.verifiedCapital),
      incidents: (incidents ?? []).map((row) =>
        mapIncident(row, row.cycle_id ? (cycleMap.get(row.cycle_id)?.code ?? null) : null),
      ),
      transfers: (transfers ?? []).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleCode: cycleMap.get(row.cycle_id)?.code ?? "—",
        capitalAmount: Number(row.capital_amount),
        askingPrice: Number(row.asking_price),
        status: row.status,
        createdAt: row.created_at,
      })),
      visits: (visits ?? []).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleCode: row.cycle_id ? (cycleMap.get(row.cycle_id)?.code ?? null) : null,
        visitDate: row.visit_date,
        slot: row.slot,
        guests: row.guests,
        status: row.status,
        memberNote: row.member_note,
      })),
      kpis: {
        capitalUnderManagement,
        awaitingVerification: (pending ?? []).length,
        logsToReview: (logs ?? []).length,
        openIncidents: (incidents ?? []).filter((row) => row.status !== "resolved").length,
        members: members.filter((member) => member.role === "member").length,
        settledCycles: (settlements ?? []).length,
      },
    };
  });

/** The full contribution book for one cycle, with live equity per member. */
export const getCyclePositionBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, ["admin", "operator"]);
    const { data: book, error } = await context.supabase.rpc("cycle_position_book", {
      _cycle_id: data.cycleId,
    });
    if (error) throw new Error("Unable to read the contribution book for that cycle");
    return (book ?? []).map((row) => ({
      memberId: row.member_id,
      fullName: row.full_name,
      capital: Number(row.member_capital),
      equityPercent: Number(row.equity_percent),
    }));
  });

/* --- cycle launcher -------------------------------------------------------- */

export const createFarmCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      code: z.string().trim().min(3).max(24),
      name: z.string().trim().min(4).max(120),
      commodity: z.enum(["catfish", "tilapia", "broiler", "layer", "grain", "greenhouse"]),
      summary: z.string().trim().max(600).optional(),
      farmSite: z.string().trim().min(2).max(120),
      farmLatitude: z.number().min(-90).max(90).optional(),
      farmLongitude: z.number().min(-180).max(180).optional(),
      targetCapital: z.number().positive(),
      minimumTicket: z.number().positive(),
      projectedRevenue: z.number().nonnegative(),
      projectedLiabilities: z.number().nonnegative(),
      investorPercent: z.number().positive().max(99),
      operatorPercent: z.number().positive().max(99),
      reservePercent: z.number().min(5).max(10),
      cycleWeeks: z.number().int().min(1).max(104),
      fundingClosesOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      stockingOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      projectedHarvestOn: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const rules: CycleRules = {
      investorSharePercent: data.investorPercent,
      operatorSharePercent: data.operatorPercent,
      reservePercent: data.reservePercent,
    };
    const problems = validateRules(rules);
    if (problems.length) throw new Error(problems.join(" "));

    if (data.minimumTicket > data.targetCapital) {
      throw new Error("The minimum entry ticket cannot exceed the funding target");
    }

    const { data: cycle, error } = await supabase
      .from("farm_cycles")
      .insert({
        code: data.code.toUpperCase(),
        name: data.name,
        commodity: data.commodity,
        summary: data.summary ?? null,
        farm_site: data.farmSite,
        farm_latitude: data.farmLatitude ?? null,
        farm_longitude: data.farmLongitude ?? null,
        target_capital: data.targetCapital,
        minimum_ticket: data.minimumTicket,
        projected_revenue: data.projectedRevenue,
        projected_liabilities: data.projectedLiabilities,
        profit_investor_percent: data.investorPercent,
        profit_operator_percent: data.operatorPercent,
        reserve_percent: data.reservePercent,
        cycle_weeks: data.cycleWeeks,
        funding_opens_on: new Date().toISOString().slice(0, 10),
        funding_closes_on: data.fundingClosesOn ?? null,
        stocking_on: data.stockingOn ?? null,
        projected_harvest_on: data.projectedHarvestOn ?? null,
        status: "draft",
        current_stage: "funding_open",
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(
        error.message.includes("duplicate key")
          ? "That cycle code is already in use"
          : "Unable to create the cycle",
      );
    }

    return { cycleId: cycle.id, code: cycle.code };
  });

export const publishFarmCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, ["admin"]);
    const { error } = await context.supabase.rpc("publish_farm_cycle", { _cycle_id: data.cycleId });
    if (error) throw new Error("Unable to publish that cycle");
    return { ok: true };
  });

export const advanceCycleStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      status: z.enum(["open", "funded", "active", "harvested", "settled", "cancelled"]),
      stage: z.enum([
        "funding_open",
        "stocking",
        "operational",
        "harvest_weighin",
        "sale_settlement",
        "waterfall_distribution",
      ]),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, ["admin"]);
    const { error } = await context.supabase
      .from("farm_cycles")
      .update({ status: data.status, current_stage: data.stage })
      .eq("id", data.cycleId);
    if (error) throw new Error("Unable to move that cycle forward");
    return { ok: true };
  });

/* --- verification ---------------------------------------------------------- */

/**
 * Verify an offline bank transfer.
 *
 * This is the only path that credits equity from a human decision, which is
 * why it demands a bank reference, stamps who verified it and when, and writes
 * a receipt number the member can quote.
 */
export const verifyOfflineInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      investmentId: z.string().uuid(),
      bankReference: z.string().trim().min(4).max(64),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: investment } = await supabaseAdmin
      .from("cycle_investments")
      .select("*")
      .eq("id", data.investmentId)
      .maybeSingle();

    if (!investment) throw new Error("That contribution could not be found");
    if (investment.status === "success") throw new Error("That contribution is already verified");

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const { error } = await supabaseAdmin
      .from("cycle_investments")
      .update({
        status: "success",
        verified_at: new Date().toISOString(),
        verified_by: userId,
        bank_reference: data.bankReference,
        note: data.note ?? investment.note,
        receipt_number: `AGC/${investment.cycle_id.slice(0, 4).toUpperCase()}/${stamp}/${investment.id.slice(0, 6).toUpperCase()}`,
      })
      .eq("id", investment.id);

    if (error) throw new Error("Unable to verify that transfer");
    return { ok: true };
  });

export const rejectInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      investmentId: z.string().uuid(),
      reason: z.string().trim().min(4).max(400),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const { error } = await supabase
      .from("cycle_investments")
      .update({ status: "failed", note: data.reason })
      .eq("id", data.investmentId)
      .neq("status", "success");

    if (error) throw new Error("Unable to reject that contribution");
    return { ok: true };
  });

/* --- log review ------------------------------------------------------------ */

export const reviewOperationalLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      logId: z.string().uuid(),
      decision: z.enum(["approved", "flagged"]),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const { error } = await supabase
      .from("operational_logs")
      .update({
        review_status: data.decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.note ?? null,
      })
      .eq("id", data.logId);

    if (error) throw new Error("Unable to record that review");
    return { ok: true };
  });

/* --- settlement ------------------------------------------------------------ */

/** Bank the harvest revenue against the weigh-in. */
export const recordHarvestSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      harvestId: z.string().uuid(),
      grossRevenue: z.number().positive(),
      revenueReceivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      buyer: z.string().trim().max(120).optional(),
      receiptUrl: z.string().url().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const { error } = await supabase
      .from("harvest_records")
      .update({
        gross_revenue: data.grossRevenue,
        revenue_received_on: data.revenueReceivedOn,
        buyer: data.buyer ?? null,
        receipt_url: data.receiptUrl ?? null,
      })
      .eq("id", data.harvestId);

    if (error) throw new Error("Unable to record that sale");
    return { ok: true };
  });

/**
 * Run the waterfall. The maths lives in the database (run_cycle_waterfall) so
 * the settlement cannot be reproduced with different numbers in the browser,
 * and the function refuses to run twice for the same cycle.
 */
export const runSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      grossRevenue: z.number().nonnegative(),
      note: z.string().trim().max(600).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, ["admin"]);

    const { data: distribution, error } = await context.supabase.rpc("run_cycle_waterfall", {
      _cycle_id: data.cycleId,
      _gross_revenue: data.grossRevenue,
      _note: data.note ?? "",
    });

    if (error) {
      throw new Error(
        error.message.includes("already been settled")
          ? "This cycle has already been settled — void the existing run before settling again"
          : "The settlement could not be run",
      );
    }
    return {
      ok: true,
      distributionId: distribution?.id ?? null,
      netProfit: Number(distribution?.net_profit ?? 0),
    };
  });

/** Mark a member's settlement line as actually paid, with the transfer reference. */
export const markPayoutPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      lineId: z.string().uuid(),
      payoutReference: z.string().trim().min(3).max(80),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const { error } = await supabase
      .from("waterfall_lines")
      .update({
        payout_status: "paid",
        payout_reference: data.payoutReference,
        paid_at: new Date().toISOString(),
      })
      .eq("id", data.lineId);

    if (error) throw new Error("Unable to mark that payout as paid");
    return { ok: true };
  });

/** Every payout line for a settled cycle, so the treasury can disburse and mark paid. */
export const getSettlementLines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, ["admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lines, error } = await supabaseAdmin
      .from("waterfall_lines")
      .select("*")
      .eq("cycle_id", data.cycleId)
      .order("total_amount", { ascending: false });

    if (error) throw new Error("Unable to read the payout register for that cycle");

    const memberIds = Array.from(new Set((lines ?? []).map((row) => row.member_id)));
    const { data: profiles } = memberIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", memberIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((row) => [row.id, row.full_name ?? "Member"]));

    return (lines ?? []).map((row) => ({
      id: row.id,
      memberId: row.member_id,
      memberName: nameMap.get(row.member_id) ?? "Member",
      capital: Number(row.capital),
      equityPercent: Number(row.equity_percent),
      principal: Number(row.principal_amount),
      profit: Number(row.profit_amount),
      total: Number(row.total_amount),
      payoutStatus: row.payout_status,
      payoutReference: row.payout_reference,
      paidAt: row.paid_at,
    }));
  });

/* --- members, roles, transfers, visits, incidents -------------------------- */

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "operator", "member"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    if (data.userId === userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin access");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The guard against locking the co-operative out of its own admin account.
    if (data.role !== "admin") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin")
        .neq("user_id", data.userId);
      if (!count) throw new Error("The co-operative must keep at least one admin");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ role: data.role })
      .eq("user_id", data.userId);

    if (error) throw new Error("Unable to change that member's role");
    return { ok: true };
  });

export const settleShareTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ transferId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertRole(context.supabase, context.userId, ["admin"]);
    const { error } = await context.supabase.rpc("settle_share_transfer", {
      _transfer_id: data.transferId,
    });
    if (error) throw new Error("Unable to settle that transfer");
    return { ok: true };
  });

export const decideFarmVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      visitId: z.string().uuid(),
      decision: z.enum(["confirmed", "declined", "completed"]),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin", "operator"]);

    const { error } = await supabase
      .from("farm_visits")
      .update({
        status: data.decision,
        decision_note: data.note ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.visitId);

    if (error) throw new Error("Unable to record that decision");
    return { ok: true };
  });

export const resolveIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      incidentId: z.string().uuid(),
      status: z.enum(["open", "mitigating", "resolved"]),
      resolutionNote: z.string().trim().max(1000).optional(),
      insuranceClaimRef: z.string().trim().max(80).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    const { error } = await supabase
      .from("incidents")
      .update({
        status: data.status,
        resolution_note: data.resolutionNote ?? null,
        insurance_claim_ref: data.insuranceClaimRef ?? null,
        resolved_on: data.status === "resolved" ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", data.incidentId);

    if (error) throw new Error("Unable to update that incident");
    return { ok: true };
  });

/**
 * Apply every member's rollover instruction after a settlement.
 *
 * Only runs for members who asked for it, only into a cycle that is still open,
 * and only for the portion they chose. Each movement is recorded on the
 * destination cycle as a verified investment with the source cycle attached.
 */
export const applyRollovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      sourceCycleId: z.string().uuid(),
      destinationCycleId: z.string().uuid(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, ["admin"]);

    if (data.sourceCycleId === data.destinationCycleId) {
      throw new Error("A rollover must move capital into a different cycle");
    }

    const { data: destination } = await supabase
      .from("farm_cycles")
      .select("id, status, code")
      .eq("id", data.destinationCycleId)
      .maybeSingle();

    if (!destination || (destination.status !== "open" && destination.status !== "funded")) {
      throw new Error("The destination cycle must still be open");
    }

    const { data: lines } = await supabase
      .from("waterfall_lines")
      .select("member_id, capital, principal_amount, profit_amount")
      .eq("cycle_id", data.sourceCycleId);

    const { data: instructions } = await supabase
      .from("rollover_instructions")
      .select("member_id, mode, preferred_cycle_id")
      .neq("mode", "off");

    const instructionMap = new Map((instructions ?? []).map((row) => [row.member_id, row]));

    let moved = 0;
    const skipped: string[] = [];

    for (const line of lines ?? []) {
      const instruction = instructionMap.get(line.member_id);
      if (!instruction) continue;
      if (
        instruction.preferred_cycle_id &&
        instruction.preferred_cycle_id !== data.destinationCycleId
      ) {
        continue;
      }

      const principal = Number(line.principal_amount);
      const profit = Number(line.profit_amount);
      const amount =
        instruction.mode === "principal"
          ? principal
          : instruction.mode === "profit"
            ? profit
            : principal + profit;

      if (amount <= 0) {
        skipped.push(line.member_id);
        continue;
      }

      const { error } = await supabase.rpc("apply_rollover", {
        _source_cycle_id: data.sourceCycleId,
        _destination_cycle_id: data.destinationCycleId,
        _member_id: line.member_id,
        _amount: amount,
        _mode: instruction.mode,
      });

      if (error) {
        skipped.push(line.member_id);
        continue;
      }
      moved += 1;
    }

    return { moved, skipped: skipped.length, destination: destination.code };
  });
