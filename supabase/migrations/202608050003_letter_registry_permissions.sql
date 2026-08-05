-- Separate registry visibility and signature permissions by letter type.
with permission_seed(code, name, module) as (
  values
    ('letters.type.internal','ایجاد نامه داخلی','letters'),
    ('letters.registry.internal.view','مشاهده دبیرخانه نامه‌های داخلی','letters'),
    ('letters.registry.incoming.view','مشاهده دبیرخانه نامه‌های وارده','letters'),
    ('letters.registry.outgoing.view','مشاهده دبیرخانه نامه‌های صادره','letters'),
    ('letters.sign.internal','امضای نامه داخلی','letters'),
    ('letters.sign.outgoing','امضای نامه صادره','letters')
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
