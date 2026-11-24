import { apiFetch } from '../../utils/api'
import { dateToJalali, formatJalaliDate, jalaliToDate } from '../../utils/jalali'

export const endpoint='http://localhost:5043/api/v1/performance/periodic'
export const labels:Record<string,string>={draft:'پیش‌نویس',pending:'در انتظار نهایی‌سازی',revision:'نیازمند اصلاح',finalized:'آماده انتشار',published:'منتشرشده',closed:'بسته',
  planned:'برنامه‌ریزی‌شده',active:'در حال انجام',review:'در انتظار بررسی',achieved:'محقق‌شده',followup:'نیازمند پیگیری',cancelled:'لغوشده'}
export const metrics:Record<string,string>={submitted:'گزارش ارسالی',approved:'گزارش تأییدشده',projectCount:'فعالیت پروژه‌ای',nonProjectCount:'فعالیت غیرپروژه‌ای',
  minutes:'مجموع دقیقه فعالیت',allocated:'وظیفه محول‌شده',finished:'وظیفه تکمیل‌شده',late:'وظیفه معوق',waitingMinutes:'دقیقه انتظار تأیید',
  reportRate:'نرخ ارسال گزارش',approvalRate:'نرخ تأیید گزارش',completionRate:'نرخ تکمیل تعهدات',onTimeRate:'نرخ تحویل به‌موقع'}
export const feedbackFields:Record<string,string>={strengths:'نقاط قوت',improvements:'زمینه‌های قابل بهبود',achievements:'دستاوردها',barriers:'موانع',training:'نیاز آموزشی',suggestions:'پیشنهاد مدیر',notes:'یادداشت نهایی مدیر'}
export interface Indicator {id:string;label:string;description:string;kind:string;weight:number;metric?:string;method:string;unit:string;goal?:number;evidenceRequired:boolean;allowNA:boolean}
export interface Template {id:string;label:string;audienceKind:string;audience:string;from:string;to?:string;active:boolean;items:Indicator[]}
export interface Rules {
  enabled:boolean;defaultKind:string;managerDays:number;commentDays:number;allowAppeal:boolean;appealDays:number;qualityNotes:boolean;requireFinal:boolean;
  missingMode:string;notifications:boolean;reminders:boolean;thresholds:{minimum:number;label:string}[];templates:Template[];assignments:Record<string,string>
}
export interface Period {id:string;label:string;kind:string;from:string;to:string;status:string;finalization:string;managerDue?:string;employeeDue?:string;templates?:string[];changeReason?:string}
export interface Employee {id:string;name:string;department?:string;position?:string;canWrite?:boolean;active?:boolean}
export interface Evaluation {id:string;employee:string;name?:string;position?:string;department?:string;period:Period;score:number|null;band?:string;template:string;templateKey:string;state:string;published?:string;pendingAppeal?:boolean}
export interface Score {value?:number|null;source?:number|null;note?:string;sample?:string;na?:boolean;adjust?:boolean;adjusted?:boolean}
export interface PlanInput {title:string;description:string;outcome:string;criterion:string;responsible:string;initial?:string;indicator?:string;from:string;to:string}
export interface Plan {id:string;evaluation_id:string;plan:PlanInput;state:string;progress:number;employee_note?:string;manager_note?:string}
export interface Attachment {id:string;name:string;indicator_key?:string;appeal_id?:string;plan_id?:string}
interface Appeal {Id:string;Reason:string;Status:number;ReviewerResponse?:string;PeriodicDecision?:string;PeriodicExplanation:string;PeriodicIndicatorKey?:string;CreatedAt:string}
interface History {id:string;action:string;actor?:string;date:string;details:{note?:string;score?:number;previousScore?:number;publication?:{score:number};before?:Record<string,Score>;after?:Record<string,Score>}}
export interface Snapshot {template:Template;rules:Rules;scores:Record<string,Score>;feedback:Record<string,string>;metrics:Record<string,number|null>&{sources:{title:string;date:string;project?:string;task?:string;outcome:string}[]}}
export interface Detail extends Evaluation {data:Snapshot;reviewer?:string;seen?:string;version:number;employeeNote?:string;own:boolean;canAdjust:boolean;files:Attachment[];history:History[];appeals:Appeal[];plans:Plan[];priorPlans:Plan[];actions:Record<string,boolean>}
export interface Queue {
  periods:Period[];staff:Employee[];rows:Evaluation[];enabled:boolean;defaultKind:string;
  overview?:{period:string;completed:number;outstanding:number;activePlans:number;groups:{id:string;name:string;count:number;average:number}[]}
}
export interface Mine {results:Evaluation[];plans:Plan[]}
export interface Organization {company:string;generatedAt:string;filters:Record<string,string>;periods:Period[];employees:Employee[];templates:string[];reports:(Evaluation&{data:Snapshot})[];expected:number|null;outstanding:number|null;activePlans:number;canExport:boolean}
export interface SelectedFile {file:File;indicator?:string}

export const fa=(value?:number|null)=>value==null?'فاقد داده':value.toLocaleString('fa-IR',{maximumFractionDigits:2})
export const faScore=(value?:number|null)=>value==null?'فاقد داده':value.toLocaleString('fa-IR',{minimumFractionDigits:2,maximumFractionDigits:2})
const local=(value:string)=>{
  const day=value.length===10?value:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',dateStyle:'short'}).format(new Date(value))
  return new Date(day+'T12:00:00')
}
export const displayDate=(value?:string)=>value?formatJalaliDate(local(value)):'—'
export const jalali=(value?:string)=>{
  if(!value)return undefined
  const d=dateToJalali(local(value));return [d.jy,d.jm,d.jd].join('/')
}
export const iso=(value:string)=>{
  const d=jalaliToDate(value)
  return [d.getFullYear(),d.getMonth()+1,d.getDate()].map((n,i)=>String(n).padStart(i?2:4,'0')).join('-')
}
export const err=(e:unknown)=>e instanceof Error?e.message:'انجام عملیات ممکن نشد'
export async function request<T>(path='',method='GET',body?:unknown):Promise<T>{
  const response=await apiFetch(endpoint+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data.message??'دریافت یا ذخیره ارزیابی انجام نشد')
  return data
}
export async function download(path:string,name:string){
  const response=await apiFetch(endpoint+path)
  if(!response.ok)throw new Error((await response.json().catch(()=>({}))).message??'دانلود فایل انجام نشد')
  const url=URL.createObjectURL(await response.blob()),link=document.createElement('a')
  link.href=url;link.download=name;link.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export async function encodeFiles(files:SelectedFile[]){
  if(files.length>5||files.some(({file})=>!file.size||file.size>1048576))throw new Error('حداکثر پنج فایل، هرکدام تا یک مگابایت')
  return await Promise.all(files.map(({file,indicator})=>new Promise((resolve,reject)=>{
    const reader=new FileReader()
    reader.onload=()=>resolve({name:file.name,indicator,content:String(reader.result).split(',')[1]})
    reader.onerror=()=>reject(new Error('خواندن فایل ممکن نشد'))
    reader.readAsDataURL(file)
  })))
}
