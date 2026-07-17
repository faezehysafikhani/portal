-- The web application talks to the database only through the `api` Edge
-- Function. The service-role key lives in the function environment and is
-- never shipped to Vercel or the browser.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Private file buckets. Edge Functions issue/upload files after checking the
-- tenant and permission. Existing base64 values can be migrated later.
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('avatars', 'avatars', false, 2097152),
  ('signatures', 'signatures', false, 2097152),
  ('chat-attachments', 'chat-attachments', false, 10485760),
  ('letter-attachments', 'letter-attachments', false, 20971520)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

