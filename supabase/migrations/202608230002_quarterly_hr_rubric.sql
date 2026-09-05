-- HR quarterly evaluation rubric (9-category, 100-point, per دستورالعمل جامع ارزیابی عملکرد و رفتاری)
-- plus the daily timesheet that its adjustment-point catalog depends on.
-- Coexists with the existing monthly PerformanceEvaluations/weights system (untouched) —
-- this becomes the module's new official score, driving reward/penalty; the monthly
-- Task-based score stays available as a secondary/reference metric.

-- One scorecard per evaluator per employee per Jalali quarter. Totals are always
-- server-computed from ScoresJson + the rubric config, never trusted from the client.
create table if not exists public."PerformanceScoreCards" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "EmployeeUserId" uuid not null,
  "EvaluatorUserId" uuid not null,
  "PeriodYear" int not null,
  "PeriodQuarter" int not null,
  "ScoresJson" text not null default '{}',
  "TechnicalScore" numeric not null default 0,
  "BehavioralScore" numeric not null default 0,
  "TotalScore" numeric not null default 0,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create unique index if not exists "PerformanceScoreCards_Card_uidx"
  on public."PerformanceScoreCards"("EmployeeUserId","EvaluatorUserId","PeriodYear","PeriodQuarter") where "IsDeleted" = false;
create index if not exists "IX_PerformanceScoreCards_Employee_Period"
  on public."PerformanceScoreCards"("TenantId","EmployeeUserId","PeriodYear","PeriodQuarter") where "IsDeleted" = false;

-- Manual bonus/malus adjustment log (fixed catalog from the policy doc). Append-only;
-- the automatic -0.2/day missing-timesheet malus is computed at compute-time, not stored here.
create table if not exists public."PerformanceAdjustments" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "EmployeeUserId" uuid not null,
  "PeriodYear" int not null,
  "PeriodQuarter" int not null,
  "Type" text not null, -- 'Bonus' | 'Malus'
  "Code" text not null,
  "Points" numeric not null,
  "Note" text,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create index if not exists "IX_PerformanceAdjustments_Employee_Period"
  on public."PerformanceAdjustments"("TenantId","EmployeeUserId","PeriodYear","PeriodQuarter") where "IsDeleted" = false;

-- One finalized result per employee per quarter: average of that period's scorecards +
-- adjustment total, mapped through the reward/penalty matrix.
create table if not exists public."PerformanceQuarterlyResults" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "EmployeeUserId" uuid not null,
  "PeriodYear" int not null,
  "PeriodQuarter" int not null,
  "AverageScore" numeric,
  "AdjustmentTotal" numeric not null default 0,
  "FinalScore" numeric,
  "Band" text,
  "FinancialOutcomeText" text,
  "Status" int not null default 0, -- 0=Draft,1=Finalized
  "FinalizedAt" timestamptz,
  "FinalizedByUserId" uuid,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create unique index if not exists "PerformanceQuarterlyResults_Period_uidx"
  on public."PerformanceQuarterlyResults"("EmployeeUserId","PeriodYear","PeriodQuarter") where "IsDeleted" = false;

-- Simple daily timesheet: one row per person per day, activities embedded as JSON
-- (matches this codebase's existing TagsJson/ProjectIdsJson/ComponentScoresJson idiom).
create table if not exists public."DailyTimesheets" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "UserId" uuid not null,
  "EntryDate" date not null,
  "EntriesJson" text not null default '[]',
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create unique index if not exists "DailyTimesheets_UserDate_uidx"
  on public."DailyTimesheets"("UserId","EntryDate") where "IsDeleted" = false;
create index if not exists "IX_DailyTimesheets_Tenant_User_Date"
  on public."DailyTimesheets"("TenantId","UserId","EntryDate") where "IsDeleted" = false;

alter table public."PerformanceScoreCards" enable row level security;
alter table public."PerformanceAdjustments" enable row level security;
alter table public."PerformanceQuarterlyResults" enable row level security;
alter table public."DailyTimesheets" enable row level security;

revoke all on table public."PerformanceScoreCards" from anon, authenticated;
revoke all on table public."PerformanceAdjustments" from anon, authenticated;
revoke all on table public."PerformanceQuarterlyResults" from anon, authenticated;
revoke all on table public."DailyTimesheets" from anon, authenticated;

grant all on table public."PerformanceScoreCards" to service_role;
grant all on table public."PerformanceAdjustments" to service_role;
grant all on table public."PerformanceQuarterlyResults" to service_role;
grant all on table public."DailyTimesheets" to service_role;
