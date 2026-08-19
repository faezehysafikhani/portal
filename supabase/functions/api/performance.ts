import { SupabaseClient } from '@supabase/supabase-js'
import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json, uuid } from '../_shared/http.ts'
import { createNotification, notificationType } from '../_shared/notifications.ts'

type Obj = Record<string, any>
const db = adminClient()
const now = () => new Date().toISOString()
const baseInsert = (auth: AuthContext): Obj => ({
  Id: uuid(), TenantId: auth.tenantId, CreatedAt: now(), UpdatedAt: null,
  CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null,
})
function check(error: { message: string } | null, fallback = 'خطا در دسترسی به پایگاه داده'): void {
  if (error) { console.error(error.message); throw new HttpError(500, fallback) }
}

const evaluationStatus = ['Draft', 'PendingReview', 'Finalized']
const appealStatus = ['Pending', 'Reviewed', 'Resolved']
const priorityFactor: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 5 }
const taskPriorityNames = ['Low', 'Medium', 'High', 'Critical']

interface Settings {
  Id?: string
  WeightTaskCompletion: number; WeightQuality: number; WeightTimeliness: number
  WeightManagerQualitative: number; WeightReportingDiscipline: number
  SelfAddedCapPercent: number; ManagerQualitativeCapPercent: number
  BandExceptionalMin: number; BandExcellentMin: number; BandGoodMin: number; BandNeedsImprovementMin: number
}
const DEFAULT_SETTINGS: Settings = {
  WeightTaskCompletion: 35, WeightQuality: 20, WeightTimeliness: 20,
  WeightManagerQualitative: 20, WeightReportingDiscipline: 5,
  SelfAddedCapPercent: 20, ManagerQualitativeCapPercent: 20,
  BandExceptionalMin: 90, BandExcellentMin: 80, BandGoodMin: 70, BandNeedsImprovementMin: 60,
}

async function loadSettings(tenantId: string): Promise<Settings> {
  const result = await db.from('PerformanceSettings').select('*').eq('TenantId', tenantId).eq('IsDeleted', false).maybeSingle()
  check(result.error)
  if (!result.data) return DEFAULT_SETTINGS
  const row = result.data as Obj
  return {
    Id: row.Id,
    WeightTaskCompletion: Number(row.WeightTaskCompletion), WeightQuality: Number(row.WeightQuality),
    WeightTimeliness: Number(row.WeightTimeliness), WeightManagerQualitative: Number(row.WeightManagerQualitative),
    WeightReportingDiscipline: Number(row.WeightReportingDiscipline),
    SelfAddedCapPercent: Number(row.SelfAddedCapPercent), ManagerQualitativeCapPercent: Number(row.ManagerQualitativeCapPercent),
    BandExceptionalMin: Number(row.BandExceptionalMin), BandExcellentMin: Number(row.BandExcellentMin),
    BandGoodMin: Number(row.BandGoodMin), BandNeedsImprovementMin: Number(row.BandNeedsImprovementMin),
  }
}

function scoreBand(score: number, s: Settings): string {
  if (score >= s.BandExceptionalMin) return 'Exceptional'
  if (score >= s.BandExcellentMin) return 'Excellent'
  if (score >= s.BandGoodMin) return 'Good'
  if (score >= s.BandNeedsImprovementMin) return 'NeedsImprovement'
  return 'PerformanceReview'
}

export async function findReviewerFor(db: SupabaseClient, tenantId: string, employeeUserId: string): Promise<string | null> {
  const result = await db.from('PerformanceReviewers').select('ReviewerUserId')
    .eq('TenantId', tenantId).eq('EmployeeUserId', employeeUserId).eq('IsActive', true).eq('IsDeleted', false).maybeSingle()
  if (result.error) { console.error(result.error.message); return null }
  return result.data ? String((result.data as Obj).ReviewerUserId) : null
}

function canManage(auth: AuthContext): boolean {
  return auth.isAdmin || auth.permissions.includes('performance.manage') || auth.permissions.includes('performance.admin')
}
function isAdminScope(auth: AuthContext): boolean {
  return auth.isAdmin || auth.permissions.includes('performance.admin')
}
async function canViewUser(auth: AuthContext, targetUserId: string): Promise<boolean> {
  if (targetUserId === auth.userId) return true
  if (isAdminScope(auth)) return true
  if (!auth.permissions.includes('performance.manage')) return false
  const reviewerId = await findReviewerFor(db, auth.tenantId, targetUserId)
  return reviewerId === auth.userId
}

function evaluationDto(item: Obj): Obj {
  const result = camelize(item) as Obj
  result.status = typeof item.Status === 'number' ? evaluationStatus[item.Status] : item.Status
  try { result.componentScores = JSON.parse(String(item.ComponentScoresJson ?? '{}')) } catch { result.componentScores = {} }
  delete result.componentScoresJson
  return result
}

async function userDisplayNames(tenantId: string, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map()
  const result = await db.from('Users').select('Id,FirstName,LastName').eq('TenantId', tenantId).in('Id', [...new Set(userIds)])
  check(result.error)
  return new Map((result.data ?? []).map((u: Obj) => [String(u.Id), `${u.FirstName ?? ''} ${u.LastName ?? ''}`.trim()]))
}

// ---- Weekly bilan (computed live, nothing persisted) ----

async function weeklyReport(request: Request, auth: AuthContext, url: URL): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const targetUserId = url.searchParams.get('userId') || auth.userId
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new HttpError(400, 'شناسه کاربر نامعتبر است')
  if (!(await canViewUser(auth, targetUserId))) throw new HttpError(403, 'شما مجوز مشاهده گزارش این کاربر را ندارید')
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10)
  const fromDefault = new Date(to); fromDefault.setUTCDate(fromDefault.getUTCDate() - 6)
  const from = url.searchParams.get('from') || fromDefault.toISOString().slice(0, 10)

  const result = await db.from('Tasks').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    .or(`AssignedToUserId.eq.${targetUserId},AssigneeUserIdsJson.ilike.%${targetUserId}%`)
  check(result.error)
  const all = (result.data ?? []) as Obj[]
  const inWindow = (dateStr: unknown) => { if (!dateStr) return false; const d = String(dateStr).slice(0, 10); return d >= from && d <= to }
  const planned = all.filter((t) => inWindow(t.DueDate))
  const completed = planned.filter((t) => Number(t.Status) === 3 && Boolean(t.IsCompletionApproved))
  const inProgress = planned.filter((t) => [0, 1, 2].includes(Number(t.Status)))
  const overdue = planned.filter((t) => Number(t.Status) !== 3 && String(t.DueDate).slice(0, 10) < new Date().toISOString().slice(0, 10))
  const extraCompleted = all.filter((t) => Boolean(t.IsSelfAdded) && inWindow(t.CompletionApprovedAt))
  const onTime = completed.filter((t) => !t.DueDate || String(t.CompletionApprovedAt ?? '') <= String(t.DueDate ?? '') + 'T23:59:59')
  const commitmentPercent = planned.length ? Math.round((completed.length / planned.length) * 100) : null
  const onTimePercent = completed.length ? Math.round((onTime.length / completed.length) * 100) : null

  return json(request, {
    userId: targetUserId, from, to,
    plannedCount: planned.length, completedCount: completed.length, inProgressCount: inProgress.length,
    overdueCount: overdue.length, extraCompletedCount: extraCompleted.length,
    commitmentPercent, onTimePercent,
    overdueTasks: overdue.map((t) => ({ id: t.Id, title: t.Title, dueDate: t.DueDate })),
  })
}

// ---- Evaluations ----

async function listEvaluations(request: Request, auth: AuthContext, url: URL): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const targetUserId = url.searchParams.get('userId') || auth.userId
  if (!(await canViewUser(auth, targetUserId))) throw new HttpError(403, 'شما مجوز مشاهده ارزیابی این کاربر را ندارید')
  let query = db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('UserId', targetUserId)
  const status = url.searchParams.get('status')
  if (status) query = query.eq('Status', evaluationStatus.findIndex((s) => s.toLowerCase() === status.toLowerCase()))
  const result = await query.order('PeriodYear', { ascending: false }).order('PeriodMonth', { ascending: false })
  check(result.error)
  return json(request, (result.data ?? []).map(evaluationDto))
}

async function pendingReviewEvaluations(request: Request, auth: AuthContext): Promise<Response> {
  if (!canManage(auth)) throw new HttpError(403, 'شما مجوز بازبینی ارزیابی را ندارید')
  let query = db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('Status', 1)
  if (!isAdminScope(auth)) query = query.eq('ReviewerUserId', auth.userId)
  const result = await query.order('PeriodYear', { ascending: false }).order('PeriodMonth', { ascending: false })
  check(result.error)
  const rows = (result.data ?? []) as Obj[]
  const names = await userDisplayNames(auth.tenantId, rows.map((r) => String(r.UserId)))
  return json(request, rows.map((r) => ({ ...evaluationDto(r), userName: names.get(String(r.UserId)) ?? '' })))
}

async function getEvaluation(request: Request, auth: AuthContext, id: string): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const result = await db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId).eq('Id', id).eq('IsDeleted', false).maybeSingle()
  check(result.error)
  const row = result.data as Obj | null
  if (!row) throw new HttpError(404, 'ارزیابی یافت نشد')
  const isReviewer = row.ReviewerUserId === auth.userId
  if (row.UserId !== auth.userId && !isReviewer && !isAdminScope(auth)) throw new HttpError(403, 'شما مجوز مشاهده این ارزیابی را ندارید')
  return json(request, evaluationDto(row))
}

async function logEvaluation(auth: AuthContext, evaluationId: string, action: string, details: Obj = {}): Promise<void> {
  const result = await db.from('PerformanceAuditLogs').insert({
    ...baseInsert(auth), EvaluationId: evaluationId, ActorUserId: auth.userId,
    Action: action.slice(0, 80), DetailsJson: JSON.stringify(details),
  })
  check(result.error, 'ثبت تاریخچه ارزیابی انجام نشد')
}

async function computeEvaluation(request: Request, auth: AuthContext): Promise<Response> {
  if (!canManage(auth)) throw new HttpError(403, 'شما مجوز محاسبه ارزیابی را ندارید')
  const input = await body<Obj>(request)
  const targetUserId = String(input.userId ?? '')
  const periodYear = Number(input.periodYear)
  const periodMonth = Number(input.periodMonth)
  if (!targetUserId || !periodYear || !periodMonth || periodMonth < 1 || periodMonth > 12) throw new HttpError(400, 'کاربر و دوره ماهانه معتبر الزامی است')
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new HttpError(400, 'شناسه کاربر نامعتبر است')
  const reviewerId = await findReviewerFor(db, auth.tenantId, targetUserId)
  if (!isAdminScope(auth) && auth.userId !== reviewerId) throw new HttpError(403, 'فقط ارزیاب این کارمند می‌تواند ارزیابی را محاسبه کند')

  const existing = await db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId)
    .eq('UserId', targetUserId).eq('PeriodYear', periodYear).eq('PeriodMonth', periodMonth).eq('IsDeleted', false).maybeSingle()
  check(existing.error)
  if (existing.data && Number((existing.data as Obj).Status) === 2) throw new HttpError(400, 'این ارزیابی نهایی شده است؛ ابتدا آن را بازگشایی کنید')

  const settings = await loadSettings(auth.tenantId)
  const monthStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1))
  const monthEnd = new Date(Date.UTC(periodYear, periodMonth, 1))

  const tasksResult = await db.from('Tasks').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    .or(`AssignedToUserId.eq.${targetUserId},AssigneeUserIdsJson.ilike.%${targetUserId}%`)
  check(tasksResult.error)
  const all = (tasksResult.data ?? []) as Obj[]
  const eligible = all.filter((t) => t.Complexity != null && t.ImpactScore != null && Number(t.CreationApprovalStatus) === 1)
  const taskPoint = (t: Obj) => Number(t.Complexity) * (priorityFactor[taskPriorityNames[Number(t.Priority)] ?? 'Low'] ?? 1) * Number(t.ImpactScore)
  const inMonth = (dateStr: unknown) => { if (!dateStr) return false; const d = new Date(String(dateStr)); return d >= monthStart && d < monthEnd }

  const planned = eligible.filter((t) => inMonth(t.DueDate))
  const plannedDone = planned.filter((t) => Number(t.Status) === 3 && Boolean(t.IsCompletionApproved))
  const extraDone = eligible.filter((t) => Number(t.Status) === 3 && Boolean(t.IsCompletionApproved) && inMonth(t.CompletionApprovedAt) && !planned.includes(t))
  const allDone = [...plannedDone, ...extraDone]

  const plannedPoints = planned.reduce((sum, t) => sum + taskPoint(t), 0)
  let contributingPoints = allDone.reduce((sum, t) => sum + taskPoint(t), 0)
  const selfAddedPoints = allDone.filter((t) => Boolean(t.IsSelfAdded)).reduce((sum, t) => sum + taskPoint(t), 0)
  const selfAddedCap = contributingPoints * (settings.SelfAddedCapPercent / 100)
  let cappedSelfAddedPoints = selfAddedPoints
  if (selfAddedPoints > selfAddedCap) {
    cappedSelfAddedPoints = selfAddedCap
    contributingPoints = contributingPoints - selfAddedPoints + cappedSelfAddedPoints
  }
  const taskCompletionScore = plannedPoints > 0
    ? Math.min(100, (contributingPoints / plannedPoints) * 100)
    : (allDone.length > 0 ? 100 : 0)

  const rated = allDone.filter((t) => t.QualityRating != null)
  const qualityScore = rated.length ? (rated.reduce((sum, t) => sum + Number(t.QualityRating), 0) / rated.length / 5) * 100 : 100

  const onTime = allDone.filter((t) => !t.DueDate || String(t.CompletionApprovedAt ?? '') <= String(t.DueDate) + 'T23:59:59')
  const timelinessScore = allDone.length ? (onTime.length / allDone.length) * 100 : 100

  const reported = allDone.filter((t) => t.ActualHours != null)
  const reportingDisciplineScore = allDone.length ? (reported.length / allDone.length) * 100 : 100

  const managerQualitativeScore = Math.max(0, Math.min(100, Number(input.managerQualitativeScore ?? 100)))

  const finalScore = Math.round((
    settings.WeightTaskCompletion * taskCompletionScore +
    settings.WeightQuality * qualityScore +
    settings.WeightTimeliness * timelinessScore +
    settings.WeightManagerQualitative * managerQualitativeScore +
    settings.WeightReportingDiscipline * reportingDisciplineScore
  ) / 100 * 10) / 10
  const band = scoreBand(finalScore, settings)

  const componentScores = {
    taskCompletionScore: Math.round(taskCompletionScore * 10) / 10, qualityScore: Math.round(qualityScore * 10) / 10,
    timelinessScore: Math.round(timelinessScore * 10) / 10, managerQualitativeScore, reportingDisciplineScore: Math.round(reportingDisciplineScore * 10) / 10,
    plannedPoints, contributingPoints: Math.round(contributingPoints * 10) / 10, selfAddedPoints, cappedSelfAddedPoints,
    plannedTaskCount: planned.length, completedTaskCount: allDone.length,
  }

  const values = {
    ComponentScoresJson: JSON.stringify(componentScores), FinalScore: finalScore, ScoreBand: band,
    Status: 0, ReviewerUserId: reviewerId, UpdatedAt: now(),
  }
  const savedResult = existing.data
    ? await db.from('PerformanceEvaluations').update(values).eq('Id', (existing.data as Obj).Id).select().single()
    : await db.from('PerformanceEvaluations').insert({
      ...baseInsert(auth), UserId: targetUserId, PeriodYear: periodYear, PeriodMonth: periodMonth, ...values,
    }).select().single()
  check(savedResult.error)
  await logEvaluation(auth, String(savedResult.data.Id), 'Computed', componentScores)
  return json(request, evaluationDto(savedResult.data), existing.data ? 200 : 201)
}

async function patchEvaluation(request: Request, auth: AuthContext, id: string): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const input = await body<Obj>(request)
  const currentResult = await db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId).eq('Id', id).eq('IsDeleted', false).maybeSingle()
  check(currentResult.error)
  const current = currentResult.data as Obj | null
  if (!current) throw new HttpError(404, 'ارزیابی یافت نشد')
  const isReviewer = current.ReviewerUserId === auth.userId
  const update: Obj = { UpdatedAt: now() }
  let action = 'Updated'

  if (input.submitForReview === true) {
    if (Number(current.Status) !== 0) throw new HttpError(400, 'فقط ارزیابی پیش‌نویس قابل ارسال برای بازبینی است')
    if (!isReviewer && !canManage(auth)) throw new HttpError(403, 'مجوز کافی ندارید')
    update.Status = 1; action = 'SubmittedForReview'
  } else if (input.finalize === true) {
    if (Number(current.Status) === 2) throw new HttpError(400, 'این ارزیابی قبلاً نهایی شده است')
    if (!isReviewer && !isAdminScope(auth)) throw new HttpError(403, 'فقط ارزیاب یا مدیر منابع انسانی می‌تواند ارزیابی را نهایی کند')
    update.Status = 2; update.FinalizedAt = now(); update.FinalizedByUserId = auth.userId
    if (input.rewardDecision !== undefined) update.RewardDecision = String(input.rewardDecision).slice(0, 40)
    if (input.rewardNotes !== undefined) update.RewardNotes = String(input.rewardNotes).slice(0, 2000)
    action = 'Finalized'
  } else if (input.reopen === true) {
    if (!isAdminScope(auth)) throw new HttpError(403, 'فقط مدیر منابع انسانی می‌تواند ارزیابی نهایی‌شده را بازگشایی کند')
    if (Number(current.Status) !== 2) throw new HttpError(400, 'فقط ارزیابی نهایی‌شده قابل بازگشایی است')
    update.Status = 0; update.FinalizedAt = null; update.FinalizedByUserId = null
    action = 'Reopened'
  } else if (input.rewardDecision !== undefined || input.rewardNotes !== undefined) {
    if (!isAdminScope(auth)) throw new HttpError(403, 'فقط مدیر منابع انسانی می‌تواند تصمیم پاداش/جریمه را ثبت کند')
    if (input.rewardDecision !== undefined) update.RewardDecision = String(input.rewardDecision).slice(0, 40)
    if (input.rewardNotes !== undefined) update.RewardNotes = String(input.rewardNotes).slice(0, 2000)
    action = 'RewardDecisionUpdated'
  } else {
    throw new HttpError(400, 'هیچ تغییری مشخص نشده است')
  }

  const result = await db.from('PerformanceEvaluations').update(update).eq('TenantId', auth.tenantId).eq('Id', id).select().maybeSingle()
  check(result.error)
  if (!result.data) throw new HttpError(404, 'ارزیابی یافت نشد')
  await logEvaluation(auth, id, action, { changes: input })
  if (action === 'Finalized') {
    await createNotification(db, auth, {
      userId: String(current.UserId), title: 'ارزیابی عملکرد ماهانه شما نهایی شد', body: `امتیاز نهایی: ${result.data.FinalScore}`,
      type: notificationType.performanceEvaluation, actionUrl: '/performance/evaluations', entityId: id, entityType: 'PerformanceEvaluation',
    })
  }
  return json(request, evaluationDto(result.data))
}

// ---- Appeals ----

async function createAppeal(request: Request, auth: AuthContext): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const input = await body<Obj>(request)
  const evaluationId = String(input.evaluationId ?? '')
  const reason = String(input.reason ?? '').trim()
  if (!evaluationId || !reason) throw new HttpError(400, 'ارزیابی و دلیل اعتراض الزامی است')
  const evalResult = await db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId).eq('Id', evaluationId).eq('IsDeleted', false).maybeSingle()
  check(evalResult.error)
  const evaluation = evalResult.data as Obj | null
  if (!evaluation) throw new HttpError(404, 'ارزیابی یافت نشد')
  if (evaluation.UserId !== auth.userId && !isAdminScope(auth)) throw new HttpError(403, 'فقط صاحب ارزیابی می‌تواند اعتراض ثبت کند')
  if (Number(evaluation.Status) !== 2) throw new HttpError(400, 'فقط به ارزیابی نهایی‌شده می‌توان اعتراض کرد')
  const row = {
    ...baseInsert(auth), EvaluationId: evaluationId, TaskId: input.taskId ?? null,
    RaisedByUserId: auth.userId, Reason: reason.slice(0, 2000), Status: 0,
  }
  const result = await db.from('PerformanceAppeals').insert(row).select().single()
  check(result.error)
  await logEvaluation(auth, evaluationId, 'AppealRaised', { appealId: result.data.Id, reason })
  if (evaluation.ReviewerUserId) {
    await createNotification(db, auth, {
      userId: String(evaluation.ReviewerUserId), title: 'اعتراض جدید به ارزیابی عملکرد', body: reason,
      type: notificationType.performanceEvaluation, actionUrl: '/performance/evaluations', entityId: evaluationId, entityType: 'PerformanceEvaluation',
    })
  }
  return json(request, camelize(result.data), 201)
}

async function resolveAppeal(request: Request, auth: AuthContext, id: string): Promise<Response> {
  if (!canManage(auth)) throw new HttpError(403, 'شما مجوز رسیدگی به اعتراض را ندارید')
  const input = await body<Obj>(request)
  const status = String(input.status ?? '')
  const statusIndex = appealStatus.findIndex((s) => s.toLowerCase() === status.toLowerCase())
  if (statusIndex < 0) throw new HttpError(400, 'وضعیت اعتراض معتبر نیست')
  const currentResult = await db.from('PerformanceAppeals').select('*').eq('TenantId', auth.tenantId).eq('Id', id).eq('IsDeleted', false).maybeSingle()
  check(currentResult.error)
  const current = currentResult.data as Obj | null
  if (!current) throw new HttpError(404, 'اعتراض یافت نشد')
  if (!isAdminScope(auth)) {
    const evalResult = await db.from('PerformanceEvaluations').select('ReviewerUserId').eq('Id', current.EvaluationId).maybeSingle()
    check(evalResult.error)
    if (!evalResult.data || (evalResult.data as Obj).ReviewerUserId !== auth.userId) throw new HttpError(403, 'فقط ارزیاب مربوطه می‌تواند به این اعتراض رسیدگی کند')
  }
  const update: Obj = { Status: statusIndex, UpdatedAt: now(), ReviewerResponse: input.reviewerResponse ?? current.ReviewerResponse }
  if (statusIndex === 2) { update.ResolvedByUserId = auth.userId; update.ResolvedAt = now() }
  const result = await db.from('PerformanceAppeals').update(update).eq('TenantId', auth.tenantId).eq('Id', id).select().single()
  check(result.error)
  await logEvaluation(auth, String(current.EvaluationId), statusIndex === 2 ? 'AppealResolved' : 'AppealReviewed', { appealId: id, response: input.reviewerResponse })
  await createNotification(db, auth, {
    userId: String(current.RaisedByUserId), title: 'پاسخ به اعتراض شما ثبت شد', body: String(input.reviewerResponse ?? ''),
    type: notificationType.performanceEvaluation, actionUrl: '/performance/evaluations', entityId: String(current.EvaluationId), entityType: 'PerformanceEvaluation',
  })
  return json(request, camelize(result.data))
}

// ---- Settings ----

async function settingsRoute(request: Request, auth: AuthContext): Promise<Response> {
  requirePermission(auth, 'performance.view')
  if (request.method === 'GET') return json(request, await loadSettings(auth.tenantId))
  if (request.method === 'PUT') {
    if (!isAdminScope(auth)) throw new HttpError(403, 'فقط مدیر منابع انسانی می‌تواند تنظیمات را ذخیره کند')
    const input = await body<Obj>(request)
    const num = (v: unknown, min: number, max: number, def: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def }
    const managerCap = num(input.managerQualitativeCapPercent, 0, 100, 20)
    const weights = {
      WeightTaskCompletion: num(input.weightTaskCompletion, 0, 100, 35),
      WeightQuality: num(input.weightQuality, 0, 100, 20),
      WeightTimeliness: num(input.weightTimeliness, 0, 100, 20),
      WeightManagerQualitative: Math.min(num(input.weightManagerQualitative, 0, 100, 20), managerCap),
      WeightReportingDiscipline: num(input.weightReportingDiscipline, 0, 100, 5),
    }
    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
    if (Math.abs(weightSum - 100) > 0.5) throw new HttpError(400, 'جمع وزن فاکتورها باید ۱۰۰ باشد')
    const bands = {
      BandExceptionalMin: num(input.bandExceptionalMin, 0, 100, 90), BandExcellentMin: num(input.bandExcellentMin, 0, 100, 80),
      BandGoodMin: num(input.bandGoodMin, 0, 100, 70), BandNeedsImprovementMin: num(input.bandNeedsImprovementMin, 0, 100, 60),
    }
    if (!(bands.BandExceptionalMin > bands.BandExcellentMin && bands.BandExcellentMin > bands.BandGoodMin && bands.BandGoodMin > bands.BandNeedsImprovementMin)) {
      throw new HttpError(400, 'آستانه‌های برد امتیازی باید نزولی باشند')
    }
    const values = { ...weights, ...bands, SelfAddedCapPercent: num(input.selfAddedCapPercent, 0, 100, 20), ManagerQualitativeCapPercent: managerCap, UpdatedAt: now() }
    const existing = await db.from('PerformanceSettings').select('Id').eq('TenantId', auth.tenantId).eq('IsDeleted', false).maybeSingle()
    check(existing.error)
    const result = existing.data
      ? await db.from('PerformanceSettings').update(values).eq('Id', (existing.data as Obj).Id)
      : await db.from('PerformanceSettings').insert({ ...baseInsert(auth), ...values })
    check(result.error)
    return json(request, { message: 'تنظیمات ارزیابی عملکرد ذخیره شد' })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

// ---- Reviewer mapping ----

async function reviewersRoute(request: Request, auth: AuthContext, path: string): Promise<Response> {
  if (!isAdminScope(auth)) throw new HttpError(403, 'فقط مدیر منابع انسانی می‌تواند نگاشت ارزیاب‌ها را مدیریت کند')
  const idMatch = path.match(/^\/performance\/reviewers\/([0-9a-f-]+)$/i)
  if (request.method === 'GET') {
    const result = await db.from('PerformanceReviewers').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('IsActive', true).order('CreatedAt', { ascending: false })
    check(result.error)
    const rows = (result.data ?? []) as Obj[]
    const names = await userDisplayNames(auth.tenantId, rows.flatMap((r) => [String(r.EmployeeUserId), String(r.ReviewerUserId)]))
    return json(request, rows.map((r) => ({ ...camelize(r) as Obj, employeeName: names.get(String(r.EmployeeUserId)) ?? '', reviewerName: names.get(String(r.ReviewerUserId)) ?? '' })))
  }
  if (request.method === 'POST') {
    const input = await body<Obj>(request)
    const employeeUserId = String(input.employeeUserId ?? '')
    const reviewerUserId = String(input.reviewerUserId ?? '')
    if (!employeeUserId || !reviewerUserId) throw new HttpError(400, 'کارمند و ارزیاب الزامی است')
    if (employeeUserId === reviewerUserId) throw new HttpError(400, 'کارمند نمی‌تواند ارزیاب خودش باشد')
    const usersResult = await db.from('Users').select('Id').eq('TenantId', auth.tenantId).eq('IsDeleted', false).in('Id', [employeeUserId, reviewerUserId])
    check(usersResult.error)
    if ((usersResult.data ?? []).length !== 2) throw new HttpError(400, 'کاربر معتبر نیست')
    const deactivate = await db.from('PerformanceReviewers').update({ IsActive: false, UpdatedAt: now() })
      .eq('TenantId', auth.tenantId).eq('EmployeeUserId', employeeUserId).eq('IsActive', true)
    check(deactivate.error)
    const result = await db.from('PerformanceReviewers').insert({
      ...baseInsert(auth), EmployeeUserId: employeeUserId, ReviewerUserId: reviewerUserId, IsActive: true,
    }).select().single()
    check(result.error)
    return json(request, camelize(result.data), 201)
  }
  if (request.method === 'DELETE' && idMatch) {
    const result = await db.from('PerformanceReviewers').update({ IsActive: false, IsDeleted: true, DeletedAt: now() })
      .eq('TenantId', auth.tenantId).eq('Id', idMatch[1])
    check(result.error)
    return new Response(null, { status: 204 })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

// ---- Dashboard ----

async function dashboardRoute(request: Request, auth: AuthContext, url: URL): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const scope = url.searchParams.get('scope') || 'me'

  if (scope === 'me') {
    const evalResult = await db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('IsDeleted', false)
      .order('PeriodYear', { ascending: false }).order('PeriodMonth', { ascending: false }).limit(12)
    check(evalResult.error)
    const rows = (evalResult.data ?? []).map(evaluationDto)
    return json(request, { scope, current: rows[0] ?? null, history: rows.slice(1) })
  }

  if (scope === 'team') {
    if (!canManage(auth)) throw new HttpError(403, 'شما مجوز مشاهده داشبورد تیم را ندارید')
    const reviewees = await db.from('PerformanceReviewers').select('EmployeeUserId').eq('TenantId', auth.tenantId).eq('ReviewerUserId', auth.userId).eq('IsActive', true).eq('IsDeleted', false)
    check(reviewees.error)
    const employeeIds = [...new Set((reviewees.data ?? []).map((r: Obj) => String(r.EmployeeUserId)))]
    if (!employeeIds.length) return json(request, { scope, employees: [], bandDistribution: [], pendingApprovals: 0 })
    const names = await userDisplayNames(auth.tenantId, employeeIds)
    const latestPerUser = await Promise.all(employeeIds.map(async (id) => {
      const r = await db.from('PerformanceEvaluations').select('*').eq('TenantId', auth.tenantId).eq('UserId', id).eq('IsDeleted', false)
        .order('PeriodYear', { ascending: false }).order('PeriodMonth', { ascending: false }).limit(1).maybeSingle()
      return { userId: id, userName: names.get(id) ?? '', evaluation: r.data ? evaluationDto(r.data) : null }
    }))
    const pendingResult = await db.from('Tasks').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('IsDeleted', false)
      .eq('CreationApprovalStatus', 0).in('AssignedByUserId', employeeIds)
    check(pendingResult.error)
    const bandCounts = new Map<string, number>()
    for (const item of latestPerUser) { if (item.evaluation?.scoreBand) bandCounts.set(item.evaluation.scoreBand, (bandCounts.get(item.evaluation.scoreBand) ?? 0) + 1) }
    return json(request, {
      scope, employees: latestPerUser, pendingApprovals: pendingResult.count ?? 0,
      bandDistribution: [...bandCounts.entries()].map(([name, value]) => ({ name, value })),
    })
  }

  if (scope === 'company') {
    if (!isAdminScope(auth)) throw new HttpError(403, 'شما مجوز مشاهده داشبورد کل شرکت را ندارید')
    const result = await db.from('PerformanceEvaluations').select('UserId,FinalScore,ScoreBand,PeriodYear,PeriodMonth').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    check(result.error)
    const rows = (result.data ?? []) as Obj[]
    const latestPerUser = new Map<string, Obj>()
    for (const row of rows) {
      const key = String(row.UserId)
      const existing = latestPerUser.get(key)
      if (!existing || row.PeriodYear > existing.PeriodYear || (row.PeriodYear === existing.PeriodYear && row.PeriodMonth > existing.PeriodMonth)) latestPerUser.set(key, row)
    }
    const latest = [...latestPerUser.values()]
    const bandCounts = new Map<string, number>()
    for (const row of latest) if (row.ScoreBand) bandCounts.set(String(row.ScoreBand), (bandCounts.get(String(row.ScoreBand)) ?? 0) + 1)
    const avgScore = latest.length ? Math.round((latest.reduce((sum, r) => sum + Number(r.FinalScore ?? 0), 0) / latest.length) * 10) / 10 : null
    const pendingResult = await db.from('PerformanceEvaluations').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('Status', 1)
    check(pendingResult.error)
    return json(request, {
      scope, averageScore: avgScore, evaluatedEmployeeCount: latest.length, pendingReviewCount: pendingResult.count ?? 0,
      bandDistribution: [...bandCounts.entries()].map(([name, value]) => ({ name, value })),
    })
  }

  throw new HttpError(400, 'scope نامعتبر است')
}

export async function handlePerformance(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  if (!path.startsWith('/performance')) return null

  if (path === '/performance/weekly' && request.method === 'GET') return await weeklyReport(request, auth, url)
  if (path === '/performance/evaluations' && request.method === 'GET') return await listEvaluations(request, auth, url)
  if (path === '/performance/evaluations/pending' && request.method === 'GET') return await pendingReviewEvaluations(request, auth)
  if (path === '/performance/evaluations/compute' && request.method === 'POST') return await computeEvaluation(request, auth)
  const evalMatch = path.match(/^\/performance\/evaluations\/([0-9a-f-]+)$/i)
  if (evalMatch && request.method === 'GET') return await getEvaluation(request, auth, evalMatch[1])
  if (evalMatch && request.method === 'PATCH') return await patchEvaluation(request, auth, evalMatch[1])
  if (path === '/performance/appeals' && request.method === 'POST') return await createAppeal(request, auth)
  const appealMatch = path.match(/^\/performance\/appeals\/([0-9a-f-]+)$/i)
  if (appealMatch && request.method === 'PATCH') return await resolveAppeal(request, auth, appealMatch[1])
  if (path === '/performance/settings') return await settingsRoute(request, auth)
  if (path.startsWith('/performance/reviewers')) return await reviewersRoute(request, auth, path)
  if (path === '/performance/dashboard' && request.method === 'GET') return await dashboardRoute(request, auth, url)

  return null
}
