alter table if exists public."Tasks"
  add column if not exists "ProjectId" text null;

update public."Tasks"
set "ProjectId" = '1'
where "ProjectId" is null;

create index if not exists "IX_Tasks_TenantId_ProjectId_Status"
  on public."Tasks" ("TenantId", "ProjectId", "Status")
  where "IsDeleted" = false;
