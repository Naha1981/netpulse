-- NetPulse AI — Phase 1 schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- Multi-tenant: every operational table is scoped by organization_id and protected by RLS,
-- so one ISP can never see another ISP's data even though they share the same tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations (one per signed-up ISP) and membership
-- ---------------------------------------------------------------------------

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  isp_type text not null check (isp_type in ('fibre', 'wireless', 'mixed', 'enterprise')),
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'professional', 'enterprise')),
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Helper: does the current auth user belong to a given org?
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Uploads — raw spreadsheet files dropped into the AI Migration Wizard
-- ---------------------------------------------------------------------------

create table if not exists uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  detected_entity_type text, -- 'customers' | 'ip_addresses' | 'equipment' | 'technicians' | 'billing' | 'unknown'
  status text not null default 'uploaded' check (status in ('uploaded', 'analyzed', 'imported', 'failed')),
  row_count integer,
  mapping_proposal jsonb, -- AI-proposed field mapping, stored for auditability
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Core operational data (Phase 1 scope: customers + IP addresses + equipment)
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  physical_address text,
  gps_lat numeric,
  gps_lng numeric,
  service_plan text,
  status text not null default 'active' check (status in ('active', 'suspended', 'cancelled')),
  source_upload_id uuid references uploads(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists ip_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  ip_address text not null,
  subnet text,
  customer_id uuid references customers(id) on delete set null,
  device_serial text,
  is_reserved boolean not null default false,
  source_upload_id uuid references uploads(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  device_type text, -- router, ONT, radio, switch, tower, etc.
  serial_number text,
  brand text,
  customer_id uuid references customers(id) on delete set null,
  warranty_expiry date,
  is_active boolean not null default true,
  source_upload_id uuid references uploads(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI Health Reports — one generated per import batch
-- ---------------------------------------------------------------------------

create table if not exists health_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  upload_id uuid references uploads(id) on delete set null,
  summary text not null,
  findings jsonb not null, -- structured list: {type, count, description, severity}
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Copilot query log (for auditability + future fine-tuning of prompts)
-- ---------------------------------------------------------------------------

create table if not exists copilot_queries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  question text not null,
  intent text,
  answer text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table uploads enable row level security;
alter table customers enable row level security;
alter table ip_addresses enable row level security;
alter table equipment enable row level security;
alter table health_reports enable row level security;
alter table copilot_queries enable row level security;

create policy "members can read their org" on organizations
  for select using (is_org_member(id));

create policy "any authenticated user can create an org" on organizations
  for insert with check (auth.uid() is not null);

create policy "members can read their membership rows" on organization_members
  for select using (user_id = auth.uid());

create policy "members can insert their own membership on signup" on organization_members
  for insert with check (user_id = auth.uid());

-- Generic per-table policy pattern: members can select/insert/update/delete
-- rows in their own organization only.
create policy "org read uploads" on uploads for select using (is_org_member(organization_id));
create policy "org write uploads" on uploads for insert with check (is_org_member(organization_id));
create policy "org update uploads" on uploads for update using (is_org_member(organization_id));

create policy "org read customers" on customers for select using (is_org_member(organization_id));
create policy "org write customers" on customers for insert with check (is_org_member(organization_id));
create policy "org update customers" on customers for update using (is_org_member(organization_id));
create policy "org delete customers" on customers for delete using (is_org_member(organization_id));

create policy "org read ip_addresses" on ip_addresses for select using (is_org_member(organization_id));
create policy "org write ip_addresses" on ip_addresses for insert with check (is_org_member(organization_id));
create policy "org update ip_addresses" on ip_addresses for update using (is_org_member(organization_id));
create policy "org delete ip_addresses" on ip_addresses for delete using (is_org_member(organization_id));

create policy "org read equipment" on equipment for select using (is_org_member(organization_id));
create policy "org write equipment" on equipment for insert with check (is_org_member(organization_id));
create policy "org update equipment" on equipment for update using (is_org_member(organization_id));
create policy "org delete equipment" on equipment for delete using (is_org_member(organization_id));

create policy "org read health_reports" on health_reports for select using (is_org_member(organization_id));
create policy "org write health_reports" on health_reports for insert with check (is_org_member(organization_id));

create policy "org read copilot_queries" on copilot_queries for select using (is_org_member(organization_id));
create policy "org write copilot_queries" on copilot_queries for insert with check (is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Indexes for the checks the AI Migration Wizard and Health Report run most
-- ---------------------------------------------------------------------------

create index if not exists idx_ip_addresses_org_ip on ip_addresses (organization_id, ip_address);
create index if not exists idx_customers_org on customers (organization_id);
create index if not exists idx_equipment_org on equipment (organization_id);
create index if not exists idx_equipment_warranty on equipment (organization_id, warranty_expiry);

-- ---------------------------------------------------------------------------
-- Storage bucket for uploaded spreadsheets
-- ---------------------------------------------------------------------------
-- Files are stored at path `{organization_id}/{uuid}-{filename}` — the RLS
-- policies below check the first path segment against organization
-- membership, so one ISP can never read or overwrite another's uploads.

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "org members can read their upload files"
  on storage.objects for select
  using (
    bucket_id = 'uploads'
    and is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "org members can write their upload files"
  on storage.objects for insert
  with check (
    bucket_id = 'uploads'
    and is_org_member(((storage.foldername(name))[1])::uuid)
  );
