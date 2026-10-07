-- ============================================================================
-- NDH AGRICAPITAL — roles, grants and Row Level Security
-- ----------------------------------------------------------------------------
-- Every permission rule in the AgriCapital brief is enforced here, in the
-- database. The frontend hides what a role cannot do; this file is what
-- actually stops it.
--
--   public (anon)  : read published cycles, the milestone feed, incidents,
--                    weather snapshots
--   member         : read published cycles; read and create ONLY their own
--                    investment records (pending); read their own waterfall
--                    lines, visits, transfers and rollover instruction
--   operator       : everything a member can do, plus filing operational logs,
--                    expenses, harvest weigh-ins and incidents. CANNOT verify
--                    investments, edit equity or run a settlement.
--   admin          : full control of cycles, verification, settlement.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Retire the legacy third role
-- ----------------------------------------------------------------------------
-- 'contributor' and 'member' are the same access level under two names. Move
-- every existing row onto the new name so a single set of policies applies.
-- This preserves each account's privilege level exactly; no one gains access.

update public.user_roles set role = 'member' where role = 'contributor';

-- ----------------------------------------------------------------------------
-- 2. Role helpers
-- ----------------------------------------------------------------------------

/** True for a member OR a legacy contributor row. */
create or replace function private.is_member(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('member'::public.app_role, 'contributor'::public.app_role)
  )
$$;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated, service_role;

/** Admin or operator — the staff who run the farm. */
create or replace function private.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_role(_user_id, 'admin'::public.app_role)
      or private.has_role(_user_id, 'operator'::public.app_role)
$$;
revoke all on function private.is_staff(uuid) from public, anon;
grant execute on function private.is_staff(uuid) to authenticated, service_role;

/**
 * Admin only — the separation that matters most.
 *
 * A farm operator needs the production side: cycles, logs, expenses, harvests,
 * incidents and weather. They must never be able to read what any individual
 * member holds, what the cycle raised member-by-member, or what anyone was
 * paid. Every policy on a money table therefore checks `private.is_admin`, not
 * `private.is_staff`.
 */
create or replace function private.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select private.has_role(_user_id, 'admin'::public.app_role)
$$;
revoke all on function private.is_admin(uuid) from public, anon;
grant execute on function private.is_admin(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Sign-up assigns the member role
-- ----------------------------------------------------------------------------
-- Replaces the base-schema version, which handed out 'contributor'. The first
-- account ever created still becomes the admin so the co-operative can be
-- bootstrapped; every account after that is a member.

create or replace function public.ensure_profile(_user_id uuid, _full_name text default null)
returns public.app_role
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.app_role;
begin
  if _user_id is null then raise exception 'User id is required'; end if;
  perform pg_advisory_xact_lock(7319462);

  select role into selected_role from public.user_roles where user_id = _user_id limit 1;

  if selected_role is not null then
    insert into public.profiles (id, full_name)
    values (_user_id, nullif(trim(_full_name), ''))
    on conflict (id) do update
      set full_name = coalesce(nullif(trim(excluded.full_name), ''), public.profiles.full_name);
    return selected_role;
  end if;

  if exists (select 1 from public.user_roles) then
    selected_role := 'member';
  else
    selected_role := 'admin';
  end if;

  insert into public.profiles (id, full_name)
  values (_user_id, nullif(trim(_full_name), ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (_user_id, selected_role);
  return selected_role;
end;
$$;
revoke all on function public.ensure_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_profile(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 4. Grants
-- ----------------------------------------------------------------------------
-- Nothing is granted to anon except the deliberately public surfaces. The
-- financial tables are member-and-up only, and only through RLS.

revoke all on public.farm_cycles from anon, authenticated;
revoke all on public.cycle_investments from anon, authenticated;
revoke all on public.operational_logs from anon, authenticated;
revoke all on public.farm_expenses from anon, authenticated;
revoke all on public.harvest_records from anon, authenticated;
revoke all on public.waterfall_distributions from anon, authenticated;
revoke all on public.waterfall_lines from anon, authenticated;
revoke all on public.rollover_instructions from anon, authenticated;
revoke all on public.share_transfers from anon, authenticated;
revoke all on public.farm_visits from anon, authenticated;
revoke all on public.weather_snapshots from anon, authenticated;

-- published cycles: readable by the public
grant select on public.farm_cycles to anon, authenticated;
grant insert, update, delete on public.farm_cycles to authenticated;

-- capital records: authenticated only
grant select, insert, update, delete on public.cycle_investments to authenticated;

-- farm telemetry
grant select, insert, update, delete on public.operational_logs to authenticated;
grant select, insert, update, delete on public.farm_expenses to authenticated;
grant select, insert, update, delete on public.harvest_records to authenticated;
grant select, insert, update, delete on public.waterfall_distributions to authenticated;
grant select, insert, update, delete on public.waterfall_lines to authenticated;

-- innovation surfaces
grant select, insert, update, delete on public.rollover_instructions to authenticated;
grant select, insert, update, delete on public.share_transfers to authenticated;
grant select, insert, update, delete on public.farm_visits to authenticated;

-- incident register is public transparency; weather snapshots likewise
grant select on public.incidents to anon, authenticated;
grant insert, update, delete on public.incidents to authenticated;
grant select on public.weather_snapshots to anon, authenticated;
grant insert, update, delete on public.weather_snapshots to authenticated;

grant all on public.farm_cycles, public.cycle_investments, public.operational_logs,
  public.farm_expenses, public.harvest_records, public.waterfall_distributions,
  public.waterfall_lines, public.rollover_instructions, public.share_transfers,
  public.farm_visits, public.incidents, public.weather_snapshots to service_role;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.farm_cycles enable row level security;
alter table public.cycle_investments enable row level security;
alter table public.operational_logs enable row level security;
alter table public.farm_expenses enable row level security;
alter table public.harvest_records enable row level security;
alter table public.waterfall_distributions enable row level security;
alter table public.waterfall_lines enable row level security;
alter table public.rollover_instructions enable row level security;
alter table public.share_transfers enable row level security;
alter table public.farm_visits enable row level security;
alter table public.incidents enable row level security;
alter table public.weather_snapshots enable row level security;

-- 5.1 farm_cycles -----------------------------------------------------------

-- The public sees a cycle only once it has been published, and never a
-- cancelled one. Drafts stay invisible until an admin is ready.
create policy "Public can read published cycles"
  on public.farm_cycles for select
  to anon, authenticated
  using (locked_at is not null and status <> 'cancelled'::public.cycle_status);

-- Staff need to see drafts and cancellations too.
create policy "Staff can read every cycle"
  on public.farm_cycles for select
  to authenticated
  using (private.is_staff(auth.uid()));

create policy "Only admins can create cycles"
  on public.farm_cycles for insert
  to authenticated
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Only admins can edit cycles"
  on public.farm_cycles for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Only an unpublished draft may be deleted; a published cycle is permanent.
create policy "Only admins can delete unused drafts"
  on public.farm_cycles for delete
  to authenticated
  using (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    and locked_at is null
    and status = 'draft'::public.cycle_status
    and not exists (select 1 from public.cycle_investments i where i.cycle_id = farm_cycles.id)
  );

-- 5.2 cycle_investments -----------------------------------------------------

-- A member sees only their own capital. Only the admin sees the whole book.
-- An operator cannot read a single naira figure here.
create policy "Members read their own investments"
  on public.cycle_investments for select
  to authenticated
  using (member_id = auth.uid() or private.is_admin(auth.uid()));

-- A member may raise their own contribution, but ONLY into 'pending'. This is
-- the row that records an intent to pay; it carries no equity until the
-- webhook or an admin verifies it.
create policy "Members can raise their own pending contribution"
  on public.cycle_investments for insert
  to authenticated
  with check (
    member_id = auth.uid()
    and status = 'pending'::public.investment_status
    and verified_at is null
  );

-- Admins record and verify offline transfers.
create policy "Admins manage every investment"
  on public.cycle_investments for all
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.3 operational_logs ------------------------------------------------------

create policy "Authenticated members can read farm logs"
  on public.operational_logs for select
  to authenticated
  using (true);

create policy "Operators file farm logs"
  on public.operational_logs for insert
  to authenticated
  with check (
    private.is_staff(auth.uid())
    and recorded_by = auth.uid()
  );

-- Only an admin reviews, corrects or approves a log.
create policy "Admins review farm logs"
  on public.operational_logs for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins delete farm logs"
  on public.operational_logs for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.4 farm_expenses ---------------------------------------------------------

create policy "Staff read the expense book"
  on public.farm_expenses for select
  to authenticated
  using (private.is_staff(auth.uid()));

create policy "Operators record direct expenses"
  on public.farm_expenses for insert
  to authenticated
  with check (private.is_staff(auth.uid()) and recorded_by = auth.uid());

create policy "Admins manage expenses"
  on public.farm_expenses for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins delete expenses"
  on public.farm_expenses for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.5 harvest_records -------------------------------------------------------

create policy "Authenticated members can read harvest records"
  on public.harvest_records for select
  to authenticated
  using (true);

-- The operator files the open weigh-in. They cannot write revenue — that is
-- the sale, and it belongs to the admin's settlement.
create policy "Operators file the weigh-in, without revenue"
  on public.harvest_records for insert
  to authenticated
  with check (
    private.is_staff(auth.uid())
    and recorded_by = auth.uid()
    and gross_revenue = 0
    and revenue_received_on is null
  );

create policy "Admins record the sale"
  on public.harvest_records for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins delete harvest records"
  on public.harvest_records for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.6 waterfall_distributions ----------------------------------------------

-- Members can read a settlement that concerns their money. This is the
-- "invariant balance transparency" rule: nobody's payout maths is hidden.
create policy "Members can read settlements"
  on public.waterfall_distributions for select
  to authenticated
  using (true);

create policy "Only admins run a settlement"
  on public.waterfall_distributions for insert
  to authenticated
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Only admins amend a settlement"
  on public.waterfall_distributions for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Only admins void a settlement"
  on public.waterfall_distributions for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.7 waterfall_lines -------------------------------------------------------

create policy "Members read their own settlement line"
  on public.waterfall_lines for select
  to authenticated
  using (member_id = auth.uid() or private.is_admin(auth.uid()));

create policy "Only admins write settlement lines"
  on public.waterfall_lines for insert
  to authenticated
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Only admins settle or withhold a payout"
  on public.waterfall_lines for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Only admins remove settlement lines"
  on public.waterfall_lines for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.8 rollover_instructions -------------------------------------------------

create policy "Members manage their own rollover instruction"
  on public.rollover_instructions for all
  to authenticated
  using (member_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (member_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.9 share_transfers -------------------------------------------------------

-- Any signed-in member may browse live offers; a settled or withdrawn offer is
-- visible only to the two parties and to staff.
create policy "Members browse live offers"
  on public.share_transfers for select
  to authenticated
  using (
    status = 'offered'::public.transfer_status
    or seller_id = auth.uid()
    or buyer_id = auth.uid()
    or private.is_admin(auth.uid())
  );

create policy "Members offer their own equity at par"
  on public.share_transfers for insert
  to authenticated
  with check (
    seller_id = auth.uid()
    and status = 'offered'::public.transfer_status
    and buyer_id is null
  );

-- Three legitimate edits, and nothing else:
--   * the seller withdraws their own live offer;
--   * a different signed-in member claims a live offer, becoming the buyer;
--   * the admin settles or annotates it.
-- Settlement itself is still admin-only inside settle_share_transfer().
create policy "Sellers withdraw, buyers claim"
  on public.share_transfers for update
  to authenticated
  using (
    private.is_admin(auth.uid())
    or seller_id = auth.uid()
    or (
      status = 'offered'::public.transfer_status
      and buyer_id is null
      and seller_id <> auth.uid()
    )
  )
  with check (
    private.is_admin(auth.uid())
    or (seller_id = auth.uid() and status in ('offered'::public.transfer_status, 'withdrawn'::public.transfer_status))
    or (buyer_id = auth.uid() and status = 'claimed'::public.transfer_status)
  );

create policy "Admins remove a transfer"
  on public.share_transfers for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.10 farm_visits ----------------------------------------------------------

create policy "Members see their own bookings, staff see all"
  on public.farm_visits for select
  to authenticated
  using (member_id = auth.uid() or private.is_admin(auth.uid()));

create policy "Members book their own visit"
  on public.farm_visits for insert
  to authenticated
  with check (
    member_id = auth.uid()
    and status = 'requested'::public.visit_status
    and decided_by is null
  );

-- A member may cancel their own request; staff confirm, decline or complete.
create policy "Members cancel, staff decide"
  on public.farm_visits for update
  to authenticated
  using (member_id = auth.uid() or private.is_admin(auth.uid()))
  with check (
    private.is_admin(auth.uid())
    or (
      member_id = auth.uid()
      and status in ('requested'::public.visit_status, 'cancelled'::public.visit_status)
      and decided_by is null
    )
  );

create policy "Admins remove a booking"
  on public.farm_visits for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.11 incidents ------------------------------------------------------------

-- The incident register is deliberately public: a co-operative that hides its
-- bad news cannot be trusted with its good news.
create policy "The incident register is public"
  on public.incidents for select
  to anon, authenticated
  using (true);

create policy "Operators log incidents"
  on public.incidents for insert
  to authenticated
  with check (private.is_staff(auth.uid()) and logged_by = auth.uid());

create policy "Admins resolve incidents"
  on public.incidents for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins delete an incident"
  on public.incidents for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.12 weather_snapshots ----------------------------------------------------

create policy "Weather records are public"
  on public.weather_snapshots for select
  to anon, authenticated
  using (true);

create policy "Staff record weather"
  on public.weather_snapshots for insert
  to authenticated
  with check (private.is_staff(auth.uid()));

create policy "Admins correct weather records"
  on public.weather_snapshots for update
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role))
  with check (private.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins delete weather records"
  on public.weather_snapshots for delete
  to authenticated
  using (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 5.13 profiles -------------------------------------------------------------
-- Members may maintain their own display name; nobody may promote themselves,
-- because roles live in user_roles and are not writable from the client.

drop policy if exists "Members update their own profile" on public.profiles;
create policy "Members update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
