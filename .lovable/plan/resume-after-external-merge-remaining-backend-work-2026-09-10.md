# Resume after external merge — remaining backend work

Stand down until the user confirms the other tool's commits are merged. On return:

1. **Re-sync** — review the merged changes (new pages: homepage, member management, harvest tracking, contributor portal) and reconcile with the existing schema, RLS, and server functions.
2. **Transactional emails** — the last open backend item:
   - Receipt email to contributor on successful Paystack contribution (fire from the webhook/verify path after the row is recorded).
   - Notification email to admin on each successful contribution.
   - Notification email to admin when an operator logs an expense.
3. **End-to-end validation** — real test payment via Paystack test keys, webhook signature check, role enforcement spot-checks (operator cannot add contributions, contributor cannot write), and equity view correctness.

## Technical notes

- Webhook endpoint already live: `src/routes/api.public.paystack-webhook.ts` (`/api/public/paystack-webhook`), HMAC-SHA512 verified, idempotent on `paystack_reference`.
- `PAYSTACK_PUBLIC_KEY` and `PAYSTACK_SECRET_KEY` are stored as secrets; secret is server-only.
- Email will need a sender/domain decision when we resume (Lovable Cloud email or a provider like Resend) — confirm with the user then.
- Dashboard skeleton and auth (email/password) are already functional; the new pages should reuse `getDashboardData`-style server functions with `requireSupabaseAuth`.
