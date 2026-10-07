import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * Paystack webhook — the only automatic way equity is ever credited.
 *
 * Security chain, in order:
 *   1. The raw body is verified against the HMAC-SHA512 signature computed with
 *      the server-side secret key, using a constant-time comparison.
 *   2. Only a `charge.success` event with status `success` is honoured.
 *   3. The amount credited is the amount Paystack reports, not the amount the
 *      browser claimed. The pending row the member created only carries a
 *      reference.
 *   4. The update is idempotent: a row already marked success is left alone, so
 *      Paystack's retries cannot double-credit a member.
 *
 * Nothing here trusts a client-side redirect.
 */

const eventSchema = z.object({
  event: z.string(),
  data: z.object({
    status: z.string(),
    amount: z.number(),
    reference: z.string(),
    customer: z.object({ email: z.string().email() }).optional(),
  }),
});

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const secret = process.env["PAYSTACK_SECRET_KEY"];

        if (!secret) {
          console.error("[paystack] PAYSTACK_SECRET_KEY is not configured");
          return new Response("Payments are not configured", { status: 503 });
        }

        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const provided = Buffer.from(signature, "utf8");
        const computed = Buffer.from(expected, "utf8");

        if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
          console.warn("[paystack] rejected a webhook with an invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const parsed = eventSchema.safeParse(payload);
        if (!parsed.success) return new Response("Ignored", { status: 200 });

        const { event, data } = parsed.data;
        if (event !== "charge.success" || data.status !== "success") {
          // Acknowledge so Paystack stops retrying events we do not act on.
          return new Response("Ignored", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: investment, error: lookupError } = await supabaseAdmin
          .from("cycle_investments")
          .select("id, cycle_id, member_id, status, amount")
          .eq("paystack_reference", data.reference)
          .maybeSingle();

        if (lookupError) {
          console.error("[paystack] ledger lookup failed", lookupError.message);
          return new Response("Ledger unavailable", { status: 500 });
        }

        if (!investment) {
          // A payment against a reference we never issued. Do not create a row —
          // that is exactly how fabricated equity would enter the ledger.
          console.warn(`[paystack] no pending investment for reference ${data.reference}`);
          return new Response("Unknown reference", { status: 202 });
        }

        if (investment.status === "success") {
          return new Response("Already credited", { status: 200 });
        }

        const credited = Number(data.amount) / 100;
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

        const { error: updateError } = await supabaseAdmin
          .from("cycle_investments")
          .update({
            status: "success",
            amount: credited,
            verified_at: new Date().toISOString(),
            verified_by: investment.member_id,
            receipt_number: `AGC/${investment.cycle_id.slice(0, 4).toUpperCase()}/${stamp}/${investment.id
              .slice(0, 6)
              .toUpperCase()}`,
          })
          .eq("id", investment.id)
          .neq("status", "success");

        if (updateError) {
          console.error("[paystack] could not credit the ledger", updateError.message);
          return new Response("Unable to record contribution", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
