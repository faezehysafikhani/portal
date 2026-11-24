import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Input, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PersianDatePicker from '../../components/PersianDatePicker'
import { apiFetch } from '../../utils/api'
import { dateToJalali, formatJalaliDate, jalaliToDate } from '../../utils/jalali'

const root='http://localhost:5043/api/v1/performance/insights'
const fa=(n:number)=>n.toLocaleString('fa-IR')
const duration=(m:number)=>[m>=60?`${fa(Math.floor(m/60))} ساعت`:'',m%60?`${fa(m%60)} دقیقه`:''].filter(Boolean).join(' و ')||'۰ دقیقه'
const yyyyMmDd=(d:Date)=>[d.getFullYear(),d.getMonth()+1,d.getDate()].map((v,i)=>String(v).padStart(i===0?4:2,'0')).join('-')
const day=(v:string)=>v.length===10?v:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',dateStyle:'short'}).format(new Date(v))
const now=()=>day(new Date().toISOString())
const shamsi=(v:string)=>{const j=dateToJalali(new Date(v+'T12:00:00'));return `${j.jy}/${j.jm}/${j.jd}`}
const display=(v?:string|null)=>v?formatJalaliDate(new Date(day(v)+'T12:00:00')):'—'
const timestamp=(v?:string|null)=>v?`${display(v)}، ${new Date(v).toLocaleTimeString('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit'})}`:'—'
const states:Record<string,[string,string]>={submitted:['در انتظار تأیید','blue'],approved:['تأییدشده','green'],returned:['نیازمند اصلاح','orange'],missing:['ارسال‌نشده','red']}
const taskStates:Record<string,string>={new:'جدید',active:'در حال انجام',blocked:'متوقف‌شده',review:'در انتظار بررسی',approved:'تأییدشده',returned:'نیازمند اصلاح',cancelled:'لغوشده'}
const state=(value:string)=> <Tag color={states[value]?.[1]}>{states[value]?.[0]??value}</Tag>
const errorText=(e:unknown)=>e instanceof Error?e.message:'عملیات انجام نشد'
const rate=(value:number|null)=>value===null?'فاقد داده':`${fa(value)}٪`
type Range={from:string;to:string}
interface Person {id:string;name:string;position?:string;department?:string;manager?:string;active:boolean}
interface Report {id:string|null;employee:string;employeeName:string;department?:string;date:string;status:string;draft?:boolean;late?:boolean;activities:number|null;
  minutes:number|null;projects:number|null;nonProjects:number|null;submitted?:string;canReview?:boolean;returns?:{date:string;note:string}[]}
interface Employee extends Person {workDays:number;submitted:number;approved:number;pending:number;missing:number;returned:number;activities:number;minutes:number;
  approvedMinutes:number;returnedMinutes:number;draftMinutes:number;activeTasks:number;allocated:number;finished:number;taskReturns:number;late:number;extensions:number;deliveryReturns:number;
  reportRate:number|null;approvalRate:number|null;completionRate:number|null;onTimeRate:number|null}
interface Task {id:string;title:string;due?:string;first?:string;firstDeadline?:string;approvedAt?:string;state:string;late:boolean;returns:number;extensions:number;
  feedback:{action:string;date:string;note:string}[];outputs:{id:string;name:string;created_at:string}[]}
interface Activity {id:string;title:string;kind:string;date:string;minutes:number;project?:string;task?:string;outcome?:string;description?:string;reportStatus:string}
interface Trend {date:string;activities:number;minutes:number;tasks:number}
interface TeamData {employees:Employee[];projects:{id:string;name:string}[];reports:Report[];tasks:Task[];activities?:Activity[];trends:Trend[];
  kinds:{id:string;label:string;count:number;minutes:number}[];projectMix:{project:number;other:number};canExport:boolean;canDownload:boolean}

function defaultRange(mode='week'):Range {
  const to=now()
  if(mode==='day')return {from:to,to}
  if(mode==='month'){
    const [y,m]=shamsi(to).split('/')
    return {from:yyyyMmDd(jalaliToDate(`${y}/${m}/1`)),to}
  }
  const date=new Date(to+'T12:00:00');date.setDate(date.getDate()-6)
  return {from:yyyyMmDd(date),to}
}
function RangeBar({value,onChange}:{value:Range;onChange:(range:Range)=>void}){
  return <Space wrap>
    <Select aria-label="بازه زمانی" placeholder="انتخاب سریع بازه" style={{width:151}}
      options={[{label:'امروز',value:'day'},{label:'هفت روز اخیر',value:'week'},{label:'ماه شمسی جاری',value:'month'}]}
      onChange={v=>onChange(defaultRange(v))}/>
    <span>از</span><PersianDatePicker value={shamsi(value.from)} onChange={v=>{if(v)onChange({...value,from:yyyyMmDd(jalaliToDate(v))})}}/>
    <span>تا</span><PersianDatePicker value={shamsi(value.to)} onChange={v=>{if(v)onChange({...value,to:yyyyMmDd(jalaliToDate(v))})}}/>
  </Space>
}
function useData<T>(route:string,range:Range,filters:Record<string,string|undefined>,refresh=0){
  const [data,setData]=useState<T>(),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const query=new URLSearchParams({from:range.from,to:range.to})
  Object.entries(filters).forEach(([key,value])=>{if(value)query.set(key,value)})
  const endpoint=`${root}${route}?${query}`
  useEffect(()=>{
    const abort=new AbortController()
    setLoading(true);setError('')
    apiFetch(endpoint,{signal:abort.signal}).then(async r=>{
      const data=await r.json()
      if(!r.ok)throw new Error(data.message||'دریافت اطلاعات انجام نشد')
      if(!abort.signal.aborted)setData(data)
    }).catch(e=>{if(!abort.signal.aborted){setData(undefined);setError(errorText(e))}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    return()=>abort.abort()
  },[endpoint,refresh])
  return {data,loading,error,query}
}
async function download(url:string,label:string){
  try{
    const response=await apiFetch(url)
    if(!response.ok)throw new Error((await response.json().catch(()=>({}))).message||'دریافت فایل انجام نشد')
    const href=URL.createObjectURL(await response.blob()),a=document.createElement('a')
    a.href=href;a.download=label;a.click();window.setTimeout(()=>URL.revokeObjectURL(href),1000)
  }catch(e){message.error(errorText(e))}
}
const variants=(rows:Person[],field:'department'|'position')=>[...new Set(rows.map(e=>e[field]).filter((value):value is string=>!!value))].sort().map(v=>({label:v,value:v}))
const matches=(value:string,search:string)=>value.toLocaleLowerCase('fa').includes(search.trim().toLocaleLowerCase('fa'))
const summary=(items:[string,string|number][])=> <Row gutter={[12,12]}>{items.map(([title,value])=><Col key={title} xs={12} md={8} lg={6}><Card size="small"><Statistic title={title} value={typeof value==='number'?fa(value):value}/></Card></Col>)}</Row>

export function ReportsReviewPanel({open,refresh}:{open:(id:string,decision?:'approve'|'return')=>void;refresh:number}){
  const [range,setRange]=useState(defaultRange),[employee,setEmployee]=useState<string>(),[department,setDepartment]=useState<string>()
  const [search,setSearch]=useState(''),[filter,setFilter]=useState<string>()
  const {data,loading,error}=useData<{employees:Person[];reports:Report[]}>('/queue',range,{},refresh)
  const staff=data?.employees??[]
  const reports=(data?.reports??[]).filter(r=>(!employee||r.employee===employee)&&(!department||r.department===department)&&matches(r.employeeName??'',search))
  const cards:[string,string,number][]=[
    ...(['submitted','approved','returned'] as const).map(key=>[states[key][0],key,reports.filter(r=>r.status===key).length] as [string,string,number]),
    ['کارکنان بدون گزارش', 'missing',new Set(reports.filter(r=>r.status==='missing').map(r=>r.employee)).size],
    ['ارسال با تأخیر','late',reports.filter(r=>r.late).length],
  ]
  return <Space direction="vertical" size="middle" style={{width:'100%'}}>
    {error&&<Alert type="error" showIcon message={error}/>}
    <Row gutter={[10,10]}>{cards.map(([title,key,n])=><Col key={key} xs={12} md={8} xl={4}>
      <Button block type={filter===key?'primary':'default'} onClick={()=>setFilter(value=>value===key?undefined:key)} style={{height:'auto',padding:'9px'}}>
        <Statistic title={title} value={fa(n)} loading={loading}/>
      </Button>
    </Col>)}</Row>
    <RangeBar value={range} onChange={setRange}/>
    <Space wrap>
      <Input.Search placeholder="جست‌وجوی نام کارمند" allowClear value={search} onChange={e=>setSearch(e.target.value)}/>
      <Select allowClear showSearch optionFilterProp="label" style={{width:180}} placeholder="کارمند" value={employee} onChange={setEmployee} options={staff.map(e=>({label:e.name,value:e.id}))}/>
      <Select allowClear style={{width:155}} placeholder="واحد سازمانی" value={department} onChange={setDepartment} options={variants(staff,'department')}/>
      <Select allowClear style={{width:165}} placeholder="وضعیت گزارش" value={filter} onChange={setFilter} options={cards.map(([label,value])=>({label,value}))}/>
    </Space>
    <Table rowKey={r=>r.id??r.employee+':'+r.date} size="small" loading={loading} scroll={{x:1320}} pagination={{pageSize:15}} locale={{emptyText:'گزارشی در این بازه یافت نشد'}}
      dataSource={reports.filter(r=>!filter||(filter==='late'?r.late:r.status===filter))} columns={[
        {title:'کارمند',dataIndex:'employeeName',sorter:(a,b)=>String(a.employeeName).localeCompare(String(b.employeeName),'fa')},
        {title:'واحد',dataIndex:'department',render:(value?:string)=>value||'—'},
        {title:'تاریخ',dataIndex:'date',render:display,sorter:(a,b)=>a.date.localeCompare(b.date)},
        {title:'فعالیت',dataIndex:'activities',render:(v:number|null)=>v===null?'—':fa(v),sorter:(a,b)=>(a.activities??0)-(b.activities??0)},
        {title:'زمان',dataIndex:'minutes',render:(v:number|null)=>v===null?'—':duration(v),sorter:(a,b)=>(a.minutes??0)-(b.minutes??0)},
        {title:'پروژه‌ای',dataIndex:'projects',render:(v:number|null)=>v===null?'—':fa(v)},
        {title:'غیرپروژه‌ای',dataIndex:'nonProjects',render:(v:number|null)=>v===null?'—':fa(v)},
        {title:'آخرین ارسال',dataIndex:'submitted',render:timestamp},
        {title:'وضعیت',render:(_,r)=><Space wrap>{state(r.status)}{r.late&&<Tag color="gold">با تأخیر</Tag>}{r.draft&&<Tag>پیش‌نویس</Tag>}</Space>},
        {title:'عملیات',render:(_,r)=>r.id&&<Space wrap>
          <Button size="small" onClick={()=>open(r.id!)}>جزئیات</Button>
          {r.canReview&&<><Button size="small" type="primary" onClick={()=>open(r.id!,'approve')}>تأیید</Button><Button size="small" onClick={()=>open(r.id!,'return')}>برگشت</Button></>}
        </Space>},
      ]}/>
  </Space>
}
export default function PerformanceInsightsPage(){
  const [range,setRange]=useState(defaultRange),[department,setDepartment]=useState<string>(),[position,setPosition]=useState<string>(),[project,setProject]=useState<string>()
  const [search,setSearch]=useState(''),[person,setPerson]=useState<Employee>()
  const [knownStaff,setKnownStaff]=useState<Employee[]>([]),[knownProjects,setKnownProjects]=useState<TeamData['projects']>([])
  const filters={department,position,project}
  const {data,loading,error,query}=useData<TeamData>('/team',range,filters)
  useEffect(()=>{
    if(data&&!department&&!position)setKnownStaff(data.employees)
    if(data&&!department&&!position&&!project)setKnownProjects(data.projects)
  },[data,department,position,project])
  const rows=data?.employees??[]
  const sums=(field:keyof Employee)=>rows.reduce((n,e)=>n+Number(e[field]??0),0)
  const marked=(data?.reports??[]).filter(r=>r.late||r.status==='missing'||r.returns?.length)
  const [weekly,setWeekly]=useState(false)
  const trends=aggregateTrends(data?.trends??[],weekly)
  return <div dir="rtl"><Card title="عملکرد کارکنان" extra={data?.canExport&&<Button onClick={()=>void download(`${root}/export?${query}`,'گزارش-عملکرد.xlsx')}>خروجی Excel</Button>}>
    <Space direction="vertical" size="middle" style={{width:'100%'}}>
      {error&&<Alert type="error" showIcon message={error}/>}
      <RangeBar value={range} onChange={setRange}/>
      <Space wrap>
        <Select allowClear placeholder="واحد سازمانی" style={{width:155}} value={department} onChange={setDepartment} options={variants(knownStaff,'department')}/>
        <Select allowClear placeholder="سمت سازمانی" style={{width:155}} value={position} onChange={setPosition} options={variants(knownStaff,'position')}/>
        <Select allowClear placeholder="پروژه" style={{width:200}} value={project} onChange={setProject} options={[{label:'فعالیت غیرپروژه‌ای',value:'none'},...knownProjects.map(p=>({label:p.name,value:p.id}))]}/>
      </Space>
      {loading?<Card loading/>:<Tabs items={[
        {key:'overview',label:'نمای کلی تیم',children:summary([
          ['کارکنان',rows.length],['زمان فعالیت',duration(sums('minutes'))],['وظایف فعال',sums('activeTasks')],
          ['وظایف تأییدشده',sums('finished')],['وظایف با تأخیر',sums('late')],['گزارش تأییدشده',sums('approved')],['در انتظار بررسی',sums('pending')],
          ['زمان تأییدشده',duration(sums('approvedMinutes'))],['زمان نیازمند اصلاح',duration(sums('returnedMinutes'))],['زمان پیش‌نویس',duration(sums('draftMinutes'))],
        ])},
        {key:'people',label:'عملکرد فردی کارکنان',children:<>
          <Input.Search placeholder="نام کارمند" allowClear onChange={e=>setSearch(e.target.value)} value={search} style={{width:220,marginBottom:10}}/>
          <Table rowKey="id" dataSource={rows.filter(e=>matches(e.name,search))} scroll={{x:1450}} pagination={{pageSize:12}} columns={[
            {title:'کارمند',render:(_,e)=><Button type="link" onClick={()=>setPerson(e)}>{e.name}</Button>,sorter:(a,b)=>a.name.localeCompare(b.name,'fa')},
            {title:'سمت',dataIndex:'position'},{title:'واحد',dataIndex:'department'},
            ...(['workDays','submitted','approved','activities','finished','late','taskReturns'] as const).map((key,i)=>({
              title:['روز کاری','ارسال‌شده','تأییدشده','فعالیت','وظیفه تکمیل','معوق','وظیفه نیازمند اصلاح'][i],dataIndex:key,render:fa,
              sorter:(a:Employee,b:Employee)=>a[key]-b[key],
            })),
            {title:'زمان',dataIndex:'minutes',render:duration},{title:'گزارش‌دهی',dataIndex:'reportRate',render:rate},
          ]}/>
        </>},
        {key:'analysis',label:'گزارش‌های تحلیلی',children:<Space direction="vertical" size="middle" style={{width:'100%'}}>
          <Card size="small" title="روند فعالیت و تکمیل وظایف" extra={<Select value={weekly?'week':'day'} onChange={v=>setWeekly(v==='week')} options={[{label:'روزانه',value:'day'},{label:'هفتگی',value:'week'}]}/>}>
            <div style={{height:250,direction:'ltr'}}>
              <ResponsiveContainer width="100%" height="100%"><LineChart data={trends.map(t=>({...t,caption:shamsi(t.date)}))}>
                <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="caption"/><YAxis allowDecimals={false}/><Tooltip/><Legend/>
                <Line dataKey="activities" name="فعالیت" stroke="#8b1a6b" dot={false}/><Line dataKey="tasks" name="وظیفه تأییدشده" stroke="#1677ff" dot={false}/>
              </LineChart></ResponsiveContainer>
            </div>
          </Card>
          {summary([['فعالیت پروژه‌ای',data?.projectMix.project??0],['فعالیت غیرپروژه‌ای',data?.projectMix.other??0]])}
          <Table size="small" rowKey="id" dataSource={data?.kinds??[]} columns={[{title:'نوع فعالیت',dataIndex:'label'},{title:'تعداد',dataIndex:'count',render:fa},{title:'زمان',dataIndex:'minutes',render:duration}]}/>
          <Card size="small" title="گزارش‌های ارسال‌نشده، دیرهنگام یا برگشتی">
            <Table size="small" rowKey={r=>r.id??r.employee+r.date} dataSource={marked} scroll={{x:650}} columns={[
              {title:'کارمند',dataIndex:'employeeName'},{title:'تاریخ',dataIndex:'date',render:display},
              {title:'وضعیت',render:(_,r)=><Space wrap>{state(r.status)}{r.late&&<Tag color="gold">با تأخیر</Tag>}</Space>},
              {title:'بازخورد مدیر',render:(_,r)=>r.returns?.map(a=>a.note).filter(Boolean).join('، ')||'—'},
            ]}/>
          </Card>
          <TaskTable tasks={(data?.tasks??[]).filter(t=>t.late||t.returns||t.extensions)}/>
        </Space>},
      ]}/>}
    </Space>
  </Card>
  {person&&<EmployeeProfile person={person} range={range} project={project} close={()=>setPerson(undefined)}/>}
  </div>
}
function aggregateTrends(days:Trend[],weekly:boolean):Trend[]{
  if(!weekly)return days
  const weeks=new Map<string,Trend>()
  for(const item of days){
    const date=new Date(item.date+'T12:00:00');date.setDate(date.getDate()-(date.getDay()+1)%7)
    const key=yyyyMmDd(date)
    const w=weeks.get(key)??{date:key,activities:0,minutes:0,tasks:0}
    w.activities+=item.activities;w.minutes+=item.minutes;w.tasks+=item.tasks;weeks.set(key,w)
  }
  return [...weeks.values()]
}
function TaskTable({tasks,downloadFiles=false}:{tasks:Task[];downloadFiles?:boolean}){
  return <Table rowKey="id" size="small" scroll={{x:900}} dataSource={tasks}
    expandable={{rowExpandable:t=>!!t.feedback.length,expandedRowRender:t=><Space direction="vertical">
      {t.feedback.map(f=><span key={f.action+f.date}>{f.action==='assignment_submit'?'شرح تحویل':'بازخورد اصلاح'} · {timestamp(f.date)} · {f.note}</span>)}
    </Space>}} columns={[
    {title:'وظیفه',dataIndex:'title'},{title:'وضعیت',render:(_,t)=><Space wrap>{taskStates[t.state]??t.state}{t.late&&<Tag color="red">با تأخیر</Tag>}</Space>},
    {title:'مهلت',dataIndex:'due',render:timestamp},{title:'اولین تحویل',dataIndex:'first',render:timestamp},
    {title:'برگشت',dataIndex:'returns',render:fa},{title:'تمدید',dataIndex:'extensions',render:fa},
    ...(downloadFiles?[{title:'خروجی',render:(_:unknown,t:Task)=><Space wrap>{t.outputs.map(f=><Button key={f.id} type="link"
      onClick={()=>void download(`${root}/task-files/${f.id}`,f.name)}>{f.name}</Button>)}</Space>}]:[]),
  ]}/>
}
function EmployeeProfile({person,range,project,close}:{person:Employee;range:Range;project?:string;close:()=>void}){
  const navigate=useNavigate()
  const {data,loading,error}=useData<TeamData>('/person',range,{employee:person.id,project})
  const e=data?.employees[0]
  return <Modal open title={person.name} width={1080} footer={null} onCancel={close} loading={loading}>
    {error&&<Alert type="error" showIcon message={error}/>}
    {data&&e&&<Space direction="vertical" size="middle" style={{width:'100%'}} dir="rtl">
      <Descriptions items={[{key:'position',label:'سمت',children:e.position||'—'},{key:'department',label:'واحد',children:e.department||'—'},
        {key:'manager',label:'مدیر مستقیم',children:e.manager||'—'}]}/>
      {summary([['تعداد فعالیت',e.activities],['زمان',duration(e.minutes)],['وظایف محول‌شده',e.allocated],['وظایف تأییدشده',e.finished],
        ['وظایف فعال',e.activeTasks],['وظایف با تأخیر',e.late],['گزارش تأییدشده',e.approved],['ارسال‌نشده',e.missing],
        ['نرخ ارسال',rate(e.reportRate)],['نرخ تأیید',rate(e.approvalRate)],['نرخ تکمیل',rate(e.completionRate)],['نرخ تحویل به‌موقع',rate(e.onTimeRate)]])}
      <Alert type="info" showIcon message="نرخ تکمیل بر اساس وظایف دارای موعد در بازه است. نرخ به‌موقع بر اساس اولین تحویل و مهلت معتبر هنگام آن محاسبه می‌شود."/>
      <Tabs items={[
        {key:'act',label:'فعالیت‌ها',children:<Table rowKey="id" scroll={{x:800}} dataSource={data.activities??[]} columns={[
          {title:'عنوان',dataIndex:'title'},{title:'روز',dataIndex:'date',render:display},
          {title:'دسته',render:(_,a)=>data.kinds.find(k=>k.id===a.kind)?.label??a.kind},
          {title:'پروژه',dataIndex:'project',render:(v?:string)=>v||'فعالیت غیرپروژه‌ای'},
          {title:'وظیفه',dataIndex:'task'},{title:'خروجی',dataIndex:'outcome'},{title:'زمان',dataIndex:'minutes',render:duration},
          {title:'وضعیت گزارش',dataIndex:'reportStatus',render:state}]} />},
        {key:'reports',label:'گزارش‌ها و بازخورد',children:<Table rowKey={r=>r.id??r.date} dataSource={data.reports} columns={[
          {title:'روز',dataIndex:'date',render:display},{title:'وضعیت',dataIndex:'status',render:state},
          {title:'بازخورد',render:(_,r)=>r.returns?.map(h=>h.note).filter(Boolean).join('، ')||'—'},
          {title:'مستندات و تاریخچه',render:(_,r)=>r.id&&<Button type="link" onClick={()=>navigate(`/performance/review?report=${r.id}`)}>مشاهده گزارش</Button>},
        ]}/>},
        {key:'tasks',label:'وظایف و تحویل‌ها',children:<TaskTable tasks={data.tasks} downloadFiles={data.canDownload}/>},
      ]}/>
    </Space>}
  </Modal>
}
