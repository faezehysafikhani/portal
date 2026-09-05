-- 202609050002 soft-deleted these six LeaveAccounts rows so the app would
-- recreate them fresh from the new EmploymentStartDate, but a pre-existing
-- full unique index on LeaveAccounts."UserId" (not filtered by IsDeleted,
-- from the original EF Core schema) blocks any new insert for a UserId that
-- already has a row, soft-deleted or not. Restore them and set the correct
-- values directly instead.

update public."LeaveAccounts"
set "IsDeleted" = false, "DeletedAt" = null, "UpdatedAt" = now()
where "TenantId" = '00000000-0000-0000-0000-000000000001'
  and "UserId" in (
    '00000000-0000-0000-0000-000000000001', -- مدیر سیستم
    '36654656-1bf3-471d-8e29-e8764ae9dc62', -- طاها آقاجانی
    '72e531fe-f6aa-42f3-9f6e-a672055b6337', -- یاسمین دقیق
    '37513ede-7955-45c0-9777-ee550805d3c8', -- فاطمه فولادی‌نژاد
    'ffb944f1-9cb4-4ea3-b1c7-170682fedf34', -- عرفان اختیاری
    '03a1fa37-bf9e-424e-b6be-c3547ec5189f'  -- محمدمهدی رحیم‌زاده
  );

-- AccruedHours below = months from each person's real start month (Jalali
-- 1405) through the current month (شهریور=6) x 20h/month, matching
-- leaveAccount()'s formula. UsedHours/ReservedHours are resummed from real
-- OrganizationalForms history (same rule the app uses: leave_hourly always
-- counts, leave_daily only when leaveType is استحقاقی, leave_sick never).
with targets(user_id, accrued_hours) as (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid, 100), -- ماه ۲: ۵ ماه
    ('36654656-1bf3-471d-8e29-e8764ae9dc62'::uuid, 100),
    ('72e531fe-f6aa-42f3-9f6e-a672055b6337'::uuid, 100),
    ('37513ede-7955-45c0-9777-ee550805d3c8'::uuid, 80),  -- ماه ۳: ۴ ماه
    ('ffb944f1-9cb4-4ea3-b1c7-170682fedf34'::uuid, 80),
    ('03a1fa37-bf9e-424e-b6be-c3547ec5189f'::uuid, 40)   -- ماه ۵: ۲ ماه
), usage as (
  select f."SubmitterUserId" as user_id,
    coalesce(sum(f."RequestedHours") filter (
      where f."Status" in ('approved','completed')
        and (f."FormType" = 'leave_hourly' or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType','استحقاقی') = 'استحقاقی'))
    ), 0) as used_hours,
    coalesce(sum(f."RequestedHours") filter (
      where f."Status" in ('manager_pending','hr_pending')
        and (f."FormType" = 'leave_hourly' or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType','استحقاقی') = 'استحقاقی'))
    ), 0) as reserved_hours
  from public."OrganizationalForms" f
  where f."TenantId" = '00000000-0000-0000-0000-000000000001'
    and f."IsDeleted" = false
    and f."SubmitterUserId" in (select user_id from targets)
  group by f."SubmitterUserId"
)
update public."LeaveAccounts" a
set "AccruedHours" = t.accrued_hours,
    "UsedHours" = coalesce(u.used_hours, 0),
    "ReservedHours" = coalesce(u.reserved_hours, 0),
    "AccruedThroughYearMonth" = 140506,
    "MonthlyAccrualHours" = 20,
    "HoursPerDay" = 8,
    "UpdatedAt" = now()
from targets t
left join usage u on u.user_id = t.user_id
where a."TenantId" = '00000000-0000-0000-0000-000000000001'
  and a."UserId" = t.user_id
  and a."IsDeleted" = false;
