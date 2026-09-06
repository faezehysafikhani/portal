import { AuthContext, adminClient, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json, uuid } from '../_shared/http.ts'
import { findReviewerFor } from './performance.ts'

type Obj = Record<string, any>
const db = adminClient()
const now = () => new Date().toISOString()
function check(error: { message: string } | null, fallback = 'خطا در دسترسی به پایگاه داده'): void {
  if (error) { console.error(error.message); throw new HttpError(500, fallback) }
}
function isAdminScope(auth: AuthContext): boolean {
  return auth.isAdmin || auth.permissions.includes('performance.admin')
}
async function canView(auth: AuthContext, targetUserId: string): Promise<boolean> {
  if (targetUserId === auth.userId) return true
  if (isAdminScope(auth)) return true
  if (!auth.permissions.includes('performance.manage')) return false
  const reviewerId = await findReviewerFor(db, auth.tenantId, targetUserId)
  return reviewerId === auth.userId
}

function timesheetDto(item: Obj): Obj {
  const result = camelize(item) as Obj
  try { result.entries = JSON.parse(String(item.EntriesJson ?? '[]')) } catch { result.entries = [] }
  delete result.entriesJson
  return result
}

// Tehran is UTC+3:30 with no DST — a fixed offset is safe here.
function todayIsoInTehran(): string {
  return new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function submitTimesheet(request: Request, auth: AuthContext): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const input = await body<Obj>(request)
  const targetUserId = input.userId ? String(input.userId) : auth.userId
  const isForOther = targetUserId !== auth.userId

  let date: string
  if (isForOther) {
    // A manager logging on a reviewee's behalf may pick any date (e.g. backfilling).
    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) throw new HttpError(400, 'شناسه کارمند نامعتبر است')
    const reviewerId = await findReviewerFor(db, auth.tenantId, targetUserId)
    if (!isAdminScope(auth) && auth.userId !== reviewerId) throw new HttpError(403, 'شما فقط می‌توانید برای زیرمجموعه‌ی خودتان تایم‌شیت ثبت کنید')
    date = String(input.date ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'تاریخ معتبر نیست')
  } else {
    // Self-entry is always today's date — never trust a client-supplied date here, so nobody
    // can backdate their own timesheet after the fact.
    date = todayIsoInTehran()
  }

  const entriesInput = Array.isArray(input.entries) ? input.entries : []
  const entries = entriesInput
    .map((e: Obj) => ({
      description: String(e.description ?? '').trim().slice(0, 300),
      minutes: Math.max(0, Math.min(1440, Number(e.minutes) || 0)),
    }))
    .filter((e) => e.description)
  if (!entries.length) throw new HttpError(400, 'حداقل یک فعالیت الزامی است')

  const existing = await db.from('DailyTimesheets').select('Id').eq('TenantId', auth.tenantId)
    .eq('UserId', targetUserId).eq('EntryDate', date).eq('IsDeleted', false).maybeSingle()
  check(existing.error)
  const values = { EntriesJson: JSON.stringify(entries), UpdatedAt: now() }
  const saved = existing.data
    ? await db.from('DailyTimesheets').update(values).eq('Id', (existing.data as Obj).Id).select().single()
    : await db.from('DailyTimesheets').insert({
      Id: uuid(), TenantId: auth.tenantId, UserId: targetUserId, EntryDate: date,
      CreatedAt: now(), CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null, ...values,
    }).select().single()
  check(saved.error, 'ثبت تایم‌شیت انجام نشد')
  return json(request, timesheetDto(saved.data), existing.data ? 200 : 201)
}

async function listTimesheets(request: Request, auth: AuthContext, url: URL): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const userId = url.searchParams.get('userId') || auth.userId
  if (userId !== auth.userId && !/^[0-9a-f-]{36}$/i.test(userId)) throw new HttpError(400, 'شناسه کاربر نامعتبر است')
  if (!(await canView(auth, userId))) throw new HttpError(403, 'شما مجوز مشاهده این تایم‌شیت را ندارید')
  let query = db.from('DailyTimesheets').select('*').eq('TenantId', auth.tenantId).eq('UserId', userId).eq('IsDeleted', false)
  const from = url.searchParams.get('from'); if (from) query = query.gte('EntryDate', from)
  const to = url.searchParams.get('to'); if (to) query = query.lte('EntryDate', to)
  const result = await query.order('EntryDate', { ascending: false })
  check(result.error)
  return json(request, (result.data ?? []).map(timesheetDto))
}

export async function handleTimesheets(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  if (!path.startsWith('/timesheets')) return null
  if (path === '/timesheets' && request.method === 'POST') return await submitTimesheet(request, auth)
  if (path === '/timesheets' && request.method === 'GET') return await listTimesheets(request, auth, url)
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}
