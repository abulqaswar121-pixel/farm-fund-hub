#!/usr/bin/env node
/**
 * Public-surface guard.
 *
 * The platform's promise to its members is that the public pages advertise a
 * cycle without publishing the business inside it. That promise is only worth
 * anything if it is enforced by the code that fetches the data — so this script
 * fails when a public module reaches for a private table, a private column, or a
 * per-member figure.
 *
 * Run it before a commit, and in CI:
 *
 *     node scripts/check-public-surface.mjs
 *
 * It is deliberately dumb: it reads files as text and looks for forbidden
 * strings. A dumb check that runs is worth more than a clever one that does not.
 */
import { readFileSync, existsSync } from "node:fs";

const PUBLIC_FILES = [
  "src/lib/agri.public.functions.ts",
  "src/routes/index.tsx",
  "src/routes/cycles.index.tsx",
  "src/routes/cycles.$cycleId.tsx",
  "src/routes/signin.tsx",
  "src/components/agri/CycleCard.tsx",
  "src/components/agri/ExampleWalkthrough.tsx",
  "src/components/agri/TransparencyFeed.tsx",
  "src/components/agri/HowWeKeepThisHonest.tsx",
];

/** Tables that only a signed-in member may read, and only through the portal. */
const FORBIDDEN_TABLES = [
  "cycle_investments",
  "farm_expenses",
  "harvest_records",
  "waterfall_distributions",
  "waterfall_lines",
  "operational_logs",
  "rollover_instructions",
  "share_transfers",
  "farm_visits",
];

/** Money and identity fields that must never reach a signed-out browser. */
const FORBIDDEN_FIELDS = [
  "projected_revenue",
  "projected_liabilities",
  "profit_investor_percent",
  "profit_operator_percent",
  "reserve_percent",
  "estimated_impact",
  "gross_revenue",
  "buyer",
  "scale_ticket_ref",
  "principal_returned",
  "net_profit",
  "total_paid_out",
  "profit_investor_paid",
  "investor_profit_pool",
  "created_by",
];

/** Camel-cased twins, as they would appear in markup or component state. */
const FORBIDDEN_CAMEL = [
  "projectedRevenue",
  "projectedLiabilities",
  "grossRevenue",
  "netProfit",
  "principalReturned",
  "investorProfitPool",
  "equityPercent",
  "investorCount",
  "myCapital",
  "estimatedImpact",
  "scaleTicket",
];

/**
 * Deliberate exceptions, each with its reason.
 *
 * `cycle_returns.executed_at` — the settlement *date* is published so a finished
 * cycle can be marked "paid out"; no amount is read alongside it.
 */
const ALLOWANCES = [
  {
    file: "src/lib/agri.public.functions.ts",
    token: "cycle_returns",
    reason: "reads executed_at only, to date a finished cycle — no amounts",
  },
  {
    file: "src/lib/agri.public.functions.ts",
    token: "raised_capital",
    reason: "the aggregate funding view, RLS-safe, rounded before it leaves the server",
  },
  {
    file: "src/lib/agri.public.functions.ts",
    token: "buyer",
    reason: "the word appears in a comment explaining why the buyer is withheld",
  },
];

const failures = [];

for (const file of PUBLIC_FILES) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");

  const check = (needle, kind) => {
    lines.forEach((line, index) => {
      if (!line.includes(needle)) return;
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) return;
      const allowed = ALLOWANCES.some((rule) => rule.file === file && rule.token === needle);
      if (allowed) return;
      failures.push(`${file}:${index + 1}  ${kind} "${needle}" → ${line.trim().slice(0, 110)}`);
    });
  };

  for (const table of FORBIDDEN_TABLES) check(table, "private table");
  for (const field of FORBIDDEN_FIELDS) check(field, "private field");
  for (const field of FORBIDDEN_CAMEL) check(field, "private field");
}

/* --------------------------------------------------------------------------
 * Two more promises, checked the same dumb way.
 *
 *   a) A per-cycle projection is a portal feature. The public calculator runs
 *      the same arithmetic on numbers the visitor types in, so no public file
 *      may reach for the component that projects a *real* cycle's plan.
 *   b) The public example must stay arithmetic-only: if it ever grows a
 *      database client, the "example" could quietly become a real cycle.
 * ------------------------------------------------------------------------ */

const PORTAL_ONLY_COMPONENTS = ["ProfitCalculator"];

for (const file of PUBLIC_FILES) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const component of PORTAL_ONLY_COMPONENTS) {
    if (text.includes(component)) {
      failures.push(
        `${file}  imports the portal-only "${component}" — a public page may not ` +
          `project a real cycle's plan; use ExampleWalkthrough instead`,
      );
    }
  }
}

const EXAMPLE_MODULE = "src/lib/agri/example.ts";
const DATA_ACCESS = ["createServerFn", "supabase", "from(", "fetch(", "process.env"];

if (existsSync(EXAMPLE_MODULE)) {
  const text = readFileSync(EXAMPLE_MODULE, "utf8");
  for (const needle of DATA_ACCESS) {
    if (text.includes(needle)) {
      failures.push(
        `${EXAMPLE_MODULE}  contains "${needle}" — the public example must be pure ` +
          `arithmetic on numbers the visitor types in, with no data access`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("✗ The public surface is reaching for data it must not have:\n");
  for (const failure of failures) console.error("  " + failure);
  console.error(
    "\nPublic pages may advertise a cycle; they may not publish its finances, its" +
      "\nsuppliers, its buyer or any member's position. Fetch those through the" +
      "\nauthenticated portal functions in src/lib/agri.member.functions.ts.\n",
  );
  process.exit(1);
}

console.log("✓ public surface clean — no private table, column or member figure is read publicly");
