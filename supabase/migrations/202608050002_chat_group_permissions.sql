-- Fine-grained group-chat permissions for every tenant.
with permission_seed(code, name, module) as (
  values
    ('chat.create_group','ایجاد گروه چت','chat'),
    ('chat.add_member','افزودن عضو به گروه چت','chat'),
    ('chat.remove_member','حذف عضو از گروه چت','chat')
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
