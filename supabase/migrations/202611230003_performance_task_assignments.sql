alter table public."Tasks"
  add column "AssignmentState" text check ("AssignmentState" in ('new','active','blocked','review','approved','returned','cancelled')),
  add column "AssignmentOutcome" text,
  add column "AssignmentNotes" text,
  add column "AssignmentSeenAt" timestamptz,
  add column "AssignmentDueHasTime" boolean,
  add column "AssignmentExtension" jsonb;
create index performance_assignment_scope on public."Tasks"("TenantId","AssignedByUserId","AssignedToUserId")
  where "AssignmentState" is not null and not "IsDeleted";
create index performance_assignment_due on public."Tasks"("DueDate")
  where "AssignmentState" in ('new','active','blocked','returned') and not "IsDeleted";

create table public.performance_task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public."Tasks"("Id"),
  event_id uuid not null references public."TaskActivityLogs"("Id"),
  uploader_id uuid not null references public."Users"("Id"),
  name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 1048576),
  content_base64 text not null,
  created_at timestamptz not null default now()
);
create index performance_task_files_task on public.performance_task_files(task_id);
create table public.performance_task_reminders (
  task_id uuid not null references public."Tasks"("Id"),
  due_at timestamptz not null,
  kind text not null check(kind in ('due','overdue')),
  primary key(task_id,due_at,kind)
);
alter table public.performance_task_files enable row level security;
alter table public.performance_task_reminders enable row level security;
revoke all on public.performance_task_files, public.performance_task_reminders from public, anon, authenticated;
grant all on public.performance_task_files, public.performance_task_reminders to service_role;

create function public.performance_direct_reports(p_tenant uuid, p_actor uuid)
returns table(id uuid, name text, "position" text) language sql stable set search_path=public as $$
  with active_users as (
    select u."Id",u."Position", coalesce(nullif(trim(concat_ws(' ',u."FirstName",u."LastName")),''),u."Username") as name,
      lower(regexp_replace(translate(coalesce(u."DirectManager",''),'يىك','ییک'),'[[:space:]‌]+','','g')) as manager_ref,
      lower(regexp_replace(translate(concat_ws(' ',u."FirstName",u."LastName"),'يىك','ییک'),'[[:space:]‌]+','','g')) as full_name_ref,
      lower(regexp_replace(translate(u."Username",'يىك','ییک'),'[[:space:]‌]+','','g')) as username_ref
    from "Users" u where u."TenantId"=p_tenant and u."IsActive" and not u."IsDeleted"
  )
  select e."Id",e.name,e."Position"
  from active_users e join active_users m on m."Id"=p_actor
  where e."Id"<>p_actor and e.manager_ref<>'' and (
    e.manager_ref = m."Id"::text or e.manager_ref = m.username_ref or
    (e.manager_ref = m.full_name_ref and
      (select count(*) from active_users x where x.full_name_ref=e.manager_ref or x.username_ref=e.manager_ref)=1)
  );
$$;
revoke all on function public.performance_direct_reports(uuid,uuid) from public, anon, authenticated;
grant execute on function public.performance_direct_reports(uuid,uuid) to service_role;

create function public.performance_task_write_guard()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_setting('portal.performance_task_write',true) is distinct from 'on' and
     ((tg_op<>'INSERT' and old."AssignmentState" is not null) or (tg_op<>'DELETE' and new."AssignmentState" is not null))
  then raise exception 'assignment_use_workflow'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger performance_task_write_guard before insert or update or delete on public."Tasks"
for each row execute function public.performance_task_write_guard();

create function public.performance_task_mutate(
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
    elsif not p_admin and not (t."AssignedByUserId"=p_actor and exists(select 1 from performance_direct_reports(p_tenant,p_actor) as team where team.id=target))
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
    recipient := t."AssignedByUserId";
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
    recipient:=t."AssignedByUserId"; notice:='درخواست تمدید مهلت وظیفه';
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
revoke all on function public.performance_task_mutate(uuid,uuid,boolean,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.performance_task_mutate(uuid,uuid,boolean,uuid,text,jsonb) to service_role;

create function public.performance_task_send_reminders()
returns bigint language sql set search_path=public as $$
  with due as (
    select t."Id", t."DueDate", case when t."DueDate"<=now() then 'overdue' else 'due' end as kind
    from "Tasks" t where not t."IsDeleted" and t."AssignmentState" in ('new','active','blocked','returned')
      and t."DueDate"<=now()+interval '24 hours' and t."DueDate">now()-interval '2 days'
  ), claimed as (
    insert into performance_task_reminders(task_id,due_at,kind) select "Id","DueDate",kind from due
    on conflict do nothing returning *
  ), notices as (
    insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType",
      "CreatedAt","CreatedByUserId","IsDeleted")
    select gen_random_uuid(),t."TenantId",t."AssignedToUserId",
      case c.kind when 'due' then 'مهلت وظیفه نزدیک است' else 'مهلت وظیفه بدون تحویل پایان یافت' end,
      t."Title",1,false,'/performance/tasks?task='||t."Id",t."Id",'Task',now(),t."AssignedByUserId",false
    from claimed c join "Tasks" t on t."Id"=c.task_id returning 1
  ) select count(*) from notices;
$$;
revoke all on function public.performance_task_send_reminders() from public, anon, authenticated;
grant execute on function public.performance_task_send_reminders() to service_role;
