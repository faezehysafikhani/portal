import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useLocation, useNavigate } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EvaluationDialog, { PlanCard } from './EvaluationDialog'
import { displayDate, download, err, fa, faScore, labels, request } from './periodic-model'
import type { Employee, Evaluation, Mine, Organization, Queue } from './periodic-model'

function useLoad<T>(path:string,revision=0) {
  const [data,setData]=useState<T>(),[loading,setLoading]=useState(true),[error,setError]=useState('')
  useEffect(()=>{
    let current=true
    setLoading(true);setError('')
    request<T>(path).then(value=>{if(current)setData(value)})
      .catch(e=>{if(current)setError(err(e))}).finally(()=>{if(current)setLoading(false)})
    return()=>{current=false}
  },[path,revision])
  return {data,loading,error}
}
const state=(value:string)=><Tag color={['published','achieved'].includes(value)?'green':value==='revision'?'orange':'blue'}>{labels[value]??value}</Tag>
function columns(open:(id:string)=>void,showPerson=true,showState=true):ColumnsType<Evaluation>{
  return [
    ...(showPerson?[{title:'کارمند',dataIndex:'name'},{title:'سمت',dataIndex:'position'},{title:'واحد',dataIndex:'department'}]:[]),
    {title:'دوره',key:'period',render:(_,row)=>row.period.label},
    {title:'الگو',dataIndex:'template'},
    ...(showState?[{title:'وضعیت',key:'state',render:(_:unknown,row:Evaluation)=><>{state(row.state)}{row.pendingAppeal&&<Tag color="gold">بازبینی</Tag>}</>}]:[]),
    {title:'امتیاز از ۱۰۰',dataIndex:'score',render:faScore},{title:'سطح',dataIndex:'band',render:value=>value||'—'},
    {title:'انتشار',dataIndex:'published',render:displayDate},
    {title:'عملیات',key:'open',render:(_,row)=><Button size="small" onClick={()=>open(row.id)}>مشاهده</Button>},
  ]
}
const staffOptions=(staff:Employee[])=>staff.map(p=>({value:p.id,label:p.name}))
const countCard=(label:string,value:number|null)=><Col key={label} xs={12} lg={6}><Card size="small"><Statistic title={label} value={value==null?'—':fa(value)}/></Card></Col>
const colors=['#89186c','#1677ff','#389e0d','#d46b08','#722ed1']
function ScoreTrend({results}:{results:Evaluation[]}){
  const published=results.filter(r=>r.published&&r.score!=null&&['published','closed'].includes(r.state))
    .sort((a,b)=>a.period.to.localeCompare(b.period.to))
  if(published.length<2)return null
  const versions=[...new Map(published.map(r=>[r.templateKey,r.template]))]
  const data=published.map(r=>({period:r.period.label,[r.templateKey]:r.score}))
  return <Card size="small" title="روند امتیاز دوره‌ها">
    {versions.length>1&&<p>رنگ و شمارهٔ سری، نسخهٔ الگوی امتیازدهی هر دوره را نشان می‌دهد.</p>}
    <Space wrap>{versions.map(([key,label],i)=><Tag key={key} color={colors[i%colors.length]}>{label} · نسخه {fa(i+1)}</Tag>)}</Space>
    <div style={{height:200,direction:'ltr'}}><ResponsiveContainer width="100%" height="100%"><LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="period"/><YAxis domain={[0,100]} tickFormatter={fa}/><Tooltip formatter={value=>faScore(Number(value))}/>
      {versions.map(([key,label],i)=><Line key={key} dataKey={key} name={label+' · نسخه '+fa(i+1)} stroke={colors[i%colors.length]} strokeWidth={2}/>)}
    </LineChart></ResponsiveContainer></div>
  </Card>
}

export function EvaluationQueue({embedded=false,employee}:{embedded?:boolean;employee?:string}){
  const location=useLocation(),navigate=useNavigate()
  const link=new URLSearchParams(location.search)
  const [period,setPeriod]=useState<string|undefined>(embedded?undefined:link.get('period')??undefined),[filter,setFilter]=useState<string>()
  const [search,setSearch]=useState(''),[person,setPerson]=useState<string>(),[error,setError]=useState(''),[creating,setCreating]=useState(false)
  const [touch,setTouch]=useState(0),[id,setId]=useState<string>()
  const params=new URLSearchParams()
  if(employee)params.set('employee',employee)
  const {data,error:loadError,loading}=useLoad<Queue>('?'+params,touch)
  const rowPeriod=data?.periods.find(p=>p.id===period)
  useEffect(()=>{
    if(embedded)return
    const next=new URLSearchParams(location.search)
    const evaluation=next.get('evaluation'),requestedPeriod=next.get('period')
    if(requestedPeriod)setPeriod(requestedPeriod)
    if(evaluation)setId(evaluation)
  },[location.search,embedded])
  function close(){
    setId(undefined)
    if(embedded||!link.has('evaluation'))return
    link.delete('evaluation');navigate({search:link.toString()},{replace:true})
  }
  const available=(data?.staff??[]).filter(e=>e.canWrite&&(!employee||e.id===employee)&&!data?.rows.some(r=>r.period.id===period&&r.employee===e.id))
  const rows=(data?.rows??[]).filter(r=>(!period||r.period.id===period)&&(!filter||(filter==='appeal'?r.pendingAppeal:r.state===filter))
    && [r.name,r.position,r.department,r.period.label].join(' ').includes(search.trim()))
  async function create(){
    if(!person||!period)return
    setCreating(true);setError('')
    try{const result=await request<{id:string}>('','POST',{period,employee:person});setId(result.id);setTouch(n=>n+1);setPerson(undefined)}
    catch(e){setError(err(e))}finally{setCreating(false)}
  }
  return <Space direction="vertical" size="middle" style={{width:'100%'}} dir="rtl">
    {(error||loadError)&&<Alert type="error" message={error||loadError} showIcon/>}
    {data&&!data.enabled&&<Alert type="warning" message="ارزیابی دوره‌ای در تنظیمات غیرفعال است."/>}
    {data&&data.periods.length===0&&<Alert type="info" message="هنوز دوره‌ای تعریف نشده است. دوره از تنظیمات ارزیابی عملکرد فعال می‌شود."/>}
    <Space wrap>
      <Select value={period} onChange={value=>{setPeriod(value);setPerson(undefined)}} allowClear placeholder="همه دوره‌ها" style={{minWidth:160}}
        options={data?.periods.map(p=>({value:p.id,label:p.label}))}/>
      <Select value={filter} onChange={setFilter} allowClear placeholder="همه وضعیت‌ها" style={{minWidth:170}}
        options={[...['draft','pending','revision','finalized','published','closed'].map(value=>({value,label:labels[value]})),{value:'appeal',label:'بازبینی در انتظار رسیدگی'}]}/>
      {!employee&&<Input.Search allowClear placeholder="جست‌وجوی کارمند یا دوره" value={search} onChange={e=>setSearch(e.target.value)}/>}
    </Space>
    {rowPeriod?.status==='open'&&data?.enabled&&available.length>0&&<Space wrap>
      <Select value={person} onChange={setPerson} showSearch optionFilterProp="label" placeholder="انتخاب کارمند زیرمجموعه" style={{minWidth:220}} options={staffOptions(available)}/>
      <Button type="primary" disabled={!person} loading={creating} onClick={()=>void create()}>ایجاد پیش‌نویس ارزیابی</Button>
      {rowPeriod.managerDue&&<Tag>مهلت مدیر {displayDate(rowPeriod.managerDue)}</Tag>}
    </Space>}
    {employee&&<ScoreTrend results={data?.rows??[]}/>}
    <Table rowKey="id" scroll={{x:employee?680:1000}} loading={loading} columns={columns(setId,!employee)} dataSource={rows}
      locale={{emptyText:'ارزیابی‌ای با این فیلترها پیدا نشد'}}/>
    <EvaluationDialog id={id} close={close} updated={()=>setTouch(n=>n+1)}/>
  </Space>
}
export default function PeriodicEvaluationPage(){
  return <Card title="ارزیابی دوره‌ای کارکنان"><EvaluationQueue/></Card>
}
export function TeamEvaluationOverview(){
  const {data,loading,error}=useLoad<Queue>('?overview=1')
  const overview=data?.overview
  if(loading)return <Card loading size="small"/>
  if(error)return <Alert type="error" showIcon message={error}/>
  if(!overview||!data.staff.length)return null
  return <Card title={'ارزیابی زیرمجموعه · '+overview.period} size="small">
    <Row gutter={[12,12]}>{[countCard('کارکنان مشمول',data.staff.length),countCard('ارزیابی تکمیل‌شده',overview.completed),
      countCard('ارزیابی تکمیل‌نشده',overview.outstanding),countCard('برنامه بهبود فعال',overview.activePlans)]}</Row>
    {overview.groups.length>0&&<Table size="small" rowKey="id" pagination={false} dataSource={overview.groups} columns={[
      {title:'الگوی شغلی',dataIndex:'name'},{title:'تعداد ارزیابی',dataIndex:'count',render:fa},
      {title:'میانگین ارزیابی‌های هم‌الگو',dataIndex:'average',render:faScore},
    ]}/>}
  </Card>
}
export function EmployeeEvaluationPanel({improvement=false}:{improvement?:boolean}){
  const location=useLocation(),navigate=useNavigate()
  const [revision,setRevision]=useState(0),[id,setId]=useState<string>()
  const [period,setPeriod]=useState<string>()
  const {data,error,loading}=useLoad<Mine>('/mine',revision)
  useEffect(()=>{
    setId(new URLSearchParams(location.search).get('evaluation')??undefined)
  },[location.search])
  function close(){
    setId(undefined)
    const params=new URLSearchParams(location.search)
    if(!params.has('evaluation'))return
    params.set('tab',improvement?'improvement':'periodic')
    params.delete('evaluation')
    navigate({search:params.toString()},{replace:true})
  }
  return <Space direction="vertical" size="middle" style={{width:'100%'}}>
    {error&&<Alert type="error" showIcon message={error}/>}
    {improvement?<>{loading&&<Card loading/>}
      {!loading&&!data?.plans.length&&<p>هنوز برنامه بهبودی ثبت نشده است.</p>}
      {data?.plans.map(p=><PlanCard key={p.id} plan={p}><Button size="small" onClick={()=>setId(p.evaluation_id)}>مشاهده و ثبت پیشرفت</Button></PlanCard>)}</>:
      <>
        <Select allowClear placeholder="همه دوره‌ها" style={{minWidth:170}} value={period} onChange={setPeriod}
          options={data?.results.map(r=>({value:r.period.id,label:r.period.label}))}/>
        <ScoreTrend results={data?.results??[]}/>
        <Table rowKey="id" loading={loading} scroll={{x:700}} dataSource={(data?.results??[]).filter(r=>!period||r.period.id===period)} columns={columns(setId,false)}
          locale={{emptyText:'هنوز نتیجه‌ای برای شما منتشر نشده است'}}/>
      </>}
    <EvaluationDialog id={id} close={close} updated={()=>setRevision(n=>n+1)} initialTab={improvement?'improvement':undefined}/>
  </Space>
}
export function PublishedEvaluationSummary(){
  const {data}=useLoad<Mine>('/mine'),navigate=useNavigate()
  const result=data?.results.slice().sort((a,b)=>a.period.to.localeCompare(b.period.to)).at(-1)
  if(!result)return null
  return <Card size="small" title="آخرین ارزیابی منتشرشده">
    <Space wrap size="middle"><span>{result.period.label}</span><strong>{faScore(result.score)} از ۱۰۰</strong>{result.band&&<Tag color="purple">{result.band}</Tag>}
      <Button size="small" onClick={()=>navigate('/performance/reports?evaluation='+result.id)}>مشاهده نتیجه</Button></Space>
  </Card>
}
function printReport(data:Organization){
  const page=window.open('','_blank')
  if(!page){message.error('باز کردن پنجره چاپ ممکن نشد');return}
  page.opener=null
  page.document.documentElement.lang='fa';page.document.documentElement.dir='rtl'
  page.document.title='گزارش ارزیابی عملکرد'
  const style=page.document.createElement('style')
  style.textContent='body{font:14px Tahoma,Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{padding:7px;border:1px solid #aaa;text-align:right}thead{display:table-header-group}tr{break-inside:avoid}@page{size:landscape}'
  page.document.head.append(style)
  const heading=page.document.createElement('h1');heading.textContent=data.company+' · گزارش ارزیابی عملکرد'
  const filters=page.document.createElement('p');filters.textContent='دوره '+data.filters.period+' | واحد '+data.filters.department+' | الگو '+data.filters.template+' | '+data.filters.employee
  const meta=page.document.createElement('p');meta.textContent='تاریخ تولید '+displayDate(data.generatedAt)+' | تعداد نتایج '+fa(data.reports.length)+' | برنامه بهبود فعال '+fa(data.activePlans)
  const table=page.document.createElement('table'),header=table.createTHead().insertRow()
  for(const label of ['کارمند','سمت','واحد','دوره','الگو','امتیاز','سطح','نقاط قوت','پیشنهاد بهبود']){
    const cell=page.document.createElement('th');cell.textContent=label;header.append(cell)
  }
  const body=table.createTBody()
  for(const report of data.reports){
    const row=body.insertRow()
    for(const value of [report.name,report.position,report.department,report.period.label,report.template,fa(report.score),report.band,report.data.feedback?.strengths,report.data.feedback?.suggestions]){
      row.insertCell().textContent=value||'—'
    }
  }
  page.document.body.append(heading,filters,meta,table)
  page.focus();page.print()
}
export function OrganizationEvaluationReportsPage(){
  const [period,setPeriod]=useState<string>(),[department,setDepartment]=useState<string>(),[template,setTemplate]=useState<string>(),[employee,setEmployee]=useState<string>()
  const [id,setId]=useState<string>()
  const filters=new URLSearchParams()
  for(const [key,value] of Object.entries({period,department,template,employee}))if(value)filters.set(key,value)
  const query=filters.toString(),{data,loading,error}=useLoad<Organization>('/organization?'+query)
  const byUnit=new Map<string,number>()
  const byTemplate=new Map<string,{label:string;count:number;period:string;band:string;scores:number[]}>()
  for(const report of data?.reports??[]){
    const unit=report.department||'بدون واحد'
    byUnit.set(unit,(byUnit.get(unit)??0)+1)
    const group=[report.period.id,report.templateKey,report.band].join('|')
    const bandRow=byTemplate.get(group)??{label:report.template,count:0,period:report.period.label,band:report.band??'—',scores:[]}
    bandRow.count++;if(report.score!=null)bandRow.scores.push(report.score);byTemplate.set(group,bandRow)
  }
  const mean=(values:number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null
  return <Card title="گزارش‌های مدیریتی و سازمانی" dir="rtl"><Space direction="vertical" size="middle" style={{width:'100%'}}>
    {error&&<Alert type="error" showIcon message={error}/>}
    <Space wrap>
      <Select allowClear value={period} onChange={setPeriod} placeholder="همه دوره‌ها" style={{minWidth:150}} options={data?.periods.map(p=>({value:p.id,label:p.label}))}/>
      <Select allowClear value={department} onChange={value=>{setDepartment(value);setEmployee(undefined)}} placeholder="همه واحدها" style={{minWidth:150}}
        options={[...new Set((data?.employees??[]).map(e=>e.department).filter(Boolean))].map(value=>({value,label:value}))}/>
      <Select allowClear value={template} onChange={setTemplate} placeholder="همه الگوها" style={{minWidth:150}}
        options={(data?.templates??[]).map(value=>({value,label:value}))}/>
      <Select showSearch optionFilterProp="label" allowClear value={employee} onChange={setEmployee} placeholder="همه کارکنان" style={{minWidth:180}}
        options={staffOptions((data?.employees??[]).filter(e=>!department||department===e.department))}/>
      {data?.canExport&&<><Button disabled={loading} onClick={()=>void download('/export?'+query,'گزارش-ارزیابی-عملکرد.xlsx').catch(e=>message.error(err(e)))}>خروجی اکسل</Button>
        <Button disabled={loading} onClick={()=>printReport(data)}>چاپ و ذخیره PDF</Button></>}
    </Space>
    {data&&<>
      <Row gutter={[12,12]}>{[countCard('نتایج منتشرشده',data.reports.length),countCard('کارکنان مشمول دوره',data.expected),
        countCard('در انتظار ثبت یا انتشار',data.outstanding),countCard('برنامه بهبود فعال',data.activePlans)]}</Row>
      <Table size="small" pagination={false} rowKey="unit" dataSource={[...byUnit].map(([unit,count])=>({unit,count}))}
        columns={[{title:'واحد سازمانی',dataIndex:'unit'},{title:'تعداد نتایج منتشرشده',dataIndex:'count',render:fa}]}/>
      <Table size="small" rowKey="key" dataSource={[...byTemplate].map(([key,value])=>({key,...value}))}
        columns={[{title:'دوره',dataIndex:'period'},{title:'الگو',dataIndex:'label'},{title:'سطح عملکرد',dataIndex:'band'},
          {title:'تعداد',dataIndex:'count',render:fa},{title:'میانگین در گروه هم‌الگو',render:(_,row)=>faScore(mean(row.scores))}]}/>
      {employee&&<ScoreTrend results={data.reports}/>}
      <Card title="وظایف، فعالیت‌ها و گزارش‌های روزانه" size="small"><Table rowKey="id" scroll={{x:1100}} dataSource={data.reports} columns={[
        {title:'کارمند',dataIndex:'name'},{title:'دوره',render:(_,r)=>r.period.label},
        ...Object.entries({allocated:'وظیفه محول',finished:'وظیفه تکمیل',late:'وظیفه معوق',minutes:'مجموع دقیقه',
          projectCount:'فعالیت پروژه‌ای',nonProjectCount:'فعالیت غیرپروژه‌ای',submitted:'گزارش ارسالی',approved:'گزارش تأییدشده'})
          .map(([key,title])=>({title,render:(_:unknown,r:Organization['reports'][number])=>fa(r.data.metrics[key])})),
      ]}/></Card>
    </>}
    <Table rowKey="id" scroll={{x:1050}} loading={loading} dataSource={data?.reports??[]} columns={columns(setId,true,false)}/>
    <EvaluationDialog id={id} close={()=>setId(undefined)}/>
  </Space></Card>
}
