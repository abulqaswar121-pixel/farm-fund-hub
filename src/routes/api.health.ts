import { createFileRoute } from "@tanstack/react-router";

/**
 * Lightweight status probe used by the footer's "System status" badge and by
 * uptime monitoring. It reports whether the ledger is reachable with the anon
 * credentials — deliberately NOT a count of members or money, because anything
 * that useful should sit behind auth.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const payload: Record<string, unknown> = {
          service: "ndh-agricapital",
          checkedAt: new Date().toISOString(),
        };

        try {
          const { supabasePublic } = await import(
            "@/integrations/supabase/client.public.server"
          );
          const { error } = await supabasePublic
            .from("farm_cycles")
            .select("id", { count: "exact", head: true })
            .limit(1);

          payload["ledger"] = error ? "degraded" : "ok";
          if (error) payload["ledgerMessage"] = error.message;
        } catch (error) {
          payload["ledger"] = "unreachable";
          payload["ledgerMessage"] = error instanceof Error ? error.message : "unknown error";
        }

        payload["payments"] = process.env["PAYSTACK_SECRET_KEY"] ? "configured" : "not configured";

        const healthy = payload["ledger"] === "ok";
        return Response.json(payload, {
          status: healthy ? 200 : 503,
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
