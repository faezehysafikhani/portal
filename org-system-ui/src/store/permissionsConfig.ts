export interface Permission {
  key: string
  label: string
  actions: { key: string; label: string }[]
}

export interface PermissionGroup {
  key: string
  label: string
  icon: string
  permissions: Permission[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'letters',
    label: 'نامه‌نگاری',
    icon: '✉️',
    permissions: [
      {
        key: 'letters_inbox',
        label: 'کارتابل نامه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'view_all', label: 'مشاهده همه نامه‌ها' },
          { key: 'view_own', label: 'مشاهده نامه‌های خود' },
          { key: 'search', label: 'جستجو' },
          { key: 'print', label: 'چاپ' },
          { key: 'archive', label: 'بایگانی' },
        ]
      },
      {
        key: 'letters_internal',
        label: 'نامه داخلی',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد پیش‌نویس' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'sign', label: 'امضا' },
          { key: 'send', label: 'ارسال' },
          { key: 'refer', label: 'ارجاع' },
          { key: 'archive', label: 'بایگانی' },
        ]
      },
      {
        key: 'letters_incoming',
        label: 'نامه وارده',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'register', label: 'ثبت نامه' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'refer', label: 'ارجاع' },
          { key: 'reply', label: 'پاسخ' },
          { key: 'archive', label: 'بایگانی' },
        ]
      },
      {
        key: 'letters_outgoing',
        label: 'نامه صادره',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'sign', label: 'امضا' },
          { key: 'send', label: 'ارسال' },
          { key: 'archive', label: 'بایگانی' },
        ]
      },
      {
        key: 'letters_body',
        label: 'بدنه نامه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'add', label: 'افزودن' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'required', label: 'الزامی کردن' },
        ]
      },
      {
        key: 'letters_attachment',
        label: 'پیوست نامه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'add', label: 'افزودن' },
          { key: 'download', label: 'دانلود' },
          { key: 'delete', label: 'حذف' },
        ]
      },
      {
        key: 'letters_related',
        label: 'نامه مرتبط',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'add', label: 'افزودن' },
          { key: 'delete', label: 'حذف' },
        ]
      },
      {
        key: 'letters_folder',
        label: 'پرونده نامه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'transfer', label: 'انتقال' },
          { key: 'delete', label: 'حذف' },
          { key: 'access', label: 'دسترسی به پرونده' },
        ]
      },
      {
        key: 'letters_registry',
        label: 'دبیرخانه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'manage', label: 'مدیریت تنظیمات' },
          { key: 'numbering', label: 'مدیریت شمارنده' },
        ]
      },
    ]
  },
  {
    key: 'ptms',
    label: 'مدیریت پروژه',
    icon: '📊',
    permissions: [
      {
        key: 'ptms_dashboard',
        label: 'داشبورد پروژه‌ها',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'manage_events', label: 'مدیریت رویدادها' },
        ]
      },
      {
        key: 'ptms_portfolio',
        label: 'سبد پروژه‌ها',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
        ]
      },
      {
        key: 'ptms_projects',
        label: 'پروژه‌ها',
        actions: [
          { key: 'view_all', label: 'مشاهده همه پروژه‌ها' },
          { key: 'view_own', label: 'مشاهده پروژه‌های خود' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'change_status', label: 'تغییر وضعیت' },
        ]
      },
      {
        key: 'ptms_project_summary',
        label: 'خلاصه پروژه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'view_financial', label: 'مشاهده اطلاعات مالی' },
          { key: 'view_evm', label: 'مشاهده نمودار EVM' },
        ]
      },
      {
        key: 'ptms_wbs',
        label: 'WBS پروژه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد آیتم' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
        ]
      },
      {
        key: 'ptms_team',
        label: 'تیم پروژه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'add_member', label: 'افزودن عضو' },
          { key: 'edit_member', label: 'ویرایش نقش عضو' },
          { key: 'remove_member', label: 'حذف عضو' },
          { key: 'view_raci', label: 'مشاهده ماتریس RACI' },
        ]
      },
      {
        key: 'ptms_tasks',
        label: 'وظایف',
        actions: [
          { key: 'view_all', label: 'مشاهده همه' },
          { key: 'view_own', label: 'مشاهده وظایف خود' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'assign', label: 'واگذاری' },
          { key: 'change_status', label: 'تغییر وضعیت' },
          { key: 'add_comment', label: 'افزودن کامنت' },
          { key: 'add_checklist', label: 'مدیریت چک‌لیست' },
          { key: 'add_attachment', label: 'افزودن پیوست' },
          { key: 'update_progress', label: 'به‌روزرسانی پیشرفت' },
        ]
      },
      {
        key: 'ptms_kanban',
        label: 'تخته کانبان',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'move_card', label: 'جابجایی کارت' },
          { key: 'create', label: 'ایجاد وظیفه' },
        ]
      },
      {
        key: 'ptms_calendar',
        label: 'تقویم وظایف',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'view_all', label: 'مشاهده همه کاربران' },
        ]
      },
      {
        key: 'ptms_overdue',
        label: 'وظایف معوقه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'view_all', label: 'مشاهده همه' },
        ]
      },
      {
        key: 'ptms_financial',
        label: 'مالی پروژه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'view_budget', label: 'مشاهده بودجه' },
          { key: 'register_cost', label: 'ثبت هزینه' },
          { key: 'edit_cost', label: 'ویرایش هزینه' },
          { key: 'delete_cost', label: 'حذف هزینه' },
          { key: 'view_evm', label: 'مشاهده EVM' },
          { key: 'export', label: 'خروجی گزارش مالی' },
        ]
      },
      {
        key: 'ptms_risks',
        label: 'ریسک‌ها',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'view_matrix', label: 'مشاهده ماتریس ریسک' },
          { key: 'change_status', label: 'تغییر وضعیت' },
        ]
      },
      {
        key: 'ptms_issues',
        label: 'مسائل و مشکلات',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'resolve', label: 'حل مسئله' },
          { key: 'assign', label: 'واگذاری' },
        ]
      },
      {
        key: 'ptms_changes',
        label: 'درخواست تغییر',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'approve', label: 'تأیید' },
          { key: 'reject', label: 'رد' },
          { key: 'delete', label: 'حذف' },
          { key: 'execute', label: 'اجرا' },
        ]
      },
      {
        key: 'ptms_documents',
        label: 'مستندات پروژه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'upload', label: 'آپلود' },
          { key: 'download', label: 'دانلود' },
          { key: 'delete', label: 'حذف' },
          { key: 'edit_info', label: 'ویرایش اطلاعات' },
        ]
      },
      {
        key: 'ptms_charter',
        label: 'منشور پروژه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'print', label: 'چاپ' },
        ]
      },
      {
        key: 'ptms_reports',
        label: 'گزارشات پروژه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'export_excel', label: 'خروجی Excel' },
          { key: 'print', label: 'چاپ' },
          { key: 'view_analytics', label: 'مشاهده تحلیل‌ها' },
        ]
      },
    ]
  },
  {
    key: 'tickets',
    label: 'تیکت‌ها',
    icon: '🎫',
    permissions: [
      {
        key: 'tickets_main',
        label: 'تیکت‌ها',
        actions: [
          { key: 'view_all', label: 'مشاهده همه تیکت‌ها' },
          { key: 'view_own', label: 'مشاهده تیکت‌های خود' },
          { key: 'create', label: 'ایجاد تیکت' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'reply', label: 'پاسخ دادن' },
          { key: 'close', label: 'بستن تیکت' },
          { key: 'delete', label: 'حذف' },
          { key: 'assign', label: 'واگذاری' },
          { key: 'change_priority', label: 'تغییر اولویت' },
          { key: 'add_attachment', label: 'افزودن پیوست' },
        ]
      },
    ]
  },
  {
    key: 'contacts',
    label: 'مخاطبین',
    icon: '👥',
    permissions: [
      {
        key: 'contacts_main',
        label: 'مخاطبین',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'import', label: 'ایمپورت' },
          { key: 'export', label: 'اکسپورت' },
          { key: 'view_details', label: 'مشاهده جزئیات' },
        ]
      },
    ]
  },
  {
    key: 'sms',
    label: 'پیامک',
    icon: '📱',
    permissions: [
      {
        key: 'sms_main',
        label: 'پیامک',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'send_single', label: 'ارسال تکی' },
          { key: 'send_group', label: 'ارسال گروهی' },
          { key: 'view_report', label: 'مشاهده گزارش' },
          { key: 'manage_templates', label: 'مدیریت قالب‌ها' },
          { key: 'view_credit', label: 'مشاهده اعتبار' },
        ]
      },
    ]
  },
  {
    key: 'forms',
    label: 'فرم‌های سازمانی',
    icon: '📋',
    permissions: [
      {
        key: 'forms_access',
        label: 'دسترسی به فرم‌ها',
        actions: [
          { key: 'leave_daily', label: 'مرخصی روزانه' },
          { key: 'leave_hourly', label: 'مرخصی ساعتی' },
          { key: 'mission', label: 'ماموریت' },
          { key: 'loan', label: 'وام' },
          { key: 'payslip', label: 'فیش حقوقی' },
          { key: 'resignation', label: 'استعفا' },
          { key: 'equipment', label: 'تحویل تجهیزات' },
          { key: 'personnel', label: 'مشخصات پرسنلی' },
        ]
      },
      {
        key: 'forms_manage',
        label: 'مدیریت فرم‌ها',
        actions: [
          { key: 'approve', label: 'تأیید فرم' },
          { key: 'reject', label: 'رد فرم' },
          { key: 'return', label: 'برگشت برای اصلاح' },
          { key: 'view_all', label: 'مشاهده همه فرم‌ها' },
        ]
      },
    ]
  },
  
  {
    key: 'reports',
    label: 'گزارشات',
    icon: '📈',
    permissions: [
      {
        key: 'reports_main',
        label: 'گزارشات',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد گزارش' },
          { key: 'export_excel', label: 'خروجی Excel' },
          { key: 'export_pdf', label: 'خروجی PDF' },
          { key: 'print', label: 'چاپ' },
          { key: 'schedule', label: 'زمان‌بندی گزارش' },
        ]
      },
    ]
  },
  {
    key: 'chat',
    label: 'چت داخلی',
    icon: '💬',
    permissions: [
      {
        key: 'chat_main',
        label: 'چت داخلی',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'send', label: 'ارسال پیام' },
          { key: 'create_group', label: 'ایجاد گروه' },
          { key: 'delete_own', label: 'حذف پیام خود' },
          { key: 'delete_all', label: 'حذف پیام همه' },
          { key: 'send_file', label: 'ارسال فایل' },
        ]
      },
    ]
  },
  {
    key: 'ai',
    label: 'دستیار هوشمند',
    icon: '🤖',
    permissions: [
      {
        key: 'ai_main',
        label: 'دستیار هوشمند',
        actions: [
          { key: 'access', label: 'دسترسی به AI' },
          { key: 'use_analysis', label: 'تحلیل اسناد' },
          { key: 'use_generation', label: 'تولید محتوا' },
          { key: 'view_history', label: 'مشاهده تاریخچه' },
        ]
      },
    ]
  },
  {
    key: 'company',
    label: 'اطلاعات شرکت',
    icon: '🏢',
    permissions: [
      {
        key: 'company_main',
        label: 'اطلاعات شرکت',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'manage_logo', label: 'مدیریت لوگو' },
        ]
      },
    ]
  },
  {
    key: 'users',
    label: 'مدیریت کاربران',
    icon: '👤',
    permissions: [
      {
        key: 'users_main',
        label: 'کاربران',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد کاربر' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'change_password', label: 'تغییر رمز' },
          { key: 'toggle_active', label: 'فعال/غیرفعال' },
          { key: 'assign_role', label: 'تخصیص نقش' },
          { key: 'view_activity', label: 'مشاهده فعالیت‌ها' },
        ]
      },
      {
        key: 'users_roles',
        label: 'نقش‌ها و دسترسی‌ها',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد نقش' },
          { key: 'edit', label: 'ویرایش نقش' },
          { key: 'delete', label: 'حذف نقش' },
          { key: 'assign', label: 'تخصیص به کاربر' },
        ]
      },
    ]
  },
  {
    key: 'settings',
    label: 'تنظیمات',
    icon: '⚙️',
    permissions: [
      {
        key: 'settings_company_mode',
        label: 'حالت شرکت',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'edit', label: 'ویرایش' },
        ]
      },
      {
        key: 'settings_general',
        label: 'تنظیمات عمومی',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'manage_departments', label: 'مدیریت دپارتمان‌ها' },
          { key: 'manage_titles', label: 'مدیریت عناوین' },
          { key: 'manage_security', label: 'مدیریت امنیت' },
        ]
      },
      {
        key: 'settings_registry',
        label: 'تنظیمات دبیرخانه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد دبیرخانه' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'manage_format', label: 'مدیریت فرمت' },
          { key: 'manage_counter', label: 'مدیریت شمارنده' },
          { key: 'manage_access', label: 'مدیریت دسترسی‌ها' },
        ]
      },
      {
        key: 'settings_folders',
        label: 'پرونده‌ها',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'manage_access', label: 'مدیریت دسترسی' },
        ]
      },
      {
        key: 'settings_templates',
        label: 'قالب نامه',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'create', label: 'ایجاد' },
          { key: 'edit', label: 'ویرایش' },
          { key: 'delete', label: 'حذف' },
          { key: 'upload', label: 'آپلود قالب' },
          { key: 'set_default', label: 'تنظیم پیش‌فرض' },
        ]
      },
      {
        key: 'settings_orgchart',
        label: 'چارت سازمانی',
        actions: [
          { key: 'view', label: 'مشاهده' },
          { key: 'manage_positions', label: 'مدیریت سمت‌ها' },
          { key: 'manage_members', label: 'مدیریت اعضا' },
          { key: 'assign_head', label: 'تعیین سرپرست' },
        ]
      },
    ]
  },

{
  key: 'calendar',
  label: 'تقویم',
  icon: '📅',
  permissions: [
    {
      key: 'calendar_manage',
      label: 'مدیریت تقویم‌ها',
      actions: [
        { key: 'create_calendar', label: 'ایجاد تقویم جدید' },
        { key: 'edit_calendar', label: 'ویرایش تقویم' },
        { key: 'delete_calendar', label: 'حذف تقویم' },
        { key: 'manage_access', label: 'مدیریت دسترسی تقویم' },
      ]
    },
    {
      key: 'calendar_events',
      label: 'رویدادهای تقویم',
      actions: [
        { key: 'view', label: 'مشاهده تقویم' },
        { key: 'view_all', label: 'مشاهده تقویم همه کاربران' },
        { key: 'create_event', label: 'ایجاد رویداد' },
        { key: 'edit_event', label: 'ویرایش رویداد' },
        { key: 'delete_event', label: 'حذف رویداد' },
        { key: 'view_detail', label: 'مشاهده جزئیات رویداد' },
        { key: 'invite_users', label: 'دعوت کاربران به رویداد' },
      ]
    },
  ]
},

]
