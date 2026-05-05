alter table public.integrations
  add column if not exists last_full_sync_at timestamptz;

create index if not exists integrations_last_full_sync_idx
  on public.integrations(provider, last_full_sync_at);
