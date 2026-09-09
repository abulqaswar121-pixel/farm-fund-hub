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
    on conflict (id) do update set full_name = coalesce(excluded.full_name, public.profiles.full_name);
    return selected_role;
  end if;
  if exists (select 1 from public.user_roles) then selected_role := 'contributor'; else selected_role := 'admin'; end if;
  insert into public.profiles (id, full_name) values (_user_id, nullif(trim(_full_name), '')) on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (_user_id, selected_role);
  return selected_role;
end;
$$;
revoke all on function public.ensure_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_profile(uuid, text) to service_role;