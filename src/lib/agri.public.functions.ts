import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

type CycleRow = Database["public"]["Tables"]["farm_cycles"]["Row"];
type FundingRow = Database["public"]["Views"]["cycle_funding"]["Row"];

export type PublicCycleCard = {
  cycle: CycleRow;
  raised: number;
  fundedPercent: number;
  investorCount: number;
  /** Only ever the admin's costed plan — never a realised return. */
  projectedRevenue: number;
};

async function anonClient() {
  const { supabasePublic } = await import("@/integrations/supabase/client.public.server");
  return supabasePublic;
}

/**
 * Runs a public read and reports whether the ledger answered.
 *
 * The public pages deliberately render with real empty states instead of
 * throwing when the database is unreachable or before the first cycle is
 * published — an investor looking at an empty marketplace must see "no cycles
 * yet", never a stack trace.
 */
async function ledgerRead<T>(
  run: (supabase: Awaited<ReturnType<typeof anonClient>>) => PromiseLike<{ data: T | null }>,
  fallback: T,
  label: string,
): Promise<{ data: T; reachable: boolean }> {
  try {
    const supabase = await anonClient();
    const { data } = await run(supabase);
    return { data: data ?? fallback, reachable: true };
  } catch (error) {
    console.warn(`[agricapital] ${label} could not reach the ledger:`, error);
    return { data: fallback, reachable: false };
  }
}

export type PublicCycleList = {
  cycles: PublicCycleCard[];
  /** False when the ledger could not be reached — drives the honest banner. */
  ledgerReachable: boolean;
};

/** Every published cycle, with its public funding progress. */
export const listPublicCycles = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCycleList> => {
    const supabase = await anonClient();

    let cycles: CycleRow[] = [];
    let funding: FundingRow[] = [];
    let reachable = true;

    try {
      const [cycleResult, fundingResult] = await Promise.all([
        supabase
          .from("farm_cycles")
          .select("*")
          .not("locked_at", "is", null)
          .neq("status", "cancelled")
          .order("funding_opens_on", { ascending: false }),
        supabase.from("cycle_funding").select("*"),
      ]);
      cycles = cycleResult.data ?? [];
      funding = fundingResult.data ?? [];
    } catch (error) {
      console.warn("[agricapital] the farm marketplace could not reach the ledger:", error);
      reachable = false;
    }

    const fundingByCycle = new Map<string, FundingRow>(
      (funding ?? []).map((row) => [row.cycle_id ?? "", row]),
    );

    return {
      cycles: cycles.map((cycle) => {
        const progress = fundingByCycle.get(cycle.id);
        return {
          cycle,
          raised: Number(progress?.raised_capital ?? 0),
          fundedPercent: Number(progress?.funded_percent ?? 0),
          investorCount: Number(progress?.investor_count ?? 0),
          projectedRevenue: Number(cycle.projected_revenue),
        };
      }),
      ledgerReachable: reachable,
    };
  },
);

export type PublicMilestone = {
  id: string;
  cycleId: string | null;
  cycleCode: string | null;
  cycleName: string | null;
  commodity: string | null;
  logType: string | null;
  logDate: string | null;
  summary: string | null;
  createdAt: string | null;
};

export type PublicIncident = {
  id: string;
  cycleId: string | null;
  title: string;
  category: string;
  severity: string;
  status: string;
  occurredOn: string;
  description: string;
  insuranceClaimRef: string | null;
  resolutionNote: string | null;
  resolvedOn: string | null;
};

export type PublicWeather = {
  id: string;
  capturedOn: string;
  rainfallMm: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  humidityPercent: number | null;
  source: string;
  note: string | null;
};

export type PlatformPulse = {
  /** False when the ledger could not be reached — drives the honest banner. */
  ledgerReachable: boolean;
  activeCycles: number;
  openCycles: number;
  settledCycles: number;
  capitalDeployed: number;
  capitalReturned: number;
  profitDistributed: number;
  membersCount: number;
  livestockOnFarm: number;
  milestones: PublicMilestone[];
  incidents: PublicIncident[];
};

/**
 * Real-time ecosystem counters for the hero band.
 *
 * Everything here is counted from the ledger. Where the co-operative has not
 * yet run a cycle, the counters are honestly zero rather than seeded with an
 * illustration figure.
 */
export const getPlatformPulse = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformPulse> => {
    const supabase = await anonClient();

    let reachable = true;
    let cycles: { id: string; status: string }[] = [];
    let mils: Database["public"]["Views"]["public_milestones"]["Row"][] = [];
    let incs: Database["public"]["Tables"]["incidents"]["Row"][] = [];
    let funding: {
      cycle_id: string | null;
      raised_capital: number | null;
      investor_count: number | null;
    }[] = [];
    let returns: Database["public"]["Views"]["platform_returns"]["Row"] | null = null;
    let scale: Database["public"]["Views"]["platform_scale"]["Row"] | null = null;
    let stock: { population_count: number | null }[] = [];

    try {
      const [cycleRes, milRes, incRes, fundingRes, returnsRes] = await Promise.all([
        supabase.from("farm_cycles").select("id, status").not("locked_at", "is", null),
        supabase.from("public_milestones").select("*").limit(12),
        supabase.from("incidents").select("*").order("occurred_on", { ascending: false }).limit(6),
        supabase.from("cycle_funding").select("cycle_id, raised_capital, investor_count"),
        supabase.from("platform_returns").select("*").maybeSingle(),
      ]);

      const [scaleRes, stockRes] = await Promise.all([
        supabase.from("platform_scale").select("*").maybeSingle(),
        supabase.from("cycle_stock_level").select("population_count"),
      ]);

      cycles = cycleRes.data ?? [];
      mils = milRes.data ?? [];
      incs = incRes.data ?? [];
      funding = fundingRes.data ?? [];
      returns = returnsRes.data ?? null;
      scale = scaleRes.data ?? null;
      stock = stockRes.data ?? [];
    } catch (error) {
      console.warn("[agricapital] platform pulse could not reach the ledger:", error);
      reachable = false;
    }

    const rows = cycles ?? [];
    const activeCycles = rows.filter((row) => row.status === "active").length;
    const openCycles = rows.filter(
      (row) => row.status === "open" || row.status === "funded",
    ).length;
    const settledCycles = rows.filter((row) => row.status === "settled").length;

    const capitalDeployed = (funding ?? []).reduce(
      (sum, row) => sum + Number(row.raised_capital ?? 0),
      0,
    );

    // Settlement figures come from the public aggregate view, so a cycle that
    // has not settled contributes nothing and the counters start honestly at 0.
    const capitalReturned = Number(returns?.capital_returned ?? 0);
    const profitDistributed =
      Number(returns?.investor_profit_paid ?? 0) + Number(returns?.operator_fee_paid ?? 0);

    return {
      ledgerReachable: reachable,
      activeCycles,
      openCycles,
      settledCycles,
      capitalDeployed,
      capitalReturned,
      profitDistributed,
      membersCount: Number(scale?.members ?? 0),
      livestockOnFarm: (stock ?? []).reduce(
        (sum, row) => sum + Number(row.population_count ?? 0),
        0,
      ),
      milestones: (mils ?? []).map((row) => ({
        id: row.id ?? "",
        cycleId: row.cycle_id,
        cycleCode: row.cycle_code,
        cycleName: row.cycle_name,
        commodity: row.commodity,
        logType: row.log_type,
        logDate: row.log_date,
        summary: row.summary,
        createdAt: row.created_at,
      })),
      incidents: (incs ?? []).map(mapIncident),
    };
  },
);

function mapIncident(row: Database["public"]["Tables"]["incidents"]["Row"]): PublicIncident {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    title: row.title,
    category: row.category,
    severity: row.severity,
    status: row.status,
    occurredOn: row.occurred_on,
    description: row.description,
    insuranceClaimRef: row.insurance_claim_ref,
    resolutionNote: row.resolution_note,
    resolvedOn: row.resolved_on,
  };
}

export type PublicCycleDetail = {
  cycle: CycleRow;
  raised: number;
  fundedPercent: number;
  investorCount: number;
  milestones: PublicMilestone[];
  incidents: PublicIncident[];
  weather: PublicWeather[];
  harvest: {
    harvestDate: string;
    totalWeightKg: number | null;
    totalCount: number | null;
    scaleTicketRef: string | null;
    buyer: string | null;
    grossRevenue: number;
  } | null;
  settlement: {
    grossRevenue: number;
    capitalRaised: number;
    liabilitiesPaid: number;
    principalReturned: number;
    reserveSetAside: number;
    netProfit: number;
    investorProfitPool: number;
    operatorFee: number;
    investorPercent: number;
    operatorPercent: number;
    reservePercent: number;
    principalAtRisk: boolean;
    executedAt: string;
  } | null;
};

export const getPublicCycle = createServerFn({ method: "GET" })
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ data }): Promise<PublicCycleDetail | null> => {
    const supabase = await anonClient();

    let cycle: CycleRow | null = null;
    try {
      const { data: row } = await supabase
        .from("farm_cycles")
        .select("*")
        .eq("id", data.cycleId)
        .maybeSingle();
      cycle = row ?? null;
    } catch (error) {
      console.warn("[agricapital] this cycle could not be read from the ledger:", error);
      return null;
    }

    if (!cycle) return null;

    // Each panel of the cycle page is loaded independently and may be absent —
    // a cycle with no harvested records still renders its terms and stage rail.
    const settled = await Promise.allSettled([
      supabase.from("cycle_funding").select("*").eq("cycle_id", cycle.id).maybeSingle(),
      supabase.from("public_milestones").select("*").eq("cycle_id", cycle.id).limit(30),
      supabase.from("incidents").select("*").eq("cycle_id", cycle.id).order("occurred_on", {
        ascending: false,
      }),
      supabase
        .from("weather_snapshots")
        .select("*")
        .eq("cycle_id", cycle.id)
        .order("captured_on", { ascending: false })
        .limit(30),
      supabase.from("cycle_harvest").select("*").eq("cycle_id", cycle.id).maybeSingle(),
      supabase.from("cycle_returns").select("*").eq("cycle_id", cycle.id).maybeSingle(),
    ]);

    const pick = <T>(index: number): T | null => {
      const result = settled[index];
      if (!result || result.status !== "fulfilled") return null;
      return (result.value as { data: T | null }).data ?? null;
    };

    const funding = pick<FundingRow>(0);
    const mils = pick<Database["public"]["Views"]["public_milestones"]["Row"][]>(1) ?? [];
    const incs = pick<Database["public"]["Tables"]["incidents"]["Row"][]>(2) ?? [];
    const weather = pick<Database["public"]["Tables"]["weather_snapshots"]["Row"][]>(3) ?? [];
    const harvest = pick<Database["public"]["Views"]["cycle_harvest"]["Row"]>(4);
    const settlement = pick<Database["public"]["Views"]["cycle_returns"]["Row"]>(5);

    return {
      cycle,
      raised: Number(funding?.raised_capital ?? 0),
      fundedPercent: Number(funding?.funded_percent ?? 0),
      investorCount: Number(funding?.investor_count ?? 0),
      milestones: (mils ?? []).map((row) => ({
        id: row.id ?? "",
        cycleId: row.cycle_id,
        cycleCode: row.cycle_code,
        cycleName: row.cycle_name,
        commodity: row.commodity,
        logType: row.log_type,
        logDate: row.log_date,
        summary: row.summary,
        createdAt: row.created_at,
      })),
      incidents: (incs ?? []).map(mapIncident),
      weather: (weather ?? []).map((row) => ({
        id: row.id,
        capturedOn: row.captured_on,
        rainfallMm: row.rainfall_mm === null ? null : Number(row.rainfall_mm),
        tempMinC: row.temp_min_c === null ? null : Number(row.temp_min_c),
        tempMaxC: row.temp_max_c === null ? null : Number(row.temp_max_c),
        humidityPercent: row.humidity_percent === null ? null : Number(row.humidity_percent),
        source: row.source,
        note: row.note,
      })),
      harvest: harvest
        ? {
            harvestDate: harvest.harvest_date ?? "—",
            totalWeightKg:
              harvest.total_weight_kg === null ? null : Number(harvest.total_weight_kg),
            totalCount: harvest.total_count,
            scaleTicketRef: harvest.scale_ticket_ref,
            buyer: harvest.buyer,
            grossRevenue: Number(harvest.gross_revenue),
          }
        : null,
      settlement: settlement
        ? {
            grossRevenue: Number(settlement.gross_revenue),
            capitalRaised: Number(settlement.capital_raised),
            liabilitiesPaid: Number(settlement.liabilities_paid),
            principalReturned: Number(settlement.principal_returned),
            reserveSetAside: Number(settlement.reserve_set_aside),
            netProfit: Number(settlement.net_profit),
            investorProfitPool: Number(settlement.investor_profit_pool),
            operatorFee: Number(settlement.operator_fee),
            investorPercent: Number(settlement.profit_investor_percent),
            operatorPercent: Number(settlement.profit_operator_percent),
            reservePercent: Number(settlement.reserve_percent),
            principalAtRisk: Boolean(settlement.principal_at_risk),
            executedAt: settlement.executed_at ?? "—",
          }
        : null,
    };
  });

/** The transparency feed on its own, for the public home page band. */
export const getTransparencyFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMilestone[]> => {
    const supabase = await anonClient();
    let data: Database["public"]["Views"]["public_milestones"]["Row"][] = [];
    try {
      const result = await supabase.from("public_milestones").select("*").limit(20);
      data = result.data ?? [];
    } catch (error) {
      console.warn("[agricapital] the transparency feed could not reach the ledger:", error);
      return [];
    }
    return (data ?? []).map((row) => ({
      id: row.id ?? "",
      cycleId: row.cycle_id,
      cycleCode: row.cycle_code,
      cycleName: row.cycle_name,
      commodity: row.commodity,
      logType: row.log_type,
      logDate: row.log_date,
      summary: row.summary,
      createdAt: row.created_at,
    }));
  },
);

/**
 * Live rainfall / temperature / humidity for a cycle's farm site, from
 * Open-Meteo. This is a browser-side call to a keyless public API; it degrades
 * to the operator's own logged weather records when unavailable.
 */
export async function fetchLocalClimate(latitude: number, longitude: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean` +
    `&timezone=Africa%2FLagos&forecast_days=7`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Weather service unavailable");
  return (await response.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      precipitation?: number;
    };
    daily?: {
      time?: string[];
      precipitation_sum?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      relative_humidity_2m_mean?: number[];
    };
  };
}

/** Exposed for the calculator so the client can show the same maths the server runs. */
export const getCycleForProjection = createServerFn({ method: "GET" })
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const supabase = await anonClient();

    try {
      const { data: cycle } = await supabase
        .from("farm_cycles")
        .select("*")
        .eq("id", data.cycleId)
        .maybeSingle();
      if (!cycle) return null;

      // The public funding figure comes from the aggregate view — the anon role
      // has no grant on the investment ledger at all.
      const { data: funding } = await supabase
        .from("cycle_funding")
        .select("raised_capital")
        .eq("cycle_id", data.cycleId)
        .maybeSingle();

      return { cycle, raised: Number(funding?.raised_capital ?? 0) };
    } catch (error) {
      console.warn("[agricapital] projection source unavailable:", error);
      return null;
    }
  });
