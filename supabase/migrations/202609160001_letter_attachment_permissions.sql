-- Separate permissions for adding and deleting letter attachments.
with permission_seed(code, name, module) as (
  values
    ('letters.attachments.add','افزودن پیوست نامه','letters'),
    ('letters.attachments.delete','حذف پیوست نامه','letters')
)
insert into public."Permissions"
  ("Id","Code","Name","Module","CreatedAt","UpdatedAt","CreatedByUserId","IsDeleted","DeletedAt","TenantId")
select gen_random_uuid(), seed.code, seed.name, seed.module, now(), null, null, false, null, tenant."Id"
from permission_seed seed cross join public."Tenants" tenant
where not exists (select 1 from public."Permissions" current where current."TenantId"=tenant."Id" and current."Code"=seed.code);

-- Preserve existing behaviour: creators/editors may add; editors may delete.
insert into public."UserPermissions"
  ("Id","UserId","PermissionId","CreatedAt","UpdatedAt","CreatedByUserId","IsDeleted","DeletedAt","TenantId")
select distinct on (source_link."UserId", target."Id") gen_random_uuid(), source_link."UserId", target."Id", now(), null, null, false, null, source_link."TenantId"
from public."UserPermissions" source_link
join public."Permissions" source on source."Id"=source_link."PermissionId" and source."IsDeleted"=false
join public."Permissions" target on target."TenantId"=source_link."TenantId" and target."IsDeleted"=false
where source_link."IsDeleted"=false
  and ((target."Code"='letters.attachments.add' and source."Code" in ('letters.create','letters.edit'))
    or (target."Code"='letters.attachments.delete' and source."Code"='letters.edit'))
  and not exists (select 1 from public."UserPermissions" current where current."TenantId"=source_link."TenantId" and current."UserId"=source_link."UserId" and current."PermissionId"=target."Id" and current."IsDeleted"=false);

insert into public."RolePermissions"
  ("Id","RoleId","PermissionId","CreatedAt","UpdatedAt","CreatedByUserId","IsDeleted","DeletedAt","TenantId")
select distinct on (source_link."RoleId", target."Id") gen_random_uuid(), source_link."RoleId", target."Id", now(), null, null, false, null, source_link."TenantId"
from public."RolePermissions" source_link
join public."Permissions" source on source."Id"=source_link."PermissionId" and source."IsDeleted"=false
join public."Permissions" target on target."TenantId"=source_link."TenantId" and target."IsDeleted"=false
where source_link."IsDeleted"=false
  and ((target."Code"='letters.attachments.add' and source."Code" in ('letters.create','letters.edit'))
    or (target."Code"='letters.attachments.delete' and source."Code"='letters.edit'))
  and not exists (select 1 from public."RolePermissions" current where current."TenantId"=source_link."TenantId" and current."RoleId"=source_link."RoleId" and current."PermissionId"=target."Id" and current."IsDeleted"=false);
