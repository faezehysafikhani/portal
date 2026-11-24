create table public.performance_policy_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  effective_date date not null,
  policy jsonb not null,
  created_by uuid not null references public."Users"("Id"),
  created_at timestamptz not null default clock_timestamp()
);
create index performance_policy_effective on public.performance_policy_versions(tenant_id,effective_date desc,created_at desc);
alter table public.performance_policy_versions enable row level security;
revoke all on public.performance_policy_versions from public,anon,authenticated;
grant all on public.performance_policy_versions to service_role;

alter table public.performance_daily_reports
  add column no_activity_reason text,
  add column reviewed_by uuid references public."Users"("Id"),
  add column reviewed_at timestamptz;
alter table public.performance_daily_history add column snapshot jsonb;
alter table public.performance_daily_activities drop constraint performance_daily_activities_minutes_check,
  add constraint performance_daily_activities_minutes_check check(minutes between 0 and 1440);

create table public.performance_archived_attachments (
  id uuid primary key,
  report_id uuid not null references public.performance_daily_reports(id),
  name text not null,
  content_base64 text not null,
  created_at timestamptz not null
);
create table public.performance_daily_reminders (
  tenant_id uuid not null, employee_id uuid not null, work_date date not null,
  primary key(tenant_id,employee_id,work_date)
);
alter table public.performance_archived_attachments enable row level security;
alter table public.performance_daily_reminders enable row level security;
revoke all on public.performance_archived_attachments, public.performance_daily_reminders from public,anon,authenticated;
grant all on public.performance_archived_attachments, public.performance_daily_reminders to service_role;

with codes(code,label) as (values
 ('performance.reports.organization','مشاهده گزارش عملکرد کل سازمان'),
 ('performance.reports.approve','تأیید یا برگشت گزارش کل سازمان'),
 ('performance.reports.download','دانلود پیوست گزارش کل سازمان'),
 ('performance.settings.manage','مدیریت تنظیمات ارزیابی عملکرد'),
 ('performance.analytics.export','خروجی اکسل گزارش‌های عملکرد'),
 ('performance.access.manage','مدیریت مجوزهای ارزیابی عملکرد')
)
insert into public."Permissions"("Id","TenantId","Code","Name","Module","CreatedAt","IsDeleted")
select gen_random_uuid(),t."Id",c.code,c.label,'performance',now(),false from public."Tenants" t cross join codes c
where not exists (select 1 from public."Permissions" p where p."TenantId"=t."Id" and p."Code"=c.code);

-- Bootstrap system administrators with individually revocable grants. Future checks read the grants themselves.
insert into public."UserPermissions"("Id","TenantId","UserId","PermissionId","CreatedAt","IsDeleted")
select gen_random_uuid(),u."TenantId",u."Id",p."Id",now(),false
from public."Users" u join public."Permissions" p on p."TenantId"=u."TenantId"
where lower(u."Username")='admin' and not u."IsDeleted" and p."Code" in
 ('performance.reports.organization','performance.reports.approve','performance.reports.download','performance.settings.manage','performance.analytics.export','performance.access.manage')
and not exists(select 1 from public."UserPermissions" x where x."UserId"=u."Id" and x."PermissionId"=p."Id");

create function public.performance_set_grants(p_tenant uuid,p_actor uuid,p_user uuid,p_codes text[])
returns void language plpgsql set search_path=public as $$
declare permitted constant text[]:=array['performance.reports.organization','performance.reports.approve','performance.reports.download',
 'performance.settings.manage','performance.analytics.export','performance.access.manage'];
begin
  if p_user=p_actor or not p_codes <@ permitted then raise exception 'performance_grant_invalid'; end if;
  if not exists(select 1 from "Users" where "TenantId"=p_tenant and "Id"=p_user and not "IsDeleted") then raise exception 'performance_grant_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  delete from "UserPermissions" g using "Permissions" p where g."TenantId"=p_tenant and g."UserId"=p_user
    and p."TenantId"=p_tenant and p."Id"=g."PermissionId" and p."Code"=any(permitted) and not p."Code"=any(p_codes);
  update "UserPermissions" g set "IsDeleted"=false,"DeletedAt"=null,"UpdatedAt"=now() from "Permissions" p
    where g."TenantId"=p_tenant and g."UserId"=p_user and g."IsDeleted" and p."TenantId"=p_tenant and
      p."Id"=g."PermissionId" and not p."IsDeleted" and p."Code"=any(p_codes);
  insert into "UserPermissions"("Id","TenantId","CreatedByUserId","CreatedAt","IsDeleted","UserId","PermissionId")
    select gen_random_uuid(),p_tenant,p_actor,now(),false,p_user,p."Id" from "Permissions" p
    where p."TenantId"=p_tenant and not p."IsDeleted" and p."Code"=any(p_codes)
      and not exists(select 1 from "UserPermissions" g where g."UserId"=p_user and g."PermissionId"=p."Id" and not g."IsDeleted");
end;
$$;
revoke all on function public.performance_set_grants(uuid,uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.performance_set_grants(uuid,uuid,uuid,text[]) to service_role;

create function public.performance_policy_at(p_tenant uuid,p_day date) returns jsonb language sql stable set search_path=public as $$
  select coalesce((select policy from performance_policy_versions where tenant_id=p_tenant and effective_date<=p_day
    order by effective_date desc,created_at desc,id desc limit 1),'{}'::jsonb);
$$;

-- Calendar conversion follows the break years already used by the portal's Jalali date picker.
create function public.performance_jalali_start(y integer) returns date language plpgsql immutable set search_path=public as $$
declare
  gy integer:=y+621; jumps integer[]:=array[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  jp integer:=-61; jm integer; jump integer:=0; leap_j integer:=-14; n integer;
begin
  foreach jm in array jumps[2:19] loop
    jump:=jm-jp;
    exit when y<jm;
    leap_j:=leap_j+(jump/33)*8+(jump%33)/4;
    jp:=jm;
  end loop;
  n:=y-jp;
  leap_j:=leap_j+(n/33)*8+((n%33+3)/4);
  if jump%33=4 and jump-n=4 then leap_j:=leap_j+1; end if;
  return make_date(gy,3,20+leap_j-(gy/4-(((gy/100+1)*3)/4)-150));
end;
$$;
create function public.performance_jalali_key(d date) returns text language plpgsql immutable set search_path=public as $$
declare y integer:=extract(year from d)::integer-621; n integer; m integer; day_num integer;
begin
  if d<performance_jalali_start(y) then y:=y-1; end if;
  n:=d-performance_jalali_start(y);
  if n<186 then m:=1+n/31; day_num:=1+n%31; else m:=7+(n-186)/30; day_num:=1+(n-186)%30; end if;
  return y::text||'/'||lpad(m::text,2,'0')||'/'||lpad(day_num::text,2,'0');
end;
$$;
create function public.performance_leave_key(v text) returns text language sql immutable as $$
  select case when translated ~ '^\d{4}/\d{1,2}/\d{1,2}$'
    then split_part(translated,'/',1)||'/'||lpad(split_part(translated,'/',2),2,'0')||'/'||lpad(split_part(translated,'/',3),2,'0') end
  from (select translate(trim(v),'۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩-','01234567890123456789/') translated) src;
$$;

create function public.performance_reporting_days(p_tenant uuid,p_people uuid[],p_from date,p_to date)
returns table(employee_id uuid, work_date date, deadline timestamptz, required boolean, exemption text)
language sql stable set search_path=public as $$
  with calendar as (
    select d::date as dt, performance_jalali_key(d::date) as jalali, performance_policy_at(p_tenant,d::date) as policy
    from generate_series(p_from,p_to,interval '1 day') d where p_to-p_from between 0 and 92
  ), employees as (
    select u."Id", (u."CreatedAt" at time zone 'Asia/Tehran')::date as joined,
      performance_leave_key(u."EmploymentStartDate") as employment
    from "Users" u where u."TenantId"=p_tenant and u."Id"=any(p_people) and not u."IsDeleted"
  ), leave_days as (
    select f."SubmitterUserId" as uid,
      performance_leave_key(data->>'fromDate') as start_key,performance_leave_key(data->>'toDate') as end_key,
      performance_leave_key(data->>'date') as hourly_key,f."FormType" as kind
    from "OrganizationalForms" f cross join lateral (select f."DataJson"::jsonb as data) x
    where f."TenantId"=p_tenant and not f."IsDeleted" and f."Status" in ('approved','completed')
      and f."FormType" in ('leave_daily','leave_sick','leave_hourly') and f."SubmitterUserId"=any(p_people)
  ), reporting as (
    select e."Id",c.dt,c.policy,
      case
        when (e.employment is not null and c.jalali<e.employment) or (e.employment is null and c.dt<e.joined) then 'before_employment'
        when exists(select 1 from leave_days l where l.uid=e."Id" and
          ((l.kind<>'leave_hourly' and c.jalali between l.start_key and l.end_key) or
           (l.kind='leave_hourly' and coalesce((c.policy->>'partialLeaveExempts')::boolean,false) and l.hourly_key=c.jalali))) then 'leave'
        when c.policy->'exceptions'->>c.dt::text='work' then null
        when c.policy->'exceptions'->>c.dt::text='off' or coalesce(c.policy->'organizationHolidays','[]') ? c.dt::text then 'organization_holiday'
        when extract(dow from c.dt)::integer not in (select value::integer from jsonb_array_elements_text(coalesce(c.policy->'workingDays','[0,1,2,3,4,6]'))) then 'weekend'
        when coalesce((c.policy->>'useOfficialHolidays')::boolean,true) and
          (substring(c.jalali from 6) in ('01/01','01/02','01/03','01/04','01/12','01/13','03/14','03/15','11/22','12/29')
           or c.jalali in ('1405/01/24','1405/03/03','1405/03/06','1405/04/03','1405/04/04','1405/05/13','1405/05/21','1405/05/22','1405/05/30','1405/06/08','1405/08/22','1405/10/02','1405/10/16','1405/12/09','1405/12/19','1405/12/20')
           or coalesce(c.policy->'officialHolidays','[]') ? c.dt::text) then 'official_holiday'
        else null end as reason
    from employees e cross join calendar c
  )
  select "Id",dt,(dt+coalesce(policy->>'deadline','23:59')::time+interval '59 seconds') at time zone 'Asia/Tehran',
    reason is null and dt>=date '2026-11-23' and coalesce((policy->>'enabled')::boolean,true) and coalesce((policy->>'required')::boolean,true),reason
  from reporting;
$$;

create function public.performance_archive_attachment() returns trigger language plpgsql set search_path=public as $$
begin
  insert into performance_archived_attachments(id,report_id,name,content_base64,created_at)
  select old.id,a.report_id,old.name,old.content_base64,old.created_at from performance_daily_activities a
  where a.id=old.activity_id and exists(select 1 from performance_daily_history h where h.report_id=a.report_id and h.snapshot is not null)
  on conflict do nothing;
  return old;
end;
$$;
create trigger performance_archive_attachment before delete on public.performance_daily_attachments
for each row execute function public.performance_archive_attachment();

create function public.performance_daily_controlled(
  p_tenant uuid,p_actor uuid,p_action text,p_date date,p_report uuid,p_reviewer uuid,p_org_approve boolean,p_data jsonb
) returns uuid language plpgsql set search_path=public as $$
declare
  r performance_daily_reports%rowtype; id_out uuid; settings jsonb; snapshot_data jsonb;
  actor_id uuid; recipient uuid; notice text; action_url text; history_action text; why text;
  today date:=(now() at time zone 'Asia/Tehran')::date;
  limit_days integer; deadline_at timestamptz; existing_count integer; existing_size bigint; incoming_size bigint;
begin
  if p_action='submit' and nullif(trim(p_data->>'reason'),'') is not null and p_date<=today then
    insert into performance_daily_reports(tenant_id,employee_id,work_date)
    values(p_tenant,p_actor,p_date) on conflict(tenant_id,employee_id,work_date) do nothing;
  end if;
  select * into r from performance_daily_reports
  where tenant_id=p_tenant and ((p_report is not null and id=p_report) or
    (p_report is null and employee_id=p_actor and work_date=p_date)) for update;
  settings:=performance_policy_at(p_tenant,coalesce(r.work_date,p_date,today));
  if p_action in ('create','edit','reopen','submit') then
    if r.id is not null and r.employee_id<>p_actor then raise exception 'daily_not_found'; end if;
    if not coalesce((settings->>'enabled')::boolean,true) then raise exception 'daily_disabled'; end if;
    if coalesce(r.work_date,p_date)>today then raise exception 'daily_date'; end if;
    if p_action='create' or (p_action='edit' and r.status='draft' and r.submitted_at is null) then
      limit_days:=coalesce((settings->>'pastDays')::int,0);
      if coalesce(r.work_date,p_date)<today and (not coalesce((settings->>'allowPast')::boolean,true)
        or (limit_days>0 and today-coalesce(r.work_date,p_date)>limit_days)) then raise exception 'daily_date'; end if;
    end if;
  end if;
  if p_action in ('approve','return') then
    if r.id is null or r.employee_id=p_actor or (not p_org_approve and not exists(
      select 1 from performance_direct_reports(p_tenant,p_actor) team where team.id=r.employee_id
    )) then raise exception 'daily_not_found'; end if;
    id_out:=performance_daily_mutate(p_tenant,p_actor,p_action,p_date,p_report,null,true,p_data);
    update performance_daily_reports set reviewed_at=now(),reviewed_by=p_actor where id=id_out;
    recipient:=r.employee_id;
    notice:=case p_action when 'approve' then 'گزارش روزانه تأیید شد' else 'گزارش روزانه برای اصلاح برگشت' end;
    action_url:='/performance/reports?report='||id_out;
  elsif p_action='reopen' then
    if r.id is null or r.status<>'submitted' or not coalesce((settings->>'allowRevision')::boolean,false) then raise exception 'daily_locked'; end if;
    update performance_daily_reports set status='returned',updated_at=now() where id=r.id;
    insert into performance_daily_history(report_id,created_by,action) values(r.id,p_actor,'reopen');
    return r.id;
  elsif p_action='submit' then
    if r.id is null then raise exception 'daily_empty'; end if;
    if r.status not in ('draft','returned') then raise exception 'daily_locked'; end if;
    select manager."Id" into actor_id from "Users" manager cross join lateral performance_direct_reports(p_tenant,manager."Id") team
    where manager."TenantId"=p_tenant and team.id=p_actor limit 1;
    if actor_id is null or actor_id=p_actor then raise exception 'daily_reviewer'; end if;
    limit_days:=coalesce((settings->>'lateDays')::integer,0);
    select d.deadline into deadline_at from performance_reporting_days(p_tenant,array[p_actor],r.work_date,r.work_date) d;
    if r.submitted_at is null and limit_days>0 and now()>deadline_at+make_interval(days=>limit_days) then raise exception 'daily_late_limit'; end if;
    why:=nullif(trim(p_data->>'reason'),'');
    if exists(select 1 from performance_daily_activities where report_id=r.id) then why:=null;
    elsif why is null or not coalesce((settings->>'allowEmpty')::boolean,true) then raise exception 'daily_empty'; end if;
    select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object(
       'projectName',(select "Name" from "Projects" p where p."Id"=a.project_id and p."TenantId"=p_tenant),
       'taskName',(select "Title" from "Tasks" t where t."Id"=a.task_id and t."TenantId"=p_tenant),
       'intervals',(select coalesce(jsonb_agg(to_jsonb(i) order by i.start_minute),'[]') from performance_daily_intervals i where i.activity_id=a.id),
       'files',(select coalesce(jsonb_agg(to_jsonb(f)-'content_base64' order by f.created_at),'[]') from performance_daily_attachments f where f.activity_id=a.id)
    ) order by a.created_at),'[]') into snapshot_data from performance_daily_activities a where a.report_id=r.id;
    update performance_daily_reports set status='submitted', reviewer_id=actor_id, submitted_at=now(),updated_at=now(),
       reviewed_by=null,reviewed_at=null,no_activity_reason=why where id=r.id;
    history_action:=case when r.submitted_at is null then 'submit' else 'resubmit' end;
    insert into performance_daily_history(report_id,created_by,action,note,snapshot) values(r.id,p_actor,history_action,why,snapshot_data);
    id_out:=r.id; recipient:=actor_id;
    notice:=case history_action when 'submit' then 'گزارش روزانه برای بررسی ارسال شد' else 'گزارش اصلاح‌شده دوباره ارسال شد' end;
    action_url:='/performance/review?report='||id_out;
  else
    if p_action in ('create','edit') and jsonb_array_length(coalesce(p_data->'files','[]'))>0 then
      select count(*),coalesce(sum(f.size_bytes),0) into existing_count,existing_size from performance_daily_attachments f
      where f.activity_id=(p_data->>'id')::uuid and not (coalesce(p_data->'removeFiles','[]') ? f.id::text);
      select coalesce(sum((value->>'bytes')::integer),0) into incoming_size from jsonb_array_elements(p_data->'files');
      if existing_count+jsonb_array_length(p_data->'files')>coalesce((settings->'files'->>'maxCount')::integer,5)
        or existing_size+incoming_size>coalesce((settings->'files'->>'totalBytes')::integer,5242880)
        then raise exception 'daily_file_policy'; end if;
    end if;
    return performance_daily_mutate(p_tenant,p_actor,p_action,p_date,p_report,p_reviewer,false,p_data);
  end if;
  if recipient is not null then
    insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType","ActorUserId","CreatedAt","CreatedByUserId","IsDeleted")
    values(gen_random_uuid(),p_tenant,recipient,notice,'گزارش روزانه • '||performance_jalali_key(r.work_date),3,false,action_url,id_out,'PerformanceDailyReport',p_actor,now(),p_actor,false);
  end if;
  return id_out;
end;
$$;

create function public.performance_send_report_reminders() returns bigint language sql set search_path=public as $$
  with now_local as (select (now() at time zone 'Asia/Tehran')::date as dt), teams as (
    select "TenantId" as tenant,array_agg("Id") as ids from "Users" where "IsActive" and not "IsDeleted" group by "TenantId"
  ), claims as (
    insert into performance_daily_reminders
    select t.tenant,d.employee_id,d.work_date from teams t cross join now_local n
    cross join lateral performance_reporting_days(t.tenant,t.ids,n.dt-1,n.dt) d
    left join performance_daily_reports r on r.tenant_id=t.tenant and r.employee_id=d.employee_id and r.work_date=d.work_date
    where d.required and now()>d.deadline and r.submitted_at is null
    on conflict do nothing returning *
  ), sent as (
    insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType","CreatedAt","IsDeleted")
    select gen_random_uuid(),c.tenant_id,c.employee_id,'یادآوری ارسال گزارش روزانه','گزارش '||performance_jalali_key(c.work_date)||' هنوز ارسال نشده است.',3,false,
      '/performance/me?date='||c.work_date,r.id,'PerformanceDailyReport',now(),false
    from claims c left join performance_daily_reports r on r.tenant_id=c.tenant_id and r.employee_id=c.employee_id and r.work_date=c.work_date returning 1
  ) select count(*) from sent;
$$;

revoke all on function public.performance_policy_at(uuid,date), public.performance_reporting_days(uuid,uuid[],date,date),
  public.performance_daily_controlled(uuid,uuid,text,date,uuid,uuid,boolean,jsonb), public.performance_send_report_reminders()
  from public,anon,authenticated;
grant execute on function public.performance_policy_at(uuid,date), public.performance_reporting_days(uuid,uuid[],date,date),
  public.performance_daily_controlled(uuid,uuid,text,date,uuid,uuid,boolean,jsonb) to service_role;
select cron.schedule('portal-performance-report-reminders','*/15 * * * *','select public.performance_send_report_reminders();');
