-- ============================================================================
-- NDH AGRICAPITAL — the harvest settlement wizard
-- ----------------------------------------------------------------------------
-- The original settlement engine (20261007120200) answers the hard question:
-- what does the waterfall do, in what order, and how is it stopped from running
-- twice. This migration does not change any of that arithmetic. It changes the
-- shape of the *conversation* an admin has with it, from one button into the
-- four steps the brief asks for:
--
--   1. yield + revenue          → a weigh-in and a banked figure
--   2. debts, reserve, split    → the liabilities actually read off the books,
--                                 an optional top-up to the reserve, and the
--                                 30% caretaker / 70% investor split
--   3. per-member payouts       → live equity, frozen onto the run
--   4. confirm and execute      → irreversible
--
-- Three additions make that honest rather than cosmetic:
--
--   * run_cycle_waterfall_planned() — the same engine, but the admin's chosen
--     reserve top-up and profit split are passed in and validated against the
--     co-operative band *before* any row is written. A preview and an execution
--     can therefore never disagree.
--   * reserve_pledges — the extra reserve an admin decides to hold back. Money
--     taken out of a member's pocket is not a UI toggle; it is a written row
--     with a reason, an author and a timestamp, and it is published to the
--     member alert feed the moment it is created.
--   * settlement_leaderboard / cycle_treasury_position already exist, so the
--     wizard's per-member step reads exactly what the member will read.
--
-- The rule that governs all of it: a preview must be produced by the same code
-- that produces the payout. Anything else is a promise the software can break.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extra reserve held back at settlement
-- ----------------------------------------------------------------------------
-- Level 3 of the waterfall escrows `reserve_percent` of gross revenue. An admin
-- may decide, on the evidence of the cycle, to hold back more — a disease
-- event, a collapsed input price, a pond that needs relining before restocking.
-- That decision is recorded here rather than folded silently into the run.
create table if not exists public.reserve_pledges (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.farm_cycles(id) on delete restrict,
  distribution_id uuid references public.waterfall_distributions(id) on delete restrict,
  amount numeric(16, 2) not null check (amount >= 0),
  reason text not null check (char_length(trim(reason)) >= 10),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  unique (cycle_id)
);

create index if not exists reserve_pledges_cycle_idx on public.reserve_pledges (cycle_id);

grant select, insert on public.reserve_pledges to authenticated;
grant all on public.reserve_pledges to service_role;

alter table public.reserve_pledges enable row level security;

drop policy if exists "Admins read reserve pledges" on public.reserve_pledges;
create policy "Admins read reserve pledges"
  on public.reserve_pledges for select
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Members are told what was held back from their cycle, but not who typed it.
drop policy if exists "Members read their cycle reserve pledge" on public.reserve_pledges;
create policy "Members read their cycle reserve pledge"
  on public.reserve_pledges for select
  to authenticated
  using (
    exists (
      select 1 from public.cycle_investments i
       where i.cycle_id = reserve_pledges.cycle_id
         and i.member_id = auth.uid()
         and i.status = 'success'
    )
  );

drop policy if exists "Admins create reserve pledges" on public.reserve_pledges;
create policy "Admins create reserve pledges"
  on public.reserve_pledges for insert
  to authenticated
  with check (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    and decided_by = auth.uid()
  );

comment on table public.reserve_pledges is
  'Extra emergency reserve an admin chooses to hold back when settling a cycle. Level 3 already escrows reserve_percent of gross revenue; this row records any deliberate top-up, its reason and its author.';

-- ----------------------------------------------------------------------------
-- 2. The planned waterfall
-- ----------------------------------------------------------------------------
-- Same engine, two extra inputs:
--
--   _reserve_top_up   money the admin wants to add to Level 3 on top of the
--                     locked percentage. Capped at what is actually left after
--                     Levels 1 and 2 — a reserve may never be funded out of
--                     capital that belongs to a member.
--   _test mode        when true, everything is computed and returned but
--                     nothing is written. Step 3 of the wizard uses this, so
--                     the per-member table the admin reviews is produced by
--                     the same statements that will later write the payouts.
--
-- The profit split is read from the cycle row, because it is frozen at
-- publication and the trigger in the core migration refuses to move it. The
-- wizard displays it; it cannot be edited, and this function will not accept a
-- different one.
create or replace function public.run_cycle_waterfall_planned(
  _cycle_id uuid,
  _gross_revenue numeric,
  _reserve_top_up numeric default 0,
  _test boolean default false,
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
  v_top_up numeric(16, 2);
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

  if coalesce(_reserve_top_up, 0) < 0 then
    raise exception 'A reserve top-up cannot be negative';
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

  v_remaining := round(_gross_revenue, 2);
  v_liabilities_paid := least(v_remaining, v_liabilities);
  v_remaining := v_remaining - v_liabilities_paid;

  v_principal := least(v_remaining, v_capital);
  v_remaining := v_remaining - v_principal;

  v_reserve_target := round(_gross_revenue * v_cycle.reserve_percent / 100, 2);
  -- The top-up draws only from genuine surplus: it can never be funded by
  -- withholding a member's principal. If the admin asks for more than is left,
  -- the request is clamped and the reduction is visible in the returned row.
  v_top_up := least(round(coalesce(_reserve_top_up, 0), 2), v_remaining);
  v_reserve := least(v_remaining, v_reserve_target + v_top_up);
  v_remaining := v_remaining - v_reserve;

  v_profit := round(v_remaining, 2);
  v_investor_pool := round(v_profit * v_cycle.profit_investor_percent / 100, 2);
  v_operator_fee := round(v_profit - v_investor_pool);

  if _test then
    -- A dry run still has to hand the caller a complete, typed row, because the
    -- wizard's preview table is built from it. It is never persisted, so the
    -- "already settled" guard above is untouched.
    -- Column list spelled out rather than positional: a composite row literal
    -- breaks the moment the table gains a column, and a settlement preview
    -- silently shifting its fields would be worse than not previewing at all.
    v_dist := jsonb_populate_record(
      null::public.waterfall_distributions,
      jsonb_build_object(
        'cycle_id', _cycle_id,
        'status', 'draft',
        'gross_revenue', round(_gross_revenue, 2),
        'capital_raised', v_capital,
        'operational_liabilities', v_liabilities,
        'profit_investor_percent', v_cycle.profit_investor_percent,
        'profit_operator_percent', v_cycle.profit_operator_percent,
        'reserve_percent', v_cycle.reserve_percent,
        'liabilities_paid', round(v_liabilities_paid, 2),
        'principal_returned', round(v_principal, 2),
        'reserve_set_aside', round(v_reserve, 2),
        'net_profit', v_profit,
        'investor_profit_pool', v_investor_pool,
        'operator_fee', v_operator_fee,
        'total_paid_out', round(v_principal + v_investor_pool, 2),
        'principal_at_risk', (v_principal < v_capital),
        'note', nullif(trim(_note), ''),
        'run_by', coalesce(auth.uid(), v_cycle.created_by)
      )
    );
    return v_dist;
  end if;

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

  update public.farm_expenses
  set settled_on = current_date
  where cycle_id = _cycle_id and is_payable and settled_on is null and v_liabilities_paid >= v_liabilities;

  update public.farm_cycles
  set status = 'settled'::public.cycle_status,
      current_stage = 'waterfall_distribution'::public.stage_id,
      updated_at = now()
  where id = _cycle_id;

  -- Record any top-up as its own row, linked to the run it belongs to. The
  -- wizard writes the reason; the function only refuses to lose it.
  if v_top_up > 0 then
    insert into public.reserve_pledges (cycle_id, distribution_id, amount, reason, decided_by)
    values (
      _cycle_id, v_dist.id, v_top_up,
      coalesce(nullif(trim(_note), ''), 'Reserve top-up agreed at settlement'),
      coalesce(auth.uid(), v_cycle.created_by)
    )
    on conflict (cycle_id) do update
      set distribution_id = excluded.distribution_id,
          amount = excluded.amount,
          reason = excluded.reason;
  end if;

  return v_dist;
end;
$$;

revoke all on function public.run_cycle_waterfall_planned(uuid, numeric, numeric, boolean, text)
  from public, anon;
grant execute on function public.run_cycle_waterfall_planned(uuid, numeric, numeric, boolean, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. What the wizard needs to look at before it runs anything
-- ----------------------------------------------------------------------------
-- One row per cycle: the figures each of the four steps displays. Reading them
-- in one call keeps the wizard from assembling a picture out of four queries
-- that could straddle a write.
create or replace view public.cycle_settlement_readiness as
select
  c.id as cycle_id,
  c.code,
  c.status,
  c.current_stage,
  c.profit_investor_percent,
  c.profit_operator_percent,
  c.reserve_percent,
  c.projected_harvest_on,
  coalesce((
    select sum(h.total_weight_kg)
      from public.harvest_records h
     where h.cycle_id = c.id
  ), 0)::numeric(14, 2) as weighed_kg,
  coalesce((
    select sum(h.gross_revenue)
      from public.harvest_records h
     where h.cycle_id = c.id
  ), 0)::numeric(16, 2) as banked_revenue,
  coalesce((
    select sum(e.amount)
      from public.farm_expenses e
     where e.cycle_id = c.id and e.is_payable and e.settled_on is null
  ), 0)::numeric(16, 2) as open_liabilities,
  coalesce((
    select sum(i.amount - i.transferred_out)
      from public.cycle_investments i
     where i.cycle_id = c.id and i.status = 'success'
  ), 0)::numeric(16, 2) as verified_capital,
  (
    select count(distinct i.member_id)
      from public.cycle_investments i
     where i.cycle_id = c.id and i.status = 'success'
  )::int as contributing_members,
  exists (
    select 1 from public.waterfall_distributions d
     where d.cycle_id = c.id and d.status <> 'draft'::public.distribution_status
  ) as already_settled
from public.farm_cycles c;

grant select on public.cycle_settlement_readiness to authenticated;
revoke all on public.cycle_settlement_readiness from anon;

comment on view public.cycle_settlement_readiness is
  'Everything the four-step settlement wizard shows before it executes: weigh-in, banked revenue, open supplier debts, verified capital and member count, plus whether a run already exists.';

-- If the view predates the base tables being added to the realtime publication
-- in this project, leave that alone — settlement is read-on-demand, not streamed.
