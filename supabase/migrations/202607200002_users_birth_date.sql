-- Add Jalali birth date (text, e.g. 1370/05/12) to users.
alter table public."Users" add column if not exists "BirthDate" text;
