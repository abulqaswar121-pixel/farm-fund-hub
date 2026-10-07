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

## 2. Then: get the migrations into the database

The database is the product. Until these run, every read is refused by design.

**Git sync alone will not do it.** Lovable deliberately does not run migration
files that arrive through a commit — a fact worth knowing before wondering why
the preview still looks empty. Two ways to apply them:

1. **Ask Lovable, in the project chat,** to apply the pending files under
   `supabase/migrations/` — it shows each change and asks for approval before
   running it, which is the reviewed path and keeps the files and generated
   types in step.
2. **Apply them yourself** — `supabase db push`, or paste them into the
   Supabase SQL editor one file at a time, in the order below.

Either way, one file at a time is not a style preference:

`supabase/migrations/` is ordered, and **the order and transaction boundaries
matter**:

| File                                        | What it is                                                            |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `20260909084433…` … `20260909084607…`       | original auth/profile base                                            |
| `20261007115900_…_role_enum.sql`            | adds `member` to the `app_role` enum — **run alone**                  |
| `20261007120000_…_core.sql`                 | 12 tables, cycle-term freeze trigger, capital guards                  |
| `20261007120100_…_roles_and_rls.sql`        | `has_role`/`is_admin`/`is_staff` and every policy                     |
| `20261007120200_…_views_and_settlement.sql` | public views, waterproof settlement engine, rollover + share transfer |
| `20261007120300_…_rollover_guards.sql`      | rollover caps and the withheld-payout trigger                         |

PostgreSQL refuses to _use_ a new enum value in the transaction that created it,
so `…115900…` must be applied on its own before the rest. Pasting the four
AgriCapital files as one script fails on the enum and nothing else.

After the migrations: **sign up the first account.** The very first account ever
created is provisioned as `admin`; every account after it is a `member`, and the
admin promotes people from _Portal → Members & roles_.

Then check `/api/health`: it reports whether the ledger is reachable and whether
payments are configured, so a half-finished setup cannot look like a working one.

## 3. Environment

`.env` carries the Supabase project URL and publishable key, which is what the
preview uses for public reads. Server-only values belong in the project's secrets
store — never committed, never sent to the browser:

| Variable                                   | Needed for                                                     | Without it                                                       |
| ------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | every read                                                     | public pages show their empty states                             |
| `SUPABASE_SERVICE_ROLE_KEY`                | first-account bootstrap, contribution verification, settlement | those actions report "not configured" and refuse                 |
| `PAYSTACK_SECRET_KEY`                      | webhook signature, payment verification                        | `/api/health` reports `payments: not configured`; no card credit |
| `VITE_PAYSTACK_PUBLIC_KEY`                 | inline checkout                                                | the checkout button cannot open                                  |

Nothing degrades silently: `/api/health` states ledger reachability and whether
payments are configured.

## 3b. Which branch Lovable previews

Git sync follows the project's **active branch**, and the branch is switchable
from Lovable. Merge the work to `main` and sync there for a single source of
truth; the feature branch this was built on is a session artifact and should not
become the project's long-lived branch.

## 4. Rules an editor's prompt must not break

These are enforced in the database, so an unsafe change will be refused rather
than merely warned about — but please do not try:

1. **Terms freeze at publication.** `target_capital`, `minimum_ticket`, profit
   split, reserve and commodity cannot change after `locked_at` is set.
2. **Equity is never stored.** It is computed live as _verified capital ÷ total
   verified capital × 100_ on every read. No column, no cached field, no
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

## 4b. Installs: read this before touching dependencies

- `bun.lock` is the project's lockfile. **Do not add a `package-lock.json`.**
  npm's lock generation is currently inconsistent for this dependency tree (it
  emits a lock that `npm ci` then rejects), so committing one would replace a
  working install with a failing build step.
- `npm install` and `bun install` both work from a clean clone today.
- `package.json` carries two `overrides` for reasons worth keeping:
  - `h3` is pinned to `2.0.1-rc.26`. The registry currently advertises an
    `h3@2.0.2` whose tarball 404s while npm's floating range resolves to it,
    which made every fresh `npm install` fail outright.
  - `rolldown` is pinned to `1.2.1`.
- If a future install fails on a package whose tarball 404s, the fix is the same
  shape: pin that exact version in `overrides`, and say why in a comment or a
  commit message. Do not "clean up" the existing overrides.

## 4c. What a freshly migrated database looks like (verified)

Confirmed end to end against a database with all nine migrations applied and
**zero rows** — the exact state the preview reaches on day one:

- every route answers 200 and renders its designed empty state — no error text,
  no stack traces, no blank screens;
- `/api/health` reports `ledger: ok, payments: not configured`;
- the public views return empty results or honest zeros, never errors;
- anonymous callers cannot invoke `ensure_profile` (`permission denied`);
- **the first account created becomes `admin`, the second becomes `member`** —
  the bootstrap is what makes the platform usable without hand-editing the
  database.

## 5. Zero sample data is a product rule

The co-operative's figures are members' money. Inventing them — even to make a
screen look full — is the one thing this platform must never do. Every page
therefore has a designed empty state with a call to action, and the honest path
to a populated screen is to create a cycle, contribute, verify, and settle.

If a _local_ demonstration database is needed for interface review, it is built
outside the product by `scripts/preview-ledger/` (a development-only PostgREST
stand-in) — those files are dev tooling, are never imported by `src/`, and the
seed script is git-ignored on purpose.

## 6. Knowledge to keep

- Brand: navy `#0A1A30`, porcelain `#F8FAFC`, white cards with hairline
  `#D9E1EF` borders and the soft shadow `0 4px 16px rgba(16,27,64,0.07)`,
  signal cyan `#22D3EE` for live technology states, emerald `#10B981` for
  funding/active cycles and verified margin, amber `#F59E0B` for a closing
  cycle, master gradient `#22D3EE → #68BAF7 → #A9A1EB`, and violet-magenta
  `#8A2BE2 → #FF007F` for identity moments only.
- Navigation isolation is a rule, not a preference: the header carries
  AgriCapital actions only (Marketplace, How It Works, Transparency Register,
  Rules, Member Sign In). Sibling NDH businesses and the parent directory live
  in `FamilyFooter` and nowhere else — do not reintroduce an ecosystem switcher
  into the header, and do not move footer links into the nav.
- The live farm ticker may carry ledger lines and *published operating
  standards*; it must never carry a member balance, a payout or a return figure.
- Type: Space Grotesk headings, DM Sans body, Roboto Mono for every figure —
  self-hosted in `public/fonts` so first paint never waits on a third party.
- Design tokens and the semantic `.pg-*` classes live in `src/styles.css`.
- GitHub workflow: never force-push; `npx tsc --noEmit` and `npm run lint` must
  both be clean before a change is considered done. Lint reports zero errors
  (only `react-refresh` warnings from shadcn's own files).
- `bun.lock` is the lockfile. Do not add a `package-lock.json`.

## 7. Local build notes

```bash
npm install --no-audit --no-fund   # or: bun install --frozen-lockfile
npm run dev                        # http://localhost:8080
npx tsc --noEmit && npm run lint   # both must be clean
npm run build                      # Cloudflare/nitro output in .output
npm run build:node                 # then: node .output/server/index.mjs
```

`vite preview` does **not** serve this app: the TanStack Start plugin expects a
`dist/server/server.js` entry that the nitro build no longer produces. Use
`npm run dev` for a local look, or the node-server preset above to check the real
build artifact.
