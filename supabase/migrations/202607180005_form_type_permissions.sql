do $$
declare
  tenant_id constant uuid := '00000000-0000-0000-0000-000000000001';
  admin_id constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public."Permissions"
    ("Id", "Code", "Name", "Module", "CreatedAt", "UpdatedAt", "CreatedByUserId", "IsDeleted", "DeletedAt", "TenantId")
  select gen_random_uuid(), item.code, item.name, 'forms', now(), null, admin_id, false, null, tenant_id
  from (values
    ('forms.type.leave_daily','ثبت فرم مرخصی روزانه'),
    ('forms.type.leave_hourly','ثبت فرم مرخصی ساعتی'),
    ('forms.type.mission','ثبت فرم مأموریت'),
    ('forms.type.loan','ثبت فرم وام'),
    ('forms.type.payslip','ثبت فرم فیش حقوقی'),
    ('forms.type.resignation','ثبت فرم استعفا'),
    ('forms.type.equipment','ثبت فرم تحویل تجهیزات'),
    ('forms.type.personnel','ثبت فرم مشخصات پرسنلی')
  ) as item(code,name)
  where not exists (
    select 1 from public."Permissions" permission
    where permission."TenantId"=tenant_id and permission."Code"=item.code
  );
end $$;
