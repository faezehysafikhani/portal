import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { jalaliDateString, jalaliYearMonth } from '../_shared/jalali.ts'
import { createNotification, createNotifications, notificationType } from '../_shared/notifications.ts'

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
    return { ...(camelize(event) as Obj), persianStartDate:jalaliDateString(event.StartAt), gregorianStartDate:new Date(event.StartAt).toISOString().slice(0,10), attendees: camelize(attendees.data), participants: camelize(participants.data), relatedLetterIds: (letters.data ?? []).map((x) => x.LetterId), relatedTaskIds: (tasks.data ?? []).map((x) => x.TaskId) }
  }
  const syncRelations = async (eventId: string, input: Obj, notifyNewAttendees = false): Promise<void> => {
    const participants = Array.isArray(input.participants) ? input.participants : []
    const relatedLetterIds = Array.isArray(input.relatedLetterIds) ? [...new Set(input.relatedLetterIds.filter(Boolean))] : []
    const relatedTaskIds = Array.isArray(input.relatedTaskIds) ? [...new Set(input.relatedTaskIds.filter(Boolean))] : []
    const tables = ['EventAttendees', 'EventParticipants', 'EventLetterLinks', 'EventTaskLinks']
    for (const table of tables) {
      const removed = await db.from(table).delete().eq('TenantId', auth.tenantId).eq('EventId', eventId)
      check(removed.error)
    }
    if (participants.length) {
      const rows = participants.map((p: Obj) => ({ ...base(auth), EventId: eventId, PersonType: p.personType, PersonId: p.personId, DisplayName: p.displayName ?? '', Role: p.role ?? 'attendee', ResponseStatus: 'pending' }))
      const added = await db.from('EventParticipants').insert(rows); check(added.error)
      const userRows = participants.filter((p: Obj) => p.personType === 'user').map((p: Obj) => ({ ...base(auth), EventId: eventId, UserId: p.personId, ResponseStatus: 'pending', IsRequired: p.isRequired !== false }))
      if (userRows.length) {
        const addedUsers = await db.from('EventAttendees').insert(userRows); check(addedUsers.error)
        if (notifyNewAttendees) await createNotifications(db,auth,userRows.map((row:Obj)=>row.UserId),{title:'رویداد جدید در تقویم شما',body:String(input.title ?? ''),type:notificationType.calendar,actionUrl:'/calendar',entityId:eventId,entityType:'CalendarEvent'})
      }
    }
    if (relatedLetterIds.length) { const linked = await db.from('EventLetterLinks').insert(relatedLetterIds.map((letterId) => ({ ...base(auth), EventId:eventId, LetterId:letterId }))); check(linked.error) }
    if (relatedTaskIds.length) { const linked = await db.from('EventTaskLinks').insert(relatedTaskIds.map((taskId) => ({ ...base(auth), EventId:eventId, TaskId:taskId }))); check(linked.error) }
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
    await syncRelations(event.Id, input, true)
    return json(request, await compose(created.data), 201)
  }
  if (request.method === 'PUT' && match) {
    requirePermission(auth, 'calendar.edit'); const input = await body<Obj>(request)
    const fields: Obj = { UpdatedAt: now() }; const map: Obj = { title: 'Title', description: 'Description', startAt: 'StartAt', endAt: 'EndAt', isAllDay: 'IsAllDay', eventType: 'EventType', location: 'Location', onlineMeetingUrl: 'OnlineMeetingUrl', status: 'Status' }
    for (const [key, column] of Object.entries(map)) if (input[key] !== undefined) fields[column as string] = input[key]
    const result = await db.from('CalendarEvents').update(fields).eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('IsDeleted', false).select().maybeSingle(); check(result.error)
    if (!result.data) throw new HttpError(404, 'رویداد یافت نشد')
    if (input.participants !== undefined || input.relatedLetterIds !== undefined || input.relatedTaskIds !== undefined) await syncRelations(match[1], input)
    return json(request, await compose(result.data))
  }
  if (request.method === 'PATCH' && responseMatch) {
    requirePermission(auth, 'calendar.respond'); const input = await body<Obj>(request)
    const result = await db.from('EventAttendees').update({ ResponseStatus: input.status, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('EventId', responseMatch[1]).eq('UserId', auth.userId); check(result.error)
    return json(request, { message: 'پاسخ ثبت شد' })
  }
  if (request.method === 'DELETE' && match) {
    requirePermission(auth, 'calendar.delete'); const result = await db.from('CalendarEvents').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('IsDeleted', false).select('Id').maybeSingle(); check(result.error)
    if (!result.data) throw new HttpError(404, 'رویداد یافت نشد')
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function chat(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'chat.view')
  const kindName=(value:unknown)=>['Text','File','Voice'][Number(value)]??String(value??'Text')
  if (request.method === 'GET' && path === '/chat/users') {
    const [users,contacts,messages] = await Promise.all([
      db.from('Users').select('Id,Username,FirstName,LastName,AvatarUrl,Department,Position,LastLoginAt').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('IsActive', true).neq('Id', auth.userId).order('FirstName'),
      db.from('Contacts').select('Id,FullName,CompanyName,JobTitle,LinkedUserId').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('FullName'),
      db.from('InternalChatMessages').select('SenderUserId,RecipientUserId,RecipientContactId,Content,Kind,AttachmentName,CreatedAt,IsRead').eq('TenantId',auth.tenantId).eq('IsDeleted',false).or(`SenderUserId.eq.${auth.userId},RecipientUserId.eq.${auth.userId}`).order('CreatedAt',{ascending:false}).limit(1000),
    ]); check(users.error); check(contacts.error);check(messages.error)
    const rows=messages.data??[],summary=(personType:string,personId:string)=>{const related=personType==='user'?rows.filter(x=>(x.SenderUserId===auth.userId&&x.RecipientUserId===personId)||(x.SenderUserId===personId&&x.RecipientUserId===auth.userId)):rows.filter(x=>x.SenderUserId===auth.userId&&x.RecipientContactId===personId);const last=related[0];return{lastMessage:last?(Number(last.Kind)===2?'🎤 پیام صوتی':Number(last.Kind)===1?`📎 ${last.AttachmentName}`:last.Content):null,lastMessageAt:last?.CreatedAt,unread:personType==='user'?related.filter(x=>x.SenderUserId===personId&&x.RecipientUserId===auth.userId&&!x.IsRead).length:0}}
    return json(request, [
      ...(users.data ?? []).map((u) => ({ id: `user:${u.Id}`, personId:u.Id, personType:'user', username: u.Username, fullName: `${u.FirstName} ${u.LastName}`.trim(), avatarUrl: u.AvatarUrl, department: u.Department, position: u.Position, isOnline:Boolean(u.LastLoginAt&&new Date(u.LastLoginAt)>new Date(Date.now()-15*60*1000)),...summary('user',u.Id) })),
      ...(contacts.data ?? []).map((c) => ({ id:`contact:${c.Id}`, personId:c.Id, personType:'contact', fullName:c.FullName, department:c.CompanyName, position:c.JobTitle, isOnline:false,...summary('contact',c.Id) })),
    ])
  }
  const messages = path.match(/^\/chat\/messages\/(user|contact):([0-9a-f-]+)$/i)
  if (request.method === 'GET' && messages) {
    const personType=messages[1].toLowerCase(),personId=messages[2]
    let query=db.from('InternalChatMessages').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    query=personType==='user'?query.or(`and(SenderUserId.eq.${auth.userId},RecipientUserId.eq.${personId}),and(SenderUserId.eq.${personId},RecipientUserId.eq.${auth.userId})`):query.eq('SenderUserId',auth.userId).eq('RecipientContactId',personId)
    const result=await query.order('CreatedAt');check(result.error)
    if(personType==='user'){await Promise.all([db.from('InternalChatMessages').update({ IsRead:true,ReadAt:now() }).eq('TenantId',auth.tenantId).eq('SenderUserId',personId).eq('RecipientUserId',auth.userId).eq('IsRead',false),db.from('Notifications').update({IsRead:true,ReadAt:now()}).eq('TenantId',auth.tenantId).eq('UserId',auth.userId).eq('Type',6).eq('RelatedEntityId',personId).eq('IsRead',false)])}
    return json(request,(result.data??[]).map(item=>({...camelize(item) as Obj,kind:kindName(item.Kind),isMe:item.SenderUserId===auth.userId})))
  }
  const attachment=path.match(/^\/chat\/messages\/([0-9a-f-]+)\/attachment$/i)
  if(request.method==='GET'&&attachment){
    const result=await db.from('InternalChatMessages').select('SenderUserId,RecipientUserId,AttachmentData,AttachmentName,AttachmentContentType').eq('TenantId',auth.tenantId).eq('Id',attachment[1]).eq('IsDeleted',false).maybeSingle();check(result.error)
    if(!result.data||(result.data.SenderUserId!==auth.userId&&result.data.RecipientUserId!==auth.userId))throw new HttpError(404,'فایل پیام یافت نشد')
    const binary=Uint8Array.from(atob(String(result.data.AttachmentData??'')),c=>c.charCodeAt(0))
    return new Response(binary,{headers:{...corsHeaders(request),'Content-Type':result.data.AttachmentContentType||'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(result.data.AttachmentName||'attachment')}`}})
  }
  if (request.method === 'POST' && path === '/chat/messages') {
    const input = await body<Obj>(request); const content = String(input.content ?? '').trim()
    const recipientType=String(input.recipientType??'user'),recipientId=String(input.recipientId??'')
    if (!recipientId || (!content && !input.attachmentData)) throw new HttpError(400, 'گیرنده و متن یا فایل الزامی است')
    const kind=({text:0,file:1,voice:2} as Obj)[String(input.kind??'text').toLowerCase()]??0
    const row = { ...base(auth), SenderUserId: auth.userId, RecipientUserId: recipientType==='user'?recipientId:null, RecipientContactId:recipientType==='contact'?recipientId:null, Content: content, Kind: kind, AttachmentData: input.attachmentData ?? null, AttachmentName: input.attachmentName ?? null, AttachmentContentType: input.attachmentContentType ?? null, AttachmentSize: input.attachmentSize ?? null, VoiceDurationSeconds: input.voiceDurationSeconds ?? null, IsRead: false, ReadAt: null }
    const result = await db.from('InternalChatMessages').insert(row).select().single(); check(result.error)
    if(recipientType==='user'){const sender=await db.from('Users').select('FirstName,LastName,Username').eq('TenantId',auth.tenantId).eq('Id',auth.userId).single();check(sender.error);const senderName=`${sender.data.FirstName??''} ${sender.data.LastName??''}`.trim()||sender.data.Username;const notificationBody=kind===2?'یک پیام صوتی برای شما ارسال شد':kind===1?`فایل «${input.attachmentName??''}» برای شما ارسال شد`:content.slice(0,120);const notice=await db.from('Notifications').insert({...base(auth),UserId:recipientId,Title:`پیام جدید از ${senderName}`,Body:notificationBody,Type:6,IsRead:false,ReadAt:null,ActionUrl:`/chat?user=user:${auth.userId}`,RelatedEntityId:auth.userId,RelatedEntityType:'Chat'});check(notice.error)}
    return json(request, {...camelize(result.data) as Obj,kind:kindName(result.data.Kind),isMe:true}, 201)
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

const person = (u: Obj) => ({ id:u.Id, username:u.Username, fullName:`${u.FirstName ?? ''} ${u.LastName ?? ''}`.trim() || u.Username, position:u.Position, department:u.Department })
const monthIndex = (value:string|number) => { const raw=String(value); const year=Number(raw.includes('/')?raw.split('/')[0]:raw.slice(0,4)),month=Number(raw.includes('/')?raw.split('/')[1]:raw.slice(4,6)); return year*12+month-1 }

async function workflow(auth: AuthContext) {
  const [current,all] = await Promise.all([
    db.from('Users').select('Id,Username,FirstName,LastName,Position,Department,DirectManager,HrManager').eq('TenantId',auth.tenantId).eq('Id',auth.userId).eq('IsDeleted',false).single(),
    db.from('Users').select('Id,Username,FirstName,LastName,Position,Department').eq('TenantId',auth.tenantId).eq('IsDeleted',false).eq('IsActive',true).order('FirstName'),
  ]); check(current.error); check(all.error)
  const users=(all.data??[]).map(person)
  const resolve=(reference:unknown)=>{const key=String(reference??'').trim().toLowerCase();return users.find((u:any)=>u.id.toLowerCase()===key||String(u.username??'').toLowerCase()===key||u.fullName.toLowerCase()===key)}
  const manager=resolve(current.data.DirectManager),hrManager=resolve(current.data.HrManager)
  return { submitter:person(current.data), manager, hrManager, isConfigured:Boolean(manager&&hrManager), message:manager&&hrManager?undefined:'مدیر مستقیم یا مسئول منابع انسانی در پروفایل کاربر تنظیم نشده است.', users }
}

async function leaveAccount(auth: AuthContext, userId=auth.userId) {
  const ym=jalaliYearMonth(),found=await db.from('LeaveAccounts').select('*').eq('TenantId',auth.tenantId).eq('UserId',userId).eq('IsDeleted',false).maybeSingle();check(found.error)
  let account=found.data
  if(!account){
    const created=await db.from('LeaveAccounts').insert({...base(auth),UserId:userId,AccruedThroughYearMonth:ym,AccruedHours:20,UsedHours:0,ReservedHours:0,MonthlyAccrualHours:20,HoursPerDay:8}).select().single();check(created.error);account=created.data
  } else {
    const previous=account.AccruedThroughYearMonth??0,months=Math.max(0,monthIndex(ym)-monthIndex(previous))
    const emptyCurrent=months===0&&Number(account.AccruedHours??0)===0&&Number(account.UsedHours??0)===0&&Number(account.ReservedHours??0)===0
    if(!Number(previous)||emptyCurrent||months>0){const accrued=emptyCurrent||!Number(previous)?20:Number(account.AccruedHours??0)+months*Number(account.MonthlyAccrualHours??20);const updated=await db.from('LeaveAccounts').update({AccruedHours:accrued,AccruedThroughYearMonth:ym,UpdatedAt:now()}).eq('TenantId',auth.tenantId).eq('Id',account.Id).select().single();check(updated.error);account=updated.data}
  }
  const accrued=Number(account.AccruedHours??0),used=Number(account.UsedHours??0),reserved=Number(account.ReservedHours??0),hoursPerDay=Number(account.HoursPerDay??8)
  return {...account,availableHours:Math.max(0,accrued-used-reserved),days:Math.max(0,(accrued-used-reserved)/hoursPerDay),monthlyAccrualHours:Number(account.MonthlyAccrualHours??20),reservedHours:reserved}
}

async function forms(request: Request, auth: AuthContext, path: string, url:URL): Promise<Response> {
  if (path === '/forms/balance' && request.method === 'GET') {
    requirePermission(auth, 'forms.view'); return json(request,camelize(await leaveAccount(auth)))
  }
  if (path === '/forms/approvers' && request.method === 'GET') {
    requirePermission(auth, 'forms.create'); return json(request,await workflow(auth))
  }
  if (path === '/forms' && request.method === 'GET') {
    requirePermission(auth, 'forms.view'); let query=db.from('OrganizationalForms').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    const scope=url.searchParams.get('scope')||'sent'
    if(scope==='approvals')query=query.or(`and(ManagerUserId.eq.${auth.userId},Status.eq.manager_pending),and(HrUserId.eq.${auth.userId},Status.eq.hr_pending)`)
    else if(scope==='inbox')query=query.eq('SubmitterUserId',auth.userId).in('Status',['approved','rejected','returned'])
    else query=query.eq('SubmitterUserId',auth.userId)
    const result=await query.order('CreatedAt',{ascending:false});check(result.error)
    const enriched=await Promise.all((result.data??[]).map(async(form:Obj)=>{const history=await db.from('FormWorkflowHistories').select('*').eq('TenantId',auth.tenantId).eq('FormId',form.Id).eq('IsDeleted',false).order('CreatedAt');check(history.error);return{...camelize(form) as Obj,history:camelize(history.data)}}))
    return json(request,enriched)
  }
  if (path === '/forms' && request.method === 'POST') {
    requirePermission(auth, 'forms.create'); const input = await body<Obj>(request)
    const formType=String(input.formType??'');const assignedTypes=auth.permissions.filter(code=>code.startsWith('forms.type.'));if(!auth.isAdmin&&!auth.permissions.includes('forms.access')&&assignedTypes.length>0&&!assignedTypes.includes(`forms.type.${formType}`))throw new HttpError(403,'دسترسی ثبت این نوع فرم برای شما فعال نشده است')
    const route=await workflow(auth);if(!route.isConfigured)throw new HttpError(400,route.message)
    const requestedHours=['leave_daily','leave_hourly'].includes(String(input.formType))?Number(input.amount??0):0
    if(['leave_daily','leave_hourly'].includes(String(input.formType))&&requestedHours<=0)throw new HttpError(400,'مدت مرخصی معتبر نیست.')
    let account:Obj|null=null
    if(requestedHours>0){account=await leaveAccount(auth);if(requestedHours>account.availableHours)throw new HttpError(400,`مانده مرخصی کافی نیست. مانده قابل استفاده شما ${account.availableHours} ساعت است.`)}
    const row = { ...base(auth), FormType: input.formType, Title: input.title ?? input.formType, SubmitterUserId: auth.userId, SubmitterName: route.submitter.fullName, ManagerUserId: route.manager.id, ManagerName:route.manager.fullName, HrUserId: route.hrManager.id, HrName:route.hrManager.fullName, Status: 'manager_pending', RequestedHours: requestedHours, DataJson: JSON.stringify(input.data ?? {}) }
    const result = await db.from('OrganizationalForms').insert(row).select().single(); check(result.error)
    const history=await db.from('FormWorkflowHistories').insert({...base(auth),FormId:result.data.Id,ActorUserId:auth.userId,ActorName:route.submitter.fullName,Action:'submitted',Note:null});check(history.error)
    if(account&&requestedHours>0){const reserved=await db.from('LeaveAccounts').update({ReservedHours:Number(account.ReservedHours??0)+requestedHours,UpdatedAt:now()}).eq('TenantId',auth.tenantId).eq('Id',account.Id);check(reserved.error)}
    await createNotification(db,auth,{userId:route.manager.id,title:'فرم جدید در انتظار تأیید شماست',body:row.Title,type:notificationType.form,actionUrl:'/forms/approvals',entityId:result.data.Id,entityType:'OrganizationalForm'})
    return json(request, {...camelize(result.data) as Obj,message:'فرم ثبت شد و برای مدیر مستقیم شما ارسال گردید.'}, 201)
  }
  const action = path.match(/^\/forms\/([0-9a-f-]+)\/action$/i)
  if (action && request.method === 'POST') {
    requirePermission(auth, 'forms.approve'); const input = await body<Obj>(request)
    const current = await db.from('OrganizationalForms').select('*').eq('TenantId', auth.tenantId).eq('Id', action[1]).eq('IsDeleted', false).single(); check(current.error)
    const form = current.data; const isManager = form.ManagerUserId === auth.userId && form.Status === 'manager_pending'; const isHr = form.HrUserId === auth.userId && form.Status === 'hr_pending'
    if (!isManager && !isHr && !auth.isAdmin) throw new HttpError(403, 'این فرم در کارتابل شما نیست')
    let status = form.Status
    if (input.action === 'approve') status = isManager ? 'hr_pending' : 'approved'; else if (input.action === 'return') status = 'returned'; else if (input.action === 'reject') status = 'rejected'; else throw new HttpError(400, 'عملیات نامعتبر است')
    const update: Obj = { Status: status, UpdatedAt: now() }
    const result = await db.from('OrganizationalForms').update(update).eq('TenantId', auth.tenantId).eq('Id', action[1]).select().single(); check(result.error)
    const actor=await db.from('Users').select('Username,FirstName,LastName').eq('TenantId',auth.tenantId).eq('Id',auth.userId).single();check(actor.error)
    const actionHistory=await db.from('FormWorkflowHistories').insert({...base(auth),FormId:form.Id,ActorUserId:auth.userId,ActorName:person(actor.data).fullName,Action:input.action,Note:input.note??null});check(actionHistory.error)
    const requested=Number(form.RequestedHours??0)
    if(requested>0&&((input.action==='approve'&&status==='approved')||input.action==='reject'||input.action==='return')){
      const account=await leaveAccount(auth,form.SubmitterUserId),reserved=Math.max(0,Number(account.ReservedHours??0)-requested)
      const accountUpdate:Obj={ReservedHours:reserved,UpdatedAt:now()};if(input.action==='approve'&&status==='approved')accountUpdate.UsedHours=Number(account.UsedHours??0)+requested
      const saved=await db.from('LeaveAccounts').update(accountUpdate).eq('TenantId',auth.tenantId).eq('Id',account.Id);check(saved.error)
    }
    const nextUser=status==='hr_pending'?form.HrUserId:form.SubmitterUserId
    const actionTitle=status==='hr_pending'?'فرم برای تأیید منابع انسانی ارسال شد':status==='approved'?'فرم شما تأیید شد':status==='rejected'?'فرم شما رد شد':'فرم برای اصلاح بازگردانده شد'
    await createNotification(db,auth,{userId:nextUser,title:actionTitle,body:form.Title,type:notificationType.form,actionUrl:status==='hr_pending'?'/forms/approvals':'/forms/inbox',entityId:form.Id,entityType:'OrganizationalForm'})
    return json(request, { status: result.data.Status })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

export async function handleCollaboration(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  if (path.startsWith('/calendar')) return calendar(request, auth, path, url)
  if (path.startsWith('/chat')) return chat(request, auth, path)
  if (path.startsWith('/forms')) return forms(request, auth, path, url)
  return null
}
