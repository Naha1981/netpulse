-- Apply only to an existing Phase 1 database after backup/review. No live run performed.
begin;
drop policy if exists "members can insert their own membership on signup" on public.organization_members;
drop policy if exists "any authenticated user can create an org" on public.organizations;
alter function public.is_org_member(uuid) set search_path = public, pg_temp;
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

commit;
