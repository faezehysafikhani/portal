import { adminClient, AuthContext } from '../_shared/auth.ts'
import { body, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { canDownload, canReview, codes, policyAt, reportingDays, scope, type Policy } from './performance-policy.ts'
import { organizationPeople } from './organization.ts'

type Row = Record<string, any>
const db = adminClient()
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tehran', dateStyle: 'short' }).format(new Date())
const list = (value: unknown): string[] => { try { const parsed = JSON.parse(String(value ?? '[]')); return Array.isArray(parsed) ? parsed : [] } catch { return [] } }
const check = (error: { message: string } | null) => {
  if (error) { console.error(error.message); throw new HttpError(500,'خطا در دریافت یا ذخیره اطلاعات عملکرد') }
}
const activityPolicy = (p:Policy) => ({
  enabled:p.enabled,allowEmpty:p.allowEmpty,allowPast:p.allowPast,pastDays:p.pastDays,requireTime:p.requireTime,allowManual:p.allowManual,
  requireDescription:p.requireDescription,requireOutcome:p.requireOutcome,categories:p.categories,files:p.files,
})
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
async function myTasks(auth: AuthContext, id?: string): Promise<Row[]> {
  let query = db.from('Tasks').select('Id,Title,Description,AssignedByUserId,AssignedToUserId,AssigneeUserIdsJson,ProjectId,ProjectIdsJson,CreatedAt,DueDate,Priority,Status,Progress,AssignmentState')
    .eq('TenantId',auth.tenantId).eq('IsDeleted',false)
    .or(`AssignedToUserId.eq.${auth.userId},AssigneeUserIdsJson.ilike.%${auth.userId}%`)
  if (id) query = query.eq('Id',id)
  const result = await query.order('CreatedAt',{ascending:false})
  check(result.error)
  return (result.data ?? []).filter(task => task.AssignedToUserId === auth.userId || list(task.AssigneeUserIdsJson).includes(auth.userId))
}
export function validatePerformanceFile(input: Row) {
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
async function activity(auth: AuthContext, input: Row, policy: Policy, reportId?: string) {
  if (!uuid(input.id)) throw new HttpError(400,'شناسه فعالیت معتبر نیست')
  let validKind=policy.categories.some(c=>c.id===input.kind&&c.active)
  if (!validKind&&reportId) {
    const previous=await db.from('performance_daily_activities').select('kind').eq('report_id',reportId).eq('id',input.id).maybeSingle()
    check(previous.error);validKind=previous.data?.kind===input.kind
  }
  if (!validKind ||
      !['planned','in_progress','done','blocked'].includes(input.status) ||
      !['intervals','manual','none'].includes(input.timeMode)) throw new HttpError(400,'نوع، وضعیت یا روش ثبت زمان معتبر نیست')
  const intervals: {s:number;e:number}[] = input.timeMode === 'intervals' && Array.isArray(input.intervals)
    ? input.intervals.map((range: Row) => ({s:range?.s,e:range?.e})).sort((a: Row,b: Row) => a.s-b.s) : []
  if(!policy.allowManual&&input.timeMode==='manual'&&(policy.requireTime||input.minutes!==0))
    throw new HttpError(400,'ثبت مدت بدون ساعت شروع و پایان مجاز نیست')
  if (input.timeMode === 'intervals' && (!intervals.length || intervals.length > 20 ||
      intervals.some((r, i) => !Number.isInteger(r.s) || !Number.isInteger(r.e) || r.s<0 || r.e>1440 || r.s>=r.e || (i>0 && intervals[i-1].e>r.s))))
    throw new HttpError(400,'بازه‌های زمانی باید مستقل و در همان روز باشند')
  const minutes = input.timeMode === 'intervals' ? intervals.reduce((total,r) => total+r.e-r.s,0) : input.timeMode==='none'?0:input.minutes
  if (!Number.isInteger(minutes) || minutes < (policy.requireTime?1:0) || minutes > 1440) throw new HttpError(400,'مدت فعالیت با تنظیمات سازمان مطابقت ندارد')
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
  const validated=files.map(validatePerformanceFile)
  if(validated.some(f=>f.bytes>policy.files.maxBytes||!policy.files.mimes.includes(f.mime)))throw new HttpError(400,'حجم یا فرمت پیوست مطابق تنظیمات سازمان نیست')
  return {id:input.id,title:text(input.title,180,true),description:text(input.description,4000,policy.requireDescription),kind:input.kind,
    status:input.status,timeMode:input.timeMode==='none'?'manual':input.timeMode,minutes,intervals,taskId,projectId,outcome:text(input.outcome,2000,policy.requireOutcome&&input.status==='done'),
    notes:text(input.notes,2000),files:validated,removeFiles}
}
const errors: Record<string,[number,string]> = {
  daily_not_found:[404,'گزارش یا فعالیت یافت نشد'], daily_locked:[409,'این گزارش در وضعیت فعلی قابل تغییر نیست'],
  daily_note:[400,'ثبت دلیل برگشت الزامی است'], daily_reviewer:[400,'مدیر مستقیم یا ارزیاب فعال در پروفایل شما تعریف نشده است'],
  daily_empty:[400,'ابتدا یک فعالیت برای این روز ثبت کنید'], daily_overlap:[409,'این بازه با فعالیت دیگری در همین روز هم‌پوشانی دارد'],
  daily_total:[400,'مجموع زمان فعالیت‌های این روز بیشتر از ۲۴ ساعت است'], daily_duplicate:[409,'فعالیت یکسان قبلاً ثبت شده است'],
  daily_files:[400,'حداکثر ۵ فایل برای هر فعالیت مجاز است'],
  daily_file_policy:[400,'تعداد یا مجموع حجم پیوست‌ها بیش از سقف مجاز است'],daily_disabled:[403,'ثبت گزارش روزانه غیرفعال است'],
  daily_date:[400,'ثبت یا ویرایش فعالیت برای این تاریخ مجاز نیست'],daily_late_limit:[400,'مهلت مجاز ارسال این گزارش به پایان رسیده است'],
}
async function mutate(auth: AuthContext, action: string, workDate: string | null, report: string | null, data: Row = {}) {
  const access = ['approve','return'].includes(action)?await scope(auth):null
  const result = await db.rpc('performance_daily_controlled',{
    p_tenant:auth.tenantId,p_actor:auth.userId,p_action:action,p_date:workDate,p_report:report,p_data:data,
    p_reviewer:null,p_org_approve:!!access?.org&&access.grants.has(codes.approve),
  })
  const error = result.error && errors[result.error.message]
  if (error) throw new HttpError(...error)
  check(result.error)
  return result.data
}
async function getReport(auth: AuthContext, id: string, download=false): Promise<Row> {
  const result = await db.from('performance_daily_reports').select('*').eq('tenant_id',auth.tenantId).eq('id',id).maybeSingle()
  check(result.error)
  const found = result.data
  if(!found)throw new HttpError(404,'گزارش یافت نشد')
  if(found.employee_id!==auth.userId){
    const access=await scope(auth)
    const allowed=found.submitted_at&&(download?canDownload(access,found.employee_id):access.org||access.direct.has(found.employee_id))
    if(!allowed)throw new HttpError(404,'گزارش یافت نشد')
  }
  return found
}
export async function handleDailyPerformance(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  const prefix = '/performance/daily'
  if (!path.startsWith(prefix+'/')) return null
  const route = path.slice(prefix.length)
  const method = request.method
  if (route==='/access' && method==='GET') {
    const access=await scope(auth)
    return json(request,{canReview:access.org||access.direct.size>0})
  }
  if (route==='/options' && method==='GET') {
    const [tasks,projects,users,policy] = await Promise.all([
      myTasks(auth),
      db.from('Projects').select('Id,Name').eq('TenantId',auth.tenantId).eq('IsDeleted',false).eq('Status',0).order('Name'),
      organizationPeople(auth),
      policyAt(auth),
    ])
    check(projects.error)
    const names = new Map(users.map(u => [u.id,u.full_name]))
    return json(request,{today:today(),projects:projects.data,policy:activityPolicy(policy),tasks:tasks.map(task=>({...task,AssignedByName:names.get(task.AssignedByUserId), ProjectId:task.ProjectId ?? list(task.ProjectIdsJson).find(uuid) ?? null}))})
  }
  if(route==='/policy'&&method==='GET')return json(request,activityPolicy(await policyAt(auth,date(url.searchParams.get('date')))))
  if (route==='/reports' && method==='GET') {
    const review = url.searchParams.get('scope')==='review'
    let query = db.from('performance_daily_reports').select('*,performance_daily_activities(id,minutes)').eq('tenant_id',auth.tenantId)
    if (review) {
      query = query.in('status',['submitted','returned','approved']).neq('employee_id',auth.userId)
      const access=await scope(auth)
      if(!access.org&&!access.direct.size)return json(request,[])
      if(!access.org)query=query.in('employee_id',[...access.direct])
    } else query = query.eq('employee_id',auth.userId)
    const from = url.searchParams.get('from'), to = url.searchParams.get('to')
    if (from) query = query.gte('work_date',date(from))
    if (to) query = query.lte('work_date',date(to))
    const result = await query.order('work_date',{ascending:false}).order('created_at',{ascending:false}).limit(250)
    check(result.error)
    const users = review ? await organizationPeople(auth) : []
    const ids = new Map(users.map(u=>[u.id,u.full_name]))
    return json(request,(result.data??[]).map(row=>({...row,employee_name:ids.get(row.employee_id)})))
  }
  if (route==='/calendar' && method==='GET') {
    const from = date(url.searchParams.get('from')), to = date(url.searchParams.get('to'))
    const start = Date.parse(from), end = Date.parse(to), day = 86400000
    if (end < start || end-start > 62*day) throw new HttpError(400,'حداکثر بازه تقویم ۶۳ روز است')
    const days=await reportingDays(auth,[auth.userId],from,to)
    return json(request,{today:today(),leave:days.filter(d=>d.exemption==='leave').map(d=>d.work_date),days})
  }
  if (route==='/activities' && method==='POST') {
    const input = await body<Row>(request)
    const workDate=date(input.date,true)
    return json(request,{id:await mutate(auth,'create',workDate,null,await activity(auth,input,await policyAt(auth,workDate)))},201)
  }
  if (route==='/submit' && method==='POST') {
    const input = await body<Row>(request)
    return json(request,{id:await mutate(auth,'submit',date(input.date,true),null,{reason:text(input.reason,2000)})})
  }
  const reportMatch = route.match(/^\/reports\/([^/]+)(?:\/(activities|review|reopen))?$/)
  if (reportMatch && uuid(reportMatch[1])) {
    const report = await getReport(auth,reportMatch[1])
    if (!reportMatch[2] && method==='GET') {
      const [items,history] = await Promise.all([
        db.from('performance_daily_activities').select('*,performance_daily_intervals(id,start_minute,end_minute),performance_daily_attachments(id,name,size_bytes,mime_type,created_at,created_by),Projects(Name),Tasks(Title)')
          .eq('report_id',report.id).order('created_at'),
        db.from('performance_daily_history').select('*').eq('report_id',report.id).order('created_at'),
      ])
      check(items.error);check(history.error)
      const people = new Map((await organizationPeople(auth)).map(u=>[u.id,u]))
      const currentManager=people.get(people.get(report.employee_id)?.manager_id??'')
      const reviewerName=report.status==='submitted'?(currentManager?.active?currentManager.full_name:undefined):people.get(report.reviewed_by)?.full_name
      const access=await scope(auth), policy=await policyAt(auth,report.work_date), own=report.employee_id===auth.userId
      const downloadable=own||canDownload(access,report.employee_id)
      return json(request,{...report,employee_name:people.get(report.employee_id)?.full_name,reviewer_name:reviewerName,activities:items.data,
        categories:policy.categories,can_download:downloadable,can_reopen:own&&policy.enabled&&policy.allowRevision&&report.status==='submitted',
        history:(history.data??[]).map(row=>({...row,actor_name:people.get(row.created_by)?.full_name})),can_review:!own&&canReview(access,report.employee_id)})
    }
    if (reportMatch[2]==='activities' && method==='PUT') {
      if (report.employee_id!==auth.userId) throw new HttpError(404,'گزارش یافت نشد')
      return json(request,{id:await mutate(auth,'edit',null,report.id,await activity(auth,await body<Row>(request),await policyAt(auth,report.work_date),report.id))})
    }
    if(reportMatch[2]==='reopen'&&method==='POST')return json(request,{id:await mutate(auth,'reopen',null,report.id)})
    if (reportMatch[2]==='review' && method==='POST') {
      const input = await body<Row>(request)
      if (!['approve','return'].includes(input.action)) throw new HttpError(400,'اقدام معتبر نیست')
      return json(request,{id:await mutate(auth,input.action,null,report.id,{note:text(input.note,2000,input.action==='return')})})
    }
  }
  const attachmentMatch = route.match(/^\/files\/([^/]+)$/)
  if (attachmentMatch && uuid(attachmentMatch[1]) && method==='GET') {
    const metadata = await db.from('performance_daily_attachments').select('created_at,performance_daily_activities(report_id)')
      .eq('id',attachmentMatch[1]).maybeSingle()
    check(metadata.error)
    const activityRow = metadata.data?.performance_daily_activities as unknown as Row
    const archived = activityRow?.report_id?null:await db.from('performance_archived_attachments').select('report_id,created_at').eq('id',attachmentMatch[1]).maybeSingle()
    if(archived)check(archived.error)
    const reportId=activityRow?.report_id??archived?.data?.report_id
    if (!reportId) throw new HttpError(404,'پیوست یافت نشد')
    await getReport(auth,reportId,true)
    const retention=(await policyAt(auth)).files.retentionDays
    if(retention>0&&Date.parse(metadata.data?.created_at??archived?.data?.created_at??'')<Date.now()-retention*86400000)
      throw new HttpError(410,'مدت دسترسی آنلاین به این پیوست به پایان رسیده است')
    const found = await db.from(archived?'performance_archived_attachments':'performance_daily_attachments').select('name,content_base64').eq('id',attachmentMatch[1]).maybeSingle()
    check(found.error)
    if (!found.data) throw new HttpError(404,'پیوست یافت نشد')
    return new Response(Uint8Array.from(atob(found.data.content_base64),c=>c.charCodeAt(0)),{headers:{
      ...corsHeaders(request),'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(found.data.name).replace(/'/g,'%27')}`,
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    }})
  }
  throw new HttpError(405,'عملیات پشتیبانی نمی‌شود')
}
