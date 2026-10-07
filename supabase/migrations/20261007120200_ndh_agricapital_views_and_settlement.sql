-- ============================================================================
-- NDH AGRICAPITAL — public views and the settlement engine
-- ----------------------------------------------------------------------------
-- Two things live here:
--
--  1. The deliberately public read surfaces. The marketplace must show how
--     funded a cycle is without exposing a single member's holdings, so
--     aggregates are published and individual capital stays behind RLS.
--
--  2. run_cycle_waterfall() — the only way a settlement can ever be produced.
--     It runs as SECURITY DEFINER so it can read the whole book to compute
--     equity, but it refuses to run for anyone who is not an admin, and it
--     refuses to run twice for the same cycle.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Aggregate funding — safe for the open internet
-- ----------------------------------------------------------------------------

create or replace view public.cycle_funding as
select
  c.id as cycle_id,
  c.code,
  c.target_capital,
  c.minimum_ticket,
  -- Net of capital handed to another member through the transfer board. A
  -- transfer moves ownership, not money, so the cycle total is unchanged: the
  -- buyer's new row offsets the seller's transferred_out.
  coalesce(sum(i.amount - i.transferred_out) filter (where i.status = 'success'), 0)::numeric(16, 2) as raised_capital,
  count(distinct i.member_id) filter (where i.status = 'success')::int as investor_count,
  case
    when c.target_capital > 0 then least(
      100,
      round(coalesce(sum(i.amount - i.transferred_out) filter (where i.status = 'success'), 0) / c.target_capital * 100, 2)
    )
    else 0
  end::numeric(7, 2) as funded_percent
from public.farm_cycles c
left join public.cycle_investments i on i.cycle_id = c.id
where c.locked_at is not null and c.status <> 'cancelled'::public.cycle_status
group by c.id, c.code, c.target_capital, c.minimum_ticket;

comment on view public.cycle_funding is
  'Public funding progress. Aggregates only — no member identity or individual amount is exposed.';

grant select on public.cycle_funding to anon, authenticated;
grant all on public.cycle_funding to service_role;

-- ----------------------------------------------------------------------------
-- 2. Public transparency feed
-- ----------------------------------------------------------------------------
-- Only logs an admin has approved, and only the operator's own public summary
-- line. Costs, mortality detail and internal notes never leave this view.

create or replace view public.public_milestones as
select
  l.id,
  l.cycle_id,
  c.code as cycle_code,
  c.name as cycle_name,
  c.commodity,
  l.log_type,
  l.log_date,
  coalesce(nullif(trim(l.public_summary), ''), 'Farm activity recorded.') as summary,
  l.created_at
from public.operational_logs l
join public.farm_cycles c on c.id = l.cycle_id
where l.review_status = 'approved'::public.review_status
  and c.locked_at is not null
  and c.status <> 'cancelled'::public.cycle_status
order by l.log_date desc, l.created_at desc;

comment on view public.public_milestones is
  'Approved, non-financial farm milestones for the public transparency feed.';

grant select on public.public_milestones to anon, authenticated;
grant all on public.public_milestones to service_role;

-- ----------------------------------------------------------------------------
-- 2b. Public settlement figures
-- ----------------------------------------------------------------------------
-- "Historical returns" must be counted from settled cycles, but the raw
-- settlement and harvest tables stay behind RLS. These two views publish the
-- cycle-level totals and nothing else — no member identity, no individual
-- holding, no payout line.

create or replace view public.cycle_returns as
select
  d.cycle_id,
  d.gross_revenue,
  d.capital_raised,
  d.operational_liabilities,
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
  d.total_paid_out,
  d.executed_at
from public.waterfall_distributions d
where d.status <> 'draft'::public.distribution_status;

comment on view public.cycle_returns is
  'Per-cycle settlement totals for public transparency. Aggregates only.';

grant select on public.cycle_returns to anon, authenticated;
grant all on public.cycle_returns to service_role;

create or replace view public.platform_returns as
select
  count(*)::int as settled_cycles,
  coalesce(sum(capital_raised), 0)::numeric(16, 2) as capital_settled,
  coalesce(sum(principal_returned), 0)::numeric(16, 2) as capital_returned,
  coalesce(sum(investor_profit_pool), 0)::numeric(16, 2) as investor_profit_paid,
  coalesce(sum(operator_fee), 0)::numeric(16, 2) as operator_fee_paid,
  coalesce(sum(net_profit), 0)::numeric(16, 2) as net_profit_total
from public.waterfall_distributions
where status <> 'draft'::public.distribution_status;

comment on view public.platform_returns is
  'Platform-wide settlement totals. Returns an all-zero row before the first settlement, never a fabricated figure.';

grant select on public.platform_returns to anon, authenticated;
grant all on public.platform_returns to service_role;

-- The open harvest weigh-in is published too: total weight, the batch scale
-- ticket and the buyer are exactly the facts a member should be able to check.
create or replace view public.cycle_harvest as
select
  h.cycle_id,
  h.harvest_date,
  h.total_weight_kg,
  h.total_count,
  h.scale_ticket_ref,
  h.buyer,
  h.buyer_note,
  h.gross_revenue,
  h.revenue_received_on
from public.harvest_records h
join public.farm_cycles c on c.id = h.cycle_id
where c.locked_at is not null and c.status <> 'cancelled'::public.cycle_status;

comment on view public.cycle_harvest is
  'The public harvest weigh-in record: weight, scale ticket, buyer and banked revenue.';

grant select on public.cycle_harvest to anon, authenticated;
grant all on public.cycle_harvest to service_role;

-- Co-operative scale, published so the hero band can state it truthfully.
create or replace view public.platform_scale as
select
  (select count(*) from public.user_roles
     where role in ('member'::public.app_role, 'contributor'::public.app_role))::int as members,
  (select count(*) from public.farm_cycles where locked_at is not null)::int as cycles_total,
  (select count(*) from public.farm_cycles
     where status = 'active'::public.cycle_status)::int as cycles_active;

comment on view public.platform_scale is
  'How large the co-operative is right now. Counts only.';

grant select on public.platform_scale to anon, authenticated;
grant all on public.platform_scale to service_role;

-- The latest approved stock level for every running cycle: head count, biomass
-- and sampled weight. This is what lets a marketplace card say
-- "650 g average weight today" without exposing a single naira of cost.
create or replace view public.cycle_stock_level as
select distinct on (l.cycle_id)
  l.cycle_id,
  c.code,
  c.name,
  c.commodity,
  l.log_date,
  l.population_count,
  l.biomass_kg,
  l.sample_avg_weight_g,
  l.crates_collected,
  l.bags_harvested
from public.operational_logs l
join public.farm_cycles c on c.id = l.cycle_id
where l.review_status = 'approved'::public.review_status
  and c.locked_at is not null
  and c.status <> 'cancelled'::public.cycle_status
order by l.cycle_id, l.log_date desc, l.created_at desc;

comment on view public.cycle_stock_level is
  'Latest approved, non-financial stock telemetry per cycle for the public marketplace.';

grant select on public.cycle_stock_level to anon, authenticated;
grant all on public.cycle_stock_level to service_role;

-- ----------------------------------------------------------------------------
-- 3. A member's own position in a cycle
-- ----------------------------------------------------------------------------
-- Uses auth.uid() internally so the caller cannot ask about anyone else. This
-- is the live equity calculation the brief requires — derived from the ledger
-- on every read, never read from a stored column.

create or replace function public.my_cycle_position(_cycle_id uuid)
returns table (
  member_capital numeric,
  cycle_capital numeric,
  equity_percent numeric,
  funded_percent numeric,
  investor_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select
      coalesce(sum(amount - transferred_out) filter (where member_id = auth.uid()), 0)::numeric(16, 2) as mine,
      coalesce(sum(amount - transferred_out), 0)::numeric(16, 2) as everyone,
      count(distinct member_id)::int as members
    from public.cycle_investments
    where cycle_id = _cycle_id and status = 'success'
  ),
  goal as (
    select target_capital from public.farm_cycles where id = _cycle_id
  )
  select
    t.mine,
    t.everyone,
    case when t.everyone > 0 then round(t.mine / t.everyone * 100, 4) else 0 end::numeric,
    case when g.target_capital > 0
      then least(100, round(t.everyone / g.target_capital * 100, 2)) else 0 end::numeric,
    t.members
  from totals t cross join goal g;
$$;

revoke all on function public.my_cycle_position(uuid) from public, anon;
grant execute on function public.my_cycle_position(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. The whole book for one cycle — staff only
-- ----------------------------------------------------------------------------
-- The admin settlement screen needs every member's verified capital and their
-- live equity percentage. Members are refused.

create or replace function public.cycle_position_book(_cycle_id uuid)
returns table (
  member_id uuid,
  full_name text,
  member_capital numeric,
  equity_percent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- The full contribution book is investor data. Admins need it to verify and
  -- settle; an operator running the farm never should.
  if auth.uid() is not null and not private.is_admin(auth.uid()) then
    raise exception 'Only the treasury admin can read the full contribution book';
  end if;

  return query
  with verified as (
    select i.member_id, sum(i.amount - i.transferred_out)::numeric(16, 2) as capital
    from public.cycle_investments i
    where i.cycle_id = _cycle_id and i.status = 'success'
    group by i.member_id
  ),
  total as (select coalesce(sum(capital), 0)::numeric(16, 2) as pool from verified)
  select
    v.member_id,
    coalesce(p.full_name, 'Unnamed member'),
    v.capital,
    case when t.pool > 0 then round(v.capital / t.pool * 100, 4) else 0 end::numeric
  from verified v
  cross join total t
  left join public.profiles p on p.id = v.member_id
  order by v.capital desc;
end;
$$;

revoke all on function public.cycle_position_book(uuid) from public, anon;
grant execute on function public.cycle_position_book(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. The settlement engine
-- ----------------------------------------------------------------------------
-- Runs the strict four-level waterfall defined in the brief:
--
--   Level 1  outstanding operational liabilities and supplier debts
--   Level 2  100% of capital principal, pro-rata
--   Level 3  the cycle's locked emergency reserve, into escrow
--   Level 4  net profit, split at the frozen ratio
--
-- Refuses to run for a non-admin, refuses a negative revenue, and refuses to
-- settle the same cycle twice — a double payout is the one mistake this
-- system must never make.

create or replace function public.run_cycle_waterfall(
  _cycle_id uuid,
  _gross_revenue numeric,
  _note text default null
)
returns public.waterfall_distributions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.farm_cycles;
  v_capital numeric(16, 2);
  v_liabilities numeric(16, 2);
  v_remaining numeric(16, 2);
  v_liabilities_paid numeric(16, 2);
  v_principal numeric(16, 2);
  v_reserve_target numeric(16, 2);
  v_reserve numeric(16, 2);
  v_profit numeric(16, 2);
  v_investor_pool numeric(16, 2);
  v_operator_fee numeric(16, 2);
  v_total_paid numeric(16, 2);
  v_dist public.waterfall_distributions;
begin
  if auth.uid() is not null and not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only an admin can run a cycle settlement';
  end if;

  select * into v_cycle from public.farm_cycles where id = _cycle_id;
  if v_cycle.id is null then
    raise exception 'Cycle not found';
  end if;

  if _gross_revenue is null or _gross_revenue < 0 then
    raise exception 'Gross revenue must be zero or greater';
  end if;

  if exists (
    select 1 from public.waterfall_distributions
    where cycle_id = _cycle_id and status <> 'draft'::public.distribution_status
  ) then
    raise exception 'This cycle has already been settled. Void the existing run before settling again.';
  end if;

  -- Level 1 input: supplier balances still unpaid in this cycle.
  select coalesce(sum(amount), 0)::numeric(16, 2) into v_liabilities
  from public.farm_expenses
  where cycle_id = _cycle_id and is_payable and settled_on is null;

  -- Level 2 input: verified capital, and nothing but verified capital.
  select coalesce(sum(amount - transferred_out), 0)::numeric(16, 2) into v_capital
  from public.cycle_investments
  where cycle_id = _cycle_id and status = 'success';

  -- Run the levels in strict priority order.
  v_remaining := round(_gross_revenue, 2);
  v_liabilities_paid := least(v_remaining, v_liabilities);
  v_remaining := v_remaining - v_liabilities_paid;

  v_principal := least(v_remaining, v_capital);
  v_remaining := v_remaining - v_principal;

  v_reserve_target := round(_gross_revenue * v_cycle.reserve_percent / 100, 2);
  v_reserve := least(v_remaining, v_reserve_target);
  v_remaining := v_remaining - v_reserve;

  v_profit := round(v_remaining, 2);
  v_investor_pool := round(v_profit * v_cycle.profit_investor_percent / 100, 2);
  v_operator_fee := round(v_profit - v_investor_pool, 2);

  insert into public.waterfall_distributions (
    cycle_id, status, gross_revenue, capital_raised, operational_liabilities,
    profit_investor_percent, profit_operator_percent, reserve_percent,
    liabilities_paid, principal_returned, reserve_set_aside,
    net_profit, investor_profit_pool, operator_fee,
    principal_at_risk, note, run_by, executed_at
  )
  values (
    _cycle_id, 'executed', round(_gross_revenue, 2), v_capital, v_liabilities,
    v_cycle.profit_investor_percent, v_cycle.profit_operator_percent, v_cycle.reserve_percent,
    round(v_liabilities_paid, 2), round(v_principal, 2), round(v_reserve, 2),
    v_profit, v_investor_pool, v_operator_fee,
    (v_principal < v_capital), nullif(trim(_note), ''), coalesce(auth.uid(), v_cycle.created_by), now()
  )
  returning * into v_dist;

  -- Freeze each member's slice onto the run. Capital and equity are copied in,
  -- so a later ledger adjustment can never rewrite settled history.
  insert into public.waterfall_lines (
    distribution_id, cycle_id, member_id, capital, equity_percent,
    principal_amount, profit_amount, total_amount
  )
  select
    v_dist.id,
    _cycle_id,
    t.member_id,
    t.capital,
    case when v_capital > 0 then round(t.capital / v_capital * 100, 4) else 0 end,
    case when v_capital > 0 then round(t.capital / v_capital * v_principal, 2) else 0 end,
    case when v_capital > 0 then round(t.capital / v_capital * v_investor_pool, 2) else 0 end,
    case when v_capital > 0
      then round(t.capital / v_capital * (v_principal + v_investor_pool), 2) else 0 end
  from (
    select member_id, sum(amount - transferred_out)::numeric(16, 2) as capital
    from public.cycle_investments
    where cycle_id = _cycle_id and status = 'success'
    group by member_id
  ) t;

  select coalesce(sum(total_amount), 0)::numeric(16, 2) into v_total_paid
  from public.waterfall_lines where distribution_id = v_dist.id;

  update public.waterfall_distributions
  set total_paid_out = v_total_paid
  where id = v_dist.id
  returning * into v_dist;

  -- Level 1 debts are now settled; close the payable rows we just paid.
  update public.farm_expenses
  set settled_on = current_date
  where cycle_id = _cycle_id and is_payable and settled_on is null and v_liabilities_paid >= v_liabilities;

  update public.farm_cycles
  set status = 'settled'::public.cycle_status,
      current_stage = 'waterfall_distribution'::public.stage_id,
      updated_at = now()
  where id = _cycle_id;

  return v_dist;
end;
$$;

revoke all on function public.run_cycle_waterfall(uuid, numeric, text) from public, anon;
grant execute on function public.run_cycle_waterfall(uuid, numeric, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Cycle publication
-- ----------------------------------------------------------------------------
-- Publishing stamps locked_at, which is what makes the terms immutable (see
-- the freeze_cycle_terms trigger) and what makes the cycle publicly visible.

create or replace function public.publish_farm_cycle(_cycle_id uuid)
returns public.farm_cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.farm_cycles;
begin
  if auth.uid() is not null and not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only an admin can publish a cycle';
  end if;

  update public.farm_cycles
  set locked_at = coalesce(locked_at, now()),
      status = case when status = 'draft'::public.cycle_status
                    then 'open'::public.cycle_status else status end,
      updated_at = now()
  where id = _cycle_id
  returning * into v_cycle;

  if v_cycle.id is null then
    raise exception 'Cycle not found';
  end if;

  return v_cycle;
end;
$$;

revoke all on function public.publish_farm_cycle(uuid) from public, anon;
grant execute on function public.publish_farm_cycle(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. Settling a co-op share transfer
-- ----------------------------------------------------------------------------
-- This is the only operation that moves equity between members, and only an
-- admin can run it. It is deliberately append-and-offset rather than
-- edit-and-erase:
--
--   * the BUYER receives a new verified investment row, so their equity rises;
--   * the SELLER's rows are marked transferred_out, oldest first, so their
--     equity falls by the same amount and their original contribution history
--     is preserved intact.
--
-- The cycle's total capital is therefore unchanged, which is the whole point:
-- a transfer reallocates ownership, it does not add or remove money.

create or replace function public.settle_share_transfer(_transfer_id uuid)
returns public.share_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.share_transfers;
  v_row record;
  v_remaining numeric(16, 2);
  v_take numeric(16, 2);
begin
  if auth.uid() is not null and not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only an admin can settle a share transfer';
  end if;

  select * into v_transfer from public.share_transfers where id = _transfer_id;
  if v_transfer.id is null then
    raise exception 'Transfer not found';
  end if;
  if v_transfer.status = 'settled' then
    raise exception 'That transfer has already been settled';
  end if;
  if v_transfer.buyer_id is null then
    raise exception 'A transfer can only be settled once a buyer has claimed it';
  end if;
  if v_transfer.buyer_id = v_transfer.seller_id then
    raise exception 'A member cannot buy their own equity';
  end if;

  -- Credit the buyer.
  insert into public.cycle_investments (
    cycle_id, member_id, amount, method, status, verified_at, verified_by,
    note, recorded_by
  )
  values (
    v_transfer.cycle_id, v_transfer.buyer_id, v_transfer.capital_amount,
    'manual', 'success', now(), coalesce(auth.uid(), v_transfer.seller_id),
    format('Purchased at par from another member via co-op transfer %s', v_transfer.id),
    auth.uid()
  );

  -- Debit the seller against their own rows, oldest first, so the offset is
  -- traceable back to specific contributions.
  v_remaining := v_transfer.capital_amount;
  for v_row in
    select id, amount, transferred_out
    from public.cycle_investments
    where cycle_id = v_transfer.cycle_id
      and member_id = v_transfer.seller_id
      and status = 'success'
      and transferred_out < amount
    order by date asc, created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_row.amount - v_row.transferred_out);
    update public.cycle_investments
    set transferred_out = transferred_out + v_take,
        transfer_id = coalesce(transfer_id, v_transfer.id)
    where id = v_row.id;
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    -- Nothing has been committed yet only if the guard let an over-offer
    -- through, which it cannot. Fail loudly rather than settle half a deal.
    raise exception 'Seller no longer holds enough equity to complete this transfer';
  end if;

  update public.share_transfers
  set status = 'settled', settled_at = now(), settled_by = coalesce(auth.uid(), v_transfer.seller_id)
  where id = _transfer_id
  returning * into v_transfer;

  return v_transfer;
end;
$$;

revoke all on function public.settle_share_transfer(uuid) from public, anon;
grant execute on function public.settle_share_transfer(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9. Rollover — carry a settled payout into the next open cycle
-- ----------------------------------------------------------------------------
-- Called by the admin when closing a settlement run. It credits the member's
-- instruction against the next open cycle, recording the source cycle so the
-- money is traceable end to end.

create or replace function public.apply_rollover(
  _source_cycle_id uuid,
  _destination_cycle_id uuid,
  _member_id uuid,
  _amount numeric,
  _mode public.rollover_mode
)
returns public.cycle_investments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cycle_investments;
begin
  if auth.uid() is not null and not private.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Only an admin can apply a rollover';
  end if;

  if _amount is null or _amount <= 0 then
    raise exception 'A rollover must move a positive amount';
  end if;

  if _source_cycle_id = _destination_cycle_id then
    raise exception 'A rollover must move capital into a different cycle';
  end if;

  if (select status from public.farm_cycles where id = _destination_cycle_id)
     not in ('open'::public.cycle_status, 'funded'::public.cycle_status) then
    raise exception 'Rollover destination must be a cycle that is still open';
  end if;

  insert into public.cycle_investments (
    cycle_id, member_id, amount, method, status, verified_at, verified_by,
    rollover_source_cycle_id, note, recorded_by
  )
  values (
    _destination_cycle_id, _member_id, _amount, 'rollover', 'success', now(),
    coalesce(auth.uid(), _member_id), _source_cycle_id,
    format('Automatic %s rollover from the previous cycle', _mode::text), auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.apply_rollover(uuid, uuid, uuid, numeric, public.rollover_mode) from public, anon;
grant execute on function public.apply_rollover(uuid, uuid, uuid, numeric, public.rollover_mode) to authenticated, service_role;
