// Server-side Supabase client bound to the ANON role.
//
// Public pages (the marketplace, the transparency feed, the incident register)
// must read exactly what a signed-out visitor is allowed to read. Using this
// client proves that: it carries no session, so Row Level Security applies with
// auth.uid() = null and any over-permissive policy would fail loudly here
// rather than silently in production.
//
// Load inside server handlers only:
//   const { supabasePublic } = await import("@/integrations/supabase/client.public.server");
import { createClient } from "@supabase/supabase-js";
import { createLedgerFetch } from "./fetchWithBudget";
import type { Database } from "./types";

function createPublicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!url || !key) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`,
    );
  }

  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      // Bounded, so a ledger that cannot be reached becomes a fast, honest
      // empty state instead of a page that never finishes rendering.
      fetch: createLedgerFetch(key),
      headers: { "X-Client-Info": "agricapital-public-ssr" },
    },
  });
}

let client: ReturnType<typeof createPublicClient> | undefined;

export const supabasePublic = new Proxy({} as ReturnType<typeof createPublicClient>, {
  get(_, prop, receiver) {
    if (!client) client = createPublicClient();
    return Reflect.get(client, prop, receiver);
  },
});
