begin;
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

commit;
