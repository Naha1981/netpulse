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
set search_path = public, pg_temp
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

-- Organizations are created through create_organization, not direct client inserts.

create policy "members can read their membership rows" on organization_members
  for select using (user_id = auth.uid());

-- Memberships are created only by the narrow atomic onboarding function below.
-- A logged-in user must never be allowed to self-enrol in an arbitrary ISP.

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

-- Atomic onboarding: no INSERT RETURNING before the owner membership exists.
create or replace function public.create_organization(p_name text, p_isp_type text)
returns public.organizations
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result public.organizations; caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Not signed in'; end if;
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 200 then
    raise exception 'Organization name must contain 1-200 characters';
  end if;
  if p_isp_type is null or p_isp_type not in ('fibre','wireless','mixed','enterprise') then
    raise exception 'Invalid ISP type';
  end if;
  insert into public.organizations(name,isp_type) values(trim(p_name),p_isp_type) returning * into result;
  insert into public.organization_members(organization_id,user_id,role) values(result.id,caller,'owner');
  return result;
end;
$$;
revoke all on function public.create_organization(text,text) from public;
grant execute on function public.create_organization(text,text) to authenticated;

-- Foreign keys must preserve the tenant boundary, not merely reference any ID.
alter table customers add constraint customers_org_id_unique unique (organization_id,id);
alter table uploads add constraint uploads_org_id_unique unique (organization_id,id);
alter table ip_addresses add constraint ip_customer_same_org foreign key (organization_id,customer_id) references customers(organization_id,id);
alter table equipment add constraint equipment_customer_same_org foreign key (organization_id,customer_id) references customers(organization_id,id);
alter table customers add constraint customers_upload_same_org foreign key (organization_id,source_upload_id) references uploads(organization_id,id);
alter table ip_addresses add constraint ip_upload_same_org foreign key (organization_id,source_upload_id) references uploads(organization_id,id);
alter table equipment add constraint equipment_upload_same_org foreign key (organization_id,source_upload_id) references uploads(organization_id,id);
alter table health_reports add constraint report_upload_same_org foreign key (organization_id,upload_id) references uploads(organization_id,id);
-- Retry-safe, transactional import. Locking serializes concurrent retries.
alter table public.uploads add column if not exists file_sha256 text;
create unique index if not exists uploads_org_file_hash on public.uploads(organization_id,file_sha256) where file_sha256 is not null;
create unique index if not exists health_reports_one_per_upload on public.health_reports(upload_id) where upload_id is not null;

create or replace function public.commit_import(p_upload_id uuid,p_entity text,p_rows jsonb,p_summary text,p_findings jsonb)
returns public.health_reports
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare u public.uploads; result public.health_reports; allowed text[]; required text;
begin
 select * into u from public.uploads where id=p_upload_id for update;
 if not found then raise exception 'Upload not found'; end if;
 if u.status='imported' then
  select * into result from public.health_reports where upload_id=u.id;
  if not found then raise exception 'Imported upload is missing its report'; end if;
  return result;
 end if;
 if u.status <> 'analyzed' then raise exception 'Upload is not ready for import'; end if;
 if p_entity is null or p_entity not in ('customers','ip_addresses','equipment') then raise exception 'Unsupported entity'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 20000 then raise exception 'Invalid import rows'; end if;
 if p_entity='customers' then allowed:=array['full_name','email','phone','physical_address','gps_lat','gps_lng','service_plan','status']; required:='full_name';
 elsif p_entity='ip_addresses' then allowed:=array['ip_address','subnet','device_serial','is_reserved']; required:='ip_address';
 else allowed:=array['device_type','serial_number','brand','warranty_expiry','is_active']; required:='serial_number'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r)<>'object' or coalesce(trim(r->>required),'')='') then raise exception 'Missing required row value'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r, jsonb_object_keys(r) k where not k=any(allowed)) then raise exception 'Unsupported destination field'; end if;
 if p_entity='customers' then
  insert into public.customers(organization_id,source_upload_id,full_name,email,phone,physical_address,gps_lat,gps_lng,service_plan,status)
  select u.organization_id,u.id,r.full_name,r.email,r.phone,r.physical_address,r.gps_lat,r.gps_lng,r.service_plan,coalesce(r.status,'active')
  from jsonb_to_recordset(p_rows) as r(full_name text,email text,phone text,physical_address text,gps_lat numeric,gps_lng numeric,service_plan text,status text);
 elsif p_entity='ip_addresses' then
  if exists(select 1 from jsonb_array_elements(p_rows) r where not (r->>'ip_address') ~ '^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$') then raise exception 'Invalid IPv4 address'; end if;
  insert into public.ip_addresses(organization_id,source_upload_id,ip_address,subnet,device_serial,is_reserved)
  select u.organization_id,u.id,r.ip_address,r.subnet,r.device_serial,coalesce(r.is_reserved,false)
  from jsonb_to_recordset(p_rows) as r(ip_address text,subnet text,device_serial text,is_reserved boolean);
 else
  insert into public.equipment(organization_id,source_upload_id,device_type,serial_number,brand,warranty_expiry,is_active)
  select u.organization_id,u.id,r.device_type,r.serial_number,r.brand,r.warranty_expiry,coalesce(r.is_active,true)
  from jsonb_to_recordset(p_rows) as r(device_type text,serial_number text,brand text,warranty_expiry date,is_active boolean);
 end if;
 insert into public.health_reports(organization_id,upload_id,summary,findings) values(u.organization_id,u.id,p_summary,p_findings) returning * into result;
 update public.uploads set status='imported',detected_entity_type=p_entity where id=u.id;
 return result;
end;
$$;
revoke all on function public.commit_import(uuid,text,jsonb,text,jsonb) from public;
grant execute on function public.commit_import(uuid,text,jsonb,text,jsonb) to authenticated;
