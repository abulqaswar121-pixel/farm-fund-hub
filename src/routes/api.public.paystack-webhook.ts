import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const eventSchema = z.object({
  event: z.string(),
  data: z.object({
    status: z.string(),
    amount: z.number(),
    reference: z.string(),
    customer: z.object({ email: z.string().email() }),
    metadata: z.object({ member_id: z.string().uuid() }).optional(),
  }),
});

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Payments are not configured", { status: 503 });
        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const provided = Buffer.from(signature, "utf8");
        const computed = Buffer.from(expected, "utf8");
        if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) return new Response("Invalid signature", { status: 401 });
        let payload: unknown;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }
        const parsed = eventSchema.safeParse(payload);
        if (!parsed.success || parsed.data.event !== "charge.success" || parsed.data.data.status !== "success") return new Response("Ignored", { status: 200 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const memberId = parsed.data.data.metadata?.member_id;
        if (!memberId) return new Response("Missing member", { status: 400 });
        const { error } = await supabaseAdmin.from("contributions").upsert({ member_id: memberId, amount: parsed.data.data.amount / 100, category: "Contribution", payment_method: "paystack", paystack_reference: parsed.data.data.reference, payment_status: "success", verified_at: new Date().toISOString(), recorded_by: memberId }, { onConflict: "paystack_reference", ignoreDuplicates: true });
        if (error) return new Response("Unable to record contribution", { status: 500 });
        return new Response("ok", { status: 200 });
      },
    },
  },
});
