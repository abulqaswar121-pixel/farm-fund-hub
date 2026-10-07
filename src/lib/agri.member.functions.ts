import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readRules, rulesChip, type CycleRules } from "@/lib/agri/rules";
import { resolveCallerRole, type AppRole } from "@/lib/agri/roles";
import type { Database } from "@/integrations/supabase/types";

type CycleRow = Database["public"]["Tables"]["farm_cycles"]["Row"];
type InvestmentRow = Database["public"]["Tables"]["cycle_investments"]["Row"];

export type MemberIdentity = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

export type MemberInvestment = {
  id: string;
  cycleId: string;
  cycleCode: string;
  cycleName: string;
  commodity: string;
  amount: number;
  date: string;
  method: string;
  status: string;
  reference: string | null;
  receiptNumber: string | null;
  rolloverFrom: string | null;
  note: string | null;
};

export type MemberPosition = {
  cycleId: string;
  code: string;
  name: string;
  commodity: string;
  status: string;
  currentStage: string;
  targetCapital: number;
  minimumTicket: number;
  raised: number;
  fundedPercent: number;
  myCapital: number;
  equityPercent: number;
  investorCount: number;
  rules: CycleRules;
  rulesChip: string;
  projectedHarvestOn: string | null;
  cycleWeeks: number;
  farmSite: string;
  /** Populated only once the cycle has settled. */
  settlement: {
    principal: number;
    profit: number;
    total: number;
    payoutStatus: string;
    paidAt: string | null;
    reference: string | null;
    netProfit: number;
    grossRevenue: number;
    principalAtRisk: boolean;
    executedAt: string;
  } | null;
};

export type MemberPayout = {
  id: string;
  cycleCode: string;
  cycleName: string;
  capital: number;
  equityPercent: number;
  principal: number;
  profit: number;
  total: number;
  payoutStatus: string;
  paidAt: string | null;
  reference: string | null;
};

export type MemberVisit = {
  id: string;
  cycleId: string | null;
  cycleCode: string | null;
  visitDate: string;
  slot: string;
  guests: number;
  status: string;
  memberNote: string | null;
  decisionNote: string | null;
};

export type MemberOffer = {
  id: string;
  cycleId: string;
  cycleCode: string;
  capitalAmount: number;
  askingPrice: number;
  status: string;
  createdAt: string;
  isMine: boolean;
  sellerLabel: string;
  reason: string | null;
};

export type OpenInvestment = {
  cycleId: string;
  code: string;
  name: string;
  commodity: string;
  minimumTicket: number;
  targetCapital: number;
  raised: number;
  fundedPercent: number;
  rulesChip: string;
  projectedHarvestOn: string | null;
  cycleWeeks: number;
};

export type MemberWorkspace = {
  identity: MemberIdentity;
  investments: MemberInvestment[];
  positions: MemberPosition[];
  payouts: MemberPayout[];
  visits: MemberVisit[];
  offers: MemberOffer[];
  board: MemberOffer[];
  /** Verified capital this member currently holds, per cycle — the ceiling on an offer. */
  heldByCycle: { cycleId: string; code: string; held: number }[];
  openCycles: OpenInvestment[];
  rollover: { mode: string; preferredCycleId: string | null; note: string | null } | null;
  /** Verified capital in cycles that have not yet settled. */
  totals: {
    invested: number;
    activeCapital: number;
    returned: number;
    profit: number;
    cycles: number;
  };
};

export const getMemberWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberWorkspace> => {
    const { supabase, userId } = context;

    const { data: authUser, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser.user) throw new Error("Unable to load the signed-in account");

    // Roles are read from user_roles, never from a profile column. A brand-new
    // account is provisioned here by the sign-up bootstrap.
    let role = await resolveCallerRole(supabase, userId);
    if (!role) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const fullName = authUser.user.user_metadata?.["full_name"] as string | undefined;
      const { error } = await supabaseAdmin.rpc("ensure_profile", {
        _user_id: userId,
        ...(fullName ? { _full_name: fullName } : {}),
      });
      if (error) throw new Error("Unable to finish setting up your account");
      role = (await resolveCallerRole(supabase, userId)) ?? "member";
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const identity: MemberIdentity = {
      id: userId,
      email: authUser.user.email ?? "",
      fullName:
        profile?.full_name ?? (authUser.user.user_metadata?.["full_name"] as string) ?? "Member",
      role,
    };

    // RLS returns only this member's rows, which is the whole point.
    const { data: investmentRows } = await supabase
      .from("cycle_investments")
      .select("*")
      .order("date", { ascending: false });

    const investments = investmentRows ?? [];
    const cycleIds = Array.from(new Set(investments.map((row) => row.cycle_id)));

    const { data: cycleRows } = cycleIds.length
      ? await supabase.from("farm_cycles").select("*").in("id", cycleIds)
      : { data: [] as CycleRow[] };

    const cycleMap = new Map<string, CycleRow>((cycleRows ?? []).map((row) => [row.id, row]));

    const { data: fundingRows } = cycleIds.length
      ? await supabase.from("cycle_funding").select("*").in("cycle_id", cycleIds)
      : { data: [] };
    const fundingMap = new Map((fundingRows ?? []).map((row) => [row.cycle_id ?? "", row]));

    const { data: lineRows } = await supabase
      .from("waterfall_lines")
      .select("*")
      .order("created_at", { ascending: false });

    const distributionIds = Array.from(new Set((lineRows ?? []).map((row) => row.distribution_id)));
    const { data: distributionRows } = distributionIds.length
      ? await supabase.from("waterfall_distributions").select("*").in("id", distributionIds)
      : { data: [] };
    const distributionMap = new Map((distributionRows ?? []).map((row) => [row.id, row]));

    // Live equity per cycle. The RPC derives it from the ledger on every call
    // and can only ever answer for the caller.
    const positions: MemberPosition[] = [];
    for (const cycleId of cycleIds) {
      const cycle = cycleMap.get(cycleId);
      if (!cycle) continue;

      const { data: positionRows } = await supabase.rpc("my_cycle_position", {
        _cycle_id: cycleId,
      });
      const position = positionRows?.[0];
      if (!position) continue;

      const line = (lineRows ?? []).find((row) => row.cycle_id === cycleId);
      const distribution = line ? distributionMap.get(line.distribution_id) : undefined;
      const rules = readRules(cycle);

      positions.push({
        cycleId,
        code: cycle.code,
        name: cycle.name,
        commodity: cycle.commodity,
        status: cycle.status,
        currentStage: cycle.current_stage,
        targetCapital: Number(cycle.target_capital),
        minimumTicket: Number(cycle.minimum_ticket),
        raised: Number(fundingMap.get(cycleId)?.raised_capital ?? position.cycle_capital ?? 0),
        fundedPercent: Number(
          fundingMap.get(cycleId)?.funded_percent ?? position.funded_percent ?? 0,
        ),
        myCapital: Number(position.member_capital ?? 0),
        equityPercent: Number(position.equity_percent ?? 0),
        investorCount: Number(position.investor_count ?? 0),
        rules,
        rulesChip: rulesChip(rules),
        projectedHarvestOn: cycle.projected_harvest_on,
        cycleWeeks: cycle.cycle_weeks,
        farmSite: cycle.farm_site,
        settlement: line
          ? {
              principal: Number(line.principal_amount),
              profit: Number(line.profit_amount),
              total: Number(line.total_amount),
              payoutStatus: line.payout_status,
              paidAt: line.paid_at,
              reference: line.payout_reference,
              netProfit: Number(distribution?.net_profit ?? 0),
              grossRevenue: Number(distribution?.gross_revenue ?? 0),
              principalAtRisk: Boolean(distribution?.principal_at_risk),
              executedAt: distribution?.executed_at ?? line.created_at,
            }
          : null,
      });
    }

    const payouts: MemberPayout[] = (lineRows ?? []).map((line) => {
      const cycle = cycleMap.get(line.cycle_id);
      return {
        id: line.id,
        cycleCode: cycle?.code ?? "—",
        cycleName: cycle?.name ?? "Settled cycle",
        capital: Number(line.capital),
        equityPercent: Number(line.equity_percent),
        principal: Number(line.principal_amount),
        profit: Number(line.profit_amount),
        total: Number(line.total_amount),
        payoutStatus: line.payout_status,
        paidAt: line.paid_at,
        reference: line.payout_reference,
      };
    });

    const { data: visitRows } = await supabase
      .from("farm_visits")
      .select("*")
      .order("visit_date", { ascending: false });

    const { data: rolloverRow } = await supabase
      .from("rollover_instructions")
      .select("*")
      .eq("member_id", userId)
      .maybeSingle();

    // The transfer board: RLS shows live offers plus anything of the caller's.
    const { data: transferRows } = await supabase
      .from("share_transfers")
      .select("*")
      .order("created_at", { ascending: false });

    const transferCycleIds = Array.from(new Set((transferRows ?? []).map((row) => row.cycle_id)));
    const transferCycles = transferCycleIds.length
      ? await supabase.from("farm_cycles").select("id, code").in("id", transferCycleIds)
      : { data: [] };
    const transferCycleMap = new Map((transferCycles.data ?? []).map((row) => [row.id, row.code]));

    // A member's own verified capital per cycle, so an offer can be checked
    // against what they actually hold before it is submitted.
    const heldByCycle = new Map<string, number>();
    for (const row of investments) {
      if (row.status !== "success") continue;
      const held = Number(row.amount) - Number(row.transferred_out ?? 0);
      heldByCycle.set(row.cycle_id, (heldByCycle.get(row.cycle_id) ?? 0) + held);
    }

    const allOffers: MemberOffer[] = (transferRows ?? []).map((row) => ({
      id: row.id,
      cycleId: row.cycle_id,
      cycleCode: transferCycleMap.get(row.cycle_id) ?? "—",
      capitalAmount: Number(row.capital_amount),
      askingPrice: Number(row.asking_price),
      status: row.status,
      createdAt: row.created_at,
      isMine: row.seller_id === userId,
      sellerLabel:
        row.seller_id === userId
          ? "Your offer"
          : `Member ${row.seller_id.slice(0, 6).toUpperCase()}`,
      reason: row.reason,
    }));

    // Cycles still accepting capital, for the "invest again" rail.
    const { data: openRows } = await supabase
      .from("farm_cycles")
      .select("*")
      .in("status", ["open", "funded"])
      .order("funding_opens_on", { ascending: false });

    const openIds = (openRows ?? []).map((row) => row.id);
    const openFunding = openIds.length
      ? await supabase.from("cycle_funding").select("*").in("cycle_id", openIds)
      : { data: [] };
    const openFundingMap = new Map(
      (openFunding.data ?? []).map((row) => [row.cycle_id ?? "", row]),
    );

    const verifiedInvestments = investments.filter((row) => row.status === "success");
    const settled: typeof investments = [];
    const unsettled: typeof investments = [];

    for (const row of verifiedInvestments) {
      const cycle = cycleMap.get(row.cycle_id);
      if (cycle?.status === "settled") settled.push(row);
      else unsettled.push(row);
    }

    return {
      identity,
      investments: investments.map((row) => mapInvestment(row, cycleMap)),
      positions: positions.sort((a, b) => a.code.localeCompare(b.code)),
      payouts,
      visits: (visitRows ?? []).map((row) => ({
        id: row.id,
        cycleId: row.cycle_id,
        cycleCode: row.cycle_id ? (cycleMap.get(row.cycle_id)?.code ?? null) : null,
        visitDate: row.visit_date,
        slot: row.slot,
        guests: row.guests,
        status: row.status,
        memberNote: row.member_note,
        decisionNote: row.decision_note,
      })),
      offers: allOffers.filter((offer) => offer.isMine),
      board: allOffers.filter((offer) => !offer.isMine && offer.status === "offered"),
      heldByCycle: Array.from(heldByCycle.entries())
        .filter(([, held]) => held > 0)
        .map(([cycleId, held]) => ({
          cycleId,
          code: cycleMap.get(cycleId)?.code ?? "—",
          held,
        })),
      openCycles: (openRows ?? []).map((cycle) => ({
        cycleId: cycle.id,
        code: cycle.code,
        name: cycle.name,
        commodity: cycle.commodity,
        minimumTicket: Number(cycle.minimum_ticket),
        targetCapital: Number(cycle.target_capital),
        raised: Number(openFundingMap.get(cycle.id)?.raised_capital ?? 0),
        fundedPercent: Number(openFundingMap.get(cycle.id)?.funded_percent ?? 0),
        rulesChip: rulesChip(readRules(cycle)),
        projectedHarvestOn: cycle.projected_harvest_on,
        cycleWeeks: cycle.cycle_weeks,
      })),
      rollover: rolloverRow
        ? {
            mode: rolloverRow.mode,
            preferredCycleId: rolloverRow.preferred_cycle_id,
            note: rolloverRow.note,
          }
        : null,
      totals: {
        invested: verifiedInvestments.reduce((sum, row) => sum + Number(row.amount), 0),
        activeCapital: unsettled.reduce((sum, row) => sum + Number(row.amount), 0),
        returned: payouts.reduce((sum, line) => sum + line.principal + line.profit, 0),
        profit: payouts.reduce((sum, line) => sum + line.profit, 0),
        cycles: cycleIds.length,
      },
    };
  });

function mapInvestment(row: InvestmentRow, cycleMap: Map<string, CycleRow>): MemberInvestment {
  const cycle = cycleMap.get(row.cycle_id);
  return {
    id: row.id,
    cycleId: row.cycle_id,
    cycleCode: cycle?.code ?? "—",
    cycleName: cycle?.name ?? "Farm cycle",
    commodity: cycle?.commodity ?? "—",
    amount: Number(row.amount),
    date: row.date,
    method: row.method,
    status: row.status,
    reference: row.paystack_reference ?? row.bank_reference,
    receiptNumber: row.receipt_number,
    rolloverFrom: row.rollover_source_cycle_id,
    note: row.note,
  };
}

export type TelemetryPoint = {
  logDate: string;
  logType: string;
  feedKg: number | null;
  mortalityCount: number | null;
  sampleAvgWeightG: number | null;
  biomassKg: number | null;
  populationCount: number | null;
  cratesCollected: number | null;
  bagsHarvested: number | null;
  notes: string | null;
  reviewStatus: string;
};

export type CycleTelemetry = {
  cycleCode: string;
  cycleName: string;
  commodity: string;
  currentStage: string;
  /** Target sampled weight, in grams, for the stock family. */
  targetWeightG: number | null;
  points: TelemetryPoint[];
  totals: {
    feedKg: number;
    mortality: number;
    samples: number;
    latestWeightG: number | null;
    latestPopulation: number | null;
    /** Feed conversion ratio — feed consumed per kilogram of biomass gained. */
    fcr: number | null;
    survivalPercent: number | null;
  };
};

/**
 * The growth telemetry behind the investor's live pond chart.
 *
 * Members can read every operational log for a cycle they are invested in.
 * Nothing is smoothed, interpolated or back-filled: the chart plots the sample
 * weights the operator actually recorded, against the cycle's target.
 */
export const getCycleTelemetry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ context, data }): Promise<CycleTelemetry> => {
    const { supabase } = context;

    const { data: cycle } = await supabase
      .from("farm_cycles")
      .select("*")
      .eq("id", data.cycleId)
      .maybeSingle();
    if (!cycle) throw new Error("That cycle could not be found");

    const { data: logs } = await supabase
      .from("operational_logs")
      .select("*")
      .eq("cycle_id", data.cycleId)
      .order("log_date", { ascending: true });

    const points: TelemetryPoint[] = (logs ?? []).map((row) => ({
      logDate: row.log_date,
      logType: row.log_type,
      feedKg: row.feed_kg === null ? null : Number(row.feed_kg),
      mortalityCount: row.mortality_count,
      sampleAvgWeightG: row.sample_avg_weight_g === null ? null : Number(row.sample_avg_weight_g),
      biomassKg: row.biomass_kg === null ? null : Number(row.biomass_kg),
      populationCount: row.population_count,
      cratesCollected: row.crates_collected === null ? null : Number(row.crates_collected),
      bagsHarvested: row.bags_harvested === null ? null : Number(row.bags_harvested),
      notes: row.notes,
      reviewStatus: row.review_status,
    }));

    const feedKg = points.reduce((sum, point) => sum + (point.feedKg ?? 0), 0);
    const mortality = points.reduce((sum, point) => sum + (point.mortalityCount ?? 0), 0);

    const weights = points.filter((point) => point.sampleAvgWeightG !== null);
    const latestWeightG = weights.at(-1)?.sampleAvgWeightG ?? null;

    const populations = points.filter((point) => point.populationCount !== null);
    const latestPopulation = populations.at(-1)?.populationCount ?? null;
    const firstPopulation = populations[0]?.populationCount ?? null;
    const survivalPercent =
      firstPopulation && firstPopulation > 0 && latestPopulation !== null
        ? (latestPopulation / firstPopulation) * 100
        : null;

    // FCR is only meaningful once at least two weight samples and feed exist.
    const biomassSeries = points.filter((point) => point.biomassKg !== null);
    const gain =
      biomassSeries.length >= 2
        ? Number(biomassSeries.at(-1)?.biomassKg) - Number(biomassSeries[0]?.biomassKg)
        : null;
    const fcr = gain && gain > 0 && feedKg > 0 ? feedKg / gain : null;

    // The target the operator is steering toward, per stock family.
    const targetByCommodity: Record<string, number | null> = {
      catfish: 1000,
      tilapia: 600,
      broiler: 2000,
      layer: null,
      grain: null,
      greenhouse: null,
    };

    return {
      cycleCode: cycle.code,
      cycleName: cycle.name,
      commodity: cycle.commodity,
      currentStage: cycle.current_stage,
      targetWeightG: targetByCommodity[cycle.commodity] ?? null,
      points,
      totals: {
        feedKg,
        mortality,
        samples: weights.length,
        latestWeightG,
        latestPopulation,
        fcr,
        survivalPercent,
      },
    };
  });

/* -------------------------------------------------------------------------- *
 * Funding a cycle
 * -------------------------------------------------------------------------- */

const startSchema = z.object({
  cycleId: z.string().uuid(),
  amount: z.number().positive().max(500_000_000),
});

/**
 * Begin a Paystack contribution.
 *
 * This records the *intent* — a pending row the member owns — and returns the
 * checkout details. Crucially it does NOT credit any equity: only the verified
 * webhook or an admin can move a row to 'success'.
 */
export const startContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(startSchema)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: cycle } = await supabase
      .from("farm_cycles")
      .select("*")
      .eq("id", data.cycleId)
      .maybeSingle();

    if (!cycle) throw new Error("That farm cycle could not be found");
    if (cycle.status !== "open") throw new Error("This cycle is no longer accepting capital");
    if (data.amount < Number(cycle.minimum_ticket)) {
      throw new Error(
        `The minimum entry ticket for ${cycle.code} is ${new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: "NGN",
          maximumFractionDigits: 0,
        }).format(Number(cycle.minimum_ticket))}`,
      );
    }

    const publishableKey = process.env["PAYSTACK_PUBLIC_KEY"];
    if (!publishableKey) throw new Error("Card payments are not configured yet");

    const { data: authUser } = await supabase.auth.getUser();
    const email = authUser.user?.email;
    if (!email) throw new Error("Your account has no email address on file");

    const reference = `AGC-${cycle.code}-${crypto.randomUUID()}`;

    const { data: investment, error } = await supabase
      .from("cycle_investments")
      .insert({
        cycle_id: cycle.id,
        member_id: userId,
        amount: data.amount,
        method: "paystack",
        status: "pending",
        paystack_reference: reference,
        recorded_by: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error("Unable to start this contribution");

    return {
      investmentId: investment.id,
      publicKey: publishableKey,
      email,
      amount: data.amount,
      reference,
      cycleCode: cycle.code,
    };
  });

/**
 * Confirm a Paystack charge server-side, then credit the ledger.
 *
 * The browser redirect is never trusted on its own: the reference is verified
 * against Paystack with the secret key, and the amount that comes back is the
 * amount that is credited.
 */
export const confirmContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ reference: z.string().min(6) }))
  .handler(async ({ context, data }) => {
    const secretKey = process.env["PAYSTACK_SECRET_KEY"];
    if (!secretKey) throw new Error("Card payments are not configured yet");

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!response.ok) throw new Error("We could not reach Paystack to verify that payment");

    const result = (await response.json()) as {
      status: boolean;
      data?: { status?: string; amount?: number; reference?: string };
    };

    if (
      !result.status ||
      result.data?.status !== "success" ||
      result.data.reference !== data.reference
    ) {
      throw new Error("That payment was not verified — no equity has been credited");
    }

    const { supabase } = context;
    const { data: investment } = await supabase
      .from("cycle_investments")
      .select("*")
      .eq("paystack_reference", data.reference)
      .maybeSingle();

    if (!investment) throw new Error("That payment does not belong to this account");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cycle_investments")
      .update({
        status: "success",
        amount: Number(result.data.amount ?? 0) / 100,
        verified_at: new Date().toISOString(),
        verified_by: investment.member_id,
        receipt_number: receiptFor(investment.cycle_id, investment.id),
      })
      .eq("id", investment.id)
      .neq("status", "success");

    if (error) throw new Error("The payment cleared but the ledger could not be updated");

    return { ok: true, reference: data.reference };
  });

/** Deterministic, human-quotable receipt number. */
function receiptFor(cycleId: string, investmentId: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `AGC/${cycleId.slice(0, 4).toUpperCase()}/${stamp}/${investmentId.slice(0, 6).toUpperCase()}`;
}

/**
 * Ask an admin to verify an offline bank transfer.
 *
 * The member supplies the teller reference; the row stays pending until a human
 * confirms the money actually landed. Equity is never credited on trust.
 */
export const requestBankTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      amount: z.number().positive().max(500_000_000),
      bankReference: z.string().trim().min(4).max(64),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const { data: cycle } = await supabase
      .from("farm_cycles")
      .select("id, code, minimum_ticket, status")
      .eq("id", data.cycleId)
      .maybeSingle();

    if (!cycle) throw new Error("That farm cycle could not be found");
    if (cycle.status !== "open") throw new Error("This cycle is no longer accepting capital");
    if (data.amount < Number(cycle.minimum_ticket)) {
      throw new Error("That is below the minimum entry ticket for this cycle");
    }

    const { error } = await supabase.from("cycle_investments").insert({
      cycle_id: cycle.id,
      member_id: userId,
      amount: data.amount,
      method: "manual",
      status: "pending",
      bank_reference: data.bankReference,
      note: data.note ?? null,
      recorded_by: userId,
    });

    if (error) throw new Error("Unable to submit that transfer for verification");
    return { ok: true };
  });

/* -------------------------------------------------------------------------- *
 * Rollover, share offers, visits
 * -------------------------------------------------------------------------- */

export const saveRolloverInstruction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      mode: z.enum(["off", "principal", "profit", "both"]),
      preferredCycleId: z.string().uuid().nullable().optional(),
      note: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("rollover_instructions").upsert(
      {
        member_id: userId,
        mode: data.mode,
        preferred_cycle_id: data.preferredCycleId ?? null,
        note: data.note ?? null,
      },
      { onConflict: "member_id" },
    );
    if (error) throw new Error("Unable to save your reinvestment preference");
    return { ok: true };
  });

export const createShareOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid(),
      capitalAmount: z.number().positive(),
      askingPrice: z.number().positive(),
      reason: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (data.askingPrice > data.capitalAmount) {
      throw new Error(
        "Offers on this board must be at par or below — the co-op does not allow a premium",
      );
    }
    const { error } = await context.supabase.from("share_transfers").insert({
      cycle_id: data.cycleId,
      seller_id: context.userId,
      capital_amount: data.capitalAmount,
      asking_price: data.askingPrice,
      status: "offered",
      reason: data.reason ?? null,
    });
    if (error) {
      // The database guard is what actually refuses over-offering equity.
      throw new Error(
        error.message.includes("cannot offer more equity")
          ? "You cannot offer more equity than you hold in that cycle"
          : "Unable to publish that offer",
      );
    }
    return { ok: true };
  });

export const withdrawShareOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ offerId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("share_transfers")
      .update({ status: "withdrawn" })
      .eq("id", data.offerId)
      .eq("seller_id", context.userId);
    if (error) throw new Error("Unable to withdraw that offer");
    return { ok: true };
  });

/**
 * A member claims an offer. Claiming is an expression of interest — the
 * transfer itself is only settled by an admin confirming the buyer's payment,
 * which is what moves equity in the ledger.
 */
export const claimShareOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ offerId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("share_transfers")
      .update({ status: "claimed", buyer_id: context.userId })
      .eq("id", data.offerId)
      .eq("status", "offered");
    if (error) throw new Error("Unable to claim that offer");
    return { ok: true };
  });

export const bookFarmVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      cycleId: z.string().uuid().nullable().optional(),
      visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.enum(["morning", "afternoon"]),
      guests: z.number().int().min(1).max(8),
      memberNote: z.string().trim().max(400).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const today = new Date().toISOString().slice(0, 10);
    if (data.visitDate < today) throw new Error("Choose a date in the future");

    const { error } = await context.supabase.from("farm_visits").insert({
      cycle_id: data.cycleId ?? null,
      member_id: context.userId,
      visit_date: data.visitDate,
      slot: data.slot,
      guests: data.guests,
      status: "requested",
      member_note: data.memberNote ?? null,
    });
    if (error) throw new Error("Unable to request that visit");
    return { ok: true };
  });

export const cancelFarmVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ visitId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("farm_visits")
      .update({ status: "cancelled" })
      .eq("id", data.visitId)
      .eq("member_id", context.userId);
    if (error) throw new Error("Unable to cancel that visit");
    return { ok: true };
  });
