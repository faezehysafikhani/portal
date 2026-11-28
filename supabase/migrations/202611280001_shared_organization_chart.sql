create function public.organization_key(value text) returns text language sql immutable set search_path=public as $$
  select lower(regexp_replace(translate(trim(coalesce(value,'')),'يىك','ییک'),'[[:space:]‌]+','','g'));
$$;

create function public.organization_people(p_tenant uuid)
returns table(id uuid,full_name text,department text,"position" text,active boolean,manager_id uuid,unresolved boolean)
language sql stable set search_path=public as $$
  with people as materialized (
    select u."Id" id,u."Department" department,u."Position" as "position",u."IsActive" active,
      coalesce(nullif(trim(concat_ws(' ',u."FirstName",u."LastName")),''),u."Username") full_name,
      organization_key(u."Username") username_key, organization_key(concat_ws(' ',u."FirstName",u."LastName")) name_key,
      organization_key(u."DirectManager") manager_ref
    from "Users" u where u."TenantId"=p_tenant and not u."IsDeleted"
  ), aliases as (
    select id,id::text as key,1 as priority from people
    union all select id,username_key,case when active then 2 else 4 end from people where username_key<>''
    union all select id,name_key,case when active then 3 else 5 end from people where name_key<>''
  ), targets as (
    select distinct on (key) key,case when count(*)=1 then (array_agg(id))[1] end as id
    from aliases group by key,priority order by key,priority
  )
  select p.id,p.full_name,p.department,p."position",p.active,case when t.id<>p.id then t.id end,
    p.manager_ref<>'' and (t.id is null or t.id=p.id)
  from people p left join targets t on t.key=p.manager_ref;
$$;

create or replace function public.performance_direct_reports(p_tenant uuid,p_actor uuid)
returns table(id uuid,name text,"position" text) language sql stable set search_path=public as $$
  with people as materialized (select * from organization_people(p_tenant))
  select p.id,p.full_name,p."position" from people p
  where p.manager_id=p_actor and p.active and exists(select 1 from people m where m.id=p_actor and m.active);
$$;

create table public.organization_departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  parent_id uuid references public.organization_departments(id),
  lead_id uuid references public."Users"("Id"),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create unique index organization_department_name on public.organization_departments(tenant_id,organization_key(name));
alter table public."OrgPositions" add column "IsActive" boolean not null default true;
create table public.organization_change_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entity_id uuid not null,
  entity_kind text not null check(entity_kind in ('employee','department','position')),
  actor_id uuid,
  before_data jsonb,
  after_data jsonb not null,
  changed_at timestamptz not null default now()
);
create index organization_history_entity on public.organization_change_history(tenant_id,entity_id,changed_at desc);
alter table public.organization_departments enable row level security;
alter table public.organization_change_history enable row level security;
revoke all on public.organization_departments,public.organization_change_history from public,anon,authenticated;
grant all on public.organization_departments,public.organization_change_history to service_role;
insert into public.organization_departments(tenant_id,name)
select distinct on (u."TenantId",organization_key(u."Department")) u."TenantId",trim(u."Department")
from public."Users" u where not u."IsDeleted" and organization_key(u."Department")<>''
order by u."TenantId",organization_key(u."Department"),u."Department";

create function public.organization_user_guard() returns trigger language plpgsql set search_path=public as $$
declare
  old_manager uuid;
  manager uuid;
  leads_to_self boolean;
  before_data jsonb;
  after_data jsonb;
  actor uuid := nullif(current_setting('portal.organization_actor',true),'')::uuid;
begin
  if new."IsDeleted" then return new; end if;
  if tg_op='INSERT' then actor:=coalesce(actor,new."CreatedByUserId"); end if;
  if tg_op='INSERT' or new."Department" is distinct from old."Department" or new."Position" is distinct from old."Position"
    or new."DirectManager" is distinct from old."DirectManager" or new."IsActive" is distinct from old."IsActive" then
    perform pg_advisory_xact_lock(hashtextextended(new."TenantId"::text,2891));
  end if;
  if (tg_op='INSERT' or new."Department" is distinct from old."Department")
    and exists(select 1 from organization_departments d where d.tenant_id=new."TenantId" and organization_key(d.name)=organization_key(new."Department") and not d.active)
    then raise exception 'org_inactive'; end if;
  if (tg_op='INSERT' or new."Position" is distinct from old."Position")
    and exists(select 1 from "OrgPositions" p where p."TenantId"=new."TenantId" and organization_key(p."Title")=organization_key(new."Position") and not p."IsDeleted" and not p."IsActive")
    then raise exception 'org_inactive'; end if;
  if tg_op='INSERT' or new."DirectManager" is distinct from old."DirectManager" then
    if organization_key(new."DirectManager")<>'' then
      if tg_op='UPDATE' then select p.manager_id into old_manager from organization_people(new."TenantId") p where p.id=new."Id"; end if;
      select u."Id" into manager from "Users" u where u."TenantId"=new."TenantId" and not u."IsDeleted" and
        (u."IsActive" or u."Id"=old_manager) and u."Id"::text=lower(trim(new."DirectManager"));
      if manager is null and lower(trim(new."DirectManager")) !~ '^[0-9a-f-]{36}$' then
        with candidates as (
          select u."Id",case when organization_key(u."Username")=organization_key(new."DirectManager") then 1 else 2 end as priority
          from "Users" u where u."TenantId"=new."TenantId" and not u."IsDeleted" and u."IsActive"
            and organization_key(new."DirectManager") in (organization_key(u."Username"),organization_key(concat_ws(' ',u."FirstName",u."LastName")))
        )
        select case when count(*)=1 then (array_agg("Id"))[1] end into manager
        from candidates where priority=(select min(priority) from candidates);
      end if;
      if manager is null then raise exception 'org_manager_invalid'; end if;
      with recursive people as materialized (select * from organization_people(new."TenantId")),
      chain(id) as (
        select manager union select p.manager_id from people p join chain c on p.id=c.id where p.manager_id is not null
      )
      select exists(select 1 from chain where id=new."Id") into leads_to_self;
      if leads_to_self then raise exception 'org_cycle'; end if;
      new."DirectManager":=manager::text;
    else
      new."DirectManager":=null;
    end if;
  end if;
  if tg_op='UPDATE' then
    before_data:=jsonb_build_object('manager',old."DirectManager",'department',old."Department",'position',old."Position",'active',old."IsActive");
  end if;
  after_data:=jsonb_build_object('manager',new."DirectManager",'department',new."Department",'position',new."Position",'active',new."IsActive");
  if before_data is distinct from after_data then
    insert into organization_change_history(tenant_id,entity_id,entity_kind,actor_id,before_data,after_data)
    values(new."TenantId",new."Id",'employee',actor,before_data,after_data);
  end if;
  if tg_op='UPDATE' and manager is not null and manager is distinct from old_manager and new."IsActive" then
    insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityType","ActorUserId","CreatedAt","IsDeleted")
    select gen_random_uuid(),new."TenantId",manager,n.title,coalesce(nullif(trim(concat_ws(' ',new."FirstName",new."LastName")),''),new."Username"),
      9,false,n.path,'OrganizationTransfer',actor,now(),false
    from (values
      ('گزارش‌های در انتظار بررسی زیرمجموعه جدید','/performance/review',exists(
        select 1 from performance_daily_reports r where r.tenant_id=new."TenantId" and r.employee_id=new."Id" and r.status='submitted')),
      ('وظایف در انتظار بررسی زیرمجموعه جدید','/performance/assignments',exists(
        select 1 from "Tasks" t where t."TenantId"=new."TenantId" and t."AssignedToUserId"=new."Id" and not t."IsDeleted" and
        (t."AssignmentState"='review' or t."AssignmentExtension" is not null)))
    ) n(title,path,pending) where n.pending;
  end if;
  return new;
end;
$$;

create function public.organization_save_position(p_tenant uuid,p_actor uuid,p_id uuid,p_patch jsonb,p_delete boolean)
returns public."OrgPositions" language plpgsql set search_path=public as $$
declare
  previous "OrgPositions"%rowtype;
  result "OrgPositions"%rowtype;
  title text;
  parent text;
  active boolean;
  cycle boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text,2891));
  perform set_config('portal.organization_actor',p_actor::text,true);
  if p_id is not null then
    select * into previous from "OrgPositions" p where p."TenantId"=p_tenant and p."Id"=p_id and not p."IsDeleted" for update;
    if not found then raise exception 'org_missing'; end if;
    if previous."IsSystem" then raise exception 'org_system_position'; end if;
  end if;
  title:=trim(coalesce(p_patch->>'Title',previous."Title",''));
  if organization_key(title)='' or length(title)>160 then raise exception 'org_name'; end if;
  if title is distinct from previous."Title" and exists(select 1 from "OrgPositions" p where p."TenantId"=p_tenant and not p."IsDeleted"
    and p."Id" is distinct from p_id and organization_key(p."Title")=organization_key(title)) then raise exception 'org_duplicate'; end if;
  parent:=case when p_patch?'ParentId' then nullif(p_patch->>'ParentId','') else previous."ParentId" end;
  if parent='admin-root' and parent is distinct from previous."ParentId" then parent:=null; end if;
  if parent is not null and parent is distinct from previous."ParentId" then
    if not exists(select 1 from "OrgPositions" p where p."TenantId"=p_tenant and p."Id"::text=parent and not p."IsDeleted" and p."IsActive")
      then raise exception 'org_parent'; end if;
    with recursive chain(id) as (
      select parent union select p."ParentId" from "OrgPositions" p join chain c on p."Id"::text=c.id
      where p."TenantId"=p_tenant and not p."IsDeleted" and p."ParentId" is not null
    ) select exists(select 1 from chain where id=p_id::text) into cycle;
    if cycle then raise exception 'org_cycle'; end if;
  end if;
  active:=coalesce((p_patch->>'IsActive')::boolean,previous."IsActive",true) and not p_delete;
  if (p_delete or not active) and p_id is not null and (
    exists(select 1 from "Users" u where u."TenantId"=p_tenant and not u."IsDeleted" and (p_delete or u."IsActive")
      and organization_key(u."Position")=organization_key(previous."Title"))
    or exists(select 1 from "OrgPositions" p where p."TenantId"=p_tenant and p."ParentId"=p_id::text and not p."IsDeleted" and (p_delete or p."IsActive"))
  ) then raise exception 'org_dependencies'; end if;
  if p_id is null then
    insert into "OrgPositions"("Id","TenantId","Title","ParentId","Color","OrgId","IsSystem","IsActive","IsDeleted","CreatedAt","CreatedByUserId")
    values(gen_random_uuid(),p_tenant,title,parent,coalesce(p_patch->>'Color','#8B1A6B'),coalesce(p_patch->>'OrgId','1'),false,active,false,now(),p_actor)
    returning * into result;
  else
    update "OrgPositions" set "Title"=title,"ParentId"=parent,"Color"=coalesce(p_patch->>'Color',previous."Color"),
      "IsActive"=active,"IsDeleted"=p_delete,"DeletedAt"=case when p_delete then now() else null end,"UpdatedAt"=now()
    where "Id"=p_id returning * into result;
    if title is distinct from previous."Title" and not exists(select 1 from "OrgPositions" p where p."TenantId"=p_tenant and p."Id"<>p_id
      and not p."IsDeleted" and organization_key(p."Title")=organization_key(previous."Title")) then
      update "Users" set "Position"=title,"UpdatedAt"=now()
      where "TenantId"=p_tenant and not "IsDeleted" and organization_key("Position")=organization_key(previous."Title");
    end if;
  end if;
  insert into organization_change_history(tenant_id,entity_id,entity_kind,actor_id,before_data,after_data)
  values(p_tenant,result."Id",'position',p_actor,case when p_id is not null then to_jsonb(previous) end,to_jsonb(result));
  return result;
end;
$$;
-- Canonicalize existing unambiguous edges without changing anyone's manager.
update public."Users" u set "DirectManager"=o.manager_id::text
from (select p.id,p.manager_id from public."Tenants" t cross join lateral public.organization_people(t."Id") p) o
where u."Id"=o.id and o.manager_id is not null and u."DirectManager" is distinct from o.manager_id::text;
create trigger organization_user_guard before insert or update of "DirectManager","Department","Position","IsActive"
on public."Users" for each row execute function public.organization_user_guard();

create function public.organization_update_user(p_tenant uuid,p_actor uuid,p_user uuid,p_patch jsonb)
returns setof public."Users" language plpgsql set search_path=public as $$
declare
  u "Users"%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text,2891));
  perform set_config('portal.organization_actor',p_actor::text,true);
  select * into u from "Users" where "TenantId"=p_tenant and "Id"=p_user and not "IsDeleted" for update;
  if not found then return; end if;
  u:=jsonb_populate_record(u,p_patch);
  return query update "Users" as target set "Email"=u."Email","FirstName"=u."FirstName","LastName"=u."LastName","PhoneNumber"=u."PhoneNumber",
    "BirthDate"=u."BirthDate","Department"=u."Department","Position"=u."Position","DirectManager"=u."DirectManager","HrManager"=u."HrManager",
    "SignatureDataUrl"=u."SignatureDataUrl","SignatureText"=u."SignatureText","IsActive"=u."IsActive","UpdatedAt"=now()
    where target."Id"=p_user returning target.*;
end;
$$;

create function public.organization_save_department(p_tenant uuid,p_actor uuid,p_id uuid,p_name text,p_parent uuid,p_lead uuid,p_active boolean)
returns public.organization_departments language plpgsql set search_path=public as $$
declare
  previous organization_departments%rowtype;
  result organization_departments%rowtype;
  cycle boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text,2891));
  perform set_config('portal.organization_actor',p_actor::text,true);
  if p_id is not null then
    select * into previous from organization_departments where id=p_id and tenant_id=p_tenant for update;
    if not found then raise exception 'org_missing'; end if;
  end if;
  if p_parent is not null and not exists(select 1 from organization_departments d where d.tenant_id=p_tenant and d.id=p_parent and (d.active or d.id=previous.parent_id))
    then raise exception 'org_parent'; end if;
  if p_lead is not null and not exists(select 1 from "Users" u where u."TenantId"=p_tenant and u."Id"=p_lead and not u."IsDeleted" and (u."IsActive" or u."Id"=previous.lead_id))
    then raise exception 'org_manager_invalid'; end if;
  if p_parent is not null and p_id is not null then
    with recursive chain(id) as (
      select p_parent union select d.parent_id from organization_departments d join chain c on c.id=d.id
      where d.tenant_id=p_tenant and d.parent_id is not null
    )
    select exists(select 1 from chain where id=p_id) into cycle;
    if cycle then raise exception 'org_cycle'; end if;
  end if;
  if not p_active and previous.active and (
    exists(select 1 from "Users" u where u."TenantId"=p_tenant and not u."IsDeleted" and u."IsActive" and organization_key(u."Department")=organization_key(previous.name))
    or exists(select 1 from organization_departments d where d.parent_id=p_id and d.active)
  ) then raise exception 'org_dependencies'; end if;
  if p_id is null then
    insert into organization_departments(tenant_id,name,parent_id,lead_id,active) values(p_tenant,p_name,p_parent,p_lead,p_active) returning * into result;
  else
    update organization_departments set name=p_name,parent_id=p_parent,lead_id=p_lead,active=p_active,updated_at=now() where id=p_id returning * into result;
    if previous.name is distinct from result.name then
      update "Users" set "Department"=result.name,"UpdatedAt"=now()
      where "TenantId"=p_tenant and not "IsDeleted" and organization_key("Department")=organization_key(previous.name);
    end if;
  end if;
  insert into organization_change_history(tenant_id,entity_id,entity_kind,actor_id,before_data,after_data)
  values(p_tenant,result.id,'department',p_actor,case when p_id is not null then to_jsonb(previous) end,to_jsonb(result));
  return result;
end;
$$;

revoke all on function public.organization_people(uuid),public.organization_user_guard(),public.organization_save_position(uuid,uuid,uuid,jsonb,boolean),
  public.organization_update_user(uuid,uuid,uuid,jsonb),public.organization_save_department(uuid,uuid,uuid,text,uuid,uuid,boolean)
from public,anon,authenticated;
grant execute on function public.organization_people(uuid),public.organization_update_user(uuid,uuid,uuid,jsonb),public.organization_save_position(uuid,uuid,uuid,jsonb,boolean),
  public.organization_save_department(uuid,uuid,uuid,text,uuid,uuid,boolean) to service_role;

-- The current reporting line owns pending decisions while the original assigner stays in the record.
create or replace function public.performance_task_mutate(
  p_tenant uuid, p_actor uuid, p_admin boolean, p_task uuid, p_action text, p_data jsonb
) returns uuid language plpgsql set search_path=public as $$
declare
  t "Tasks"%rowtype;
  previous jsonb;
  details jsonb;
  event_id uuid := gen_random_uuid();
  target uuid;
  project uuid;
  starts timestamptz;
  due timestamptz;
  note text := nullif(trim(p_data->>'note'),'');
  progress integer;
  next_state text;
  recipient uuid;
  notice text;
  route text;
begin
  perform set_config('portal.performance_task_write','on',true);
  if p_action='create' then
    perform pg_advisory_xact_lock(hashtextextended(p_task::text,0));
  end if;
  select * into t from "Tasks" where "Id"=p_task and "TenantId"=p_tenant and not "IsDeleted" for update;
  if p_action='create' then
    target := (p_data->>'employeeId')::uuid;
    if target is null or target=p_actor or not exists(select 1 from "Users" where "Id"=target and "TenantId"=p_tenant and "IsActive" and not "IsDeleted")
      or (not p_admin and not exists(select 1 from performance_direct_reports(p_tenant,p_actor) as team where team.id=target))
      then raise exception 'assignment_scope'; end if;
    if t."Id" is not null then
      if t."AssignedByUserId"=p_actor and t."AssignedToUserId"=target and t."AssignmentState" is not null then return p_task; end if;
      raise exception 'assignment_scope';
    end if;
  else
    if t."AssignmentState" is null then raise exception 'assignment_not_found'; end if;
    target := t."AssignedToUserId";
    if p_action in ('seen','start','progress','block','submit','extend') then
      if target<>p_actor then raise exception 'assignment_not_found'; end if;
    elsif not p_admin and not (exists(select 1 from performance_direct_reports(p_tenant,p_actor) as team where team.id=target))
      then raise exception 'assignment_not_found';
    end if;
    if p_action='seen' then
      update "Tasks" set "AssignmentSeenAt"=now() where "Id"=p_task and "AssignmentSeenAt" is null;
      return p_task;
    end if;
    if t."AssignmentState" in ('approved','cancelled') then raise exception 'assignment_locked'; end if;
  end if;
  previous := to_jsonb(t);
  details := jsonb_build_object('note',note);

  if p_action in ('create','edit') then
    project := (p_data->>'projectId')::uuid;
    starts := (p_data->>'startsAt')::timestamptz;
    due := (p_data->>'dueAt')::timestamptz;
    if starts is null or due is null or starts>due then raise exception 'assignment_dates'; end if;
    if project is not null and (p_action='create' or project::text is distinct from t."ProjectId") and not exists(
      select 1 from "Projects" where "Id"=project and "TenantId"=p_tenant and not "IsDeleted" and "Status"=0 and (p_admin or "ManagerUserId"=p_actor)
    ) then raise exception 'assignment_project'; end if;
    if p_action='create' then
      insert into "Tasks"("Id","TenantId","Title","Description","Status","Priority","Progress","AssignedByUserId","AssignedToUserId",
        "AssigneeUserIdsJson","ProjectId","ProjectIdsJson","StartDate","DueDate","CreatedAt","CreatedByUserId","IsDeleted",
        "RequiresCompletionApproval","CreationApprovalStatus","AssignmentState","AssignmentOutcome","AssignmentNotes","AssignmentDueHasTime")
      values(p_task,p_tenant,p_data->>'title',p_data->>'description',0,(p_data->>'priority')::integer,0,p_actor,target,
        jsonb_build_array(target)::text,project::text,case when project is null then '[]' else jsonb_build_array(project)::text end,
        starts,due,now(),p_actor,false,true,1,'new',p_data->>'outcome',p_data->>'notes',(p_data->>'dueHasTime')::boolean);
      notice := 'وظیفه جدید برای شما ثبت شد';
    else
      if t."AssignmentState"='review' then raise exception 'assignment_locked'; end if;
      update "Tasks" set "Title"=p_data->>'title',"Description"=p_data->>'description',"Priority"=(p_data->>'priority')::integer,
        "ProjectId"=project::text,"ProjectIdsJson"=case when project is null then '[]' else jsonb_build_array(project)::text end,
        "StartDate"=starts,"DueDate"=due,"AssignmentOutcome"=p_data->>'outcome',"AssignmentNotes"=p_data->>'notes',
        "AssignmentDueHasTime"=(p_data->>'dueHasTime')::boolean,"UpdatedAt"=now()
      where "Id"=p_task;
      notice := 'مشخصات وظیفه به‌روزرسانی شد';
    end if;
    recipient := target;
  elsif p_action in ('start','progress','block','submit') then
    if t."AssignmentState" not in ('new','active','blocked','returned') then raise exception 'assignment_locked'; end if;
    if p_action='start' and t."AssignmentState"='active' then return p_task; end if;
    if p_action in ('block','submit') and note is null then raise exception 'assignment_note'; end if;
    progress := coalesce((p_data->>'progress')::integer,t."Progress");
    next_state := case p_action when 'block' then 'blocked' when 'submit' then 'review'
      when 'start' then 'active' else t."AssignmentState" end;
    if p_action='progress' and next_state='new' and progress>0 then next_state:='active'; end if;
    if p_action='progress' and progress=t."Progress" and note is null then return p_task; end if;
    update "Tasks" set "AssignmentState"=next_state,"Progress"=progress,"UpdatedAt"=now(),
      "Status"=case next_state when 'new' then 0 when 'review' then 2 else 1 end,
      "CompletionRequestedAt"=case when p_action='submit' then now() else "CompletionRequestedAt" end,
      "CompletionRequestedByUserId"=case when p_action='submit' then p_actor else "CompletionRequestedByUserId" end
    where "Id"=p_task;
    recipient := coalesce((select p.manager_id from organization_people(p_tenant) p where p.id=target and exists(select 1 from organization_people(p_tenant) m where m.id=p.manager_id and m.active)),t."AssignedByUserId");
    notice := case p_action
      when 'start' then 'انجام وظیفه آغاز شد'
      when 'block' then 'مانع انجام وظیفه اعلام شد'
      when 'submit' then case when t."CompletionRequestedAt" is not null then 'خروجی اصلاح‌شده وظیفه ارسال شد' else 'خروجی وظیفه برای بررسی ارسال شد' end
      when 'progress' then case when t."AssignmentState"='new' and next_state='active' then 'انجام وظیفه آغاز شد' end
    end;
  elsif p_action='extend' then
    if t."AssignmentState" not in ('new','active','blocked','returned') or t."AssignmentExtension" is not null then raise exception 'assignment_locked'; end if;
    due := (p_data->>'dueAt')::timestamptz;
    if note is null then raise exception 'assignment_note'; end if;
    if due is null or due<=greatest(t."DueDate",now()) then raise exception 'assignment_dates'; end if;
    details := jsonb_build_object('note',note,'oldDue',t."DueDate",'dueAt',due,'dueHasTime',p_data->'dueHasTime','requestedAt',now());
    update "Tasks" set "AssignmentExtension"=details,"UpdatedAt"=now() where "Id"=p_task;
    recipient:=coalesce((select p.manager_id from organization_people(p_tenant) p where p.id=target and exists(select 1 from organization_people(p_tenant) m where m.id=p.manager_id and m.active)),t."AssignedByUserId"); notice:='درخواست تمدید مهلت وظیفه';
  elsif p_action in ('extend_approve','extend_reject') then
    if t."AssignmentExtension" is null or t."AssignmentState"='review' then raise exception 'assignment_locked'; end if;
    due := (t."AssignmentExtension"->>'dueAt')::timestamptz;
    if p_action='extend_approve' and due<=greatest(t."DueDate",now()) then raise exception 'assignment_dates'; end if;
    details := details || jsonb_build_object('request',t."AssignmentExtension");
    update "Tasks" set "DueDate"=case when p_action='extend_approve' then due else "DueDate" end,
      "AssignmentDueHasTime"=case when p_action='extend_approve' then ("AssignmentExtension"->>'dueHasTime')::boolean else "AssignmentDueHasTime" end,
      "AssignmentExtension"=null,"UpdatedAt"=now() where "Id"=p_task;
    recipient:=target; notice:=case p_action when 'extend_approve' then 'تمدید مهلت وظیفه تأیید شد' else 'درخواست تمدید مهلت رد شد' end;
  elsif p_action in ('approve','return','cancel','comment') then
    if p_action in ('approve','return') and t."AssignmentState"<>'review' then raise exception 'assignment_locked'; end if;
    if p_action in ('return','cancel','comment') and note is null then raise exception 'assignment_note'; end if;
    if p_action<>'comment' then
      update "Tasks" set "AssignmentState"=case p_action when 'approve' then 'approved' when 'return' then 'returned' else 'cancelled' end,
        "Status"=case p_action when 'approve' then 3 when 'return' then 1 else 4 end,
        "Progress"=case when p_action='approve' then 100 else "Progress" end,
        "IsCompletionApproved"=(p_action='approve'),
        "CompletionApprovedAt"=case when p_action='approve' then now() else null end,
        "CompletionApprovedByUserId"=case when p_action='approve' then p_actor else null end,
        "AssignmentExtension"=case when p_action in ('approve','cancel') then null else "AssignmentExtension" end,
        "UpdatedAt"=now() where "Id"=p_task;
    end if;
    recipient:=target;
    notice:=case p_action when 'approve' then 'خروجی وظیفه تأیید شد' when 'return' then 'وظیفه برای اصلاح برگشت داده شد'
      when 'cancel' then 'وظیفه لغو شد' else 'مدیر توضیح جدیدی برای وظیفه ثبت کرد' end;
  else
    raise exception 'assignment_invalid';
  end if;
  select * into t from "Tasks" where "Id"=p_task;
  if p_action in ('edit','progress','block','start','submit','approve','return','cancel','extend_approve','extend_reject') then
    details := details || jsonb_build_object(
      'before', (select jsonb_object_agg(k,v) from jsonb_each(previous) x(k,v)
        where k in ('Title','Description','Priority','Progress','DueDate','StartDate','ProjectId','AssignmentState','AssignmentOutcome','AssignmentNotes','AssignmentDueHasTime') and v is distinct from to_jsonb(t)->k),
      'after', (select jsonb_object_agg(k,v) from jsonb_each(to_jsonb(t)) x(k,v)
        where k in ('Title','Description','Priority','Progress','DueDate','StartDate','ProjectId','AssignmentState','AssignmentOutcome','AssignmentNotes','AssignmentDueHasTime') and v is distinct from previous->k));
  end if;
  insert into "TaskActivityLogs"("Id","TaskId","TenantId","ActorUserId","Action","DetailsJson","CreatedByUserId")
  values(event_id,p_task,p_tenant,p_actor,'assignment_'||p_action,details::text,p_actor);
  insert into performance_task_files(task_id,event_id,uploader_id,name,mime_type,size_bytes,content_base64)
  select p_task,event_id,p_actor,name,mime,bytes,content from jsonb_to_recordset(coalesce(p_data->'files','[]'))
    as f(name text,mime text,bytes integer,content text);
  if notice is not null and recipient<>p_actor then
    route:=case when recipient=target then '/performance/tasks?task=' else '/performance/assignments?task=' end;
    insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId",
      "RelatedEntityType","ActorUserId","CreatedAt","CreatedByUserId","IsDeleted")
    values(gen_random_uuid(),p_tenant,recipient,notice,t."Title",1,false,route||p_task::text,p_task,'Task',p_actor,now(),p_actor,false);
  end if;
  return p_task;
end;
$$;
