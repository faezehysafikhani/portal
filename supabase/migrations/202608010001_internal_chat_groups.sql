create table if not exists public."InternalChatGroups" (
  "Id" uuid primary key, "Name" varchar(60) not null, "OwnerUserId" uuid not null,
  "CreatedAt" timestamptz not null, "UpdatedAt" timestamptz null, "CreatedByUserId" uuid null,
  "IsDeleted" boolean not null default false, "DeletedAt" timestamptz null, "TenantId" uuid not null
);

create table if not exists public."InternalChatGroupMembers" (
  "Id" uuid primary key, "GroupId" uuid not null references public."InternalChatGroups"("Id") on delete cascade,
  "UserId" uuid not null, "IsAdmin" boolean not null default false, "LastReadAt" timestamptz null,
  "CreatedAt" timestamptz not null, "UpdatedAt" timestamptz null, "CreatedByUserId" uuid null,
  "IsDeleted" boolean not null default false, "DeletedAt" timestamptz null, "TenantId" uuid not null
);

create table if not exists public."InternalChatGroupMessages" (
  "Id" uuid primary key, "GroupId" uuid not null references public."InternalChatGroups"("Id") on delete cascade,
  "SenderUserId" uuid not null, "Content" text not null,
  "CreatedAt" timestamptz not null, "UpdatedAt" timestamptz null, "CreatedByUserId" uuid null,
  "IsDeleted" boolean not null default false, "DeletedAt" timestamptz null, "TenantId" uuid not null
);

create unique index if not exists "IX_InternalChatGroupMembers_GroupId_UserId" on public."InternalChatGroupMembers" ("GroupId", "UserId");
create index if not exists "IX_InternalChatGroupMessages_GroupId_CreatedAt" on public."InternalChatGroupMessages" ("GroupId", "CreatedAt");

alter table public."InternalChatGroups" enable row level security;
alter table public."InternalChatGroupMembers" enable row level security;
alter table public."InternalChatGroupMessages" enable row level security;
revoke all on public."InternalChatGroups", public."InternalChatGroupMembers", public."InternalChatGroupMessages" from anon, authenticated;
grant all on public."InternalChatGroups", public."InternalChatGroupMembers", public."InternalChatGroupMessages" to service_role;
