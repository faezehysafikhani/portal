alter table public."LeaveAccounts"
  add column if not exists "BalanceAdjustmentHours" numeric(10, 2) not null default 0;

comment on column public."LeaveAccounts"."BalanceAdjustmentHours" is
  'Manual correction to the leave balance, separate from regular accrual and approved requests.';
