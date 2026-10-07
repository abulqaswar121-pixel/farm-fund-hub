-- ============================================================================
-- NDH AGRICAPITAL — rollover guards
-- ----------------------------------------------------------------------------
-- Level 4 of the waterfall pays a member their principal and their profit. Some
-- of that money never leaves the co-operative: the member instructs it back
-- into the next open cycle, and apply_rollover() books it as verified capital
-- there.
--
-- The first version of that function could book the same payout twice, and
-- could book more than the member had actually earned, because it checked
-- nothing but the destination cycle. That is a double-payment waiting to
-- happen, so this migration closes it:
--
--   1. a rollover must reference a member with an executed settlement line in
--      the source cycle;
--   2. a rollover may never exceed what that line is still owed — and the mode
--      decides which bucket it draws from (principal, profit, or the whole
--      line);
--   3. whatever has already been rolled out of that line is subtracted, so
--      running the instruction twice simply runs out of room;
--   4. when the whole line has been rolled into the next cycle the line is
--      marked `withheld`, and a withheld line can never be marked paid in cash
--      afterwards. Cash and equity are the same money; the ledger must not
--      count it twice.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. How much of a settlement line has already gone back into the co-op
-- ----------------------------------------------------------------------------
create or replace function private.rolled_over_amount(_source_cycle_id uuid, _member_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric(16, 2)
  from public.cycle_investments
  where rollover_source_cycle_id = _source_cycle_id
    and member_id = _member_id
    and status = 'success'::public.investment_status;
$$;

comment on function private.rolled_over_amount(uuid, uuid) is
  'Capital already credited elsewhere from one member''s settlement in one source cycle.';

revoke all on function private.rolled_over_amount(uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Booking a rollover — now bounded by the member's own settlement line
-- ----------------------------------------------------------------------------
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
  v_line public.waterfall_lines;
  v_rolled numeric(16, 2);
  v_cap numeric(16, 2);
  v_available numeric(16, 2);
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

  -- The member's own settlement in the source cycle is the only thing a
  -- rollover may draw on. Lock it so two concurrent runs cannot both read the
  -- same headroom.
  select *
  into v_line
  from public.waterfall_lines
  where cycle_id = _source_cycle_id
    and member_id = _member_id
  for update;

  if not found then
    raise exception 'No settlement line exists for that member in the source cycle';
  end if;

  if v_line.payout_status = 'paid'::public.payout_status then
    raise exception 'That payout has already been paid in cash and cannot be rolled over';
  end if;

  v_cap := case _mode
    when 'principal'::public.rollover_mode then v_line.principal_amount
    when 'profit'::public.rollover_mode then v_line.profit_amount
    else v_line.total_amount
  end;

  v_rolled := private.rolled_over_amount(_source_cycle_id, _member_id);
  v_available := v_cap - v_rolled;

  if _amount > v_available then
    raise exception
      'Rollover of % exceeds the % still available from that settlement (cap %, already rolled %)',
      _amount, _mode, v_cap, v_rolled;
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

  -- The whole line now lives in the next cycle: it is no longer cash the
  -- treasury owes, so it must stop looking like an unpaid payout.
  if v_rolled + _amount >= v_line.total_amount then
    update public.waterfall_lines
    set payout_status = 'withheld'::public.payout_status
    where id = v_line.id
      and payout_status <> 'withheld'::public.payout_status;
  end if;

  return v_row;
end;
$$;

revoke all on function public.apply_rollover(uuid, uuid, uuid, numeric, public.rollover_mode) from public, anon;
grant execute on function public.apply_rollover(uuid, uuid, uuid, numeric, public.rollover_mode) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. A withheld payout can never be marked as cash paid
-- ----------------------------------------------------------------------------
create or replace function private.protect_withheld_payout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.payout_status = 'withheld'::public.payout_status
     and new.payout_status = 'paid'::public.payout_status then
    raise exception
      'This payout was rolled into the next cycle and cannot also be marked paid in cash';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_withheld_payout on public.waterfall_lines;
create trigger guard_withheld_payout
  before update on public.waterfall_lines
  for each row
  execute function private.protect_withheld_payout();
