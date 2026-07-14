-- ============================================================
-- Devgri AI — complete database initialization
-- Run this entire script in the Supabase SQL Editor.
-- ============================================================

-- ---------- 1. PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: update own (non-privileged fields)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- 2. WORKSPACES ----------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My workspace',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_user_idx on public.workspaces(user_id);

alter table public.workspaces enable row level security;

-- ---------- 3. WRITE-PERMISSION FUNCTION ----------
-- A user may WRITE only if premium OR within the 3-day trial window.
-- Reads are always allowed on their own rows (read-only after trial).
create or replace function public.can_write(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_premium or (now() - p.created_at) < interval '3 days'
       from public.profiles p
      where p.id = uid),
    false
  );
$$;

create policy "workspaces: read own"
  on public.workspaces for select
  using (auth.uid() = user_id);

create policy "workspaces: insert if trial active or premium"
  on public.workspaces for insert
  with check (auth.uid() = user_id and public.can_write(auth.uid()));

create policy "workspaces: update if trial active or premium"
  on public.workspaces for update
  using (auth.uid() = user_id and public.can_write(auth.uid()))
  with check (auth.uid() = user_id and public.can_write(auth.uid()));

create policy "workspaces: delete own"
  on public.workspaces for delete
  using (auth.uid() = user_id);

-- ---------- 4. GLOBAL TRIAL CAP (10,000 users) ----------
create or replace function public.trial_counter()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 10000 - count(*))::integer from public.profiles;
$$;

grant execute on function public.trial_counter() to anon, authenticated;

create or replace function public.enforce_trial_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.profiles) >= 10000 then
    raise exception 'TRIAL_CAP_REACHED: all 10,000 early-access slots are taken.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_trial_cap on public.profiles;
create trigger trg_enforce_trial_cap
  before insert on public.profiles
  for each row execute function public.enforce_trial_cap();

-- ---------- 5. AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 6. UPDATED_AT MAINTENANCE ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_workspaces_touch on public.workspaces;
create trigger trg_workspaces_touch
  before update on public.workspaces
  for each row execute function public.touch_updated_at();
