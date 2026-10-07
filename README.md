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

| Rule                                                                                                                   | Where it lives                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Terms are frozen when a cycle is published — target capital, minimum ticket, profit split, reserve and commodity       | `freeze_cycle_terms()` trigger on `farm_cycles`                                      |
| Equity is **derived live** as `my verified capital ÷ total verified capital × 100`. It is never stored, never editable | `cycle_funding` view, `my_cycle_position()`, `cycle_position_book()`                 |
| Profit split is locked at publication (default 70% members / 30% farm caretaker)                                       | `farm_cycles.profit_investor_percent` + `profit_operator_percent`, `CHECK` sum = 100 |
| Emergency reserve is locked between 5% and 10% of harvest revenue                                                      | `CHECK (reserve_percent between 5 and 10)`                                           |
| Settlement runs a strict four-level waterfall                                                                          | `run_cycle_waterfall()`                                                              |
| A cycle can never settle twice                                                                                         | `run_cycle_waterfall()` guard                                                        |
| A member can never offer more equity than they actually hold                                                           | `guard_transfer_capital()` trigger                                                   |
| An operator can never read a member's capital, the contribution book or payout lines                                   | RLS policies using `private.is_admin()`                                              |

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
from _Portal → Members & roles_.

---

## Routes

| Route                          | Who      | What                                                                                                                                                                                  |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | public   | Hero band with ledger-counted pulse, live farm ticker, cycle marketplace, four-step lifecycle in plain words, an example payout walkthrough, the honesty rules, transparency register |
| `/cycles`                      | public   | Marketplace with stock and status filters                                                                                                                                             |
| `/cycles/$cycleId`             | public   | Cycle terms, rounded funding progress, stage rail, expected harvest, farm record, incidents, weather                                                                                  |
| `/signin`                      | public   | Sign in / create account                                                                                                                                                              |
| `/portal/investor`             | member   | Portfolio, live telemetry vs target weight, statement with receipts, share transfer board, visit booking, reinvestment                                                                |
| `/portal/operator`             | operator | Mobile-first quick log: feed, growth sample, mortality, medication, eggs/yield, expense, harvest weigh-in, incident, weather                                                          |
| `/portal/admin`                | admin    | Cycle launcher, contribution verifier, log auditor, settlement engine, payout register, members & roles                                                                               |
| `/legal/$doc`                  | public   | `terms`, `privacy`, `risk`                                                                                                                                                            |
| `/api/public/paystack-webhook` | Paystack | The only automatic way equity is ever credited                                                                                                                                        |
| `/api/health`                  | public   | Deployment health: ledger reachability and whether payments are configured                                                                                                            |

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
settlement; the rolled amount becomes a real verified contribution. It draws
only on that member's own settlement line, is capped by the instruction mode
(principal, profit, or the whole line) and by whatever has not already been
rolled, and once a line has been fully rolled it is marked `withheld` — a
withheld payout can never afterwards be marked paid in cash, because the ledger
must not count the same money twice.

**Secondary market.** Members offer verified equity at par. Another member claims
the offer; an admin settles it once the money has moved. Settlement credits the
buyer with a new verified row and offsets the seller's holding by exactly the
same amount, so the cycle total is unchanged — a transfer moves ownership, never
capital.

---

## Local development

```bash
npm install --no-audit --no-fund
npm run dev                        # http://localhost:8080
npx tsc --noEmit && npm run lint   # both must be clean
npm run build                      # Cloudflare/nitro output in .output
NITRO_PRESET=node-server npm run build && node .output/server/index.mjs
```

`bun.lock` is this project's lockfile; there is no `package-lock.json`, and one
should not be added — npm's lock generation is currently inconsistent for this
dependency tree, so a committed npm lock would break `npm ci` in a build host.
`package.json` pins `h3` to `2.0.1-rc.26` (the registry advertises a newer
release whose tarball 404s) and `rolldown` to `1.2.1`; leave those in place. `vite preview` does not serve this app — the TanStack Start
plugin looks for a `dist/server/server.js` entry the nitro build no longer
produces. Use `npm run dev`, or the node-server preset above to check the real
build artifact.

To review the interface without a Supabase project, `scripts/preview-ledger/`
serves a development-only PostgREST stand-in over a local PostgreSQL with the
real migrations and real RLS; `scripts/preview-ledger/seed_demo.py` builds a
throwaway demonstration database beside it (git-ignored — see the zero-sample-data
rule below).

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

Nine migrations in `supabase/migrations/`. The four `20260909…` files are the
original auth/role base; the five `20261007…` files are AgriCapital:

```
20261007115900_…_role_enum.sql              # 'member' added in its own transaction
20261007120000_…_core.sql                   # 12 tables, lock triggers, capital guards
20261007120100_…_roles_and_rls.sql          # has_role/is_admin/is_staff, every policy
20261007120200_…_views_and_settlement.sql   # aggregate views + waterfall, rollover, transfer
20261007120300_…_rollover_guards.sql        # rollover caps, withheld-payout protection
20261007120400_…_tilapia.sql                # 'tilapia' added to commodity_type, on its own
```

`…120400…` follows the same rule as `…115900…`: adding an enum value and _using_
it in one transaction is refused by PostgreSQL, so it only adds the value. The
commodity catalogue in `src/lib/agri/commodities.ts` offers tilapia once it has
run, exactly as the cycle launcher and operator forms do.

Apply them with `supabase db push`, or paste them into the dashboard SQL editor
**one file at a time**.

> Order matters and the transaction boundary matters. `…115900…` adds the new
> `member` value to the `app_role` enum, and PostgreSQL refuses to _use_ a new
> enum value in the transaction that added it. Run that file on its own, then
> the other three in order. Pasting all four as a single script fails on the
> enum, not on anything else.

The public pages read **only** through the `cycle_*` / `platform_*` views; the
`anon` role has no grant on any ledger table.

The commodity catalogue is six families — catfish, tilapia, broiler, layer,
grain and greenhouse — matching `public.commodity_type`.

After applying them, **sign up for the first account.** The very first account
ever created is provisioned as `admin` so the co-operative can be bootstrapped;
every account after that is a `member`, and the admin promotes people from
_Portal → Members & roles_.

Types in `src/integrations/supabase/types.ts` are generated from the schema by
`node scripts/generate-agri-types.mjs` — if you add a table, view or RPC, add it
there and regenerate, or the query builder will silently mistype.

## Lovable

Lovable syncs this repository and previews it as a full-stack build. Two things
to know before the first look:

- the preview renders the designed empty states until the migrations have been
  applied to the project's database — and git sync does **not** apply them for
  you: ask Lovable in the project chat to run the pending files under
  `supabase/migrations/`, or apply them yourself, one file at a time;
- that first look is the correct, honest one anyway;
- after they are applied, **sign up the first account**: the first account ever
  created becomes the admin, everyone after is a member.

`LOVABLE.md` carries the handoff in full: migration order and transaction
boundaries, the environment secrets, and the rules an editor's prompt must not
break. Preview-only tooling (the local ledger stand-in, the demonstration seed)
is inert in a Lovable build: it is never imported by `src/`, and the preview
ribbon only appears when `VITE_PREVIEW_LEDGER=true` is set.

## Design

Precision Gateway, in the same visual rhythm as NDH Academy so the two surfaces
read as one family: deep navy `#0A1A30` hero band with an ambient glow and a
live ticker, porcelain `#F8FAFC` canvas, elevated pure-white `#FFFFFF` cards
with hairline `#D9E1EF` borders, `rounded-2xl` corners and the soft low-ink
shadow `0 4px 16px rgba(16,27,64,0.07)`. Signal cyan `#22D3EE` carries live
technology states, emerald `#10B981`/`#059669` carries funding, active cycles
and verified margin, amber `#F59E0B` carries a closing cycle or an item awaiting
verification, and the master gradient `#22D3EE → #68BAF7 → #A9A1EB` is kept for
identity moments. Space Grotesk headings, DM Sans body, tabular monospace for
every naira, kilo and equity figure. Tokens and the `.pg-*` semantic classes
live in `src/styles.css`.

**Homepage rhythm.** Hero band (pill chip, headline, ledger-counted platform
pulse) → live farm ticker → marketplace grid → the four-step cycle lifecycle in
Academy numerals (`01`–`04`, plain title over the ledger's own term) → the
example payout walkthrough and the transparency register in bordered white
containers → _How we keep this honest_ (the four checkable promises plus what
stays private and why) → closing call to action.

**Two voices, one product.** Every public page speaks in the words a first-time
visitor already owns: _Collecting money_ rather than _funding open_, _bills,
then members, then profit_ rather than _four-level waterfall_. The ledger's own
vocabulary stays in the portals, the settlement engine and the code, and where a
public card does show the term (`01 Capital pooling`) it sits under the plain
title in small mono type, so a member recognises it later without having to
learn it first.

**Navigation isolation.** The header carries AgriCapital actions only —
Marketplace (cycles), How It Works, Transparency Register, Rules and Member Sign
In. Sibling NDH businesses and the parent directory appear _only_ in
`FamilyFooter`; there is no ecosystem switcher anywhere in the chrome.

**Brand lockup.** Every surface (header, footer, sign-in, portal) renders
`BrandLockup`: the Open Gateway master tile wearing the agricultural `Sprout`
sector badge, `NAJEEB DIGITAL HUB` in Space Grotesk on the top line, and
`NDH AgriCapital` in signal cyan with the emerald accent beneath it.

The three brand faces (Space Grotesk, DM Sans, Roboto Mono) are self-hosted from
`public/fonts` with their licences, so a first paint never waits on a third-party
host. The link-preview card at `public/og-agricapital.png` is generated by
`scripts/build-og-image.py` (it imports the sector-badge geometry from
`build-brand-icons.py`, so the tab icon and the unfurl card wear the same
sprout). It states what is fixed and where to look rather than any figure,
because at unfurl time there are no figures to state honestly.

**Icons.** `public/favicon.svg`, `public/favicon.png` and
`public/apple-touch-icon.png` are built from the master gateway mark by
`scripts/build-brand-icons.py` (the vector file embeds a downscaled master mark
and draws the plate, badge and sprout as paths). Regenerate both whenever the
master mark changes.

**Commodity banners.** The marketplace cards carry a photograph of what is being
farmed, from `public/images/commodities/`, with the species tag over it. Those
photographs are original generated assets committed to the repository; keep them
in that directory, named after the commodity id.

### What the public may see, and what it may not

A signed-out visitor is allowed to know that a cycle exists and what joining it
costs. They are not allowed to know the business inside it. That boundary is
enforced in the query, not in the markup:

| Published publicly                                                                | Withheld until sign-in                                                                         |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Produce, photo and species tag; cycle code and name; region-level farm site       | What the cycle expects to earn, what it owes, and its costed plan                              |
| Target capital, smallest ticket, cycle length, funding window, expected harvest   | Individual contributions, each member's share and the number of investors                      |
| Funding progress **rounded down** to the nearest ₦10,000 and whole-percent funded | Settlement arithmetic — supplier bills, principal returned, reserve, profit pool, payout lines |
| Harvest date and total weight; the date a cycle was paid out                      | The scale ticket, the sale value and the trader who collected the harvest                      |
| Approved farm-log summaries, incident details with severity, weather records      | Expense rows, supplier names, incident cost estimates, audit trails                            |

The rules behind that table:

1. **Explicit column whitelists.** `src/lib/agri.public.functions.ts` names the
   columns it may read (`PUBLIC_CYCLE_COLUMNS`) — never `select("*")` — and maps
   every row into a `Public*` type, so a column added to a table later cannot
   leak into a public page by default.
2. **Rounded before it leaves the server.** Aggregate progress is floored to
   ₦10,000 so a member's own contribution cannot be inferred by watching the
   figure move.
3. **Aggregate views only.** Public reads go through the `cycle_*` /
   `platform_*` views; `anon` holds no grant on any ledger table.
4. **A guard that fails the build.** `node scripts/check-public-surface.mjs`
   reads the public files as text and refuses to pass if a private table, a
   private column, a member figure, the portal-only projection component, or any
   data access inside the public example turns up. Run it before every commit —
   `.github/workflows/public-surface.yml` runs the same guard on every push and
   pull request, and needs no install step. It is deliberately dumb, because a
   dumb check that runs beats a clever one that nobody does.
5. **A public calculator with no cycle behind it.** Because a cycle's projected
   revenue is private, the public walkthrough
   (`src/components/agri/ExampleWalkthrough.tsx`) runs the settlement
   arithmetic on numbers the visitor sets, through `src/lib/agri/example.ts` —
   a module the guard also asserts never touches the database. Cycle-specific
   projection stays behind sign-in.

### What the live farm ticker may say

The ticker under the hero carries two clearly separated kinds of line, and never
a member balance or a return:

- **ledger lines** — built from published cycles (`CAT-014 · active on farm`,
  `TIL-003 · funding open`) and approved operator logs;
- **operating standards** — the targets and conditions the co-operative
  publishes in advance and holds each cycle to: the biomass a batch is steered
  toward at week 12, the viability floor a flock is held to, the irrigation
  state on the greenhouse beds, and the season's harvest window. They are
  labelled as standards on the strip itself, because a target is not a reading.

**No sample data exists anywhere.** Every page renders a real empty state with a
call to action until the co-operative publishes its first cycle.
