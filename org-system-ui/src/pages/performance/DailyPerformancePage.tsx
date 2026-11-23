import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Statistic, Table, Tag, Timeline, TimePicker, message } from 'antd'
import { CalendarOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import PersianDatePicker from '../../components/PersianDatePicker'
import { dateToJalali, formatJalaliDate, isLeapJalali, jalaliToDate } from '../../utils/jalali'
import { getIranHoliday } from '../../utils/iranHolidays'
import { apiFetch } from '../../utils/api'

const API = 'http://localhost:5043/api/v1/performance/daily'
const labels = {
  dashboard:'داشبورد عملکرد من', activity:'ثبت فعالیت روزانه', tasks:'وظایف من',
  reports:'گزارش‌های روزانه من', history:'سوابق و بازخوردها', review:'کارتابل تأیید گزارش‌ها',
}
const reportStatus: Record<string,[string,string]> = {
  draft:['پیش‌نویس','default'], submitted:['در انتظار تأیید','blue'], approved:['تأییدشده','green'], returned:['نیازمند اصلاح','orange'],
}
const kinds: Record<string,string> = {project:'فعالیت پروژه‌ای',internal:'فعالیت داخلی سازمان',meeting:'جلسه',recurring:'فعالیت تکرارشونده',other:'سایر'}
const activityStatus: Record<string,string> = {planned:'برنامه‌ریزی‌شده',in_progress:'در حال انجام',done:'تکمیل‌شده',blocked:'دارای مانع'}
const taskStatus = ['جدید','در حال انجام','در بررسی','تکمیل‌شده','لغوشده']
const priority = ['کم','متوسط','زیاد','فوری']
const actions: Record<string,string> = {create:'ثبت فعالیت',edit:'ویرایش فعالیت',submit:'ارسال گزارش',resubmit:'ارسال مجدد',approve:'تأیید گزارش',return:'برگشت برای اصلاح'}
const fa = (n: number) => n.toLocaleString('fa-IR')
const duration = (n: number) => [Math.floor(n/60)>0?`${fa(Math.floor(n/60))} ساعت`:'',n%60>0?`${fa(n%60)} دقیقه`:''].filter(Boolean).join(' و ') || '۰ دقیقه'
const localDate = (iso: string) => new Date(iso+'T12:00:00')
const shamsi = (iso: string) => { const d = dateToJalali(localDate(iso)); return `${d.jy}/${d.jm}/${d.jd}` }
const isoDate = (date: Date) => [date.getFullYear(), date.getMonth()+1, date.getDate()].map((n,i)=>String(n).padStart(i?2:4,'0')).join('-')
const tehranToday = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tehran',dateStyle:'short'}).format(new Date())
const dateTime = (value: string) => new Date(value).toLocaleString('fa-IR',{timeZone:'Asia/Tehran',dateStyle:'short',timeStyle:'short'})
const optionsOf = (dictionary: Record<string,string>) => Object.entries(dictionary).map(([value,label])=>({value,label}))
const clock = (minutes: number) => `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`
const editable = (status?: string) => !status || status==='draft' || status==='returned'

interface Attachment { id:string; name:string; size_bytes:number }
interface Activity {
  id:string; title:string; description:string; kind:string; status:string; minutes:number; time_mode:string
  project_id?:string; task_id?:string; outcome:string; notes:string
  performance_daily_intervals:{id:string;start_minute:number;end_minute:number}[]
  performance_daily_attachments:Attachment[]
}
interface History {id:string;action:string;note?:string;actor_name?:string;created_at:string}
interface Report {
  id:string; work_date:string; status:string; employee_name?:string; submitted_at?:string; can_review?:boolean
  performance_daily_activities?:{id:string;minutes:number}[]; activities?:Activity[]; history?:History[]
}
interface Task {Id:string; Title:string; Description?:string; AssignedByName?:string; CreatedAt:string; DueDate?:string; Priority:number; Status:number; Progress:number; ProjectId?:string}
interface Options {tasks:Task[]; projects:{Id:string;Name:string}[]; today:string}
interface ActivityFields {
  title:string; description:string; kind:string; status:string; timeMode:string; projectId?:string; taskId?:string
  hours?:number; minutesPart?:number; intervals?:{start:Dayjs;end:Dayjs}[]; outcome?:string; notes?:string
}
function monthDays(value: string) {
  const {jy,jm} = dateToJalali(localDate(value))
  const count = jm<=6?31:jm<=11||isLeapJalali(jy)?30:29
  return Array.from({length:count},(_,i)=>isoDate(jalaliToDate(`${jy}/${jm}/${i+1}`)))
}
async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await apiFetch(API+path,{method,headers:payload?{'Content-Type':'application/json'}:undefined,body:payload?JSON.stringify(payload):undefined})
  const data = await response.json().catch(()=>({}))
  if (!response.ok) throw new Error(data.message || 'ارتباط با سامانه برقرار نشد')
  return data as T
}
function encodeFile(file: File): Promise<{name:string;content:string}> {
  return new Promise((resolve,reject)=>{
    const reader = new FileReader()
    reader.onerror = ()=>reject(new Error('خواندن فایل انجام نشد'))
    reader.onload = ()=>resolve({name:file.name,content:String(reader.result).split(',')[1]})
    reader.readAsDataURL(file)
  })
}
const errorText = (error: unknown) => error instanceof Error ? error.message : 'عملیات انجام نشد'
const statusTag = (status?: string) => {
  const [label,color] = reportStatus[status ?? ''] ?? ['ارسال نشده','default']
  return <Tag color={color}>{label}</Tag>
}

export default function DailyPerformancePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const page = (location.pathname.split('/').pop() || 'dashboard') as keyof typeof labels
  const isReview = page==='review'
  const [selectedDate,setSelectedDate] = useState(tehranToday)
  const [options,setOptions] = useState<Options>({tasks:[],projects:[],today:tehranToday()})
  const [reports,setReports] = useState<Report[]>([])
  const [reviewQueue,setReviewQueue] = useState<Report[]>([])
  const [leave,setLeave] = useState<string[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [refresh,setRefresh] = useState(0)
  const [detail,setDetail] = useState<Report>()
  const [detailLoading,setDetailLoading] = useState(false)
  const [dateDetail,setDateDetail] = useState<Report>()
  const [itemDetail,setItemDetail] = useState<Activity>()
  const [editing,setEditing] = useState<{id:string;date:string;reportId?:string;activity?:Activity}>()
  const [files,setFiles] = useState<File[]>([])
  const [removed,setRemoved] = useState<string[]>([])
  const [busy,setBusy] = useState(false)
  const [decision,setDecision] = useState<'approve'|'return'>()
  const [note,setNote] = useState('')
  const [search,setSearch] = useState('')
  const [filter,setFilter] = useState<string>()
  const [form] = Form.useForm<ActivityFields>()
  const timeMode = Form.useWatch('timeMode',form)
  const intervals = Form.useWatch('intervals',form)
  const linkedTask = Form.useWatch('taskId',form)
  const reload = () => setRefresh(value=>value+1)
  const days = monthDays(selectedDate)
  const monthStart = days[0], monthEnd = days[days.length-1]
  const todaysReport = reports.find(r=>r.work_date===options.today)
  const selectedReport = reports.find(r=>r.work_date===selectedDate)
  const activeItems = dateDetail?.id===selectedReport?.id ? dateDetail?.activities ?? [] : []

  useEffect(()=>{
    let alive = true
    request<Options>('/options').then(data=>{if(alive)setOptions(data)}).catch(e=>{if(alive)setError(errorText(e))})
    return ()=>{alive=false}
  },[])
  useEffect(()=>{
    let alive = true
    setLoading(true);setError('')
    if (isReview) {
      request<Report[]>('/reports?scope=review').then(data=>{if(alive)setReviewQueue(data)})
        .catch(e=>{if(alive)setError(errorText(e))}).finally(()=>{if(alive)setLoading(false)})
    } else {
      Promise.all([request<Report[]>('/reports'),request<{leave:string[]}>(`/calendar?from=${monthStart}&to=${monthEnd}`)])
        .then(([items,calendar])=>{if(alive){setReports(items);setLeave(calendar.leave)}})
        .catch(e=>{if(alive)setError(errorText(e))}).finally(()=>{if(alive)setLoading(false)})
    }
    return ()=>{alive=false}
  },[isReview,monthStart,monthEnd,refresh])
  const selectedId = selectedReport?.id
  useEffect(()=>{
    let alive = true
    setDateDetail(undefined)
    if (selectedId && page==='activity') {
      request<Report>(`/reports/${selectedId}`).then(data=>{if(alive)setDateDetail(data)}).catch(e=>{if(alive)setError(errorText(e))})
    }
    return ()=>{alive=false}
  },[selectedId,page,refresh])

  const edit = (item?: Activity, task?: Task, report?: Report, forDate = selectedDate) => {
    const source = item && (report ?? dateDetail)
    setEditing({id:item?.id ?? crypto.randomUUID(),date:source?.work_date || forDate,reportId:source?.id,activity:item})
    setFiles([]);setRemoved([])
    form.resetFields()
    form.setFieldsValue({
      title:item?.title ?? task?.Title,description:item?.description,kind:item?.kind ?? (task?.ProjectId?'project':'internal'),
      status:item?.status ?? 'in_progress',timeMode:item?.time_mode ?? 'manual',
      taskId:item?.task_id ?? task?.Id,projectId:item?.project_id ?? task?.ProjectId,
      outcome:item?.outcome,notes:item?.notes,hours:Math.floor((item?.minutes ?? 0)/60),minutesPart:(item?.minutes ?? 0)%60,
      intervals:item?.performance_daily_intervals?.map(r=>({start:dayjs().startOf('day').add(r.start_minute,'minute'),end:dayjs().startOf('day').add(r.end_minute,'minute')})),
    })
  }
  const addFromNavigation = useRef(false)
  useEffect(()=>{
    if (page==='activity' && new URLSearchParams(location.search).get('new')==='1' && !addFromNavigation.current) {
      addFromNavigation.current=true
      edit(undefined,undefined,undefined,options.today)
      navigate('/performance/activity',{replace:true})
    }
    if (page!=='activity') addFromNavigation.current=false
  // The navigation flag is consumed once. The modal owns the current form values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[page,location.search])
  async function save(values: ActivityFields) {
    if (!editing) return
    setBusy(true)
    try {
      const minutesOf = (v: Dayjs) => v.hour()*60+v.minute()
      const payload = {...values,id:editing.id,date:editing.date,
        minutes:(values.hours ?? 0)*60+(values.minutesPart ?? 0),
        intervals:values.timeMode==='intervals'?(values.intervals ?? []).map(r=>({s:minutesOf(r.start),e:minutesOf(r.end)})):[],
        files:await Promise.all(files.map(encodeFile)),removeFiles:removed,
      }
      await request(editing.reportId?`/reports/${editing.reportId}/activities`:'/activities',editing.reportId?'PUT':'POST',payload)
      message.success('فعالیت ذخیره شد')
      if (editing.reportId && detail?.id===editing.reportId) setDetail(await request<Report>(`/reports/${editing.reportId}`))
      setSelectedDate(editing.date);setEditing(undefined);reload()
    } catch(e) { message.error(errorText(e)) }
    finally {setBusy(false)}
  }
  const submit = (date: string) => Modal.confirm({
    title:'ارسال گزارش روزانه',content:`گزارش ${formatJalaliDate(localDate(date))} برای بررسی مدیر ارسال شود؟`,
    okText:'ارسال گزارش',cancelText:'انصراف',onOk:async()=>{
      try {
        const result = await request<{id:string}>('/submit','POST',{date})
        message.success('گزارش برای مدیر ارسال شد');reload()
        if (detail?.id===result.id) setDetail(await request<Report>(`/reports/${result.id}`))
      }
      catch(e){message.error(errorText(e));throw e}
    },
  })
  async function view(report: Report) {
    setDetail(report);setDetailLoading(true)
    try {setDetail(await request<Report>(`/reports/${report.id}`))}
    catch(e){message.error(errorText(e));setDetail(undefined)}
    finally{setDetailLoading(false)}
  }
  async function download(file: Attachment) {
    try {
      const response = await apiFetch(`${API}/files/${file.id}`)
      if (!response.ok) throw new Error('دریافت پیوست انجام نشد')
      const href = URL.createObjectURL(await response.blob()), link = document.createElement('a')
      link.href=href;link.download=file.name;link.click()
      window.setTimeout(()=>URL.revokeObjectURL(href),1000)
    } catch(e){message.error(errorText(e))}
  }
  async function review() {
    if (!detail || !decision) return
    if (decision==='return' && !note.trim()) {message.warning('دلیل برگشت را بنویسید');return}
    setBusy(true)
    try {
      await request(`/reports/${detail.id}/review`,'POST',{action:decision,note})
      message.success(decision==='approve'?'گزارش تأیید شد':'گزارش برای اصلاح برگشت داده شد')
      setDecision(undefined);setNote('');setDetail(await request<Report>(`/reports/${detail.id}`));reload()
    } catch(e){message.error(errorText(e))}
    finally{setBusy(false)}
  }
  function holiday(date: string) {
    const d = localDate(date), j = dateToJalali(d)
    return getIranHoliday(j.jy,j.jm,j.jd) || (d.getDay()===5?'جمعه':undefined)
  }
  const renderActivities = (items: Activity[], report?: Report, own = true) => (
    <Table rowKey="id" dataSource={items} scroll={{x:760}} pagination={{pageSize:8,showSizeChanger:false}} locale={{emptyText:'فعالیتی ثبت نشده است'}} columns={[
      {title:'فعالیت',dataIndex:'title',sorter:(a,b)=>a.title.localeCompare(b.title,'fa')},
      {title:'نوع',dataIndex:'kind',render:(value:string)=>kinds[value] ?? value},
      {title:'وضعیت انجام',dataIndex:'status',render:(value:string)=><Tag>{activityStatus[value]}</Tag>},
      {title:'زمان',dataIndex:'minutes',sorter:(a,b)=>a.minutes-b.minutes,render:duration},
      {title:'پیوست',render:(_,item)=>fa(item.performance_daily_attachments.length)},
      {title:'عملیات',render:(_,item)=><Space><Button size="small" onClick={()=>setItemDetail(item)}>جزئیات</Button>
        {own && editable(report?.status) && <Button size="small" onClick={()=>edit(item,undefined,report)}>ویرایش</Button>}</Space>},
    ]}/>
  )
  const reportsTable = (data: Report[]) => (
    <Table rowKey="id" loading={loading} dataSource={data} scroll={{x:700}} pagination={{pageSize:10}} locale={{emptyText:'گزارشی برای نمایش وجود ندارد'}} columns={[
      ...(isReview ? [{title:'کارمند',dataIndex:'employee_name',render:(value:string)=>value || '—'}] : []),
      {title:'تاریخ',dataIndex:'work_date',render:(value:string)=>formatJalaliDate(localDate(value)),sorter:(a,b)=>a.work_date.localeCompare(b.work_date)},
      {title:'وضعیت گزارش',dataIndex:'status',render:statusTag},
      {title:'فعالیت‌ها',render:(_,item)=>fa(item.performance_daily_activities?.length ?? 0)},
      {title:'مجموع زمان',render:(_,item)=>duration(item.performance_daily_activities?.reduce((n,a)=>n+a.minutes,0) ?? 0)},
      {title:'عملیات',render:(_,item)=><Button size="small" onClick={()=>void view(item)}>مشاهده گزارش</Button>},
    ]}/>
  )
  const reportActions = (date: string, current?: Report) => <Space wrap>
    {editable(current?.status) && <Button icon={<PlusOutlined/>} onClick={()=>edit(undefined,undefined,undefined,date)}>ثبت فعالیت جدید</Button>}
    {editable(current?.status) && <Button type="primary" disabled={!current?.performance_daily_activities?.length} onClick={()=>submit(date)}>
      {date===options.today?'ارسال گزارش امروز':'ارسال گزارش روزانه'}
    </Button>}
  </Space>

  return <Space direction="vertical" size="middle" style={{width:'100%'}} dir="rtl">
    <Card title={<Space><CalendarOutlined/>{labels[page] ?? labels.dashboard}</Space>}>
      {error && <Alert type="error" showIcon message={error} style={{marginBottom:16}} action={<Button size="small" onClick={reload}>تلاش مجدد</Button>}/>}
      {page==='dashboard' && <Space direction="vertical" size="middle" style={{width:'100%'}}>
        {!loading && editable(todaysReport?.status) && !holiday(options.today) && !leave.includes(options.today) &&
          <Alert type="warning" showIcon message={todaysReport?.status==='returned'?'گزارش امروز برای اصلاح برگشته است.':'گزارش امروز هنوز ارسال نشده است.'}/>}
        <Row gutter={[16,16]}>
          {[
            ['فعالیت امروز',fa(todaysReport?.performance_daily_activities?.length ?? 0)],
            ['زمان فعالیت امروز',duration(todaysReport?.performance_daily_activities?.reduce((n,a)=>n+a.minutes,0) ?? 0)],
            ['وظایف در حال انجام',fa(options.tasks.filter(t=>[1,2].includes(t.Status)).length)],
            ['وظایف تکمیل‌شده',fa(options.tasks.filter(t=>t.Status===3).length)],
            ['وظایف معوق',fa(options.tasks.filter(t=>t.DueDate && t.DueDate.slice(0,10)<options.today && ![3,4].includes(t.Status)).length)],
            ['گزارش‌های نیازمند اصلاح',fa(reports.filter(r=>r.status==='returned').length)],
          ].map(([title,value])=><Col key={title} xs={12} md={8}><Card size="small"><Statistic title={title} value={value}/></Card></Col>)}
        </Row>
        <Space wrap>وضعیت گزارش امروز {statusTag(todaysReport?.status)}{reportActions(options.today,todaysReport)}</Space>
      </Space>}
      {page==='activity' && <Space direction="vertical" size="middle" style={{width:'100%'}}>
        <Space wrap><PersianDatePicker value={shamsi(selectedDate)} onChange={d=>setSelectedDate(isoDate(jalaliToDate(d)))}/>
          {statusTag(selectedReport?.status)}{reportActions(selectedDate,selectedReport)}</Space>
        <Space wrap>
          <Input.Search placeholder="جست‌وجوی فعالیت" allowClear value={search} onChange={e=>setSearch(e.target.value)} style={{width:220}}/>
          <Select placeholder="نوع فعالیت" allowClear value={filter} onChange={setFilter} options={optionsOf(kinds)} style={{width:170}}/>
        </Space>
        {renderActivities(activeItems.filter(a=>(!filter||a.kind===filter)&&`${a.title} ${a.description}`.includes(search.trim())),selectedReport)}
      </Space>}
      {page==='tasks' && <Table rowKey="Id" dataSource={options.tasks} scroll={{x:1050}} pagination={{pageSize:10}} locale={{emptyText:'وظیفه‌ای به شما واگذار نشده است'}}
        expandable={{expandedRowRender:task=><p style={{whiteSpace:'pre-wrap'}}>{task.Description || 'شرحی ثبت نشده است'}</p>}} columns={[
          {title:'عنوان وظیفه',dataIndex:'Title'},{title:'واگذارکننده',dataIndex:'AssignedByName',render:(v:string)=>v || '—'},
          {title:'تاریخ واگذاری',dataIndex:'CreatedAt',render:(v:string)=>formatJalaliDate(new Date(v))},
          {title:'مهلت انجام',dataIndex:'DueDate',render:(v?:string)=>v?formatJalaliDate(new Date(v)):'—'},
          {title:'اولویت',dataIndex:'Priority',render:(v:number)=>priority[v] ?? '—'},
          {title:'وضعیت',dataIndex:'Status',render:(v:number)=>taskStatus[v] ?? '—'},
          {title:'پیشرفت',dataIndex:'Progress',render:(v:number)=>`${fa(v ?? 0)}٪`},
          {title:'عملیات',render:(_,task)=><Button size="small" onClick={()=>edit(undefined,task,undefined,options.today)}>ثبت فعالیت و زمان</Button>},
        ]}/>}
      {page==='reports' && <Space direction="vertical" style={{width:'100%'}} size="middle">
        <Space wrap>تقویم گزارش‌ها <PersianDatePicker value={shamsi(selectedDate)} onChange={d=>setSelectedDate(isoDate(jalaliToDate(d)))}/></Space>
        <Row gutter={[8,8]}>
          {days.map(date=>{
            const report=reports.find(r=>r.work_date===date)
            const label=leave.includes(date)?'مرخصی':holiday(date)
            const day=dateToJalali(localDate(date)).jd
            const missing=!loading && !label && date<=options.today && (!report || report.status==='draft')
            return <Col key={date} xs={12} sm={8} md={6} lg={4}>
              <Button block style={{height:'auto',padding:'6px'}} onClick={()=>{if(report)void view(report);else setSelectedDate(date)}}>
                <div>{fa(day)}</div><Tag color={missing?'red':report?reportStatus[report.status]?.[1]:'default'}>
                  {report?(missing?'ارسال نشده':reportStatus[report.status]?.[0]):label || (missing?'بدون گزارش':'—')}
                </Tag>
              </Button>
            </Col>
          })}
        </Row>
        {reportsTable(reports.filter(r=>r.work_date>=monthStart&&r.work_date<=monthEnd))}
      </Space>}
      {page==='history' && reportsTable(reports.filter(r=>r.status!=='draft'))}
      {isReview && reportsTable([...reviewQueue].sort((a,b)=>Number(b.status==='submitted')-Number(a.status==='submitted')))}
    </Card>
    <Modal title={editing?.activity?'ویرایش فعالیت':'ثبت فعالیت'} open={!!editing} onCancel={()=>{if(!busy)setEditing(undefined)}}
      onOk={()=>form.submit()} okText="ذخیره فعالیت" cancelText="انصراف" confirmLoading={busy} width={760} forceRender>
      <Form form={form} layout="vertical" onFinish={save}>
        <Row gutter={12}>
          <Col xs={24} md={12}><Form.Item name="title" label="عنوان فعالیت" rules={[{required:true,whitespace:true}]}><Input maxLength={180}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label="تاریخ فعالیت" required>
            <PersianDatePicker disabled={!!editing?.activity} value={editing?shamsi(editing.date):undefined}
              onChange={d=>setEditing(current=>current?{...current,date:isoDate(jalaliToDate(d))}:current)}/>
          </Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="kind" label="نوع فعالیت" rules={[{required:true}]}><Select options={optionsOf(kinds)}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="status" label="وضعیت انجام" rules={[{required:true}]}><Select options={optionsOf(activityStatus)}/></Form.Item></Col>
          <Col xs={24}><Form.Item name="description" label="شرح فعالیت" rules={[{required:true,whitespace:true}]}><Input.TextArea rows={3} maxLength={4000}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="taskId" label="وظیفه مرتبط">
            <Select showSearch optionFilterProp="label" allowClear options={options.tasks.map(t=>({value:t.Id,label:t.Title}))}
              onChange={value=>form.setFieldValue('projectId',options.tasks.find(t=>t.Id===value)?.ProjectId ?? undefined)}/>
          </Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="projectId" label="پروژه مرتبط" extra={linkedTask?'پروژه از وظیفه خوانده می‌شود.':undefined}>
            <Select showSearch optionFilterProp="label" allowClear disabled={!!linkedTask} options={options.projects.map(p=>({value:p.Id,label:p.Name}))}/>
          </Form.Item></Col>
        </Row>
        <Form.Item name="timeMode" label="روش ثبت زمان"><Select options={[{value:'manual',label:'مدت به‌صورت دستی'},{value:'intervals',label:'بازه‌های شروع و پایان'}]}/></Form.Item>
        {timeMode==='intervals' ? <Form.List name="intervals">
          {(fields,{add,remove})=><Space direction="vertical" style={{width:'100%'}}>
            {fields.map(({key,name})=><Space key={key} align="start" wrap>
              <Form.Item name={[name,'start']} label="شروع" rules={[{required:true}]}><TimePicker format="HH:mm"/></Form.Item>
              <Form.Item name={[name,'end']} label="پایان" rules={[{required:true}]}><TimePicker format="HH:mm"/></Form.Item>
              <Button danger onClick={()=>remove(name)}>حذف بازه</Button>
            </Space>)}
            <Button icon={<PlusOutlined/>} onClick={()=>add()} disabled={fields.length>=20}>افزودن بازه</Button>
            <Tag>مجموع {duration((intervals ?? []).reduce((n, r)=>r?.start && r?.end?n+Math.max(0,r.end.hour()*60+r.end.minute()-r.start.hour()*60-r.start.minute()):n,0))}</Tag>
          </Space>}
        </Form.List> : <Space wrap>
          <Form.Item name="hours" label="ساعت"><InputNumber min={0} max={24} precision={0}/></Form.Item>
          <Form.Item name="minutesPart" label="دقیقه"><InputNumber min={0} max={59} precision={0}/></Form.Item>
        </Space>}
        <Form.Item name="outcome" label="نتیجه یا خروجی کار"><Input.TextArea maxLength={2000}/></Form.Item>
        <Form.Item name="notes" label="توضیحات تکمیلی"><Input.TextArea maxLength={2000}/></Form.Item>
        <Form.Item label="پیوست‌ها" extra="تا ۵ فایل PDF، JPEG، PNG یا TXT، هر فایل حداکثر ۱ مگابایت">
          <input key={editing?.id} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" onChange={e=>{
            const picked=Array.from(e.target.files ?? [])
            const retained=editing?.activity?.performance_daily_attachments.filter(f=>!removed.includes(f.id)).length ?? 0
            if (picked.length+retained>5 || picked.some(f=>!f.size||f.size>1048576)) {message.error('تعداد یا حجم فایل‌ها بیش از حد مجاز است');e.target.value='';setFiles([]);return}
            setFiles(picked)
          }}/>
          {editing?.activity?.performance_daily_attachments.filter(f=>!removed.includes(f.id)).map(f=>
            <div key={f.id}><Button type="link" onClick={()=>void download(f)}>{f.name}</Button><Button size="small" danger onClick={()=>setRemoved(v=>[...v,f.id])}>حذف از فعالیت</Button></div>)}
        </Form.Item>
      </Form>
    </Modal>
    <Modal title="جزئیات گزارش روزانه" open={!!detail} onCancel={()=>setDetail(undefined)} footer={null} width={900}>
      {detailLoading ? <Spin/> : detail && <Space direction="vertical" style={{width:'100%'}}>
        <Space wrap>{detail.employee_name && <strong>{detail.employee_name}</strong>}{formatJalaliDate(localDate(detail.work_date))}{statusTag(detail.status)}
          {detail.submitted_at && <span>ارسال {dateTime(detail.submitted_at)}</span>}</Space>
        {renderActivities(detail.activities ?? [],detail,!isReview)}
        {!isReview && editable(detail.status) && <Button type="primary" onClick={()=>submit(detail.work_date)}>ارسال گزارش روزانه</Button>}
        {isReview && detail.can_review && detail.status==='submitted' && <Space wrap>
          <Button type="primary" onClick={()=>{setDecision('approve');setNote('')}}>تأیید گزارش</Button>
          <Button onClick={()=>{setDecision('return');setNote('')}}>برگشت برای اصلاح</Button>
        </Space>}
        <Card size="small" title="تاریخچه و بازخورد">
          <Timeline items={(detail.history ?? []).map(h=>({children:<div><strong>{actions[h.action] ?? h.action}</strong>
            <div>{[h.actor_name,dateTime(h.created_at)].filter(Boolean).join(' · ')}</div>{h.note&&<p style={{whiteSpace:'pre-wrap'}}>{h.note}</p>}</div>}))}/>
        </Card>
      </Space>}
    </Modal>
    <Modal title={itemDetail?.title} open={!!itemDetail} onCancel={()=>setItemDetail(undefined)} footer={null} width={640}>
      {itemDetail && <Descriptions bordered size="small" column={1} items={[
        {key:'kind',label:'نوع و وضعیت',children:`${kinds[itemDetail.kind]} · ${activityStatus[itemDetail.status]}`},
        {key:'desc',label:'شرح',children:<span style={{whiteSpace:'pre-wrap'}}>{itemDetail.description}</span>},
        {key:'time',label:'زمان',children:<Space wrap>{duration(itemDetail.minutes)}<Tag>{itemDetail.time_mode==='manual'?'دستی':'بازه زمانی'}</Tag>
          {itemDetail.performance_daily_intervals.map(r=><Tag key={r.id}><span dir="ltr">{clock(r.start_minute)} - {clock(r.end_minute)}</span></Tag>)}</Space>},
        ...(itemDetail.outcome?[{key:'outcome',label:'خروجی',children:itemDetail.outcome}]:[]),
        ...(itemDetail.notes?[{key:'note',label:'توضیحات',children:itemDetail.notes}]:[]),
        {key:'files',label:'پیوست‌ها',children:<Space wrap>{itemDetail.performance_daily_attachments.length?itemDetail.performance_daily_attachments.map(f=>
          <Button key={f.id} icon={<DownloadOutlined/>} onClick={()=>void download(f)}>{f.name}</Button>):'—'}</Space>},
      ]}/>}
    </Modal>
    <Modal title={decision==='return'?'برگشت گزارش برای اصلاح':'تأیید گزارش'} open={!!decision}
      onOk={()=>void review()} onCancel={()=>{if(!busy)setDecision(undefined)}} confirmLoading={busy} okText="ثبت تصمیم" cancelText="انصراف">
      <Input.TextArea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={4}
        placeholder={decision==='return'?'دلیل برگشت را بنویسید':'یادداشت اختیاری'}/>
    </Modal>
  </Space>
}
