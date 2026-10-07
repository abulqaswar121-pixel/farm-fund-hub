# NDH AgriCapital

Multi-commodity agricultural investment ledger and co-operative platform for the
Najeeb Digital Hub ecosystem — `agricapital.ndh.com.ng`.

Members pool capital into individually identified farm cycles (catfish ponds,
broiler houses, layer flocks, grain fields, greenhouse beds). Contributions buy
equity in that cycle's outcome. Every figure a member sees is computed from the
ledger; nothing is stored twice and nothing is editable by hand.

---

## The rules that cannot be relaxed

These are enforced in the database, not in the interface.

| Rule | Where it lives |
| --- | --- |
| Terms are frozen when a cycle is published — target capital, minimum ticket, profit split, reserve and commodity | `freeze_cycle_terms()` trigger on `farm_cycles` |
| Equity is **derived live** as `my verified capital ÷ total verified capital × 100`. It is never stored, never editable | `cycle_funding` view, `my_cycle_position()`, `cycle_position_book()` |
| Profit split is locked at publication (default 70% members / 30% farm caretaker) | `farm_cycles.profit_investor_percent` + `profit_operator_percent`, `CHECK` sum = 100 |
| Emergency reserve is locked between 5% and 10% of harvest revenue | `CHECK (reserve_percent between 5 and 10)` |
| Settlement runs a strict four-level waterfall | `run_cycle_waterfall()` |
| A cycle can never settle twice | `run_cycle_waterfall()` guard |
| A member can never offer more equity than they actually hold | `guard_transfer_capital()` trigger |
| An operator can never read a member's capital, the contribution book or payout lines | RLS policies using `private.is_admin()` |

**The waterfall**, in strict priority order:

1. **Level 1** — outstanding operational liabilities and supplier debts.
2. **Level 2** — 100% of capital principal, pro-rata by verified equity.
3. **Level 3** — the cycle's locked emergency reserve, into escrow.
4. **Level 4** — whatever remains is net profit, split at the frozen ratio.

If revenue cannot satisfy a level, the shortfall is reported openly on every
affected member's statement rather than absorbed or hidden.

---

## Roles

Roles live in `user_roles` and are checked through the security-definer
`private.has_role(user, role)` — never on `profiles`, and never from the client.

- **member** — contributes capital, reads only their own ledger rows.
- **operator** — files farm logs and expenses for the production side. Has no
  access to any money figure, member balance or payout line.
- **admin** — cycle launcher, offline contribution verifier, log auditor and the
  settlement engine. Admin can see the whole contribution book; nobody else can.

The **first account ever created becomes the admin**, so the co-operative can be
bootstrapped. Every account after that is a member; the admin promotes people
from *Portal → Members & roles*.

---

## Routes

| Route | Who | What |
| --- | --- | --- |
| `/` | public | Ecosystem stats, stock families, lifecycle, locked rules, ROI & profit calculator, transparency feed |
| `/cycles` | public | Marketplace with stock and status filters |
| `/cycles/$cycleId` | public | Cycle terms, funding progress, stage rail, waterfall, farm record, incidents, weather |
| `/signin` | public | Sign in / create account |
| `/portal/investor` | member | Portfolio, live telemetry vs target weight, statement with receipts, share transfer board, visit booking, reinvestment |
| `/portal/operator` | operator | Mobile-first quick log: feed, growth sample, mortality, medication, eggs/yield, expense, harvest weigh-in, incident, weather |
| `/portal/admin` | admin | Cycle launcher, contribution verifier, log auditor, settlement engine, payout register, members & roles |
| `/legal/$doc` | public | `terms`, `privacy`, `risk` |
| `/api/public/paystack-webhook` | Paystack | The only automatic way equity is ever credited |
| `/api/health` | public | Deployment health: ledger reachability and whether payments are configured |

---

## Money

**Card payments (Paystack).** The member starts a contribution, which writes a
`pending` row carrying a reference. Paystack then calls the webhook, which:

1. verifies the `x-paystack-signature` HMAC-SHA512 against the raw body using the
   server-side secret;
2. honours only `charge.success`;
3. credits the amount **Paystack reports**, not the amount the browser claimed;
4. is idempotent, so Paystack's retries cannot double-credit anybody.

Nothing is ever credited from a client-side redirect. `PAYSTACK_SECRET_KEY`
never leaves the server.

**Offline transfers.** The member submits a pending row with the teller
reference. An admin checks it against the co-operative's account and verifies it
— verifying is what credits equity, and it stamps the verifier and a receipt
number.

**Auto-rollover.** A member can instruct that their principal, profit or both be
rolled into a later open cycle. An admin applies the instruction after
settlement; the rolled amount becomes a real verified contribution.

**Secondary market.** Members offer verified equity at par. Another member claims
the offer; an admin settles it once the money has moved. Settlement credits the
buyer with a new verified row and offsets the seller's holding by exactly the
same amount, so the cycle total is unchanged — a transfer moves ownership, never
capital.

---

## Local development

```bash
npm install --no-audit --no-fund
npm run dev          # http://localhost:8080
npx tsc --noEmit     # must be clean
```

Environment (`.env`):

```
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...          # or VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=...         # server only: verification, settlement reads
PAYSTACK_SECRET_KEY=...               # server only: webhook signature + verification
VITE_PAYSTACK_PUBLIC_KEY=...          # public: inline checkout
```

Without the service-role and Paystack keys the app still runs: public pages
degrade to honest empty states, and payment functions report that payments are
not configured instead of pretending to succeed.

## Database

Eight migrations in `supabase/migrations/`. The four `20260909…` files are the
original auth/role base; the four `20261007…` files are AgriCapital:

```
20261007115900_…_role_enum.sql              # 'member' added in its own transaction
20261007120000_…_core.sql                   # 12 tables, lock triggers, capital guards
20261007120100_…_roles_and_rls.sql          # has_role/is_admin/is_staff, every policy
20261007120200_…_views_and_settlement.sql   # aggregate views + waterfall, rollover, transfer
```

Apply them with `supabase db push`, or paste them into the dashboard SQL editor
**one file at a time**.

> Order matters and the transaction boundary matters. `…115900…` adds the new
> `member` value to the `app_role` enum, and PostgreSQL refuses to *use* a new
> enum value in the transaction that added it. Run that file on its own, then
> the other three in order. Pasting all four as a single script fails on the
> enum, not on anything else.

The public pages read **only** through the `cycle_*` / `platform_*` views; the
`anon` role has no grant on any ledger table.

After applying them, **sign up for the first account.** The very first account
ever created is provisioned as `admin` so the co-operative can be bootstrapped;
every account after that is a `member`, and the admin promotes people from
*Portal → Members & roles*.

Types in `src/integrations/supabase/types.ts` are generated from the schema by
`node scripts/generate-agri-types.mjs` — if you add a table, view or RPC, add it
there and regenerate, or the query builder will silently mistype.

## Design

Precision Gateway: navy `#0A1A30`, porcelain `#F8FAFC`, signal cyan `#22D3EE`,
master gradient `#22D3EE → #68BAF7 → #A9A1EB`, emerald `#10B981`/`#059669` for
gains, violet-magenta `#8A2BE2 → #FF007F` reserved for identity moments.
Space Grotesk headings, DM Sans body, tabular monospace for every naira, kilo
and equity figure. Tokens and the `.pg-*` semantic classes live in
`src/styles.css`.

**No sample data exists anywhere.** Every page renders a real empty state with a
call to action until the co-operative publishes its first cycle.
