-- AI OFM Supabase Schema
-- Run this once in Supabase → SQL Editor.
-- Replace YOUR_ADMIN_EMAIL@gmail.com below before running.

-- ============================================================
-- TABLES
-- ============================================================

-- Allowlist of who is permitted to sign in.
create table if not exists public.allowed_users (
  email       text primary key,
  invited_at  timestamptz not null default now(),
  invited_by  text,
  is_admin    boolean not null default false
);

-- Single shared row holding the whole app state (projects, accounts, sessions, kanban …).
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
-- ROW-LEVEL SECURITY
-- ============================================================
alter table public.allowed_users enable row level security;
alter table public.app_state     enable row level security;

-- Drop any old policies (re-running this script is safe).
drop policy if exists "allowed_users self read"      on public.allowed_users;
drop policy if exists "allowed_users admin read all" on public.allowed_users;
drop policy if exists "allowed_users admin write"    on public.allowed_users;
drop policy if exists "app_state member read"        on public.app_state;
drop policy if exists "app_state member write"       on public.app_state;
drop policy if exists "app_state member insert"      on public.app_state;

-- A signed-in user can always read their own allowlist row (used to verify access).
create policy "allowed_users self read"
  on public.allowed_users for select to authenticated
  using (auth.jwt() ->> 'email' = email);

-- Admins can see the full list.
create policy "allowed_users admin read all"
  on public.allowed_users for select to authenticated
  using (
    exists (
      select 1 from public.allowed_users au
      where au.email = auth.jwt() ->> 'email' and au.is_admin = true
    )
  );

-- Admins can insert / update / delete (the API also uses service role, but this
-- lets the dashboard work from anywhere).
create policy "allowed_users admin write"
  on public.allowed_users for all to authenticated
  using (
    exists (
      select 1 from public.allowed_users au
      where au.email = auth.jwt() ->> 'email' and au.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.allowed_users au
      where au.email = auth.jwt() ->> 'email' and au.is_admin = true
    )
  );

-- Any allow-listed user can read the shared app_state.
create policy "app_state member read"
  on public.app_state for select to authenticated
  using (
    exists (select 1 from public.allowed_users where email = auth.jwt() ->> 'email')
  );

-- Any allow-listed user can update the shared app_state.
create policy "app_state member write"
  on public.app_state for update to authenticated
  using (
    exists (select 1 from public.allowed_users where email = auth.jwt() ->> 'email')
  )
  with check (
    exists (select 1 from public.allowed_users where email = auth.jwt() ->> 'email')
  );

-- And insert (for the very first row if someone wipes it).
create policy "app_state member insert"
  on public.app_state for insert to authenticated
  with check (
    exists (select 1 from public.allowed_users where email = auth.jwt() ->> 'email')
  );

-- ============================================================
-- REALTIME (so all clients see live updates)
-- ============================================================
alter publication supabase_realtime add table public.app_state;

-- ============================================================
-- SEED ADMIN  ⚠ REPLACE THIS EMAIL ⚠
-- ============================================================
insert into public.allowed_users (email, is_admin, invited_by)
values ('benkaufmann.eu@gmail.com', true, 'system')
on conflict (email) do update set is_admin = true;
