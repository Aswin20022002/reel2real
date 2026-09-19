-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
create table if not exists public.trips (
  id text primary key,                 -- the 6-character trip code
  data jsonb not null,                 -- whole trip document (itinerary, members, expenses, settlements, bookings)
  updated_at timestamptz not null default now()
);

create table if not exists public.reels (
  id text primary key,
  owner text not null,                 -- anonymous device id (replace with the MMT user id in production)
  data jsonb not null,
  saved_at timestamptz not null default now()
);
create index if not exists reels_owner_idx on public.reels (owner);

alter table public.trips enable row level security;
alter table public.reels enable row level security;

-- PROTOTYPE POLICIES: anyone holding the anon key can read/write. Trip codes are unguessable enough for a demo,
-- but for production replace these with auth-based policies (auth.uid() must be a trip member).
drop policy if exists "trips read"   on public.trips;
drop policy if exists "trips insert" on public.trips;
drop policy if exists "trips update" on public.trips;
create policy "trips read"   on public.trips for select using (true);
create policy "trips insert" on public.trips for insert with check (true);
create policy "trips update" on public.trips for update using (true);

drop policy if exists "reels read"   on public.reels;
drop policy if exists "reels insert" on public.reels;
drop policy if exists "reels update" on public.reels;
drop policy if exists "reels delete" on public.reels;
create policy "reels read"   on public.reels for select using (true);
create policy "reels insert" on public.reels for insert with check (true);
create policy "reels update" on public.reels for update using (true);
create policy "reels delete" on public.reels for delete using (true);

-- Realtime: lets every traveller's screen update the moment someone edits the plan or adds an expense.
alter publication supabase_realtime add table public.trips;
