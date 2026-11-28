import { adminClient, AuthContext } from '../_shared/auth.ts'
import { body, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { validatePerformanceFile } from './performance-daily.ts'
import { canDownload, policyAt, scope } from './performance-policy.ts'

type Row = Record<string, any>
const db = adminClient()
const isId = (v: unknown): v is string => typeof v==='string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
const admin = (auth: AuthContext) => auth.isAdmin || auth.permissions.includes('performance.admin')
const taskFields = 'Id,Title,Description,AssignedByUserId,AssignedToUserId,ProjectId,StartDate,DueDate,CreatedAt,Priority,Progress,AssignmentState,AssignmentOutcome,AssignmentNotes,AssignmentSeenAt,AssignmentDueHasTime,AssignmentExtension,CompletionRequestedAt,CompletionApprovedAt'
const employeeActions = ['seen','start','progress','block','submit','extend']
const managerActions = ['edit','comment','approve','return','cancel','extend_approve','extend_reject']
const errors: Record<string,[number,string]> = {
  assignment_scope:[403,'این کارمند در محدوده مجاز واگذاری شما نیست'],
  assignment_not_found:[404,'وظیفه یافت نشد'],
  assignment_locked:[409,'این عملیات در وضعیت فعلی وظیفه امکان‌پذیر نیست'],
  assignment_note:[400,'نوشتن توضیح الزامی است'],
  assignment_dates:[400,'تاریخ شروع یا مهلت انجام معتبر نیست'],
  assignment_project:[403,'استفاده از این پروژه برای شما مجاز نیست'],
}
function check(error: {message:string} | null) {
  if (!error) return
  const known=errors[error.message]
  if (known) throw new HttpError(...known)
  console.error(error.message);throw new HttpError(500,'عملیات وظیفه انجام نشد')
}
function string(value: unknown, max: number, required = false) {
  if (value != null && typeof value!=='string') throw new HttpError(400,'متن واردشده معتبر نیست')
  const trimmed = String(value ?? '').trim()
  if ((required && !trimmed) || trimmed.length > max) throw new HttpError(400,'فیلدهای اجباری و طول متن را بررسی کنید')
  return trimmed
}
function moment(value: unknown) {
  if (typeof value!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|\+03:30)$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new HttpError(400,'تاریخ یا ساعت معتبر نیست')
  const date = value.slice(0,10)
  const parsed = new Date(date+'T12:00:00Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date) throw new HttpError(400,'تاریخ معتبر نیست')
  return new Date(value).toISOString()
}
function integer(value: unknown, max: number) {
  if (typeof value!=='number' || !Number.isInteger(value) || value<0 || value>max)
    throw new HttpError(400,'مقدار عددی خارج از بازه مجاز است')
  return value
}
function validFiles(value: unknown) {
  if (value===undefined) return []
  if (!Array.isArray(value) || value.length>5 || value.some(item=>!item||typeof item!=='object')) throw new HttpError(400,'حداکثر ۵ پیوست قابل ثبت است')
  return value.map(validatePerformanceFile)
}
function validated(action: string, input: Row): Row {
  const data: Row = {}
  if (action==='create' || action==='edit') {
    if (action==='create' && !isId(input.employeeId)) throw new HttpError(400,'مسئول انجام را انتخاب کنید')
    if (input.projectId && !isId(input.projectId)) throw new HttpError(400,'پروژه معتبر نیست')
    const startsAt=moment(input.startsAt),dueAt=moment(input.dueAt)
    if (startsAt>dueAt) throw new HttpError(400,'مهلت انجام باید بعد از تاریخ شروع باشد')
    Object.assign(data,{employeeId:input.employeeId,projectId:input.projectId || null,startsAt,dueAt,
      dueHasTime:input.dueHasTime===true,title:string(input.title,200,true),description:string(input.description,8000,true),
      outcome:string(input.outcome,4000),notes:string(input.notes,4000),priority:integer(input.priority,3)})
  }
  if (['progress','submit'].includes(action)) data.progress=integer(input.progress,100)
  if (action==='extend') Object.assign(data,{dueAt:moment(input.dueAt),dueHasTime:input.dueHasTime===true})
  data.note=string(input.note,4000,['block','submit','return','cancel','comment','extend'].includes(action))
  if (['create','edit','submit'].includes(action)) data.files=validFiles(input.files)
  return data
}
async function team(auth: AuthContext): Promise<Row[]> {
  if (admin(auth)) {
    const result=await db.from('Users').select('Id,FirstName,LastName,Username,Position').eq('TenantId',auth.tenantId).eq('IsActive',true).eq('IsDeleted',false).neq('Id',auth.userId).order('FirstName')
    check(result.error)
    return (result.data??[]).map(u=>({id:u.Id,name:`${u.FirstName??''} ${u.LastName??''}`.trim()||u.Username,position:u.Position}))
  }
  const result=await db.rpc('performance_direct_reports',{p_tenant:auth.tenantId,p_actor:auth.userId})
  check(result.error);return result.data??[]
}
async function get(auth: AuthContext,id: string): Promise<{task:Row;manage:boolean;own:boolean}> {
  const result=await db.from('Tasks').select(taskFields).eq('TenantId',auth.tenantId).eq('IsDeleted',false).eq('Id',id).not('AssignmentState','is',null).maybeSingle()
  check(result.error)
  const task=result.data as unknown as Row | null
  if (!task) throw new HttpError(404,'وظیفه یافت نشد')
  const own=task.AssignedToUserId===auth.userId
  const manage=admin(auth)||(await team(auth)).some(member=>member.id===task.AssignedToUserId)
  if (!own && !manage) throw new HttpError(404,'وظیفه یافت نشد')
  return {task,manage,own}
}
async function names(auth: AuthContext, ids: unknown[]) {
  const valid = [...new Set(ids.filter(isId))]
  const result = new Map<string,string>()
  for(let i=0;i<valid.length;i+=100) {
    const found=await db.from('Users').select('Id,FirstName,LastName,Username').eq('TenantId',auth.tenantId).in('Id',valid.slice(i,i+100))
    check(found.error)
    for(const u of found.data??[]) result.set(u.Id,`${u.FirstName??''} ${u.LastName??''}`.trim()||u.Username)
  }
  return result
}
async function taskMinutes(auth: AuthContext,tasks: Row[]) {
  const totals = new Map<string,number>()
  const owners = new Map(tasks.map(task=>[task.Id,task.AssignedToUserId]))
  for(let i=0;i<tasks.length;i+=100) {
    const ids=tasks.slice(i,i+100).map(task=>task.Id)
    for(let offset=0;;offset+=500) {
      const result=await db.from('performance_daily_activities').select('id,task_id,minutes,performance_daily_reports!inner(tenant_id,employee_id)')
        .eq('performance_daily_reports.tenant_id',auth.tenantId).in('task_id',ids).order('id').range(offset,offset+499)
      check(result.error)
      const rows = (result.data??[]) as unknown as Row[]
      for(const row of rows) if(owners.get(row.task_id)===row.performance_daily_reports.employee_id)
        totals.set(row.task_id,(totals.get(row.task_id)??0)+row.minutes)
      if(rows.length<500) break
    }
  }
  return totals
}
function isLate(task: Row) {
  if (task.AssignmentState==='cancelled') return false
  const cutoff=['review','approved'].includes(task.AssignmentState)?task.CompletionRequestedAt:Date.now()
  return cutoff!=null && Number(new Date(cutoff))>Date.parse(task.DueDate)
}
async function listTasks(auth: AuthContext,own: boolean) {
  const direct = !own && !admin(auth)?await team(auth):[]
  if (!own && !admin(auth) && !direct.length) return []
  const tasks: Row[]=[]
  for(let offset=0;;offset+=500) {
    let query=db.from('Tasks').select(taskFields).eq('TenantId',auth.tenantId).eq('IsDeleted',false).not('AssignmentState','is',null)
    if (own) query=query.eq('AssignedToUserId',auth.userId)
    else if (!admin(auth)) query=query.in('AssignedToUserId',direct.map(member=>member.id))
    const result=await query.order('CreatedAt',{ascending:false}).order('Id').range(offset,offset+499)
    check(result.error)
    const rows=(result.data??[]) as unknown as Row[]
    tasks.push(...rows)
    if(rows.length<500)break
  }
  const [labels,totals] = await Promise.all([names(auth,tasks.flatMap(t=>[t.AssignedToUserId,t.AssignedByUserId])),taskMinutes(auth,tasks)])
  return tasks.map(task=>({...task,employeeName:labels.get(task.AssignedToUserId),managerName:labels.get(task.AssignedByUserId),
    minutes:totals.get(task.Id)??0,late:isLate(task)}))
}
async function detail(auth: AuthContext,id: string) {
  const {task,own,manage}=await get(auth,id)
  const downloadable=own||canDownload(await scope(auth),task.AssignedToUserId)
  const [events,files,activities,project]=await Promise.all([
    db.from('TaskActivityLogs').select('Id,ActorUserId,Action,DetailsJson,CreatedAt').eq('TaskId',id).eq('TenantId',auth.tenantId)
      .eq('IsDeleted',false).like('Action','assignment_%').order('CreatedAt',{ascending:false}),
    db.from('performance_task_files').select('id,event_id,name,size_bytes,mime_type,uploader_id,created_at').eq('task_id',id).order('created_at'),
    db.from('performance_daily_activities').select('id,title,description,minutes,outcome,performance_daily_reports!inner(tenant_id,employee_id,work_date),performance_daily_attachments(id,name,size_bytes)')
      .eq('performance_daily_reports.tenant_id',auth.tenantId).eq('performance_daily_reports.employee_id',task.AssignedToUserId).eq('task_id',id).order('created_at',{ascending:false}),
    task.ProjectId?db.from('Projects').select('Name').eq('TenantId',auth.tenantId).eq('Id',task.ProjectId).maybeSingle():Promise.resolve({data:null,error:null}),
  ])
  check(events.error);check(files.error);check(activities.error);check(project.error)
  const people=await names(auth,[task.AssignedToUserId,task.AssignedByUserId,...(events.data??[]).map(e=>e.ActorUserId)])
  const related=(activities.data??[]) as unknown as Row[]
  return {...task,own,manage,late:isLate(task),projectName:project.data?.Name,employeeName:people.get(task.AssignedToUserId),
    managerName:people.get(task.AssignedByUserId),minutes:related.reduce((n,a)=>n+a.minutes,0),files:downloadable?files.data:[],
    activities:related.map(a=>({id:a.id,title:a.title,description:a.description,outcome:a.outcome,minutes:a.minutes,date:a.performance_daily_reports.work_date,files:downloadable?a.performance_daily_attachments:[]})),
    events:(events.data??[]).map(e=>({id:e.Id,action:e.Action,date:e.CreatedAt,actor:people.get(e.ActorUserId),details:JSON.parse(e.DetailsJson??'{}')}))}
}
async function attachment(request:Request,auth:AuthContext,taskId:string,fileId:string, activityFile:boolean) {
  const {task,own}=await get(auth,taskId)
  if(!own&&!canDownload(await scope(auth),task.AssignedToUserId))throw new HttpError(404,'پیوست یافت نشد')
  let file:Row|null
  if (activityFile) {
    const result=await db.from('performance_daily_attachments').select('name,content_base64,created_at,performance_daily_activities!inner(task_id,performance_daily_reports!inner(tenant_id,employee_id))')
      .eq('id',fileId).eq('performance_daily_activities.task_id',taskId).eq('performance_daily_activities.performance_daily_reports.tenant_id',auth.tenantId)
      .eq('performance_daily_activities.performance_daily_reports.employee_id',task.AssignedToUserId).maybeSingle()
    check(result.error);file=result.data as unknown as Row | null
  } else {
    const result=await db.from('performance_task_files').select('name,content_base64,created_at').eq('id',fileId).eq('task_id',taskId).maybeSingle()
    check(result.error);file=result.data
  }
  if(!file)throw new HttpError(404,'پیوست یافت نشد')
  const retention=(await policyAt(auth)).files.retentionDays
  if(retention>0&&Date.parse(file.created_at)<Date.now()-retention*86400000)
    throw new HttpError(410,'مدت دسترسی آنلاین به این پیوست به پایان رسیده است')
  return new Response(Uint8Array.from(atob(file.content_base64),c=>c.charCodeAt(0)),{headers:{
    ...corsHeaders(request),'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
  }})
}
export async function handleTaskAssignments(request:Request,auth:AuthContext,path:string,url:URL):Promise<Response|null> {
  const base='/performance/assignments'
  if(path!==base&&!path.startsWith(base+'/'))return null
  const sub=path.slice(base.length),method=request.method
  if(sub==='/access'&&method==='GET') return json(request,{canManage:admin(auth)||auth.permissions.includes('performance.manage')||(await team(auth)).length>0})
  if(sub==='/options'&&method==='GET') {
    const employees=await team(auth)
    let projectsQuery=db.from('Projects').select('Id,Name').eq('TenantId',auth.tenantId).eq('Status',0).eq('IsDeleted',false).order('Name')
    if(!admin(auth))projectsQuery=projectsQuery.eq('ManagerUserId',auth.userId)
    const projects=await projectsQuery;check(projects.error)
    return json(request,{employees,projects:(projects.data??[]).map(p=>({id:p.Id,name:p.Name}))})
  }
  if(!sub&&method==='GET') return json(request,await listTasks(auth,url.searchParams.get('scope')==='mine'))
  const match=sub.match(/^\/([^/]+)(?:\/(files|activity-files)\/([^/]+))?$/)
  if(match&&isId(match[1])&&isId(match[3])&&method==='GET')return attachment(request,auth,match[1],match[3],match[2]==='activity-files')
  if(match&&isId(match[1])&&!match[2]&&method==='GET')return json(request,await detail(auth,match[1]))
  if((!sub&&method==='POST')||(match&&isId(match[1])&&!match[2]&&method==='PATCH')) {
    const input=await body<Row>(request)
    if (!input || typeof input!=='object' || Array.isArray(input)) throw new HttpError(400,'بدنه درخواست معتبر نیست')
    const action=method==='POST'?'create':String(input.action??'')
    const id=method==='POST'?input.id:match?.[1]
    if(!isId(id)|| (method==='PATCH'&&![...employeeActions,...managerActions].includes(action)))throw new HttpError(400,'عملیات وظیفه معتبر نیست')
    const data=validated(action,input)
    if(data.files?.length){
      const rules=(await policyAt(auth)).files
      if(data.files.length>rules.maxCount||data.files.some((f:Row)=>f.bytes>rules.maxBytes||!rules.mimes.includes(f.mime))
        ||data.files.reduce((n:number,f:Row)=>n+f.bytes,0)>rules.totalBytes)
        throw new HttpError(400,'تعداد، مجموع حجم یا فرمت پیوست مطابق تنظیمات سازمان نیست')
    }
    const result=await db.rpc('performance_task_mutate',{p_tenant:auth.tenantId,p_actor:auth.userId,p_admin:admin(auth),p_task:id,p_action:action,p_data:data})
    check(result.error)
    return json(request,{id:result.data},method==='POST'?201:200)
  }
  throw new HttpError(405,'عملیات پشتیبانی نمی‌شود')
}
