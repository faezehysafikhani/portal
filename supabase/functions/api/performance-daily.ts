import { adminClient, AuthContext } from '../_shared/auth.ts'
import { body, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { jalaliDateString, jalaliDayNumber } from '../_shared/jalali.ts'

type Row = Record<string, any>
const db = adminClient()
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
const canAdmin = (auth: AuthContext) => auth.isAdmin || auth.permissions.includes('performance.admin')
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tehran', dateStyle: 'short' }).format(new Date())
const normalize = (value: unknown) => String(value ?? '').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,'').toLowerCase()
const name = (user: Row) => `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim() || user.Username
const list = (value: unknown): string[] => { try { const parsed = JSON.parse(String(value ?? '[]')); return Array.isArray(parsed) ? parsed : [] } catch { return [] } }
const check = (error: { message: string } | null) => {
  if (error) { console.error(error.message); throw new HttpError(500,'خطا در دریافت یا ذخیره اطلاعات عملکرد') }
}
function date(value: unknown, validatePast = false): string {
  const result = String(value ?? '')
  const parsed = new Date(result)
  if (!/^\d{4}-\d\d-\d\d$/.test(result) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== result ||
    (validatePast && result > today())) throw new HttpError(400,'تاریخ فعالیت معتبر نیست')
  return result
}
function text(value: unknown, limit: number, required = false) {
  const result = String(value ?? '').trim()
  if (result.length > limit || (required && !result)) throw new HttpError(400,'فیلدهای اجباری و طول متن را بررسی کنید')
  return result
}
async function people(auth: AuthContext): Promise<Row[]> {
  const result = await db.from('Users').select('Id,Username,FirstName,LastName,DirectManager,Position').eq('TenantId',auth.tenantId).eq('IsDeleted',false).eq('IsActive',true)
  check(result.error)
  return result.data ?? []
}
function directManager(users: Row[], employee: Row | undefined) {
  const ref = normalize(employee?.DirectManager)
  if (!ref) return undefined
  const others = users.filter(u => u.Id !== employee?.Id)
  const matches = others.filter(u => [u.Id,u.Username,name(u)].some(value => normalize(value) === ref))
  if (matches.length) return matches.length === 1 ? matches[0].Id : undefined
  const positions = others.filter(u => normalize(u.Position) === ref)
  return positions.length === 1 ? positions[0].Id : undefined
}
async function reviewer(auth: AuthContext): Promise<string | null> {
  const users = await people(auth)
  const assigned = directManager(users, users.find(user => user.Id === auth.userId))
  if (assigned) return assigned
  const result = await db.from('PerformanceReviewers').select('ReviewerUserId').eq('TenantId',auth.tenantId)
    .eq('EmployeeUserId',auth.userId).eq('IsDeleted',false).eq('IsActive',true).maybeSingle()
  check(result.error)
  const id = result.data?.ReviewerUserId
  return users.some(u => u.Id === id && id !== auth.userId) ? id : null
}
async function myTasks(auth: AuthContext, id?: string): Promise<Row[]> {
  let query = db.from('Tasks').select('Id,Title,Description,AssignedByUserId,AssignedToUserId,AssigneeUserIdsJson,ProjectId,ProjectIdsJson,CreatedAt,DueDate,Priority,Status,Progress')
    .eq('TenantId',auth.tenantId).eq('IsDeleted',false)
    .or(`AssignedToUserId.eq.${auth.userId},AssigneeUserIdsJson.ilike.%${auth.userId}%`)
  if (id) query = query.eq('Id',id)
  const result = await query.order('CreatedAt',{ascending:false})
  check(result.error)
  return (result.data ?? []).filter(task => task.AssignedToUserId === auth.userId || list(task.AssigneeUserIdsJson).includes(auth.userId))
}
function file(input: Row) {
  const filename = text(input?.name,180,true).replace(/[\\/\x00-\x1f\x7f]/g,'_')
  const content = String(input?.content ?? '')
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content) || content.length > 1398104) throw new HttpError(400,'هر پیوست باید حداکثر یک مگابایت باشد')
  let raw: string
  try { raw = atob(content) } catch { throw new HttpError(400,'محتوای فایل معتبر نیست') }
  if (!raw.length || raw.length > 1048576) throw new HttpError(400,'حجم فایل پیوست معتبر نیست')
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
  let mime = ''
  if (ext === 'pdf' && raw.startsWith('%PDF-')) mime = 'application/pdf'
  if (ext === 'png' && /^\x89PNG\r\n\x1a\n/.test(raw)) mime = 'image/png'
  if (['jpg','jpeg'].includes(ext ?? '') && /^\xff\xd8\xff/.test(raw)) mime = 'image/jpeg'
  if (ext === 'txt') {
    try {
      const decoded = new TextDecoder('utf-8',{fatal:true}).decode(bytes)
      if (!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded)) mime = 'text/plain'
    } catch { /* Invalid UTF-8 is not accepted as text. */ }
  }
  if (!mime) throw new HttpError(400,'فایل باید PDF، PNG، JPEG یا متن UTF-8 معتبر باشد')
  return {name:filename,mime,bytes:raw.length,content}
}
async function activity(auth: AuthContext, input: Row) {
  if (!uuid(input.id)) throw new HttpError(400,'شناسه فعالیت معتبر نیست')
  if (!['project','internal','meeting','recurring','other'].includes(input.kind) ||
      !['planned','in_progress','done','blocked'].includes(input.status) ||
      !['intervals','manual'].includes(input.timeMode)) throw new HttpError(400,'نوع، وضعیت یا روش ثبت زمان معتبر نیست')
  const intervals: {s:number;e:number}[] = input.timeMode === 'intervals' && Array.isArray(input.intervals)
    ? input.intervals.map((range: Row) => ({s:range.s,e:range.e})).sort((a: Row,b: Row) => a.s-b.s) : []
  if (input.timeMode === 'intervals' && (!intervals.length || intervals.length > 20 ||
      intervals.some((r, i) => !Number.isInteger(r.s) || !Number.isInteger(r.e) || r.s<0 || r.e>1440 || r.s>=r.e || (i>0 && intervals[i-1].e>r.s))))
    throw new HttpError(400,'بازه‌های زمانی باید مستقل و در همان روز باشند')
  const minutes = input.timeMode === 'intervals' ? intervals.reduce((total,r) => total+r.e-r.s,0) : input.minutes
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new HttpError(400,'مدت فعالیت باید بین ۱ دقیقه و ۲۴ ساعت باشد')
  let projectId = input.projectId || null
  const taskId = input.taskId || null
  if ((taskId && !uuid(taskId)) || (projectId && !uuid(projectId))) throw new HttpError(400,'شناسه پروژه یا وظیفه معتبر نیست')
  if (taskId) {
    const [task] = await myTasks(auth,taskId)
    if (!task) throw new HttpError(404,'وظیفه در فهرست وظایف شما نیست')
    projectId = task.ProjectId ?? list(task.ProjectIdsJson).find(uuid) ?? null
  }
  if (projectId) {
    const project = await db.from('Projects').select('Id').eq('TenantId',auth.tenantId).eq('Id',projectId).eq('IsDeleted',false).maybeSingle()
    check(project.error)
    if (!project.data) throw new HttpError(400,'پروژه یافت نشد')
  }
  const files = input.files ?? [], removeFiles = input.removeFiles ?? []
  if (!Array.isArray(files) || files.length>5 || !Array.isArray(removeFiles) || removeFiles.length>5 || !removeFiles.every(uuid))
    throw new HttpError(400,'تعداد یا شناسه پیوست‌ها معتبر نیست')
  return {id:input.id,title:text(input.title,180,true),description:text(input.description,4000,true),kind:input.kind,
    status:input.status,timeMode:input.timeMode,minutes,intervals,taskId,projectId,outcome:text(input.outcome,2000),notes:text(input.notes,2000),files:files.map(file),removeFiles}
}
const errors: Record<string,[number,string]> = {
  daily_not_found:[404,'گزارش یا فعالیت یافت نشد'], daily_locked:[409,'این گزارش در وضعیت فعلی قابل تغییر نیست'],
  daily_note:[400,'ثبت دلیل برگشت الزامی است'], daily_reviewer:[400,'مدیر مستقیم یا ارزیاب فعال در پروفایل شما تعریف نشده است'],
  daily_empty:[400,'ابتدا یک فعالیت برای این روز ثبت کنید'], daily_overlap:[409,'این بازه با فعالیت دیگری در همین روز هم‌پوشانی دارد'],
  daily_total:[400,'مجموع زمان فعالیت‌های این روز بیشتر از ۲۴ ساعت است'], daily_duplicate:[409,'فعالیت یکسان قبلاً ثبت شده است'],
  daily_files:[400,'حداکثر ۵ فایل برای هر فعالیت مجاز است'],
}
async function mutate(auth: AuthContext, action: string, workDate: string | null, report: string | null, data: Row = {}) {
  const result = await db.rpc('performance_daily_mutate',{
    p_tenant:auth.tenantId,p_actor:auth.userId,p_action:action,p_date:workDate,p_report:report,p_data:data,
    p_reviewer:action==='submit'?await reviewer(auth):null,p_admin:canAdmin(auth),
  })
  const error = result.error && errors[result.error.message]
  if (error) throw new HttpError(...error)
  check(result.error)
  return result.data
}
async function getReport(auth: AuthContext, id: string): Promise<Row> {
  const result = await db.from('performance_daily_reports').select('*').eq('tenant_id',auth.tenantId).eq('id',id).maybeSingle()
  check(result.error)
  const found = result.data
  if (!found || !(found.employee_id===auth.userId || canAdmin(auth) || (found.status!=='draft' && found.reviewer_id===auth.userId)))
    throw new HttpError(404,'گزارش یافت نشد')
  return found
}
function dayNumber(value: unknown) {
  return jalaliDayNumber(String(value ?? '').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
}
export async function handleDailyPerformance(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  const prefix = '/performance/daily'
  if (!path.startsWith(prefix+'/')) return null
  const route = path.slice(prefix.length)
  const method = request.method
  if (route==='/access' && method==='GET') {
    if (canAdmin(auth) || auth.permissions.includes('performance.manage')) return json(request,{canReview:true})
    const [users,assignment,queue] = await Promise.all([
      people(auth),
      db.from('PerformanceReviewers').select('ReviewerUserId').eq('TenantId',auth.tenantId).eq('ReviewerUserId',auth.userId).eq('IsActive',true).eq('IsDeleted',false).limit(1),
      db.from('performance_daily_reports').select('id').eq('tenant_id',auth.tenantId).eq('reviewer_id',auth.userId).limit(1),
    ])
    check(assignment.error); check(queue.error)
    return json(request,{canReview:!!assignment.data?.length || !!queue.data?.length || users.some(user => directManager(users,user)===auth.userId)})
  }
  if (route==='/options' && method==='GET') {
    const [tasks,projects,users] = await Promise.all([
      myTasks(auth),
      db.from('Projects').select('Id,Name').eq('TenantId',auth.tenantId).eq('IsDeleted',false).eq('Status',0).order('Name'),
      people(auth),
    ])
    check(projects.error)
    const names = new Map(users.map(u => [u.Id,name(u)]))
    return json(request,{today:today(),projects:projects.data,tasks:tasks.map(task=>({...task,AssignedByName:names.get(task.AssignedByUserId), ProjectId:task.ProjectId ?? list(task.ProjectIdsJson).find(uuid) ?? null}))})
  }
  if (route==='/reports' && method==='GET') {
    const review = url.searchParams.get('scope')==='review'
    let query = db.from('performance_daily_reports').select('*,performance_daily_activities(id,minutes)').eq('tenant_id',auth.tenantId)
    if (review) {
      query = query.in('status',['submitted','returned','approved']).neq('employee_id',auth.userId)
      if (!canAdmin(auth)) query = query.eq('reviewer_id',auth.userId)
    } else query = query.eq('employee_id',auth.userId)
    const from = url.searchParams.get('from'), to = url.searchParams.get('to')
    if (from) query = query.gte('work_date',date(from))
    if (to) query = query.lte('work_date',date(to))
    const result = await query.order('work_date',{ascending:false}).order('created_at',{ascending:false}).limit(250)
    check(result.error)
    const users = review ? await people(auth) : []
    const ids = new Map(users.map(u=>[u.Id,name(u)]))
    return json(request,(result.data??[]).map(row=>({...row,employee_name:ids.get(row.employee_id)})))
  }
  if (route==='/calendar' && method==='GET') {
    const from = date(url.searchParams.get('from')), to = date(url.searchParams.get('to'))
    const start = Date.parse(from), end = Date.parse(to), day = 86400000
    if (end < start || end-start > 62*day) throw new HttpError(400,'حداکثر بازه تقویم ۶۳ روز است')
    const result = await db.from('OrganizationalForms').select('DataJson').eq('TenantId',auth.tenantId).eq('SubmitterUserId',auth.userId)
      .eq('IsDeleted',false).in('Status',['hr_pending','approved','completed']).in('FormType',['leave_daily','leave_sick'])
    check(result.error)
    const leave = (result.data??[]).flatMap(row => {
      try { const info = JSON.parse(row.DataJson); return [[dayNumber(info.fromDate),dayNumber(info.toDate)]] }
      catch { return [] }
    })
    const days = []
    for (let instant=start;instant<=end;instant+=day) {
      const d = new Date(instant)
      const no = dayNumber(jalaliDateString(d))
      if (no!==null && leave.some(([a,b])=>a!==null&&b!==null&&a<=no&&no<=b)) days.push(d.toISOString().slice(0,10))
    }
    return json(request,{today:today(),leave:days})
  }
  if (route==='/activities' && method==='POST') {
    const input = await body<Row>(request)
    return json(request,{id:await mutate(auth,'create',date(input.date,true),null,await activity(auth,input))},201)
  }
  if (route==='/submit' && method==='POST') {
    const input = await body<Row>(request)
    return json(request,{id:await mutate(auth,'submit',date(input.date,true),null)})
  }
  const reportMatch = route.match(/^\/reports\/([^/]+)(?:\/(activities|review))?$/)
  if (reportMatch && uuid(reportMatch[1])) {
    const report = await getReport(auth,reportMatch[1])
    if (!reportMatch[2] && method==='GET') {
      const [items,history] = await Promise.all([
        db.from('performance_daily_activities').select('*,performance_daily_intervals(id,start_minute,end_minute),performance_daily_attachments(id,name,size_bytes,mime_type,created_at,created_by)')
          .eq('report_id',report.id).order('created_at'),
        db.from('performance_daily_history').select('*').eq('report_id',report.id).order('created_at'),
      ])
      check(items.error);check(history.error)
      const names = new Map((await people(auth)).map(u=>[u.Id,name(u)]))
      return json(request,{...report,employee_name:names.get(report.employee_id), activities:items.data,
        history:(history.data??[]).map(row=>({...row,actor_name:names.get(row.created_by)})),can_review:report.employee_id!==auth.userId&&(canAdmin(auth)||report.reviewer_id===auth.userId)})
    }
    if (reportMatch[2]==='activities' && method==='PUT') {
      if (report.employee_id!==auth.userId) throw new HttpError(404,'گزارش یافت نشد')
      return json(request,{id:await mutate(auth,'edit',null,report.id,await activity(auth,await body<Row>(request)))})
    }
    if (reportMatch[2]==='review' && method==='POST') {
      const input = await body<Row>(request)
      if (!['approve','return'].includes(input.action)) throw new HttpError(400,'اقدام معتبر نیست')
      return json(request,{id:await mutate(auth,input.action,null,report.id,{note:text(input.note,2000,input.action==='return')})})
    }
  }
  const attachmentMatch = route.match(/^\/files\/([^/]+)$/)
  if (attachmentMatch && uuid(attachmentMatch[1]) && method==='GET') {
    const metadata = await db.from('performance_daily_attachments').select('activity_id,performance_daily_activities(report_id)')
      .eq('id',attachmentMatch[1]).maybeSingle()
    check(metadata.error)
    const activityRow = metadata.data?.performance_daily_activities as unknown as Row
    if (!activityRow?.report_id) throw new HttpError(404,'پیوست یافت نشد')
    await getReport(auth,activityRow.report_id)
    const found = await db.from('performance_daily_attachments').select('name,content_base64').eq('id',attachmentMatch[1]).maybeSingle()
    check(found.error)
    if (!found.data) throw new HttpError(404,'پیوست یافت نشد')
    return new Response(Uint8Array.from(atob(found.data.content_base64),c=>c.charCodeAt(0)),{headers:{
      ...corsHeaders(request),'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(found.data.name).replace(/'/g,'%27')}`,
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    }})
  }
  throw new HttpError(405,'عملیات پشتیبانی نمی‌شود')
}
