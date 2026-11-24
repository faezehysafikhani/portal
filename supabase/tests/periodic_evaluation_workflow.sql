-- Run against a database with the performance migrations inside a rollback transaction.
do $$
declare
  tenant uuid; manager uuid; employee uuid; outsider uuid; admin_id uuid; replacement uuid;
  evaluation uuid; second uuid; appeal uuid; plan_key uuid;
  current_day date := (now() at time zone 'Asia/Tehran')::date;
  period jsonb := jsonb_build_object('id','workflow-test','status','open','label','دوره آزمایش','kind','month','from',current_day-15,'to',current_day,'managerDue',current_day+15);
  next_period jsonb := period||jsonb_build_object('id','workflow-test-next','from',current_day+1,'to',current_day+30);
  indicators jsonb := '[{"id":"quality","weight":35,"kind":"qualitative","allowNA":true,"evidenceRequired":true},{"id":"ontime","weight":25,"kind":"quantitative"},{"id":"goals","weight":25,"kind":"quantitative"},{"id":"ownership","weight":15,"kind":"qualitative"}]';
  scores jsonb := '{"quality":{"value":90,"note":"Quality observed","sample":"Output sample"},"ontime":{"value":80},"goals":{"value":95},"ownership":{"value":90,"note":"Ownership observed","sample":"Delivery sample"}}';
  send_payload jsonb; policy jsonb;
begin
  select u."TenantId",u."Id",d.id into tenant,manager,employee from "Users" u
  cross join lateral performance_direct_reports(u."TenantId",u."Id") d
  where u."IsActive" and not u."IsDeleted" and lower(u."Username")<>'admin' and u."Id"<>d.id limit 1;
  assert employee is not null,'No active direct report fixture';
  select "Id" into admin_id from "Users" where "TenantId"=tenant and lower("Username")='admin' and "Id"<>employee and not "IsDeleted";
  select u."Id" into outsider from "Users" u where u."TenantId"=tenant and u."IsActive" and not u."IsDeleted"
    and u."Id" not in (employee,manager,admin_id)
    and not exists(select 1 from performance_direct_reports(tenant,manager) where id=u."Id") limit 1;
  assert admin_id is not null and outsider is not null;
  policy:=performance_policy_at(tenant,current_day)||jsonb_build_object('periods',jsonb_build_array(period,next_period),
    'evaluation','{"enabled":true,"notifications":true,"reminders":true}'::jsonb);
  insert into performance_policy_versions(tenant_id,effective_date,policy,created_by) values(tenant,current_day,policy,admin_id);
  perform performance_periodic_remind();
  perform performance_periodic_remind();
  assert (select count(*)=1 from performance_periodic_reminders
    where tenant_id=tenant and user_id=manager and event_key='open:workflow-test');

  assert performance_eval_score(indicators,scores,'block',true)=88.75;
  assert performance_eval_score(indicators,scores-'ontime','block',false) is null;
  assert performance_eval_score(indicators,scores||'{"quality":{"na":true,"note":"Not applicable"}}','redistribute',true)=88.08;
  begin
    perform performance_periodic_mutate(tenant,manager,null,'create',jsonb_build_object('employee',manager,'period',period));
    raise exception 'self-evaluation accepted';
  exception when raise_exception then if sqlerrm<>'eval_access' then raise; end if;
  end;
  begin
    perform performance_periodic_mutate(tenant,manager,null,'create',jsonb_build_object('employee',outsider,'period',period));
    raise exception 'out-of-scope evaluation accepted';
  exception when raise_exception then if sqlerrm<>'eval_access' then raise; end if;
  end;
  evaluation:=performance_periodic_mutate(tenant,manager,null,'create',jsonb_build_object('employee',employee,'period',period,
    'template',jsonb_build_object('id','snapshot-a','items',indicators),'rules','{"requireFinal":true,"qualityNotes":true}'::jsonb));
  assert evaluation=performance_periodic_mutate(tenant,manager,null,'create',jsonb_build_object('employee',employee,'period',period,'template',jsonb_build_object('items',indicators)));
  assert (select "EvaluationPublication" is null from "PerformanceEvaluations" where "Id"=evaluation);
  begin
    perform performance_periodic_mutate(tenant,employee,evaluation,'seen','{}');
    raise exception 'employee saw an unpublished evaluation';
  exception when raise_exception then if sqlerrm<>'eval_access' then raise; end if;
  end;
  begin
    perform performance_periodic_mutate(tenant,manager,evaluation,'send',jsonb_build_object('scores',scores,'version',0));
    raise exception 'submission without mandatory evidence accepted';
  exception when raise_exception then if sqlerrm<>'eval_evidence' then raise; end if;
  end;
  send_payload:=jsonb_build_object('scores',scores,'version',0,'feedback','{"strengths":"Output quality"}'::jsonb,'metrics','{"minutes":120}'::jsonb,
    'files','[{"name":"evidence.txt","mime":"text/plain","bytes":4,"content":"dGVzdA==","indicator":"quality"}]'::jsonb);
  perform performance_periodic_mutate(tenant,manager,evaluation,'send',send_payload);
  assert (select "FinalScore"=88.75 and "EvaluationState"='pending' and "EvaluationData"->'metrics'->>'minutes'='120'
    from "PerformanceEvaluations" where "Id"=evaluation);
  begin
    perform performance_periodic_mutate(tenant,manager,evaluation,'approve','{}');
    raise exception 'unprivileged approval accepted';
  exception when raise_exception then if sqlerrm<>'eval_access' then raise; end if;
  end;
  perform performance_periodic_mutate(tenant,admin_id,evaluation,'approve','{}');
  assert (select "EvaluationPublication" is null from "PerformanceEvaluations" where "Id"=evaluation);
  perform performance_periodic_mutate(tenant,admin_id,evaluation,'publish','{}');
  perform performance_periodic_mutate(tenant,employee,evaluation,'seen','{}');
  perform performance_periodic_mutate(tenant,employee,evaluation,'comment','{"note":"Employee comment"}');
  assert (select "EvaluationSeenAt" is not null and "EvaluationEmployeeNote"='Employee comment'
    and "EvaluationPublication"->>'score'='88.75' and jsonb_array_length("EvaluationPublication"->'files')=1
    and not ("EvaluationPublication"->'files'->0 ? 'content_base64') from "PerformanceEvaluations" where "Id"=evaluation);
  assert not has_table_privilege('authenticated','public.performance_evaluation_evidence','SELECT');
  assert not has_function_privilege('authenticated','public.performance_periodic_mutate(uuid,uuid,uuid,text,jsonb)','EXECUTE');

  perform performance_periodic_mutate(tenant,employee,evaluation,'appeal','{"indicator":"quality","note":"Appeal reason","explanation":"Appeal example"}');
  select "Id" into strict appeal from "PerformanceAppeals" where "EvaluationId"=evaluation and "PeriodicIndicatorKey"='quality';
  perform performance_periodic_mutate(tenant,admin_id,evaluation,'resolve',jsonb_build_object('appealId',appeal,'decision','accepted','note','Correct the score'));
  assert (select "EvaluationPublication"->>'score'='88.75' and "EvaluationState"='revision' from "PerformanceEvaluations" where "Id"=evaluation);
  begin
    perform performance_periodic_mutate(tenant,manager,evaluation,'save',send_payload);
    raise exception 'stale version accepted';
  exception when raise_exception then if sqlerrm<>'eval_conflict' then raise; end if;
  end;
  replacement:=outsider;
  update "Users" set "DirectManager"=(select "Username" from "Users" where "Id"=replacement) where "Id"=employee;
  perform performance_set_grants(tenant,admin_id,replacement,array['performance.eval.view','performance.eval.write']);
  assert exists(select 1 from performance_direct_reports(tenant,replacement) where id=employee);
  begin
    perform performance_periodic_mutate(tenant,manager,evaluation,'save',send_payload);
    raise exception 'former manager retained write access';
  exception when raise_exception then if sqlerrm<>'eval_access' then raise; end if;
  end;
  send_payload:=(send_payload-'files')||jsonb_build_object('version',(select "EvaluationVersion" from "PerformanceEvaluations" where "Id"=evaluation),
    'scores',jsonb_set(scores,'{quality,value}','100'));
  perform performance_periodic_mutate(tenant,replacement,evaluation,'send',send_payload);
  perform performance_periodic_mutate(tenant,admin_id,evaluation,'approve','{}');
  perform performance_periodic_mutate(tenant,admin_id,evaluation,'publish','{}');
  assert (select "FinalScore"=92.25 and "ReviewerUserId"=replacement from "PerformanceEvaluations" where "Id"=evaluation);
  assert exists(select 1 from "PerformanceAuditLogs" where "EvaluationId"=evaluation and "Action"='Periodic:publish'
    and ("DetailsJson"::jsonb->'publication'->>'score')::numeric=88.75);
  perform performance_periodic_mutate(tenant,replacement,evaluation,'plan',jsonb_build_object('plan',
    jsonb_build_object('title','Improve documentation','from',current_day,'to',current_day+2)));
  select id into strict plan_key from performance_improvement_actions where evaluation_id=evaluation;
  perform performance_periodic_mutate(tenant,employee,evaluation,'plan_progress',jsonb_build_object('planId',plan_key,'state','review','progress',100,'note','Delivered'));
  perform performance_periodic_mutate(tenant,replacement,evaluation,'plan_review',jsonb_build_object('planId',plan_key,'state','achieved','note','Verified'));
  assert (select state='achieved' and progress=100 from performance_improvement_actions where id=plan_key);
  second:=performance_periodic_mutate(tenant,replacement,null,'create',jsonb_build_object('employee',employee,'period',next_period,
    'template',jsonb_build_object('id','snapshot-b','items',indicators),'rules','{}'::jsonb));
  assert second<>evaluation;
  assert (select "EvaluationPublication"->'template'->>'id'='snapshot-a' from "PerformanceEvaluations" where "Id"=evaluation);
end;
$$;
select 'periodic evaluation workflow passed' as result;
