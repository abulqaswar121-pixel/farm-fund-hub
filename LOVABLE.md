# Lovable handoff — syncing & previewing NDH AgriCapital

Written for whoever opens this project in Lovable. The rules below are the
product's, not the tooling's: an investment ledger that can be nudged by
accident is not a ledger.

---

## 1. What to expect the moment it syncs

Lovable previews the app **before** Supabase is migrated, so the first thing you
will see is a fully designed platform with honest empty states — "no cycles
published yet", "the ledger could not be reached" — never a stack trace and
never invented data. That is deliberate, and it is also the signal you need:
empty states that render means the app is healthy; a blank screen does not.

Nothing in the interface is placeholder art. Empty states are part of the design
system and are supposed to be reviewed as such.

## 2. Then: apply the migrations

The database is the product. Until these run, every read is refused by design.

`supabase/migrations/` is ordered, and **the order and transaction boundaries
matter**:

| File | What it is |
| --- | --- |
| `20260909084433…` … `20260909084607…` | original auth/profile base |
| `20261007115900_…_role_enum.sql` | adds `member` to the `app_role` enum — **run alone** |
| `20261007120000_…_core.sql` | 12 tables, cycle-term freeze trigger, capital guards |
| `20261007120100_…_roles_and_rls.sql` | `has_role`/`is_admin`/`is_staff` and every policy |
| `20261007120200_…_views_and_settlement.sql` | public views, waterproof settlement engine, rollover + share transfer |
| `20261007120300_…_rollover_guards.sql` | rollover caps and the withheld-payout trigger |

PostgreSQL refuses to *use* a new enum value in the transaction that created it,
so `…115900…` must be applied on its own before the rest. Pasting the four
AgriCapital files as one script fails on the enum and nothing else.

After the migrations: **sign up the first account.** The very first account ever
created is provisioned as `admin`; every account after it is a `member`, and the
admin promotes people from *Portal → Members & roles*.

## 3. Environment

`.env` carries the Supabase project URL and publishable key — enough for the
public pages. Server-only values must be added as secrets (never committed,
never sent to the browser):

| Variable | Needed for | Without it |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | every read | public pages show their empty states |
| `SUPABASE_SERVICE_ROLE_KEY` | first-account bootstrap, contribution verification, settlement | those actions report "not configured" and refuse |
| `PAYSTACK_SECRET_KEY` | webhook signature, payment verification | `/api/health` reports `payments: not configured`; no card credit |
| `VITE_PAYSTACK_PUBLIC_KEY` | inline checkout | the checkout button cannot open |

Nothing degrades silently: `/api/health` states ledger reachability and whether
payments are configured.

## 4. Rules an editor's prompt must not break

These are enforced in the database, so an unsafe change will be refused rather
than merely warned about — but please do not try:

1. **Terms freeze at publication.** `target_capital`, `minimum_ticket`, profit
   split, reserve and commodity cannot change after `locked_at` is set.
2. **Equity is never stored.** It is computed live as *verified capital ÷ total
   verified capital × 100* on every read. No column, no cached field, no
   "quick fix".
3. **The profit split is locked 70 % members / 30 % farm caretaker.**
4. **The waterfall order is fixed:** operational liabilities → 100 % principal →
   emergency reserve (escrow, 5–10 %) → net profit at the frozen ratio.
5. **A cycle can never settle twice**, and settled lines are append-only.
6. **Offline contributions can only be credited by an admin**, and card payments
   only by the verified webhook. Never credit anything from a client-side
   redirect.
7. **The operator role cannot see money.** No balances, no contribution book, no
   payout lines — the policies refuse, and the interface does not offer them.
8. **Roles live in `user_roles`,** checked through the security-definer
   `private.has_role()`. Never add a `role` or `membership` column to `profiles`.
9. **No sample, demo, or seeded data — ever.** See below.
10. **Paystack secrets stay server-side.** `PAYSTACK_SECRET_KEY` must never be
    read in client code or exposed through `VITE_`-prefixed variables.

## 5. Zero sample data is a product rule

The co-operative's figures are members' money. Inventing them — even to make a
screen look full — is the one thing this platform must never do. Every page
therefore has a designed empty state with a call to action, and the honest path
to a populated screen is to create a cycle, contribute, verify, and settle.

If a *local* demonstration database is needed for interface review, it is built
outside the product by `scripts/preview-ledger/` (a development-only PostgREST
stand-in) — those files are dev tooling, are never imported by `src/`, and the
seed script is git-ignored on purpose.

## 6. Knowledge to keep

* Brand: navy `#0A1A30`, porcelain `#F8FAFC`, signal cyan `#22D3EE`, master
  gradient `#22D3EE → #68BAF7 → #A9A1EB`, emerald for gains, violet-magenta
  `#8A2BE2 → #FF007F` for identity moments only.
* Type: Space Grotesk headings, DM Sans body, Roboto Mono for every figure —
  self-hosted in `public/fonts` so first paint never waits on a third party.
* Design tokens and the semantic `.pg-*` classes live in `src/styles.css`.
* GitHub workflow: never force-push; `npx tsc --noEmit` and `npm run lint` must
  both be clean before a change is considered done.

## 7. Local build notes

```bash
npm install --no-audit --no-fund   # bun.lock is the project's lockfile
npm run dev                        # http://localhost:8080
npx tsc --noEmit && npm run lint   # both must be clean
npm run build                      # Cloudflare/nitro output in .output
NITRO_PRESET=node-server npm run build   # then: node .output/server/index.mjs
```

`vite preview` does **not** serve this app: the TanStack Start plugin expects a
`dist/server/server.js` entry that the nitro build no longer produces. Use
`npm run dev` for a local look, or the node-server preset above to check the real
build artifact.
