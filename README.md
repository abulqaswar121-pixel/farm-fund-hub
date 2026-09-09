# Agri Pool Backend

Build the backend for Apex Agri-Capital, a shared ledger app for a small

agriculture investment cooperative.



ROLES (enforce with Supabase Row Level Security — must be enforced at the

database level, never only in the frontend):

- Admin: full control — manage members and roles, add/edit/delete

  contributions and expenses, close harvest cycles, record payouts.

- Operator: can add expenses and stock/growth log entries, can view

  everything, cannot manage members/roles, cannot add contributions.

- Contributor: read-only — sees the dashboard, full contribution/expense

  history, their own equity %, stock updates. No write access anywhere.



SCHEMA:

- profiles: id, full_name, role (admin/operator/contributor), created_at

- contributions: id, member_id, amount, date, category, note, payment_method

  (paystack/manual), paystack_reference, payment_status (pending/success/

  failed), verified_at, recorded_by, created_at

- expenses: id, amount, date, category, note, recorded_by, created_at

- stock_logs: id, date, count, note, recorded_by, created_at

- harvest_cycles: id, date, revenue, note, created_at

- harvest_payouts: id, harvest_cycle_id, member_id, percent, amount



PAYMENTS (critical — read carefully):

Contributors can pay into the pool via Paystack. When a contributor pays:

1. Frontend starts a Paystack checkout for the entered amount.

2. On completion, do NOT create the contribution record from the client-side

   redirect/callback alone.

3. A server-side webhook (Supabase Edge Function) must receive Paystack's

   webhook event, verify it using the Paystack secret key (stored as a

   server-side environment variable, never exposed to the browser), and

   only then insert the contribution row with payment_status = 'success'.

4. If verification fails or the webhook signature doesn't match, do not

   create or update any contribution record.



AUTH: email + password (or magic link), three roles above, one role per user.



EMAIL: on a successful Paystack contribution, send a receipt email to the

contributor and a notification email to the Admin. Notify Admin when an

Operator logs a new expense.



Build minimal skeleton pages only for now — Login, and a basic role-aware

Dashboard — just enough to prove Auth, Paystack, and email all work

end-to-end. Do not build out full pages/portals yet; that comes later.



PROHIBITIONS:

- No fabricated/sample data — start empty.

- No permission check that lives only in the frontend; RLS must enforce

  every rule above at the database level.

- Never expose the Paystack secret key or webhook secret in any client bundle.

- Equity % must always be calculated live from the contributions table —

  never a stored/editable field.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://farm-fund-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c90581e1-becf-4b05-928b-331931f49c4c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
