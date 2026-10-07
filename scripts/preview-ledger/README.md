# Preview ledger — development tooling, never part of the product

`server.py` is a small local stand-in for the two Supabase services this app
talks to: **PostgREST** (the REST API over PostgreSQL) and the parts of
**GoTrue** (auth) the sign-in screen uses. It exists for one reason: a build
sandbox has no route to `supabase.co`, and an investment ledger that cannot
reach its database renders nothing but empty states — which makes the interface
impossible to review.

**The product does not use this.** In production the app talks to Supabase, and
PostgREST, GoTrue and Row Level Security do these jobs properly. Nothing here is
imported by `src/`, nothing here ships to a browser, and the application has no
fallback that would ever reach for it.

## What it is faithful about

* every request runs in a real PostgreSQL session as `anon`, `authenticated` or
  `service_role`, with `request.jwt.claim.sub` set, so the project's actual RLS
  policies and `auth.uid()` behave exactly as they do behind PostgREST;
* the migrations in `supabase/migrations` are applied unmodified, so the
  waterfall, the share-transfer settlement and the rollover guards under test
  are the real ones;
* object requests (`Accept: application/vnd.pgrst.object+json`) return
  `PGRST116` the way PostgREST does, so `.single()` / `.maybeSingle()` behave
  identically.

## What it deliberately does not do

Embedded resource selects (`select=*,other(*)`), full text search, storage,
realtime, and anything else this app never asks for. If a future screen needs
one of those, add it or run against a real Supabase instance.

## Running it

```bash
# 1. a PostgreSQL instance with the migrations applied
#    (any local Postgres 14+ works; the app's own migrations create the schema)
createdb ndh_preview
for f in supabase/migrations/*.sql; do psql ndh_preview -f "$f"; done

# 2. the stand-in, pointed at that database
PREVIEW_LEDGER_DSN='postgresql://postgres@127.0.0.1:5432/ndh_preview' \
PREVIEW_LEDGER_PORT=8788 \
python3 scripts/preview-ledger/server.py

# 3. the app, pointed at the stand-in
VITE_PREVIEW_LEDGER=true \
VITE_SUPABASE_URL=http://127.0.0.1:8788 \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_preview_anon_key \
SUPABASE_URL=http://127.0.0.1:8788 \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_preview_anon_key \
SUPABASE_SERVICE_ROLE_KEY=sb_secret_preview_service_key \
npm run dev
```

`VITE_PREVIEW_LEDGER=true` renders the notice ribbon from
`src/components/ndh/PreviewRibbon.tsx`, so a build full of demonstration figures
can never be mistaken for member money. Leave it unset and the ribbon is absent.

The keys above are placeholders this process invents; they are not secrets and
they unlock nothing except the local database. Real keys belong in `.env` and in
the deployment environment, never in the repository.

## Demonstration data

Any data in a preview database is throwaway: it is created by an operator
following the same flows a real member would (contribute, verify, log, weigh in,
settle). It is not written by the application and is never committed to the
repository — the product ships with an empty ledger and deliberately elegant
empty states, because inventing member money would be a lie.
