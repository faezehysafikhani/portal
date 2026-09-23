-- LeaveAccounts has a full unique index on UserId. A soft-deleted row therefore
-- cannot be replaced by leaveAccount(), causing the balance endpoint to fail.
-- Restore such accounts for active users; the API deterministically recalculates
-- accrued, used and reserved hours from that user's own data on the next read.

update public."LeaveAccounts" a
set "IsDeleted" = false,
    "DeletedAt" = null,
    "UpdatedAt" = now()
where a."IsDeleted" = true
  and exists (
    select 1
    from public."Users" u
    where u."TenantId" = a."TenantId"
      and u."Id" = a."UserId"
      and u."IsDeleted" = false
      and u."IsActive" = true
  )
  and not exists (
    select 1
    from public."LeaveAccounts" active_account
    where active_account."TenantId" = a."TenantId"
      and active_account."UserId" = a."UserId"
      and active_account."IsDeleted" = false
  );
