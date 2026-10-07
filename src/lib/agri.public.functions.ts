import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/* ============================================================================
 * The public ledger surface — what a signed-out visitor is allowed to know.
 *
 * THE RULE: a public page may advertise a cycle; it may not publish the
 * business inside it. Before sign-in a visitor sees the produce, the photo, the
 * target, how much has been raised (rounded), the funding window and the
 * timeline. Everything else — what the cycle expects to earn, what it owes,
 * what it actually paid out, who supplied it, who bought the harvest, and what
 * any individual member put in — is fetched only for a signed-in member through
 * the authenticated portal functions in `agri.member.functions.ts`.
 *
 * This is enforced here, in the query, not in the markup:
 *
 *   1. every read below selects an explicit column list (never `select("*")`),
 *      so the server never even loads projected_revenue, projected_liabilities,
 *      expense rows, settlement lines or per-member capital;
 *   2. every row is mapped into a `Public*` type below, so a column added to a
 *      table later cannot leak into a public page by default;
 *   3. aggregates are rounded (`raisedPublic`) before they leave the server, so
 *      a member's contribution cannot be inferred by watching the figure move.
 *
 * `scripts/check-public-surface.mjs` fails the build if a forbidden column or
 * table appears in this file. Hiding things with CSS is not a safeguard.
 * ========================================================================== */

/**
 * The only columns of `farm_cycles` a public page may read. Anything not listed
 * here — projected revenue, projected liabilities, the costed plan, the creator
 * — is unavailable to the anonymous role from this application.
 */
const PUBLIC_CYCLE_COLUMNS = [
  "id",
  "code",
  "commodity",
  "name",
  "summary",
  "farm_site",
  "status",
  "current_stage",
  "target_capital",
  "minimum_ticket",
  "cycle_weeks",
  "funding_opens_on",
  "funding_closes_on",
  "stocking_on",
  "projected_harvest_on",
  "locked_at",
] as const;

const PUBLIC_CYCLE_SELECT = PUBLIC_CYCLE_COLUMNS.join(", ");

/** A cycle as the public is allowed to see it. */
export type PublicCycle = {
  id: string;
  code: string;
  /** Commodity id; the catalogue maps it to a name, photo and species tag. */
  commodity: string;
  name: string;
  summary: string | null;
  /** Region-level location only, e.g. "Tunga Magajiya, Niger State". */
  farmSite: string;
  status: string;
  currentStage: string;
  targetCapital: number;
  /**
   * Raised capital, rounded down to the nearest ₦10,000. The exact figure never
   * leaves the server on a public request.
   */
  raisedRounded: number;
  /** Whole-percent funding progress. */
  fundedPercent: number;
  /** The smallest amount a member may put in. A published term, not internals. */
  minimumTicket: number;
  cycleWeeks: number;
  fundingOpensOn: string | null;
  fundingClosesOn: string | null;
  projectedHarvestOn: string | null;
};

export type PublicCycleCard = PublicCycle & {
  /** Approved farm updates the public may read for this cycle. */
  publicUpdateCount: number;
};

export type PublicCycleList = {
  cycles: PublicCycleCard[];
  /** False when the ledger could not be reached — drives the honest banner. */
  ledgerReachable: boolean;
};

export type PublicMilestone = {
  id: string;
  cycleId: string | null;
  cycleCode: string | null;
  cycleName: string | null;
  commodity: string | null;
  logType: string | null;
  logDate: string | null;
  /** The operator's approved public line — never raw counts or invoices. */
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

export type PublicCycleDetail = {
  cycle: PublicCycle;
  milestones: PublicMilestone[];
  incidents: PublicIncident[];
  weather: PublicWeather[];
  /**
   * The weigh-in, published as weight only. The buyer, the scale ticket and the
   * money are members' business and stay in the portal.
   */
  harvest: { harvestDate: string; totalWeightKg: number | null } | null;
  /** The date members were paid, when the cycle has finished. No amounts. */
  paidOutOn: string | null;
};

async function anonClient() {
  const { supabasePublic } = await import("@/integrations/supabase/client.public.server");
  return supabasePublic;
}

type CyclePublicRow = Pick<
  Database["public"]["Tables"]["farm_cycles"]["Row"],
  (typeof PUBLIC_CYCLE_COLUMNS)[number]
>;

/** Map one whitelisted row into the public shape, rounding as it goes. */
function toPublicCycle(row: CyclePublicRow, exactRaised: number): PublicCycle {
  const target = Number(row.target_capital ?? 0);
  const raisedRounded = floorToPublicStep(exactRaised);
  const fundedPercent = target > 0 ? Math.min(100, Math.floor((raisedRounded / target) * 100)) : 0;

  return {
    id: row.id,
    code: row.code,
    commodity: row.commodity,
    name: row.name,
    summary: row.summary,
    farmSite: row.farm_site,
    status: row.status,
    currentStage: row.current_stage,
    targetCapital: target,
    raisedRounded,
    fundedPercent,
    minimumTicket: Number(row.minimum_ticket ?? 0),
    cycleWeeks: row.cycle_weeks,
    fundingOpensOn: row.funding_opens_on,
    fundingClosesOn: row.funding_closes_on,
    projectedHarvestOn: row.projected_harvest_on,
  };
}

/** ₦10,000 buckets: enough to be useful, too coarse to unmask one contributor. */
function floorToPublicStep(amount: number): number {
  return Math.floor(Math.max(0, amount) / 10_000) * 10_000;
}

function mapMilestone(
  row: Database["public"]["Views"]["public_milestones"]["Row"],
): PublicMilestone {
  return {
    id: row.id ?? "",
    cycleId: row.cycle_id,
    cycleCode: row.cycle_code,
    cycleName: row.cycle_name,
    commodity: row.commodity,
    logType: row.log_type,
    logDate: row.log_date,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

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
    // `estimated_impact` is a money figure and is deliberately not mapped.
    resolutionNote: row.resolution_note,
    resolvedOn: row.resolved_on,
  };
}

function mapWeather(row: Database["public"]["Tables"]["weather_snapshots"]["Row"]): PublicWeather {
  return {
    id: row.id,
    capturedOn: row.captured_on,
    rainfallMm: row.rainfall_mm === null ? null : Number(row.rainfall_mm),
    tempMinC: row.temp_min_c === null ? null : Number(row.temp_min_c),
    tempMaxC: row.temp_max_c === null ? null : Number(row.temp_max_c),
    humidityPercent: row.humidity_percent === null ? null : Number(row.humidity_percent),
    source: row.source,
    note: row.note,
  };
}

/** Every published cycle, with its public funding progress. */
export const listPublicCycles = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCycleList> => {
    const supabase = await anonClient();

    let cycles: CyclePublicRow[] = [];
    let funding: { cycle_id: string | null; raised_capital: number | null }[] = [];
    let updates: { cycle_id: string | null }[] = [];
    let reachable = true;

    try {
      const [cycleResult, fundingResult, updateResult] = await Promise.all([
        supabase
          .from("farm_cycles")
          .select(PUBLIC_CYCLE_SELECT)
          .not("locked_at", "is", null)
          .neq("status", "cancelled")
          .order("funding_opens_on", { ascending: false }),
        // The aggregate funding view is the only place a public request can
        // learn how much has been raised; the investment ledger itself is not
        // granted to the anonymous role at all.
        supabase.from("cycle_funding").select("cycle_id, raised_capital"),
        supabase.from("public_milestones").select("cycle_id"),
      ]);
      cycles = (cycleResult.data ?? []) as unknown as CyclePublicRow[];
      funding = fundingResult.data ?? [];
      updates = updateResult.data ?? [];
    } catch (error) {
      console.warn("[agricapital] the farm marketplace could not reach the ledger:", error);
      reachable = false;
    }

    const raisedByCycle = new Map<string, number>(
      (funding ?? []).map((row) => [row.cycle_id ?? "", Number(row.raised_capital ?? 0)]),
    );
    const updatesByCycle = new Map<string, number>();
    for (const row of updates ?? []) {
      const key = row.cycle_id ?? "";
      updatesByCycle.set(key, (updatesByCycle.get(key) ?? 0) + 1);
    }

    return {
      cycles: (cycles ?? []).map((row) => ({
        ...toPublicCycle(row, raisedByCycle.get(row.id) ?? 0),
        publicUpdateCount: updatesByCycle.get(row.id) ?? 0,
      })),
      ledgerReachable: reachable,
    };
  },
);

/**
 * One published cycle, as the public may see it.
 *
 * What is absent matters as much as what is present: no projected revenue, no
 * projected liabilities, no expense rows, no settlement breakdown, no buyer, no
 * named suppliers, no per-member capital, no investor count.
 */
export const getPublicCycle = createServerFn({ method: "GET" })
  .validator(z.object({ cycleId: z.string().uuid() }))
  .handler(async ({ data }): Promise<PublicCycleDetail | null> => {
    const supabase = await anonClient();

    let cycle: CyclePublicRow | null = null;
    try {
      const { data: row } = await supabase
        .from("farm_cycles")
        .select(PUBLIC_CYCLE_SELECT)
        .eq("id", data.cycleId)
        .maybeSingle();
      cycle = (row as CyclePublicRow | null) ?? null;
    } catch (error) {
      console.warn("[agricapital] this cycle could not be read from the ledger:", error);
      return null;
    }

    if (!cycle) return null;

    // Each panel is loaded independently: a cycle with no weigh-in yet still
    // renders its terms and its progress rail.
    const settled = await Promise.allSettled([
      supabase
        .from("cycle_funding")
        .select("raised_capital")
        .eq("cycle_id", cycle.id)
        .maybeSingle(),
      supabase.from("public_milestones").select("*").eq("cycle_id", cycle.id).limit(12),
      supabase
        .from("incidents")
        .select(
          "id, cycle_id, title, category, severity, status, occurred_on, description, resolution_note, resolved_on",
        )
        .eq("cycle_id", cycle.id)
        .order("occurred_on", { ascending: false }),
      supabase
        .from("weather_snapshots")
        .select("*")
        .eq("cycle_id", cycle.id)
        .order("captured_on", { ascending: false })
        .limit(14),
      // Weight only — the view's revenue, buyer and ticket columns are not
      // selected, so they cannot reach a signed-out browser.
      supabase
        .from("cycle_harvest")
        .select("harvest_date, total_weight_kg")
        .eq("cycle_id", cycle.id)
        .maybeSingle(),
      // The settlement *date* marks a finished cycle. Its amounts stay private.
      supabase.from("cycle_returns").select("executed_at").eq("cycle_id", cycle.id).maybeSingle(),
    ]);

    const pick = <T>(index: number): T | null => {
      const result = settled[index];
      if (!result || result.status !== "fulfilled") return null;
      return (result.value as { data: T | null }).data ?? null;
    };

    const funding = pick<{ raised_capital: number | null }>(0);
    const mils = pick<Database["public"]["Views"]["public_milestones"]["Row"][]>(1) ?? [];
    const incs = pick<PublicIncidentRow[]>(2) ?? [];
    const weather = pick<Database["public"]["Tables"]["weather_snapshots"]["Row"][]>(3) ?? [];
    const harvest = pick<{ harvest_date: string | null; total_weight_kg: number | null }>(4);
    const payout = pick<{ executed_at: string | null }>(5);

    return {
      cycle: toPublicCycle(cycle, Number(funding?.raised_capital ?? 0)),
      milestones: (mils ?? []).map(mapMilestone),
      incidents: (incs ?? []).map((row) =>
        mapIncident(row as Database["public"]["Tables"]["incidents"]["Row"]),
      ),
      weather: (weather ?? []).map(mapWeather),
      harvest: harvest
        ? {
            harvestDate: harvest.harvest_date ?? "—",
            totalWeightKg:
              harvest.total_weight_kg === null ? null : Number(harvest.total_weight_kg),
          }
        : null,
      paidOutOn: payout?.executed_at ?? null,
    };
  });

/** The incident columns the public register is allowed to read. */
type PublicIncidentRow = Pick<
  Database["public"]["Tables"]["incidents"]["Row"],
  | "id"
  | "cycle_id"
  | "title"
  | "category"
  | "severity"
  | "status"
  | "occurred_on"
  | "description"
  | "resolution_note"
  | "resolved_on"
>;

export type PlatformPulse = {
  /** False when the ledger could not be reached — drives the honest banner. */
  ledgerReachable: boolean;
  /** True when at least one cycle has been published. */
  hasPublishedCycles: boolean;
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
 * The trust numbers on the homepage.
 *
 * These are totals across the whole co-operative, which the platform publishes
 * on purpose: they are the evidence that money went out and came back. They are
 * counted from the ledger, never seeded — an empty co-operative honestly shows
 * zero, and the page then explains how the maths works instead of inventing a
 * track record.
 */
export const getPlatformPulse = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformPulse> => {
    const supabase = await anonClient();

    let reachable = true;
    let cycles: { id: string; status: string }[] = [];
    let mils: Database["public"]["Views"]["public_milestones"]["Row"][] = [];
    let incs: PublicIncidentRow[] = [];
    let funding: { cycle_id: string | null; raised_capital: number | null }[] = [];
    let returns: Database["public"]["Views"]["platform_returns"]["Row"] | null = null;
    let scale: Database["public"]["Views"]["platform_scale"]["Row"] | null = null;
    let stock: { population_count: number | null }[] = [];

    try {
      const [cycleRes, milRes, incRes, fundingRes, returnsRes] = await Promise.all([
        supabase.from("farm_cycles").select("id, status").not("locked_at", "is", null),
        supabase.from("public_milestones").select("*").limit(12),
        supabase
          .from("incidents")
          .select(
            "id, cycle_id, title, category, severity, status, occurred_on, description, resolution_note, resolved_on",
          )
          .order("occurred_on", { ascending: false })
          .limit(6),
        supabase.from("cycle_funding").select("cycle_id, raised_capital"),
        supabase.from("platform_returns").select("*").maybeSingle(),
      ]);

      const [scaleRes, stockRes] = await Promise.all([
        supabase.from("platform_scale").select("*").maybeSingle(),
        supabase.from("cycle_stock_level").select("population_count"),
      ]);

      cycles = cycleRes.data ?? [];
      mils = milRes.data ?? [];
      incs = (incRes.data ?? []) as PublicIncidentRow[];
      funding = fundingRes.data ?? [];
      returns = returnsRes.data ?? null;
      scale = scaleRes.data ?? null;
      stock = stockRes.data ?? [];
    } catch (error) {
      console.warn("[agricapital] the platform totals could not reach the ledger:", error);
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

    // Settlement totals come from the public aggregate view, so a cycle that
    // has not settled contributes nothing and the counters start at zero.
    const capitalReturned = Number(returns?.capital_returned ?? 0);
    const profitDistributed =
      Number(returns?.investor_profit_paid ?? 0) + Number(returns?.operator_fee_paid ?? 0);

    return {
      ledgerReachable: reachable,
      hasPublishedCycles: rows.length > 0,
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
      milestones: (mils ?? []).map(mapMilestone),
      incidents: (incs ?? []).map((row) =>
        mapIncident(row as Database["public"]["Tables"]["incidents"]["Row"]),
      ),
    };
  },
);

/** The transparency register on its own, for the homepage band. */
export const getTransparencyFeed = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMilestone[]> => {
    const supabase = await anonClient();
    let data: Database["public"]["Views"]["public_milestones"]["Row"][] = [];
    try {
      const result = await supabase.from("public_milestones").select("*").limit(20);
      data = result.data ?? [];
    } catch (error) {
      console.warn("[agricapital] the transparency register could not reach the ledger:", error);
      return [];
    }
    return (data ?? []).map(mapMilestone);
  },
);

/**
 * Live rainfall / temperature / humidity for a farm site, from Open-Meteo.
 *
 * A browser-side call to a keyless public API; it degrades to the operator's own
 * logged weather records when unavailable.
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
