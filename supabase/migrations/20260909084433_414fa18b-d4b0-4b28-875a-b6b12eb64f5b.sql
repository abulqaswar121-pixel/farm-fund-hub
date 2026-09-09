create type public.app_role as enum ('admin', 'operator', 'contributor');
create type public.payment_method as enum ('paystack', 'manual');
create type public.payment_status as enum ('pending', 'success', 'failed');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
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

alter table public.user_roles enable row level security;
create policy "Users can view their own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Admins can view all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Admins can manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table public.profiles (
  id uuid primary key,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Authenticated users can view profiles" on public.profiles for select to authenticated using (true);
create policy "Admins can manage profiles" on public.profiles for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  category text not null,
  note text,
  payment_method public.payment_method not null,
  paystack_reference text unique,
  payment_status public.payment_status not null default 'pending',
  verified_at timestamptz,
  recorded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contributions to authenticated;
grant all on public.contributions to service_role;
alter table public.contributions enable row level security;
create policy "Authenticated users can view contributions" on public.contributions for select to authenticated using (true);
create policy "Admins can manage contributions" on public.contributions for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  category text not null,
  note text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "Authenticated users can view expenses" on public.expenses for select to authenticated using (true);
create policy "Admins can manage expenses" on public.expenses for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Operators can add expenses" on public.expenses for insert to authenticated with check (public.has_role(auth.uid(), 'operator'::public.app_role) and recorded_by = auth.uid());

create table public.stock_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  count integer not null check (count >= 0),
  note text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.stock_logs to authenticated;
grant all on public.stock_logs to service_role;
alter table public.stock_logs enable row level security;
create policy "Authenticated users can view stock logs" on public.stock_logs for select to authenticated using (true);
create policy "Admins can manage stock logs" on public.stock_logs for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Operators can add stock logs" on public.stock_logs for insert to authenticated with check (public.has_role(auth.uid(), 'operator'::public.app_role) and recorded_by = auth.uid());

create table public.harvest_cycles (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.harvest_cycles to authenticated;
grant all on public.harvest_cycles to service_role;
alter table public.harvest_cycles enable row level security;
create policy "Authenticated users can view harvest cycles" on public.harvest_cycles for select to authenticated using (true);
create policy "Admins can manage harvest cycles" on public.harvest_cycles for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create table public.harvest_payouts (
  id uuid primary key default gen_random_uuid(),
  harvest_cycle_id uuid not null references public.harvest_cycles(id) on delete cascade,
  member_id uuid not null,
  percent numeric(7,4) not null check (percent >= 0 and percent <= 100),
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.harvest_payouts to authenticated;
grant all on public.harvest_payouts to service_role;
alter table public.harvest_payouts enable row level security;
create policy "Authenticated users can view harvest payouts" on public.harvest_payouts for select to authenticated using (true);
create policy "Admins can manage harvest payouts" on public.harvest_payouts for all to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role)) with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger contributions_updated_at before update on public.contributions for each row execute function public.update_updated_at_column();
create trigger expenses_updated_at before update on public.expenses for each row execute function public.update_updated_at_column();
create trigger stock_logs_updated_at before update on public.stock_logs for each row execute function public.update_updated_at_column();
create trigger harvest_cycles_updated_at before update on public.harvest_cycles for each row execute function public.update_updated_at_column();
create trigger harvest_payouts_updated_at before update on public.harvest_payouts for each row execute function public.update_updated_at_column();

create or replace function public.bootstrap_profile(_full_name text default null)
returns public.app_role
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role public.app_role;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(7319462);
  select role into selected_role from public.user_roles where user_id = auth.uid() limit 1;
  if selected_role is not null then return selected_role; end if;
  if exists (select 1 from public.user_roles) then
    selected_role := 'contributor';
  else
    selected_role := 'admin';
  end if;
  insert into public.profiles (id, full_name) values (auth.uid(), nullif(trim(_full_name), '')) on conflict (id) do update set full_name = coalesce(excluded.full_name, public.profiles.full_name);
  insert into public.user_roles (user_id, role) values (auth.uid(), selected_role);
  return selected_role;
end;
$$;
grant execute on function public.bootstrap_profile(text) to authenticated;

create or replace view public.member_equity as
with member_totals as (
  select member_id, coalesce(sum(amount) filter (where payment_status = 'success'), 0)::numeric(14,2) as contributed
  from public.contributions
  group by member_id
), pool_total as (
  select coalesce(sum(amount) filter (where payment_status = 'success'), 0)::numeric(14,2) as total from public.contributions
)
select
  mt.member_id,
  mt.contributed,
  case when pt.total > 0 then round((mt.contributed / pt.total) * 100, 4) else 0 end::numeric(7,4) as equity_percent
from member_totals mt cross join pool_total pt;
grant select on public.member_equity to authenticated;
grant all on public.member_equity to service_role;

revoke all on public.profiles, public.user_roles, public.contributions, public.expenses, public.stock_logs, public.harvest_cycles, public.harvest_payouts, public.member_equity from anon;