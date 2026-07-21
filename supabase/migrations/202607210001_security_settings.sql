-- Per-tenant security policy, password rotation tracking, and session limiting.
create table if not exists public."SecuritySettings" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "PasswordMinLength" int not null default 8,
  "RequireComplexity" boolean not null default false,
  "MaxFailedAttempts" int not null default 5,
  "LockoutMinutes" int not null default 30,
  "CaptchaAfterAttempts" int not null default 3,
  "PasswordExpiryDays" int not null default 0,      -- 0 = disabled
  "MaxConcurrentSessions" int not null default 0,   -- 0 = unlimited
  "TwoFactorRequired" boolean not null default false,
  "CreatedAt" timestamptz not null default now(),
  "UpdatedAt" timestamptz,
  "IsDeleted" boolean not null default false
);
create unique index if not exists "SecuritySettings_Tenant_uidx"
  on public."SecuritySettings"("TenantId") where "IsDeleted" = false;

-- Track last password change for expiry enforcement.
alter table public."Users" add column if not exists "PasswordChangedAt" timestamptz;

-- Session registry, used only when MaxConcurrentSessions > 0.
create table if not exists public."UserSessions" (
  "Id" uuid primary key default gen_random_uuid(),
  "TenantId" uuid not null,
  "UserId" uuid not null,
  "Jti" text not null,
  "UserAgent" text,
  "Ip" text,
  "CreatedAt" timestamptz not null default now(),
  "LastSeenAt" timestamptz not null default now(),
  "IsRevoked" boolean not null default false
);
create index if not exists "UserSessions_User_idx"
  on public."UserSessions"("TenantId","UserId") where "IsRevoked" = false;
create unique index if not exists "UserSessions_Jti_uidx" on public."UserSessions"("Jti");
