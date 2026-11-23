create table public.performance_daily_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  employee_id uuid not null references public."Users"("Id"),
  reviewer_id uuid references public."Users"("Id"),
  work_date date not null,
  status text not null default 'draft' check (status in ('draft','submitted','approved','returned')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_id, work_date)
);
create index performance_daily_review_queue on public.performance_daily_reports(tenant_id, reviewer_id, status);

create table public.performance_daily_activities (
  id uuid primary key,
  report_id uuid not null references public.performance_daily_reports(id),
  created_by uuid not null references public."Users"("Id"),
  title text not null,
  description text not null,
  kind text not null,
  status text not null,
  time_mode text not null check(time_mode in ('manual','intervals')),
  minutes integer not null check(minutes between 1 and 1440),
  task_id uuid references public."Tasks"("Id"),
  project_id uuid references public."Projects"("Id"),
  outcome text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index performance_daily_activity_report on public.performance_daily_activities(report_id);
create table public.performance_daily_intervals (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.performance_daily_activities(id),
  created_by uuid not null references public."Users"("Id"),
  start_minute integer not null,
  end_minute integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_minute >= 0 and end_minute <= 1440 and start_minute < end_minute)
);
create index performance_daily_interval_activity on public.performance_daily_intervals(activity_id);
create table public.performance_daily_attachments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.performance_daily_activities(id),
  created_by uuid not null references public."Users"("Id"),
  name text not null,
  mime_type text not null,
  size_bytes integer not null check(size_bytes between 1 and 1048576),
  content_base64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index performance_daily_attachment_activity on public.performance_daily_attachments(activity_id);
create table public.performance_daily_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.performance_daily_reports(id),
  created_by uuid not null references public."Users"("Id"),
  action text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index performance_daily_history_report on public.performance_daily_history(report_id, created_at);

alter table public.performance_daily_reports enable row level security;
alter table public.performance_daily_activities enable row level security;
alter table public.performance_daily_intervals enable row level security;
alter table public.performance_daily_attachments enable row level security;
alter table public.performance_daily_history enable row level security;
revoke all on public.performance_daily_reports, public.performance_daily_activities,
  public.performance_daily_intervals, public.performance_daily_attachments, public.performance_daily_history
  from public, anon, authenticated;
grant all on public.performance_daily_reports, public.performance_daily_activities,
  public.performance_daily_intervals, public.performance_daily_attachments, public.performance_daily_history to service_role;

create function public.performance_daily_mutate(
  p_tenant uuid, p_actor uuid, p_action text, p_date date, p_report uuid,
  p_reviewer uuid, p_admin boolean, p_data jsonb
) returns uuid language plpgsql set search_path = public as $$
declare
  report performance_daily_reports%rowtype;
  activity uuid;
  activity_exists boolean;
  ranges jsonb;
  history_action text := p_action;
begin
  if p_action = 'create' then
    insert into performance_daily_reports(tenant_id, employee_id, work_date)
    values (p_tenant, p_actor, p_date) on conflict (tenant_id, employee_id, work_date) do nothing;
  end if;
  select * into report from performance_daily_reports r
  where r.tenant_id=p_tenant and ((p_report is not null and r.id=p_report) or
    (p_report is null and r.employee_id=p_actor and r.work_date=p_date)) for update;
  if not found then raise exception 'daily_not_found'; end if;

  if p_action in ('approve','return') then
    if report.employee_id=p_actor or (not p_admin and report.reviewer_id is distinct from p_actor)
      then raise exception 'daily_not_found'; end if;
    if report.status <> 'submitted' then raise exception 'daily_locked'; end if;
    if p_action='return' and coalesce(nullif(trim(p_data->>'note'),''),'')='' then raise exception 'daily_note'; end if;
    update performance_daily_reports set status=case p_action when 'approve' then 'approved' else 'returned' end, updated_at=now()
    where id=report.id;
  else
    if report.employee_id<>p_actor then raise exception 'daily_not_found'; end if;
    if report.status not in ('draft','returned') then raise exception 'daily_locked'; end if;
    if p_action='submit' then
      if p_reviewer is null or p_reviewer=p_actor then raise exception 'daily_reviewer'; end if;
      if not exists (select 1 from performance_daily_activities where report_id=report.id) then raise exception 'daily_empty'; end if;
      if report.status='returned' then history_action := 'resubmit'; end if;
      update performance_daily_reports set status='submitted', reviewer_id=p_reviewer, submitted_at=now(), updated_at=now() where id=report.id;
    else
      activity := (p_data->>'id')::uuid;
      if p_action not in ('create','edit') then raise exception 'daily_invalid'; end if;
      select exists(select 1 from performance_daily_activities where id=activity and report_id=report.id) into activity_exists;
      if p_action='edit' and not activity_exists then raise exception 'daily_not_found'; end if;
      if p_action='create' and activity_exists then return report.id; end if;
      ranges := coalesce(p_data->'intervals','[]'::jsonb);
      if exists(
        select 1 from jsonb_to_recordset(ranges) x(s int,e int)
        join performance_daily_intervals i on x.s<i.end_minute and x.e>i.start_minute
        join performance_daily_activities a on a.id=i.activity_id
        where a.report_id=report.id and a.id<>activity
      ) then raise exception 'daily_overlap'; end if;
      if (select coalesce(sum(minutes),0) from performance_daily_activities where report_id=report.id and id<>activity)
         + (p_data->>'minutes')::integer > 1440 then raise exception 'daily_total'; end if;
      if exists (select 1 from performance_daily_activities a where a.report_id=report.id and a.id<>activity and
        lower(a.title)=lower(p_data->>'title') and a.description=p_data->>'description' and
        a.time_mode='manual' and p_data->>'timeMode'='manual' and a.minutes=(p_data->>'minutes')::int and
        a.kind=p_data->>'kind' and a.task_id is not distinct from (p_data->>'taskId')::uuid and
        a.project_id is not distinct from (p_data->>'projectId')::uuid) then raise exception 'daily_duplicate'; end if;
      insert into performance_daily_activities(id,report_id,created_by,title,description,kind,status,time_mode,minutes,task_id,project_id,outcome,notes)
      values(activity,report.id,p_actor,p_data->>'title',p_data->>'description',p_data->>'kind',p_data->>'status',p_data->>'timeMode',
        (p_data->>'minutes')::int,(p_data->>'taskId')::uuid,(p_data->>'projectId')::uuid,p_data->>'outcome',p_data->>'notes')
      on conflict(id) do update set title=excluded.title, description=excluded.description, kind=excluded.kind,
        status=excluded.status,time_mode=excluded.time_mode,minutes=excluded.minutes,task_id=excluded.task_id,
        project_id=excluded.project_id,outcome=excluded.outcome,notes=excluded.notes,updated_at=now()
      where performance_daily_activities.report_id=report.id;
      if not found then raise exception 'daily_not_found'; end if;
      delete from performance_daily_intervals where activity_id=activity;
      insert into performance_daily_intervals(activity_id,created_by,start_minute,end_minute)
        select activity,p_actor,s,e from jsonb_to_recordset(ranges) x(s int,e int);
      delete from performance_daily_attachments where activity_id=activity and id in
        (select value::uuid from jsonb_array_elements_text(coalesce(p_data->'removeFiles','[]')));
      if (select count(*) from performance_daily_attachments where activity_id=activity)
        + jsonb_array_length(coalesce(p_data->'files','[]')) > 5 then raise exception 'daily_files'; end if;
      insert into performance_daily_attachments(activity_id,created_by,name,mime_type,size_bytes,content_base64)
        select activity,p_actor,name,mime,bytes,content from jsonb_to_recordset(coalesce(p_data->'files','[]'))
        x(name text,mime text,bytes int,content text);
      update performance_daily_reports set updated_at=now() where id=report.id;
    end if;
  end if;
  insert into performance_daily_history(report_id,created_by,action,note)
  values (report.id,p_actor, history_action, case when p_action in ('return','approve') then p_data->>'note'
    when p_action in ('create','edit') then p_data->>'title' else null end);
  return report.id;
end;
$$;
revoke all on function public.performance_daily_mutate(uuid,uuid,text,date,uuid,uuid,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.performance_daily_mutate(uuid,uuid,text,date,uuid,uuid,boolean,jsonb) to service_role;
