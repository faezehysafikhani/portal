-- Performance Evaluation module: task categorization/scoring fields + supporting tables.

-- Task categorization, complexity/impact scoring (locked at creation), self-added creation
-- approval workflow, and post-completion quality rating.
alter table public."Tasks"
  add column if not exists "Category" int,
  add column if not exists "Complexity" int,
  add column if not exists "ImpactScore" int,
  add column if not exists "IsSelfAdded" boolean not null default false,
  add column if not exists "CreationApprovalStatus" int not null default 1, -- 0=Pending,1=Approved,2=Rejected
  add column if not exists "CreationApprovedByUserId" uuid,
  add column if not exists "CreationApprovedAt" timestamptz,
  add column if not exists "QualityRating" int,
  add column if not exists "QualityRatedByUserId" uuid,
  add column if not exists "QualityRatedAt" timestamptz;

create index if not exists "IX_Tasks_CreationApprovalStatus_Pending"
  on public."Tasks" ("TenantId", "CreationApprovalStatus")
  where "CreationApprovalStatus" = 0 and "IsDeleted" = false;

-- Employee -> reviewer mapping. There is no real manager hierarchy in Users
-- (DirectManager/HrManager are free text), so this table is the source of truth
-- for who reviews/approves whom in the performance module.
create table if not exists public."PerformanceReviewers" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "EmployeeUserId" uuid not null,
  "ReviewerUserId" uuid not null,
  "IsActive" boolean not null default true,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create unique index if not exists "PerformanceReviewers_Employee_uidx"
  on public."PerformanceReviewers"("EmployeeUserId") where "IsDeleted" = false and "IsActive" = true;
create index if not exists "IX_PerformanceReviewers_Reviewer"
  on public."PerformanceReviewers"("TenantId","ReviewerUserId") where "IsDeleted" = false and "IsActive" = true;

-- Per-tenant scoring weights, caps, and score-band thresholds. One active row per tenant;
-- application code creates a default row lazily on first read (same pattern as SecuritySettings).
create table if not exists public."PerformanceSettings" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "WeightTaskCompletion" numeric not null default 35,
  "WeightQuality" numeric not null default 20,
  "WeightTimeliness" numeric not null default 20,
  "WeightManagerQualitative" numeric not null default 20,
  "WeightReportingDiscipline" numeric not null default 5,
  "SelfAddedCapPercent" int not null default 20,
  "ManagerQualitativeCapPercent" int not null default 20,
  "BandExceptionalMin" numeric not null default 90,
  "BandExcellentMin" numeric not null default 80,
  "BandGoodMin" numeric not null default 70,
  "BandNeedsImprovementMin" numeric not null default 60,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create unique index if not exists "PerformanceSettings_Tenant_uidx"
  on public."PerformanceSettings"("TenantId") where "IsDeleted" = false;

-- One evaluation record per user per month, with an explicit lifecycle so the score can
-- be reviewed/appealed/finalized independently of tasks changing afterward.
create table if not exists public."PerformanceEvaluations" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "UserId" uuid not null,
  "PeriodYear" int not null,
  "PeriodMonth" int not null,
  "ComponentScoresJson" text not null default '{}',
  "FinalScore" numeric,
  "ScoreBand" text,
  "Status" int not null default 0, -- 0=Draft,1=PendingReview,2=Finalized
  "ReviewerUserId" uuid,
  "FinalizedAt" timestamptz,
  "FinalizedByUserId" uuid,
  "RewardDecision" text,
  "RewardNotes" text,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create unique index if not exists "PerformanceEvaluations_UserPeriod_uidx"
  on public."PerformanceEvaluations"("UserId","PeriodYear","PeriodMonth") where "IsDeleted" = false;
create index if not exists "IX_PerformanceEvaluations_Reviewer_Status"
  on public."PerformanceEvaluations"("TenantId","ReviewerUserId","Status") where "IsDeleted" = false;

-- Appeals raised by an employee against a finalized evaluation (never auto-mutates the score;
-- a reviewer/admin must explicitly reopen the evaluation to change it).
create table if not exists public."PerformanceAppeals" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "EvaluationId" uuid not null references public."PerformanceEvaluations"("Id") on delete cascade,
  "TaskId" uuid references public."Tasks"("Id"),
  "RaisedByUserId" uuid not null,
  "Reason" text not null,
  "Status" int not null default 0, -- 0=Pending,1=Reviewed,2=Resolved
  "ReviewerResponse" text,
  "ResolvedByUserId" uuid,
  "ResolvedAt" timestamptz,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create index if not exists "IX_PerformanceAppeals_Evaluation" on public."PerformanceAppeals"("EvaluationId");

-- Audit trail for every evaluation lifecycle/appeal action (who, when, what changed, why).
create table if not exists public."PerformanceAuditLogs" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "EvaluationId" uuid not null references public."PerformanceEvaluations"("Id") on delete cascade,
  "ActorUserId" uuid not null,
  "Action" text not null,
  "DetailsJson" text,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "CreatedByUserId" uuid,
  "IsDeleted" boolean not null default false,
  "DeletedAt" timestamptz
);
create index if not exists "IX_PerformanceAuditLogs_Evaluation_CreatedAt"
  on public."PerformanceAuditLogs"("EvaluationId","CreatedAt");

alter table public."PerformanceReviewers" enable row level security;
alter table public."PerformanceSettings" enable row level security;
alter table public."PerformanceEvaluations" enable row level security;
alter table public."PerformanceAppeals" enable row level security;
alter table public."PerformanceAuditLogs" enable row level security;

revoke all on table public."PerformanceReviewers" from anon, authenticated;
revoke all on table public."PerformanceSettings" from anon, authenticated;
revoke all on table public."PerformanceEvaluations" from anon, authenticated;
revoke all on table public."PerformanceAppeals" from anon, authenticated;
revoke all on table public."PerformanceAuditLogs" from anon, authenticated;

grant all on table public."PerformanceReviewers" to service_role;
grant all on table public."PerformanceSettings" to service_role;
grant all on table public."PerformanceEvaluations" to service_role;
grant all on table public."PerformanceAppeals" to service_role;
grant all on table public."PerformanceAuditLogs" to service_role;
