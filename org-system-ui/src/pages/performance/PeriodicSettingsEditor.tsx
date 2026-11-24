import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Checkbox, Collapse, Input, InputNumber, Select, Space, Tag } from 'antd'
import { DateField } from './EvaluationDialog'
import { err, fa, metrics, request } from './periodic-model'
import type { Employee, Indicator, Rules, Template } from './periodic-model'

export const periodKinds=[{value:'month',label:'ماهانه'},{value:'quarter',label:'فصلی'},{value:'half',label:'شش‌ماهه'},{value:'year',label:'سالانه'},{value:'custom',label:'دلخواه'}]
const audiences=[{value:'all',label:'سازمان'},{value:'position',label:'سمت'},{value:'department',label:'واحد'},{value:'group',label:'گروه شغلی'}]
const text=(label:string,control:ReactNode)=><label style={{display:'flex',minWidth:155,flexDirection:'column',gap:4}}>{label}{control}</label>
const toggles={enabled:'ارزیابی دوره‌ای فعال باشد',allowAppeal:'درخواست بازبینی مجاز باشد',requireFinal:'تأیید نهایی پیش از انتشار اجباری باشد',
  qualityNotes:'دلیل و نمونه مستند برای شاخص کیفی الزامی باشد',notifications:'اعلان گردش کار ارسال شود',reminders:'یادآوری دوره و برنامه بهبود ارسال شود'} as const
const durations={managerDays:'مهلت مدیر پس از پایان دوره (روز)',commentDays:'مهلت اعلام نظر پس از انتشار (روز)',appealDays:'مهلت بازبینی پس از انتشار (روز کاری)'} as const
const sources=['onTimeRate','completionRate','reportRate','approvalRate'].map(value=>({value,label:metrics[value]}))
const id=()=>crypto.randomUUID()

export function EvaluationRulesEditor({value,onChange}:{value:Rules;onChange:(value:Rules)=>void}){
  const update=<K extends keyof Rules>(key:K,data:Rules[K])=>onChange({...value,[key]:data})
  return <Space direction="vertical" size="middle" style={{width:'100%'}}>
    {Object.entries(toggles).map(([key,label])=><Checkbox key={key} checked={value[key as keyof typeof toggles]} onChange={e=>update(key as keyof typeof toggles,e.target.checked)}>{label}</Checkbox>)}
    <Space wrap>
      {text('دوره پیش‌فرض',<Select value={value.defaultKind} options={periodKinds} onChange={v=>update('defaultKind',v)}/>)}
      {Object.entries(durations).map(([key,label])=><div key={key}>{text(label,<InputNumber min={key==='managerDays'?0:1} max={key==='appealDays'?30:key==='commentDays'?90:365} precision={0}
        value={value[key as keyof typeof durations]} onChange={n=>{if(n!=null)update(key as keyof typeof durations,n)}}/>)}</div>)}
      {text('سیاست شاخص فاقد داده',<Select value={value.missingMode} onChange={v=>update('missingMode',v)} options={[
        {value:'block',label:'نیازمند تکمیل شاخص'},{value:'redistribute',label:'بازتوزیع وزن شاخص غیرقابل‌اعمال با دلیل'},
      ]}/>)}
    </Space>
    <Card size="small" title="سطوح عملکرد">
      <Space direction="vertical">
        {value.thresholds.map((item,i)=><Space key={i} wrap>
          {text('از امتیاز',<InputNumber min={0} max={100} precision={2} value={item.minimum} onChange={n=>update('thresholds',value.thresholds.map((b,j)=>j===i?{...b,minimum:n??0}:b))}/>)}
          {text('عنوان سطح',<Input value={item.label} onChange={e=>update('thresholds',value.thresholds.map((b,j)=>j===i?{...b,label:e.target.value}:b))}/>)}
          <Button danger onClick={()=>update('thresholds',value.thresholds.filter((_,j)=>j!==i))}>حذف سطح</Button>
        </Space>)}
        <Button disabled={value.thresholds.length>=12} onClick={()=>update('thresholds',[...value.thresholds,{minimum:0,label:''}])}>افزودن سطح</Button>
      </Space>
    </Card>
  </Space>
}
type CatalogItem=Pick<Indicator,'id'|'label'|'description'|'kind'|'method'|'unit'|'weight'>&{active:boolean}
const blankItem=():Indicator=>({id:id(),label:'',description:'',kind:'qualitative',method:'',unit:'امتیاز',weight:0,evidenceRequired:false,allowNA:false})
function IndicatorEditor({item,update,remove}:{item:Indicator;update:(value:Partial<Indicator>)=>void;remove:()=>void}){
  return <Card size="small" title={item.label||'شاخص جدید'} extra={<Button danger size="small" onClick={remove}>حذف از الگو</Button>}>
    <Space wrap align="start">
      {text('عنوان',<Input value={item.label} onChange={e=>update({label:e.target.value})} maxLength={120}/>)}
      {text('نوع شاخص',<Select value={item.kind} options={[{value:'qualitative',label:'کیفی'},{value:'quantitative',label:'کمی'}]}
        onChange={kind=>update({kind,metric:kind==='qualitative'?undefined:item.metric})}/>)}
      {text('وزن (درصد)',<InputNumber min={0.01} max={100} precision={2} value={item.weight} onChange={n=>update({weight:n??0})}/>)}
      {text('شرح',<Input.TextArea value={item.description} onChange={e=>update({description:e.target.value})}/>)}
      {text('روش محاسبه یا ثبت',<Input.TextArea value={item.method} onChange={e=>update({method:e.target.value})}/>)}
      {text('واحد',<Input value={item.unit} onChange={e=>update({unit:e.target.value})}/>)}
      {text('هدف یا حد انتظار',<InputNumber value={item.goal} min={0} onChange={goal=>update({goal:goal??undefined})}/>)}
      {item.kind==='quantitative'&&text('منبع خودکار',<Select value={item.metric} onChange={metric=>update({metric})} options={sources} allowClear placeholder="ثبت دستی"/>)}
      <Checkbox checked={item.evidenceRequired} onChange={e=>update({evidenceRequired:e.target.checked})}>مستند الزامی</Checkbox>
      <Checkbox checked={item.allowNA} onChange={e=>update({allowNA:e.target.checked})}>عدم شمول با دلیل</Checkbox>
    </Space>
  </Card>
}
function TemplateEditor({item,catalog,update,duplicate,remove}:{item:Template;catalog:CatalogItem[];update:(value:Partial<Template>)=>void;duplicate:()=>void;remove:()=>void}){
  const weight=Math.round(item.items.reduce((total,value)=>total+value.weight,0)*100)/100
  return <Space direction="vertical" size="middle" style={{width:'100%'}}>
    <Space wrap>
      {text('عنوان الگو',<Input value={item.label} onChange={e=>update({label:e.target.value})}/>)}
      {text('مخاطب',<Select value={item.audienceKind} options={audiences} onChange={audienceKind=>update({audienceKind})}/>)}
      {item.audienceKind!=='all'&&text('نام سمت، واحد یا گروه',<Input value={item.audience} onChange={e=>update({audience:e.target.value})}/>)}
      {text('تاریخ شروع اعتبار',<DateField value={item.from} onChange={from=>update({from})}/>)}
      {text('پایان اعتبار',<DateField value={item.to} onChange={to=>update({to:to||undefined})}/>)}
      <Checkbox checked={item.active} onChange={e=>update({active:e.target.checked})}>فعال</Checkbox>
      <Button onClick={duplicate}>کپی الگو</Button>
      <Button danger onClick={remove}>حذف از این نسخه</Button>
    </Space>
    <Space wrap>
      <Tag color={weight===100?'green':'orange'}>مجموع وزن {fa(weight)}٪</Tag>
      <Button onClick={()=>update({items:[...item.items,blankItem()]})}>تعریف شاخص جدید</Button>
      <Select placeholder="افزودن از فهرست شاخص‌ها" showSearch optionFilterProp="label" style={{minWidth:200}} value={undefined}
        onSelect={id=>{const selected=catalog.find(i=>i.id===id);if(selected)update({items:[...item.items,{...blankItem(),...selected}]})}}
        options={catalog.filter(i=>i.active&&!item.items.some(existing=>existing.id===i.id)).map(i=>({value:i.id,label:i.label}))}/>
    </Space>
    {item.items.map(i=><IndicatorEditor key={i.id} item={i} update={changes=>update({items:item.items.map(v=>v.id===i.id?{...v,...changes}:v)})}
      remove={()=>update({items:item.items.filter(v=>v.id!==i.id)})}/>)}
  </Space>
}
export function TemplatesEditor({value,catalog,today,onChange}:{value:Rules;catalog:CatalogItem[];today:string;onChange:(value:Rules)=>void}){
  const [employees,setEmployees]=useState<Employee[]>([]),[employee,setEmployee]=useState<string>(),[error,setError]=useState('')
  const [open,setOpen]=useState<string[]>([])
  useEffect(()=>{
    let current=true
    request<Employee[]>('/employees').then(data=>{if(current)setEmployees(data)}).catch(e=>{if(current)setError(err(e))})
    return()=>{current=false}
  },[])
  function append(template:Template){onChange({...value,templates:[...value.templates,template]});setOpen([template.id])}
  return <Space direction="vertical" size="middle" style={{width:'100%'}}>
    {error&&<Alert type="error" message={error} showIcon/>}
    <Button onClick={()=>append({id:id(),label:'',from:today,audienceKind:'position',audience:'',active:true,items:[blankItem()]})}>افزودن الگوی شغلی</Button>
    <Collapse activeKey={open} onChange={keys=>setOpen(Array.isArray(keys)?keys:[keys])} items={value.templates.map(t=>({
      key:t.id,label:t.label||'الگوی جدید',extra:<Tag color={t.active?'green':'default'}>{t.active?'فعال':'غیرفعال'}</Tag>,
      children:<TemplateEditor item={t} catalog={catalog} update={changes=>onChange({...value,templates:value.templates.map(item=>item.id===t.id?{...item,...changes}:item)})}
        duplicate={()=>append({...t,id:id(),from:today,label:t.label+' (کپی)'})}
        remove={()=>{
          const assignments=Object.fromEntries(Object.entries(value.assignments).filter(([,template])=>template!==t.id))
          onChange({...value,assignments,templates:value.templates.filter(item=>item.id!==t.id)})
        }}/>,
    }))}/>
    <Card size="small" title="تخصیص الگو به کارمند">
      <Space wrap>
        <Select value={employee} onChange={setEmployee} showSearch optionFilterProp="label" placeholder="انتخاب کارمند" style={{minWidth:180}}
          options={employees.filter(e=>e.active).map(e=>({value:e.id,label:e.name}))}/>
        <Select disabled={!employee} value={employee?value.assignments[employee]:undefined} placeholder="الگوی سمت یا واحد" allowClear style={{minWidth:170}}
          options={value.templates.filter(t=>t.active).map(t=>({value:t.id,label:t.label}))} onChange={template=>{
            if(!employee)return
            const assignments={...value.assignments}
            if(template)assignments[employee]=template
            else delete assignments[employee]
            onChange({...value,assignments})
          }}/>
      </Space>
    </Card>
  </Space>
}
