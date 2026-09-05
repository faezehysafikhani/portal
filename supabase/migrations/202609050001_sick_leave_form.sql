-- Sick leave (استعلاجی) becomes its own organizational-form type instead of a
-- leaveType option inside "مرخصی روزانه": capped at 3 days per Jalali month,
-- never deducted from the annual leave balance, and requires a doctor's note
-- attached at submission time.

do $$
declare
  tenant_id constant uuid := '00000000-0000-0000-0000-000000000001';
  admin_id constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public."Permissions"
    ("Id", "Code", "Name", "Module", "CreatedAt", "UpdatedAt", "CreatedByUserId", "IsDeleted", "DeletedAt", "TenantId")
  select gen_random_uuid(), 'forms.type.leave_sick', 'ثبت فرم مرخصی استعلاجی', 'forms', now(), null, admin_id, false, null, tenant_id
  where not exists (
    select 1 from public."Permissions" permission
    where permission."TenantId" = tenant_id and permission."Code" = 'forms.type.leave_sick'
  );
end $$;

-- Doctor's note attachment, stored the same way as chat attachments: base64
-- in a text column, served only through the Edge Function.
alter table if exists public."OrganizationalForms"
  add column if not exists "AttachmentData" text null,
  add column if not exists "AttachmentName" text null,
  add column if not exists "AttachmentContentType" text null;
