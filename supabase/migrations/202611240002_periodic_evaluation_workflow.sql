alter table public."PerformanceEvaluations"
  add column "EvaluationPeriodKey" text,
  add column "EvaluationState" text check ("EvaluationState" in ('draft','pending','revision','finalized','published','closed')),
  add column "EvaluationData" jsonb,
  add column "EvaluationPublication" jsonb,
  add column "EvaluationVersion" integer not null default 0,
  add column "EvaluationPublishedAt" timestamptz,
  add column "EvaluationSeenAt" timestamptz,
  add column "EvaluationEmployeeNote" text;
drop index if exists public."PerformanceEvaluations_UserPeriod_uidx";
create unique index "PerformanceEvaluations_UserPeriod_uidx" on public."PerformanceEvaluations"("UserId","PeriodYear","PeriodMonth")
where not "IsDeleted" and "EvaluationPeriodKey" is null;
create unique index "PerformanceEvaluations_OrgPeriod_uidx" on public."PerformanceEvaluations"("TenantId","UserId","EvaluationPeriodKey")
where not "IsDeleted" and "EvaluationPeriodKey" is not null;
alter table public."PerformanceAppeals" add column "PeriodicIndicatorKey" text, add column "PeriodicExplanation" text, add column "PeriodicDecision" text;
create unique index "PerformanceAppeals_OnePeriodicPending" on public."PerformanceAppeals"("EvaluationId")
where not "IsDeleted" and "PeriodicExplanation" is not null and "Status"<2;

create table public.performance_improvement_actions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public."PerformanceEvaluations"("Id"),
  created_by uuid not null references public."Users"("Id"),
  plan jsonb not null,
  state text not null default 'planned' check (state in ('planned','active','review','achieved','followup','cancelled')),
  progress integer not null default 0 check(progress between 0 and 100),
  employee_note text,manager_note text,
  updated_at timestamptz not null default now(),created_at timestamptz not null default now()
);
create index performance_improvement_evaluation on public.performance_improvement_actions(evaluation_id);
create table public.performance_evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public."PerformanceEvaluations"("Id"),
  appeal_id uuid references public."PerformanceAppeals"("Id"),
  plan_id uuid references public.performance_improvement_actions(id),
  indicator_key text,
  uploaded_by uuid not null references public."Users"("Id"),
  name text not null,mime_type text not null,size_bytes integer not null check(size_bytes between 1 and 1048576),
  content_base64 text not null,created_at timestamptz not null default now()
);
create index performance_evaluation_evidence_evaluation on public.performance_evaluation_evidence(evaluation_id);
create table public.performance_periodic_reminders (
  tenant_id uuid not null,user_id uuid not null,event_key text not null,
  primary key(tenant_id,user_id,event_key)
);
alter table public.performance_improvement_actions enable row level security;
alter table public.performance_evaluation_evidence enable row level security;
alter table public.performance_periodic_reminders enable row level security;
revoke all on public.performance_improvement_actions,public.performance_evaluation_evidence,public.performance_periodic_reminders from public,anon,authenticated;
grant all on public.performance_improvement_actions,public.performance_evaluation_evidence,public.performance_periodic_reminders to service_role;

with codes(code,label) as (values
 ('performance.eval.view','مشاهده ارزیابی زیرمجموعه'),('performance.eval.write','ثبت ارزیابی زیرمجموعه'),
 ('performance.eval.approve','نهایی‌سازی ارزیابی'),('performance.eval.publish','انتشار نتیجه ارزیابی'),
 ('performance.eval.reopen','بازگشایی ارزیابی یا دوره'),('performance.eval.appeals','بررسی درخواست بازبینی'),
 ('performance.eval.organization','مشاهده ارزیابی و گزارش سازمانی'),('performance.eval.templates','مدیریت الگوهای شغلی'),
 ('performance.eval.indicators','مدیریت شاخص‌های ارزیابی'),('performance.eval.settings','مدیریت سیاست و دوره ارزیابی'),
 ('performance.eval.adjust','تعدیل امتیاز کمی'),('performance.eval.evidence','دانلود مستندات ارزیابی سازمانی')
)
insert into public."Permissions"("Id","TenantId","Code","Name","Module","CreatedAt","IsDeleted")
select gen_random_uuid(),t."Id",c.code,c.label,'performance',now(),false from public."Tenants" t cross join codes c
where not exists(select 1 from public."Permissions" p where p."TenantId"=t."Id" and p."Code"=c.code);

insert into public."UserPermissions"("Id","TenantId","UserId","PermissionId","CreatedAt","IsDeleted")
select gen_random_uuid(),u."TenantId",u."Id",p."Id",now(),false from public."Users" u join public."Permissions" p on p."TenantId"=u."TenantId"
where not u."IsDeleted" and u."IsActive" and p."Code" like 'performance.eval.%'
and (lower(u."Username")='admin' or (p."Code" in ('performance.eval.view','performance.eval.write')
  and exists(select 1 from public.performance_direct_reports(u."TenantId",u."Id"))))
and not exists(select 1 from public."UserPermissions" x where x."UserId"=u."Id" and x."PermissionId"=p."Id");

create or replace function public.performance_set_grants(p_tenant uuid,p_actor uuid,p_user uuid,p_codes text[])
returns void language plpgsql set search_path=public as $$
declare permitted text[];
begin
  select array_agg(p."Code") into permitted from "Permissions" p
  where p."TenantId"=p_tenant and not p."IsDeleted" and (p."Code" like 'performance.eval.%' or p."Code" in
    ('performance.reports.organization','performance.reports.approve','performance.reports.download','performance.settings.manage','performance.analytics.export','performance.access.manage'));
  if p_user=p_actor or not coalesce(p_codes <@ permitted,false) then raise exception 'performance_grant_invalid'; end if;
  if not exists(select 1 from "Users" where "TenantId"=p_tenant and "Id"=p_user and not "IsDeleted") then raise exception 'performance_grant_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  delete from "UserPermissions" g using "Permissions" p where g."TenantId"=p_tenant and g."UserId"=p_user
    and p."TenantId"=p_tenant and p."Id"=g."PermissionId" and p."Code"=any(permitted) and not p."Code"=any(p_codes);
  update "UserPermissions" g set "IsDeleted"=false,"DeletedAt"=null,"UpdatedAt"=now() from "Permissions" p
    where g."TenantId"=p_tenant and g."UserId"=p_user and g."IsDeleted" and p."TenantId"=p_tenant and p."Id"=g."PermissionId" and p."Code"=any(p_codes);
  insert into "UserPermissions"("Id","TenantId","CreatedByUserId","CreatedAt","IsDeleted","UserId","PermissionId")
    select gen_random_uuid(),p_tenant,p_actor,now(),false,p_user,p."Id" from "Permissions" p
    where p."TenantId"=p_tenant and not p."IsDeleted" and p."Code"=any(p_codes)
      and not exists(select 1 from "UserPermissions" g where g."UserId"=p_user and g."PermissionId"=p."Id" and not g."IsDeleted");
end;
$$;

create function public.performance_eval_has(p_tenant uuid,p_actor uuid,p_code text) returns boolean language sql stable set search_path=public as $$
  select exists(select 1 from "UserPermissions" g join "Permissions" p on p."Id"=g."PermissionId" and p."TenantId"=g."TenantId"
  where g."TenantId"=p_tenant and g."UserId"=p_actor and p."Code"=p_code and not g."IsDeleted" and not p."IsDeleted");
$$;
create function public.performance_eval_score(items jsonb, entries jsonb, mode text, complete boolean)
returns numeric language plpgsql immutable set search_path=public as $$
declare indicator jsonb; score jsonb; key text; weight numeric; numerator numeric:=0; divisor numeric:=0; missing_amount integer:=0;
begin
  for indicator in select value from jsonb_array_elements(items) loop
    key:=indicator->>'id'; weight:=(indicator->>'weight')::numeric;score:=entries->key;
    if coalesce((score->>'na')::boolean,false) then
      if mode<>'redistribute' or not coalesce((indicator->>'allowNA')::boolean,false) or nullif(trim(score->>'note'),'') is null then
        raise exception 'eval_na';
      end if;
    elsif score->>'value' is null then missing_amount:=missing_amount+1;
    else
      if (score->>'value')::numeric not between 0 and 100 then raise exception 'eval_score'; end if;
      numerator:=numerator+weight*(score->>'value')::numeric;divisor:=divisor+weight;
    end if;
  end loop;
  if missing_amount>0 or divisor=0 then
    if complete then raise exception 'eval_incomplete'; end if;
    return null;
  end if;
  return round(numerator/divisor,2);
end;
$$;

create function public.performance_periodic_mutate(p_tenant uuid,p_actor uuid,p_id uuid,p_action text,p_data jsonb)
returns uuid language plpgsql set search_path=public as $$
declare
 e "PerformanceEvaluations"%rowtype;
 a "PerformanceAppeals"%rowtype;
 plan_row performance_improvement_actions%rowtype;
 eval_id uuid:=p_id; employee uuid; key text; actor_can_write boolean; owner_view boolean;
 config jsonb; current_period jsonb; snapshot jsonb; prior jsonb; entries jsonb; item jsonb; entry jsonb;
 final_score numeric; phase text; reason text:=nullif(trim(p_data->>'note'),''); indicator_key text;
 request_id uuid; plan_id uuid; recipient uuid; notice text; notify_role text; notify_path text;
 current_day date:=(now() at time zone 'Asia/Tehran')::date; since_day date; deadline date; elapsed integer;
 audit_payload jsonb:='{}'; upload_limit jsonb;
begin
 config:=coalesce(performance_policy_at(p_tenant,current_day)->'evaluation','{}');
 if p_action='create' then
   employee:=(p_data->>'employee')::uuid;key:=p_data->'period'->>'id';
   if employee=p_actor or not performance_eval_has(p_tenant,p_actor,'performance.eval.write') or not exists(
     select 1 from performance_direct_reports(p_tenant,p_actor) d where d.id=employee) then raise exception 'eval_access'; end if;
   if not coalesce((config->>'enabled')::boolean,true) then raise exception 'eval_locked'; end if;
   select value into current_period from jsonb_array_elements(coalesce(performance_policy_at(p_tenant,current_day)->'periods','[]')) where value->>'id'=key;
   if current_period is null or current_period->>'status'<>'open' then raise exception 'eval_locked'; end if;
   if (select coalesce(sum((x->>'weight')::numeric),0) from jsonb_array_elements(p_data->'template'->'items') x)<>100 then raise exception 'eval_weights'; end if;
   select "Id" into eval_id from "PerformanceEvaluations" where "TenantId"=p_tenant and "UserId"=employee and "EvaluationPeriodKey"=key and not "IsDeleted";
   if eval_id is not null then return eval_id; end if;
   snapshot:=p_data- 'employee';
   insert into "PerformanceEvaluations"("TenantId","UserId","PeriodYear","PeriodMonth","ReviewerUserId","CreatedByUserId","EvaluationPeriodKey","EvaluationState","EvaluationData")
   values(p_tenant,employee,extract(year from (current_period->>'from')::date),extract(month from (current_period->>'from')::date),p_actor,p_actor,key,'draft',snapshot)
   on conflict ("TenantId","UserId","EvaluationPeriodKey") where not "IsDeleted" and "EvaluationPeriodKey" is not null do nothing returning "Id" into eval_id;
   if eval_id is null then
     select "Id" into eval_id from "PerformanceEvaluations" where "TenantId"=p_tenant and "UserId"=employee and "EvaluationPeriodKey"=key and not "IsDeleted";
     return eval_id;
   end if;
   audit_payload:=jsonb_build_object('template',snapshot->'template','period',snapshot->'period');
   recipient:=p_actor;notice:='پیش‌نویس ارزیابی دوره‌ای ایجاد شد';
 else
   select * into e from "PerformanceEvaluations" where "Id"=p_id and "TenantId"=p_tenant and "EvaluationPeriodKey" is not null and not "IsDeleted" for update;
   if not found then raise exception 'eval_access'; end if;
   employee:=e."UserId";key:=e."EvaluationPeriodKey";prior:=e."EvaluationData";phase:=e."EvaluationState";
   actor_can_write:=employee<>p_actor and performance_eval_has(p_tenant,p_actor,'performance.eval.write') and
     exists(select 1 from performance_direct_reports(p_tenant,p_actor) d where d.id=employee);
   owner_view:=employee=p_actor and e."EvaluationPublication" is not null;
   select value into current_period from jsonb_array_elements(coalesce(performance_policy_at(p_tenant,current_day)->'periods','[]')) where value->>'id'=key;
   if p_action in ('save','send','approve','return','publish','close','reopen','resolve','comment','appeal') and
     (not coalesce((config->>'enabled')::boolean,true) or current_period->>'status' is distinct from 'open') then raise exception 'eval_locked'; end if;
   if p_action in ('save','send') then
     if not actor_can_write then raise exception 'eval_access'; end if;
     if phase not in ('draft','revision') then raise exception 'eval_locked'; end if;
     if e."EvaluationVersion" is distinct from (p_data->>'version')::integer then raise exception 'eval_conflict'; end if;
     if p_action='send' and phase='draft' then
       deadline:=coalesce((current_period->>'managerDue')::date,(current_period->>'to')::date+coalesce((prior->'rules'->>'managerDays')::integer,7));
       if current_day>deadline then raise exception 'eval_deadline'; end if;
     end if;
     entries:=coalesce(p_data->'scores','{}');
     for item in select value from jsonb_array_elements(prior->'template'->'items') loop
       entry:=entries->(item->>'id');
       if coalesce((entry->>'adjusted')::boolean,false) and not performance_eval_has(p_tenant,p_actor,'performance.eval.adjust') then raise exception 'eval_access'; end if;
       if p_action='send' and (entry->>'value' is not null or coalesce((entry->>'na')::boolean,false)) then
         if (coalesce((prior->'rules'->>'qualityNotes')::boolean,true) and item->>'kind'='qualitative'
          or coalesce((entry->>'na')::boolean,false)) and nullif(trim(entry->>'note'),'') is null then raise exception 'eval_reason'; end if;
         if (coalesce((item->>'evidenceRequired')::boolean,false) or (item->>'kind'='qualitative'
          and coalesce((prior->'rules'->>'qualityNotes')::boolean,true) and nullif(trim(entry->>'sample'),'') is null))
          and not coalesce((entry->>'na')::boolean,false)
          and not exists(select 1 from performance_evaluation_evidence f where f.evaluation_id=p_id and f.appeal_id is null and f.plan_id is null and f.indicator_key=item->>'id')
          and not exists(select 1 from jsonb_array_elements(coalesce(p_data->'files','[]')) f where f->>'indicator'=item->>'id')
          then raise exception 'eval_evidence'; end if;
       end if;
     end loop;
     final_score:=performance_eval_score(prior->'template'->'items',entries,coalesce(prior->'rules'->>'missingMode','block'),p_action='send');
     phase:=case when p_action='save' then phase when coalesce((prior->'rules'->>'requireFinal')::boolean,true) then 'pending' else 'finalized' end;
     snapshot:=prior||jsonb_build_object('scores',entries,'feedback',p_data->'feedback','metrics',coalesce(p_data->'metrics',prior->'metrics'));
     update "PerformanceEvaluations" set "EvaluationData"=snapshot,"EvaluationState"=phase,"ReviewerUserId"=p_actor,"FinalScore"=final_score,
       "FinalizedAt"=case when phase='finalized' then now() else null end,"FinalizedByUserId"=case when phase='finalized' then p_actor else null end
       where "Id"=p_id;
     audit_payload:=jsonb_build_object('before',prior->'scores','after',entries,'feedbackBefore',prior->'feedback','feedbackAfter',snapshot->'feedback','score',final_score);
     if p_action='send' then
       notify_role:=case when phase='pending' then 'performance.eval.approve' else 'performance.eval.publish' end;
       notice:=case when phase='pending' then 'ارزیابی دوره‌ای برای نهایی‌سازی ارسال شد' else 'ارزیابی دوره‌ای آماده انتشار است' end;
     end if;
   elsif p_action in ('approve','return','publish','reopen','close') then
     if employee=p_actor or not performance_eval_has(p_tenant,p_actor,case p_action when 'publish' then 'performance.eval.publish'
       when 'reopen' then 'performance.eval.reopen' when 'close' then 'performance.eval.publish' else 'performance.eval.approve' end) then raise exception 'eval_access'; end if;
     if p_action in ('return','approve') and phase<>'pending' or p_action='publish' and phase<>'finalized'
       or p_action='close' and phase<>'published' or p_action='reopen' and phase not in ('finalized','published','closed') then raise exception 'eval_locked'; end if;
     if p_action in ('return','reopen') and reason is null then raise exception 'eval_reason'; end if;
     since_day:=(e."EvaluationPublishedAt" at time zone 'Asia/Tehran')::date;
     if p_action='close' and coalesce((prior->'rules'->>'allowAppeal')::boolean,true) and current_day-since_day<=92 then
       select count(*) into elapsed from performance_reporting_days(p_tenant,array[employee],since_day+1,current_day-1) where exemption is null;
       if elapsed<coalesce((prior->'rules'->>'appealDays')::integer,5) then raise exception 'eval_locked'; end if;
     end if;
     if p_action='close' and (current_day<=coalesce((current_period->>'employeeDue')::date,(e."EvaluationPublishedAt" at time zone 'Asia/Tehran')::date+
       coalesce((prior->'rules'->>'commentDays')::integer,7)) or exists(select 1 from "PerformanceAppeals" x where x."EvaluationId"=p_id and x."Status"<2 and not x."IsDeleted"))
       then raise exception 'eval_locked'; end if;
     audit_payload:=jsonb_build_object('note',reason,'previous',phase,'score',e."FinalScore",
       'publication',case when p_action in ('reopen','publish') then e."EvaluationPublication" else null end);
     if p_action='publish' then
       select prior||jsonb_build_object('score',e."FinalScore",'publishedAt',now(),'files',coalesce(jsonb_agg(to_jsonb(f)-'content_base64'),'[]'))
       into snapshot from performance_evaluation_evidence f where f.evaluation_id=p_id and f.appeal_id is null and f.plan_id is null;
       update "PerformanceEvaluations" set "EvaluationPublication"=snapshot,"EvaluationPublishedAt"=now(),"EvaluationSeenAt"=null,
         "EvaluationEmployeeNote"=null,"EvaluationState"='published' where "Id"=p_id;
       recipient:=employee;notice:='نتیجه ارزیابی عملکرد منتشر شد';
     elsif p_action='approve' then
       update "PerformanceEvaluations" set "EvaluationState"='finalized',"FinalizedAt"=now(),"FinalizedByUserId"=p_actor where "Id"=p_id;
       notify_role:='performance.eval.publish';notice:='ارزیابی دوره‌ای نهایی شد';
     elsif p_action='close' then
       update "PerformanceEvaluations" set "EvaluationState"='closed' where "Id"=p_id;
     else
       update "PerformanceEvaluations" set "EvaluationState"='revision',"FinalizedAt"=null,"FinalizedByUserId"=null where "Id"=p_id;
       select u."Id" into recipient from "Users" u cross join lateral performance_direct_reports(p_tenant,u."Id") d
         where u."TenantId"=p_tenant and d.id=employee limit 1;
       notice:='ارزیابی برای اصلاح باز شد';
     end if;
   elsif p_action in ('seen','comment','appeal') then
     if not owner_view then raise exception 'eval_access'; end if;
     if p_action='seen' then
       update "PerformanceEvaluations" set "EvaluationSeenAt"=now() where "Id"=p_id and "EvaluationSeenAt" is null;
       return p_id;
     end if;
     if phase<>'published' then raise exception 'eval_locked'; end if;
     if reason is null then raise exception 'eval_reason'; end if;
     since_day:=(e."EvaluationPublishedAt" at time zone 'Asia/Tehran')::date;
     if p_action='comment' then
       deadline:=coalesce((current_period->>'employeeDue')::date,since_day+coalesce((prior->'rules'->>'commentDays')::integer,7));
       if current_day>deadline then raise exception 'eval_deadline'; end if;
       audit_payload:=jsonb_build_object('note',reason,'before',e."EvaluationEmployeeNote");
       update "PerformanceEvaluations" set "EvaluationEmployeeNote"=reason where "Id"=p_id;
     else
       if not coalesce((prior->'rules'->>'allowAppeal')::boolean,true) then raise exception 'eval_locked'; end if;
       if current_day-since_day>92 then raise exception 'eval_deadline'; end if;
       select count(*) into elapsed from performance_reporting_days(p_tenant,array[employee],since_day+1,current_day-1) where exemption is null;
       if elapsed>=coalesce((prior->'rules'->>'appealDays')::integer,5) then raise exception 'eval_deadline'; end if;
       indicator_key:=nullif(p_data->>'indicator','');
       if indicator_key is not null and not exists(select 1 from jsonb_array_elements(prior->'template'->'items') i where i->>'id'=indicator_key) then raise exception 'eval_reason'; end if;
       if exists(select 1 from "PerformanceAppeals" x where x."EvaluationId"=p_id and x."Status"<2 and not x."IsDeleted") then raise exception 'eval_appeal_exists'; end if;
       insert into "PerformanceAppeals"("TenantId","EvaluationId","RaisedByUserId","Reason","CreatedByUserId","PeriodicIndicatorKey","PeriodicExplanation")
       values(p_tenant,p_id,p_actor,reason,p_actor,indicator_key,p_data->>'explanation') returning "Id" into request_id;
       notify_role:='performance.eval.appeals';notice:='درخواست بازبینی ارزیابی ثبت شد';audit_payload:=jsonb_build_object('appeal',request_id);
     end if;
   elsif p_action='resolve' then
     if employee=p_actor or not performance_eval_has(p_tenant,p_actor,'performance.eval.appeals') then raise exception 'eval_access'; end if;
     select * into a from "PerformanceAppeals" where "Id"=(p_data->>'appealId')::uuid and "EvaluationId"=p_id
       and "TenantId"=p_tenant and "Status"<2 and not "IsDeleted" and "PeriodicExplanation" is not null for update;
     if not found then raise exception 'eval_access'; end if;
     if reason is null then raise exception 'eval_reason'; end if;
     if phase<>'published' then raise exception 'eval_locked'; end if;
     if p_data->>'decision'='accepted' then
       update "PerformanceEvaluations" set "EvaluationState"='revision',"FinalizedAt"=null,"FinalizedByUserId"=null where "Id"=p_id;
       select u."Id" into recipient from "Users" u cross join lateral performance_direct_reports(p_tenant,u."Id") d
       where u."TenantId"=p_tenant and d.id=employee limit 1;
       if recipient is not null and recipient<>employee and coalesce((config->>'notifications')::boolean,true) then
         insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType","ActorUserId","CreatedAt","IsDeleted")
         values(gen_random_uuid(),p_tenant,recipient,'بازبینی پذیرفته شد','ارزیابی برای اصلاح در کارتابل مدیر قرار گرفت.',9,false,
         '/performance/evaluations?evaluation='||p_id,p_id,'PeriodicEvaluation',p_actor,now(),false);
       end if;
     end if;
     update "PerformanceAppeals" set "Status"=2,"ReviewerResponse"=reason,"ResolvedByUserId"=p_actor,"ResolvedAt"=now(),
       "PeriodicDecision"=p_data->>'decision',"UpdatedAt"=now() where "Id"=a."Id";
     recipient:=employee;notice:='نتیجه بازبینی ارزیابی ثبت شد';
     audit_payload:=jsonb_build_object('appeal',a."Id",'note',reason,'decision',p_data->>'decision','previousScore',e."EvaluationPublication"->'score');
   elsif p_action in ('plan','plan_progress','plan_review') then
     if p_action='plan' then
       if not actor_can_write then raise exception 'eval_access'; end if;
       insert into performance_improvement_actions(evaluation_id,created_by,plan) values(p_id,p_actor,p_data->'plan') returning id into plan_id;
       if e."EvaluationPublication" is not null then recipient:=employee;notice:='هدف بهبود عملکرد ثبت شد'; end if;
     else
       select * into plan_row from performance_improvement_actions where id=(p_data->>'planId')::uuid and evaluation_id=p_id for update;
       if not found then raise exception 'eval_access'; end if;
       plan_id:=plan_row.id;
       if plan_row.state in ('achieved','cancelled') then raise exception 'eval_locked'; end if;
       if p_action='plan_progress' then
         if not owner_view then raise exception 'eval_access'; end if;
         if plan_row.state='review' then raise exception 'eval_locked'; end if;
         if p_data->>'state'='review' and (p_data->>'progress')::integer<>100 then raise exception 'eval_incomplete'; end if;
         update performance_improvement_actions set state=p_data->>'state',progress=(p_data->>'progress')::integer,
           employee_note=reason,updated_at=now() where id=plan_id;
       else
         if not actor_can_write then raise exception 'eval_access'; end if;
         if reason is null then raise exception 'eval_reason'; end if;
         if plan_row.state<>'review' and p_data->>'state'<>'cancelled' then raise exception 'eval_locked'; end if;
         update performance_improvement_actions set state=p_data->>'state',manager_note=reason,
           progress=case when p_data->>'state'='achieved' then 100 else progress end,updated_at=now() where id=plan_id;
       end if;
     end if;
     audit_payload:=jsonb_build_object('plan',plan_id,'note',reason,'before',to_jsonb(plan_row),'after',p_data-'files');
   else raise exception 'eval_access';
   end if;
   upload_limit:=performance_policy_at(p_tenant,current_day)->'files';
   if jsonb_array_length(coalesce(p_data->'files','[]'))>coalesce((upload_limit->>'maxCount')::integer,5) then raise exception 'eval_evidence'; end if;
   insert into performance_evaluation_evidence(evaluation_id,appeal_id,plan_id,indicator_key,uploaded_by,name,mime_type,size_bytes,content_base64)
   select p_id,request_id,plan_id,coalesce(indicator,indicator_key),p_actor,name,mime,bytes,content
   from jsonb_to_recordset(coalesce(p_data->'files','[]')) f(indicator text,name text,mime text,bytes integer,content text);
   update "PerformanceEvaluations" set "EvaluationVersion"="EvaluationVersion"+1,"UpdatedAt"=now() where "Id"=p_id;
 end if;
 insert into "PerformanceAuditLogs"("TenantId","EvaluationId","ActorUserId","Action","DetailsJson","CreatedByUserId")
 values(p_tenant,eval_id,p_actor,'Periodic:'||p_action,audit_payload::text,p_actor);
 if coalesce((config->>'notifications')::boolean,true) and notice is not null then
   notify_path:=case when recipient=employee then '/performance/reports?evaluation=' else '/performance/evaluations?evaluation=' end;
   if recipient is not null then
     insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType","ActorUserId","CreatedAt","IsDeleted")
     values(gen_random_uuid(),p_tenant,recipient,notice,'برای جزئیات، ارزیابی دوره‌ای را باز کنید.',9,false,notify_path||eval_id,eval_id,'PeriodicEvaluation',p_actor,now(),false);
   elsif notify_role is not null then
     insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType","ActorUserId","CreatedAt","IsDeleted")
     select gen_random_uuid(),p_tenant,u."Id",notice,'برای اقدام، ارزیابی دوره‌ای را باز کنید.',9,false,
       '/performance/evaluations?evaluation='||eval_id,eval_id,'PeriodicEvaluation',p_actor,now(),false from "Users" u
     where u."TenantId"=p_tenant and u."Id"<>employee and u."IsActive" and not u."IsDeleted" and performance_eval_has(p_tenant,u."Id",notify_role);
   end if;
 end if;
 return eval_id;
end;
$$;
revoke all on function public.performance_periodic_mutate(uuid,uuid,uuid,text,jsonb),public.performance_eval_has(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.performance_periodic_mutate(uuid,uuid,uuid,text,jsonb),public.performance_eval_has(uuid,uuid,text) to service_role;

create function public.performance_periodic_remind()
returns void language sql set search_path=public as $$
  with clock as (
    select (now() at time zone 'Asia/Tehran')::date as day
  ), cfg as (
    select t."Id" as tenant, c.day, performance_policy_at(t."Id",c.day) as policy from "Tenants" t cross join clock c
  ), periods as (
    select c.*, p.value as period from cfg c cross join lateral jsonb_array_elements(coalesce(c.policy->'periods','[]')) p
    where p.value->>'status'='open' and (p.value->>'from')::date<=c.day
      and coalesce((c.policy->'evaluation'->>'enabled')::boolean,true)
      and coalesce((c.policy->'evaluation'->>'reminders')::boolean,true)
      and coalesce((c.policy->'evaluation'->>'notifications')::boolean,true)
  ), manager_periods as (
    select c.*,u."Id" as manager,coalesce((period->>'managerDue')::date,
      (period->>'to')::date+coalesce((policy->'evaluation'->>'managerDays')::integer,7)) as due
    from periods c join "Users" u on u."TenantId"=c.tenant and u."IsActive" and not u."IsDeleted"
    where performance_eval_has(c.tenant,u."Id",'performance.eval.write')
      and exists(select 1 from performance_direct_reports(c.tenant,u."Id") d
        where not exists(select 1 from "PerformanceEvaluations" e where e."TenantId"=c.tenant and e."UserId"=d.id
          and e."EvaluationPeriodKey"=c.period->>'id' and not e."IsDeleted" and e."EvaluationState" not in ('draft','revision')))
  ), events as (
    select tenant,manager as recipient,'open:'||(period->>'id') as event_key,'آغاز دوره ارزیابی' as title,
      period->>'label' as description,'/performance/evaluations?period='||(period->>'id') as url,null::uuid as related
    from manager_periods where day<=due
    union all
    select tenant,manager,'due:'||(period->>'id'),'نزدیک شدن مهلت ارزیابی',period->>'label',
      '/performance/evaluations?period='||(period->>'id'),null::uuid
    from manager_periods where day between due-3 and due
    union all
    select c.tenant,e."UserId",'plan:'||a.id||':'||(a.plan->>'to'),'نزدیک شدن مهلت برنامه بهبود',a.plan->>'title',
      '/performance/reports?tab=improvement&evaluation='||e."Id",e."Id"
    from cfg c join "PerformanceEvaluations" e on e."TenantId"=c.tenant and not e."IsDeleted" and e."EvaluationPublication" is not null
    join "Users" u on u."Id"=e."UserId" and u."IsActive" and not u."IsDeleted"
    join performance_improvement_actions a on a.evaluation_id=e."Id" and a.state in ('planned','active','followup')
    where (a.plan->>'to')::date between c.day and c.day+3
      and coalesce((c.policy->'evaluation'->>'enabled')::boolean,true)
      and coalesce((c.policy->'evaluation'->>'reminders')::boolean,true)
      and coalesce((c.policy->'evaluation'->>'notifications')::boolean,true)
  ), queued as (
    insert into performance_periodic_reminders(tenant_id,user_id,event_key)
    select tenant,recipient,event_key from events on conflict do nothing returning *
  )
  insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType","CreatedAt","IsDeleted")
  select gen_random_uuid(),e.tenant,e.recipient,e.title,e.description,9,false,e.url,e.related,'PeriodicEvaluation',now(),false
  from events e join queued q on q.tenant_id=e.tenant and q.user_id=e.recipient and q.event_key=e.event_key;
$$;
revoke all on function public.performance_periodic_remind() from public,anon,authenticated;
select cron.schedule('portal-performance-periodic-reminders','15 5 * * *','select public.performance_periodic_remind();');

create or replace function public.performance_send_report_reminders() returns bigint language sql set search_path=public as $$
  with now_local as (select (now() at time zone 'Asia/Tehran')::date as dt), teams as (
    select "TenantId" as tenant,array_agg("Id") as ids from "Users" where "IsActive" and not "IsDeleted" group by "TenantId"
  ), claims as (
    insert into performance_daily_reminders
    select t.tenant,d.employee_id,d.work_date from teams t cross join now_local n
    cross join lateral performance_reporting_days(t.tenant,t.ids,n.dt-1,n.dt) d
    left join performance_daily_reports r on r.tenant_id=t.tenant and r.employee_id=d.employee_id and r.work_date=d.work_date
    where d.required and now()>d.deadline and r.submitted_at is null
      and coalesce((performance_policy_at(t.tenant,n.dt)->>'dailyReminders')::boolean,true)
    on conflict do nothing returning *
  ), sent as (
    insert into "Notifications"("Id","TenantId","UserId","Title","Body","Type","IsRead","ActionUrl","RelatedEntityId","RelatedEntityType","CreatedAt","IsDeleted")
    select gen_random_uuid(),c.tenant_id,c.employee_id,'یادآوری ارسال گزارش روزانه','گزارش '||performance_jalali_key(c.work_date)||' هنوز ارسال نشده است.',3,false,
      '/performance/me?date='||c.work_date,r.id,'PerformanceDailyReport',now(),false
    from claims c left join performance_daily_reports r on r.tenant_id=c.tenant_id and r.employee_id=c.employee_id and r.work_date=c.work_date returning 1
  ) select count(*) from sent;
$$;
