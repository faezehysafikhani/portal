-- Employment start date drives monthly leave accrual (20h/month) independently
-- of Users.CreatedAt (system-account creation date, not real hire date) and of
-- the self-submitted "personnel" form's startDate (not everyone has one).
-- leaveAccount() in collaboration.ts prefers this field when present.

alter table if exists public."Users"
  add column if not exists "EmploymentStartDate" text null;

update public."Users" set "EmploymentStartDate" = '1405/02/01'
where "Id" in (
  '00000000-0000-0000-0000-000000000001', -- مدیر سیستم
  '36654656-1bf3-471d-8e29-e8764ae9dc62', -- طاها آقاجانی
  '72e531fe-f6aa-42f3-9f6e-a672055b6337'  -- یاسمین دقیق
) and "TenantId" = '00000000-0000-0000-0000-000000000001';

update public."Users" set "EmploymentStartDate" = '1405/03/01'
where "Id" in (
  '37513ede-7955-45c0-9777-ee550805d3c8', -- فاطمه فولادی‌نژاد
  'ffb944f1-9cb4-4ea3-b1c7-170682fedf34'  -- عرفان اختیاری
) and "TenantId" = '00000000-0000-0000-0000-000000000001';

update public."Users" set "EmploymentStartDate" = '1405/05/01'
where "Id" = '03a1fa37-bf9e-424e-b6be-c3547ec5189f' -- محمدمهدی رحیم‌زاده
  and "TenantId" = '00000000-0000-0000-0000-000000000001';

-- Drop the cached leave-account rows for these six so the next read rebuilds
-- AccruedHours/UsedHours/ReservedHours from scratch using the corrected start
-- date (the running total is normally a monotonic max() and would not lower
-- an over-accrued balance on its own — a fresh row avoids that asymmetry).
update public."LeaveAccounts" set "IsDeleted" = true, "DeletedAt" = now(), "UpdatedAt" = now()
where "TenantId" = '00000000-0000-0000-0000-000000000001'
  and "IsDeleted" = false
  and "UserId" in (
    '00000000-0000-0000-0000-000000000001',
    '36654656-1bf3-471d-8e29-e8764ae9dc62',
    '72e531fe-f6aa-42f3-9f6e-a672055b6337',
    '37513ede-7955-45c0-9777-ee550805d3c8',
    'ffb944f1-9cb4-4ea3-b1c7-170682fedf34',
    '03a1fa37-bf9e-424e-b6be-c3547ec5189f'
  );
