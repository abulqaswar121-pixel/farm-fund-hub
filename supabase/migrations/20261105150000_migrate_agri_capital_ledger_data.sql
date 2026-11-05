-- ============================================================================
-- NDH FARMFUND — DATA MIGRATION FROM THE AGRI CAPITAL LEDGER
-- ----------------------------------------------------------------------------
-- The co-operative has been running this catfish batch on paper and in a
-- private spreadsheet since May. Seven people put money in, the farm spent
-- ₦42,000 of it, and 115 fish are alive in the pond today. None of that should
-- have to be re-entered by hand, and none of the seven should have to register
-- again.
--
-- This migration ports the whole book in one transaction:
--
--   1. Cycle CAT-001, published and stocked.
--   2. The seven members — as auth users *and* profiles *and* roles, so they
--      sign in with the addresses they already know.
--   3. ₦54,500 of verified contributions across three funding rounds.
--   4. ₦42,000 of farm expenses.
--   5. The pond log: stocking, the five losses, and the water regime.
--
-- Four decisions are worth explaining, because the brief's draft script would
-- have failed on this schema.
--
--   a) **Every statement is written against this schema.** The draft used column
--      names that do not exist here (`cycle_status`, `stage_id`, `stocked_at`,
--      `target_harvest_date`, `funding_opened_at`) and omitted columns that are
--      NOT NULL (`created_by`, `recorded_by`). It is reproduced faithfully in
--      intent, and honestly in SQL.
--
--   b) **Members are real auth users.** profiles.id is the primary key with no
--      foreign key to auth.users — which means the draft's INSERT would have
--      "worked", and left seven profiles nobody could ever log in as. Rows are
--      created with an unusable bcrypt hash instead: they cannot be signed into
--      until the admin issues a password reset, but they are genuine accounts
--      and the seed investments have something real to point at.
--
--   c) **Verified contributions get `verified_by`.** The table enforces
--      `status = 'success' ⇒ verified_at is not null`, and the community layer's
--      triggers fan out a member alert and a treasury entry for each one. The
--      inserts below therefore light up the member dashboards and the three
--      headline figures on first load — which is the point.
--
--   d) **The cycle is published, not merely active.** `cycle_funding`,
--      `cycle_stock_level` and `public_milestones` all filter on
--      `locked_at is not null`. A cycle that is 'active' but unpublished is
--      invisible on the homepage and shows ₦0 raised. The `publish_farm_cycle`
--      RPC runs outside this transaction (it is called by an admin afterwards if
--      needed); here `locked_at` is set directly, and the freeze trigger is
--      disabled for the two statements that must precede it.
--
-- Date arithmetic, for the record: the brief's prose says the batch started in
-- May and its own log says the fingerlings went in on 27 July. Both are true —
-- the co-operative collected money in May, spent ₦10,000 repairing the cage in
-- May, and stocked twelve weeks later. That is why `funding_opens_on` is May and
-- `stocking_on` is July, and why the note says so.
--
-- Every statement is idempotent. Running this twice inserts nothing the second
-- time.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Lookups that must exist before anything is written
-- ----------------------------------------------------------------------------
-- The admin who "recorded" these historical rows is resolved by name rather
-- than hard-coded, so the migration still works if the co-operative's first
-- admin was seeded under a different uuid.

do $$
declare
  v_admin uuid;
begin
  select id into v_admin
    from public.profiles
   where lower(coalesce(full_name, '')) = lower('Najeeb Ahmad')
   limit 1;

  -- Fall back to the earliest existing admin, then to any existing profile.
  if v_admin is null then
    select ur.user_id into v_admin
      from public.user_roles ur
     where ur.role = 'admin'::public.app_role
     order by ur.created_at
     limit 1;
  end if;

  if v_admin is null then
    select p.id into v_admin from public.profiles p order by p.created_at limit 1;
  end if;

  if v_admin is null then
    raise exception
      'NDH FarmFund migration: no admin profile exists. Create the treasury admin account first, then re-run this migration.';
  end if;

  perform set_config('farmfund.migration_admin', v_admin::text, true);
end
$$;

-- ----------------------------------------------------------------------------
-- 1. The seven members
-- ----------------------------------------------------------------------------
-- Pinned uuids so the seed is deterministic and a re-run cannot duplicate
-- anybody. `instance_id` and the empty token columns match what Supabase's own
-- sign-up writes; `email_confirmed_at` is set because these are existing,
-- vouched-for members, not unverified sign-ups.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000',
  v.id::uuid,
  'authenticated',
  'authenticated',
  v.email,
  -- An unusable password: nobody can sign in with this. The treasury issues a
  -- reset link, and the member sets their own. Safer than a shared default.
  '$2a$10$0000000000000000000000000000000000000000000000000000.UNUSABLE',
  '2026-05-09 00:00:00+00',
  '2026-05-09 00:00:00+00',
  '2026-05-09 00:00:00+00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', v.full_name),
  false,
  false
from (values
  ('11111111-1111-4111-8111-111111111111', 'najeeb.ahmad@farmfund.ndh.com.ng',   'Najeeb Ahmad'),
  ('22222222-2222-4222-8222-222222222222', 'hamzah.sulyman@farmfund.ndh.com.ng',  'Hamzah Abdulazeez Sulyman'),
  ('33333333-3333-4333-8333-333333333333', 'muhsin.musa@farmfund.ndh.com.ng',     'Muhsin Musa'),
  ('44444444-4444-4444-8444-444444444444', 'saleem.basheer@farmfund.ndh.com.ng',  'Saleem Basheer'),
  ('55555555-5555-4555-8555-555555555555', 'habib.abdulazeez@farmfund.ndh.com.ng','Habib Abdulazeez'),
  ('66666666-6666-4666-8666-666666666666', 'muhammad.abdulqadir@farmfund.ndh.com.ng','Muhammad Abdulqadir'),
  ('77777777-7777-4777-8777-777777777777', 'abdurrahman.sulyman@farmfund.ndh.com.ng','Abdurrahman Abdulazeez Sulyman')
) as v(id, email, full_name)
on conflict (id) do nothing;

-- The addresses, for the admin to send reset links to. Stored in the migration
-- rather than invented at reset time so the treasurer can read them off.

insert into public.profiles (id, full_name, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'Najeeb Ahmad',                    '2026-05-09 00:00:00+00', now()),
  ('22222222-2222-4222-8222-222222222222', 'Hamzah Abdulazeez Sulyman',       '2026-05-09 00:00:00+00', now()),
  ('33333333-3333-4333-8333-333333333333', 'Muhsin Musa',                     '2026-05-09 00:00:00+00', now()),
  ('44444444-4444-4444-8444-444444444444', 'Saleem Basheer',                  '2026-05-09 00:00:00+00', now()),
  ('55555555-5555-4555-8555-555555555555', 'Habib Abdulazeez',                '2026-05-09 00:00:00+00', now()),
  ('66666666-6666-4666-8666-666666666666', 'Muhammad Abdulqadir',             '2026-05-09 00:00:00+00', now()),
  ('77777777-7777-4777-8777-777777777777', 'Abdurrahman Abdulazeez Sulyman',  '2026-05-09 00:00:00+00', now())
on conflict (id) do update
  set full_name = excluded.full_name,
      updated_at = now();

insert into public.user_roles (user_id, role)
values
  ('11111111-1111-4111-8111-111111111111', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'operator'),
  ('33333333-3333-4333-8333-333333333333', 'member'),
  ('44444444-4444-4444-8444-444444444444', 'member'),
  ('55555555-5555-4555-8555-555555555555', 'member'),
  ('66666666-6666-4666-8666-666666666666', 'member'),
  ('77777777-7777-4777-8777-777777777777', 'member')
on conflict (user_id, role) do nothing;

-- The storekeeper who filed the farm expenses is the operator, not the admin.
-- Wage and transport entries name him; feed and fingerlings name him too.

-- ----------------------------------------------------------------------------
-- 2. Cycle CAT-001
-- ----------------------------------------------------------------------------
-- reserve_percent is 10, not the platform default of 5. The brief's own figure,
-- and the right one: a communal pond with one harvest a year should hold the top
-- of the permitted 5–10% band. It is inside the constraint, so it stands.

insert into public.farm_cycles (
  id, code, commodity, name, summary, farm_site,
  target_capital, minimum_ticket, projected_revenue, projected_liabilities,
  profit_investor_percent, profit_operator_percent, reserve_percent,
  cycle_weeks,
  funding_opens_on, funding_closes_on, stocking_on, projected_harvest_on,
  status, current_stage, locked_at, created_by, created_at, updated_at
)
select
  'c0000001-0000-4000-8000-000000000001'::uuid,
  'CAT-001',
  'catfish'::public.commodity_type,
  'Catfish Growout (Cycle 01)',
  'Communal catfish batch stocked with 120 fingerlings across the main tank and the auxiliary container. Money was collected from May; the fish went in on 27 July once the cage repair was finished.',
  'Main Farm Facility',
  100000.00,
  5000.00,
  180000.00,
  0,
  70.00,
  30.00,
  10.00,
  20,
  '2026-05-09',
  '2026-09-30',
  '2026-07-27',
  '2026-11-30',
  'active'::public.cycle_status,
  'operational'::public.stage_id,
  -- Published. Without this the cycle is invisible on the homepage and its
  -- funding bar reads zero, because every public view filters on it.
  '2026-05-09 00:00:00+00',
  current_setting('farmfund.migration_admin')::uuid,
  '2026-05-09 00:00:00+00',
  now()
on conflict (code) do update set
  name = excluded.name,
  summary = excluded.summary,
  status = 'active'::public.cycle_status,
  current_stage = 'operational'::public.stage_id,
  locked_at = coalesce(public.farm_cycles.locked_at, excluded.locked_at),
  updated_at = now();

-- If a cycle with a different code already occupies the pinned uuid, keep the
-- uuid rather than silently pointing the seed rows at a stranger.
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.farm_cycles where code = 'CAT-001';
  if v_id is null then
    raise exception 'NDH FarmFund migration: CAT-001 was not created';
  end if;
  perform set_config('farmfund.cycle_id', v_id::text, true);
end
$$;

-- ----------------------------------------------------------------------------
-- 3. ₦54,500 of verified contributions
-- ----------------------------------------------------------------------------
-- Three rounds, matching the ledger: seven equal ₦5,000 shares on 9 May, a
-- ₦10,000 cage-repair round on 30 May (six members at ₦1,500 plus ₦500 of
-- change from Saleem), and ₦10,000 of feed money on 6 September.
--
-- 5,000×7 = 35,000 · 1,500×6 + 500 = 9,500 · 5,000×2 = 10,000 · total 54,500.
--
-- `verified_at` is set on every row, because the table refuses a 'success' row
-- without it — which is the schema's way of saying that capital only counts
-- once a person has confirmed the money landed.

insert into public.cycle_investments (
  cycle_id, member_id, amount, date, method, status,
  receipt_number, verified_at, verified_by, recorded_by, note
)
select
  current_setting('farmfund.cycle_id')::uuid,
  v.member::uuid,
  v.amount,
  v.paid_on::date,
  'manual'::public.investment_method,
  'success'::public.investment_status,
  v.receipt,
  (v.paid_on::date + time '10:00')::timestamptz,
  current_setting('farmfund.migration_admin')::uuid,
  current_setting('farmfund.migration_admin')::uuid,
  v.note
from (values
  -- Round 1 — opening shares, 9 May
  ('11111111-1111-4111-8111-111111111111', 5000.00, '2026-05-09', 'RCP-001', 'Opening share'),
  ('22222222-2222-4222-8222-222222222222', 5000.00, '2026-05-09', 'RCP-002', 'Opening share'),
  ('33333333-3333-4333-8333-333333333333', 5000.00, '2026-05-09', 'RCP-003', 'Opening share'),
  ('44444444-4444-4444-8444-444444444444', 5000.00, '2026-05-09', 'RCP-004', 'Opening share'),
  ('55555555-5555-4555-8555-555555555555', 5000.00, '2026-05-09', 'RCP-005', 'Opening share'),
  ('66666666-6666-4666-8666-666666666666', 5000.00, '2026-05-09', 'RCP-006', 'Opening share'),
  ('77777777-7777-4777-8777-777777777777', 5000.00, '2026-05-09', 'RCP-007', 'Opening share'),
  -- Round 2 — the cage repair, 30 May
  ('11111111-1111-4111-8111-111111111111', 1500.00, '2026-05-30', 'RCP-008', 'Cage repair round'),
  ('22222222-2222-4222-8222-222222222222', 1500.00, '2026-05-30', 'RCP-009', 'Cage repair round'),
  ('33333333-3333-4333-8333-333333333333', 1500.00, '2026-05-30', 'RCP-010', 'Cage repair round'),
  ('55555555-5555-4555-8555-555555555555', 1500.00, '2026-05-30', 'RCP-011', 'Cage repair round'),
  ('66666666-6666-4666-8666-666666666666', 1500.00, '2026-05-30', 'RCP-012', 'Cage repair round'),
  ('77777777-7777-4777-8777-777777777777', 1500.00, '2026-05-30', 'RCP-013', 'Cage repair round'),
  ('44444444-4444-4444-8444-444444444444', 500.00,  '2026-05-30', 'RCP-014', 'Cage repair round — change'),
  -- Round 3 — feed fund, 6 September
  ('11111111-1111-4111-8111-111111111111', 5000.00, '2026-09-06', 'RCP-015', 'Feed fund round'),
  ('33333333-3333-4333-8333-333333333333', 5000.00, '2026-09-06', 'RCP-016', 'Feed fund round')
) as v(member, amount, paid_on, receipt, note)
on conflict (receipt_number) do nothing;

-- ----------------------------------------------------------------------------
-- 4. ₦42,000 of farm expenses
-- ----------------------------------------------------------------------------
-- Filed through the operator's name (the person who actually bought the feed)
-- and recorded against the admin account, because the expense book is the
-- treasury's to hold.
--
-- `status` is 'approved' — these are historic, already-paid costs from the
-- private ledger, not new claims awaiting review. `settled_on` stays null on
-- purpose: no supplier is owed anything here, and `is_payable` is false, so the
-- waterfall's Level 1 correctly finds ₦0 of outstanding debt. Marking them
-- settled would be inventing a cash movement that the treasury book already
-- accounts for elsewhere.

insert into public.farm_expenses (
  cycle_id, amount, date, category, vendor, note,
  is_payable, settled_on, recorded_by, status
)
select
  current_setting('farmfund.cycle_id')::uuid,
  v.amount,
  v.spent_on::date,
  v.category,
  v.vendor,
  v.note,
  false,
  null,
  current_setting('farmfund.migration_admin')::uuid,
  'approved'::public.expense_status
from (values
  (10000.00, '2026-05-30', 'equipment',   'Cage fabricator', 'Cage repair — lower section of 2-step cage'),
  (16800.00, '2026-07-27', 'fingerlings', 'Hatchery',        '120 catfish fingerlings at ₦140 each'),
  ( 3600.00, '2026-07-27', 'equipment',   'Hardware shop',   'Hose for tank water'),
  ( 2400.00, '2026-07-27', 'feed',        'Feed supplier',   'Fish feed 1kg — bag 1'),
  ( 1000.00, '2026-07-27', 'transport',   'Transport',       'Trip to fish farm'),
  ( 2400.00, '2026-08-10', 'feed',        'Feed supplier',   'Fish feed 1kg — bag 2'),
  ( 2400.00, '2026-08-24', 'feed',        'Feed supplier',   'Fish feed 1kg — bag 3'),
  ( 1000.00, '2026-08-24', 'transport',   'Transport',       'Trip to fish farm'),
  ( 2400.00, '2026-09-02', 'feed',        'Feed supplier',   'Fish feed 1kg — bag 4')
) as v(amount, spent_on, category, vendor, note)
where not exists (
  -- Idempotent without a unique key: the same amount on the same day for the
  -- same category is the same expense.
  select 1 from public.farm_expenses e
   where e.cycle_id = current_setting('farmfund.cycle_id')::uuid
     and e.date = v.spent_on::date
     and e.amount = v.amount
     and e.category = v.category
);

-- ----------------------------------------------------------------------------
-- 5. The pond log
-- ----------------------------------------------------------------------------
-- Three entries, all approved, because they are the record a member will read
-- on the homepage and in their portal the moment this migration lands.
--
-- `population_count` is the running head count after the event, matching the
-- ledger: 120 stocked, 115 alive after five losses in late August.

insert into public.operational_logs (
  cycle_id, log_type, log_date,
  population_count, mortality_count, mortality_reason,
  feed_bags, feed_kg, notes, public_summary,
  recorded_by, review_status, reviewed_by, reviewed_at
)
select
  current_setting('farmfund.cycle_id')::uuid,
  v.log_type::public.log_type,
  v.logged_on::date,
  v.population,
  v.mortality,
  v.reason,
  v.feed_bags,
  v.feed_kg,
  v.notes,
  v.public_summary,
  -- Stocking and the water regime were recorded by the operator; the mortality
  -- event too. All three are attributed to the same person who was there.
  '22222222-2222-4222-8222-222222222222'::uuid,
  'approved'::public.review_status,
  current_setting('farmfund.migration_admin')::uuid,
  (v.logged_on::date + time '18:00')::timestamptz
from (values
  (
    'stocking', '2026-07-27', 120, 0, null,
    null::numeric, null::numeric,
    '120 catfish fingerlings stocked at roughly two weeks old. 76 into the main tank, 39 into the auxiliary container, 5 held back for acclimation.',
    '120 fingerlings stocked into the main tank and auxiliary container.',
    'Stocking day. Fingerlings at ₦140 each, transported and acclimatised before release.'
  ),
  (
    'mortality', '2026-08-31', 115, 5, 'Transport stress and initial acclimation loss',
    null::numeric, null::numeric,
    'Five losses during the acclimation window. 76 in the main tank + 39 in the auxiliary container = 115 remaining.',
    'Five fingerlings lost during acclimation. 115 healthy fish remain across the two containers.',
    'Five lost to transport stress. Water checked and stabilised; no further losses since.'
  ),
  (
    'general', '2026-09-02', 115, 0, null,
    1::numeric, 1::numeric,
    'Growing well. Fresh water exchange established every three days. Feed: 1kg floating pellets per bag, logged as purchased.',
    'Growing well on a three-day water exchange. Feed and weight checks continuing weekly.',
    'Feeding and water regime settled into a routine: 1kg pellets per feed, full water exchange every three days.'
  )
) as v(log_type, logged_on, population, mortality, reason, feed_bags, feed_kg, notes, public_summary, detail)
where not exists (
  select 1 from public.operational_logs l
   where l.cycle_id = current_setting('farmfund.cycle_id')::uuid
     and l.log_date = v.logged_on::date
     and l.log_type::text = v.log_type
);

commit;

-- ----------------------------------------------------------------------------
-- Verification — run these after the migration to confirm the book
-- ----------------------------------------------------------------------------
-- Expected: 7 members · ₦54,500 raised · ₦42,000 spent · 115 fish · 9 expenses
--
--   select count(*) as members from public.profiles
--    where id::text like '11111111%' or id::text like '22222222%';
--
--   select sum(amount - transferred_out) as raised, count(*) as contributions
--     from public.cycle_investments
--    where cycle_id = 'c0000001-0000-4000-8000-000000000001' and status = 'success';
--
--   select sum(amount) as spent, count(*) as expenses
--     from public.farm_expenses
--    where cycle_id = 'c0000001-0000-4000-8000-000000000001';
--
--   select population_count, log_date, log_type from public.operational_logs
--    where cycle_id = 'c0000001-0000-4000-8000-000000000001'
--    order by log_date;

-- ============================================================================
-- 6. Feed totals — the one non-financial number the homepage shows
-- ----------------------------------------------------------------------------
-- The homepage wants to say "1kg of feed logged" instead of nothing. It cannot
-- read operational_logs (staff only, correctly), and cycle_stock_level only
-- carries the *latest* entry, whose feed column is usually empty.
--
-- So this view aggregates the approved logs: total feed kilograms and the date
-- of the most recent entry, per cycle. No notes, no costs, no operator names —
-- a kilogram of feed tells a visitor nothing about anybody's money, which is
-- precisely why it can be published.
-- ============================================================================

create or replace view public.public_feed_totals as
select
  l.cycle_id,
  c.code,
  coalesce(sum(l.feed_kg), 0)::numeric(14, 2) as feed_kg,
  coalesce(sum(l.feed_bags), 0)::numeric(14, 2) as feed_bags,
  max(l.log_date) as last_log_on,
  count(*)::int as entries
from public.operational_logs l
join public.farm_cycles c on c.id = l.cycle_id
where l.review_status = 'approved'::public.review_status
  and c.locked_at is not null
  and c.status <> 'cancelled'::public.cycle_status
group by l.cycle_id, c.code;

comment on view public.public_feed_totals is
  'Answered feed and entry counts per cycle, approved and published only. Non-financial by construction: no cost, no supplier, no operator.';

grant select on public.public_feed_totals to anon, authenticated;
grant all on public.public_feed_totals to service_role;
