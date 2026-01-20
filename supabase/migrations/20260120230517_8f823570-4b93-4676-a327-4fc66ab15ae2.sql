-- Temporary O*NET import support (job tracking)

create table if not exists public.onet_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  current_file text,
  current_phase text,
  files_total int default 0,
  files_done int default 0,
  statements_total int default 0,
  statements_done int default 0,
  tables_created int default 0,
  rows_inserted bigint default 0,
  last_message text,
  log text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onet_import_jobs enable row level security;

create policy "Users can view their own import jobs"
on public.onet_import_jobs
for select
using (auth.uid() = user_id);

create policy "Users can create their own import jobs"
on public.onet_import_jobs
for insert
with check (auth.uid() = user_id);

create policy "Service role manages import jobs"
on public.onet_import_jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');