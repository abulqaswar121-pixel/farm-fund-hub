-- ============================================================================
-- NDH AGRICAPITAL — core schema
-- ----------------------------------------------------------------------------
-- Multi-commodity agricultural investment ledger for the Najeeb Digital Hub
-- co-operative. This migration is ADDITIVE: the earlier Apex-era tables
-- (contributions, expenses, stock_logs, harvest_cycles, harvest_payouts) are
-- left untouched so no historical row is lost. The platform reads and writes
-- only the tables created below.
--
-- Invariants enforced here, not in the frontend:
--   * a cycle's profit split and reserve percentage are frozen at publication
--   * equity is never stored — it is always derived from verified investments
--   * the profit split must total exactly 100%
--   * the emergency reserve must sit inside the co-operative band (5%–10%)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enumerations
-- ----------------------------------------------------------------------------

-- The co-operative's three access levels (admin, operator, member) are defined
-- on the existing public.app_role enum; migration 20261007115900 adds 'member'.

create type public.commodity_type as enum (
  'catfish',
  'broiler',
  'layer',
  'grain',
  'greenhouse'
);

create type public.cycle_status as enum (
  'draft',       -- being prepared by admin, invisible to the public
  'open',        -- funding open, contributions accepted
  'funded',      -- target reached, awaiting stocking
  'active',      -- stocked and running on the farm
  'harvested',   -- harvest weighed in, sale pending
  'settled',     -- waterfall run and paid out
  'cancelled'    -- abandoned; capital returned outside the waterfall
);

create type public.stage_id as enum (
  'funding_open',
  'stocking',
  'operational',
  'harvest_weighin',
  'sale_settlement',
  'waterfall_distribution'
);

create type public.investment_method as enum ('paystack', 'manual', 'rollover');

create type public.investment_status as enum ('pending', 'success', 'failed');

create type public.log_type as enum (
  'feed',
  'growth_sample',
  'mortality',
  'medication',
  'general',
  'harvest',
  'sale'
);

create type public.review_status as enum ('pending', 'approved', 'flagged');

create type public.transfer_status as enum ('offered', 'claimed', 'settled', 'withdrawn');

create type public.visit_status as enum ('requested', 'confirmed', 'declined', 'completed', 'cancelled');

create type public.incident_severity as enum ('low', 'moderate', 'serious', 'critical');

create type public.incident_status as enum ('open', 'mitigating', 'resolved');

create type public.distribution_status as enum ('draft', 'executed', 'paid');

create type public.payout_status as enum ('pending', 'paid', 'withheld');

-- ----------------------------------------------------------------------------
-- 2. Farm cycles — every term locked at publication
-- ----------------------------------------------------------------------------

create table public.farm_cycles (
  id uuid primary key default gen_random_uuid(),
  /** Human-readable public code, e.g. "CAT-004". Unique across the platform. */
  code text not null unique,
  commodity public.commodity_type not null,
  name text not null,
  summary text,
  /** Which physical site the stock sits on. Drives the weather panel. */
  farm_site text not null default 'Main farm',
  farm_latitude numeric(8, 5),
  farm_longitude numeric(8, 5),

  -- Funding terms -----------------------------------------------------------
  target_capital numeric(16, 2) not null check (target_capital > 0),
  minimum_ticket numeric(16, 2) not null default 10000 check (minimum_ticket > 0),
  /**
   * The only revenue figure available before harvest. Set by the admin from the
   * costed plan and used by the public calculator, always labelled a projection.
   */
  projected_revenue numeric(16, 2) not null default 0 check (projected_revenue >= 0),
  /** Supplier balances the admin expects to still owe at settlement (Level 1). */
  projected_liabilities numeric(16, 2) not null default 0 check (projected_liabilities >= 0),

  -- Locked-from-start rules -------------------------------------------------
  profit_investor_percent numeric(5, 2) not null default 70,
  profit_operator_percent numeric(5, 2) not null default 30,
  reserve_percent numeric(5, 2) not null default 5,

  -- Timeline ---------------------------------------------------------------
  cycle_weeks integer not null default 16 check (cycle_weeks > 0 and cycle_weeks <= 104),
  funding_opens_on date not null default current_date,
  funding_closes_on date,
  stocking_on date,
  projected_harvest_on date,

  -- Lifecycle --------------------------------------------------------------
  status public.cycle_status not null default 'draft',
  current_stage public.stage_id not null default 'funding_open',
  /** Set the moment the cycle is published. After this, terms cannot change. */
  locked_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint farm_cycles_split_totals_100
    check (profit_investor_percent + profit_operator_percent = 100),
  constraint farm_cycles_split_positive
    check (profit_investor_percent > 0 and profit_operator_percent > 0),
  constraint farm_cycles_reserve_band
    check (reserve_percent >= 5 and reserve_percent <= 10),
  constraint farm_cycles_minimum_ticket_within_target
    check (minimum_ticket <= target_capital)
);

comment on table public.farm_cycles is
  'One agricultural production cycle. Profit split, reserve percentage and target capital are immutable once locked_at is set.';

-- ----------------------------------------------------------------------------
-- 3. Investments — the single source of truth for capital and equity
-- ----------------------------------------------------------------------------

create table public.cycle_investments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.farm_cycles(id) on delete restrict,
  member_id uuid not null,
  amount numeric(16, 2) not null check (amount > 0),
  date date not null default current_date,
  method public.investment_method not null,
  status public.investment_status not null default 'pending',
  paystack_reference text unique,
  /** Bank teller / transfer reference supplied when an admin verifies a wire. */
  bank_reference text,
  /** Sequential receipt printed to the member once verified. */
  receipt_number text unique,
  verified_at timestamptz,
  verified_by uuid,
  /** Set when this investment was funded by a matured cycle's payout. */
  rollover_source_cycle_id uuid references public.farm_cycles(id) on delete set null,
  /**
   * Capital this row has handed to another member through the co-op share
   * transfer board. A member's live holding is therefore
   * (amount - transferred_out). The original amount is never rewritten, so the
   * paper trail of what was actually paid in survives every transfer.
   *
   * The cycle's own total is unaffected: the buyer gains a matching row, so
   * sum(amount - transferred_out) across the cycle is unchanged by a transfer.
   */
  transferred_out numeric(16, 2) not null default 0
    check (transferred_out >= 0 and transferred_out <= amount),
  /** The share-transfer row that moved capital out of this investment. */
  transfer_id uuid,
  note text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycle_investments_verified_fields
    check (
      (status = 'success' and verified_at is not null)
      or status <> 'success'
    )
);

comment on table public.cycle_investments is
  'Verified member capital in a cycle. Equity percentage is derived from this table at read time and is never stored.';

-- ----------------------------------------------------------------------------
-- 4. Operational logs — the farm telemetry the operator files daily
-- ----------------------------------------------------------------------------

create table public.operational_logs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.farm_cycles(id) on delete cascade,
  log_type public.log_type not null,
  log_date date not null default current_date,

  -- feed / input consumption
  feed_kg numeric(12, 2) check (feed_kg is null or feed_kg >= 0),
  feed_bags numeric(12, 2) check (feed_bags is null or feed_bags >= 0),

  -- population
  mortality_count integer check (mortality_count is null or mortality_count >= 0),
  mortality_reason text,
  population_count integer check (population_count is null or population_count >= 0),

  -- growth sampling
  sample_count integer check (sample_count is null or sample_count >= 0),
  sample_avg_weight_g numeric(12, 2) check (sample_avg_weight_g is null or sample_avg_weight_g >= 0),
  biomass_kg numeric(14, 2) check (biomass_kg is null or biomass_kg >= 0),

  -- yield (layers / grain / greenhouse)
  crates_collected numeric(12, 2) check (crates_collected is null or crates_collected >= 0),
  bags_harvested numeric(12, 2) check (bags_harvested is null or bags_harvested >= 0),
  area_sqm numeric(14, 2) check (area_sqm is null or area_sqm >= 0),

  medication text,
  notes text,
  /** Operator-authored line shown verbatim on the public transparency feed. */
  public_summary text,
  photo_url text,

  recorded_by uuid not null,
  review_status public.review_status not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.operational_logs is
  'Daily/weekly farm telemetry. Only rows approved by an admin are surfaced on the public transparency feed, and only via the public_milestones view.';

-- ----------------------------------------------------------------------------
-- 5. Farm expenses — direct operational spend per cycle
-- ----------------------------------------------------------------------------

create table public.farm_expenses (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.farm_cycles(id) on delete restrict,
  amount numeric(16, 2) not null check (amount > 0),
  date date not null default current_date,
  category text not null,
  vendor text,
  note text,
  /** True when the supplier balance is still outstanding (feeds Level 1). */
  is_payable boolean not null default false,
  settled_on date,
  receipt_url text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. Harvest records — the open weigh-in
-- ----------------------------------------------------------------------------

create table public.harvest_records (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.farm_cycles(id) on delete restrict,
  harvest_date date not null default current_date,
  total_weight_kg numeric(14, 2) check (total_weight_kg is null or total_weight_kg >= 0),
  total_count integer check (total_count is null or total_count >= 0),
  /** Batch scale ticket reference so any member can trace the weigh-in. */
  scale_ticket_ref text,
  buyer text,
  buyer_note text,
  /** Revenue only becomes non-zero when the sale is actually banked. */
  gross_revenue numeric(16, 2) not null default 0 check (gross_revenue >= 0),
  revenue_received_on date,
  receipt_url text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. Waterfall distributions — the settlement, and who got what
-- ----------------------------------------------------------------------------

create table public.waterfall_distributions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.farm_cycles(id) on delete restrict,
  status public.distribution_status not null default 'draft',

  -- inputs actually used, frozen onto the run for auditability
  gross_revenue numeric(16, 2) not null default 0 check (gross_revenue >= 0),
  capital_raised numeric(16, 2) not null default 0 check (capital_raised >= 0),
  operational_liabilities numeric(16, 2) not null default 0 check (operational_liabilities >= 0),
  profit_investor_percent numeric(5, 2) not null,
  profit_operator_percent numeric(5, 2) not null,
  reserve_percent numeric(5, 2) not null,

  -- level-by-level outcome
  liabilities_paid numeric(16, 2) not null default 0,
  principal_returned numeric(16, 2) not null default 0,
  reserve_set_aside numeric(16, 2) not null default 0,
  net_profit numeric(16, 2) not null default 0,
  investor_profit_pool numeric(16, 2) not null default 0,
  operator_fee numeric(16, 2) not null default 0,
  /** Sum of member payouts issued by this run. */
  total_paid_out numeric(16, 2) not null default 0,
  /** True when the harvest could not return 100% of principal. */
  principal_at_risk boolean not null default false,
  note text,
  run_by uuid not null,
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.waterfall_lines (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.waterfall_distributions(id) on delete cascade,
  cycle_id uuid not null references public.farm_cycles(id) on delete restrict,
  member_id uuid not null,

  -- frozen at run time so a later ledger change cannot rewrite settled history
  capital numeric(16, 2) not null default 0,
  equity_percent numeric(7, 4) not null default 0,
  principal_amount numeric(16, 2) not null default 0,
  profit_amount numeric(16, 2) not null default 0,
  total_amount numeric(16, 2) not null default 0,
  payout_status public.payout_status not null default 'pending',
  payout_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (distribution_id, member_id)
);

-- ----------------------------------------------------------------------------
-- 8. Innovation surfaces
-- ----------------------------------------------------------------------------

-- 8a. Automatic rollover — reinvest a matured payout into the next cycle.
create type public.rollover_mode as enum ('off', 'principal', 'profit', 'both');

create table public.rollover_instructions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique,
  mode public.rollover_mode not null default 'off',
  /** Null means "the next cycle that opens after settlement". */
  preferred_cycle_id uuid references public.farm_cycles(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8b. Secondary co-op share transfer — liquidity at par, inside the co-op.
create table public.share_transfers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.farm_cycles(id) on delete restrict,
  seller_id uuid not null,
  buyer_id uuid,
  /** Par value being offered; must not exceed the seller's verified capital. */
  capital_amount numeric(16, 2) not null check (capital_amount > 0),
  asking_price numeric(16, 2) not null check (asking_price > 0),
  status public.transfer_status not null default 'offered',
  reason text,
  admin_note text,
  settled_at timestamptz,
  settled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint share_transfers_no_self_deal check (buyer_id is null or buyer_id <> seller_id),
  constraint share_transfers_price_at_par check (asking_price <= capital_amount)
);

-- 8c. Farm visit booking — verified investors inspecting in person.
create table public.farm_visits (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.farm_cycles(id) on delete set null,
  member_id uuid not null,
  visit_date date not null,
  slot text not null default 'morning' check (slot in ('morning', 'afternoon')),
  guests integer not null default 1 check (guests between 1 and 8),
  status public.visit_status not null default 'requested',
  member_note text,
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8d. Incident & insurance register — published openly, resolved in public.
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.farm_cycles(id) on delete set null,
  title text not null,
  category text not null,
  severity public.incident_severity not null default 'low',
  status public.incident_status not null default 'open',
  occurred_on date not null default current_date,
  description text not null,
  estimated_impact numeric(16, 2),
  /** Any insurance claim raised against the event. */
  insurance_claim_ref text,
  photo_url text,
  resolution_note text,
  resolved_on date,
  logged_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8e. Weather & season snapshots — the field record behind the climate panel.
create table public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.farm_cycles(id) on delete cascade,
  captured_on date not null default current_date,
  rainfall_mm numeric(8, 2) check (rainfall_mm is null or rainfall_mm >= 0),
  temp_min_c numeric(5, 2),
  temp_max_c numeric(5, 2),
  humidity_percent numeric(5, 2) check (
    humidity_percent is null or (humidity_percent >= 0 and humidity_percent <= 100)
  ),
  source text not null default 'operator observation',
  note text,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  unique (cycle_id, captured_on)
);

-- ----------------------------------------------------------------------------
-- 9. Indexes
-- ----------------------------------------------------------------------------

create index farm_cycles_status_idx on public.farm_cycles (status);
create index farm_cycles_commodity_idx on public.farm_cycles (commodity);
create index farm_cycles_public_idx on public.farm_cycles (locked_at, status);

create index cycle_investments_cycle_idx on public.cycle_investments (cycle_id);
create index cycle_investments_member_idx on public.cycle_investments (member_id);
create index cycle_investments_status_idx on public.cycle_investments (status);
create index cycle_investments_cycle_status_idx
  on public.cycle_investments (cycle_id, status);

create index operational_logs_cycle_date_idx on public.operational_logs (cycle_id, log_date desc);
create index operational_logs_review_idx on public.operational_logs (review_status);
create index operational_logs_type_idx on public.operational_logs (log_type);

create index farm_expenses_cycle_idx on public.farm_expenses (cycle_id);
create index farm_expenses_payable_idx on public.farm_expenses (cycle_id) where is_payable;
create index harvest_records_cycle_idx on public.harvest_records (cycle_id);
create index waterfall_distributions_cycle_idx on public.waterfall_distributions (cycle_id);
create index waterfall_lines_member_idx on public.waterfall_lines (member_id);
create index waterfall_lines_cycle_idx on public.waterfall_lines (cycle_id);
create index share_transfers_cycle_idx on public.share_transfers (cycle_id);
create index share_transfers_open_idx on public.share_transfers (status) where status = 'offered';
create index farm_visits_member_idx on public.farm_visits (member_id);
create index farm_visits_date_idx on public.farm_visits (visit_date);
create index incidents_status_idx on public.incidents (status);
create index incidents_cycle_idx on public.incidents (cycle_id);
create index weather_snapshots_cycle_date_idx on public.weather_snapshots (cycle_id, captured_on desc);

-- ----------------------------------------------------------------------------
-- 10. updated_at triggers (reuse the existing helper from the base schema)
-- ----------------------------------------------------------------------------

create trigger farm_cycles_updated_at before update on public.farm_cycles
  for each row execute function public.update_updated_at_column();
create trigger cycle_investments_updated_at before update on public.cycle_investments
  for each row execute function public.update_updated_at_column();
create trigger operational_logs_updated_at before update on public.operational_logs
  for each row execute function public.update_updated_at_column();
create trigger farm_expenses_updated_at before update on public.farm_expenses
  for each row execute function public.update_updated_at_column();
create trigger harvest_records_updated_at before update on public.harvest_records
  for each row execute function public.update_updated_at_column();
create trigger waterfall_distributions_updated_at before update on public.waterfall_distributions
  for each row execute function public.update_updated_at_column();
create trigger waterfall_lines_updated_at before update on public.waterfall_lines
  for each row execute function public.update_updated_at_column();
create trigger rollover_instructions_updated_at before update on public.rollover_instructions
  for each row execute function public.update_updated_at_column();
create trigger share_transfers_updated_at before update on public.share_transfers
  for each row execute function public.update_updated_at_column();
create trigger farm_visits_updated_at before update on public.farm_visits
  for each row execute function public.update_updated_at_column();
create trigger incidents_updated_at before update on public.incidents
  for each row execute function public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 11. Locked-from-start guard
-- ----------------------------------------------------------------------------
-- Once an admin publishes a cycle, the terms that members were shown are
-- frozen at the database level. Nothing — not even a direct SQL update by an
-- admin — can move them afterwards.

create or replace function public.freeze_cycle_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.locked_at is not null then
    if new.target_capital is distinct from old.target_capital then
      raise exception 'A published cycle''s target capital is locked';
    end if;
    if new.profit_investor_percent is distinct from old.profit_investor_percent
      or new.profit_operator_percent is distinct from old.profit_operator_percent then
      raise exception 'A published cycle''s profit split is locked';
    end if;
    if new.reserve_percent is distinct from old.reserve_percent then
      raise exception 'A published cycle''s emergency reserve is locked';
    end if;
    if new.commodity is distinct from old.commodity then
      raise exception 'A published cycle''s commodity is locked';
    end if;
    if new.minimum_ticket is distinct from old.minimum_ticket then
      raise exception 'A published cycle''s minimum entry ticket is locked';
    end if;
  end if;
  return new;
end;
$$;

create trigger farm_cycles_freeze_terms
  before update on public.farm_cycles
  for each row execute function public.freeze_cycle_terms();

-- ----------------------------------------------------------------------------
-- 12. Self-investment guard
-- ----------------------------------------------------------------------------
-- A member must not be able to credit their own equity. Successful investments
-- may only ever be written by the service role (the Paystack webhook, or an
-- admin verifying a bank transfer through a server function). This trigger
-- makes that a database rule rather than a frontend convention.

create or replace function public.guard_investment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the service role, which is the only writer allowed
  -- to move an investment into 'success' without being an admin.
  if new.status = 'success' and (tg_op = 'INSERT' or old.status is distinct from 'success') then
    if auth.uid() is not null and not private.has_role(auth.uid(), 'admin'::public.app_role) then
      raise exception 'Only the payment webhook or an admin may credit an investment';
    end if;
    if new.verified_at is null then
      new.verified_at = now();
    end if;
  end if;
  return new;
end;
$$;

create trigger cycle_investments_status_guard
  before insert or update on public.cycle_investments
  for each row execute function public.guard_investment_status();

-- ============================================================================
-- 13. Share transfer guard
-- ----------------------------------------------------------------------------
-- A member may only offer equity they actually hold: the par value offered can
-- never exceed their verified capital in that cycle.
-- ============================================================================

create or replace function public.guard_transfer_capital()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  held numeric(16, 2);
  v_actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    -- A buyer claiming an offer may set only their own claim. The terms of the
    -- offer belong to the seller, and only an admin may rewrite them.
    if v_actor is not null
       and v_actor <> old.seller_id
       and not private.has_role(v_actor, 'admin'::public.app_role) then
      if new.capital_amount <> old.capital_amount
         or new.cycle_id <> old.cycle_id
         or new.seller_id <> old.seller_id
         or new.asking_price <> old.asking_price
         or new.buyer_id is distinct from v_actor then
        raise exception 'A buyer may only claim the offer as published';
      end if;
    end if;

    if old.capital_amount = new.capital_amount
       and old.cycle_id = new.cycle_id and old.seller_id = new.seller_id then
      return new;
    end if;
  end if;

  -- Live capital held by the seller, already net of any earlier transfer, so an
  -- over-offer is refused at the database level rather than in the UI.
  select coalesce(sum(amount - transferred_out), 0) into held
  from public.cycle_investments
  where cycle_id = new.cycle_id
    and member_id = new.seller_id
    and status = 'success';

  if new.capital_amount > held then
    raise exception 'A member cannot offer more equity than they hold (% offered, % held)', new.capital_amount, held;
  end if;

  return new;
end;
$$;

create trigger share_transfers_capital_guard
  before insert or update on public.share_transfers
  for each row execute function public.guard_transfer_capital();

