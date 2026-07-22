-- Login history/audit log (successful and failed sign-ins). Retained ~30 days.
create table if not exists public."LoginAudit" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "UserId" uuid,
  "Username" text not null,
  "FullName" text,
  "Success" boolean not null default true,
  "Ip" text,
  "UserAgent" text,
  "CreatedAt" timestamptz not null default now()
);
create index if not exists "LoginAudit_Tenant_time_idx"
  on public."LoginAudit"("TenantId", "CreatedAt" desc);
create index if not exists "LoginAudit_User_idx"
  on public."LoginAudit"("TenantId", "UserId", "CreatedAt" desc);
