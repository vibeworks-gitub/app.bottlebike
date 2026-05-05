alter table public.integrations
  add column if not exists auto_sync_minutes integer,
  add column if not exists last_synced_at timestamptz;

create index if not exists integrations_provider_idx
  on public.integrations(provider);
