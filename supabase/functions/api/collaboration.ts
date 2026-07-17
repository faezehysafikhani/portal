import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'

type Obj = Record<string, any>
const db = adminClient()
const now = () => new Date().toISOString()
const base = (auth: AuthContext): Obj => ({ Id: crypto.randomUUID(), TenantId: auth.tenantId, CreatedAt: now(), UpdatedAt: null, CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null })
function check(error: { message: string } | null): void { if (error) { console.error(error.message); throw new HttpError(500, 'خطا در پایگاه داده') } }

async function calendar(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response> {
  requirePermission(auth, 'calendar.view')
  const match = path.match(/^\/calendar\/([0-9a-f-]+)$/i)
  const responseMatch = path.match(/^\/calendar\/([0-9a-f-]+)\/response$/i)
  const compose = async (event: Obj): Promise<Obj> => {
    const [attendees, participants, letters, tasks] = await Promise.all([
      db.from('EventAttendees').select('*').eq('TenantId', auth.tenantId).eq('EventId', event.Id).eq('IsDeleted', false),
      db.from('EventParticipants').select('*').eq('TenantId', auth.tenantId).eq('EventId', event.Id).eq('IsDeleted', false),
      db.from('EventLetterLinks').select('LetterId').eq('TenantId', auth.tenantId).eq('EventId', event.Id).eq('IsDeleted', false),
      db.from('EventTaskLinks').select('TaskId').eq('TenantId', auth.tenantId).eq('EventId', event.Id).eq('IsDeleted', false),
    ]); [attendees, participants, letters, tasks].forEach((x) => check(x.error))
    return { ...(camelize(event) as Obj), attendees: camelize(attendees.data), participants: camelize(participants.data), relatedLetterIds: (letters.data ?? []).map((x) => x.LetterId), relatedTaskIds: (tasks.data ?? []).map((x) => x.TaskId) }
  }
  if (request.method === 'GET') {
    let query = db.from('CalendarEvents').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    const from = url.searchParams.get('from'); const to = url.searchParams.get('to')
    if (from) query = query.gt('EndAt', from); if (to) query = query.lt('StartAt', to)
    if (match) query = query.eq('Id', match[1])
    const result = await query.order('StartAt'); check(result.error)
    const visible: Obj[] = []
    for (const event of result.data ?? []) {
      const attendee = await db.from('EventAttendees').select('Id').eq('TenantId', auth.tenantId).eq('EventId', event.Id).eq('UserId', auth.userId).eq('IsDeleted', false).maybeSingle(); check(attendee.error)
      if (event.OrganizerUserId === auth.userId || attendee.data || auth.isAdmin) visible.push(await compose(event))
    }
    if (match) { if (!visible[0]) throw new HttpError(404, 'رویداد یافت نشد'); return json(request, visible[0]) }
    return json(request, visible)
  }
  if (request.method === 'POST' && path === '/calendar') {
    requirePermission(auth, 'calendar.create'); const input = await body<Obj>(request)
    if (!input.title || !input.startAt || !input.endAt || new Date(input.endAt) <= new Date(input.startAt)) throw new HttpError(400, 'عنوان و بازه زمانی معتبر الزامی است')
    const event = { ...base(auth), Title: String(input.title).trim(), Description: input.description ?? null, StartAt: input.startAt, EndAt: input.endAt, IsAllDay: Boolean(input.isAllDay), TimeZone: input.timeZone ?? 'Asia/Tehran', EventType: input.eventType ?? 'meeting', Location: input.location ?? null, OnlineMeetingUrl: input.onlineMeetingUrl ?? null, Status: 'scheduled', OrganizerUserId: auth.userId, OrganizerType: 'user', OrganizerContactId: null, OrganizerDisplayName: input.organizerDisplayName ?? auth.username }
    const created = await db.from('CalendarEvents').insert(event).select().single(); check(created.error)
    const participants = Array.isArray(input.participants) ? input.participants : []
    if (participants.length) {
      const rows = participants.map((p: Obj) => ({ ...base(auth), EventId: event.Id, PersonType: p.personType, PersonId: p.personId, DisplayName: p.displayName ?? '', Role: p.role ?? 'attendee', ResponseStatus: 'pending' }))
      const added = await db.from('EventParticipants').insert(rows); check(added.error)
      const userRows = participants.filter((p: Obj) => p.personType === 'user').map((p: Obj) => ({ ...base(auth), EventId: event.Id, UserId: p.personId, ResponseStatus: 'pending', IsRequired: p.isRequired !== false }))
      if (userRows.length) { const addedUsers = await db.from('EventAttendees').insert(userRows); check(addedUsers.error) }
    }
    return json(request, await compose(created.data), 201)
  }
  if (request.method === 'PUT' && match) {
    requirePermission(auth, 'calendar.edit'); const input = await body<Obj>(request)
    const fields: Obj = { UpdatedAt: now() }; const map: Obj = { title: 'Title', description: 'Description', startAt: 'StartAt', endAt: 'EndAt', isAllDay: 'IsAllDay', eventType: 'EventType', location: 'Location', onlineMeetingUrl: 'OnlineMeetingUrl', status: 'Status' }
    for (const [key, column] of Object.entries(map)) if (input[key] !== undefined) fields[column as string] = input[key]
    const result = await db.from('CalendarEvents').update(fields).eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('OrganizerUserId', auth.userId).select().maybeSingle(); check(result.error)
    if (!result.data) throw new HttpError(404, 'رویداد یافت نشد'); return json(request, await compose(result.data))
  }
  if (request.method === 'PATCH' && responseMatch) {
    requirePermission(auth, 'calendar.respond'); const input = await body<Obj>(request)
    const result = await db.from('EventAttendees').update({ ResponseStatus: input.status, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('EventId', responseMatch[1]).eq('UserId', auth.userId); check(result.error)
    return json(request, { message: 'پاسخ ثبت شد' })
  }
  if (request.method === 'DELETE' && match) {
    requirePermission(auth, 'calendar.delete'); const result = await db.from('CalendarEvents').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('OrganizerUserId', auth.userId); check(result.error)
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function chat(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'chat.view')
  if (request.method === 'GET' && path === '/chat/users') {
    const users = await db.from('Users').select('Id,Username,FirstName,LastName,AvatarUrl,Department,Position').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('IsActive', true).neq('Id', auth.userId).order('FirstName'); check(users.error)
    return json(request, (users.data ?? []).map((u) => ({ id: u.Id, username: u.Username, fullName: `${u.FirstName} ${u.LastName}`.trim(), avatarUrl: u.AvatarUrl, department: u.Department, position: u.Position })))
  }
  const messages = path.match(/^\/chat\/messages\/([0-9a-f-]+)$/i)
  if (request.method === 'GET' && messages) {
    const result = await db.from('InternalChatMessages').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
      .or(`and(SenderUserId.eq.${auth.userId},RecipientUserId.eq.${messages[1]}),and(SenderUserId.eq.${messages[1]},RecipientUserId.eq.${auth.userId})`).order('CreatedAt'); check(result.error)
    await db.from('InternalChatMessages').update({ IsRead: true, ReadAt: now() }).eq('TenantId', auth.tenantId).eq('SenderUserId', messages[1]).eq('RecipientUserId', auth.userId).eq('IsRead', false)
    return json(request, camelize(result.data))
  }
  if (request.method === 'POST' && path === '/chat/messages') {
    const input = await body<Obj>(request); const content = String(input.content ?? '').trim()
    if (!input.recipientUserId || (!content && !input.attachmentData)) throw new HttpError(400, 'گیرنده و متن یا فایل الزامی است')
    const row = { ...base(auth), SenderUserId: auth.userId, RecipientUserId: input.recipientUserId, Content: content, Kind: input.kind ?? 0, AttachmentData: input.attachmentData ?? null, AttachmentName: input.attachmentName ?? null, AttachmentContentType: input.attachmentContentType ?? null, AttachmentSize: input.attachmentSize ?? null, VoiceDurationSeconds: input.voiceDurationSeconds ?? null, IsRead: false, ReadAt: null }
    const result = await db.from('InternalChatMessages').insert(row).select().single(); check(result.error); return json(request, camelize(result.data), 201)
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function forms(request: Request, auth: AuthContext, path: string): Promise<Response> {
  if (path === '/forms/balance' && request.method === 'GET') {
    requirePermission(auth, 'forms.view'); const result = await db.from('LeaveAccounts').select('*').eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('IsDeleted', false).maybeSingle(); check(result.error)
    return json(request, camelize(result.data ?? { accruedHours: 0, usedHours: 0 }))
  }
  if (path === '/forms/approvers' && request.method === 'GET') {
    requirePermission(auth, 'forms.create'); const result = await db.from('Users').select('Id,FirstName,LastName,Position,Department').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('IsActive', true).neq('Id', auth.userId).order('FirstName'); check(result.error)
    return json(request, (result.data ?? []).map((u) => ({ id: u.Id, fullName: `${u.FirstName} ${u.LastName}`.trim(), position: u.Position, department: u.Department })))
  }
  if (path === '/forms' && request.method === 'GET') {
    requirePermission(auth, 'forms.view'); const result = await db.from('OrganizationalForms').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
      .or(`SubmitterUserId.eq.${auth.userId},ManagerUserId.eq.${auth.userId},HrUserId.eq.${auth.userId}`).order('CreatedAt', { ascending: false }); check(result.error); return json(request, camelize(result.data))
  }
  if (path === '/forms' && request.method === 'POST') {
    requirePermission(auth, 'forms.create'); const input = await body<Obj>(request)
    const user = await db.from('Users').select('FirstName,LastName').eq('TenantId', auth.tenantId).eq('Id', auth.userId).single(); check(user.error)
    const row = { ...base(auth), FormType: input.formType, Title: input.title ?? input.formType, SubmitterUserId: auth.userId, SubmitterName: `${user.data.FirstName} ${user.data.LastName}`.trim(), ManagerUserId: input.managerUserId, HrUserId: input.hrUserId, Status: 'manager_pending', RequestedHours: input.amount ?? 0, Amount: input.amount ?? 0, DataJson: JSON.stringify(input.data ?? {}), ManagerNote: null, HrNote: null }
    const result = await db.from('OrganizationalForms').insert(row).select().single(); check(result.error); return json(request, camelize(result.data), 201)
  }
  const action = path.match(/^\/forms\/([0-9a-f-]+)\/action$/i)
  if (action && request.method === 'POST') {
    requirePermission(auth, 'forms.approve'); const input = await body<Obj>(request)
    const current = await db.from('OrganizationalForms').select('*').eq('TenantId', auth.tenantId).eq('Id', action[1]).eq('IsDeleted', false).single(); check(current.error)
    const form = current.data; const isManager = form.ManagerUserId === auth.userId && form.Status === 'manager_pending'; const isHr = form.HrUserId === auth.userId && form.Status === 'hr_pending'
    if (!isManager && !isHr && !auth.isAdmin) throw new HttpError(403, 'این فرم در کارتابل شما نیست')
    let status = form.Status
    if (input.action === 'approve') status = isManager ? 'hr_pending' : 'approved'; else if (input.action === 'return') status = 'returned'; else if (input.action === 'reject') status = 'rejected'; else throw new HttpError(400, 'عملیات نامعتبر است')
    const update: Obj = { Status: status, UpdatedAt: now() }; if (isManager) update.ManagerNote = input.note ?? null; else update.HrNote = input.note ?? null
    const result = await db.from('OrganizationalForms').update(update).eq('TenantId', auth.tenantId).eq('Id', action[1]).select().single(); check(result.error); return json(request, { status: result.data.Status })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

export async function handleCollaboration(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  if (path.startsWith('/calendar')) return calendar(request, auth, path, url)
  if (path.startsWith('/chat')) return chat(request, auth, path)
  if (path.startsWith('/forms')) return forms(request, auth, path)
  return null
}

