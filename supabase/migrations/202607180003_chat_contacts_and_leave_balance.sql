-- Chat directory may target either an internal user or an external contact.
alter table if exists public."InternalChatMessages"
  alter column "RecipientUserId" drop not null;

alter table if exists public."InternalChatMessages"
  add column if not exists "RecipientContactId" uuid null;

do $$
begin
  if to_regclass('public."Contacts"') is not null
     and not exists (select 1 from pg_constraint where conname = 'FK_InternalChatMessages_Contacts_RecipientContactId') then
    alter table public."InternalChatMessages"
      add constraint "FK_InternalChatMessages_Contacts_RecipientContactId"
      foreign key ("RecipientContactId") references public."Contacts"("Id") on delete set null;
  end if;
end $$;

-- Store browser base64 payloads as text; the API decodes them when downloading.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='InternalChatMessages'
      and column_name='AttachmentData' and data_type='bytea'
  ) then
    alter table public."InternalChatMessages"
      alter column "AttachmentData" type text
      using case when "AttachmentData" is null then null else encode("AttachmentData", 'base64') end;
  end if;
end $$;

create index if not exists "IX_InternalChatMessages_RecipientContactId"
  on public."InternalChatMessages" ("TenantId", "RecipientContactId", "CreatedAt");

-- Monthly leave entitlement: 20 hours = 2.5 working days (8 hours/day).
alter table if exists public."LeaveAccounts"
  add column if not exists "MonthlyAccrualHours" numeric(10,2) not null default 20,
  add column if not exists "HoursPerDay" numeric(10,2) not null default 8,
  add column if not exists "ReservedHours" numeric(10,2) not null default 0;

update public."LeaveAccounts"
set "MonthlyAccrualHours"=coalesce("MonthlyAccrualHours",20),
    "HoursPerDay"=coalesce("HoursPerDay",8),
    "ReservedHours"=coalesce("ReservedHours",0)
where "IsDeleted"=false;

create index if not exists "IX_LeaveAccounts_Tenant_User"
  on public."LeaveAccounts" ("TenantId", "UserId") where "IsDeleted"=false;

revoke all on table public."InternalChatMessages", public."LeaveAccounts" from anon, authenticated;
grant all on table public."InternalChatMessages", public."LeaveAccounts" to service_role;
