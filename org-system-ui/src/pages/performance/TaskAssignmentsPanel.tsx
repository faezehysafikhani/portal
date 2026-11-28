import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Collapse, Descriptions, Empty, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Spin, Statistic, Table, Tag, Timeline, TimePicker, message } from 'antd'
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import PersianDatePicker from '../../components/PersianDatePicker'
import { apiFetch } from '../../utils/api'
import { dateToJalali, formatJalaliDate, jalaliToDate } from '../../utils/jalali'

const API='http://localhost:5043/api/v1/performance/assignments'
const phases: Record<string,[string,string]> = {new:['جدید','default'],active:['در حال انجام','blue'],blocked:['متوقف‌شده','red'],
  review:['در انتظار بررسی','orange'],approved:['تکمیل و تأییدشده','green'],returned:['نیازمند اصلاح','volcano'],cancelled:['لغوشده','default']}
const priorities=['کم','متوسط','زیاد','فوری']
const names: Record<string,string> = {create:'واگذاری وظیفه',edit:'ویرایش مشخصات',start:'شروع کار',progress:'ثبت پیشرفت',block:'اعلام مانع',
  submit:'تحویل خروجی',extend:'درخواست تمدید',extend_approve:'تأیید تمدید',extend_reject:'رد تمدید',
  approve:'تأیید نهایی',return:'برگشت برای اصلاح',cancel:'لغو وظیفه',comment:'توضیح مدیر'}
const auditFields: Record<string,string> = {Title:'عنوان',Description:'شرح',Priority:'اولویت',Progress:'پیشرفت',DueDate:'مهلت',StartDate:'شروع',
  ProjectId:'پروژه',AssignmentState:'وضعیت',AssignmentOutcome:'خروجی مورد انتظار',AssignmentNotes:'توضیحات',AssignmentDueHasTime:'مهلت با ساعت'}
const fa=(n:number)=>n.toLocaleString('fa-IR')
const duration=(n:number)=>[n>=60?`${fa(Math.floor(n/60))} ساعت`:'',n%60?`${fa(n%60)} دقیقه`:''].filter(Boolean).join(' و ')||'۰ دقیقه'
const displayDate=(value?:string)=>value?formatJalaliDate(new Date(calendarDay(value)+'T12:00:00')):'—'
const displayTime=(value?:string)=>value?new Date(value).toLocaleTimeString('fa-IR',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit'}):''
const displayMoment=(value?:string)=>value?`${displayDate(value)}، ${displayTime(value)}`:'—'
const errorText=(e:unknown)=>e instanceof Error?e.message:'عملیات انجام نشد'
const stateTag=(state:string)=><Tag color={phases[state]?.[1]}>{phases[state]?.[0]??state}</Tag>
const phaseOpen=(state:string)=>['new','active','blocked','returned'].includes(state)
const toOptions=(object:Record<string,[string,string]>)=>Object.entries(object).map(([value,[label]])=>({value,label}))
const priorityOptions=priorities.map((label,value)=>({label,value}))
const calendarDay=(value:string)=>/^\d{4}-\d\d-\d\d$/.test(value)?value:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',dateStyle:'short'}).format(new Date(value))
function toShamsi(value:string) {
  const j=dateToJalali(new Date(calendarDay(value)+'T12:00:00'))
  return `${j.jy}/${j.jm}/${j.jd}`
}
function gregorian(value:string) {
  const d=jalaliToDate(value)
  return [d.getFullYear(),d.getMonth()+1,d.getDate()].map((v,i)=>String(v).padStart(i?2:4,'0')).join('-')
}
const dateTime=(date:string,time?:Dayjs,start=false)=>`${gregorian(date)}T${time?time.format('HH:mm:ss'):start?'00:00:00':'23:59:59'}+03:30`
const today=()=>toShamsi(new Date().toISOString())
function clock(value:string) {
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))
  const [hour,minute]=time.split(':').map(Number)
  return dayjs().hour(hour).minute(minute).second(0)
}
interface Attachment {id:string;name:string;event_id?:string}
interface Extension {oldDue:string;dueAt:string;requestedAt:string;note:string;dueHasTime:boolean}
interface Audit {id:string;action:string;date:string;actor?:string;details:{note?:string;before?:Record<string,unknown>;after?:Record<string,unknown>;request?:Extension;dueAt?:string;oldDue?:string}}
interface Task {
  Id:string;Title:string;Description:string;AssignmentState:string;AssignmentOutcome:string;AssignmentNotes?:string;AssignmentSeenAt?:string;
  AssignmentDueHasTime:boolean;AssignmentExtension?:Extension;AssignedToUserId:string;ProjectId?:string;CreatedAt:string;StartDate:string;DueDate:string;
  Priority:number;Progress:number;CompletionRequestedAt?:string;CompletionApprovedAt?:string;employeeName?:string;managerName?:string;
  projectName?:string;minutes:number;late:boolean;manage?:boolean;own?:boolean;files?:Attachment[];events?:Audit[];
  activities?:{id:string;title:string;date:string;description:string;outcome?:string;minutes:number;files:Attachment[]}[];
}
interface Options {employees:{id:string;name:string;position?:string}[];projects:{id:string;name:string}[]}
interface Fields {title:string;description:string;employeeId:string;projectId?:string;start:string;due:string;dueTime?:Dayjs;priority:number;outcome:string;notes?:string}
interface ActionFields {note?:string;progress?:number;due?:string;dueTime?:Dayjs}
const emptyOptions:Options={employees:[],projects:[]}
async function call<T>(path='',method='GET',input?:unknown):Promise<T> {
  const response=await apiFetch(API+path,{method,headers:input?{'Content-Type':'application/json'}:undefined,body:input?JSON.stringify(input):undefined})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data.message || 'ارتباط با بخش وظایف برقرار نشد')
  return data
}
const encodeFiles=(files:File[])=>Promise.all(files.map(file=>new Promise<{name:string;content:string}>((resolve,reject)=>{
  const reader=new FileReader()
  reader.onerror=()=>reject(new Error('خواندن فایل انجام نشد'))
  reader.onload=()=>resolve({name:file.name,content:String(reader.result).split(',')[1]})
  reader.readAsDataURL(file)
})))
function FileInput({onChange}:{onChange:(files:File[])=>void}) {
  return <Form.Item label="پیوست‌ها" extra="تا ۵ فایل PDF، PNG، JPEG یا TXT، هر فایل حداکثر ۱ مگابایت">
    <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={event=>{
      const files=Array.from(event.target.files??[])
      if(files.length>5||files.some(file=>!file.size||file.size>1048576)){
        message.error('تعداد یا حجم فایل‌ها بیش از حد مجاز است');event.target.value='';onChange([]);return
      }
      onChange(files)
    }}/>
  </Form.Item>
}
function changeValue(key:string,value:unknown) {
  if(value==null||value==='')return '—'
  if(key==='Priority')return priorities[Number(value)]??String(value)
  if(key==='AssignmentState')return phases[String(value)]?.[0]??String(value)
  if(key==='DueDate'||key==='StartDate')return displayMoment(String(value))
  if(typeof value==='number')return fa(value)
  if(typeof value==='boolean')return value?'بله':'خیر'
  return String(value)
}
const taskLink=(taskId:string)=>`/performance/me?task=${encodeURIComponent(taskId)}`

export default function TaskAssignmentsPanel({manager=false}:{manager?:boolean}) {
  const navigate=useNavigate()
  const [params,setParams]=useSearchParams()
  const taskId=params.get('task')
  const [rows,setRows]=useState<Task[]>([])
  const [options,setOptions]=useState<Options>(emptyOptions)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [refresh,setRefresh]=useState(0)
  const [detail,setDetail]=useState<Task>()
  const [detailLoading,setDetailLoading]=useState(false)
  const [editing,setEditing]=useState<{id:string;existing?:Task}>()
  const [action,setAction]=useState<string>()
  const [files,setFiles]=useState<File[]>([])
  const [busy,setBusy]=useState(false)
  const [search,setSearch]=useState('')
  const [employee,setEmployee]=useState<string>()
  const [status,setStatus]=useState<string>()
  const [priority,setPriority]=useState<number>()
  const [preset,setPreset]=useState<string>()
  const [from,setFrom]=useState<string>()
  const [to,setTo]=useState<string>()
  const [form]=Form.useForm<Fields>()
  const [actions]=Form.useForm<ActionFields>()
  const reload=()=>setRefresh(n=>n+1)
  const open=(id:string)=>setParams({task:id})
  const close=()=>{setDetail(undefined);setParams({})}
  useEffect(()=>{
    let active=true
    setLoading(true);setError('')
    Promise.all([call<Task[]>(manager?'':'?scope=mine'),manager?call<Options>('/options'):Promise.resolve(emptyOptions)])
      .then(([tasks,pickers])=>{if(active){setRows(tasks);setOptions(pickers)}})
      .catch(e=>{if(active)setError(errorText(e))})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[manager,refresh])
  useEffect(()=>{
    if(!taskId){setDetail(undefined);setDetailLoading(false);return}
    let active=true
    setDetailLoading(true)
    call<Task>(`/${taskId}`).then(async task=>{
      if(!active)return
      setDetail(task)
      if(!manager&&task.own&&!task.AssignmentSeenAt) {
        await call(`/${taskId}`,'PATCH',{action:'seen'})
        if(active)setDetail(current=>current?.Id===taskId?{...current,AssignmentSeenAt:new Date().toISOString()}:current)
      }
    }).catch(e=>{if(active){setError(errorText(e));setParams({}, {replace:true})}})
      .finally(()=>{if(active)setDetailLoading(false)})
    return()=>{active=false}
  },[taskId,manager,refresh,setParams])

  function edit(task?:Task) {
    setFiles([]);form.resetFields()
    form.setFieldsValue(task?{title:task.Title,description:task.Description,employeeId:task.AssignedToUserId,projectId:task.ProjectId||undefined,
      start:toShamsi(task.StartDate),due:toShamsi(task.DueDate),dueTime:task.AssignmentDueHasTime?clock(task.DueDate):undefined,
      priority:task.Priority,outcome:task.AssignmentOutcome,notes:task.AssignmentNotes}: {start:today(),priority:1})
    setEditing({id:task?.Id??crypto.randomUUID(),existing:task})
  }
  async function save(values:Fields) {
    if(!editing)return
    setBusy(true)
    try {
      await call(editing.existing?`/${editing.id}`:'',editing.existing?'PATCH':'POST',{
        id:editing.id,action:'edit',...values,startsAt:dateTime(values.start||today(),undefined,true),dueAt:dateTime(values.due,values.dueTime),
        dueHasTime:!!values.dueTime,files:await encodeFiles(files),
      })
      message.success(editing.existing?'تغییرات وظیفه ذخیره شد':'وظیفه واگذار شد')
      setEditing(undefined);reload()
    }catch(e){message.error(errorText(e))}
    finally{setBusy(false)}
  }
  function startAction(kind:string) {
    setFiles([]);actions.resetFields()
    actions.setFieldsValue({progress:kind==='submit'?100:detail?.Progress})
    setAction(kind)
  }
  async function runAction(values:ActionFields) {
    if(!action||!detail)return
    setBusy(true)
    try {
      const input={action,note:values.note,progress:values.progress,
        ...(action==='submit'?{files:await encodeFiles(files)}:{}),
        ...(values.due?{dueAt:dateTime(values.due,values.dueTime),dueHasTime:!!values.dueTime}:{})}
      await call(`/${detail.Id}`,'PATCH',input)
      message.success(`${names[action]} ثبت شد`);setAction(undefined);reload()
    }catch(e){message.error(errorText(e))}
    finally{setBusy(false)}
  }
  async function download(task:Task,file:Attachment,activity=false) {
    try {
      const response=await apiFetch(`${API}/${task.Id}/${activity?'activity-files':'files'}/${file.id}`)
      if(!response.ok)throw new Error('دریافت فایل انجام نشد')
      const href=URL.createObjectURL(await response.blob()),link=document.createElement('a')
      link.href=href;link.download=file.name;link.click();window.setTimeout(()=>URL.revokeObjectURL(href),1000)
    }catch(e){message.error(errorText(e))}
  }
  function fileList(task:Task,items:Attachment[],activity=false) {
    return <Space wrap>{items.length?items.map(file=><Button key={file.id} size="small" icon={<DownloadOutlined/>}
      onClick={()=>void download(task,file,activity)}>{file.name}</Button>):'—'}</Space>
  }
  const focus=(task:Task,key?:string)=>{
    switch(key){
      case 'active-total':return !['approved','cancelled'].includes(task.AssignmentState)
      case 'late':return task.late && phaseOpen(task.AssignmentState)
      case 'extension':return !!task.AssignmentExtension
      default:return !key||task.AssignmentState===key
    }
  }
  const stats=[['فعال','active-total'],['در حال انجام','active'],['در انتظار بررسی','review'],['تأییدشده','approved'],['معوق','late'],['درخواست تمدید','extension']]
  const filtered=rows.filter(task=>focus(task,preset)&&(!employee||employee===task.AssignedToUserId)&&(!status||status===task.AssignmentState)
    &&(priority===undefined||priority===task.Priority)&&(!from||calendarDay(task.CreatedAt)>=gregorian(from))&&(!to||calendarDay(task.CreatedAt)<=gregorian(to))
    &&task.Title.toLocaleLowerCase('fa').includes(search.trim().toLocaleLowerCase('fa')))
  const submitNote=['block','submit','return','cancel','comment','extend'].includes(action??'')
  const currentOpen=!!detail&&phaseOpen(detail.AssignmentState)
  const canAct=!!detail&&!['approved','cancelled'].includes(detail.AssignmentState)
  const noTeam=manager&&!loading&&!error&&!options.employees.length

  return <div dir="rtl">
    <Card title={manager?'واگذاری و پیگیری وظایف':'وظایف واگذارشده'}
      extra={manager&&<Button type="primary" icon={<PlusOutlined/>} disabled={loading||!options.employees.length} onClick={()=>edit()}>تعریف وظیفه جدید</Button>}>
      <Space direction="vertical" size="middle" style={{width:'100%'}}>
        {error&&<Alert type="error" showIcon message={error} action={<Button size="small" onClick={reload}>تلاش مجدد</Button>}/>}
        {noTeam&&<Alert showIcon type="info" message="کارمند فعالی به‌عنوان زیرمجموعه مستقیم شما تعریف نشده است."/>}
        {manager&&<Row gutter={[12,12]}>
          {stats.map(([label,key])=><Col key={key} xs={12} md={8} xl={4}>
            <Button block type={preset===key?'primary':'default'} onClick={()=>setPreset(value=>value===key?undefined:key)} style={{height:'auto',padding:'10px'}}>
              <Statistic title={<span style={{color:'inherit'}}>{label}</span>} value={fa(rows.filter(task=>focus(task,key)).length)} loading={loading}/>
            </Button>
          </Col>)}
        </Row>}
        <Space wrap>
          <Input.Search allowClear value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجوی عنوان" style={{width:210}}/>
          {manager&&<Select allowClear showSearch optionFilterProp="label" placeholder="کارمند" value={employee} onChange={setEmployee} style={{width:170}}
            options={[...new Map(rows.map(t=>[t.AssignedToUserId,t.employeeName??'کارمند'])).entries()].map(([value,label])=>({value,label}))}/>}
          <Select allowClear placeholder="وضعیت" value={status} onChange={setStatus} options={toOptions(phases)} style={{width:165}}/>
          <Select allowClear placeholder="اولویت" value={priority} onChange={setPriority} options={priorityOptions} style={{width:110}}/>
          {manager&&<>
            <PersianDatePicker value={from} onChange={setFrom} placeholder="واگذاری از"/>
            <PersianDatePicker value={to} onChange={setTo} placeholder="واگذاری تا"/>
            {(from||to||preset)&&<Button onClick={()=>{setFrom(undefined);setTo(undefined);setPreset(undefined)}}>پاک‌کردن فیلتر کارت و تاریخ</Button>}
          </>}
        </Space>
        <Table rowKey="Id" dataSource={filtered} loading={loading} scroll={{x:1200}} pagination={{pageSize:10,showSizeChanger:true}}
          locale={{emptyText:<Empty description="وظیفه‌ای برای نمایش نیست"/>}} columns={[
            {title:'عنوان',dataIndex:'Title',sorter:(a,b)=>a.Title.localeCompare(b.Title,'fa')},
            {title:manager?'مسئول انجام':'واگذارکننده',dataIndex:manager?'employeeName':'managerName',render:(value?:string)=>value||'—'},
            {title:'تاریخ واگذاری',dataIndex:'CreatedAt',render:displayDate,sorter:(a,b)=>a.CreatedAt.localeCompare(b.CreatedAt)},
            {title:'تاریخ شروع',dataIndex:'StartDate',render:displayDate,sorter:(a,b)=>a.StartDate.localeCompare(b.StartDate)},
            {title:'مهلت انجام',render:(_,task)=>task.AssignmentDueHasTime?displayMoment(task.DueDate):displayDate(task.DueDate),sorter:(a,b)=>a.DueDate.localeCompare(b.DueDate)},
            {title:'اولویت',dataIndex:'Priority',render:(v:number)=><Tag color={v>=2?'volcano':'default'}>{priorities[v]}</Tag>,sorter:(a,b)=>a.Priority-b.Priority},
            {title:'وضعیت',render:(_,task)=><Space wrap>{stateTag(task.AssignmentState)}{task.late&&<Tag color="red">با تأخیر</Tag>}</Space>},
            {title:'پیشرفت',dataIndex:'Progress',render:(v:number)=><Progress percent={v} size="small" format={n=>`${fa(n??0)}٪`}/>,sorter:(a,b)=>a.Progress-b.Progress},
            {title:'زمان صرف‌شده',dataIndex:'minutes',render:duration,sorter:(a,b)=>a.minutes-b.minutes},
            {title:'عملیات',render:(_,task)=><Space wrap><Button size="small" onClick={()=>open(task.Id)}>مشاهده جزئیات</Button>
              {!manager&&<Button size="small" onClick={()=>navigate(taskLink(task.Id))}>ثبت فعالیت و زمان</Button>}</Space>},
          ]}/>
      </Space>
    </Card>
    <Modal title={editing?.existing?'ویرایش وظیفه':'تعریف وظیفه جدید'} width={760} open={!!editing} forceRender
      onCancel={()=>{if(!busy)setEditing(undefined)}} onOk={()=>form.submit()} okText="ذخیره وظیفه" cancelText="انصراف" confirmLoading={busy}>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="title" label="عنوان وظیفه" rules={[{required:true,whitespace:true}]}><Input maxLength={200}/></Form.Item>
        <Form.Item name="description" label="شرح وظیفه" rules={[{required:true,whitespace:true}]}><Input.TextArea rows={3} maxLength={8000}/></Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}><Form.Item name="employeeId" label="مسئول انجام" rules={[{required:true}]}>
            <Select showSearch optionFilterProp="label" disabled={!!editing?.existing}
              options={options.employees.map(e=>({value:e.id,label:[e.name,e.position].filter(Boolean).join(' — ')}))}/>
          </Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="due" label="مهلت انجام" rules={[{required:true}]}><PersianDatePicker/></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="priority" label="اولویت" rules={[{required:true}]}><Select options={priorityOptions}/></Form.Item></Col>
        </Row>
        <Collapse items={[{key:'advanced',label:'جزئیات تکمیلی',forceRender:true,children:<>
          <Row gutter={12}>
          <Col xs={24} md={12}><Form.Item name="projectId" label="پروژه مرتبط">
            <Select allowClear showSearch optionFilterProp="label" options={[
              ...options.projects.map(p=>({value:p.id,label:p.name})),
              ...(editing?.existing?.ProjectId&&!options.projects.some(p=>p.id===editing.existing?.ProjectId)
                ?[{value:editing.existing.ProjectId,label:editing.existing.projectName||'پروژهٔ فعلی'}]:[]),
            ]}/>
          </Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="start" label="تاریخ شروع"><PersianDatePicker/></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item name="dueTime" label="ساعت مهلت"><TimePicker format="HH:mm" style={{width:'100%'}}/></Form.Item></Col>
          </Row>
        <Form.Item name="outcome" label="خروجی مورد انتظار"><Input.TextArea maxLength={4000}/></Form.Item>
        <Form.Item name="notes" label="توضیحات تکمیلی"><Input.TextArea maxLength={4000}/></Form.Item>
        {editing&&<FileInput key={editing.id} onChange={setFiles}/>}
        </>}]}/>
      </Form>
    </Modal>
    <Modal title={detail?.Title||'جزئیات وظیفه'} open={!!taskId} onCancel={close} footer={null} width={1020}>
      {detailLoading?<Spin/>:detail&&<Space direction="vertical" size="middle" style={{width:'100%'}}>
        <Descriptions bordered size="small" column={{xs:1,sm:2,md:3}} items={[
          {key:'employee',label:'مسئول انجام',children:detail.employeeName||'—'},{key:'manager',label:'واگذارکننده',children:detail.managerName||'—'},
          {key:'state',label:'وضعیت',children:<Space>{stateTag(detail.AssignmentState)}{detail.late&&<Tag color="red">با تأخیر</Tag>}</Space>},
          {key:'created',label:'واگذاری',children:displayMoment(detail.CreatedAt)},{key:'start',label:'شروع',children:displayDate(detail.StartDate)},
          {key:'due',label:'مهلت',children:detail.AssignmentDueHasTime?displayMoment(detail.DueDate):displayDate(detail.DueDate)},
          {key:'priority',label:'اولویت',children:priorities[detail.Priority]},{key:'project',label:'پروژه',children:detail.projectName||'—'},
          {key:'progress',label:'پیشرفت',children:<Progress percent={detail.Progress} format={n=>`${fa(n??0)}٪`}/>},
          {key:'time',label:'زمان صرف‌شده',children:duration(detail.minutes)},{key:'seen',label:'مشاهده کارمند',children:displayMoment(detail.AssignmentSeenAt)},
          {key:'sent',label:'آخرین تحویل',children:displayMoment(detail.CompletionRequestedAt)},
          {key:'approved',label:'تأیید نهایی',children:displayMoment(detail.CompletionApprovedAt)},
          {key:'desc',label:'شرح وظیفه',span:'filled',children:<span style={{whiteSpace:'pre-wrap'}}>{detail.Description}</span>},
          {key:'outcome',label:'خروجی مورد انتظار',span:'filled',children:<span style={{whiteSpace:'pre-wrap'}}>{detail.AssignmentOutcome}</span>},
          ...(detail.AssignmentNotes?[{key:'notes',label:'توضیحات تکمیلی',span:'filled' as const,children:<span style={{whiteSpace:'pre-wrap'}}>{detail.AssignmentNotes}</span>}]:[]),
        ]}/>
        {detail.AssignmentExtension&&<Alert type="info" showIcon message="درخواست تمدید در انتظار تصمیم" description={
          <div>{displayMoment(detail.AssignmentExtension.oldDue)} ← {displayMoment(detail.AssignmentExtension.dueAt)}<div>{detail.AssignmentExtension.note}</div></div>}/>}
        <Space wrap>
          {!manager&&detail.own&&<Button onClick={()=>navigate(taskLink(detail.Id))}>ثبت فعالیت و زمان</Button>}
          {!manager&&detail.own&&currentOpen&&<>
            {detail.AssignmentState!=='active'&&<Button onClick={()=>startAction('start')}>شروع کار</Button>}
            <Button onClick={()=>startAction('progress')}>ثبت پیشرفت</Button>
            <Button onClick={()=>startAction('block')}>اعلام مانع</Button>
            {!detail.AssignmentExtension&&<Button onClick={()=>startAction('extend')}>درخواست تمدید</Button>}
            <Button type="primary" onClick={()=>startAction('submit')}>ارسال برای بررسی</Button>
          </>}
          {manager&&detail.manage&&canAct&&<>
            {currentOpen&&<Button onClick={()=>edit(detail)}>ویرایش مشخصات</Button>}
            <Button onClick={()=>startAction('comment')}>ثبت توضیح</Button>
            {detail.AssignmentState==='review'&&<>
              <Button type="primary" onClick={()=>startAction('approve')}>تأیید وظیفه</Button>
              <Button onClick={()=>startAction('return')}>برگشت برای اصلاح</Button>
            </>}
            {detail.AssignmentExtension&&currentOpen&&<>
              <Button onClick={()=>startAction('extend_approve')}>تأیید تمدید</Button>
              <Button onClick={()=>startAction('extend_reject')}>رد تمدید</Button>
            </>}
            <Button danger onClick={()=>startAction('cancel')}>لغو وظیفه</Button>
          </>}
        </Space>
        <Card size="small" title="پیوست‌های مدیر">
          {fileList(detail,(detail.files??[]).filter(file=>!(detail.events??[]).some(event=>event.id===file.event_id&&event.action==='assignment_submit')))}
        </Card>
        <Card size="small" title="فعالیت‌های مرتبط">
          <Table size="small" rowKey="id" scroll={{x:640}} pagination={{pageSize:5}} dataSource={detail.activities??[]} columns={[
            {title:'فعالیت',dataIndex:'title'},{title:'تاریخ',dataIndex:'date',render:displayDate},
            {title:'شرح و خروجی',render:(_,activity)=><span style={{whiteSpace:'pre-wrap'}}>{[activity.description,activity.outcome].filter(Boolean).join('\n')}</span>},
            {title:'زمان',dataIndex:'minutes',render:duration},{title:'پیوست',render:(_,activity)=>fileList(detail,activity.files,true)},
          ]}/>
        </Card>
        <Card size="small" title="تاریخچه، بازخورد و تحویل‌ها">
          <Timeline items={(detail.events??[]).map(event=>{
            const key=event.action.replace('assignment_',''), diff=event.details.after??{}
            return {children:<div>
              <strong>{names[key]||key}</strong><div>{[event.actor,displayMoment(event.date)].filter(Boolean).join(' · ')}</div>
              {event.details.note&&<p style={{whiteSpace:'pre-wrap'}}>{event.details.note}</p>}
              {event.details.dueAt&&<div>{displayMoment(event.details.oldDue)} ← {displayMoment(event.details.dueAt)}</div>}
              {event.details.request&&<div>مهلت پیشنهادی {displayMoment(event.details.request.dueAt)}</div>}
              {Object.entries(diff).map(([field,value])=><div key={field} style={{whiteSpace:'pre-wrap'}}>
                {auditFields[field]??field} {changeValue(field,event.details.before?.[field])} ← {changeValue(field,value)}
              </div>)}
              {!!detail.files?.some(file=>file.event_id===event.id)&&fileList(detail,detail.files.filter(file=>file.event_id===event.id))}
            </div>}
          })}/>
        </Card>
      </Space>}
    </Modal>
    <Modal title={action?names[action]:''} open={!!action} forceRender onCancel={()=>{if(!busy)setAction(undefined)}}
      okText="ثبت" cancelText="انصراف" onOk={()=>actions.submit()} confirmLoading={busy} okButtonProps={{danger:action==='cancel'}}>
      <Form form={actions} layout="vertical" onFinish={runAction}>
        {action==='approve'&&<Alert type="info" showIcon message="با تأیید، چرخهٔ این وظیفه نهایی می‌شود." style={{marginBottom:12}}/>}
        {action==='cancel'&&<Alert type="warning" showIcon message="وظیفه پس از لغو قابل ویرایش نخواهد بود." style={{marginBottom:12}}/>}
        {(action==='progress'||action==='submit')&&<Form.Item name="progress" label="درصد پیشرفت" rules={[{required:true}]}>
          <InputNumber min={0} max={100} precision={0}/>
        </Form.Item>}
        {action==='extend'&&<Space wrap>
          <Form.Item name="due" label="مهلت جدید" rules={[{required:true}]}><PersianDatePicker/></Form.Item>
          <Form.Item name="dueTime" label="ساعت مهلت پیشنهادی"><TimePicker format="HH:mm"/></Form.Item>
        </Space>}
        <Form.Item name="note" label={action==='submit'?'شرح نتیجه و خروجی':submitNote?'دلیل یا توضیح':'یادداشت اختیاری'}
          rules={submitNote?[{required:true,whitespace:true}]:[]}>
          <Input.TextArea rows={3} maxLength={4000}/>
        </Form.Item>
        {action==='submit'&&<FileInput onChange={setFiles}/>}
      </Form>
    </Modal>
  </div>
}

export function ManagerTaskAssignmentsPage() {
  return <TaskAssignmentsPanel manager />
}
