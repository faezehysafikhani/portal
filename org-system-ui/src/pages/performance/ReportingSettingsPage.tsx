import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Checkbox, Input, InputNumber, Select, Space, Spin, Switch, Table, Tabs, Tag, message } from 'antd'
import PersianDatePicker from '../../components/PersianDatePicker'
import { apiFetch } from '../../utils/api'
import { dateToJalali, formatJalaliDate, jalaliToDate } from '../../utils/jalali'

const api='http://localhost:5043/api/v1/performance/config'
const boolLabels={
  enabled:'ثبت گزارش روزانه فعال باشد',required:'ارسال گزارش در روز کاری الزامی باشد',allowRevision:'کارمند بتواند گزارش در انتظار بررسی را برای اصلاح باز کند',
  allowPast:'ثبت فعالیت برای روزهای گذشته مجاز باشد',requireDescription:'شرح فعالیت الزامی باشد',requireTime:'ثبت زمان الزامی باشد',
  allowManual:'ثبت مدت بدون ساعت شروع و پایان مجاز باشد',requireOutcome:'خروجی برای فعالیت تکمیل‌شده الزامی باشد',allowEmpty:'گزارش بدون فعالیت با ذکر دلیل مجاز باشد',
} as const
type BoolKey=keyof typeof boolLabels
interface Category {id:string;label:string;active:boolean}
interface Indicator {id:string;label:string;description:string;kind:string;unit:string;method:string;audienceKind:string;audience:string;weight:number;active:boolean;from:string}
interface Period {id:string;label:string;kind:string;from:string;to:string;status:string;finalization:string}
type Policy=Record<BoolKey,boolean>&{
  deadline:string;lateDays:number;pastDays:number;workStart:string;workEnd:string;workingDays:number[];useOfficialHolidays:boolean;partialLeaveExempts:boolean;
  organizationHolidays:string[];officialHolidays:string[];exceptions:Record<string,'work'|'off'>;
  categories:Category[];indicators:Indicator[];periods:Period[];
  files:{maxBytes:number;maxCount:number;totalBytes:number;mimes:string[];retentionDays:number};
}
interface Version {id:string;effective_date:string;created_at:string;author?:string}
const permissionLabels:Record<string,string>={
  'performance.reports.organization':'مشاهدهٔ گزارش کل سازمان','performance.reports.approve':'تأیید و برگشت گزارش کل سازمان',
  'performance.reports.download':'دانلود پیوست کل سازمان','performance.settings.manage':'مدیریت تنظیمات',
  'performance.analytics.export':'خروجی Excel','performance.access.manage':'مدیریت مجوزها',
}
const mimes=[{label:'PDF',value:'application/pdf'},{label:'PNG',value:'image/png'},{label:'JPEG',value:'image/jpeg'},{label:'TXT',value:'text/plain'}]
const days=[['شنبه',6],['یکشنبه',0],['دوشنبه',1],['سه‌شنبه',2],['چهارشنبه',3],['پنجشنبه',4],['جمعه',5]].map(([label,value])=>({label,value}))
const template=(rows:[string,string][])=>rows.map(([value,label])=>({value,label}))
const iso=(value:string)=>{
  const d=jalaliToDate(value)
  return [d.getFullYear(),d.getMonth()+1,d.getDate()].map((n,i)=>String(n).padStart(i?2:4,'0')).join('-')
}
const local=(value:string)=>new Date(value.slice(0,10)+'T12:00:00')
const persian=(value:string)=>{const j=dateToJalali(local(value));return `${j.jy}/${j.jm}/${j.jd}`}
const display=(v:string)=>formatJalaliDate(local(v))
const errorMessage=(e:unknown)=>e instanceof Error?e.message:'خطا در انجام عملیات'
const badge=(active:boolean)=><Tag color={active?'green':'default'}>{active?'فعال':'غیرفعال'}</Tag>
async function get<T>(path='',method='GET',request?:unknown):Promise<T>{
  const r=await apiFetch(api+path,{method,headers:request?{'Content-Type':'application/json'}:undefined,body:request?JSON.stringify(request):undefined})
  const page=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(page.message||'دریافت یا ذخیره اطلاعات انجام نشد')
  return page
}
const field=(label:string,control:ReactNode)=><label style={{display:'flex',flexDirection:'column',gap:6,minWidth:150}}>
  <span>{label}</span>{control}
</label>
function DateInput({value,change}:{value?:string;change:(date:string)=>void}){
  return <PersianDatePicker value={value?persian(value):undefined} onChange={v=>{if(v)change(iso(v))}}/>
}
function dates({label,rows,change}:{label:string;rows:string[];change:(rows:string[])=>void}){
  return <Card size="small" title={label}>
    <Space wrap><DateInput change={v=>change([...new Set([...rows,v])].sort())}/>
      {rows.map(date=><Tag key={date} closable onClose={()=>change(rows.filter(d=>d!==date))}>{display(date)}</Tag>)}
    </Space>
  </Card>
}
function PermissionsEditor() {
  const [people,setPeople]=useState<{id:string;name:string}[]>([]),[id,setId]=useState<string>()
  const [codes,setCodes]=useState<string[]>([]),[loadedFor,setLoadedFor]=useState<string>()
  const [loading,setLoading]=useState(false),[error,setError]=useState('')
  useEffect(()=>{
    let active=true
    get<{users:{id:string;name:string}[]}>('/grants').then(data=>{if(active)setPeople(data.users)}).catch(e=>{if(active)setError(errorMessage(e))})
    return()=>{active=false}
  },[])
  useEffect(()=>{
    if(!id)return
    let active=true
    setLoading(true);setError('')
    get<{codes:string[]}>(`/grants?user=${encodeURIComponent(id)}`).then(data=>{if(active){setCodes(data.codes);setLoadedFor(id)}})
      .catch(e=>{if(active)setError(errorMessage(e))}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[id])
  async function save() {
    setLoading(true);setError('')
    try{await get('/grants','PUT',{user:id,codes});message.success('مجوزها ذخیره شدند')}
    catch(e){setError(errorMessage(e))}
    finally{setLoading(false)}
  }
  return <Space direction="vertical" size="middle">
    {error&&<Alert type="error" showIcon message={error}/>}
    <Alert type="info" showIcon message="دسترسی عادی مدیر به زیرمجموعهٔ مستقیم از ساختار سازمانی می‌آید. مجوزهای زیر دسترسی سازمانی را جداگانه تعیین می‌کنند."/>
    <Select showSearch optionFilterProp="label" placeholder="کاربر" style={{width:240}} value={id} onChange={value=>{setLoadedFor(undefined);setId(value)}}
      options={people.map(p=>({value:p.id,label:p.name}))}/>
    {id&&loadedFor===id&&<Space direction="vertical">
      <Checkbox.Group value={codes} onChange={setCodes} options={Object.entries(permissionLabels).map(([value,label])=>({value,label}))}/>
      <Button type="primary" onClick={()=>void save()} loading={loading}>ذخیره مجوزها</Button>
    </Space>}
    {loading&&loadedFor!==id&&<Spin/>}
  </Space>
}
export default function ReportingSettingsPage(){
  const [access,setAccess]=useState<{configure:boolean;grants:boolean}>()
  const [policy,setPolicy]=useState<Policy>(),[versions,setVersions]=useState<Version[]>([]),[effective,setEffective]=useState<string>(),[serverDay,setServerDay]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[exceptionDate,setExceptionDate]=useState<string>()
  const [exceptionKind,setExceptionKind]=useState<'work'|'off'>('off')
  useEffect(()=>{
    let active=true
    get<{configure:boolean;grants:boolean}>('/access').then(async access=>{
      if(!active)return
      setAccess(access)
      if(access.configure){
        const data=await get<{policy:Policy;versions:Version[];today:string}>()
        if(active){setPolicy(data.policy);setVersions(data.versions);setServerDay(data.today);setEffective(data.today)}
      }
    }).catch(e=>{if(active)setError(errorMessage(e))})
    return()=>{active=false}
  },[])
  function set<K extends keyof Policy>(key:K,value:Policy[K]){setPolicy(current=>current?{...current,[key]:value}:current)}
  async function loadDate(date:string){
    setBusy(true);setError('')
    try{
      const data=await get<{policy:Policy;versions:Version[]}>(`?date=${encodeURIComponent(date)}`)
      setPolicy(data.policy);setVersions(data.versions);setEffective(date)
    }catch(e){setError(errorMessage(e))}
    finally{setBusy(false)}
  }
  async function save(){
    if(!policy||!effective)return
    setBusy(true);setError('')
    try{
      await get('','POST',{effectiveDate:effective,policy})
      message.success('نسخهٔ تنظیمات ذخیره شد')
      const result=await get<{versions:Version[]}>(`?date=${encodeURIComponent(effective)}`)
      setVersions(result.versions)
    }catch(e){setError(errorMessage(e))}
    finally{setBusy(false)}
  }
  async function loadVersion(id:string){
    setBusy(true);setError('')
    try{
      const data=await get<{policy:Policy;effectiveDate:string}>(`?version=${encodeURIComponent(id)}`)
      setPolicy(data.policy);setEffective(data.effectiveDate)
    }catch(e){setError(errorMessage(e))}
    finally{setBusy(false)}
  }
  const shortNumber=(value:number,change:(n:number)=>void,max:number)=> <InputNumber min={0} max={max} precision={0} value={value} onChange={n=>change(n??0)}/>
  function editor<K extends 'categories'|'indicators'|'periods'>(key:K,id:string,changes:Partial<Policy[K][number]>) {
    if(policy)set(key,policy[key].map(item=>item.id===id?{...item,...changes}:item) as Policy[K])
  }
  const clock=(key:'deadline'|'workStart'|'workEnd')=> <Input type="time" dir="ltr" value={policy?.[key]} onChange={e=>set(key,e.target.value)}/>
  const entryId=()=>crypto.randomUUID()
  const content=policy?[
    {key:'general',label:'عمومی',children:<Space direction="vertical" size="middle">
      {Object.entries(boolLabels).map(([key,label])=><Space key={key}><Switch checked={policy[key as BoolKey]} onChange={v=>set(key as BoolKey,v)}/>{label}</Space>)}
      <Space wrap>{field('مهلت ارسال (تهران)',clock('deadline'))}{field('مهلت ثبت با تأخیر به روز (۰ = بدون سقف)',shortNumber(policy.lateDays,v=>set('lateDays',v),365))}
        {field('سقف ثبت فعالیت گذشته به روز (۰ = بدون سقف)',shortNumber(policy.pastDays,v=>set('pastDays',v),365))}</Space>
    </Space>},
    {key:'calendar',label:'تقویم و روزهای کاری',children:<Space direction="vertical" size="middle" style={{width:'100%'}}>
      {field('روزهای کاری هفته',<Checkbox.Group options={days} value={policy.workingDays} onChange={v=>set('workingDays',v as number[])}/>)}
      <Space wrap>{field('شروع معمول کار',clock('workStart'))}{field('پایان معمول کار',clock('workEnd'))}{field('مهلت ارسال',clock('deadline'))}</Space>
      <Space><Switch checked={policy.useOfficialHolidays} onChange={v=>set('useOfficialHolidays',v)}/>تعطیلات رسمی لحاظ شوند</Space>
      <Space><Switch checked={policy.partialLeaveExempts} onChange={v=>set('partialLeaveExempts',v)}/>مرخصی ساعتی تأییدشده، روز را معاف کند</Space>
      {dates({label:'تعطیلات سازمانی',rows:policy.organizationHolidays,change:v=>set('organizationHolidays',v)})}
      {dates({label:'تعطیلات رسمی تکمیلی',rows:policy.officialHolidays,change:v=>set('officialHolidays',v)})}
      <Card size="small" title="استثناهای تقویمی"><Space wrap>
        <DateInput value={exceptionDate} change={setExceptionDate}/>
        <Select value={exceptionKind} onChange={setExceptionKind} options={template([['off','تعطیل'],['work','روز کاری']])}/>
        <Button disabled={!exceptionDate} onClick={()=>{if(exceptionDate)set('exceptions',{...policy.exceptions,[exceptionDate]:exceptionKind})}}>افزودن استثنا</Button>
        {Object.entries(policy.exceptions).map(([date,value])=><Tag key={date} closable onClose={()=>{
          const remaining={...policy.exceptions};delete remaining[date];set('exceptions',remaining)
        }}>{display(date)} · {value==='off'?'تعطیل':'کاری'}</Tag>)}
      </Space></Card>
    </Space>},
    {key:'categories',label:'دسته‌بندی فعالیت‌ها',children:<Space direction="vertical" size="middle">
      <Button onClick={()=>set('categories',[...policy.categories,{id:entryId(),label:'',active:true}])}>افزودن دسته</Button>
      {policy.categories.map(item=><Space key={item.id} wrap>
        <Input aria-label="نام دسته" placeholder="نام دسته" value={item.label} onChange={e=>editor('categories',item.id,{label:e.target.value})}/>
        <Switch checked={item.active} onChange={active=>editor('categories',item.id,{active})}/>{badge(item.active)}
      </Space>)}
    </Space>},
    {key:'indicators',label:'شاخص‌ها',children:<Space direction="vertical" size="middle" style={{width:'100%'}}>
      <Button onClick={()=>set('indicators',[...policy.indicators,{id:entryId(),label:'',description:'',kind:'qualitative',unit:'',method:'',audienceKind:'position',audience:'',weight:0,active:true,from:effective||serverDay}])}>افزودن شاخص</Button>
      {policy.indicators.map(item=><Card key={item.id} size="small">
        <Space wrap align="start">
          {field('عنوان',<Input value={item.label} onChange={e=>editor('indicators',item.id,{label:e.target.value})}/>)}
          {field('شرح شاخص',<Input.TextArea value={item.description} onChange={e=>editor('indicators',item.id,{description:e.target.value})}/>)}
          {field('نوع',<Select value={item.kind} options={template([['quantitative','کمی'],['qualitative','کیفی']])} onChange={kind=>editor('indicators',item.id,{kind})}/>)}
          {field('واحد اندازه‌گیری',<Input value={item.unit} onChange={e=>editor('indicators',item.id,{unit:e.target.value})}/>)}
          {field('روش محاسبه یا ثبت',<Input.TextArea value={item.method} onChange={e=>editor('indicators',item.id,{method:e.target.value})}/>)}
          {field('نوع مخاطب',<Select value={item.audienceKind} options={template([['position','سمت'],['department','واحد'],['group','گروه شغلی']])} onChange={audienceKind=>editor('indicators',item.id,{audienceKind})}/>)}
          {field('سمت، واحد یا گروه شغلی',<Input value={item.audience} onChange={e=>editor('indicators',item.id,{audience:e.target.value})}/>)}
          {field('وزن',<InputNumber value={item.weight} min={0} max={100} onChange={weight=>editor('indicators',item.id,{weight:weight??0})}/>)}
          {field('شروع اعتبار',<DateInput value={item.from} change={from=>editor('indicators',item.id,{from})}/>)}
          {field('فعال',<Switch checked={item.active} onChange={active=>editor('indicators',item.id,{active})}/>)}
          <Button danger onClick={()=>set('indicators',policy.indicators.filter(i=>i.id!==item.id))}>حذف از این نسخه</Button>
        </Space>
      </Card>)}
    </Space>},
    {key:'periods',label:'دوره‌های ارزیابی',children:<Space direction="vertical" size="middle" style={{width:'100%'}}>
      <Button onClick={()=>set('periods',[...policy.periods,{id:entryId(),label:'',kind:'month',from:effective||serverDay,to:effective||serverDay,status:'draft',finalization:''}])}>افزودن دوره</Button>
      {policy.periods.map(item=><Card key={item.id} size="small"><Space align="start" wrap>
        {field('عنوان دوره',<Input value={item.label} onChange={e=>editor('periods',item.id,{label:e.target.value})}/>)}
        {field('نوع دوره',<Select value={item.kind} options={template([['month','ماهانه'],['quarter','فصلی'],['half','شش‌ماهه'],['year','سالانه'],['custom','دلخواه']])} onChange={kind=>editor('periods',item.id,{kind})}/>)}
        {field('از',<DateInput value={item.from} change={from=>editor('periods',item.id,{from})}/>)}
        {field('تا',<DateInput value={item.to} change={to=>editor('periods',item.id,{to})}/>)}
        {field('وضعیت',<Select value={item.status} options={template([['draft','پیش‌نویس'],['open','فعال'],['closed','بسته']])} onChange={status=>editor('periods',item.id,{status})}/>)}
        {field('سیاست نهایی شدن',<Input.TextArea value={item.finalization} onChange={e=>editor('periods',item.id,{finalization:e.target.value})}/>)}
        <Button danger onClick={()=>set('periods',policy.periods.filter(p=>p.id!==item.id))}>حذف از این نسخه</Button>
      </Space></Card>)}
    </Space>},
    {key:'files',label:'فایل‌های پیوست',children:<Space direction="vertical" size="middle">
      <Space wrap>{field('سقف هر فایل (کیلوبایت)',<InputNumber min={1} max={1024} value={policy.files.maxBytes/1024} onChange={v=>set('files',{...policy.files,maxBytes:Math.round((v??1)*1024)})}/>)}
        {field('سقف کل پیوست‌های فعالیت (کیلوبایت)',<InputNumber min={1} max={5120} value={policy.files.totalBytes/1024} onChange={v=>set('files',{...policy.files,totalBytes:Math.round((v??1)*1024)})}/>)}
        {field('تعداد مجاز فایل',shortNumber(policy.files.maxCount,v=>set('files',{...policy.files,maxCount:v}),5))}
        {field('مدت دسترسی آنلاین (روز، ۰ = نامحدود)',shortNumber(policy.files.retentionDays,v=>set('files',{...policy.files,retentionDays:v}),3650))}</Space>
      <Checkbox.Group value={policy.files.mimes} options={mimes} onChange={value=>set('files',{...policy.files,mimes:value})}/>
      <Alert type="info" showIcon message="پس از پایان مدت تعیین‌شده، دانلود آنلاین بسته می‌شود و فایل برای حفظ سوابق در مخزن خصوصی باقی می‌ماند."/>
    </Space>},
    {key:'versions',label:'تاریخچه تنظیمات',children:<Table rowKey="id" dataSource={versions} columns={[
      {title:'تاریخ اجرا',dataIndex:'effective_date',render:display},
      {title:'ثبت در',dataIndex:'created_at',render:(v:string)=>new Date(v).toLocaleString('fa-IR',{timeZone:'Asia/Tehran'})},
      {title:'ثبت‌کننده',dataIndex:'author'},{title:'عملیات',render:(_,v)=><Button size="small" onClick={()=>void loadVersion(v.id)}>دیدن این نسخه</Button>},
    ]}/>},
  ]:[]
  return <div dir="rtl"><Card title="تنظیمات ارزیابی عملکرد">
    <Space direction="vertical" size="middle" style={{width:'100%'}}>
      {error&&<Alert type="error" showIcon message={error}/>}
      {!access&&!error&&<Spin/>}
      {access&&!access.configure&&!access.grants&&<Alert type="warning" message="مجوز تنظیمات ارزیابی عملکرد را ندارید."/>}
      {policy&&effective&&<Space wrap>
        <span>تاریخ اجرای نسخه</span><DateInput value={effective} change={setEffective}/>
        <Button onClick={()=>void loadDate(effective)} disabled={busy}>بارگذاری نسخهٔ این تاریخ</Button>
        <Button type="primary" loading={busy} onClick={()=>void save()} disabled={effective<serverDay}>ذخیره نسخه</Button>
      </Space>}
      <Tabs items={[...content,...(access?.grants?[{key:'access',label:'دسترسی‌ها',children:<PermissionsEditor/>}]:[])]}/>
    </Space>
  </Card></div>
}
