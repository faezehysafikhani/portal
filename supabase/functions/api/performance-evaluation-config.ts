import { HttpError } from '../_shared/http.ts'

export const evaluationGrants={
  evalView:'performance.eval.view',evalWrite:'performance.eval.write',evalApprove:'performance.eval.approve',
  evalPublish:'performance.eval.publish',evalReopen:'performance.eval.reopen',evalAppeals:'performance.eval.appeals',
  evalOrg:'performance.eval.organization',evalTemplates:'performance.eval.templates',evalIndicators:'performance.eval.indicators',
  evalSettings:'performance.eval.settings',evalAdjust:'performance.eval.adjust',evalEvidence:'performance.eval.evidence',
} as const
export const metrics=['onTimeRate','completionRate','reportRate','approvalRate'] as const
export type Metric=typeof metrics[number]
export interface TemplateItem {id:string;label:string;description:string;kind:'qualitative'|'quantitative';weight:number;metric?:Metric;method:string;unit:string;goal?:number;evidenceRequired:boolean;allowNA:boolean}
export interface Template {id:string;label:string;audienceKind:'position'|'department'|'group'|'all';audience:string;from:string;to?:string;active:boolean;items:TemplateItem[]}
export interface EvaluationRules {
  enabled:boolean;defaultKind:string;managerDays:number;commentDays:number;allowAppeal:boolean;appealDays:number;
  qualityNotes:boolean;requireFinal:boolean;missingMode:'block'|'redistribute';notifications:boolean;reminders:boolean;
  thresholds:{minimum:number;label:string}[];templates:Template[];assignments:Record<string,string>
}
export interface Period {id:string;label:string;kind:string;from:string;to:string;status:string;finalization:string;managerDue?:string;employeeDue?:string;templates?:string[];changeReason?:string}
const method='امتیاز از صفر تا ۱۰۰ بر اساس شواهد خروجی و رفتار شغلی در همین دوره'
const presets:[string,string,string,[string,number][]][]=[
  ['developer','برنامه‌نویس','برنامه‌نویس',[['کیفیت کد و خروجی فنی',30],['انجام به‌موقع تعهدات',25],['تحقق اهداف و وظایف',20],['مستندسازی و رعایت استانداردها',15],['همکاری و مسئولیت‌پذیری',10]]],
  ['finance','کارشناس مالی','کارشناس مالی',[['دقت و صحت اسناد مالی',35],['انجام به‌موقع فعالیت‌ها',25],['رعایت ضوابط و فرایندها',20],['تهیه گزارش‌های مالی',10],['همکاری و پاسخ‌گویی',10]]],
  ['office','کارشناس اداری','کارشناس اداری',[['دقت و کیفیت مکاتبات',30],['پیگیری و انجام تعهدات',30],['نظم و رعایت فرایندهای کاری',20],['پاسخ‌گویی و همکاری',20]]],
  ['project-manager','مدیر پروژه','مدیر پروژه',[['تحقق اهداف و خروجی‌های پروژه',30],['مدیریت زمان‌بندی و تعهدات',25],['مدیریت ریسک و مسائل',20],['هماهنگی و ارتباطات',15],['کیفیت گزارش‌دهی',10]]],
  ['hr','منابع انسانی','کارشناس منابع انسانی',[['دقت اجرای فرایندهای منابع انسانی',30],['انجام به‌موقع درخواست‌ها',25],['کیفیت خدمات و پاسخ‌گویی',20],['رعایت محرمانگی و ضوابط',15],['همکاری سازمانی',10]]],
  ['general','عمومی سازمان','',[['کیفیت خروجی',35],['انجام به‌موقع تعهدات',25],['تحقق اهداف',25],['مسئولیت‌پذیری',15]]],
]
export const evaluationDefaults:EvaluationRules={
  enabled:true,defaultKind:'month',managerDays:7,commentDays:7,allowAppeal:true,appealDays:5,
  qualityNotes:true,requireFinal:true,missingMode:'block',notifications:true,reminders:true,
  thresholds:[{minimum:90,label:'فراتر از انتظار'},{minimum:75,label:'مطابق انتظار'},{minimum:60,label:'نیازمند بهبود'},{minimum:0,label:'نیازمند برنامه بهبود'}],
  templates:presets.map(([id,label,audience,items])=>({id,label,audienceKind:audience?'position':'all',audience,from:'2020-01-01',active:true,
    items:items.map(([label,weight],i)=>({id:`${id}-${i}`,label,weight,description:'',kind:'qualitative',method,unit:'امتیاز',evidenceRequired:false,allowNA:false}))})),
  assignments:{},
}
const invalid=(message:string)=>{throw new HttpError(400,message)}
const word=(v:unknown,max:number,required=false)=>{
  if(v!=null&&typeof v!=='string')return invalid('متن الگو معتبر نیست')
  const value=String(v??'').trim()
  if(value.length>max||(required&&!value))return invalid('عنوان و مقادیر اجباری الگو را بررسی کنید')
  return value
}
const key=(v:unknown)=>typeof v==='string'&&/^[-a-z0-9_]{1,80}$/.test(v)?v:invalid('شناسه معتبر نیست')
const list=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max?v:invalid('تعداد اقلام تنظیمات نامعتبر است')
const record=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:invalid('ساختار تنظیمات نامعتبر است')
const date=(v:unknown):string=>{
  if(typeof v!=='string'||!/^\d{4}-\d\d-\d\d$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)return invalid('تاریخ نامعتبر است')
  return v
}
const numeric=(v:unknown,min:number,max:number,integer=false):number=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))return invalid('مقدار عددی خارج از بازه است')
  return v
}
export function validateEvaluationRules(raw:unknown):EvaluationRules{
  const v=record(raw),out={...evaluationDefaults}
  for(const k of ['enabled','allowAppeal','qualityNotes','requireFinal','notifications','reminders'] as const){
    if(typeof v[k]!=='boolean')return invalid('گزینه‌های ارزیابی باید روشن یا خاموش باشند')
    out[k]=v[k] as boolean
  }
  if(typeof v.defaultKind!=='string'||!['month','quarter','half','year','custom'].includes(v.defaultKind))return invalid('نوع دوره معتبر نیست')
  if(v.missingMode!=='block'&&v.missingMode!=='redistribute')return invalid('سیاست وزن شاخص معتبر نیست')
  out.defaultKind=v.defaultKind;out.missingMode=v.missingMode
  out.managerDays=numeric(v.managerDays,0,365,true);out.commentDays=numeric(v.commentDays,1,90,true);out.appealDays=numeric(v.appealDays,1,30,true)
  out.thresholds=list(v.thresholds,12).map(raw=>{const b=record(raw);return {minimum:numeric(b.minimum,0,100),label:word(b.label,120,true)}}).sort((a,b)=>b.minimum-a.minimum)
  if(!out.thresholds.some(s=>s.minimum===0)||new Set(out.thresholds.map(s=>s.minimum)).size!==out.thresholds.length)return invalid('سطح‌ها باید یکتا باشند و از صفر پوشش داشته باشند')
  out.templates=list(v.templates,100).map(raw=>{
    const t=record(raw), from=date(t.from),to=t.to?date(t.to):undefined
    if(to&&to<from)return invalid('پایان اعتبار الگو قبل از شروع آن است')
    const audienceKind=t.audienceKind
    if(audienceKind!=='position'&&audienceKind!=='department'&&audienceKind!=='group'&&audienceKind!=='all')return invalid('گروه الگو معتبر نیست')
    const items:TemplateItem[]=list(t.items,30).map(item=>{
      const i=record(item)
      if(i.kind!=='qualitative'&&i.kind!=='quantitative')return invalid('نوع شاخص معتبر نیست')
      if(i.metric&&(!metrics.includes(i.metric as Metric)||i.kind!=='quantitative'))return invalid('روش محاسبه خودکار معتبر نیست')
      const weight=numeric(i.weight,0.01,100)
      if(Math.abs(Math.round(weight*100)-weight*100)>1e-6)return invalid('وزن شاخص حداکثر دو رقم اعشار دارد')
      return {id:key(i.id),label:word(i.label,150,true),description:word(i.description,2000),kind:i.kind,weight,
        metric:i.metric as Metric|undefined,method:word(i.method,2000,true),unit:word(i.unit,100),
        goal:i.goal==null?undefined:numeric(i.goal,0,100),evidenceRequired:i.evidenceRequired===true,allowNA:i.allowNA===true}
    })
    if(new Set(items.map(i=>i.id)).size!==items.length)return invalid('شناسه شاخص‌ها تکراری است')
    if(t.active===true&&items.reduce((n,i)=>n+Math.round(i.weight*100),0)!==10000)return invalid('مجموع وزن شاخص‌های الگوی فعال باید دقیقاً ۱۰۰ باشد')
    return {id:key(t.id),label:word(t.label,150,true),audienceKind,audience:word(t.audience,150,audienceKind!=='all'),from,to,active:t.active===true,items}
  })
  if(new Set(out.templates.map(t=>t.id)).size!==out.templates.length)return invalid('شناسه الگو تکراری است')
  out.assignments=Object.fromEntries(Object.entries(record(v.assignments)).map(([employee,raw])=>{
    if(!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(employee)||!out.templates.some(t=>t.id===raw))return invalid('تخصیص الگو معتبر نیست')
    return [employee,key(raw)]
  }))
  return out
}
export function readEvaluationRules(value:Partial<EvaluationRules>|undefined):EvaluationRules{
  return {...evaluationDefaults,...value}
}
export function validatePeriodExtras(input:Record<string,unknown>,from:string,to:string){
  const managerDue=input.managerDue?date(input.managerDue):undefined
  const employeeDue=input.employeeDue?date(input.employeeDue):undefined
  if(managerDue&&managerDue<to||employeeDue&&employeeDue<(managerDue??to))return invalid('مهلت مدیر یا کارمند با بازه دوره مطابقت ندارد')
  if((Date.parse(to)-Date.parse(from))/86400000>365)return invalid('بازه هر دوره حداکثر ۳۶۶ روز است')
  return {managerDue,employeeDue,templates:input.templates==null?[]:list(input.templates,100).map(key),
    changeReason:word(input.changeReason,1000)}
}
const normalize=(v:unknown)=>String(v??'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,'').toLowerCase()
export function pickTemplate(rules:EvaluationRules,employee:{id:string;position?:string;department?:string},period:Period):Template{
  const templates=rules.templates.filter(t=>t.active&&t.from<=period.to&&(!t.to||t.to>=period.from)
    &&(!period.templates?.length||period.templates.includes(t.id)))
  const assigned=rules.assignments[employee.id]
  if(assigned){
    const exact=templates.find(t=>t.id===assigned)
    if(exact)return exact
    throw new HttpError(400,'الگوی تخصیص‌یافته در این دوره معتبر نیست')
  }
  for(const scope of ['position','department','all'] as const){
    const matches=templates.filter(t=>t.audienceKind===scope&&(scope==='all'||normalize(t.audience)===normalize(employee[scope])))
    if(matches.length===1)return matches[0]
    if(matches.length>1)throw new HttpError(400,'چند الگوی معتبر وجود دارد؛ الگوی کارمند را صریحاً تخصیص دهید')
  }
  throw new HttpError(400,'الگوی معتبر برای این کارمند و دوره تعریف نشده است')
}
