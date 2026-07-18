alter table public."Tenants"
  add column if not exists "Phone" text,
  add column if not exists "Email" text,
  add column if not exists "Address" text,
  add column if not exists "Website" text,
  add column if not exists "NationalId" text,
  add column if not exists "EconomicCode" text,
  add column if not exists "UpdatedAt" timestamptz;

create table if not exists public."Registries" (
  "Id" uuid primary key,
  "Name" text not null,
  "Prefix" text,
  "Separator" text not null default '/',
  "IncludeYear" boolean not null default true,
  "IncludeMonth" boolean not null default false,
  "CurrentNumber" integer not null default 1,
  "PadLength" integer not null default 4,
  "IsActive" boolean not null default true,
  "Description" text,
  "CreatedAt" timestamptz not null,
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz,
  "TenantId" uuid not null references public."Tenants"("Id") on delete cascade
);

create table if not exists public."RegistryUserAccess" (
  "Id" uuid primary key,
  "RegistryId" uuid not null references public."Registries"("Id") on delete cascade,
  "UserId" uuid not null references public."Users"("Id") on delete cascade,
  "DraftScope" text not null default 'none' check ("DraftScope" in ('all','own','none')),
  "InternalAccess" jsonb not null default '{}'::jsonb,
  "OutgoingAccess" jsonb not null default '{}'::jsonb,
  "IncomingAccess" jsonb not null default '{}'::jsonb,
  "CreatedAt" timestamptz not null,
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz,
  "TenantId" uuid not null references public."Tenants"("Id") on delete cascade,
  constraint "UQ_RegistryUserAccess_Registry_User_Tenant" unique ("RegistryId", "UserId", "TenantId")
);

create index if not exists "IX_Registries_TenantId" on public."Registries" ("TenantId");
create index if not exists "IX_RegistryUserAccess_TenantId_UserId" on public."RegistryUserAccess" ("TenantId", "UserId");

alter table public."Registries" enable row level security;
alter table public."RegistryUserAccess" enable row level security;
revoke all on public."Registries", public."RegistryUserAccess" from anon, authenticated;
grant all privileges on public."Registries", public."RegistryUserAccess" to service_role;

insert into public."Registries"
  ("Id","Name","Prefix","Separator","IncludeYear","IncludeMonth","CurrentNumber","PadLength","IsActive","Description","CreatedAt","UpdatedAt","CreatedByUserId","IsDeleted","DeletedAt","TenantId")
values
  ('10000000-0000-0000-0000-000000000001','دبیرخانه مرکزی','د','/',true,false,152,4,true,'دبیرخانه اصلی سازمان',now(),null,'00000000-0000-0000-0000-000000000001',false,null,'00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002','دبیرخانه واردات','و','/',true,false,48,4,true,'نامه‌های ورودی از خارج سازمان',now(),null,'00000000-0000-0000-0000-000000000001',false,null,'00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003','دبیرخانه صادرات','ص','/',true,false,95,4,true,'نامه‌های خروجی به خارج سازمان',now(),null,'00000000-0000-0000-0000-000000000001',false,null,'00000000-0000-0000-0000-000000000001')
on conflict ("Id") do nothing;
