import { adminClient, AuthContext } from '../_shared/auth.ts'
import { HttpError, body, json } from '../_shared/http.ts'
import { evaluationGrants, readEvaluationRules, validateEvaluationRules, validatePeriodExtras, type Period } from './performance-evaluation-config.ts'

type Row = Record<string, any>
const db = adminClient()
export const codes = {
  organization:'performance.reports.organization', approve:'performance.reports.approve', download:'performance.reports.download',
  settings:'performance.settings.manage', export:'performance.analytics.export', access:'performance.access.manage',
  ...evaluationGrants,
} as const
const allowedCodes: string[] = Object.values(codes)
const dayMs=86400000
export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',dateStyle:'short'}).format(new Date())
export const uuid = (v:unknown):v is string => typeof v==='string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)
export const check = (error:{message:string}|null) => {if(error){console.error(error.message);throw new HttpError(500,'عملیات عملکرد انجام نشد')}}
export const name = (u:Row) => `${u.FirstName??''} ${u.LastName??''}`.trim() || u.Username
export const localDay = (v:string) => v.slice(0,10)===v?v:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',dateStyle:'short'}).format(new Date(v))
export function date(v:unknown):string {
  if(typeof v!=='string'||!/^\d{4}-\d\d-\d\d$/.test(v)||v<'1900-01-01'||v>'2200-01-01'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)
    throw new HttpError(400,'تاریخ معتبر نیست')
  return v
}
export function text(v:unknown,max:number,required=false):string {
  if(v!=null&&typeof v!=='string')throw new HttpError(400,'متن معتبر نیست')
  const value=String(v??'').trim()
  if(value.length>max||(required&&!value))throw new HttpError(400,'فیلدهای اجباری یا طول متن را بررسی کنید')
  return value
}
const number=(v:unknown,min:number,max:number)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new HttpError(400,'مقدار عددی خارج از بازه است')
  return v
}
const integer=(v:unknown,min:number,max:number)=>{
  const n=number(v,min,max); if(!Number.isInteger(n))throw new HttpError(400,'عدد باید صحیح باشد')
  return n
}
const object=(v:unknown):Row=>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw new HttpError(400,'محتوای تنظیمات معتبر نیست')
  return v as Row
}
const values=(v:unknown,max:number)=>{
  if(!Array.isArray(v)||v.length>max)throw new HttpError(400,'تعداد گزینه‌های تنظیمات معتبر نیست')
  return v
}
const clock=(v:unknown)=>{
  if(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw new HttpError(400,'ساعت معتبر نیست')
  return v
}
export const defaults = {
  enabled:true, required:true, deadline:'23:59', lateDays:0, allowRevision:false, allowPast:true,pastDays:0,
  requireDescription:true, requireTime:true, allowManual:true, requireOutcome:false, allowEmpty:true,dailyReminders:true,
  workingDays:[0,1,2,3,4,6],useOfficialHolidays:true,organizationHolidays:[] as string[],officialHolidays:[] as string[],
  exceptions:{} as Record<string,'off'|'work'>,workStart:'08:00',workEnd:'17:00',partialLeaveExempts:false,
  categories:[['project','فعالیت مرتبط با پروژه'],['internal','فعالیت اداری'],['finance','فعالیت مالی'],['technical','فعالیت فنی'],
    ['meeting','جلسه و هماهنگی'],['documentation','مستندسازی'],['control','بررسی و کنترل'],['support','پشتیبانی داخلی'],['recurring','فعالیت تکرارشونده'],['other','سایر فعالیت‌ها']]
    .map(([id,label])=>({id,label,active:true})),
  indicators:[] as {id:string;label:string;description:string;kind:string;unit:string;method:string;audienceKind:string;audience:string;weight:number;active:boolean;from:string}[],
  periods:[] as (Period&{finalizedAt?:string})[],
  evaluation:readEvaluationRules(undefined),
  files:{maxBytes:1048576,maxCount:5,totalBytes:5242880,mimes:['application/pdf','image/png','image/jpeg','text/plain'],retentionDays:0},
}
export type Policy=typeof defaults
export async function policyAt(auth:AuthContext,day=today()):Promise<Policy> {
  const result=await db.rpc('performance_policy_at',{p_tenant:auth.tenantId,p_day:day});check(result.error)
  const data=(result.data??{}) as Partial<Policy>
  return {...defaults,...data,files:{...defaults.files,...data.files},evaluation:readEvaluationRules(data.evaluation)}
}
export async function grantsFor(auth:AuthContext,employee=auth.userId):Promise<Set<string>> {
  const [permissions,links]=await Promise.all([
    db.from('Permissions').select('Id,Code').eq('TenantId',auth.tenantId).eq('IsDeleted',false).in('Code',allowedCodes),
    db.from('UserPermissions').select('PermissionId').eq('TenantId',auth.tenantId).eq('UserId',employee).eq('IsDeleted',false),
  ])
  check(permissions.error);check(links.error)
  const ids=new Set((links.data??[]).map(link=>link.PermissionId))
  return new Set((permissions.data??[]).filter(p=>ids.has(p.Id)).map(p=>p.Code))
}
export async function directIds(auth:AuthContext) {
  const result=await db.rpc('performance_direct_reports',{p_tenant:auth.tenantId,p_actor:auth.userId});check(result.error)
  return (result.data??[]).map((p:Row)=>String(p.id)) as string[]
}
export async function scope(auth:AuthContext) {
  const [direct,grants]=await Promise.all([directIds(auth),grantsFor(auth)])
  return {direct:new Set(direct),grants,org:grants.has(codes.organization)}
}
export type Scope=Awaited<ReturnType<typeof scope>>
export const canReview=(access:Scope, employee:string)=>access.direct.has(employee)||(access.org&&access.grants.has(codes.approve))
export const canDownload=(access:Scope, employee:string)=>access.direct.has(employee)||(access.org&&access.grants.has(codes.download))
export function range(from:unknown,to:unknown){
  const first=date(from),last=date(to),length=(Date.parse(last)-Date.parse(first))/dayMs
  if(length<0||length>365)throw new HttpError(400,'بازهٔ گزارش باید معتبر و حداکثر ۳۶۶ روز باشد')
  return {from:first,to:last}
}
export async function reportingDays(auth:AuthContext,ids:string[],from:string,to:string) {
  const rows:Row[]=[]
  // Each RPC covers at most 930 employee-days to avoid truncation by PostgREST.
  const start=Date.parse(from),end=Date.parse(to)
  for(let cursor=start;cursor<=end;cursor+=93*dayMs){
    const p_from=new Date(cursor).toISOString().slice(0,10)
    const p_to=new Date(Math.min(end,cursor+92*dayMs)).toISOString().slice(0,10)
    for(let i=0;i<ids.length;i+=10){
      const batch=await db.rpc('performance_reporting_days',{p_tenant:auth.tenantId,p_people:ids.slice(i,i+10),p_from,p_to})
      check(batch.error);rows.push(...(batch.data??[]))
    }
  }
  return rows
}
function entityId(v:unknown){
  if(typeof v!=='string'||!/^[-_a-z0-9]{1,50}$/.test(v))throw new HttpError(400,'شناسه تنظیمات معتبر نیست')
  return v
}
function validatePolicy(input:Row):Policy {
  const output={...defaults}
  for(const key of ['enabled','required','allowRevision','allowPast','requireDescription','requireTime','allowManual','requireOutcome','allowEmpty','useOfficialHolidays','partialLeaveExempts'] as const){
    if(typeof input[key]!=='boolean')throw new HttpError(400,'گزینه‌های روشن و خاموش معتبر نیستند')
    output[key]=input[key]
  }
  if(input.dailyReminders!==undefined&&typeof input.dailyReminders!=='boolean')throw new HttpError(400,'تنظیم یادآوری گزارش روزانه معتبر نیست')
  output.dailyReminders=input.dailyReminders??defaults.dailyReminders
  output.deadline=clock(input.deadline);output.workStart=clock(input.workStart);output.workEnd=clock(input.workEnd)
  if(output.workStart>=output.workEnd)throw new HttpError(400,'ساعت پایان کار باید بعد از شروع باشد')
  output.lateDays=integer(input.lateDays,0,365);output.pastDays=integer(input.pastDays,0,365)
  output.workingDays=[...new Set(values(input.workingDays,7).map(v=>integer(v,0,6)))]
  output.organizationHolidays=[...new Set(values(input.organizationHolidays,365).map(date))]
  output.officialHolidays=[...new Set(values(input.officialHolidays,365).map(date))]
  const exceptions=Object.entries(object(input.exceptions))
  if(exceptions.length>365)throw new HttpError(400,'تعداد استثناهای تقویم بیش از حد مجاز است')
  output.exceptions=Object.fromEntries(exceptions.map(([key,v])=>{
    if(v!=='off'&&v!=='work')throw new HttpError(400,'استثنای تقویم معتبر نیست')
    return [date(key),v]
  }))
  output.categories=values(input.categories,100).map(raw=>{
    const v=object(raw);return {id:entityId(v.id),label:text(v.label,150,true),active:v.active===true}
  })
  if(!output.categories.some(c=>c.active))throw new HttpError(400,'حداقل یک دسته فعالیت باید فعال بماند')
  output.indicators=values(input.indicators,100).map(raw=>{
    const v=object(raw)
    if(!['quantitative','qualitative'].includes(v.kind)||!['position','department','group'].includes(v.audienceKind))throw new HttpError(400,'نوع شاخص یا گروه مرتبط معتبر نیست')
    return {id:entityId(v.id),label:text(v.label,150,true),description:text(v.description,2000),kind:v.kind,unit:text(v.unit,100),
      method:text(v.method,2000,true),audienceKind:v.audienceKind,audience:text(v.audience,150,true),weight:number(v.weight,0,100),active:v.active===true,from:date(v.from)}
  })
  output.periods=values(input.periods,100).map(raw=>{
    const v=object(raw), from=date(v.from),to=date(v.to)
    if(from>to||!['month','quarter','half','year','custom'].includes(v.kind)||!['draft','open','closed'].includes(v.status))
      throw new HttpError(400,'بازه یا وضعیت دوره معتبر نیست')
    return {id:entityId(v.id),label:text(v.label,150,true),kind:v.kind,from,to,status:v.status,finalization:text(v.finalization,2000,true),
      ...validatePeriodExtras(v,from,to)}
  })
  for(const entries of [output.categories,output.indicators,output.periods])if(new Set(entries.map(v=>v.id)).size!==entries.length)
    throw new HttpError(400,'شناسه تکراری در تنظیمات وجود دارد')
  const f=object(input.files)
  output.files={maxBytes:integer(f.maxBytes,1024,1048576),maxCount:integer(f.maxCount,0,5),
    totalBytes:integer(f.totalBytes,1024,5242880),retentionDays:integer(f.retentionDays,0,3650),
    mimes:[...new Set(values(f.mimes,4).map(v=>{
      if(!defaults.files.mimes.includes(v))throw new HttpError(400,'فرمت فایل پشتیبانی نمی‌شود')
      return String(v)
    }))]}
  if(output.files.maxCount&&(output.files.totalBytes<output.files.maxBytes||!output.files.mimes.length))
    throw new HttpError(400,'فرمت مجاز و سقف مجموع فایل‌ها را بررسی کنید')
  return output
}
export async function handlePerformancePolicy(request:Request,auth:AuthContext,path:string,url:URL):Promise<Response|null>{
  const prefix='/performance/config'
  if(path!==prefix&&!path.startsWith(prefix+'/'))return null
  const sub=path.slice(prefix.length)
  const access=await scope(auth)
  if(sub==='/access'&&request.method==='GET')return json(request,{review:access.org||access.direct.size>0,
    settings:[codes.settings,codes.access,codes.evalSettings,codes.evalTemplates,codes.evalIndicators].some(code=>access.grants.has(code)),
    configure:access.grants.has(codes.settings),grants:access.grants.has(codes.access),export:access.grants.has(codes.export),
    periodic:!!access.direct.size&&(access.grants.has(codes.evalView)||access.grants.has(codes.evalWrite))
      ||[codes.evalOrg,codes.evalApprove,codes.evalPublish,codes.evalReopen,codes.evalAppeals].some(code=>access.grants.has(code)),
    organization:access.grants.has(codes.evalOrg),periodPolicy:access.grants.has(codes.evalSettings),
    templates:access.grants.has(codes.evalTemplates),indicators:access.grants.has(codes.evalIndicators)})
  if(sub==='/grants'&&access.grants.has(codes.access)){
    if(request.method==='GET'){
      const id=url.searchParams.get('user')
      if(id!==null){
        if(!uuid(id))throw new HttpError(400,'شناسه کاربر معتبر نیست')
        return json(request,{codes:[...await grantsFor(auth,id)]})
      }
      const users=await db.from('Users').select('Id,FirstName,LastName,Username').eq('TenantId',auth.tenantId).eq('IsDeleted',false).neq('Id',auth.userId).order('FirstName')
      check(users.error);return json(request,{users:(users.data??[]).map(u=>({id:u.Id,name:name(u)})),codes:allowedCodes})
    }
    if(request.method==='PUT'){
      const input=object(await body(request))
      if(!uuid(input.user)||input.user===auth.userId||!Array.isArray(input.codes)||!input.codes.every((code:unknown)=>typeof code==='string'&&allowedCodes.includes(code)))
        throw new HttpError(400,'کاربر یا مجوزهای انتخاب‌شده معتبر نیست')
      const result=await db.rpc('performance_set_grants',{p_tenant:auth.tenantId,p_actor:auth.userId,p_user:input.user,p_codes:[...new Set(input.codes)]})
      if(result.error?.message==='performance_grant_invalid')throw new HttpError(400,'کاربر یا مجوزهای انتخاب‌شده معتبر نیست')
      check(result.error);return json(request,{saved:true})
    }
  }
  if(sub!==''||![codes.settings,codes.evalSettings,codes.evalTemplates,codes.evalIndicators].some(code=>access.grants.has(code)))
    throw new HttpError(403,'مجوز مدیریت تنظیمات لازم است')
  if(request.method==='GET'){
    const requested=url.searchParams.get('date')
    const version=url.searchParams.get('version')
    if(version){
      if(!uuid(version))throw new HttpError(400,'شناسه نسخه معتبر نیست')
      const found=await db.from('performance_policy_versions').select('policy,effective_date').eq('tenant_id',auth.tenantId).eq('id',version).maybeSingle()
      check(found.error)
      if(!found.data)throw new HttpError(404,'نسخه تنظیمات یافت نشد')
      return json(request,{policy:{...defaults,...found.data.policy,evaluation:readEvaluationRules(found.data.policy.evaluation)},effectiveDate:found.data.effective_date,today:today()})
    }
    const versions=await db.from('performance_policy_versions').select('id,effective_date,created_at,created_by,Users(FirstName,LastName,Username)').eq('tenant_id',auth.tenantId).order('created_at',{ascending:false}).limit(100)
    check(versions.error)
    return json(request,{policy:await policyAt(auth,requested?date(requested):today()),
      versions:(versions.data??[]).map(row=>({...row,author:row.Users?name(row.Users as unknown as Row):null})),today:today()})
  }
  if(request.method==='POST'){
    const input=object(await body(request)),when=date(input.effectiveDate)
    if(when<today())throw new HttpError(400,'تاریخ اجرا باید امروز یا بعد از آن باشد')
    const previous=await policyAt(auth,when)
    const raw=object(input.policy),policy=validatePolicy(raw)
    if(raw.dailyReminders===undefined)policy.dailyReminders=previous.dailyReminders
    policy.evaluation=raw.evaluation===undefined?previous.evaluation:validateEvaluationRules(raw.evaluation)
    const normalized=(v:unknown):string=>JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?
      Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)
    const same=(a:unknown,b:unknown)=>normalized(a)===normalized(b)
    const requireChange=(permission:string,a:unknown,b:unknown)=>{
      if(!same(a,b)&&!access.grants.has(permission))throw new HttpError(403,'مجوز تغییر این قسمت از تنظیمات را ندارید')
    }
    const daily=(p:Policy)=>{const {evaluation,indicators,periods,...rest}=p;return rest}
    const rules=(p:Policy)=>{const {templates,assignments,...rest}=p.evaluation;return rest}
    const basePeriods=(p:Policy)=>p.periods.map(({finalizedAt,...period})=>({...period,templates:period.templates??[],changeReason:period.changeReason??''}))
    requireChange(codes.settings,daily(policy),daily(previous))
    requireChange(codes.evalIndicators,policy.indicators,previous.indicators)
    requireChange(codes.evalTemplates,[policy.evaluation.templates,policy.evaluation.assignments],[previous.evaluation.templates,previous.evaluation.assignments])
    requireChange(codes.evalSettings,[rules(policy),basePeriods(policy)],[rules(previous),basePeriods(previous)])
    // Preserve period identity and keep a separately authorized, reasoned reopen.
    for(const old of previous.periods){
      const current=policy.periods.find(p=>p.id===old.id)
      if(!current&&old.status!=='draft')throw new HttpError(409,'دوره‌ای که فعال یا بسته شده قابل حذف نیست')
      if(!current)continue
      if(old.status!=='draft'&&(old.from!==current.from||old.to!==current.to||old.kind!==current.kind))
        throw new HttpError(409,'بازه و نوع دوره پس از فعال‌شدن ثابت است')
      if(old.status==='closed'&&current.status!=='closed'&&(!access.grants.has(codes.evalReopen)||!current.changeReason||current.changeReason===old.changeReason))
        throw new HttpError(403,'بازگشایی دوره به مجوز و دلیل جدید نیاز دارد')
      if(old.status!=='draft'&&current.status==='draft')throw new HttpError(409,'این دوره به پیش‌نویس بازنمی‌گردد')
      if(old.status==='open'&&current.status==='closed'){
        if(when<=old.to)throw new HttpError(409,'بازهٔ دوره هنوز پایان نیافته است')
        const unclosed=await db.from('PerformanceEvaluations').select('Id',{head:true,count:'exact'}).eq('TenantId',auth.tenantId)
          .eq('EvaluationPeriodKey',old.id).eq('IsDeleted',false).neq('EvaluationState','closed')
        check(unclosed.error)
        if(unclosed.count)throw new HttpError(409,'ابتدا ارزیابی‌های باز این دوره را مختومه کنید')
      }
      current.finalizedAt=current.status==='closed'?(old.finalizedAt??new Date().toISOString()):undefined
    }
    for(const current of policy.periods){
      if(current.status==='closed'&&!current.finalizedAt)current.finalizedAt=new Date().toISOString()
      if(current.templates?.some(id=>!policy.evaluation.templates.some(t=>t.id===id)))throw new HttpError(400,'الگوی مجاز دوره معتبر نیست')
    }
    for(const entry of previous.categories)if(!policy.categories.some(value=>value.id===entry.id))policy.categories.push({...entry,active:false})
    const result=await db.from('performance_policy_versions').insert({tenant_id:auth.tenantId,effective_date:when,policy,created_by:auth.userId})
    check(result.error);return json(request,{saved:true},201)
  }
  throw new HttpError(405,'عملیات پشتیبانی نمی‌شود')
}
