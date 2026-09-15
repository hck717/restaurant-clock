-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Schema for the restaurant clock-in app

create table if not exists public.employees (
  id text primary key,
  name text not null,
  pin text not null,
  created_at timestamptz default now()
);

create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  date text not null,
  clock_in timestamptz,
  clock_out timestamptz,
  created_at timestamptz default now(),
  unique (employee_id, date)
);

alter table public.employees enable row level security;
alter table public.records enable row level security;

-- Allow the app (anon key) to read employees and records
create policy "Public read employees"
  on public.employees for select
  using (true);

-- Allow the app to insert/update employees (admin adds staff)
create policy "Public insert employees"
  on public.employees for insert
  with check (true);

create policy "Public update employees"
  on public.employees for update
  using (true)
  with check (true);

create policy "Public delete employees"
  on public.employees for delete
  using (true);

-- Allow the app to read all records
create policy "Public read records"
  on public.records for select
  using (true);

-- Allow the app to insert records
create policy "Public insert records"
  on public.records for insert
  with check (true);

-- Allow the app to update records
create policy "Public update records"
  on public.records for update
  using (true)
  with check (true);