export const API = 'http://localhost:5043/api/v1'

export const categoryLabel: Record<string, string> = {
  Planned: 'برنامه‌ریزی‌شده', Extra: 'خودافزوده', Support: 'پشتیبانی/فوری', Improvement: 'بهبود', Admin: 'اداری/جلسه',
}
export const priorityLabel: Record<string, string> = { Low: 'پایین', Medium: 'متوسط', High: 'بالا', Critical: 'بحرانی' }
export const priorityColor: Record<string, string> = { Low: 'default', Medium: 'blue', High: 'orange', Critical: 'red' }
export const statusLabel: Record<string, string> = { Todo: 'برای انجام', InProgress: 'در حال انجام', InReview: 'منتظر تأیید', Done: 'تکمیل‌شده', Cancelled: 'لغوشده' }
export const creationApprovalLabel: Record<string, string> = { Pending: 'در انتظار تأیید', Approved: 'تأییدشده', Rejected: 'ردشده' }
export const creationApprovalColor: Record<string, string> = { Pending: 'gold', Approved: 'green', Rejected: 'red' }
export const evaluationStatusLabel: Record<string, string> = { Draft: 'پیش‌نویس', PendingReview: 'در انتظار بازبینی', Finalized: 'نهایی‌شده' }
export const evaluationStatusColor: Record<string, string> = { Draft: 'default', PendingReview: 'gold', Finalized: 'green' }
export const bandLabel: Record<string, string> = {
  Exceptional: 'فوق‌العاده', Excellent: 'عالی', Good: 'خوب', NeedsImprovement: 'نیازمند بهبود', PerformanceReview: 'نیازمند بازبینی جدی',
}
export const bandColor: Record<string, string> = {
  Exceptional: '#52c41a', Excellent: '#1677ff', Good: '#722ed1', NeedsImprovement: '#fa8c16', PerformanceReview: '#f5222d',
}
// دوره‌های ارزیابی بر اساس ماه میلادی محاسبه می‌شوند (هم‌راستا با محاسبه‌ی بازه در بک‌اند).
export const monthNames = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر']

export function currentUser(): { id?: string; fullName?: string } {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
}
export function permissionState() {
  const user = currentUser() as { roles?: string[] }
  const granted: string[] = (() => { try { return JSON.parse(localStorage.getItem('permissions') || '[]') } catch { return [] } })()
  const isAdmin = Array.isArray(user.roles) && user.roles.includes('Admin')
  const allowed = (code: string) => isAdmin || granted.includes(code)
  return { isAdmin, allowed, canManage: allowed('performance.manage') || allowed('performance.admin'), canAdmin: allowed('performance.admin') }
}

export interface DirectoryUser { id: string; fullName?: string; username?: string; position?: string; department?: string }

export interface PerformanceTask {
  id: string; title: string; description?: string; status: string; priority: string; category?: string
  complexity?: number; impactScore?: number; taskPoint?: number | null; isSelfAdded: boolean
  creationApprovalStatus: string; qualityRating?: number; dueDate?: string; assignedByUserId: string
  assignedToUserId?: string; assigneeUserIds: string[]; isCompletionApproved: boolean
}

export interface EvaluationRow {
  id: string; userId: string; periodYear: number; periodMonth: number; finalScore?: number | null
  scoreBand?: string | null; status: string; reviewerUserId?: string; rewardDecision?: string | null
  rewardNotes?: string | null; componentScores?: Record<string, number>; userName?: string
}
