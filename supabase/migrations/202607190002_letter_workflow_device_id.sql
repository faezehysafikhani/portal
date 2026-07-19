-- Stable browser/device identifier stored alongside the network IP.
alter table public."LetterWorkflowSteps"
  add column if not exists "DeviceId" text null;

create index if not exists "IX_LetterWorkflowSteps_DeviceId"
  on public."LetterWorkflowSteps" ("DeviceId");
