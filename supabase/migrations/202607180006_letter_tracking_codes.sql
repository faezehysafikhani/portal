-- Human-friendly, tenant-scoped tracking codes start at 100.
-- Existing active letters are numbered deterministically by creation time.
with ranked as (
  select
    "Id",
    99 + row_number() over (
      partition by "TenantId"
      order by "CreatedAt", "Id"
    ) as tracking_code
  from public."Letters"
  where "IsDeleted" = false
)
update public."Letters" as letters
set "LetterCounter" = ranked.tracking_code
from ranked
where letters."Id" = ranked."Id";

create unique index if not exists "UX_Letters_Tenant_TrackingCode"
  on public."Letters" ("TenantId", "LetterCounter")
  where "IsDeleted" = false and "LetterCounter" is not null;

create or replace function public.assign_letter_tracking_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new."LetterCounter" is null then
    perform pg_advisory_xact_lock(hashtextextended(new."TenantId"::text, 0));

    select greatest(coalesce(max("LetterCounter"), 99) + 1, 100)
      into new."LetterCounter"
    from public."Letters"
    where "TenantId" = new."TenantId"
      and "IsDeleted" = false;
  end if;

  return new;
end;
$$;

drop trigger if exists "TR_Letters_AssignTrackingCode" on public."Letters";
create trigger "TR_Letters_AssignTrackingCode"
before insert on public."Letters"
for each row
execute function public.assign_letter_tracking_code();

