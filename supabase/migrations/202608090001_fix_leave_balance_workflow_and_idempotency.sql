-- Keep organizational-form submission idempotent across double-clicks and retries.
alter table if exists public."OrganizationalForms"
  add column if not exists "ClientRequestId" uuid null;

create unique index if not exists "UX_OrganizationalForms_ClientRequestId"
  on public."OrganizationalForms" ("TenantId", "SubmitterUserId", "ClientRequestId")
  where "ClientRequestId" is not null and "IsDeleted" = false;

-- Soft-delete only obvious pending duplicates created by the same user within
-- ten seconds and having exactly the same payload. Approved/history-bearing
-- requests are deliberately left untouched.
with ordered as (
  select f."Id",
         lag(f."Id") over (
           partition by f."TenantId", f."SubmitterUserId", f."FormType",
                        f."RequestedHours", f."DataJson"
           order by f."CreatedAt", f."Id"
         ) as previous_id,
         lag(f."CreatedAt") over (
           partition by f."TenantId", f."SubmitterUserId", f."FormType",
                        f."RequestedHours", f."DataJson"
           order by f."CreatedAt", f."Id"
         ) as previous_created_at,
         f."CreatedAt"
  from public."OrganizationalForms" f
  where f."IsDeleted" = false
    and f."Status" = 'manager_pending'
    and f."FormType" in ('leave_daily', 'leave_hourly')
), duplicates as (
  select o."Id"
  from ordered o
  where o.previous_id is not null
    and o."CreatedAt" - o.previous_created_at <= interval '10 seconds'
    and not exists (
      select 1 from public."FormWorkflowHistories" h
      where h."FormId" = o."Id"
        and h."IsDeleted" = false
        and h."Action" <> 'submitted'
    )
)
update public."OrganizationalForms" f
set "IsDeleted" = true,
    "DeletedAt" = now(),
    "UpdatedAt" = now()
where f."Id" in (select "Id" from duplicates);

update public."FormWorkflowHistories" h
set "IsDeleted" = true,
    "DeletedAt" = now(),
    "UpdatedAt" = now()
where h."FormId" in (
  select f."Id"
  from public."OrganizationalForms" f
  where f."IsDeleted" = true
    and f."DeletedAt" >= now() - interval '1 minute'
    and f."Status" = 'manager_pending'
    and f."FormType" in ('leave_daily', 'leave_hourly')
);

-- Reconcile the cached leave totals with the actual workflow rows. Only annual
-- daily leave and hourly leave consume the 20-hour monthly entitlement.
update public."LeaveAccounts" a
set "AccruedHours" = greatest(coalesce(a."AccruedHours", 0), coalesce(a."MonthlyAccrualHours", 20)),
    "UsedHours" = coalesce((
      select sum(f."RequestedHours")
      from public."OrganizationalForms" f
      where f."TenantId" = a."TenantId"
        and f."SubmitterUserId" = a."UserId"
        and f."IsDeleted" = false
        and f."Status" in ('approved', 'completed')
        and (
          f."FormType" = 'leave_hourly'
          or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی')
        )
    ), 0),
    "ReservedHours" = coalesce((
      select sum(f."RequestedHours")
      from public."OrganizationalForms" f
      where f."TenantId" = a."TenantId"
        and f."SubmitterUserId" = a."UserId"
        and f."IsDeleted" = false
        and f."Status" in ('manager_pending', 'hr_pending')
        and (
          f."FormType" = 'leave_hourly'
          or (f."FormType" = 'leave_daily' and coalesce((f."DataJson"::jsonb)->>'leaveType', 'استحقاقی') = 'استحقاقی')
        )
    ), 0),
    "UpdatedAt" = now()
where a."IsDeleted" = false;
