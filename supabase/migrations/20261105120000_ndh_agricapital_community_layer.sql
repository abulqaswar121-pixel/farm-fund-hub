-- ============================================================================
-- NDH AGRICAPITAL — community & treasury layer
-- ----------------------------------------------------------------------------
-- Adds the pieces the co-operative runs on day to day, on top of the core
-- ledger (20261007120000 … 20261007120400):
--
--   * a member's payout bank details, WhatsApp line and notification choices,
--     plus their monthly Agri-Save commitment;
--   * photo *and* video proof attached to a farm log;
--   * the treasury: one published figure per bucket (capital in, cash out,
--     what is left), derived from the ledger and never typed in by hand;
--   * the activity log: every expense, withdrawal and settlement, published to
--     members the moment it is recorded, with an unread alert per member;
--   * an approval trail for expenses logged by operators, so a farm worker can
--     file a receipt and a treasury admin clears it;
--   * the three single-page A4 documents (certificate, receipt, settlement
--     statement) as data, so they can be printed, re-printed and verified by QR.
--
-- Everything here is ADDITIVE. No existing table, view, policy or row is
-- dropped or rewritten, and every money figure stays derived.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enumerations
-- ----------------------------------------------------------------------------
-- A value added to an enum cannot be *used* in the same transaction, so these
-- are separate statements that nothing below depends on until the next file in
-- the chain — but each type below is new, so there is no such collision here.

create type public.expense_status as enum (
  'pending',    -- filed by an operator, awaiting treasury approval
  'approved',   -- checked against the receipt, counts as an incurred cost
  'rejected'    -- refused; it stays on the record with the reason
);

create type public.treasury_entry_kind as enum (
  'capital_in',        -- a verified contribution landing in the treasury
  'expense_out',       -- money actually paid out for farm operations
  'payout_out',        -- a settlement paid to a member
  'reserve_in',        -- an emergency reserve set aside at settlement
  'top_up'             -- a manual, fully justified treasury movement
);

create type public.plan_cadence as enum ('none', 'monthly');

create type public.document_kind as enum (
  'investment_certificate',
  'payment_receipt',
  'harvest_statement'
);

-- ----------------------------------------------------------------------------
-- 2. A member's own settings
-- ----------------------------------------------------------------------------
-- Payout details, the WhatsApp line the farm updates go to, and notification
-- choices. These live on profiles because they are the member's own record —
-- roles stay in user_roles, and nothing here can raise a permission.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists whatsapp_number text,
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists account_name text,
  -- The bank holding the account was confirmed against a name lookup. Only a
  -- server function sets this, and only after the account number matches the
  -- holder name the member gave us.
  add column if not exists bank_verified_at timestamptz,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_whatsapp boolean not null default true,
  -- The member's monthly Agri-Save commitment, in naira. Null means they have
  -- not chosen a plan yet. The floor is enforced below, not in the form.
  add column if not exists monthly_plan_amount numeric(16, 2),
  add column if not exists monthly_plan_active boolean not null default false,
  add column if not exists monthly_plan_started_on date;

-- A commitment below the co-operative's floor is not a plan, it is a typo.
alter table public.profiles
  drop constraint if exists profiles_monthly_plan_floor;
alter table public.profiles
  add constraint profiles_monthly_plan_floor
  check (monthly_plan_amount is null or monthly_plan_amount >= 5000);

alter table public.profiles
  drop constraint if exists profiles_account_number_shape;
alter table public.profiles
  add constraint profiles_account_number_shape
  check (account_number is null or account_number ~ '^[0-9]{10}$');

comment on column public.profiles.monthly_plan_amount is
  'Agri-Save commitment in naira. The database refuses anything below ₦5,000.';
comment on column public.profiles.bank_verified_at is
  'Set only by the server after the account name was resolved. A member cannot stamp this themselves.';

-- A member may edit their own settings, but may never edit their own
-- verification stamp or their role — so bank_verified_at is pinned to its
-- previous value on any client write.
create or replace function private.pin_profile_verification()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if auth.uid() is not null and not private.has_role(auth.uid(), 'admin'::public.app_role) then
    new.bank_verified_at := old.bank_verified_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_pin_verification on public.profiles;
create trigger profiles_pin_verification
  before update on public.profiles
  for each row execute function private.pin_profile_verification();

-- ----------------------------------------------------------------------------
-- 3. Photo and video proof on a farm log
-- ----------------------------------------------------------------------------
-- operational_logs already carries photo_url for a single still. The farm team
-- increasingly sends a short clip, and a log may carry both, so the proof is
-- modelled as its own small set of rows rather than widening the log table.

create table public.log_media (
  id uuid primary key default gen_random_uuid(),
  log_id uuid references public.operational_logs(id) on delete cascade,
  cycle_id uuid not null references public.farm_cycles(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  url text not null,
  caption text,
  captured_by uuid not null,
  created_at timestamptz not null default now()
);

create index log_media_log_idx on public.log_media (log_id);
create index log_media_cycle_idx on public.log_media (cycle_id, created_at desc);

grant select, insert, update, delete on public.log_media to authenticated;
grant all on public.log_media to service_role;
alter table public.log_media enable row level security;

create policy "Members see the proof on a cycle they can see"
  on public.log_media for select
  to authenticated
  using (
    exists (
      select 1 from public.operational_logs l
      where l.id = log_media.log_id
        and (l.review_status = 'approved'::public.review_status or private.is_staff(auth.uid()))
    )
  );

create policy "Farm staff upload proof"
  on public.log_media for insert
  to authenticated
  with check (private.is_staff(auth.uid()) and captured_by = auth.uid());

create policy "Admins remove proof"
  on public.log_media for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.log_media is
  'Photo and video proof attached to a farm log. A member sees it only once the log it belongs to is approved.';

-- ----------------------------------------------------------------------------
-- 4. Expense approval trail
-- ----------------------------------------------------------------------------
-- farm_expenses is the cost book the waterfall reads. This adds the review
-- state on top of it: an operator files, a treasury admin approves, and only an
-- approved row is treated as incurred by the interface. The waterfall itself is
-- unchanged and keeps reading every row — it was written before this workflow
-- existed and must not silently start excluding a legitimate supplier debt.

alter table public.farm_expenses
  add column if not exists status public.expense_status not null default 'approved',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists review_note text,
  add column if not exists logged_by_role text;

comment on column public.farm_expenses.status is
  'Operator-filed rows start pending; a treasury admin approves or rejects. Rows created before this column default to approved so no historical cost changes meaning.';

-- ----------------------------------------------------------------------------
-- 5. The activity feed and each member's alert
-- ----------------------------------------------------------------------------

create table public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  cycle_id uuid references public.farm_cycles(id) on delete set null,
  amount numeric(16, 2),
  category text,
  note text,
  actor_id uuid,
  actor_name text not null default 'Co-operative',
  reference text,
  created_at timestamptz not null default now()
);

create index activity_feed_created_idx on public.activity_feed (created_at desc);
create index activity_feed_cycle_idx on public.activity_feed (cycle_id, created_at desc);

grant select on public.activity_feed to authenticated;
grant all on public.activity_feed to service_role;
alter table public.activity_feed enable row level security;

create policy "Signed-in members read the activity feed"
  on public.activity_feed for select
  to authenticated
  using (true);

comment on table public.activity_feed is
  'Append-only log of money and farm events, written by database triggers. A member reads it the instant an expense, withdrawal or settlement is recorded.';

-- Every member gets their own alert row. Reading it is what marks it read, so
-- one member can never clear another member's banner.
create table public.member_alerts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid references public.activity_feed(id) on delete cascade,
  title text not null,
  body text,
  tone text not null default 'info' check (tone in ('info', 'expense', 'payout', 'success')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index member_alerts_member_idx on public.member_alerts (member_id, created_at desc);
create index member_alerts_unread_idx on public.member_alerts (member_id) where read_at is null;

grant select, update on public.member_alerts to authenticated;
grant all on public.member_alerts to service_role;
alter table public.member_alerts enable row level security;

create policy "A member reads only their own alerts"
  on public.member_alerts for select
  to authenticated
  using (member_id = auth.uid());

create policy "A member marks only their own alert read"
  on public.member_alerts for update
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

comment on table public.member_alerts is
  'Per-member notification banner. Written by trigger when an expense, withdrawal or payout is published.';

-- The moment any expense or stock entry is filed, it is published. This is the
-- trigger behind the member alert banner: nothing is held back for a report.

create or replace function private.publish_activity(
  _kind text,
  _cycle_id uuid,
  _amount numeric,
  _category text,
  _note text,
  _actor uuid,
  _ref text default null
) returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  new_id uuid;
  actor_name text;
begin
  select coalesce(nullif(trim(p.full_name), ''), 'Co-operative staff')
    into actor_name
    from public.profiles p
   where p.id = _actor;

  insert into public.activity_feed (kind, cycle_id, amount, category, note, actor_id, actor_name, reference)
  values (
    _kind,
    _cycle_id,
    _amount,
    _category,
    _note,
    _actor,
    coalesce(actor_name, 'Co-operative staff'),
    _ref
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Fan a published activity line out to every member who holds capital in that
-- cycle (or to everyone, for platform-wide lines), and quietly to admins.
create or replace function private.fan_out_alert()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  title text;
  body text;
  tone text;
  audience uuid[];
begin
  tone := case
    when new.kind = 'expense' then 'expense'
    when new.kind in ('payout', 'settlement') then 'payout'
    when new.kind = 'capital_in' then 'success'
    else 'info'
  end;

  title := case
    when new.kind = 'expense'
      then 'New farm expense logged: ₦' || to_char(coalesce(new.amount, 0), 'FM999G999G999G999D00') || ' for ' || coalesce(new.category, 'farm operations')
    when new.kind = 'payout'
      then 'Harvest payout recorded: ₦' || to_char(coalesce(new.amount, 0), 'FM999G999G999G999D00')
    when new.kind = 'capital_in'
      then 'Contribution verified: ₦' || to_char(coalesce(new.amount, 0), 'FM999G999G999G999D00')
    else 'Co-operative update: ' || coalesce(new.category, new.kind)
  end;

  body := nullif(trim(coalesce(new.note, '')), '');

  if new.cycle_id is not null then
    select array_agg(distinct member_id) into audience
      from public.cycle_investments
     where cycle_id = new.cycle_id and status = 'success'::public.investment_status;
  else
    select array_agg(user_id) into audience
      from public.user_roles
     where role in ('member'::public.app_role, 'contributor'::public.app_role);
  end if;

  if audience is not null and array_length(audience, 1) > 0 then
    insert into public.member_alerts (member_id, activity_id, title, body, tone)
    select member_id, new.id, title, body, tone
      from unnest(audience) as member_id;
  end if;

  return new;
end;
$$;

drop trigger if exists activity_feed_fan_out on public.activity_feed;
create trigger activity_feed_fan_out
  after insert on public.activity_feed
  for each row execute function private.fan_out_alert();

-- ----------------------------------------------------------------------------
-- 6. Triggers: money movements publish themselves
-- ----------------------------------------------------------------------------

-- An expense is published the moment it is filed. The category, the amount and
-- the operator's name go out together, because a figure without its reason is
-- worse than no figure.
create or replace function private.on_expense_filed()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  cycle_code text;
begin
  select code into cycle_code from public.farm_cycles where id = new.cycle_id;

  perform private.publish_activity(
    'expense',
    new.cycle_id,
    new.amount,
    new.category,
    coalesce(new.note, new.vendor, 'Farm expense') ||
      case when cycle_code is not null then ' · ' || cycle_code else '' end,
    new.recorded_by,
    new.id::text
  );
  return new;
end;
$$;

drop trigger if exists farm_expenses_publish on public.farm_expenses;
create trigger farm_expenses_publish
  after insert on public.farm_expenses
  for each row execute function private.on_expense_filed();

-- A verified contribution is capital arriving. Published once, on the
-- transition into success, so a Paystack retry cannot double-publish.
create or replace function private.on_investment_verified()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = 'success'::public.investment_status
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.publish_activity(
      'capital_in',
      new.cycle_id,
      new.amount,
      'Contribution verified',
      'Verified ' || coalesce(new.method::text, 'payment') ||
        case when new.receipt_number is not null then ' · receipt ' || new.receipt_number else '' end,
      coalesce(new.verified_by, new.member_id),
      new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists cycle_investments_publish on public.cycle_investments;
create trigger cycle_investments_publish
  after insert or update of status on public.cycle_investments
  for each row execute function private.on_investment_verified();

-- ----------------------------------------------------------------------------
-- 7. Treasury ledger and the three headline figures
-- ----------------------------------------------------------------------------
-- Every movement of co-operative money, recorded once, in one place. The three
-- figures members watch are derived from these rows — never entered, never
-- edited, never restated.

create table public.treasury_entries (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.farm_cycles(id) on delete set null,
  kind public.treasury_entry_kind not null,
  amount numeric(16, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  category text,
  note text,
  reference text,
  source_table text,
  source_id uuid,
  recorded_by uuid,
  created_at timestamptz not null default now()
);

-- A movement is recorded once. The guard is what makes the treasury safe to
-- rebuild from source at any time.
create unique index treasury_entries_source_uniq
  on public.treasury_entries (source_table, source_id, kind)
  where source_table is not null and source_id is not null;

create index treasury_entries_kind_idx on public.treasury_entries (kind, occurred_on desc);
create index treasury_entries_cycle_idx on public.treasury_entries (cycle_id, occurred_on desc);

grant select on public.treasury_entries to authenticated;
grant all on public.treasury_entries to service_role;
alter table public.treasury_entries enable row level security;

-- Only treasury staff may read the raw movement book; members read the
-- published totals below.
create policy "Treasury staff read the movement book"
  on public.treasury_entries for select
  to authenticated
  using (private.is_staff(auth.uid()));

create policy "Admins record treasury movements"
  on public.treasury_entries for insert
  to authenticated
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.treasury_entries is
  'One row per movement of co-operative money. Source rows (a verified contribution, an approved expense, a settlement) write here by trigger, so the totals can never disagree with the ledger.';

-- A verified contribution is capital in.
create or replace function private.on_capital_in()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = 'success'::public.investment_status then
    insert into public.treasury_entries
      (cycle_id, kind, amount, occurred_on, category, note, reference, source_table, source_id, recorded_by)
    values (
      new.cycle_id,
      'capital_in',
      new.amount,
      coalesce(new.verified_at::date, new.date),
      'Verified contribution',
      'Member capital received',
      coalesce(new.receipt_number, new.paystack_reference, new.bank_reference),
      'cycle_investments',
      new.id,
      new.verified_by
    )
    on conflict (source_table, source_id, kind) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists cycle_investments_treasury on public.cycle_investments;
create trigger cycle_investments_treasury
  after insert or update of status on public.cycle_investments
  for each row execute function private.on_capital_in();

-- Paying a supplier is money out. Filing a bill is not — only the day the cash
-- moves is the treasury affected, which is why settled_on drives this.
create or replace function private.on_expense_settled()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.settled_on is not null
     and new.status = 'approved'::public.expense_status
     and (tg_op = 'INSERT' or old.settled_on is distinct from new.settled_on) then
    insert into public.treasury_entries
      (cycle_id, kind, amount, occurred_on, category, note, reference, source_table, source_id, recorded_by)
    values (
      new.cycle_id,
      'expense_out',
      new.amount,
      new.settled_on,
      new.category,
      coalesce(new.note, new.vendor, 'Farm expense paid'),
      new.id::text,
      'farm_expenses',
      new.id,
      new.recorded_by
    )
    on conflict (source_table, source_id, kind) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists farm_expenses_treasury on public.farm_expenses;
create trigger farm_expenses_treasury
  after insert or update of settled_on, status on public.farm_expenses
  for each row execute function private.on_expense_settled();

-- The three figures every member sees, counted from the movement book.
create or replace view public.treasury_position as
select
  coalesce(sum(amount) filter (where kind in ('capital_in', 'top_up')), 0)::numeric(16, 2)
    as total_capital_funded,
  coalesce(sum(amount) filter (where kind = 'expense_out'), 0)::numeric(16, 2)
    as total_expenses_incurred,
  coalesce(sum(amount) filter (where kind = 'payout_out'), 0)::numeric(16, 2)
    as total_payouts_paid,
  coalesce(sum(amount) filter (where kind = 'reserve_in'), 0)::numeric(16, 2)
    as total_reserve_held,
  -- Operating cash on hand is what came in, less what actually left. A reserve
  -- is set aside but still held, so it is not deducted here.
  (
    coalesce(sum(amount) filter (where kind in ('capital_in', 'top_up')), 0)
    - coalesce(sum(amount) filter (where kind in ('expense_out', 'payout_out')), 0)
  )::numeric(16, 2) as operating_cash_on_hand,
  (select count(*) from public.treasury_entries)::int as movements,
  (select max(occurred_on) from public.treasury_entries) as last_movement_on
from public.treasury_entries;

comment on view public.treasury_position is
  'Capital funded, expenses incurred and cash on hand — all counted from treasury_entries. There is no stored total anywhere.';

grant select on public.treasury_position to authenticated;
grant all on public.treasury_position to service_role;

-- The same figures per cycle, so a member can see one farm's own book.
create or replace view public.cycle_treasury_position as
select
  c.id as cycle_id,
  c.code,
  coalesce(sum(t.amount) filter (where t.kind in ('capital_in', 'top_up')), 0)::numeric(16, 2)
    as capital_funded,
  coalesce(sum(t.amount) filter (where t.kind = 'expense_out'), 0)::numeric(16, 2)
    as expenses_paid,
  coalesce(sum(t.amount) filter (where t.kind = 'expense_out'), 0)::numeric(16, 2)
    as expenses_incurred,
  (
    coalesce(sum(t.amount) filter (where t.kind in ('capital_in', 'top_up')), 0)
    - coalesce(sum(t.amount) filter (where t.kind in ('expense_out', 'payout_out')), 0)
  )::numeric(16, 2) as cash_on_hand
from public.farm_cycles c
left join public.treasury_entries t on t.cycle_id = c.id
where c.locked_at is not null and c.status <> 'cancelled'::public.cycle_status
group by c.id, c.code;

comment on view public.cycle_treasury_position is
  'Per-cycle treasury figures for a signed-in member. Aggregates only.';

grant select on public.cycle_treasury_position to authenticated;
grant all on public.cycle_treasury_position to service_role;

-- ----------------------------------------------------------------------------
-- 8. Monthly Agri-Save schedule
-- ----------------------------------------------------------------------------
-- A monthly plan is a commitment, not a card on file. Each month the schedule
-- shows what is due, and the member pays it like any other contribution — so
-- every naira still arrives through Paystack or the treasury, and equity still
-- comes from verified rows only.

create table public.monthly_plan_charges (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid references public.farm_cycles(id) on delete set null,
  due_on date not null,
  amount numeric(16, 2) not null check (amount >= 5000),
  status text not null default 'due' check (status in ('due', 'paid', 'skipped')),
  paid_on date,
  investment_id uuid references public.cycle_investments(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (member_id, due_on)
);

create index monthly_plan_charges_member_idx
  on public.monthly_plan_charges (member_id, due_on desc);

grant select on public.monthly_plan_charges to authenticated;
grant all on public.monthly_plan_charges to service_role;
alter table public.monthly_plan_charges enable row level security;

create policy "A member sees their own Agri-Save schedule"
  on public.monthly_plan_charges for select
  to authenticated
  using (member_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.monthly_plan_charges is
  'One row per month of a member''s Agri-Save commitment. A month is paid when a verified contribution is matched to it.';

-- ----------------------------------------------------------------------------
-- 9. Documents
-- ----------------------------------------------------------------------------
-- A certificate or statement is a *rendering* of ledger rows at a moment in
-- time. It is stored so it can be re-printed identically and verified by its
-- code, and it is stamped with the figures it was rendered from so a later
-- ledger change cannot make an old print-out look wrong by accident.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  kind public.document_kind not null,
  -- Short, human-readable verification code printed beside the QR.
  code text not null unique,
  member_id uuid not null,
  cycle_id uuid references public.farm_cycles(id) on delete set null,
  investment_id uuid references public.cycle_investments(id) on delete set null,
  distribution_id uuid references public.waterfall_distributions(id) on delete set null,
  title text not null,
  issued_on date not null default current_date,
  payload jsonb not null default '{}'::jsonb,
  issued_by uuid,
  created_at timestamptz not null default now()
);

create index documents_member_idx on public.documents (member_id, issued_on desc);
create index documents_cycle_idx on public.documents (cycle_id, kind);

grant select, insert on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;

create policy "A member reads their own documents"
  on public.documents for select
  to authenticated
  using (member_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "A member issues their own documents"
  on public.documents for insert
  to authenticated
  with check (member_id = auth.uid());

-- Verification is public by code: somebody holding a printed certificate must
-- be able to check it without an account, so this view exposes the code, the
-- kind, the date and the figures printed on it — and no other member's data.
create or replace view public.document_register as
select
  d.code,
  d.kind,
  d.title,
  d.issued_on,
  d.cycle_id,
  c.code as cycle_code,
  c.name as cycle_name,
  d.payload
from public.documents d
left join public.farm_cycles c on c.id = d.cycle_id;

comment on view public.document_register is
  'Public verification register: a document code resolves to the figures printed on that document. Used by /verify and by the QR on every printed page.';

grant select on public.document_register to anon, authenticated;
grant all on public.document_register to service_role;

-- ----------------------------------------------------------------------------
-- 10. Operator permissions, per farm unit
-- ----------------------------------------------------------------------------
-- The core platform assigns a role. A co-operative with more than one pond
-- also needs to say *which* pond: an operator may log against Catfish Batch A
-- and nothing else. No row here means the operator may log against any cycle
-- they can see, which is the behaviour the platform had before this migration.

create table public.operator_assignments (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.farm_cycles(id) on delete cascade,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (operator_id, cycle_id)
);

create index operator_assignments_operator_idx on public.operator_assignments (operator_id);

grant select, insert, update, delete on public.operator_assignments to authenticated;
grant all on public.operator_assignments to service_role;
alter table public.operator_assignments enable row level security;

create policy "An operator sees their own units"
  on public.operator_assignments for select
  to authenticated
  using (operator_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins grant and revoke units"
  on public.operator_assignments for insert
  to authenticated
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins update units"
  on public.operator_assignments for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins remove units"
  on public.operator_assignments for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

comment on table public.operator_assignments is
  'Per-pond permission for farm staff. An active row restricts that operator to the named cycles; no rows at all leaves broad farm access, as before.';

-- Enforcement belongs in the database, not the form: a log filed against a
-- cycle the operator was not granted is refused even if the request is forged.
create or replace function private.assert_cycle_access(_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  restricted boolean;
begin
  if private.has_role(auth.uid(), 'admin'::public.app_role) then
    return;
  end if;

  select exists (
    select 1 from public.operator_assignments
     where operator_id = auth.uid() and revoked_at is null
  ) into restricted;

  if restricted then
    if not exists (
      select 1 from public.operator_assignments
       where operator_id = auth.uid()
         and cycle_id = _cycle_id
         and revoked_at is null
    ) then
      raise exception 'You are not assigned to that farm unit.' using errcode = '42501';
    end if;
  end if;
end;
$$;

create or replace function private.check_log_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.assert_cycle_access(new.cycle_id);
  return new;
end;
$$;

drop trigger if exists operational_logs_cycle_access on public.operational_logs;
create trigger operational_logs_cycle_access
  before insert on public.operational_logs
  for each row execute function private.check_log_cycle();

-- ----------------------------------------------------------------------------
-- 11. Monthly plan helper
-- ----------------------------------------------------------------------------
-- Called after a contribution is verified: if the member has an active monthly
-- commitment, the earliest unpaid month at or before that date is marked paid
-- and pointed at the contribution that paid it.

create or replace function public.settle_monthly_plan(_investment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  charge record;
begin
  select id, member_id, cycle_id, amount, date, status
    into inv
    from public.cycle_investments
   where id = _investment_id;

  if inv is null or inv.status <> 'success' then
    return;
  end if;

  select id, amount into charge
    from public.monthly_plan_charges
   where member_id = inv.member_id
     and status = 'due'
     and due_on <= coalesce(inv.date, current_date)
     and amount <= inv.amount
   order by due_on asc
   limit 1;

  if charge is null then
    return;
  end if;

  update public.monthly_plan_charges
     set status = 'paid',
         paid_on = coalesce(inv.date, current_date),
         investment_id = inv.id,
         cycle_id = coalesce(cycle_id, inv.cycle_id)
   where id = charge.id;
end;
$$;

grant execute on function public.settle_monthly_plan(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12. Indexes the new screens need
-- ----------------------------------------------------------------------------

create index if not exists farm_expenses_status_idx
  on public.farm_expenses (status, date desc);
create index if not exists profiles_whatsapp_idx
  on public.profiles (whatsapp_number) where whatsapp_number is not null;

-- ----------------------------------------------------------------------------
-- 13. Aggregates a document needs, without opening the settlement book
-- ----------------------------------------------------------------------------
-- A certificate prints the harvest weight and the cycle's settlement totals.
-- Harvest weights are already readable by signed-in members, but the settlement
-- book is not — and it must not become so just to fill a page. This view
-- publishes the cycle-level aggregates a printed statement has to quote, and
-- nothing about any member's line.

create or replace view public.cycle_settlement_summary as
select
  d.cycle_id,
  c.code as cycle_code,
  c.name as cycle_name,
  c.commodity,
  d.gross_revenue,
  d.liabilities_paid,
  d.principal_returned,
  d.reserve_set_aside,
  d.net_profit,
  d.investor_profit_pool,
  d.operator_fee,
  d.profit_investor_percent,
  d.profit_operator_percent,
  d.reserve_percent,
  d.principal_at_risk,
  d.executed_at,
  h.total_weight_kg,
  h.harvest_date
from public.waterfall_distributions d
join public.farm_cycles c on c.id = d.cycle_id
left join public.harvest_records h on h.cycle_id = d.cycle_id
where d.status <> 'draft'::public.distribution_status;

comment on view public.cycle_settlement_summary is
  'Per-cycle settlement totals and harvest weight, for the printable statement. No member line, no identity.';

grant select on public.cycle_settlement_summary to authenticated;
grant all on public.cycle_settlement_summary to service_role;

-- ----------------------------------------------------------------------------
-- 14. The document register must not leak the payload to an anonymous reader
-- ----------------------------------------------------------------------------
-- Verification is public by code, but the payload carries a member's name and
-- their own payout figures. An anonymous visitor checking a printed page sees
-- the fact that the document exists and the cycle it belongs to; the figures on
-- it are for the person holding the paper and the co-operative.

drop view if exists public.document_register;

create view public.document_register as
select
  d.code,
  d.kind,
  d.title,
  d.issued_on,
  d.cycle_id,
  c.code as cycle_code,
  c.name as cycle_name,
  d.member_id,
  -- Only a signed-in caller gets whatever the trigger below decides to show.
  case
    when auth.uid() is null then null
    when d.member_id::text = auth.uid()::text then d.payload
    when private.is_admin(auth.uid()) then d.payload
    else null
  end as payload
from public.documents d
left join public.farm_cycles c on c.id = d.cycle_id;

comment on view public.document_register is
  'Public verification register. A code resolves to the document and its cycle for anybody; the figures printed on it are returned only to its owner and to the treasury.';

grant select on public.document_register to anon, authenticated;
grant all on public.document_register to service_role;

-- ----------------------------------------------------------------------------
-- 15. Photo & video storage
-- ----------------------------------------------------------------------------
-- The bucket the operator console uploads farm proof into. Paths are laid out
-- as `<uploader uuid>/<cycle uuid>/<file>`, and the policies below pin the first
-- segment to the caller, so one worker cannot overwrite another's proof.
--
-- Reading is public because a member's dashboard shows the photo, and the photo
-- is of a farm — not of a member. Writing, replacing and deleting are limited to
-- farm staff and admins.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'farm-proof',
  'farm-proof',
  true,
  41943040, -- 40 MB: a short clip, not a film
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Farm proof is readable" on storage.objects;
create policy "Farm proof is readable"
  on storage.objects for select
  using (bucket_id = 'farm-proof');

drop policy if exists "Farm staff upload their own proof" on storage.objects;
create policy "Farm staff upload their own proof"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'farm-proof'
    and private.is_staff(auth.uid())
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Farm staff replace their own proof" on storage.objects;
create policy "Farm staff replace their own proof"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'farm-proof' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'farm-proof' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admins remove farm proof" on storage.objects;
create policy "Admins remove farm proof"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'farm-proof' and private.is_admin(auth.uid()));
