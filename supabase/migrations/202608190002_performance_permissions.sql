-- Permission codes for the Performance Evaluation module.
with permission_seed(code, name, module) as (
  values
    ('performance.view','مشاهده و مدیریت کارتابل ارزیابی من','performance'),
    ('performance.manage','بازبینی و تأیید ارزیابی زیرمجموعه','performance'),
    ('performance.admin','مدیریت تنظیمات و ارزیابی عملکرد','performance')
)
insert into public."Permissions"
  ("Id","Code","Name","Module","CreatedAt","UpdatedAt","CreatedByUserId","IsDeleted","DeletedAt","TenantId")
select gen_random_uuid(), seed.code, seed.name, seed.module, now(), null, null, false, null, tenant."Id"
from permission_seed seed
cross join public."Tenants" tenant
where not exists (
  select 1 from public."Permissions" current
  where current."TenantId" = tenant."Id" and current."Code" = seed.code
);
