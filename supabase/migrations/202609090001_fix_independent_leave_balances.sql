-- Correct Erfan Ekhtiari's employment start month (Ordibehesht 1405), then
-- rebuild only his cached leave totals from his own approved/pending forms.
-- The API now performs the same deterministic per-user reconciliation on
-- every balance read, so repairing one employee can never affect another.

update public."Users"
set "EmploymentStartDate" = '1405/02/01',
    "UpdatedAt" = now()
where "TenantId" = '00000000-0000-0000-0000-000000000001'
  and "Id" = 'ffb944f1-9cb4-4ea3-b1c7-170682fedf34';

with usage as (
  select
    coalesce(sum(f."RequestedHours") filter (
      where f."Status" in ('approved', 'completed')
        and (
          f."FormType" = 'leave_hourly'
          or (
            f."FormType" = 'leave_daily'
            and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی'
          )
        )
    ), 0) as used_hours,
    coalesce(sum(f."RequestedHours") filter (
      where f."Status" in ('manager_pending', 'hr_pending')
        and (
          f."FormType" = 'leave_hourly'
          or (
            f."FormType" = 'leave_daily'
            and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی'
          )
        )
    ), 0) as reserved_hours
  from public."OrganizationalForms" f
  where f."TenantId" = '00000000-0000-0000-0000-000000000001'
    and f."SubmitterUserId" = 'ffb944f1-9cb4-4ea3-b1c7-170682fedf34'
    and f."IsDeleted" = false
)
update public."LeaveAccounts" a
set "AccruedHours" = 100, -- Ordibehesht through Shahrivar: 5 × 20h
    "UsedHours" = usage.used_hours,
    "ReservedHours" = usage.reserved_hours,
    "AccruedThroughYearMonth" = 140506,
    "MonthlyAccrualHours" = 20,
    "HoursPerDay" = 8,
    "IsDeleted" = false,
    "DeletedAt" = null,
    "UpdatedAt" = now()
from usage
where a."TenantId" = '00000000-0000-0000-0000-000000000001'
  and a."UserId" = 'ffb944f1-9cb4-4ea3-b1c7-170682fedf34';
