-- Run with the organization chart migration in a rollback transaction.
do $$
declare
  tenant uuid; employee uuid; old_manager uuid; new_manager uuid; outsider uuid;
  task_id uuid:=gen_random_uuid(); report_id uuid; activity_id uuid:=gen_random_uuid();
  root_unit organization_departments; child_unit organization_departments;
  job "OrgPositions";
  work_day date:=(now() at time zone 'Asia/Tehran')::date;
  task_data jsonb;
  before_edge text;
begin
  select u."TenantId",u."Id",d.id into tenant,old_manager,employee from "Users" u
  cross join lateral performance_direct_reports(u."TenantId",u."Id") d
  where u."IsActive" and not u."IsDeleted" limit 1;
  assert employee is not null,'Requires an active manager and employee fixture';
  select id into new_manager from organization_people(tenant)
  where active and id not in (old_manager,employee) and manager_id is distinct from employee order by manager_id nulls first limit 1;
  select id into outsider from organization_people(tenant) where active and id not in (old_manager,employee,new_manager) limit 1;
  assert new_manager is not null and outsider is not null;
  -- Keep this fixture independent of any existing historical report on the production day.
  select work_day-offset_days into work_day from generate_series(0,20) offset_days
  where not exists(select 1 from performance_daily_reports r where r.tenant_id=tenant and r.employee_id=employee and r.work_date=work_day-offset_days)
  order by offset_days limit 1;
  assert work_day is not null;
  insert into performance_policy_versions(tenant_id,effective_date,policy,created_by) values(tenant,work_day,
    performance_policy_at(tenant,work_day)||'{"enabled":true,"allowPast":true,"pastDays":0,"lateDays":0}'::jsonb,old_manager);
  assert (select manager_id=old_manager from organization_people(tenant) where id=employee);
  select "DirectManager" into before_edge from "Users" where "Id"=employee;
  assert before_edge=old_manager::text;
  task_data:=jsonb_build_object('employeeId',employee,'title','Organization route fixture','description','Task without project','priority',1,
    'startsAt',now()-interval '1 day','dueAt',now()+interval '2 days');
  begin
    perform performance_task_mutate(tenant,outsider,false,task_id,'create',task_data);
    raise exception 'Outsider created an assignment';
  exception when raise_exception then if sqlerrm<>'assignment_scope' then raise; end if;
  end;
  perform performance_task_mutate(tenant,old_manager,false,task_id,'create',task_data);
  perform performance_task_mutate(tenant,employee,false,task_id,'submit','{"progress":100,"note":"Delivered"}');
  perform performance_daily_controlled(tenant,employee,'create',work_day,null,null,false,
    jsonb_build_object('id',activity_id,'title','Internal activity','description','No project required','kind','internal','status','done','timeMode','manual','minutes',30,'outcome','','notes','','files','[]'::jsonb));
  report_id:=performance_daily_controlled(tenant,employee,'submit',work_day,null,null,false,'{}');
  assert (select reviewer_id=old_manager and status='submitted' from performance_daily_reports where id=report_id);
  assert (select project_id is null from performance_daily_activities where id=activity_id);

  perform organization_update_user(tenant,old_manager,employee,jsonb_build_object('DirectManager',new_manager));
  assert (select manager_id=new_manager from organization_people(tenant) where id=employee);
  assert not exists(select 1 from performance_direct_reports(tenant,old_manager) where id=employee);
  assert exists(select 1 from performance_direct_reports(tenant,new_manager) where id=employee);
  assert (select reviewer_id=old_manager from performance_daily_reports where id=report_id);
  assert (select "AssignedByUserId"=old_manager from "Tasks" where "Id"=task_id);
  assert exists(select 1 from organization_change_history where tenant_id=tenant and entity_id=employee and actor_id=old_manager
    and before_data->>'manager'=old_manager::text and after_data->>'manager'=new_manager::text);
  assert (select count(*)=2 from "Notifications" where "TenantId"=tenant and "UserId"=new_manager and "RelatedEntityType"='OrganizationTransfer'
    and "ActorUserId"=old_manager and "CreatedAt"=now());
  begin
    perform organization_update_user(tenant,old_manager,new_manager,jsonb_build_object('DirectManager',employee));
    raise exception 'A management cycle was accepted';
  exception when raise_exception then if sqlerrm<>'org_cycle' then raise; end if;
  end;
  begin
    perform organization_update_user(tenant,old_manager,employee,jsonb_build_object('DirectManager',employee));
    raise exception 'Self management was accepted';
  exception when raise_exception then if sqlerrm<>'org_cycle' then raise; end if;
  end;
  begin
    perform performance_task_mutate(tenant,old_manager,false,task_id,'approve','{}');
    raise exception 'Former manager approved a task';
  exception when raise_exception then if sqlerrm<>'assignment_not_found' then raise; end if;
  end;
  begin
    perform performance_daily_controlled(tenant,old_manager,'approve',null,report_id,null,false,'{}');
    raise exception 'Former manager approved a report';
  exception when raise_exception then if sqlerrm<>'daily_not_found' then raise; end if;
  end;
  perform performance_task_mutate(tenant,new_manager,false,task_id,'approve','{}');
  perform performance_daily_controlled(tenant,new_manager,'approve',null,report_id,null,false,'{}');
  assert (select "AssignedByUserId"=old_manager and "CompletionApprovedByUserId"=new_manager from "Tasks" where "Id"=task_id);
  assert (select reviewed_by=new_manager and status='approved' from performance_daily_reports where id=report_id);

  root_unit:=organization_save_department(tenant,old_manager,null,'Org fixture root',null,new_manager,true);
  child_unit:=organization_save_department(tenant,old_manager,null,'Org fixture child',root_unit.id,null,true);
  begin
    perform organization_save_department(tenant,old_manager,root_unit.id,root_unit.name,child_unit.id,null,true);
    raise exception 'A department cycle was accepted';
  exception when raise_exception then if sqlerrm<>'org_cycle' then raise; end if;
  end;
  job:=organization_save_position(tenant,old_manager,null,'{"Title":"Org fixture role"}',false);
  perform organization_update_user(tenant,old_manager,employee,jsonb_build_object('Department',child_unit.name,'Position',job."Title"));
  begin
    perform organization_save_department(tenant,old_manager,child_unit.id,child_unit.name,root_unit.id,null,false);
    raise exception 'An occupied department was disabled';
  exception when raise_exception then if sqlerrm<>'org_dependencies' then raise; end if;
  end;
  begin
    perform organization_save_position(tenant,old_manager,job."Id",'{"IsActive":false}',false);
    raise exception 'An occupied position was disabled';
  exception when raise_exception then if sqlerrm<>'org_dependencies' then raise; end if;
  end;
  perform organization_save_department(tenant,old_manager,child_unit.id,'Org fixture renamed',root_unit.id,null,true);
  assert (select department='Org fixture renamed' from organization_people(tenant) where id=employee);
  assert not has_function_privilege('authenticated','public.organization_update_user(uuid,uuid,uuid,jsonb)','EXECUTE');
  assert not has_table_privilege('authenticated','public.organization_change_history','SELECT');
end;
$$;
select 'organization chart workflow passed' as result;
