alter table public."Tasks"
  add column if not exists "AssigneeUserIdsJson" text not null default '[]',
  add column if not exists "ProjectIdsJson" text not null default '[]',
  add column if not exists "TagsJson" text not null default '[]',
  add column if not exists "IsRecurring" boolean not null default false,
  add column if not exists "RecurrenceType" text null,
  add column if not exists "RecurrenceInterval" integer not null default 1,
  add column if not exists "RecurrenceWeekday" integer null,
  add column if not exists "RecurrenceEndDate" timestamptz null,
  add column if not exists "RecurrenceCount" integer null,
  add column if not exists "RecurrenceSeriesId" uuid null,
  add column if not exists "RecurrenceSequence" integer not null default 1,
  add column if not exists "RequiresCompletionApproval" boolean not null default true,
  add column if not exists "CompletionRequestedAt" timestamptz null,
  add column if not exists "CompletionRequestedByUserId" uuid null,
  add column if not exists "IsCompletionApproved" boolean not null default false,
  add column if not exists "CompletionApprovedAt" timestamptz null,
  add column if not exists "CompletionApprovedByUserId" uuid null;

update public."Tasks"
set "AssigneeUserIdsJson" = jsonb_build_array("AssignedToUserId"::text)::text
where "AssignedToUserId" is not null and "AssigneeUserIdsJson" = '[]';

update public."Tasks"
set "ProjectIdsJson" = jsonb_build_array("ProjectId")::text
where "ProjectId" is not null and "ProjectIdsJson" = '[]';

create index if not exists "IX_Tasks_RecurrenceSeriesId" on public."Tasks" ("RecurrenceSeriesId");
create index if not exists "IX_Tasks_CompletionRequestedAt" on public."Tasks" ("CompletionRequestedAt") where "IsCompletionApproved" = false;

create table if not exists public."TaskActivityLogs" (
  "Id" uuid primary key,
  "TaskId" uuid not null references public."Tasks"("Id") on delete cascade,
  "ActorUserId" uuid not null,
  "Action" text not null,
  "DetailsJson" text null,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz null,
  "CreatedByUserId" uuid null,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz null,
  "TenantId" uuid not null
);

create index if not exists "IX_TaskActivityLogs_TaskId_CreatedAt"
  on public."TaskActivityLogs" ("TaskId", "CreatedAt");

create table if not exists public."TaskSavedViews" (
  "Id" uuid primary key,
  "OwnerUserId" uuid not null,
  "Name" text not null,
  "FiltersJson" text not null default '{}',
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz null,
  "CreatedByUserId" uuid null,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz null,
  "TenantId" uuid not null
);

create unique index if not exists "IX_TaskSavedViews_OwnerUserId_Name"
  on public."TaskSavedViews" ("OwnerUserId", "Name") where "IsDeleted" = false;

revoke all on table public."TaskActivityLogs" from anon, authenticated;
revoke all on table public."TaskSavedViews" from anon, authenticated;
grant all on table public."TaskActivityLogs" to service_role;
grant all on table public."TaskSavedViews" to service_role;

do $$
declare
  tenant_row record;
  creator_id uuid;
  second_user_id uuid;
  parent_id uuid;
  review_id uuid;
begin
  for tenant_row in select "Id" from public."Tenants" loop
    select "Id" into creator_id
    from public."Users"
    where "TenantId" = tenant_row."Id" and "IsDeleted" = false and "IsActive" = true
    order by case when "Username" = 'admin' then 0 else 1 end, "CreatedAt"
    limit 1;

    select "Id" into second_user_id
    from public."Users"
    where "TenantId" = tenant_row."Id" and "IsDeleted" = false and "IsActive" = true and "Id" <> creator_id
    order by "CreatedAt"
    limit 1;

    second_user_id := coalesce(second_user_id, creator_id);
    if creator_id is not null and not exists (
      select 1 from public."Tasks" where "TenantId" = tenant_row."Id" and "Title" = '[آزمایشی] آماده‌سازی نسخه نمایشی'
    ) then
      parent_id := gen_random_uuid();
      review_id := gen_random_uuid();

      insert into public."Tasks" (
        "Id", "TenantId", "Title", "Description", "ProjectId", "ProjectIdsJson", "Status", "Priority",
        "StartDate", "DueDate", "EstimatedHours", "Progress", "AssignedByUserId", "AssignedToUserId",
        "AssigneeUserIdsJson", "TagsJson", "RequiresCompletionApproval", "CreatedAt", "CreatedByUserId", "IsDeleted"
      ) values (
        parent_id, tenant_row."Id", '[آزمایشی] آماده‌سازی نسخه نمایشی', 'وظیفه چندنفره و چندپروژه‌ای برای سنجش بورد، برچسب و زیروظیفه.', '1', '["1","2"]', 1, 2,
        now() - interval '1 day', now() + interval '5 days', 16, 35, creator_id, second_user_id,
        jsonb_build_array(creator_id::text, second_user_id::text)::text, '["نسخه نمایشی","فوری"]', true, now(), creator_id, false
      );

      insert into public."Tasks" (
        "Id", "TenantId", "Title", "Description", "ProjectId", "ProjectIdsJson", "ParentTaskId", "Status", "Priority",
        "StartDate", "DueDate", "Progress", "AssignedByUserId", "AssignedToUserId", "AssigneeUserIdsJson", "TagsJson",
        "RequiresCompletionApproval", "CreatedAt", "CreatedByUserId", "IsDeleted"
      ) values (
        gen_random_uuid(), tenant_row."Id", '[آزمایشی] بررسی رابط کاربری', 'زیروظیفه نمونه برای آزمون ساختار چندسطحی.', '1', '["1"]', parent_id, 0, 1,
        now(), now() + interval '2 days', 0, creator_id, second_user_id, jsonb_build_array(second_user_id::text)::text, '["UI"]',
        true, now(), creator_id, false
      );

      insert into public."Tasks" (
        "Id", "TenantId", "Title", "Description", "ProjectId", "ProjectIdsJson", "Status", "Priority", "StartDate", "DueDate",
        "Progress", "AssignedByUserId", "AssignedToUserId", "AssigneeUserIdsJson", "TagsJson", "IsRecurring", "RecurrenceType",
        "RecurrenceInterval", "RecurrenceEndDate", "RecurrenceCount", "RecurrenceSeriesId", "RecurrenceSequence",
        "RequiresCompletionApproval", "CreatedAt", "CreatedByUserId", "IsDeleted"
      ) values (
        gen_random_uuid(), tenant_row."Id", '[آزمایشی] کنترل روزانه پروژه', 'نمونه تکرار هر سه روز یک‌بار.', '2', '["2"]', 0, 1, now(), now() + interval '1 day',
        0, creator_id, creator_id, jsonb_build_array(creator_id::text)::text, '["کنترل پروژه","تکرارشونده"]', true, 'EveryNDays',
        3, now() + interval '30 days', 10, gen_random_uuid(), 1, true, now(), creator_id, false
      );

      insert into public."Tasks" (
        "Id", "TenantId", "Title", "Description", "ProjectId", "ProjectIdsJson", "Status", "Priority", "StartDate", "DueDate",
        "Progress", "AssignedByUserId", "AssignedToUserId", "AssigneeUserIdsJson", "TagsJson", "IsRecurring", "RecurrenceType",
        "RecurrenceInterval", "RecurrenceWeekday", "RecurrenceEndDate", "RecurrenceCount", "RecurrenceSeriesId", "RecurrenceSequence",
        "RequiresCompletionApproval", "CreatedAt", "CreatedByUserId", "IsDeleted"
      ) values (
        gen_random_uuid(), tenant_row."Id", '[آزمایشی] جلسه ماهانه گزارش', 'نمونه آخرین دوشنبه هر ماه.', '3', '["3"]', 0, 2, now(), now() + interval '7 days',
        0, creator_id, second_user_id, jsonb_build_array(second_user_id::text)::text, '["جلسه","ماهانه"]', true, 'LastWeekdayOfMonth',
        1, 1, now() + interval '6 months', 6, gen_random_uuid(), 1, true, now(), creator_id, false
      );

      insert into public."Tasks" (
        "Id", "TenantId", "Title", "Description", "ProjectId", "ProjectIdsJson", "Status", "Priority", "StartDate", "DueDate",
        "Progress", "AssignedByUserId", "AssignedToUserId", "AssigneeUserIdsJson", "TagsJson", "RequiresCompletionApproval",
        "CompletionRequestedAt", "CompletionRequestedByUserId", "IsCompletionApproved", "CreatedAt", "CreatedByUserId", "IsDeleted"
      ) values (
        review_id, tenant_row."Id", '[آزمایشی] در انتظار تأیید نویسنده', 'انجام‌دهنده پایان کار را اعلام کرده و وظیفه تا تأیید نویسنده باقی می‌ماند.', '1', '["1"]', 2, 2,
        now() - interval '3 days', now(), 100, creator_id, second_user_id, jsonb_build_array(second_user_id::text)::text, '["نیازمند تأیید"]', true,
        now(), second_user_id, false, now() - interval '3 days', creator_id, false
      );

      insert into public."TaskActivityLogs" (
        "Id", "TaskId", "ActorUserId", "Action", "DetailsJson", "CreatedAt", "CreatedByUserId", "IsDeleted", "TenantId"
      ) values
        (gen_random_uuid(), parent_id, creator_id, 'Created', '{"source":"test-seed"}', now(), creator_id, false, tenant_row."Id"),
        (gen_random_uuid(), review_id, second_user_id, 'CompletionRequested', '{"source":"test-seed"}', now(), second_user_id, false, tenant_row."Id");
    end if;
  end loop;
end $$;
