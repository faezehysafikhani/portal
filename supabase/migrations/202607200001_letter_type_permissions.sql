-- Add per-type letter permissions so incoming/outgoing letters can be restricted.
-- Internal letters stay available to anyone with letters.create.
-- Idempotent: existing rows are updated and missing rows are inserted.
do $$
declare
  tenant_id constant uuid := '00000000-0000-0000-0000-000000000001';
  admin_id constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  create temporary table permission_seed (
    code text primary key,
    name text not null,
    module text not null
  ) on commit drop;

  insert into permission_seed (code, name, module) values
    ('letters.type.incoming','ثبت نامه وارده','letters'),
    ('letters.type.outgoing','ایجاد نامه صادره','letters');

  update public."Permissions" as permission
  set "Name" = seed.name,
      "Module" = seed.module,
      "IsDeleted" = false,
      "DeletedAt" = null,
      "UpdatedAt" = now()
  from permission_seed as seed
  where permission."TenantId" = tenant_id
    and permission."Code" = seed.code;

  insert into public."Permissions"
    ("Id", "Code", "Name", "Module", "CreatedAt", "UpdatedAt", "CreatedByUserId", "IsDeleted", "DeletedAt", "TenantId")
  select gen_random_uuid(), seed.code, seed.name, seed.module, now(), null, admin_id, false, null, tenant_id
  from permission_seed as seed
  where not exists (
    select 1 from public."Permissions" as permission
    where permission."TenantId" = tenant_id and permission."Code" = seed.code
  );
end $$;
