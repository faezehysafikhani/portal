export type ProjectStatus = 'تعریف شده' | 'در حال اجرا' | 'تعلیق' | 'تکمیل شده' | 'لغو شده'
export type Priority = 'بحرانی' | 'بالا' | 'متوسط' | 'پایین'
export type TaskStatus = 'جدید' | 'در حال انجام' | 'در انتظار بازبینی' | 'تکمیل شده' | 'لغو شده'
export type RiskLevel = 'پایین' | 'متوسط' | 'بالا' | 'بحرانی'

export interface Portfolio {
  id: string; name: string; code: string; manager: string
  status: 'فعال' | 'غیرفعال' | 'آرشیو'; startDate: string; endDate: string
  budget: number; projectCount: number; progress: number; description?: string
}

export interface TeamMember {
  id: string; name: string; role: string; allocation: number
  startDate: string; endDate?: string
}

export interface Project {
  id: string; code: string; name: string; portfolioId?: string; portfolio?: string
  manager: string; sponsor?: string; status: ProjectStatus; priority: Priority
  progress: number; startDate: string; endDate: string; actualStartDate?: string
  actualEndDate?: string; budget: number; actualCost: number
  type: 'عمرانی' | 'IT' | 'تحقیقاتی' | 'سازمانی' | 'سایر'
  method: 'آبشاری' | 'چابک' | 'ترکیبی'; description?: string
  team: TeamMember[]; riskCount: number; issueCount: number; taskCount: number
}

export interface ChecklistItem { id: string; title: string; done: boolean }
export interface TaskComment { id: string; author: string; text: string; date: string }

export interface Task {
  id: string; code: string; title: string; projectId: string; project: string
  type: 'وظیفه' | 'باگ' | 'بهبود' | 'بازبینی'; priority: Priority; status: TaskStatus
  assignee: string; supervisor?: string; startDate?: string; deadline?: string
  completedDate?: string; estimatedHours: number; actualHours: number; progress: number
  tags: string[]; description?: string; checklist: ChecklistItem[]; comments: TaskComment[]
}

export interface Risk {
  id: string; code: string; title: string; projectId: string; project: string
  category: 'فنی' | 'مالی' | 'سازمانی' | 'خارجی' | 'زمانبندی' | 'کیفیت'
  probability: 1 | 2 | 3 | 4 | 5; impact: 1 | 2 | 3 | 4 | 5
  score: number; level: RiskLevel; strategy: 'اجتناب' | 'کاهش' | 'انتقال' | 'پذیرش'
  status: 'شناسایی شده' | 'فعال' | 'بسته شده' | 'رخ داده'
  owner: string; identifiedDate: string; actionDeadline?: string
  description?: string; response?: string
}

export interface Issue {
  id: string; code: string; title: string; projectId: string; project: string
  priority: Priority; severity: 'مسدودکننده' | 'عمده' | 'جزئی'
  status: 'باز' | 'در حال بررسی' | 'حل شده' | 'بسته'
  assignee: string; reporter: string; registeredDate: string
  deadline?: string; resolvedDate?: string; description?: string; solution?: string
}

export interface ChangeRequest {
  id: string; code: string; title: string; projectId: string; project: string
  priority: Priority; status: 'ثبت شده' | 'در حال بررسی' | 'تأیید شده' | 'رد شده' | 'اجرا شده'
  requester: string; approver?: string; requestDate: string; approvalDate?: string
  scopeImpact?: string; timeImpact: number; costImpact: number
  description?: string; reason?: string
}

export interface ProjectDoc {
  id: string; title: string
  category: 'قرارداد' | 'نقشه' | 'مکاتبه' | 'صورتجلسه' | 'گزارش' | 'سایر'
  projectId?: string; project?: string; version: string; size: string
  uploader: string; uploadDate: string; tags: string[]; description?: string
}

export interface Cost {
  id: string; projectId: string; description: string
  category: 'نیروی انسانی' | 'مواد' | 'تجهیزات' | 'پیمانکاری' | 'سربار' | 'سایر'
  wbsItem?: string; estimated: number; actual: number; date: string; invoiceNumber?: string
}

export const USERS = ['مدیر سیستم', 'علی محمدی', 'مریم احمدی', 'رضا کریمی', 'سارا نوری', 'امیر حسینی', 'فاطمه رضایی', 'محمد کریمی']

export const SAMPLE_PORTFOLIOS: Portfolio[] = [
  { id: '1', name: 'سبد پروژه‌های IT', code: 'PF-IT-001', manager: 'مدیر سیستم', status: 'فعال', startDate: '۱۴۰۳/۰۱/۰۱', endDate: '۱۴۰۳/۱۲/۲۹', budget: 5000000000, projectCount: 3, progress: 45 },
  { id: '2', name: 'سبد پروژه‌های عمرانی', code: 'PF-CV-001', manager: 'علی محمدی', status: 'فعال', startDate: '۱۴۰۲/۰۷/۰۱', endDate: '۱۴۰۴/۰۶/۳۱', budget: 12000000000, projectCount: 2, progress: 30 },
]

export const SAMPLE_PROJECTS: Project[] = [
  {
    id: '1', code: 'PRJ-001', name: 'سامانه یکپارچه سازمانی',
    portfolioId: '1', portfolio: 'سبد پروژه‌های IT',
    manager: 'مدیر سیستم', sponsor: 'علی محمدی',
    status: 'در حال اجرا', priority: 'بالا', progress: 45,
    startDate: '۱۴۰۳/۰۱/۰۱', endDate: '۱۴۰۳/۱۲/۲۹',
    budget: 2000000000, actualCost: 850000000, type: 'IT', method: 'چابک',
    team: [
      { id: '1', name: 'مدیر سیستم', role: 'مدیر پروژه', allocation: 100, startDate: '۱۴۰۳/۰۱/۰۱' },
      { id: '2', name: 'علی محمدی', role: 'کارشناس فنی', allocation: 80, startDate: '۱۴۰۳/۰۱/۰۱' },
      { id: '3', name: 'مریم احمدی', role: 'طراح UI', allocation: 60, startDate: '۱۴۰۳/۰۲/۰۱' },
    ],
    riskCount: 3, issueCount: 2, taskCount: 12
  },
  {
    id: '2', code: 'PRJ-002', name: 'پروژه توسعه زیرساخت',
    portfolioId: '1', portfolio: 'سبد پروژه‌های IT',
    manager: 'علی محمدی', sponsor: 'مدیر سیستم',
    status: 'تعریف شده', priority: 'متوسط', progress: 10,
    startDate: '۱۴۰۳/۰۳/۰۱', endDate: '۱۴۰۳/۰۹/۳۰',
    budget: 800000000, actualCost: 50000000, type: 'IT', method: 'آبشاری',
    team: [{ id: '1', name: 'علی محمدی', role: 'مدیر پروژه', allocation: 100, startDate: '۱۴۰۳/۰۳/۰۱' }],
    riskCount: 1, issueCount: 0, taskCount: 5
  },
  {
    id: '3', code: 'PRJ-003', name: 'ساختمان اداری شعبه مشهد',
    portfolioId: '2', portfolio: 'سبد پروژه‌های عمرانی',
    manager: 'رضا کریمی', sponsor: 'مدیر سیستم',
    status: 'در حال اجرا', priority: 'بحرانی', progress: 65,
    startDate: '۱۴۰۲/۰۷/۰۱', endDate: '۱۴۰۴/۰۶/۳۱',
    budget: 8000000000, actualCost: 4200000000, type: 'عمرانی', method: 'آبشاری',
    team: [
      { id: '1', name: 'رضا کریمی', role: 'مدیر پروژه', allocation: 100, startDate: '۱۴۰۲/۰۷/۰۱' },
      { id: '2', name: 'سارا نوری', role: 'مهندس عمران', allocation: 100, startDate: '۱۴۰۲/۰۷/۰۱' },
    ],
    riskCount: 5, issueCount: 3, taskCount: 28
  },
]

export const SAMPLE_TASKS: Task[] = [
  {
    id: '1', code: 'TSK-001', title: 'طراحی معماری سیستم',
    projectId: '1', project: 'سامانه یکپارچه سازمانی',
    type: 'وظیفه', priority: 'بالا', status: 'تکمیل شده',
    assignee: 'مدیر سیستم', supervisor: 'مدیر سیستم',
    startDate: '۱۴۰۳/۰۱/۰۱', deadline: '۱۴۰۳/۰۱/۳۱', completedDate: '۱۴۰۳/۰۱/۲۸',
    estimatedHours: 40, actualHours: 35, progress: 100,
    tags: ['معماری', 'طراحی'], description: 'طراحی معماری کامل سیستم',
    checklist: [
      { id: '1', title: 'تحلیل نیازمندی‌ها', done: true },
      { id: '2', title: 'طراحی دیاگرام', done: true },
      { id: '3', title: 'مستندسازی', done: true },
    ],
    comments: [{ id: '1', author: 'مدیر سیستم', text: 'عالی بود!', date: '۱۴۰۳/۰۱/۲۸' }]
  },
  {
    id: '2', code: 'TSK-002', title: 'پیاده‌سازی ماژول نامه‌نگاری',
    projectId: '1', project: 'سامانه یکپارچه سازمانی',
    type: 'وظیفه', priority: 'بالا', status: 'در حال انجام',
    assignee: 'مریم احمدی', supervisor: 'مدیر سیستم',
    startDate: '۱۴۰۳/۰۲/۰۱', deadline: '۱۴۰۳/۰۴/۳۰',
    estimatedHours: 80, actualHours: 45, progress: 60,
    tags: ['frontend', 'نامه'], description: 'پیاده‌سازی کامل ماژول نامه‌نگاری',
    checklist: [
      { id: '1', title: 'طراحی UI', done: true },
      { id: '2', title: 'پیاده‌سازی فرم نامه', done: true },
      { id: '3', title: 'کارتابل نامه', done: false },
    ],
    comments: []
  },
  {
    id: '3', code: 'TSK-003', title: 'نصب و راه‌اندازی سرور',
    projectId: '2', project: 'پروژه توسعه زیرساخت',
    type: 'وظیفه', priority: 'بحرانی', status: 'جدید',
    assignee: 'علی محمدی', deadline: '۱۴۰۳/۰۳/۱۵',
    estimatedHours: 16, actualHours: 0, progress: 0,
    tags: ['زیرساخت'], description: 'نصب و پیکربندی سرورهای جدید',
    checklist: [], comments: []
  },
  {
    id: '4', code: 'TSK-004', title: 'تهیه نقشه‌های اجرایی',
    projectId: '3', project: 'ساختمان اداری شعبه مشهد',
    type: 'وظیفه', priority: 'بالا', status: 'در انتظار بازبینی',
    assignee: 'سارا نوری', supervisor: 'رضا کریمی',
    startDate: '۱۴۰۳/۰۱/۰۱', deadline: '۱۴۰۳/۰۲/۳۱',
    estimatedHours: 120, actualHours: 115, progress: 95,
    tags: ['نقشه'], description: 'تهیه نقشه‌های اجرایی کامل',
    checklist: [
      { id: '1', title: 'نقشه معماری', done: true },
      { id: '2', title: 'نقشه سازه', done: true },
      { id: '3', title: 'نقشه تأسیسات', done: false },
    ],
    comments: []
  },
  {
    id: '5', code: 'TSK-005', title: 'بروزرسانی مستندات فنی',
    projectId: '1', project: 'سامانه یکپارچه سازمانی',
    type: 'بهبود', priority: 'پایین', status: 'جدید',
    assignee: 'مریم احمدی', deadline: '۱۴۰۳/۰۵/۰۱',
    estimatedHours: 8, actualHours: 0, progress: 0,
    tags: ['مستند'], description: 'بروزرسانی مستندات فنی سیستم',
    checklist: [], comments: []
  },
]

export const SAMPLE_RISKS: Risk[] = [
  {
    id: '1', code: 'RSK-001', title: 'تأخیر در تحویل زیرساخت',
    projectId: '1', project: 'سامانه یکپارچه سازمانی',
    category: 'فنی', probability: 3, impact: 4, score: 12, level: 'بالا',
    strategy: 'کاهش', status: 'فعال', owner: 'علی محمدی',
    identifiedDate: '۱۴۰۳/۰۱/۱۵', actionDeadline: '۱۴۰۳/۰۳/۰۱',
    description: 'احتمال تأخیر در تحویل زیرساخت سخت‌افزاری',
    response: 'تأمین زیرساخت موازی'
  },
  {
    id: '2', code: 'RSK-002', title: 'افزایش هزینه‌های ساخت',
    projectId: '3', project: 'ساختمان اداری شعبه مشهد',
    category: 'مالی', probability: 4, impact: 5, score: 20, level: 'بحرانی',
    strategy: 'کاهش', status: 'فعال', owner: 'رضا کریمی',
    identifiedDate: '۱۴۰۲/۰۸/۰۱',
    description: 'افزایش قیمت مصالح ساختمانی',
    response: 'خرید مصالح به صورت پیش‌خرید'
  },
  {
    id: '3', code: 'RSK-003', title: 'کمبود نیروی متخصص',
    projectId: '1', project: 'سامانه یکپارچه سازمانی',
    category: 'سازمانی', probability: 2, impact: 3, score: 6, level: 'متوسط',
    strategy: 'پذیرش', status: 'شناسایی شده', owner: 'مدیر سیستم',
    identifiedDate: '۱۴۰۳/۰۲/۰۱',
    description: 'احتمال کمبود توسعه‌دهنده متخصص'
  },
]

export const SAMPLE_ISSUES: Issue[] = [
  {
    id: '1', code: 'ISS-001', title: 'خطا در محاسبه بودجه',
    projectId: '1', project: 'سامانه یکپارچه سازمانی',
    priority: 'بالا', severity: 'عمده', status: 'در حال بررسی',
    assignee: 'علی محمدی', reporter: 'مریم احمدی',
    registeredDate: '۱۴۰۳/۰۳/۰۱', deadline: '۱۴۰۳/۰۳/۱۵',
    description: 'محاسبه بودجه در ماژول مالی دارای خطا است'
  },
  {
    id: '2', code: 'ISS-002', title: 'تأخیر در تحویل مصالح',
    projectId: '3', project: 'ساختمان اداری شعبه مشهد',
    priority: 'بحرانی', severity: 'مسدودکننده', status: 'باز',
    assignee: 'رضا کریمی', reporter: 'سارا نوری',
    registeredDate: '۱۴۰۳/۰۲/۱۵', deadline: '۱۴۰۳/۰۲/۲۰',
    description: 'تأمین‌کننده مصالح در تحویل تأخیر دارد'
  },
]

export const SAMPLE_CHANGES: ChangeRequest[] = [
  {
    id: '1', code: 'CHG-001', title: 'افزودن ماژول پیامک',
    projectId: '1', project: 'سامانه یکپارچه سازمانی',
    priority: 'متوسط', status: 'در حال بررسی',
    requester: 'مریم احمدی', approver: 'مدیر سیستم',
    requestDate: '۱۴۰۳/۰۳/۰۵', timeImpact: 15, costImpact: 50000000,
    description: 'افزودن قابلیت ارسال پیامک به سیستم',
    reason: 'نیاز کاربران به اطلاع‌رسانی از طریق پیامک'
  },
  {
    id: '2', code: 'CHG-002', title: 'تغییر در پلان طبقه سوم',
    projectId: '3', project: 'ساختمان اداری شعبه مشهد',
    priority: 'بالا', status: 'تأیید شده',
    requester: 'رضا کریمی', approver: 'مدیر سیستم',
    requestDate: '۱۴۰۳/۰۱/۲۰', approvalDate: '۱۴۰۳/۰۲/۰۱',
    timeImpact: 30, costImpact: 200000000,
    description: 'تغییر در پلان معماری طبقه سوم',
    reason: 'بهینه‌سازی فضای اداری'
  },
]

export const SAMPLE_DOCUMENTS: ProjectDoc[] = [
  { id: '1', title: 'منشور پروژه سامانه یکپارچه', category: 'گزارش', projectId: '1', project: 'سامانه یکپارچه سازمانی', version: '1.2', size: '2.4 MB', uploader: 'مدیر سیستم', uploadDate: '۱۴۰۳/۰۱/۰۵', tags: ['منشور'] },
  { id: '2', title: 'قرارداد پیمانکاری ساختمان مشهد', category: 'قرارداد', projectId: '3', project: 'ساختمان اداری شعبه مشهد', version: '1.0', size: '5.1 MB', uploader: 'رضا کریمی', uploadDate: '۱۴۰۲/۰۷/۰۵', tags: ['قرارداد'] },
  { id: '3', title: 'نقشه‌های معماری طبقات', category: 'نقشه', projectId: '3', project: 'ساختمان اداری شعبه مشهد', version: '2.1', size: '18.7 MB', uploader: 'سارا نوری', uploadDate: '۱۴۰۳/۰۱/۱۰', tags: ['نقشه'] },
]

export const SAMPLE_COSTS: Cost[] = []

export const getPriorityColor = (p: Priority): string => {
  switch (p) {
    case 'بحرانی': return 'red'
    case 'بالا': return 'orange'
    case 'متوسط': return 'gold'
    case 'پایین': return 'green'
    default: return 'default'
  }
}

export const getStatusColor = (s: ProjectStatus | TaskStatus): string => {
  switch (s) {
    case 'در حال اجرا': case 'در حال انجام': return 'blue'
    case 'تکمیل شده': return 'green'
    case 'تعلیق': case 'در انتظار بازبینی': return 'orange'
    case 'لغو شده': return 'red'
    default: return 'default'
  }
}

export const getRiskLevelColor = (level: RiskLevel): string => {
  switch (level) {
    case 'بحرانی': return '#f5222d'
    case 'بالا': return '#fa8c16'
    case 'متوسط': return '#fadb14'
    case 'پایین': return '#52c41a'
    default: return '#52c41a'
  }
}

export const formatCurrency = (n: number): string =>
  new Intl.NumberFormat('fa-IR').format(n) + ' ریال'