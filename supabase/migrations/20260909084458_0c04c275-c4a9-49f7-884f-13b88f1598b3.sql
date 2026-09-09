create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
revoke all on function private.has_role(uuid, public.app_role) from public, anon;
grant execute on function private.has_role(uuid, public.app_role) to authenticated;

alter table public.profiles disable row level security;
drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles for all to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role)) with check (private.has_role(auth.uid(), 'admin'::public.app_role));
alter table public.profiles enable row level security;

drop policy if exists "Admins can view all roles" on public.user_roles;
drop policy if exists "Admins can manage roles" on public.user_roles;
create policy "Admins can view all roles" on public.user_roles for select to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins can manage roles" on public.user_roles for all to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role)) with check (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can manage contributions" on public.contributions;
create policy "Admins can manage contributions" on public.contributions for all to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role)) with check (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can manage expenses" on public.expenses;
create policy "Admins can manage expenses" on public.expenses for all to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role)) with check (private.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "Operators can add expenses" on public.expenses;
create policy "Operators can add expenses" on public.expenses for insert to authenticated with check (private.has_role(auth.uid(), 'operator'::public.app_role) and recorded_by = auth.uid());

drop policy if exists "Admins can manage stock logs" on public.stock_logs;
create policy "Admins can manage stock logs" on public.stock_logs for all to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role)) with check (private.has_role(auth.uid(), 'admin'::public.app_role));
drop policy if exists "Operators can add stock logs" on public.stock_logs;
create policy "Operators can add stock logs" on public.stock_logs for insert to authenticated with check (private.has_role(auth.uid(), 'operator'::public.app_role) and recorded_by = auth.uid());

drop policy if exists "Admins can manage harvest cycles" on public.harvest_cycles;
create policy "Admins can manage harvest cycles" on public.harvest_cycles for all to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role)) with check (private.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins can manage harvest payouts" on public.harvest_payouts;
create policy "Admins can manage harvest payouts" on public.harvest_payouts for all to authenticated using (private.has_role(auth.uid(), 'admin'::public.app_role)) with check (private.has_role(auth.uid(), 'admin'::public.app_role));

drop function if exists public.has_role(uuid, public.app_role);
drop function if exists public.bootstrap_profile(text);
alter view public.member_equity set (security_invoker = true);