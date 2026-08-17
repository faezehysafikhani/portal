-- Rebuild leave balances from persisted users and form workflow rows.
-- The Edge API further refines the accrual start from the approved personnel
-- start date when it is available; this migration keeps existing cached rows
-- sane immediately after deployment.

alter table if exists public."LeaveAccounts"
  add column if not exists "MonthlyAccrualHours" numeric(10,2) not null default 20,
  add column if not exists "HoursPerDay" numeric(10,2) not null default 8,
  add column if not exists "ReservedHours" numeric(10,2) not null default 0;

with users_base as (
  select u."Id" as user_id,
         u."TenantId" as tenant_id,
         greatest(
           1,
           (
             (extract(year from age(now(), coalesce(u."CreatedAt", now())))::int * 12)
             + extract(month from age(now(), coalesce(u."CreatedAt", now())))::int
             + 1
           )
         ) as entitled_months
  from public."Users" u
  where u."IsDeleted" = false
), leave_totals as (
  select f."TenantId" as tenant_id,
         f."SubmitterUserId" as user_id,
         coalesce(sum(f."RequestedHours") filter (
           where f."Status" in ('approved', 'completed')
             and (
               f."FormType" = 'leave_hourly'
               or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی')
             )
         ), 0) as used_hours,
         coalesce(sum(f."RequestedHours") filter (
           where f."Status" in ('manager_pending', 'hr_pending')
             and (
               f."FormType" = 'leave_hourly'
               or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی')
             )
         ), 0) as reserved_hours
  from public."OrganizationalForms" f
  where f."IsDeleted" = false
    and f."FormType" in ('leave_daily', 'leave_hourly')
  group by f."TenantId", f."SubmitterUserId"
), source_rows as (
  select gen_random_uuid() as id,
         ub.tenant_id,
         ub.user_id,
         greatest(coalesce(a."AccruedHours", 0), ub.entitled_months * coalesce(a."MonthlyAccrualHours", 20), 20) as accrued_hours,
         coalesce(lt.used_hours, 0) as used_hours,
         coalesce(lt.reserved_hours, 0) as reserved_hours,
         coalesce(a."MonthlyAccrualHours", 20) as monthly_accrual_hours,
         coalesce(a."HoursPerDay", 8) as hours_per_day
  from users_base ub
  left join public."LeaveAccounts" a
    on a."TenantId" = ub.tenant_id and a."UserId" = ub.user_id and a."IsDeleted" = false
  left join leave_totals lt
    on lt.tenant_id = ub.tenant_id and lt.user_id = ub.user_id
)
insert into public."LeaveAccounts" (
  "Id", "TenantId", "UserId", "AccruedThroughYearMonth", "AccruedHours",
  "UsedHours", "ReservedHours", "MonthlyAccrualHours", "HoursPerDay",
  "CreatedAt", "UpdatedAt", "CreatedByUserId", "IsDeleted", "DeletedAt"
)
select id, tenant_id, user_id, null, accrued_hours, used_hours, reserved_hours,
       monthly_accrual_hours, hours_per_day, now(), now(), null, false, null
from source_rows s
where not exists (
  select 1 from public."LeaveAccounts" a
  where a."TenantId" = s.tenant_id
    and a."UserId" = s.user_id
    and a."IsDeleted" = false
);

with users_base as (
  select u."Id" as user_id,
         u."TenantId" as tenant_id,
         greatest(
           1,
           (
             (extract(year from age(now(), coalesce(u."CreatedAt", now())))::int * 12)
             + extract(month from age(now(), coalesce(u."CreatedAt", now())))::int
             + 1
           )
         ) as entitled_months
  from public."Users" u
  where u."IsDeleted" = false
), leave_totals as (
  select f."TenantId" as tenant_id,
         f."SubmitterUserId" as user_id,
         coalesce(sum(f."RequestedHours") filter (
           where f."Status" in ('approved', 'completed')
             and (
               f."FormType" = 'leave_hourly'
               or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی')
             )
         ), 0) as used_hours,
         coalesce(sum(f."RequestedHours") filter (
           where f."Status" in ('manager_pending', 'hr_pending')
             and (
               f."FormType" = 'leave_hourly'
               or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی')
             )
         ), 0) as reserved_hours
  from public."OrganizationalForms" f
  where f."IsDeleted" = false
    and f."FormType" in ('leave_daily', 'leave_hourly')
  group by f."TenantId", f."SubmitterUserId"
)
update public."LeaveAccounts" a
set "AccruedHours" = greatest(coalesce(a."AccruedHours", 0), ub.entitled_months * coalesce(a."MonthlyAccrualHours", 20), 20),
    "UsedHours" = coalesce(lt.used_hours, 0),
    "ReservedHours" = coalesce(lt.reserved_hours, 0),
    "UpdatedAt" = now()
from users_base ub
left join leave_totals lt
  on lt.tenant_id = ub.tenant_id and lt.user_id = ub.user_id
where a."TenantId" = ub.tenant_id
  and a."UserId" = ub.user_id
  and a."IsDeleted" = false;
