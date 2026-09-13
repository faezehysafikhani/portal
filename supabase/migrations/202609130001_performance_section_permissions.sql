-- Granular per-page permissions for the Performance Evaluation module, so an
-- admin can grant access to a single page (e.g. just گزارش هفتگی) without
-- unlocking the whole module via performance.view. performance.view and
-- performance.admin keep working exactly as before as "grants everything"
-- shortcuts — this only adds narrower alternatives, nothing is removed.

with permission_seed(code, name, module) as (
  values
    ('performance.dashboard','مشاهده داشبورد ارزیابی عملکرد','performance'),
    ('performance.weekly','مشاهده گزارش هفتگی','performance'),
    ('performance.evaluations','مشاهده و اعتراض به ارزیابی ماهانه','performance'),
    ('performance.timesheet','ثبت تایم‌شیت روزانه','performance'),
    ('performance.quarterly','مشاهده ارزیابی فصلی HR','performance')
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
