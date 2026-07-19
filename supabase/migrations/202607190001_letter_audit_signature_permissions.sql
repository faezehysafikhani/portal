-- Letter audit trail, signature ownership and per-tab permissions.
-- Idempotent so it is safe on databases that were partially upgraded.
alter table public."Letters" add column if not exists "SignedByUserId" uuid null;
alter table public."Letters" add column if not exists "SignedByName" text null;
alter table public."Letters" add column if not exists "SignedAt" timestamptz null;
alter table public."LetterWorkflowSteps" add column if not exists "IpAddress" text null;
alter table public."Notifications" add column if not exists "ActorUserId" uuid null;
alter table public."Notifications" add column if not exists "ActorName" text null;

with permission_seed(code, name, module) as (
  values
    ('letters.sign.revoke','پس گرفتن امضای خود','letters'),
    ('letters.cancel','ابطال نامه','letters'),
    ('letters.content.view','مشاهده متن نامه','letters'),
    ('letters.attachments.view','مشاهده پیوست‌های نامه','letters'),
    ('letters.workflow.view','مشاهده گردش و رویدادهای نامه','letters')
)
insert into public."Permissions"
  ("Id","Code","Name","Module","CreatedAt","UpdatedAt","CreatedByUserId","IsDeleted","DeletedAt","TenantId")
select gen_random_uuid(), seed.code, seed.name, seed.module, now(), null, null, false, null, tenant."Id"
from permission_seed seed
cross join public."Tenants" tenant
where not exists (
    select 1 from public."Permissions" current
    where current."TenantId" = tenant."Id" and current."Code" = seed.code
  );

-- Preserve current visibility: users who already see a mailbox or registry get
-- the three new read tabs. The administrator can revoke each one afterwards.
insert into public."UserPermissions"
  ("Id","UserId","PermissionId","CreatedAt","UpdatedAt","CreatedByUserId","IsDeleted","DeletedAt","TenantId")
select distinct on (existing."UserId", target."Id") gen_random_uuid(), existing."UserId", target."Id", now(), null, null, false, null, existing."TenantId"
from public."UserPermissions" existing
join public."Permissions" source on source."Id" = existing."PermissionId" and source."Code" in ('letters.inbox.view','letters.registry.view')
join public."Permissions" target on target."TenantId" = existing."TenantId" and target."Code" in ('letters.content.view','letters.attachments.view','letters.workflow.view')
where existing."IsDeleted" = false and source."IsDeleted" = false and target."IsDeleted" = false
  and not exists (
    select 1 from public."UserPermissions" current
    where current."TenantId" = existing."TenantId" and current."UserId" = existing."UserId"
      and current."PermissionId" = target."Id" and current."IsDeleted" = false
  );

create index if not exists "IX_LetterWorkflowSteps_LetterId_CreatedAt"
  on public."LetterWorkflowSteps" ("LetterId", "CreatedAt");
