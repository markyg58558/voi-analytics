-- Client table cleanup + client type support
-- Keeps existing status field (active/vip/do_not_book/archived)
-- Adds separate client_type (new/rebooked/lapsed)
-- Removes preferred_name

alter table public.clients
  add column if not exists client_type text;

-- Backfill existing rows
update public.clients
set client_type = coalesce(nullif(client_type, ''), 'new')
where client_type is null or client_type = '';

alter table public.clients
  alter column client_type set default 'new';

-- Keep source nullable but indexed; UI provides dropdown values
create index if not exists idx_clients_studio_client_type
  on public.clients (studio_id, client_type);

-- Recreate client_type check safely
alter table public.clients drop constraint if exists clients_client_type_check;
alter table public.clients
  add constraint clients_client_type_check
  check (client_type in ('new', 'rebooked', 'lapsed'));

-- Ensure status check remains the operational status set
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients
  add constraint clients_status_check
  check (status in ('active', 'vip', 'do_not_book', 'archived'));

-- Remove preferred_name now that app no longer uses it
alter table public.clients
  drop column if exists preferred_name;
