-- Real Projects reference table for the Performance Evaluation module's Task Sheet.
-- Deliberately minimal (name/code/manager/status) — scoped to feed the performance
-- module's project picker, not a replacement for PTMS's project-management feature.
-- Tasks."ProjectId" (added in 202608080001_task_projects.sql) is a free text column;
-- once this table exists the API validates it against "Projects"."Id" (as text).

create table if not exists public."Projects" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "Name" text not null,
  "Code" text,
  "ManagerUserId" uuid,
  "Status" int not null default 0, -- 0=Active,1=Archived
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create index if not exists "IX_Projects_Tenant_Status"
  on public."Projects" ("TenantId", "Status")
  where "IsDeleted" = false;

alter table public."Projects" enable row level security;
revoke all on table public."Projects" from anon, authenticated;
grant all on table public."Projects" to service_role;
