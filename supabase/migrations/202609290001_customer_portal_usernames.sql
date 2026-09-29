alter table if exists public."Customers"
  add column if not exists "Username" text null,
  add column if not exists "ContactId" uuid null;

update public."Customers"
set "Username" = lower(trim("Email"))
where ("Username" is null or trim("Username") = '')
  and "Email" is not null
  and trim("Email") <> '';

create unique index if not exists "UX_Customers_Username_Active"
  on public."Customers" (lower("Username"))
  where "IsDeleted" = false and "Username" is not null and trim("Username") <> '';

create unique index if not exists "UX_Customers_Tenant_Contact_Active"
  on public."Customers" ("TenantId", "ContactId")
  where "IsDeleted" = false and "ContactId" is not null;
