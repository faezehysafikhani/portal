-- MFA (TOTP) secret storage + general API rate limiting.
alter table public."Users" add column if not exists "TwoFactorSecret" text;

create table if not exists public."RateLimits" (
  "Bucket" text primary key,
  "Count" int not null default 0,
  "ExpiresAt" timestamptz not null
);
create index if not exists "RateLimits_expiry_idx" on public."RateLimits"("ExpiresAt");

-- Atomic fixed-window counter. Returns the current hit count within the window.
create or replace function public.rate_limit_hit(p_bucket text, p_window_seconds int)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  insert into public."RateLimits" ("Bucket", "Count", "ExpiresAt")
  values (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  on conflict ("Bucket") do update
    set "Count" = case when public."RateLimits"."ExpiresAt" < now() then 1
                       else public."RateLimits"."Count" + 1 end,
        "ExpiresAt" = case when public."RateLimits"."ExpiresAt" < now() then now() + make_interval(secs => p_window_seconds)
                           else public."RateLimits"."ExpiresAt" end
  returning "Count" into v_count;
  return v_count;
end;
$$;
