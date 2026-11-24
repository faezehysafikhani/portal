import { adminClient, AuthContext } from '../_shared/auth.ts'
import { HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { jalaliDateString } from '../_shared/jalali.ts'
import { canDownload, canReview, check, codes, localDay, name, policyAt, range, reportingDays, scope, today, uuid, type Scope } from './performance-policy.ts'
import { workbook } from './performance-workbook.ts'

type Row=Record<string,any>
const db=adminClient()
const ms=86400000
const stamp=(v:unknown)=>Date.parse(String(v??''))
const total=(rows:Row[],key:string)=>rows.reduce((n,row)=>n+Number(row[key]??0),0)
const pct=(n:number,d:number)=>d?Math.round(n*1000/d)/10:null
const day=(value:string)=>new Date(value).toISOString().slice(0,10)
function inPeriod(value:string|undefined,from:string,to:string){return !!value&&localDay(value)>=from&&localDay(value)<=to}
async function all(build:(offset:number)=>PromiseLike<{error:{message:string}|null;data:unknown[]|null}>){
  const output:Row[]=[]
  for(let offset=0;;offset+=400){
    const rows=await build(offset);check(rows.error)
    output.push(...(rows.data??[]) as Row[])
    if((rows.data??[]).length<400)return output
  }
}
const group=(items:Row[],key:(a:Row)=>string)=>{
  const map=new Map<string,Row[]>()
  for(const item of items){const id=key(item);const rows=map.get(id)??[];rows.push(item);map.set(id,rows)}
  return map
}
async function persons(auth:AuthContext,access:Scope,employee:string|null){
  if(employee&&(!uuid(employee)||(!access.org&&!access.direct.has(employee))))throw new HttpError(404,'کارمند یافت نشد')
  let query=db.from('Users').select('Id,FirstName,LastName,Username,Department,Position,DirectManager,IsActive').eq('TenantId',auth.tenantId).eq('IsDeleted',false)
  if(employee)query=query.eq('Id',employee)
  else if(!access.org)query=query.in('Id',[...access.direct])
  const result=await query.order('FirstName');check(result.error)
  if(employee&&!result.data?.length)throw new HttpError(404,'کارمند یافت نشد')
  return (result.data??[]).map(u=>({id:u.Id,name:name(u),position:u.Position,department:u.Department,manager:u.DirectManager,active:u.IsActive}))
}
function withReportTime(r:Row,current:number){
  const history=(r.performance_daily_history??[]) as Row[]
  const earliest=history.filter(h=>h.action==='submit'||h.action==='resubmit').sort((a,b)=>stamp(a.created_at)-stamp(b.created_at))[0]
  const first=earliest?.created_at??r.submitted_at
  return {first,late:!!first&&current<stamp(first),returns:history.filter(h=>h.action==='return').map(({created_at,note})=>({date:created_at,note}))}
}
async function reportData(auth:AuthContext,access:Scope,employees:Awaited<ReturnType<typeof persons>>,from:string,to:string,includeActivities:boolean){
  const ids=employees.map(e=>e.id)
  if(!ids.length)return {reports:[],days:[],activities:[]}
  const [rows,days]=await Promise.all([
    all(o=>db.from('performance_daily_reports').select('id,employee_id,work_date,status,submitted_at,reviewed_at,no_activity_reason,performance_daily_history(action,note,created_at)')
      .eq('tenant_id',auth.tenantId).in('employee_id',ids).gte('work_date',from).lte('work_date',to).order('id').range(o,o+399)),
    reportingDays(auth,ids,from,to),
  ])
  const submitted=rows.filter(r=>!!r.submitted_at)
  const daysByKey=new Map(days.map(d=>[`${d.employee_id}:${d.work_date}`,d]))
  const people=new Map(employees.map(u=>[u.id,u]))
  const rowsByKey=new Map(rows.map(r=>[`${r.employee_id}:${r.work_date}`,r]))
  const activityRows=await all(o=>db.from('performance_daily_activities').select(
    'id,kind,minutes,project_id,task_id,title,description,outcome,status,performance_daily_reports!inner(employee_id,tenant_id,work_date,status,submitted_at),Projects(Name),Tasks(Title)')
    .eq('performance_daily_reports.tenant_id',auth.tenantId).in('performance_daily_reports.employee_id',ids)
    .gte('performance_daily_reports.work_date',from).lte('performance_daily_reports.work_date',to).order('id').range(o,o+399))
  const activities:Row[]=activityRows.map(a=>({id:a.id,kind:a.kind,minutes:a.minutes,projectId:a.project_id,
    project:a.Projects?.Name,task:a.Tasks?.Title,reportStatus:a.performance_daily_reports.status,
    employee:a.performance_daily_reports.employee_id,date:a.performance_daily_reports.work_date,
    title:a.title,description:a.description,outcome:a.outcome,status:a.status,submitted:!!a.performance_daily_reports.submitted_at}))
  const byDay=group(activities,a=>a.employee+':'+a.date)
  const reports:Row[]=submitted.map(r=>{
    const items=byDay.get(r.employee_id+':'+r.work_date)??[],d=daysByKey.get(r.employee_id+':'+r.work_date)
    const time=withReportTime(r,stamp(d?.deadline))
    return {id:r.id,employee:r.employee_id,employeeName:people.get(r.employee_id)?.name,department:people.get(r.employee_id)?.department,
      date:r.work_date,status:r.status,submitted:r.submitted_at,approvedAt:r.status==='approved'?r.reviewed_at:null,
      first:time.first,late:time.late,returns:time.returns,activities:items.length,minutes:total(items,'minutes'),
      projects:items.filter(a=>!!a.projectId).length,nonProjects:items.filter(a=>!a.projectId).length,
      canReview:r.status==='submitted'&&r.employee_id!==auth.userId&&canReview(access,r.employee_id)}
  })
  for(const d of days){
    if(!people.get(d.employee_id)?.active||!d.required||Date.now()<=stamp(d.deadline))continue
    const existing=rowsByKey.get(d.employee_id+':'+d.work_date)
    if(existing?.submitted_at)continue
    const items=byDay.get(d.employee_id+':'+d.work_date)??[]
    reports.push({id:null,employee:d.employee_id,employeeName:people.get(d.employee_id)?.name,department:people.get(d.employee_id)?.department,
      date:d.work_date,status:'missing',draft:!!existing,activities:existing?items.length:null,minutes:existing?total(items,'minutes'):null,
      projects:existing?items.filter(a=>!!a.projectId).length:null,nonProjects:existing?items.filter(a=>!a.projectId).length:null})
  }
  reports.sort((a,b)=>b.date.localeCompare(a.date)||String(a.employeeName).localeCompare(String(b.employeeName),'fa'))
  return {reports,days,activities:includeActivities?activities:[]}
}
async function loadTasks(auth:AuthContext,ids:string[],from:string,to:string,includeFiles:boolean){
  if(!ids.length)return []
  const rows=await all(o=>db.from('Tasks').select('Id,Title,DueDate,CreatedAt,Status,Progress,AssignedToUserId,AssignmentState,CompletionRequestedAt,CompletionApprovedAt,IsCompletionApproved')
    .eq('TenantId',auth.tenantId).eq('IsDeleted',false).in('AssignedToUserId',ids).order('Id').range(o,o+399))
  const tasks=rows.filter(t=>inPeriod(t.DueDate,from,to)||inPeriod(t.CreatedAt,from,to)||inPeriod(t.CompletionApprovedAt,from,to)||inPeriod(t.CompletionRequestedAt,from,to))
  const logs:Row[]=[],files:Row[]=[]
  for(let i=0;i<tasks.length;i+=100){
    const keys=tasks.slice(i,i+100).map(t=>t.Id)
    const [history,attachments]=await Promise.all([
      all(o=>db.from('TaskActivityLogs').select('Id,TaskId,Action,CreatedAt,DetailsJson').eq('TenantId',auth.tenantId).eq('IsDeleted',false)
        .in('TaskId',keys).in('Action',['assignment_submit','assignment_edit','assignment_return','assignment_extend_approve','CompletionRequested','CompletionRejected'])
        .order('CreatedAt').order('Id').range(o,o+399)),
      includeFiles?all(o=>db.from('performance_task_files').select('id,task_id,event_id,name,created_at').in('task_id',keys).order('id').range(o,o+399)):[],
    ])
    logs.push(...history);files.push(...attachments)
  }
  const hist=group(logs,l=>l.TaskId), attachments=group(files,f=>f.task_id)
  return tasks.map(t=>{
    const logs=hist.get(t.Id)??[]
    const submits=logs.filter(l=>['assignment_submit','CompletionRequested'].includes(l.Action))
    const first=submits[0]?.CreatedAt??t.CompletionRequestedAt
    const edits=logs.filter(l=>['assignment_edit','assignment_extend_approve'].includes(l.Action))
    const deadlineChange=edits.filter(l=>stamp(l.CreatedAt)>stamp(first)).map(l=>{
      try{return JSON.parse(l.DetailsJson??'{}').before?.DueDate}catch{return null}
    }).find(Boolean)
    const firstDeadline=deadlineChange??t.DueDate
    const cancelled=t.AssignmentState==='cancelled'||t.Status===4
    const approved=t.AssignmentState==='approved'||t.IsCompletionApproved||(!t.AssignmentState&&t.Status===3)
    const late=!cancelled&&!!t.DueDate&&(first?stamp(first)>stamp(firstDeadline):!approved&&t.Status!==2&&Date.now()>stamp(t.DueDate))
    return {id:t.Id,title:t.Title,employee:t.AssignedToUserId,due:t.DueDate,created:t.CreatedAt,progress:t.Progress,state:t.AssignmentState??['new','active','review','approved','cancelled'][t.Status],
      first,firstDeadline,cancelled,approved,approvedAt:t.CompletionApprovedAt,late,
      returns:logs.filter(l=>['assignment_return','CompletionRejected'].includes(l.Action)).length,
      extensions:logs.filter(l=>l.Action==='assignment_extend_approve').length,
      feedback:includeFiles?logs.filter(l=>['assignment_return','CompletionRejected','assignment_submit'].includes(l.Action)).flatMap(l=>{
        try{const data=JSON.parse(l.DetailsJson??'{}');return data.note?[{action:l.Action,date:l.CreatedAt,note:data.note}]:[]}catch{return []}
      }):[],
      outputs:(attachments.get(t.Id)??[]).filter(f=>submits.some(l=>l.Id===f.event_id))}
  })
}
export function summarize(employees:Row[],reports:Row[],days:Row[],activities:Row[],tasks:Row[],from:string,to:string){
  const byEmployee=group(reports,r=>r.employee),byActivity=group(activities,a=>a.employee),byTask=group(tasks,t=>t.employee),byWork=group(days,d=>d.employee_id)
  return employees.map(employee=>{
    const reports=byEmployee.get(employee.id)??[], activity=byActivity.get(employee.id)??[], tasks=byTask.get(employee.id)??[]
    const submitted=reports.filter(r=>r.status!=='missing'), approved=submitted.filter(r=>r.status==='approved')
    const dates=new Set(submitted.map(r=>r.date))
    const work=(byWork.get(employee.id)??[]).filter(d=>d.required&&((employee.active&&stamp(d.deadline)<Date.now())||dates.has(d.work_date)))
    const workSubmitted=work.filter(d=>dates.has(d.work_date)).length
    const due=tasks.filter(t=>!t.cancelled&&inPeriod(t.due,from,to))
    const finished=tasks.filter(t=>t.approved&&inPeriod(t.approvedAt,from,to))
    const delivered=due.filter(t=>t.first&&inPeriod(t.first,from,to))
    const minutes=total(activity,'minutes')
    return {...employee,workDays:work.length,submitted:submitted.length,approved:approved.length,
      pending:submitted.filter(r=>r.status==='submitted').length,missing:reports.filter(r=>r.status==='missing').length,
      returned:submitted.filter(r=>r.status==='returned').length,activities:activity.length,minutes,
      approvedMinutes:total(activity.filter(a=>a.reportStatus==='approved'),'minutes'),draftMinutes:total(activity.filter(a=>a.reportStatus==='draft'),'minutes'),
      returnedMinutes:total(activity.filter(a=>a.reportStatus==='returned'),'minutes'),
      activeTasks:tasks.filter(t=>!t.cancelled&&!t.approved).length,allocated:tasks.length,finished:finished.length,
      taskReturns:tasks.filter(t=>t.state==='returned').length,late:tasks.filter(t=>t.late).length,
      extensions:total(tasks,'extensions'),deliveryReturns:total(tasks,'returns'),
      reportRate:pct(workSubmitted,work.length),approvalRate:pct(approved.length,submitted.filter(r=>r.status==='approved'||r.status==='returned'||r.returns.length).length),
      completionRate:pct(due.filter(t=>t.approved&&inPeriod(t.approvedAt,from,to)).length,due.length),
      onTimeRate:pct(delivered.filter(t=>stamp(t.first)<=stamp(t.firstDeadline)).length,delivered.length)}
  })
}
const translateStatus:Record<string,string>={approved:'تأییدشده',submitted:'در انتظار بررسی',returned:'نیازمند اصلاح',missing:'ارسال‌نشده'}
function xlsx(data:Row){
  const sections=[
    {name:'عملکرد فردی',rows:[['کارمند','سمت','واحد','روز کاری','گزارش ارسالی','گزارش تأیید','فعالیت','دقیقه','وظیفه تأیید','معوق','نرخ ارسال','نرخ تأیید','نرخ تکمیل','نرخ به‌موقع'],
      ...data.employees.map((e:Row)=>[e.name,e.position,e.department,e.workDays,e.submitted,e.approved,e.activities,e.minutes,e.finished,e.late,e.reportRate,e.approvalRate,e.completionRate,e.onTimeRate])]},
    {name:'روند فعالیت',rows:[['تاریخ شمسی','تعداد فعالیت','دقیقه','وظایف تأییدشده'],
      ...data.trends.map((t:Row)=>[jalaliDateString(t.date),t.activities,t.minutes,t.tasks])]},
    {name:'گزارش‌های روزانه',rows:[['کارمند','تاریخ شمسی','وضعیت','پروژه‌ای','غیرپروژه‌ای','دقیقه','دلایل برگشت'],
      ...data.reports.map((r:Row)=>[r.employeeName,jalaliDateString(r.date),translateStatus[r.status],r.projects,r.nonProjects,r.minutes,r.returns?.map((h:Row)=>h.note).filter(Boolean).join('، ')])]},
    {name:'وظایف و تأخیر',rows:[['وظیفه','موعد','اولین تحویل','تأخیر','تعداد برگشت','تعداد تمدید'],
      ...data.tasks.map((t:Row)=>[t.title,t.due?jalaliDateString(localDay(t.due)):'',t.first?jalaliDateString(localDay(t.first)):'',t.late?'بله':'خیر',t.returns,t.extensions])]},
    {name:'ترکیب فعالیت‌ها',rows:[['نوع','تعداد','دقیقه'],...data.kinds.map((k:Row)=>[k.label,k.count,k.minutes]),
      ['پروژه‌ای',data.projectMix.project,undefined],['غیرپروژه‌ای',data.projectMix.other,undefined]]},
  ]
  return workbook(sections)
}
export async function handlePerformanceInsights(request:Request,auth:AuthContext,path:string,url:URL):Promise<Response|null>{
  const prefix='/performance/insights'
  if(!path.startsWith(prefix+'/'))return null
  if(request.method!=='GET')throw new HttpError(405,'عملیات پشتیبانی نمی‌شود')
  const sub=path.slice(prefix.length),access=await scope(auth)
  if(!access.org&&!access.direct.size)throw new HttpError(403,'دسترسی مدیریت گزارش‌ها لازم است')
  const file=sub.match(/^\/task-files\/([^/]+)$/)
  if(file&&uuid(file[1])){
    const found=await db.from('performance_task_files').select('name,content_base64,created_at,Tasks!inner(TenantId,AssignedToUserId,IsDeleted)')
      .eq('id',file[1]).eq('Tasks.TenantId',auth.tenantId).eq('Tasks.IsDeleted',false).maybeSingle()
    check(found.error)
    const row=found.data as unknown as Row
    if(!row||!canDownload(access,row.Tasks.AssignedToUserId))throw new HttpError(404,'پیوست یافت نشد')
    const retention=(await policyAt(auth)).files.retentionDays
    if(retention>0&&stamp(row.created_at)<Date.now()-retention*ms)throw new HttpError(410,'مدت دسترسی آنلاین به پیوست به پایان رسیده است')
    return new Response(Uint8Array.from(atob(row.content_base64),c=>c.charCodeAt(0)),{headers:{...corsHeaders(request),
      'Content-Type':'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
      'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.name).replace(/'/g,'%27')}`}})
  }
  if(!['/queue','/team','/person','/export'].includes(sub))throw new HttpError(404,'گزارش یافت نشد')
  if(sub==='/export'&&!access.grants.has(codes.export))throw new HttpError(403,'مجوز خروجی اکسل لازم است')
  const {from,to}=range(url.searchParams.get('from'),url.searchParams.get('to'))
  const person=url.searchParams.get('employee')
  if(sub==='/person'&&!person)throw new HttpError(400,'کارمند انتخاب نشده است')
  const people=await persons(auth,access,person)
  const department=url.searchParams.get('department'),position=url.searchParams.get('position')
  const employees=people.filter(e=>(!department||department===e.department)&&(!position||position===e.position))
  const report=await reportData(auth,access,employees,from,to,sub!=='/queue')
  if(sub==='/queue')return json(request,{reports:report.reports,employees:people,today:today()})
  const allowedProject=url.searchParams.get('project')
  if(allowedProject&&allowedProject!=='none'&&!uuid(allowedProject))throw new HttpError(400,'پروژه معتبر نیست')
  const projects=Array.from(new Map(report.activities.filter(a=>a.projectId).map(a=>[a.projectId,{id:a.projectId,name:a.project||a.projectId}])).values())
  const activities=report.activities.filter(a=>!allowedProject||(allowedProject==='none'?!a.projectId:a.projectId===allowedProject))
  const tasks=await loadTasks(auth,employees.map(e=>e.id),from,to,sub==='/person')
  const stats=summarize(employees,report.reports,report.days,activities,tasks,from,to)
  const activityDays=group(activities,a=>a.date), taskDays=group(tasks.filter(t=>t.approved&&inPeriod(t.approvedAt,from,to)),t=>localDay(t.approvedAt))
  const trends=[]
  for(let cursor=stamp(from);cursor<=stamp(to);cursor+=ms){
    const date=day(new Date(cursor).toISOString()),slice=activityDays.get(date)??[]
    trends.push({date,activities:slice.length,minutes:total(slice,'minutes'),tasks:(taskDays.get(date)??[]).length})
  }
  const category=(await policyAt(auth,to)).categories
  const kinds=[...group(activities,a=>a.kind)].map(([id,rows])=>({id,label:category.find(c=>c.id===id)?.label??id,count:rows.length,minutes:total(rows,'minutes')}))
  const download=!!person&&canDownload(access,person)
  const output={employees:stats,reports:report.reports,projects,activities:sub==='/person'?activities.filter(a=>a.submitted):undefined,tasks:tasks.map(t=>({...t,outputs:download?t.outputs:[]})),
    trends,kinds,projectMix:{project:activities.filter(a=>!!a.projectId).length,other:activities.filter(a=>!a.projectId).length},
    canExport:access.grants.has(codes.export),canDownload:download}
  if(sub==='/export')return new Response(xlsx(output),{headers:{...corsHeaders(request),'Cache-Control':'private, no-store',
    'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="performance.xlsx"'}})
  return json(request,output)
}
