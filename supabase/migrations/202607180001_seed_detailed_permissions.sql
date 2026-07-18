-- Restore the detailed permission catalog used by the Supabase Edge backend.
-- Idempotent: existing rows are updated and missing rows are inserted.
do $$
declare
  tenant_id constant uuid := '00000000-0000-0000-0000-000000000001';
  admin_id constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  create temporary table permission_seed (
    code text primary key,
    name text not null,
    module text not null
  ) on commit drop;

  insert into permission_seed (code, name, module) values
    ('users.view','مشاهده کاربران','users'),
    ('users.create','ایجاد کاربر','users'),
    ('users.edit','ویرایش کاربر','users'),
    ('users.delete','حذف کاربر','users'),
    ('users.permissions.assign','تنظیم دسترسی مستقیم کاربر (فقط مدیر سیستم)','users'),
    ('users.password.reset','بازنشانی رمز عبور','users'),
    ('letters.inbox.view','مشاهده کارتابل نامه','letters'),
    ('letters.registry.view','مشاهده دبیرخانه','letters'),
    ('letters.create','ایجاد نامه و پیش‌نویس','letters'),
    ('letters.edit','ویرایش نامه','letters'),
    ('letters.sign','امضای نامه','letters'),
    ('letters.send','ذخیره و ارسال نامه','letters'),
    ('letters.refer','ارجاع نامه','letters'),
    ('letters.archive','بایگانی نامه','letters'),
    ('letters.delete','حذف نامه','letters'),
    ('letters.print','چاپ نامه','letters'),
    ('tickets.view','مشاهده تیکت‌ها','tickets'),
    ('tickets.create','ایجاد تیکت','tickets'),
    ('tickets.edit','ویرایش و تخصیص تیکت','tickets'),
    ('tickets.comment','ثبت پاسخ تیکت','tickets'),
    ('tickets.delete','حذف تیکت','tickets'),
    ('contacts.view','مشاهده مخاطبین','contacts'),
    ('contacts.create','ایجاد مخاطب','contacts'),
    ('contacts.edit','ویرایش مخاطب','contacts'),
    ('contacts.delete','حذف مخاطب','contacts'),
    ('calendar.view','مشاهده تقویم','calendar'),
    ('calendar.create','افزودن جلسه و رویداد','calendar'),
    ('calendar.edit','ویرایش رویداد','calendar'),
    ('calendar.delete','حذف رویداد','calendar'),
    ('calendar.respond','پاسخ به دعوت جلسه','calendar'),
    ('tasks.view','مشاهده وظایف','tasks'),
    ('tasks.create','ایجاد وظیفه','tasks'),
    ('tasks.edit','ویرایش وظیفه','tasks'),
    ('tasks.assign','تخصیص وظیفه','tasks'),
    ('forms.view','مشاهده فرم‌ها','forms'),
    ('forms.create','ثبت فرم','forms'),
    ('forms.approve','تأیید یا رد فرم','forms'),
    ('forms.access','تنظیم دسترسی فرم‌ها','forms'),
    ('sms.view','مشاهده پیامک‌ها','sms'),
    ('sms.settings','تنظیم پنل پیامکی','sms'),
    ('settings.view','مشاهده تنظیمات','settings'),
    ('settings.edit','ویرایش تنظیمات','settings'),
    ('positions.view','مشاهده سمت‌های سازمانی','settings'),
    ('positions.create','ایجاد سمت سازمانی','settings'),
    ('positions.edit','ویرایش سمت سازمانی','settings'),
    ('positions.delete','حذف سمت سازمانی','settings'),
    ('reports.view','مشاهده گزارش‌ها','reports'),
    ('reports.export','خروجی گزارش‌ها','reports'),
    ('company.view','مشاهده اطلاعات شرکت','company'),
    ('company.edit','ویرایش اطلاعات شرکت','company'),
    ('chat.view','استفاده از چت داخلی','chat'),
    ('ai.view','مشاهده دستیار هوشمند','ai'),
    ('ai.use','ارسال درخواست به هوش مصنوعی','ai'),
    ('ai.settings','تنظیم سرویس هوش مصنوعی','ai');

  update public."Permissions" as permission
  set "Name" = seed.name,
      "Module" = seed.module,
      "IsDeleted" = false,
      "DeletedAt" = null,
      "UpdatedAt" = now()
  from permission_seed as seed
  where permission."TenantId" = tenant_id
    and permission."Code" = seed.code;

  insert into public."Permissions"
    ("Id", "Code", "Name", "Module", "CreatedAt", "UpdatedAt", "CreatedByUserId", "IsDeleted", "DeletedAt", "TenantId")
  select gen_random_uuid(), seed.code, seed.name, seed.module, now(), null, admin_id, false, null, tenant_id
  from permission_seed as seed
  where not exists (
    select 1 from public."Permissions" as permission
    where permission."TenantId" = tenant_id and permission."Code" = seed.code
  );

  -- The admin account bypasses permission checks, so no direct grants are needed.
  -- Removing this permission from non-admin users enforces admin-only delegation.
  delete from public."UserPermissions" as user_permission
  using public."Permissions" as permission
  where user_permission."PermissionId" = permission."Id"
    and user_permission."TenantId" = tenant_id
    and permission."TenantId" = tenant_id
    and permission."Code" = 'users.permissions.assign'
    and user_permission."UserId" <> admin_id;
end $$;
