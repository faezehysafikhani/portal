import { adminClient, AuthContext } from '../_shared/auth.ts'
import { HttpError, body, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { jalaliDateString } from '../_shared/jalali.ts'
import { check, codes, date, policyAt, scope, text, today, uuid, type Scope } from './performance-policy.ts'
import { pickTemplate, type Period, type Template } from './performance-evaluation-config.ts'
import { periodPerformance } from './performance-insights.ts'
import { validatePerformanceFile } from './performance-daily.ts'
import { workbook } from './performance-workbook.ts'
import { organizationPeople } from './organization.ts'

type Row=Record<string,any>
const db=adminClient(),dayMs=86400000
const invalid=(message:string)=>{throw new HttpError(400,message)}
const noAccess=()=>{throw new HttpError(404,'ارزیابی یافت نشد')}
const object=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:invalid('بدنه درخواست معتبر نیست')
const key=(v:unknown):string=>typeof v==='string'&&/^[-a-z0-9_]{1,80}$/.test(v)?v:invalid('شناسه معتبر نیست')
const numeric=(v:unknown,max=100)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:invalid('امتیاز یا درصد باید بین صفر و ۱۰۰ باشد')
const score=(v:unknown)=>Math.round(numeric(v)*100)/100
const baseSelection='Id,UserId,ReviewerUserId,FinalScore,EvaluationPeriodKey,EvaluationState,EvaluationVersion,EvaluationData,EvaluationPublication,EvaluationPublishedAt,EvaluationSeenAt,EvaluationEmployeeNote,FinalizedAt,UpdatedAt,CreatedAt'
const directView=(access:Scope,id:string)=>access.direct.has(id)&&(access.grants.has(codes.evalView)||access.grants.has(codes.evalWrite))
const managerWrite=(access:Scope,id:string)=>access.direct.has(id)&&access.grants.has(codes.evalWrite)
function managerCanRead(access:Scope,r:Row) {
  const state=r.EvaluationState
  return directView(access,r.UserId)||(access.grants.has(codes.evalOrg)&&!!r.EvaluationPublication)||
    (state==='pending'&&access.grants.has(codes.evalApprove))||
    (state==='finalized'&&[codes.evalApprove,codes.evalPublish,codes.evalReopen].some(c=>access.grants.has(c)))||
    (!!r.EvaluationPublication&&[codes.evalPublish,codes.evalReopen].some(c=>access.grants.has(c)))
}
const hasQueue=(access:Scope)=>[codes.evalApprove,codes.evalPublish,codes.evalReopen,codes.evalAppeals,codes.evalOrg].some(c=>access.grants.has(c))
async function people(auth:AuthContext,ids?:string[]){
  if(ids&&!ids.length)return []
  const organization=await organizationPeople(auth)
  const activeManagers=new Set(organization.filter(p=>p.active).map(p=>p.id))
  return organization.filter(p=>!ids||ids.includes(p.id)).map(p=>({id:p.id,name:p.full_name,
    department:p.department??undefined,position:p.position??undefined,manager:p.manager_id&&activeManagers.has(p.manager_id)?p.manager_id:undefined,
    active:p.active})).sort((a,b)=>a.name.localeCompare(b.name,'fa'))
}
async function list(auth:AuthContext,params:{mine?:boolean;period?:string;employee?:string}){
  const output:Row[]=[]
  for(let page=0;;page+=400){
    let q=db.from('PerformanceEvaluations').select(baseSelection).eq('TenantId',auth.tenantId).eq('IsDeleted',false).not('EvaluationPeriodKey','is',null)
    if(params.mine)q=q.eq('UserId',auth.userId).not('EvaluationPublication','is',null)
    if(params.period)q=q.eq('EvaluationPeriodKey',params.period)
    if(params.employee)q=q.eq('UserId',params.employee)
    const result=await q.order('CreatedAt',{ascending:false}).order('Id').range(page,page+399)
    check(result.error)
    const rows=(result.data??[]) as Row[]
    output.push(...rows)
    if(rows.length<400)return output
  }
}
async function visibleDetails(auth:AuthContext,id:string,access:Scope,mode:'details'|'files'='details'){
  const res=await db.from('PerformanceEvaluations').select(baseSelection).eq('TenantId',auth.tenantId).eq('Id',id).eq('IsDeleted',false).not('EvaluationPeriodKey','is',null).maybeSingle()
  check(res.error)
  const row=res.data as Row|null
  if(!row)return noAccess()
  const own=row.UserId===auth.userId
  const appeals=await db.from('PerformanceAppeals').select('Id,Reason,Status,ReviewerResponse,ResolvedAt,PeriodicDecision,PeriodicIndicatorKey,PeriodicExplanation,CreatedAt')
    .eq('TenantId',auth.tenantId).eq('EvaluationId',id).eq('IsDeleted',false).not('PeriodicExplanation','is',null).order('CreatedAt',{ascending:false})
  check(appeals.error)
  const appealReviewer=!own&&access.grants.has(codes.evalAppeals)&&(appeals.data??[]).length>0
  const canResolve=appealReviewer&&(appeals.data??[]).some(a=>a.Status<2)
  const privileged=!own&&(directView(access,row.UserId)||(row.EvaluationState==='pending'&&access.grants.has(codes.evalApprove))||
    (row.EvaluationState==='finalized'&&[codes.evalApprove,codes.evalPublish,codes.evalReopen].some(c=>access.grants.has(c))))
  if(own?!row.EvaluationPublication:!managerCanRead(access,row)&&!appealReviewer)return noAccess()
  if(mode==='files'&&!own&&!directView(access,row.UserId)&&!access.grants.has(codes.evalEvidence))return noAccess()
  const snapshot=privileged?row.EvaluationData:row.EvaluationPublication
  if(!snapshot)return noAccess()
  return {row,own,privileged,snapshot,appeals:appeals.data??[],canResolve}
}
const notificationErrors:Record<string,[number,string]>={
  eval_access:[404,'ارزیابی یا عملیات مجاز یافت نشد'],eval_locked:[409,'این ارزیابی یا دوره در وضعیت قابل تغییر نیست'],
  eval_incomplete:[400,'امتیاز یا وضعیت همهٔ شاخص‌ها را تکمیل کنید'],eval_conflict:[409,'ارزیابی به‌روزرسانی شده؛ صفحه را تازه‌سازی کنید'],
  eval_reason:[400,'دلیل یا توضیح معتبر الزامی است'],eval_na:[400,'عدم شمول با سیاست، شاخص یا دلیل ثبت‌شده سازگار نیست'],
  eval_evidence:[400,'مستند لازم را بارگذاری کنید یا محدودیت فایل‌ها را بررسی کنید'],eval_weights:[400,'مجموع وزن شاخص‌ها باید ۱۰۰ باشد'],
  eval_deadline:[400,'مهلت این اقدام پایان یافته است'],eval_appeal_exists:[409,'درخواست بازبینی باز برای این ارزیابی وجود دارد'],
}
async function mutate(auth:AuthContext,id:string|null,action:string,data:Row){
  const result=await db.rpc('performance_periodic_mutate',{p_tenant:auth.tenantId,p_actor:auth.userId,p_id:id,p_action:action,p_data:data})
  if(result.error&&notificationErrors[result.error.message])throw new HttpError(...notificationErrors[result.error.message])
  check(result.error);return result.data
}
function fileMetadata(v:Row){
  return {id:v.id,name:v.name,size_bytes:v.size_bytes,indicator_key:v.indicator_key,appeal_id:v.appeal_id,plan_id:v.plan_id,created_at:v.created_at}
}
function templateVersion(template:Template) {
  const json=JSON.stringify(template)
  let hash=2166136261
  for(const char of json)hash=Math.imul(hash ^ char.charCodeAt(0),16777619)
  return template.id+'-'+(hash>>>0).toString(36)
}
function summary(r:Row,ownOrPublic:boolean,staff:Map<string,Row>){
  const data=ownOrPublic?r.EvaluationPublication:r.EvaluationData
  const final=ownOrPublic?data?.score:r.FinalScore
  const label=final==null?null:(data?.rules?.thresholds as Row[]|undefined)?.find(t=>final>=t.minimum)?.label
  return {id:r.Id,employee:r.UserId,name:staff.get(r.UserId)?.name,position:data?.employeeInfo?.position??staff.get(r.UserId)?.position,
    department:data?.employeeInfo?.department??staff.get(r.UserId)?.department,period:data?.period??r.EvaluationData?.period,
    template:data?.template?.label,templateKey:data?.template?templateVersion(data.template):null,
    state:ownOrPublic?(r.EvaluationState==='closed'?'closed':'published'):r.EvaluationState,score:final,band:label,
    published:r.EvaluationPublishedAt,updated:r.UpdatedAt??r.CreatedAt}
}
async function evidence(auth:AuthContext,raw:unknown,indicatorKeys?:Set<string>){
  if(raw==null)return []
  const policy=(await policyAt(auth)).files
  if(!Array.isArray(raw)||raw.length>policy.maxCount)return invalid('تعداد فایل‌ها بیش از سقف مجاز است')
  const files=raw.map(value=>{
    const input=object(value)
    const indicator=input.indicator?key(input.indicator):null
    if(indicator&&(!indicatorKeys||!indicatorKeys.has(indicator)))return invalid('شناسه شاخص مستند معتبر نیست')
    const f=validatePerformanceFile(input)
    if(f.bytes>policy.maxBytes||!policy.mimes.includes(f.mime))return invalid('حجم یا فرمت فایل مجاز نیست')
    return {...f,indicator}
  })
  if(files.reduce((n,f)=>n+f.bytes,0)>policy.totalBytes)return invalid('مجموع حجم مستندات بیش از سقف مجاز است')
  return files
}
function pickFeedback(raw:unknown){
  const feedback=object(raw??{})
  return Object.fromEntries(['strengths','improvements','achievements','barriers','training','suggestions','notes'].map(k=>[k,text(feedback[k],4000)]))
}
function validateEntries(template:Template,raw:unknown,metrics:Row,adjust:boolean){
  const scores=object(raw??{}),entries:Row={}
  for(const item of template.items){
    const row=object(scores[item.id]??{})
    const base=item.metric?metrics[item.metric]:null
    const note=text(row.note,3000),sample=text(row.sample,4000)
    if(row.na===true){entries[item.id]={na:true,note,sample,source:base??null};continue}
    const submitted=row.value==null?null:score(row.value)
    if(item.metric&&row.adjust===true){
      if(!adjust||!note||submitted==null)throw new HttpError(403,'تعدیل شاخص کمی به مجوز و دلیل نیاز دارد')
      entries[item.id]={value:submitted,source:base??null,note,sample,adjusted:true}
    }else if(item.metric){
      entries[item.id]={value:base==null?null:score(base),source:base??null,note,sample}
    }else entries[item.id]={value:submitted,note,sample}
  }
  return entries
}
function validatedPlan(raw:unknown,template:Template){
  const plan=object(raw),from=date(plan.from),to=date(plan.to)
  if(from>to)return invalid('مهلت برنامه پیش از شروع آن است')
  const indicator=plan.indicator?key(plan.indicator):null
  if(indicator&&!template.items.some(i=>i.id===indicator))return invalid('شاخص برنامه معتبر نیست')
  return {title:text(plan.title,200,true),description:text(plan.description,4000,true),outcome:text(plan.outcome,2500,true),
    criterion:text(plan.criterion,2500,true),responsible:text(plan.responsible,160,true),initial:text(plan.initial,2500),indicator,from,to}
}
const planFields='id,evaluation_id,created_by,plan,state,progress,employee_note,manager_note,updated_at,created_at'
async function plans(auth:AuthContext,ids:string[]){
  if(!ids.length)return []
  const result=await db.from('performance_improvement_actions').select(planFields).in('evaluation_id',ids).order('created_at',{ascending:false})
  check(result.error)
  return result.data??[]
}
async function detail(auth:AuthContext,id:string,access:Scope){
  const {row,own,privileged,snapshot,appeals,canResolve}=await visibleDetails(auth,id,access)
  const [files,history,peopleRows,goals,policy,priorRows]=await Promise.all([
    db.from('performance_evaluation_evidence').select('id,name,size_bytes,indicator_key,appeal_id,plan_id,created_at').eq('evaluation_id',id).order('created_at'),
    db.from('PerformanceAuditLogs').select('Id,ActorUserId,Action,DetailsJson,CreatedAt').eq('TenantId',auth.tenantId).eq('EvaluationId',id)
      .eq('IsDeleted',false).like('Action','Periodic:%').order('CreatedAt',{ascending:false}),
    people(auth,[row.UserId,row.ReviewerUserId].filter(uuid)),plans(auth,[id]),policyAt(auth),
    list(auth,{employee:row.UserId}),
  ])
  check(files.error);check(history.error)
  const peopleMap=new Map(peopleRows.map(p=>[p.id,p]))
  const state=row.EvaluationState
  const availableFiles=new Set((row.EvaluationPublication?.files??[]).map((f:Row)=>f.id))
  const canFile=own||directView(access,row.UserId)||access.grants.has(codes.evalEvidence)
  const canPlan=managerWrite(access,row.UserId)&&!own
  const fileList=(files.data??[]).filter(f=>privileged||!!f.appeal_id||!!f.plan_id||availableFiles.has(f.id))
  const currentPeriod=policy.periods.find(p=>p.id===row.EvaluationPeriodKey)
  const open=policy.evaluation.enabled&&currentPeriod?.status==='open'
  const allowedDays=(Number(snapshot.rules?.commentDays??7))
  const publishedDay=row.EvaluationPublishedAt?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',dateStyle:'short'}).format(new Date(row.EvaluationPublishedAt)):today()
  const commentDue=currentPeriod?.employeeDue??new Date(Date.parse(publishedDay)+allowedDays*dayMs).toISOString().slice(0,10)
  const elapsedDays=Math.floor((Date.parse(today())-Date.parse(publishedDay))/dayMs)
  let appealOpen=!!open&&state==='published'&&snapshot.rules?.allowAppeal!==false&&elapsedDays<=92
  if(appealOpen&&elapsedDays>1){
    const dateAt=(days:number)=>new Date(Date.parse(publishedDay)+days*dayMs).toISOString().slice(0,10)
    const days=await db.rpc('performance_reporting_days',{p_tenant:auth.tenantId,p_people:[row.UserId],p_from:dateAt(1),p_to:dateAt(elapsedDays-1)})
    check(days.error)
    appealOpen=(days.data??[]).filter((day:Row)=>day.exemption===null).length<Number(snapshot.rules?.appealDays??5)
  }
  const priorPlans=await plans(auth,priorRows.filter(r=>r.Id!==id&&r.EvaluationPublication&&r.EvaluationData?.period?.to<snapshot.period.from).map(r=>r.Id))
  const entries=(history.data??[]).flatMap(h=>{
    const action=h.Action.replace('Periodic:','')
    // Employee-facing history contains publication/appeal/employee actions only.
    const publicEvent=['publish','comment','appeal','resolve','close'].includes(action)
    if(!privileged&&!publicEvent)return []
    const payload=JSON.parse(h.DetailsJson??'{}')
    return [{id:h.Id,action,actor:peopleMap.get(h.ActorUserId)?.name,date:h.CreatedAt,
      details:privileged?payload:action==='publish'?{previousScore:payload.publication?.score,score:payload.score}:payload}]
  })
  return {...summary(row,!privileged,peopleMap),data:snapshot,seen:row.EvaluationSeenAt,reviewer:peopleMap.get(row.ReviewerUserId)?.name,
    version:row.EvaluationVersion,employeeNote:row.EvaluationEmployeeNote,appeals,history:entries,plans:goals,priorPlans,
    files:canFile?fileList.map(fileMetadata):[],own,canAdjust:access.grants.has(codes.evalAdjust),
    actions:{
      write:!!open&&canPlan&&['draft','revision'].includes(state),approve:!!open&&!own&&state==='pending'&&access.grants.has(codes.evalApprove),
      publish:!!open&&!own&&state==='finalized'&&access.grants.has(codes.evalPublish),
      reopen:!!open&&!own&&['finalized','published','closed'].includes(state)&&access.grants.has(codes.evalReopen),
      close:!!open&&!own&&state==='published'&&today()>commentDue&&!appealOpen&&!appeals.some(a=>a.Status<2)&&access.grants.has(codes.evalPublish),
      comment:!!open&&own&&state==='published'&&today()<=commentDue,appeal:own&&appealOpen&&!appeals.some(a=>a.Status<2),
      resolve:!!open&&canResolve&&state==='published',plan:canPlan,planProgress:own&&!!row.EvaluationPublication,
    }}
}
async function download(request:Request,auth:AuthContext,id:string,fileId:string,access:Scope){
  const {row,privileged}=await visibleDetails(auth,id,access,'files')
  const res=await db.from('performance_evaluation_evidence').select('id,name,content_base64,created_at,appeal_id,plan_id').eq('evaluation_id',id).eq('id',fileId).maybeSingle()
  check(res.error)
  const file=res.data
  if(!file||(!privileged&&!file.appeal_id&&!file.plan_id&&!(row.EvaluationPublication?.files??[]).some((f:Row)=>f.id===file.id)))return noAccess()
  const retention=(await policyAt(auth)).files.retentionDays
  if(retention>0&&Date.parse(file.created_at)<Date.now()-retention*dayMs)throw new HttpError(410,'مدت دسترسی آنلاین به فایل گذشته است')
  return new Response(Uint8Array.from(atob(file.content_base64),c=>c.charCodeAt(0)),{headers:{...corsHeaders(request),'Cache-Control':'no-store',
    'Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff',
    'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g,'%27')}`}})
}
async function exportData(auth:AuthContext,url:URL,access:Scope){
  if(!access.grants.has(codes.evalOrg))throw new HttpError(403,'مجوز گزارش سازمانی لازم است')
  const periodId=url.searchParams.get('period')??undefined,dept=url.searchParams.get('department'),template=url.searchParams.get('template')
  const personId=url.searchParams.get('employee')
  if(personId&&!uuid(personId))return invalid('شناسه کارمند معتبر نیست')
  const cfg=await policyAt(auth)
  const [staff,rows,tenant]=await Promise.all([people(auth),list(auth,{period:periodId?key(periodId):undefined}),
    db.from('Tenants').select('Name').eq('Id',auth.tenantId).single()])
  check(tenant.error)
  const matched=staff.filter(p=>(!dept||dept===p.department)&&(!personId||p.id===personId))
  const employeeMap=new Map(matched.map(p=>[p.id,p]))
  const filtered=rows.filter(r=>r.EvaluationPublication&&employeeMap.has(r.UserId)&&(!template||r.EvaluationPublication.template?.label===template))
  const reports=filtered.map(r=>({ ...summary(r,true,employeeMap),data:r.EvaluationPublication }))
  const actions=await plans(auth,filtered.map(r=>r.Id))
  const chosen=cfg.periods.find(p=>p.id===periodId)
  const eligible=chosen?matched.filter(p=>{
    if(!p.active||!p.manager)return false
    if(!template)return true
    try{return pickTemplate(cfg.evaluation,p,chosen).label===template}catch(e){if(e instanceof HttpError)return false;throw e}
  }):[]
  const expected=chosen?eligible.length:null
  const completed=new Set(filtered.map(r=>r.UserId))
  const outstanding=chosen?eligible.filter(p=>!completed.has(p.id)).length:null
  return {company:tenant.data?.Name??'پرتال سازمانی',generatedAt:new Date().toISOString(),
    filters:{period:chosen?.label??'همه دوره‌ها',department:dept||'همه واحدها',template:template||'همه الگوها',employee:personId?employeeMap.get(personId)?.name??'—':'همه کارکنان'},
    periods:cfg.periods,employees:staff,templates:[...new Set(rows.filter(r=>r.EvaluationPublication).map(r=>r.EvaluationPublication.template?.label).filter(Boolean))],
    reports,expected,outstanding,activePlans:actions.filter(p=>!['achieved','cancelled'].includes(p.state)).length,canExport:access.grants.has(codes.export)}
}
function exportWorkbook(data:Awaited<ReturnType<typeof exportData>>){
  return workbook([
    {name:'مشخصات گزارش',rows:[['سازمان',data.company],['دوره',data.filters.period],['واحد',data.filters.department],['الگو',data.filters.template],
      ['کارمند',data.filters.employee],['تاریخ تولید',jalaliDateString(data.generatedAt)],['برنامه‌های بهبود فعال',data.activePlans]]},
    {name:'نتایج منتشرشده',rows:[['کارمند','سمت','واحد','دوره','الگو','امتیاز از ۱۰۰','سطح','نقاط قوت','پیشنهاد بهبود'],
      ...data.reports.map(r=>[r.name,r.position,r.department,r.period?.label,r.template,r.score,r.band,r.data.feedback?.strengths,r.data.feedback?.suggestions])]},
    {name:'شاخص‌ها',rows:[['کارمند','دوره','شاخص','وزن','امتیاز','توضیح مدیر'],
      ...data.reports.flatMap(r=>(r.data.template.items as Row[]).map(i=>{
        const s=r.data.scores?.[i.id]
        return [r.name,r.period?.label,i.label,i.weight,s?.na?'غیرقابل‌اعمال':s?.value??'فاقد داده',s?.note]
      }))]},
    {name:'فعالیت و تعهدات',rows:[['کارمند','دوره','گزارش ارسالی','گزارش تأیید','فعالیت پروژه‌ای','فعالیت غیرپروژه‌ای','دقیقه','وظیفه محول','تکمیل','معوق','تحویل به‌موقع'],
      ...data.reports.map(r=>{const s=r.data.metrics;return [r.name,r.period?.label,s.submitted,s.approved,s.projectCount,s.nonProjectCount,s.minutes,s.allocated,s.finished,s.late,s.onTimeRate]})]},
  ])
}
export async function handlePeriodicEvaluations(request:Request,auth:AuthContext,path:string,url:URL):Promise<Response|null> {
  const prefix='/performance/periodic'
  if(path!==prefix&&!path.startsWith(prefix+'/'))return null
  const sub=path.slice(prefix.length),method=request.method,access=await scope(auth)
  if(sub==='/mine'&&method==='GET'){
    const rows=await list(auth,{mine:true})
    return json(request,{results:rows.map(r=>summary(r,true,new Map())),plans:await plans(auth,rows.map(r=>r.Id))})
  }
  if((sub==='/organization'||sub==='/export')&&method==='GET'){
    const scopes=await exportData(auth,url,access)
    if(sub==='/organization')return json(request,scopes)
    if(!scopes.canExport)throw new HttpError(403,'مجوز خروجی لازم است')
    return new Response(exportWorkbook(scopes),{headers:{...corsHeaders(request),'Cache-Control':'private, no-store',
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="performance-period.xlsx"'}})
  }
  if(sub==='/employees'&&method==='GET'){
    if(![codes.evalTemplates,codes.evalSettings].some(c=>access.grants.has(c)))throw new HttpError(403,'مجوز تخصیص الگو لازم است')
    return json(request,await people(auth))
  }
  if(sub===''&&method==='GET'){
    if(!hasQueue(access)&&![...access.direct].some(id=>directView(access,id)))throw new HttpError(403,'مجوز مشاهده ارزیابی لازم است')
    const policy=await policyAt(auth),requested=url.searchParams.get('period'),employee=url.searchParams.get('employee')
    if(employee&&(!uuid(employee)||(!directView(access,employee)&&!hasQueue(access))))return noAccess()
    const [rows,staff,appeals]=await Promise.all([list(auth,{period:requested?key(requested):undefined,employee:employee??undefined}),
      people(auth),
      access.grants.has(codes.evalAppeals)?db.from('PerformanceAppeals').select('EvaluationId').eq('TenantId',auth.tenantId).eq('IsDeleted',false)
        .lt('Status',2).not('PeriodicExplanation','is',null):Promise.resolve({data:[],error:null}),
    ])
    check(appeals.error)
    const pending=new Set((appeals.data??[]).map(a=>a.EvaluationId)),staffMap=new Map(staff.map(u=>[u.id,u]))
    const team=staff.filter(u=>directView(access,u.id))
    const current=policy.periods.filter(p=>p.status==='open'&&p.from<=today()).sort((a,b)=>b.to.localeCompare(a.to))[0]
    let overview=null
    if(url.searchParams.has('overview')&&current){
      const teamRows=rows.filter(r=>r.EvaluationPeriodKey===current.id&&directView(access,r.UserId))
      const finished=teamRows.filter(r=>['finalized','published','closed'].includes(r.EvaluationState))
      const active=(await plans(auth,teamRows.map(r=>r.Id))).filter(p=>!['achieved','cancelled'].includes(p.state))
      const groups=new Map<string,{name:string;count:number;sum:number}>()
      for(const row of finished){
        const template=row.EvaluationData.template as Template,key=templateVersion(template)
        const group=groups.get(key)??{name:template.label,count:0,sum:0}
        group.count++;group.sum+=Number(row.FinalScore);groups.set(key,group)
      }
      overview={period:current.label,completed:finished.length,outstanding:team.length-finished.length,activePlans:active.length,
        groups:[...groups].map(([id,group])=>({id,name:group.name,count:group.count,average:group.sum/group.count}))}
    }
    return json(request,{periods:policy.periods,defaultKind:policy.evaluation.defaultKind,enabled:policy.evaluation.enabled,
      staff:team.map(u=>({...u,canWrite:managerWrite(access,u.id)})),overview,
      rows:rows.filter(r=>r.UserId!==auth.userId&&(managerCanRead(access,r)||pending.has(r.Id))).map(r=>{
        const privileged=directView(access,r.UserId)||(r.EvaluationState==='pending'&&access.grants.has(codes.evalApprove))||
          (r.EvaluationState==='finalized'&&[codes.evalApprove,codes.evalPublish,codes.evalReopen].some(c=>access.grants.has(c)))
        return {...summary(r,!privileged,staffMap),state:r.EvaluationState,pendingAppeal:pending.has(r.Id)}
      })})
  }
  if(sub===''&&method==='POST'){
    const input=object(await body(request))
    if(!uuid(input.employee)||input.employee===auth.userId||!managerWrite(access,input.employee))return noAccess()
    const cfg=await policyAt(auth),period=cfg.periods.find(p=>p.id===input.period&&p.status==='open')
    if(!period||!cfg.evaluation.enabled)return invalid('دوره فعال معتبر نیست')
    const employee=(await people(auth,[input.employee]))[0]
    if(!employee)return noAccess()
    const template=pickTemplate(cfg.evaluation,employee,period)
    const metrics=await periodPerformance(auth,access,employee.id,period.from,period.to)
    const {templates,assignments,...rules}=cfg.evaluation
    const scores=validateEntries(template,{},metrics,false)
    return json(request,{id:await mutate(auth,null,'create',{employee:employee.id,employeeInfo:employee,period,template,rules,metrics,scores,feedback:{}})},201)
  }
  const attachment=sub.match(/^\/([^/]+)\/files\/([^/]+)$/)
  if(attachment&&uuid(attachment[1])&&uuid(attachment[2])&&method==='GET')return download(request,auth,attachment[1],attachment[2],access)
  const id=sub.slice(1)
  if(!uuid(id))return noAccess()
  if(method==='GET')return json(request,await detail(auth,id,access))
  if(method!=='PATCH')throw new HttpError(405,'عملیات پشتیبانی نمی‌شود')
  const input=object(await body(request)),action=String(input.action??'')
  const {row,own,snapshot}=await visibleDetails(auth,id,access)
  const note=text(input.note,4000)
  let data:Row={note}
  if(['save','send'].includes(action)){
    if(own||!managerWrite(access,row.UserId))return noAccess()
    const template=snapshot.template as Template,period=snapshot.period as Period
    const metrics=action==='send'?await periodPerformance(auth,access,row.UserId,period.from,period.to):snapshot.metrics
    if(typeof input.version!=='number'||!Number.isInteger(input.version)||input.version<0)return invalid('نسخه ارزیابی معتبر نیست')
    data={version:input.version,scores:validateEntries(template,input.scores,metrics,access.grants.has(codes.evalAdjust)),
      feedback:pickFeedback(input.feedback),metrics,files:await evidence(auth,input.files,new Set(template.items.map(i=>i.id)))}
  }else if(action==='appeal'){
    data={note:text(input.note,4000,true),explanation:text(input.explanation,4000,true),indicator:input.indicator?key(input.indicator):null,files:await evidence(auth,input.files)}
  }else if(action==='resolve'){
    if(!uuid(input.appealId)||!['accepted','rejected'].includes(input.decision))return invalid('تصمیم بازبینی معتبر نیست')
    data={note,appealId:input.appealId,decision:input.decision}
  }else if(action==='plan'){
    if(own||!managerWrite(access,row.UserId))return noAccess()
    data={plan:validatedPlan(input.plan,snapshot.template),files:await evidence(auth,input.files)}
  }else if(action==='plan_progress'||action==='plan_review'){
    if(!uuid(input.planId))return invalid('شناسه برنامه معتبر نیست')
    const options=action==='plan_progress'?['active','review']:['achieved','followup','cancelled']
    if(!options.includes(input.state))return invalid('وضعیت برنامه معتبر نیست')
    data={note,planId:input.planId,state:input.state,progress:Math.round(numeric(input.progress??0)),files:await evidence(auth,input.files)}
  }else if(!['seen','comment','approve','return','publish','reopen','close'].includes(action))return invalid('عملیات ارزیابی معتبر نیست')
  return json(request,{id:await mutate(auth,id,action,data)})
}
