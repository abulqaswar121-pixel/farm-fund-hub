import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** The co-operative's three access levels. */
export type AppRole = "admin" | "operator" | "member";

/** A legacy row may still carry the old name for the member level. */
type StoredRole = AppRole | "contributor";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin & Treasury",
  operator: "Farm Operator",
  member: "Investor / Member",
};

export function normaliseRole(role: string | null | undefined): AppRole | null {
  if (role === "admin" || role === "operator") return role;
  if (role === "member" || role === "contributor") return "member";
  return null;
}

/**
 * Read the caller's role from the dedicated user_roles table.
 *
 * Deliberately a single-row read rather than a join: roles are the one thing
 * that must never be inferred from a profile record.
 */
export async function resolveCallerRole(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AppRole | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return normaliseRole((data as { role?: StoredRole } | null)?.role);
}

/**
 * Server-side permission gate.
 *
 * This is a convenience for honest callers and a clear error message — it is
 * NOT the security boundary. Row Level Security in the database is what
 * actually refuses the write, and every one of these checks has a matching
 * policy behind it.
 */
export async function assertRole(
  supabase: SupabaseClient<Database>,
  userId: string,
  allowed: AppRole[],
): Promise<AppRole> {
  const role = await resolveCallerRole(supabase, userId);
  if (!role || !allowed.includes(role)) {
    throw new Error("You do not have permission to do that.");
  }
  return role;
}

export function isStaff(role: AppRole | null): boolean {
  return role === "admin" || role === "operator";
}
