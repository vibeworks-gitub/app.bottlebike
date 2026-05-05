create table public.r2o_sync_logs (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  ran_at timestamptz not null default now(),
  mode text not null,           -- 'full' | 'incremental' | 'items' | 'manual'
  trigger text not null,        -- 'cron' | 'manual'
  ok boolean not null default true,
  records integer,              -- Anzahl Datensätze die der Lauf bewegt hat
  duration_ms integer,
  message text,                 -- Klartext-Notiz für die UI
  error text,
  detail jsonb
);

create index r2o_sync_logs_owner_idx on public.r2o_sync_logs(owner_id, ran_at desc);

alter table public.r2o_sync_logs enable row level security;

create policy "r2o_sync_logs_owner_select" on public.r2o_sync_logs
  for select to authenticated using (owner_id = auth.uid());

-- Inserts kommen aus dem Server (admin client) — kein insert-policy nötig
