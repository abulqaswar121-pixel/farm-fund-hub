/**
 * Regenerates the Supabase table typings for the NDH AgriCapital schema.
 *
 * The live generator (`supabase gen types`) needs a database connection, which
 * is not always available from a build agent. This script reproduces the same
 * output shape from the schema declared in supabase/migrations, so types.ts
 * stays reviewable in a pull request.
 *
 * Run: node scripts/generate-agri-types.mjs
 *
 * Note: `Relationships` is intentionally empty for the AgriCapital tables. The
 * server code loads related rows with an explicit second query rather than an
 * embedded PostgREST resource, so no relationship metadata is needed and none
 * is guessed here.
 */
import { readFileSync, writeFileSync } from "node:fs";

/** name, ts type, and whether an INSERT must supply it. */
const T = (name, type, insertRequired = false) => ({ name, type, insertRequired });

const TABLES = {
  // Created by the original auth migration, still the source of truth for
  // member names and access levels. Roles live here and are never on profiles.
  profiles: [
    T("id", "string", true),
    T("full_name", "string | null"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  user_roles: [
    T("id", "string"),
    T("user_id", "string", true),
    T("role", 'Database["public"]["Enums"]["app_role"]', true),
    T("created_at", "string"),
  ],
  farm_cycles: [
    T("id", "string"),
    T("code", "string", true),
    T("commodity", 'Database["public"]["Enums"]["commodity_type"]', true),
    T("name", "string", true),
    T("summary", "string | null"),
    T("farm_site", "string"),
    T("farm_latitude", "number | null"),
    T("farm_longitude", "number | null"),
    T("target_capital", "number", true),
    T("minimum_ticket", "number"),
    T("projected_revenue", "number"),
    T("projected_liabilities", "number"),
    T("profit_investor_percent", "number"),
    T("profit_operator_percent", "number"),
    T("reserve_percent", "number"),
    T("cycle_weeks", "number"),
    T("funding_opens_on", "string"),
    T("funding_closes_on", "string | null"),
    T("stocking_on", "string | null"),
    T("projected_harvest_on", "string | null"),
    T("status", 'Database["public"]["Enums"]["cycle_status"]'),
    T("current_stage", 'Database["public"]["Enums"]["stage_id"]'),
    T("locked_at", "string | null"),
    T("created_by", "string", true),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  cycle_investments: [
    T("id", "string"),
    T("cycle_id", "string", true),
    T("member_id", "string", true),
    T("amount", "number", true),
    T("date", "string"),
    T("method", 'Database["public"]["Enums"]["investment_method"]', true),
    T("status", 'Database["public"]["Enums"]["investment_status"]'),
    T("paystack_reference", "string | null"),
    T("bank_reference", "string | null"),
    T("receipt_number", "string | null"),
    T("verified_at", "string | null"),
    T("verified_by", "string | null"),
    T("rollover_source_cycle_id", "string | null"),
    T("transferred_out", "number"),
    T("transfer_id", "string | null"),
    T("note", "string | null"),
    T("recorded_by", "string | null"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  operational_logs: [
    T("id", "string"),
    T("cycle_id", "string", true),
    T("log_type", 'Database["public"]["Enums"]["log_type"]', true),
    T("log_date", "string"),
    T("feed_kg", "number | null"),
    T("feed_bags", "number | null"),
    T("mortality_count", "number | null"),
    T("mortality_reason", "string | null"),
    T("population_count", "number | null"),
    T("sample_count", "number | null"),
    T("sample_avg_weight_g", "number | null"),
    T("biomass_kg", "number | null"),
    T("crates_collected", "number | null"),
    T("bags_harvested", "number | null"),
    T("area_sqm", "number | null"),
    T("medication", "string | null"),
    T("notes", "string | null"),
    T("public_summary", "string | null"),
    T("photo_url", "string | null"),
    T("recorded_by", "string", true),
    T("review_status", 'Database["public"]["Enums"]["review_status"]'),
    T("reviewed_by", "string | null"),
    T("reviewed_at", "string | null"),
    T("review_note", "string | null"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  farm_expenses: [
    T("id", "string"),
    T("cycle_id", "string", true),
    T("amount", "number", true),
    T("date", "string"),
    T("category", "string", true),
    T("vendor", "string | null"),
    T("note", "string | null"),
    T("is_payable", "boolean"),
    T("settled_on", "string | null"),
    T("receipt_url", "string | null"),
    T("recorded_by", "string", true),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  harvest_records: [
    T("id", "string"),
    T("cycle_id", "string", true),
    T("harvest_date", "string"),
    T("total_weight_kg", "number | null"),
    T("total_count", "number | null"),
    T("scale_ticket_ref", "string | null"),
    T("buyer", "string | null"),
    T("buyer_note", "string | null"),
    T("gross_revenue", "number"),
    T("revenue_received_on", "string | null"),
    T("receipt_url", "string | null"),
    T("recorded_by", "string", true),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  waterfall_distributions: [
    T("id", "string"),
    T("cycle_id", "string", true),
    T("status", 'Database["public"]["Enums"]["distribution_status"]'),
    T("gross_revenue", "number"),
    T("capital_raised", "number"),
    T("operational_liabilities", "number"),
    T("profit_investor_percent", "number", true),
    T("profit_operator_percent", "number", true),
    T("reserve_percent", "number", true),
    T("liabilities_paid", "number"),
    T("principal_returned", "number"),
    T("reserve_set_aside", "number"),
    T("net_profit", "number"),
    T("investor_profit_pool", "number"),
    T("operator_fee", "number"),
    T("total_paid_out", "number"),
    T("principal_at_risk", "boolean"),
    T("note", "string | null"),
    T("run_by", "string", true),
    T("executed_at", "string"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  waterfall_lines: [
    T("id", "string"),
    T("distribution_id", "string", true),
    T("cycle_id", "string", true),
    T("member_id", "string", true),
    T("capital", "number"),
    T("equity_percent", "number"),
    T("principal_amount", "number"),
    T("profit_amount", "number"),
    T("total_amount", "number"),
    T("payout_status", 'Database["public"]["Enums"]["payout_status"]'),
    T("payout_reference", "string | null"),
    T("paid_at", "string | null"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  rollover_instructions: [
    T("id", "string"),
    T("member_id", "string", true),
    T("mode", 'Database["public"]["Enums"]["rollover_mode"]'),
    T("preferred_cycle_id", "string | null"),
    T("note", "string | null"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  share_transfers: [
    T("id", "string"),
    T("cycle_id", "string", true),
    T("seller_id", "string", true),
    T("buyer_id", "string | null"),
    T("capital_amount", "number", true),
    T("asking_price", "number", true),
    T("status", 'Database["public"]["Enums"]["transfer_status"]'),
    T("reason", "string | null"),
    T("admin_note", "string | null"),
    T("settled_at", "string | null"),
    T("settled_by", "string | null"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  farm_visits: [
    T("id", "string"),
    T("cycle_id", "string | null"),
    T("member_id", "string", true),
    T("visit_date", "string", true),
    T("slot", "string"),
    T("guests", "number"),
    T("status", 'Database["public"]["Enums"]["visit_status"]'),
    T("member_note", "string | null"),
    T("decision_note", "string | null"),
    T("decided_by", "string | null"),
    T("decided_at", "string | null"),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  incidents: [
    T("id", "string"),
    T("cycle_id", "string | null"),
    T("title", "string", true),
    T("category", "string", true),
    T("severity", 'Database["public"]["Enums"]["incident_severity"]'),
    T("status", 'Database["public"]["Enums"]["incident_status"]'),
    T("occurred_on", "string"),
    T("description", "string", true),
    T("estimated_impact", "number | null"),
    T("insurance_claim_ref", "string | null"),
    T("photo_url", "string | null"),
    T("resolution_note", "string | null"),
    T("resolved_on", "string | null"),
    T("logged_by", "string", true),
    T("created_at", "string"),
    T("updated_at", "string"),
  ],
  weather_snapshots: [
    T("id", "string"),
    T("cycle_id", "string | null"),
    T("captured_on", "string"),
    T("rainfall_mm", "number | null"),
    T("temp_min_c", "number | null"),
    T("temp_max_c", "number | null"),
    T("humidity_percent", "number | null"),
    T("source", "string"),
    T("note", "string | null"),
    T("recorded_by", "string | null"),
    T("created_at", "string"),
  ],
};

const VIEWS = {
  cycle_funding: [
    T("cycle_id", "string | null"),
    T("code", "string | null"),
    T("target_capital", "number | null"),
    T("minimum_ticket", "number | null"),
    T("raised_capital", "number | null"),
    T("investor_count", "number | null"),
    T("funded_percent", "number | null"),
  ],
  cycle_returns: [
    T("cycle_id", "string | null"),
    T("gross_revenue", "number | null"),
    T("capital_raised", "number | null"),
    T("operational_liabilities", "number | null"),
    T("liabilities_paid", "number | null"),
    T("principal_returned", "number | null"),
    T("reserve_set_aside", "number | null"),
    T("net_profit", "number | null"),
    T("investor_profit_pool", "number | null"),
    T("operator_fee", "number | null"),
    T("profit_investor_percent", "number | null"),
    T("profit_operator_percent", "number | null"),
    T("reserve_percent", "number | null"),
    T("principal_at_risk", "boolean | null"),
    T("total_paid_out", "number | null"),
    T("executed_at", "string | null"),
  ],
  platform_returns: [
    T("settled_cycles", "number | null"),
    T("capital_settled", "number | null"),
    T("capital_returned", "number | null"),
    T("investor_profit_paid", "number | null"),
    T("operator_fee_paid", "number | null"),
    T("net_profit_total", "number | null"),
  ],
  cycle_harvest: [
    T("cycle_id", "string | null"),
    T("harvest_date", "string | null"),
    T("total_weight_kg", "number | null"),
    T("total_count", "number | null"),
    T("scale_ticket_ref", "string | null"),
    T("buyer", "string | null"),
    T("buyer_note", "string | null"),
    T("gross_revenue", "number | null"),
    T("revenue_received_on", "string | null"),
  ],
  platform_scale: [
    T("members", "number | null"),
    T("cycles_total", "number | null"),
    T("cycles_active", "number | null"),
  ],
  cycle_stock_level: [
    T("cycle_id", "string | null"),
    T("code", "string | null"),
    T("name", "string | null"),
    T("commodity", 'Database["public"]["Enums"]["commodity_type"] | null'),
    T("log_date", "string | null"),
    T("population_count", "number | null"),
    T("biomass_kg", "number | null"),
    T("sample_avg_weight_g", "number | null"),
    T("crates_collected", "number | null"),
    T("bags_harvested", "number | null"),
  ],
  public_milestones: [
    T("id", "string | null"),
    T("cycle_id", "string | null"),
    T("cycle_code", "string | null"),
    T("cycle_name", "string | null"),
    T("commodity", 'Database["public"]["Enums"]["commodity_type"] | null'),
    T("log_type", 'Database["public"]["Enums"]["log_type"] | null'),
    T("log_date", "string | null"),
    T("summary", "string | null"),
    T("created_at", "string | null"),
  ],
};

const FUNCTIONS = {
  has_role: {
    args: { _role: 'Database["public"]["Enums"]["app_role"]', _user_id: "string" },
    returns: "boolean",
  },
  ensure_profile: {
    args: { _full_name: "string", _user_id: "string" },
    returns: 'Database["public"]["Enums"]["app_role"]',
  },
  my_cycle_position: {
    args: { _cycle_id: "string" },
    returns:
      "{ member_capital: number; cycle_capital: number; equity_percent: number; funded_percent: number; investor_count: number }[]",
  },
  cycle_position_book: {
    args: { _cycle_id: "string" },
    returns:
      "{ member_id: string; full_name: string; member_capital: number; equity_percent: number }[]",
  },
  run_cycle_waterfall: {
    args: { _cycle_id: "string", _gross_revenue: "number", _note: "string" },
    returns: 'Database["public"]["Tables"]["waterfall_distributions"]["Row"]',
  },
  settle_share_transfer: {
    args: { _transfer_id: "string" },
    returns: 'Database["public"]["Tables"]["share_transfers"]["Row"]',
  },
  publish_farm_cycle: {
    args: { _cycle_id: "string" },
    returns: 'Database["public"]["Tables"]["farm_cycles"]["Row"]',
  },
  apply_rollover: {
    args: {
      _amount: "number",
      _destination_cycle_id: "string",
      _member_id: "string",
      _mode: 'Database["public"]["Enums"]["rollover_mode"]',
      _source_cycle_id: "string",
    },
    returns: 'Database["public"]["Tables"]["cycle_investments"]["Row"]',
  },
};

const ENUMS = {
  app_role: '"admin" | "operator" | "member" | "contributor"',
  payment_method: '"paystack" | "manual"',
  payment_status: '"pending" | "success" | "failed"',
  commodity_type: '"catfish" | "broiler" | "layer" | "grain" | "greenhouse"',
  cycle_status: '"draft" | "open" | "funded" | "active" | "harvested" | "settled" | "cancelled"',
  stage_id:
    '"funding_open" | "stocking" | "operational" | "harvest_weighin" | "sale_settlement" | "waterfall_distribution"',
  investment_method: '"paystack" | "manual" | "rollover"',
  investment_status: '"pending" | "success" | "failed"',
  log_type: '"feed" | "growth_sample" | "mortality" | "medication" | "general" | "harvest" | "sale"',
  review_status: '"pending" | "approved" | "flagged"',
  transfer_status: '"offered" | "claimed" | "settled" | "withdrawn"',
  visit_status: '"requested" | "confirmed" | "declined" | "completed" | "cancelled"',
  incident_severity: '"low" | "moderate" | "serious" | "critical"',
  incident_status: '"open" | "mitigating" | "resolved"',
  distribution_status: '"draft" | "executed" | "paid"',
  payout_status: '"pending" | "paid" | "withheld"',
  rollover_mode: '"off" | "principal" | "profit" | "both"',
};

function block(name, columns, { view = false } = {}) {
  const row = columns.map((c) => `          ${c.name}: ${c.type}`).join("\n");
  const lines = [`      ${name}: {`, "        Row: {", row, "        }"];

  if (!view) {
    const insert = columns
      .map((c) => `          ${c.name}${c.insertRequired ? "" : "?"}: ${c.type}`)
      .join("\n");
    const update = columns.map((c) => `          ${c.name}?: ${c.type}`).join("\n");
    lines.push("        Insert: {", insert, "        }", "        Update: {", update, "        }");
  }
  lines.push("        Relationships: []", "      },");
  return lines.join("\n");
}

const tableBlocks = Object.entries(TABLES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, cols]) => block(name, cols))
  .join("\n");

const viewBlocks = Object.entries(VIEWS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, cols]) => block(name, cols, { view: true }))
  .join("\n");

const fnBlocks = Object.entries(FUNCTIONS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, def]) => {
    const args = Object.entries(def.args)
      .map(([key, value]) => `${key}?: ${value}`)
      .join("; ");
    return `      ${name}: {\n        Args: { ${args} }\n        Returns: ${def.returns}\n      }`;
  })
  .join("\n");

const enumBlock = Object.entries(ENUMS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, union]) => `      ${name}: ${union}`)
  .join("\n");

const constantsBlock = Object.entries(ENUMS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, union]) => {
    const values = union
      .split("|")
      .map((part) => part.trim().replace(/^"|"$/g, ""))
      .map((part) => `"${part}"`)
      .join(", ");
    return `      ${name}: [${values}],`;
  })
  .join("\n");

const target = "src/integrations/supabase/types.ts";
const source = readFileSync(target, "utf8");

const start = source.indexOf("    Tables: {");
const end = source.indexOf("    CompositeTypes: {");
if (start === -1 || end === -1) {
  throw new Error("types.ts did not match the expected generated shape");
}

const replacement = `    Tables: {
${tableBlocks}
    }
    Views: {
${viewBlocks}
    }
    Functions: {
${fnBlocks}
    }
    Enums: {
${enumBlock}
    }
`;

let output = source.slice(0, start) + replacement + source.slice(end);

// Regenerate the runtime Constants block at the tail of the file.
const constantsStart = output.indexOf("export const Constants = {");
if (constantsStart === -1) throw new Error("types.ts has no Constants block");
output =
  output.slice(0, constantsStart) +
  `export const Constants = {
  public: {
    Enums: {
${constantsBlock}
    },
  },
} as const
`;

writeFileSync(target, output);
console.log(`Rewrote ${target}: ${Object.keys(TABLES).length} tables, ${Object.keys(VIEWS).length} views, ${Object.keys(FUNCTIONS).length} functions, ${Object.keys(ENUMS).length} enums.`);
