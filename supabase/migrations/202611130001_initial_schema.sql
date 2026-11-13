-- YT Manager initial schema. Metadata only: never store Google passwords, cookies, OAuth refresh tokens, or browser session data here.
create table if not exists public.yt_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  email text,
  channel_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists yt_accounts_user_created_idx
  on public.yt_accounts (user_id, created_at);

alter table public.yt_accounts enable row level security;

drop policy if exists "Owners can read their YouTube accounts" on public.yt_accounts;
create policy "Owners can read their YouTube accounts"
  on public.yt_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owners can add their YouTube accounts" on public.yt_accounts;
create policy "Owners can add their YouTube accounts"
  on public.yt_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update their YouTube accounts" on public.yt_accounts;
create policy "Owners can update their YouTube accounts"
  on public.yt_accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete their YouTube accounts" on public.yt_accounts;
create policy "Owners can delete their YouTube accounts"
  on public.yt_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase enforces explicit Data API grants for new tables on projects migrated to opt-in exposure.
grant select, insert, update, delete on table public.yt_accounts to authenticated;
revoke all on table public.yt_accounts from anon;
