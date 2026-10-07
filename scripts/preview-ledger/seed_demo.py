#!/usr/bin/env python3
"""
Demonstration data for a **local preview database**. Development tooling.

Nothing here ships, and nothing here runs automatically. The application's own
database starts empty: the migrations in supabase/migrations create schema and
policies, never rows. This script exists only so the interface can be reviewed
with something in it on a developer's machine, and it must be run by hand
against a throwaway local database:

    python3 scripts/preview-ledger/seed_demo.py

It builds one coherent co-operative — five commodities, all six lifecycle
stages, a settled cycle with a real waterfall run, and four sign-in accounts —
so that every screen has honest, consistent content to render.

Because the platform's figures are members' money, inventing them anywhere the
product can reach would be the one unforgivable thing. Hence: local only, by
hand only, never imported by src/, never referenced by a migration.

Accounts it creates (password: `agricapital`):
    admin@ndh.com.ng   treasury admin
    farm@ndh.com.ng    farm operator
    musa@ndh.com.ng    member
    aisha@ndh.com.ng   member
"""

from __future__ import annotations

import glob
import os
import pathlib
import shutil
import subprocess
import sys

REPO = pathlib.Path(__file__).resolve().parents[2]
DSN_BASE = os.environ.get("PREVIEW_LEDGER_DSN_BASE", "postgresql://postgres@127.0.0.1:5432")
DB = os.environ.get("PREVIEW_LEDGER_DB", "ndh_preview")
PASSWORD = os.environ.get("PREVIEW_LEDGER_PASSWORD", "agricapital")


def find_psql() -> str:
    """Any psql will do; prefer one on PATH, fall back to a bundled install."""
    on_path = shutil.which("psql")
    if on_path:
        return on_path
    candidates = sorted(pathlib.Path("/tmp").glob("**/pgserver/pginstall/bin/psql"))
    if candidates:
        return str(candidates[0])
    raise SystemExit(
        "No psql found. Install PostgreSQL client tools, or point PREVIEW_LEDGER_DSN_BASE "
        "at a server you already have and run this where psql is available."
    )


PSQL = pathlib.Path(find_psql())

ADMIN = "a0000000-0000-4000-8000-000000000001"
FARMER = "a0000000-0000-4000-8000-000000000002"
MUSA = "a0000000-0000-4000-8000-000000000011"
AISHA = "a0000000-0000-4000-8000-000000000012"
BILAAL = "a0000000-0000-4000-8000-000000000013"
ZAINAB = "a0000000-0000-4000-8000-000000000014"

PEOPLE = [
    (ADMIN, "Najeeb Abubakar", "admin", "admin@ndh.com.ng"),
    (FARMER, "Garba Sani", "operator", "farm@ndh.com.ng"),
    (MUSA, "Musa Ibrahim", "member", "musa@ndh.com.ng"),
    (AISHA, "Aisha Bello", "member", "aisha@ndh.com.ng"),
    (BILAAL, "Bilaal Yusuf", "member", "bilaal@ndh.com.ng"),
    (ZAINAB, "Zainab Okafor", "member", "zainab@ndh.com.ng"),
]

CAT14 = "b0000000-0000-4000-8000-000000000014"
CAT13 = "b0000000-0000-4000-8000-000000000013"
BRD09 = "b0000000-0000-4000-8000-000000000109"
LYR05 = "b0000000-0000-4000-8000-000000000205"
GRN21 = "b0000000-0000-4000-8000-000000000321"
GHO07 = "b0000000-0000-4000-8000-000000000407"
CAT15 = "b0000000-0000-4000-8000-000000000015"
TIL03 = "b0000000-0000-4000-8000-000000000703"


def sql(statement: str, dbname: str = DB, stop: bool = True) -> str:
    args = [str(PSQL), f"{DSN_BASE}/{dbname}", "-q"]
    if stop:
        args += ["-v", "ON_ERROR_STOP=1"]
    proc = subprocess.run(args, input=statement, capture_output=True, text=True)
    out = proc.stdout or ""
    if proc.returncode:
        out += "\nSTDERR: " + proc.stderr
    return out


def people_sql() -> str:
    return "\n".join(
        f"insert into public.profiles (id, full_name) values ('{pid}', '{name}');\n"
        f"insert into public.user_roles (user_id, role) values ('{pid}', '{role}');"
        for pid, name, role, _ in PEOPLE
    )


def cycles_sql() -> str:
    return f"""
insert into public.farm_cycles
  (id, code, commodity, name, summary, farm_site, farm_latitude, farm_longitude,
   target_capital, minimum_ticket, projected_revenue, projected_liabilities,
   cycle_weeks, funding_opens_on, funding_closes_on, stocking_on, projected_harvest_on,
   status, current_stage, locked_at, created_by)
values
  ('{CAT14}', 'CAT-014', 'catfish',
   'Catfish Batch 14 — Tunga Magajiya',
   'Twelve thousand juvenile Clarias in six lined ponds, fed a milled 42% protein ration through a 24-week grow-out.',
   'Tunga Magajiya, Niger State', 9.52380, 6.04890,
   2500000, 25000, 4250000, 300000,
   24, current_date - 70, current_date - 14, current_date - 63, current_date + 105,
   'active', 'operational', now() - interval '70 days', '{ADMIN}'),

  ('{CAT13}', 'CAT-013', 'catfish',
   'Catfish Batch 13 — Tunga Magajiya',
   'The preceding batch: stocked, grown out, weighed in at the pond bank and settled through the full waterfall.',
   'Tunga Magajiya, Niger State', 9.52380, 6.04890,
   1000000, 20000, 1850000, 120000,
   22, current_date - 330, current_date - 250, current_date - 240, current_date - 40,
   'settled', 'waterfall_distribution', now() - interval '330 days', '{ADMIN}'),

  ('{BRD09}', 'BRD-009', 'broiler',
   'Broiler Cycle 9 — Six Week Batch',
   'Five thousand Marshal day-old chicks over a six-week cycle. Weighed in and awaiting the buyer''s collection.',
   'Main farm, Sokoto State', 13.00590, 5.24760,
   1500000, 25000, 2400000, 150000,
   6, current_date - 120, current_date - 90, current_date - 84, current_date - 40,
   'harvested', 'harvest_weighin', now() - interval '120 days', '{ADMIN}'),

  ('{LYR05}', 'LYR-005', 'layer',
   'Layer Cycle 5 — Point of Lay to Peak',
   'Two thousand five hundred point-of-lay pullets carried to peak production; birds and spent feed sold to a Sokoto processor.',
   'Main farm, Sokoto State', 13.00590, 5.24760,
   3000000, 50000, 4320000, 240000,
   52, current_date - 420, current_date - 380, current_date - 372, current_date - 30,
   'harvested', 'sale_settlement', now() - interval '420 days', '{ADMIN}'),

  ('{GRN21}', 'GRN-021', 'grain',
   'Grain Cycle 21 — Maize & Soya Rotation',
   'Nine hectares of maize intercropped with soya on the Tunga Magajiya flood plain. Open for co-op subscriptions.',
   'Tunga Magajiya, Niger State', 9.52380, 6.04890,
   1800000, 10000, 3020000, 210000,
   20, current_date - 12, current_date + 26, null, current_date + 140,
   'open', 'funding_open', now() - interval '12 days', '{ADMIN}'),

  ('{GHO07}', 'GHO-007', 'greenhouse',
   'Greenhouse Cycle 7 — Tomatoes & Bell Peppers',
   'Four hundred square metres under net: tomatoes and bell peppers on a staggered transplant for continuous supply.',
   'Main farm, Sokoto State', 13.00590, 5.24760,
   900000, 15000, 1560000, 90000,
   18, current_date - 2, current_date + 38, null, current_date + 120,
   'open', 'funding_open', now() - interval '2 days', '{ADMIN}'),

  ('{TIL03}', 'TIL-003', 'tilapia',
   'Tilapia Cycle 3 — Tunga Magajiya Tanks',
   'Fourteen thousand monosex Nile tilapia fingerlings across eight lined tanks, transferred to two lake cages at week 10 for the final grow-out.',
   'Tunga Magajiya, Niger State', 9.52380, 6.04890,
   1600000, 20000, 2680000, 190000,
   24, current_date - 6, current_date + 21, null, current_date + 160,
   'open', 'funding_open', now() - interval '6 days', '{ADMIN}'),

  ('{CAT15}', 'CAT-015', 'catfish',
   'Catfish Batch 15 — Tunga Magajiya',
   'Draft plan for the batch that follows CAT-014. Not published, so nothing here is promised to anyone yet.',
   'Tunga Magajiya, Niger State', 9.52380, 6.04890,
   2500000, 25000, 4300000, 300000,
   24, current_date + 10, null, null, current_date + 190,
   'draft', 'funding_open', null, '{ADMIN}');
"""


def investment(cycle: str, member: str, amount: int, when: int, ref: str) -> str:
    return (
        "insert into public.cycle_investments\n"
        "  (cycle_id, member_id, amount, date, method, status, bank_reference, receipt_number,\n"
        "   verified_at, verified_by)\n"
        f"values ('{cycle}', '{member}', {amount}, current_date - {when}, 'manual', 'success',\n"
        f"   '{ref}', 'AGC/' || substr('{cycle}', 1, 4) || '/' || "
        f"to_char(current_date - {when}, 'YYYYMMDD') || '/' || substr(gen_random_uuid()::text, 1, 6),\n"
        f"   now() - interval '{when} days', '{ADMIN}');"
    )


def investments_sql() -> str:
    return "\n".join(
        [
            investment(CAT14, MUSA, 1000000, 60, "TRF-88213"),
            investment(CAT14, AISHA, 750000, 58, "TRF-88240"),
            investment(CAT14, BILAAL, 500000, 55, "TRF-88291"),
            investment(CAT14, ZAINAB, 250000, 52, "TRF-88302"),
            investment(CAT13, MUSA, 600000, 322, "TRF-10422"),
            investment(CAT13, AISHA, 400000, 320, "TRF-10433"),
            investment(BRD09, MUSA, 600000, 115, "TRF-20118"),
            investment(BRD09, AISHA, 450000, 112, "TRF-20144"),
            investment(BRD09, BILAAL, 450000, 110, "TRF-20152"),
            investment(LYR05, ZAINAB, 1500000, 410, "TRF-30017"),
            investment(LYR05, MUSA, 900000, 405, "TRF-30029"),
            investment(LYR05, AISHA, 600000, 402, "TRF-30040"),
            investment(GRN21, MUSA, 320000, 9, "TRF-41102"),
            investment(GRN21, AISHA, 400000, 7, "TRF-41118"),
            investment(GRN21, ZAINAB, 400000, 4, "TRF-41126"),
            investment(GHO07, ZAINAB, 150000, 1, "TRF-50011"),
            investment(TIL03, MUSA, 300000, 5, "TRF-60301"),
            investment(TIL03, BILAAL, 200000, 3, "TRF-60318"),
        ]
    )


def logs_sql() -> str:
    samples: list[str] = []
    weights = [40, 95, 165, 250, 340, 430, 540, 640]
    populations = [12000, 11980, 11960, 11920, 11890, 11840, 11790, 11740]
    for index, (weight, population) in enumerate(zip(weights, populations)):
        days_ago = 56 - index * 7
        biomass = round(population * weight / 1000)
        summary = (
            "Week {week} sample: {pop:,} head, {weight} g average weight, {bio:,} kg standing biomass."
        ).format(week=index + 1, pop=population, weight=weight, bio=biomass)
        samples.append(
            f"""
insert into public.operational_logs
  (cycle_id, log_type, log_date, sample_count, sample_avg_weight_g, population_count, biomass_kg,
   public_summary, notes, recorded_by, review_status, reviewed_by, reviewed_at)
values ('{CAT14}', 'growth_sample', current_date - {days_ago}, 40, {weight}, {population}, {biomass},
  '{summary}', 'Forty fish netted at random from ponds 1-3 and weighed on the batch scale.',
  '{FARMER}', 'approved', '{ADMIN}', now() - interval '{days_ago} days');"""
        )

    daily: list[str] = []
    for days_ago in range(20, 0, -1):
        bags = 6 if days_ago % 3 else 8
        deaths = 6 if days_ago % 5 == 0 else 2
        daily.append(
            f"""
insert into public.operational_logs
  (cycle_id, log_type, log_date, feed_kg, feed_bags, mortality_count, mortality_reason, notes,
   recorded_by, review_status, public_summary)
values ('{CAT14}', 'feed', current_date - {days_ago}, {bags * 15}, {bags}, {deaths},
  'Handling and cannibalism', 'Two feeding rounds, ponds 1-6.', '{FARMER}', 'approved',
  'Daily feeding rounds completed across all six ponds.');"""
        )
    daily.append(
        f"""
insert into public.operational_logs
  (cycle_id, log_type, log_date, medication, notes, recorded_by, review_status, public_summary)
values ('{CAT14}', 'medication', current_date - 30,
  'Oxytetracycline bath, 5 days', 'Preventive treatment after a gill check.', '{FARMER}', 'approved',
  'Preventive bath completed across all six ponds; no clinical signs recorded.');

insert into public.operational_logs
  (cycle_id, log_type, log_date, notes, recorded_by, review_status)
values ('{CAT14}', 'general', current_date - 8,
  'One aerator serviced, spare paddle wheel kept on site.', '{FARMER}', 'pending');"""
    )

    broilers = "".join(
        f"""
insert into public.operational_logs
  (cycle_id, log_type, log_date, sample_count, sample_avg_weight_g, feed_kg, notes, public_summary,
   recorded_by, review_status, reviewed_by, reviewed_at)
values ('{BRD09}', 'growth_sample', current_date - {120 - week * 7}, 50, {weight},
  {feed}, 'Weekly broiler sample.', 'Week {week} sample: {weight} g average live weight.',
  '{FARMER}', 'approved', '{ADMIN}', now() - interval '{120 - week * 7} days');"""
        for week, (weight, feed) in enumerate(
            [(180, 620), (420, 1250), (830, 2100), (1250, 2700), (1620, 3200), (1880, 3600)],
            start=1,
        )
    )
    return "\n".join(samples) + "\n".join(daily) + broilers


def money_sql() -> str:
    return f"""
insert into public.farm_expenses (cycle_id, amount, date, category, vendor, note, is_payable, settled_on, recorded_by)
values
  ('{CAT14}', 600000, current_date - 66, 'Stock', 'Tunga Hatchery Ltd', '12,000 juvenile Clarias @ ₦50', false, current_date - 66, '{FARMER}'),
  ('{CAT14}', 540000, current_date - 40, 'Feed', 'Sokoto Feed Mills', '36 bags of 15 kg milled ration, first tranche', false, current_date - 40, '{FARMER}'),
  ('{CAT14}', 480000, current_date - 12, 'Feed', 'Sokoto Feed Mills', '32 bags, second tranche', true, null, '{FARMER}'),
  ('{CAT14}', 85000, current_date - 30, 'Veterinary', 'Rima Agro Vet', 'Oxytetracycline bath and gill check', false, current_date - 30, '{FARMER}'),
  ('{CAT14}', 120000, current_date - 5, 'Labour', 'Pond attendants', 'Two attendants, monthly', true, null, '{FARMER}'),
  ('{BRD09}', 450000, current_date - 118, 'Stock', 'Zaria Hatcheries', '5,000 Marshal day-old chicks', false, current_date - 118, '{FARMER}'),
  ('{BRD09}', 980000, current_date - 100, 'Feed', 'Sokoto Feed Mills', 'Broiler starter and finisher', false, current_date - 100, '{FARMER}'),
  ('{LYR05}', 2200000, current_date - 415, 'Stock', 'Obasanjo Farms', '2,500 point-of-lay pullets', false, current_date - 415, '{FARMER}'),
  ('{GRN21}', 210000, current_date - 8, 'Land prep', 'Tunga tractor hire', 'Nine hectares ploughed and harrowed', false, current_date - 8, '{FARMER}');

insert into public.harvest_records
  (cycle_id, harvest_date, total_weight_kg, total_count, scale_ticket_ref, buyer, buyer_note,
   gross_revenue, revenue_received_on, recorded_by)
values
  ('{CAT13}', current_date - 45, 5600, 11800, 'NDH-SC-2107', 'Sokoto Fresh Fish Market',
   'Sold live at the pond bank, paid in two tranches.', 1850000, current_date - 40, '{FARMER}'),
  ('{BRD09}', current_date - 38, 9850, 4900, 'NDH-SC-2291', null,
   'Weighed in and held cold; buyer collection pending.', 0, null, '{FARMER}'),
  ('{LYR05}', current_date - 28, 0, 2450, 'NDH-SC-2312', 'Sokoto Central Foods Ltd',
   'Spent layers and surplus feed sold as one lot.', 4320000, current_date - 24, '{ADMIN}');

insert into public.weather_snapshots (cycle_id, captured_on, rainfall_mm, temp_min_c, temp_max_c, humidity_percent, source, note, recorded_by)
select '{CAT14}', current_date - n, round((random() * 18)::numeric, 1), 22 + (n % 3),
       34 + (n % 4), 60 + (n % 25)::int, 'NIMET station, Minna', 'Daily reading taken at the pond side.', '{FARMER}'
from generate_series(1, 14) as n;

insert into public.incidents (cycle_id, title, category, severity, status, occurred_on, description,
  estimated_impact, insurance_claim_ref, logged_by)
values
  ('{CAT14}', 'Aerator failure overnight in pond 3', 'Equipment', 'moderate', 'mitigating',
   current_date - 9,
   'The paddle wheel stalled around 02:00. The attendant moved the spare aerator across and no mortality spike followed.',
   45000, 'NDH-INS-2026-0088', '{FARMER}');

insert into public.farm_visits (cycle_id, member_id, visit_date, slot, guests, status, member_note)
values
  ('{CAT14}', '{MUSA}', current_date + 6, 'morning', 2, 'requested',
   'Bringing my brother to see the ponds.'),
  ('{CAT14}', '{AISHA}', current_date + 13, 'afternoon', 1, 'confirmed',
   'Would like to see the sampling done.');
"""


def settlement_sql() -> str:
    return f"""
select public.run_cycle_waterfall(
  '{CAT13}'::uuid, 1850000::numeric,
  'Pond-bank sale of 5,600 kg live catfish, scale ticket NDH-SC-2107.'
);

insert into public.rollover_instructions (member_id, mode, preferred_cycle_id, note)
values ('{AISHA}', 'both', '{GRN21}', 'Carry whatever comes back from CAT-013 into the grain cycle.');

-- One payout already made; the other stays pending so the treasury console has
-- something real to act on.
update public.waterfall_lines
set payout_status = 'paid',
    payout_reference = 'NDH-PAY-2026-0451',
    paid_at = now() - interval '3 days'
where cycle_id = '{CAT13}' and member_id = '{MUSA}';
"""


def main() -> None:
    print(sql(f"drop database if exists {DB} with (force);", "postgres"))
    print(sql(f"create database {DB};", "postgres"))
    print(
        sql(
            """
create schema if not exists auth;
create schema if not exists private;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
"""
        )
    )

    migrations = sorted(glob.glob(str(REPO / "supabase/migrations/*.sql")))
    for path in migrations:
        out = sql(open(path).read())
        print("migration", path.split("/")[-1], "->", "ok" if "STDERR" not in out else out[-800:])

    seed = "\n".join(
        [
            "set client_min_messages = warning;",
            people_sql(),
            cycles_sql(),
            investments_sql(),
            logs_sql(),
            money_sql(),
            settlement_sql(),
        ]
    )
    out = sql(seed)
    print("seed ->", out.strip()[-300:] if out.strip() else "clean")

    sys.path.insert(0, str(REPO / "scripts/preview-ledger"))
    from server import hash_password  # noqa: E402

    import psycopg

    with psycopg.connect(f"{DSN_BASE}/{DB}") as conn:
        conn.execute(
            """create table if not exists preview_users (
                 id uuid primary key default gen_random_uuid(),
                 email text not null unique,
                 password_hash text not null,
                 full_name text,
                 created_at timestamptz not null default now())"""
        )
        for pid, name, _role, email in PEOPLE:
            conn.execute(
                """insert into preview_users (id, email, password_hash, full_name)
                   values (%s, %s, %s, %s)
                   on conflict (email) do update set password_hash = excluded.password_hash""",
                (pid, email, hash_password(PASSWORD), name),
            )

    print(
        sql(
            """
select c.code, c.status, c.current_stage, f.raised_capital, f.funded_percent
from public.farm_cycles c join public.cycle_funding f on f.cycle_id = c.id
order by c.code;
"""
        )
    )


if __name__ == "__main__":
    main()
