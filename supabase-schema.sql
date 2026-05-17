-- AI OFM Supabase Schema
-- Run this once in Supabase → SQL Editor.
-- Replace YOUR_ADMIN_EMAIL@gmail.com below before running.

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.allowed_users (
  email       text primary key,
  invited_at  timestamptz not null default now(),
  invited_by  text,
  is_admin    boolean not null default false
);

create table if not exists public.app_state (
  id          text primary key default 'singleton',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint  app_state_singleton check (id = 'singleton')
);

insert into public.app_state (id, data) values ('singleton', '{}'::jsonb)
on conflict (id) do nothing;

-- ============================================================
-- SECURITY-DEFINER HELPERS (avoid RLS recursion)
-- These run as the DB owner, bypassing RLS on the internal query.
-- ============================================================

create or replace function public.is_allowed_user() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users where email = auth.jwt() ->> 'email'
  )
$$;

create or replace function public.is_admin_user() returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select coalesce(
    (select is_admin from public.allowed_users where email = auth.jwt() ->> 'email' limit 1),
    false
  )
$$;

grant execute on function public.is_allowed_user() to authenticated;
grant execute on function public.is_admin_user()   to authenticated;

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
alter table public.allowed_users enable row level security;
alter table public.app_state     enable row level security;

drop policy if exists "allowed_users self read"      on public.allowed_users;
drop policy if exists "allowed_users admin read all" on public.allowed_users;
drop policy if exists "allowed_users admin write"    on public.allowed_users;
drop policy if exists "app_state member read"        on public.app_state;
drop policy if exists "app_state member write"       on public.app_state;
drop policy if exists "app_state member insert"      on public.app_state;

-- A signed-in user can always read their own allowlist row.
create policy "allowed_users self read"
  on public.allowed_users for select to authenticated
  using (auth.jwt() ->> 'email' = email);

-- Admins can see the full list (uses helper to avoid RLS recursion).
create policy "allowed_users admin read all"
  on public.allowed_users for select to authenticated
  using (public.is_admin_user());

-- Admins can insert / update / delete (helper avoids recursion).
create policy "allowed_users admin write"
  on public.allowed_users for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Any allow-listed user can read the shared app_state.
create policy "app_state member read"
  on public.app_state for select to authenticated
  using (public.is_allowed_user());

-- And update.
create policy "app_state member write"
  on public.app_state for update to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());

-- And insert (for the first row if someone wipes it).
create policy "app_state member insert"
  on public.app_state for insert to authenticated
  with check (public.is_allowed_user());

-- ============================================================
-- REALTIME
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table public.app_state;
  end if;
end $$;

-- ============================================================
-- SEED ADMIN  ⚠ REPLACE THIS EMAIL ⚠
-- ============================================================
insert into public.allowed_users (email, is_admin, invited_by)
values ('benkaufmann.eu@gmail.com', true, 'system')
on conflict (email) do update set is_admin = true;
