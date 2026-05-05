-- Integrations: per-user OAuth-like tokens for external providers
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('ready2order')),
  account_token text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index integrations_user_idx on public.integrations(user_id);

create trigger integrations_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;

create policy "integrations_owner_select" on public.integrations
  for select to authenticated using (user_id = auth.uid());

create policy "integrations_owner_modify" on public.integrations
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
