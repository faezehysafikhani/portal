import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Timeline, TimePicker, message } from 'antd'
import { CalendarOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import PersianDatePicker from '../../components/PersianDatePicker'
import { dateToJalali, formatJalaliDate, isLeapJalali, jalaliToDate } from '../../utils/jalali'
import { apiFetch } from '../../utils/api'
import TaskAssignmentsPanel from './TaskAssignmentsPanel'
import { ReportsReviewPanel } from './PerformanceInsightsPage'
import { EmployeeEvaluationPanel, PublishedEvaluationSummary } from './PeriodicEvaluationPage'

const API = 'http://localhost:5043/api/v1/performance/daily'
const labels = {
  me:'عملکرد من', tasks:'وظایف من', reports:'گزارش‌های من', review:'کارتابل تأیید گزارش‌های روزانه',
}
const reportStatus: Record<string,[string,string]> = {
  draft:['پیش‌نویس','default'], submitted:['در انتظار تأیید','blue'], approved:['تأییدشده','green'], returned:['نیازمند اصلاح','orange'],
}
const baselineKinds: Record<string,string> = {project:'فعالیت پروژه‌ای',internal:'فعالیت داخلی سازمان',meeting:'جلسه',recurring:'فعالیت تکرارشونده',other:'سایر'}
const exemptions:Record<string,string>={leave:'مرخصی تأییدشده',organization_holiday:'تعطیل سازمانی',official_holiday:'تعطیل رسمی',weekend:'روز غیرکاری',before_employment:'پیش از شروع همکاری'}
const activityStatus: Record<string,string> = {planned:'برنامه‌ریزی‌شده',in_progress:'در حال انجام',done:'تکمیل‌شده',blocked:'دارای مانع'}
const taskStatus = ['جدید','در حال انجام','در بررسی','تکمیل‌شده','لغوشده']
const priority = ['کم','متوسط','زیاد','فوری']
const actions: Record<string,string> = {create:'ثبت فعالیت',edit:'ویرایش فعالیت',submit:'ارسال گزارش',resubmit:'ارسال مجدد',approve:'تأیید گزارش',return:'برگشت برای اصلاح',reopen:'بازکردن گزارش برای اصلاح'}
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
  Projects?:{Name:string};Tasks?:{Title:string};projectName?:string;taskName?:string
  performance_daily_intervals:{id:string;start_minute:number;end_minute:number}[]
  performance_daily_attachments:Attachment[]
}
interface Category {id:string;label:string;active:boolean}
type Snapshot=Omit<Activity,'performance_daily_intervals'|'performance_daily_attachments'>&{intervals:Activity['performance_daily_intervals'];files:Attachment[]}
interface History {id:string;action:string;note?:string;actor_name?:string;created_at:string;snapshot?:Snapshot[]}
interface Report {
  id:string; work_date:string; status:string; employee_name?:string; submitted_at?:string; can_review?:boolean
  reviewed_at?:string;reviewer_name?:string;no_activity_reason?:string;can_download?:boolean;can_reopen?:boolean;categories?:Category[]
  performance_daily_activities?:{id:string;minutes:number}[]; activities?:Activity[]; history?:History[]
}
interface Task {Id:string; Title:string; Description?:string; AssignedByUserId?:string; AssignedByName?:string; CreatedAt:string; DueDate?:string; Priority:number; Status:number; Progress:number; ProjectId?:string; AssignmentState?:string}
interface ActivityPolicy { enabled:boolean;allowEmpty:boolean;allowPast:boolean;pastDays:number;allowManual:boolean;requireTime:boolean;requireDescription:boolean;
  requireOutcome:boolean;categories:Category[];files:{maxCount:number;maxBytes:number;totalBytes:number;mimes:string[]} }
interface CalendarDay {work_date:string;deadline:string;required:boolean;exemption?:string}
interface Options {tasks:Task[]; projects:{Id:string;Name:string}[]; today:string;policy?:ActivityPolicy}
interface ActivityFields {
  title:string; description:string; kind:string; status:string; timeMode:string; projectId?:string; taskId?:string
  hours?:number; minutesPart?:number; intervals?:{start:Dayjs;end:Dayjs}[]; outcome?:string; notes?:string
}
function monthDays(value: string) {
  const {jy,jm} = dateToJalali(localDate(value))
  const count = jm<=6?31:jm<=11||isLeapJalali(jy)?30:29
  return Array.from({length:count},(_,i)=>isoDate(jalaliToDate(`${jy}/${jm}/${i+1}`)))
}
function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = localDate(value)
  return Number.isFinite(date.getTime()) && isoDate(date) === value
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
  const page = (location.pathname.split('/').pop() || 'me') as keyof typeof labels
  const isMine = page==='me'
  const isReview = page==='review'
  const needsOwnReports = isMine || page==='reports'
  const [selectedDate,setSelectedDate] = useState(()=>{
    const requested = new URLSearchParams(location.search).get('date')
    return validDate(requested)?requested:tehranToday()
  })
  const [employeeId] = useState<string | undefined>(()=>{
    try { return JSON.parse(localStorage.getItem('user') || '{}').id }
    catch { return undefined }
  })
  const [options,setOptions] = useState<Options>({tasks:[],projects:[],today:tehranToday()})
  const [optionsReady,setOptionsReady] = useState(false)
  const [reports,setReports] = useState<Report[]>([])
  const [calendarDays,setCalendarDays] = useState<CalendarDay[]>([])
  const [datePolicy,setDatePolicy]=useState<ActivityPolicy>()
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [refresh,setRefresh] = useState(0)
  const [detail,setDetail] = useState<Report>()
  const [detailLoading,setDetailLoading] = useState(false)
  const [dateDetail,setDateDetail] = useState<Report>()
  const [activityLoading,setActivityLoading] = useState(false)
  const [itemDetail,setItemDetail] = useState<Activity>()
  const [snapshot,setSnapshot] = useState<History>()
  const [emptyReason,setEmptyReason] = useState<string>()
  const [editing,setEditing] = useState<{id:string;date:string;reportId?:string;activity?:Activity}>()
  const [files,setFiles] = useState<File[]>([])
  const [removed,setRemoved] = useState<string[]>([])
  const [busy,setBusy] = useState(false)
  const [decision,setDecision] = useState<'approve'|'return'>()
  const [note,setNote] = useState('')
  const [search,setSearch] = useState('')
  const [kindFilter,setKindFilter] = useState<string>()
  const [statusFilter,setStatusFilter] = useState<string>()
  const [reportFilter,setReportFilter] = useState<string>()
  const [monthOnly,setMonthOnly] = useState(false)
  const [form] = Form.useForm<ActivityFields>()
  const timeMode = Form.useWatch('timeMode',form)
  const intervals = Form.useWatch('intervals',form)
  const linkedTask = Form.useWatch('taskId',form)
  const activityState = Form.useWatch('status',form)
  const reload = () => setRefresh(value=>value+1)
  const days = monthDays(selectedDate)
  const monthStart = days[0], monthEnd = days[days.length-1]
  const selectedReport = reports.find(r=>r.work_date===selectedDate)
  const activeItems = dateDetail?.id===selectedReport?.id ? dateDetail?.activities ?? [] : []
  const selectedActivities = selectedReport?.performance_daily_activities ?? []
  const assignedTasks = options.tasks.filter(task=>task.AssignedByUserId && task.AssignedByUserId!==employeeId)
  const legacyTasks = assignedTasks.filter(task=>!task.AssignmentState)
  const ownReports = reports.filter(r=>r.status!=='draft' && (!reportFilter || r.status===reportFilter)
    && (!monthOnly || (r.work_date>=monthStart && r.work_date<=monthEnd)))
  const policy=datePolicy??options.policy
  const kinds={...baselineKinds,...Object.fromEntries((policy?.categories??[]).map(c=>[c.id,c.label]))}
  const categories=policy?.categories.filter(c=>c.active||c.id===editing?.activity?.kind).map(c=>({value:c.id,label:c.label}))??optionsOf(baselineKinds)
  const policyDate=editing?.date??selectedDate
  useEffect(()=>{
    if(!editing||!policy||timeMode!=='manual'||policy.allowManual)return
    if(!editing.activity || editing.activity.minutes===0)form.setFieldValue('timeMode',policy.requireTime?'intervals':'none')
  },[editing,form,policy,timeMode])

  useEffect(()=>{
    let alive = true
    request<Options>('/options').then(data=>{if(alive){setOptions(data);setOptionsReady(true)}}).catch(e=>{if(alive)setError(errorText(e))})
    return ()=>{alive=false}
  },[refresh])
  useEffect(()=>{
    let alive = true
    setLoading(true);setError('')
    if (needsOwnReports) {
      Promise.all([request<Report[]>('/reports'),request<{days:CalendarDay[]}>(`/calendar?from=${monthStart}&to=${monthEnd}`)])
        .then(([items,calendar])=>{if(alive){setReports(items);setCalendarDays(calendar.days??[])}})
        .catch(e=>{if(alive)setError(errorText(e))}).finally(()=>{if(alive)setLoading(false)})
    } else {
      setLoading(false)
    }
    return ()=>{alive=false}
  },[needsOwnReports,monthStart,monthEnd,refresh])
  useEffect(()=>{
    let active=true
    setDatePolicy(undefined)
    if(isMine)request<ActivityPolicy>(`/policy?date=${policyDate}`).then(p=>{if(active)setDatePolicy(p)})
      .catch(e=>{if(active)setError(errorText(e))})
    return()=>{active=false}
  },[policyDate,isMine,refresh])
  const selectedId = selectedReport?.id
  useEffect(()=>{
    let alive = true
    setDateDetail(undefined)
    setActivityLoading(Boolean(selectedId && isMine))
    if (selectedId && isMine) {
      request<Report>(`/reports/${selectedId}`).then(data=>{if(alive)setDateDetail(data)})
        .catch(e=>{if(alive)setError(errorText(e))}).finally(()=>{if(alive)setActivityLoading(false)})
    }
    return ()=>{alive=false}
  },[selectedId,isMine,refresh])

  const edit = useCallback((forDate: string, item?: Activity, task?: Task, report?: Report) => {
    const source = item && report
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
  },[form])
  useEffect(()=>{
    if (!isMine || !location.search) return
    const params = new URLSearchParams(location.search)
    const requestedDate = params.get('date')
    const taskId = params.get('task')
    const forDate = validDate(requestedDate)?requestedDate:options.today
    setSelectedDate(forDate)
    if (taskId) {
      if (!optionsReady) return
      const task = options.tasks.find(item=>item.Id===taskId && item.AssignedByUserId && item.AssignedByUserId!==employeeId)
      if (task) edit(forDate,undefined,task)
      else message.warning('این وظیفه در فهرست وظایف واگذارشدهٔ شما نیست')
    } else if (params.get('new')==='1') {
      edit(forDate)
    }
    navigate('/performance/me',{replace:true})
  },[edit,employeeId,isMine,location.search,navigate,options.tasks,options.today,optionsReady])
  const goToWorkDate = (date: string) => {
    setDetail(undefined)
    navigate(`/performance/me?date=${encodeURIComponent(date)}`)
  }
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
      setSelectedDate(editing.date);setEditing(undefined);reload()
    } catch(e) { message.error(errorText(e)) }
    finally {setBusy(false)}
  }
  const submit = (date: string) => Modal.confirm({
    title:'ارسال گزارش روزانه',content:`گزارش ${formatJalaliDate(localDate(date))} برای بررسی مدیر ارسال شود؟`,
    okText:'ارسال گزارش',cancelText:'انصراف',onOk:async()=>{
      try {
        await request<{id:string}>('/submit','POST',{date})
        message.success('گزارش برای مدیر ارسال شد');reload()
      }
      catch(e){message.error(errorText(e));throw e}
    },
  })
  async function submitEmpty(){
    if(!emptyReason?.trim()){message.warning('دلیل نداشتن فعالیت الزامی است');return}
    setBusy(true)
    try{
      await request('/submit','POST',{date:selectedDate,reason:emptyReason.trim()})
      message.success('گزارش بدون فعالیت ارسال شد');setEmptyReason(undefined);reload()
    }catch(e){message.error(errorText(e))}
    finally{setBusy(false)}
  }
  const openReport = useCallback(async (id:string,next?:'approve'|'return') => {
    setDetail(undefined);setDetailLoading(true)
    try {
      const report=await request<Report>(`/reports/${id}`)
      setDetail(report)
      if(next&&report.can_review&&report.status==='submitted'){setNote('');setDecision(next)}
    }
    catch(e){message.error(errorText(e));setDetail(undefined)}
    finally{setDetailLoading(false)}
  },[])
  const view=(report:Report)=>openReport(report.id)
  useEffect(()=>{
    const id=new URLSearchParams(location.search).get('report')
    if(!id||(!isReview&&page!=='reports'))return
    void openReport(id);navigate(location.pathname,{replace:true})
  },[location.pathname,location.search,isReview,navigate,openReport,page])
  async function download(file: Attachment) {
    try {
      const response = await apiFetch(`${API}/files/${file.id}`)
      if (!response.ok) throw new Error((await response.json().catch(()=>({}))).message||'دریافت پیوست انجام نشد')
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
  const stateFor=(date:string)=>calendarDays.find(d=>d.work_date===date)
  const labelFor=(a:Activity,report?:Report)=>report?.categories?.find(c=>c.id===a.kind)?.label??kinds[a.kind]??a.kind
  const projectFor=(a:Activity)=>a.Projects?.Name||a.projectName||options.projects.find(p=>p.Id===a.project_id)?.Name||(a.project_id?'پروژه مرتبط':'فعالیت غیرپروژه‌ای')
  const taskFor=(a:Activity)=>a.Tasks?.Title||a.taskName||options.tasks.find(t=>t.Id===a.task_id)?.Title||'—'
  const renderActivities = (items: Activity[], report?: Report, allowEdit = false) => (
    <Table rowKey="id" dataSource={items} loading={allowEdit && (loading || activityLoading)}
      scroll={{x:920}} pagination={{pageSize:8,showSizeChanger:false}} locale={{emptyText:'فعالیتی ثبت نشده است'}} columns={[
      {title:'فعالیت',dataIndex:'title',sorter:(a,b)=>a.title.localeCompare(b.title,'fa')},
      {title:'نوع',render:(_,a)=>labelFor(a,report)},
      {title:'تاریخ',render:()=>formatJalaliDate(localDate(report?.work_date ?? selectedDate))},
      {title:'پروژه',render:(_,a)=>projectFor(a)},
      ...(!allowEdit&&report?[
        {title:'وظیفه',render:(_:unknown,a:Activity)=>taskFor(a)},
        {title:'شروع و پایان',render:(_:unknown,a:Activity)=><Space wrap>{a.performance_daily_intervals.map(r=><Tag key={r.id}><span dir="ltr">{clock(r.start_minute)} - {clock(r.end_minute)}</span></Tag>)}</Space>},
        {title:'شرح و خروجی',render:(_:unknown,a:Activity)=><span style={{whiteSpace:'pre-wrap'}}>{[a.description,a.outcome].filter(Boolean).join('\n')||'—'}</span>},
      ]:[]),
      {title:'وضعیت انجام',dataIndex:'status',render:(value:string)=><Tag>{activityStatus[value]}</Tag>},
      {title:'مدت‌زمان',dataIndex:'minutes',sorter:(a,b)=>a.minutes-b.minutes,render:duration},
      {title:'پیوست‌ها',render:(_,item)=>item.performance_daily_attachments.length
        ? <Button type="link" size="small" onClick={()=>setItemDetail(item)}>{fa(item.performance_daily_attachments.length)} فایل</Button> : '—'},
      {title:'عملیات',render:(_,item)=><Space><Button size="small" onClick={()=>setItemDetail(item)}>جزئیات</Button>
        {allowEdit && report && editable(report.status) && <Button size="small" onClick={()=>edit(report.work_date,item,undefined,report)}>ویرایش و ثبت زمان</Button>}</Space>},
    ]}/>
  )
  const reportsTable = (data: Report[]) => (
    <Table rowKey="id" loading={loading} dataSource={data} scroll={{x:700}} pagination={{pageSize:10}} locale={{emptyText:'گزارشی برای نمایش وجود ندارد'}} columns={[
      ...(isReview ? [{title:'کارمند',dataIndex:'employee_name',render:(value:string)=>value || '—'}] : []),
      {title:'تاریخ',dataIndex:'work_date',render:(value:string)=>formatJalaliDate(localDate(value)),sorter:(a,b)=>a.work_date.localeCompare(b.work_date)},
      {title:'وضعیت گزارش',dataIndex:'status',render:statusTag},
      {title:'فعالیت‌ها',render:(_,item)=>fa(item.performance_daily_activities?.length ?? 0)},
      {title:'مجموع زمان',render:(_,item)=>duration(item.performance_daily_activities?.reduce((n,a)=>n+a.minutes,0) ?? 0)},
      {title:'عملیات',render:(_,item)=><Space wrap>
        <Button size="small" onClick={()=>void view(item)}>{isReview?'مشاهده گزارش':'جزئیات و بازخورد'}</Button>
        {!isReview && item.status==='returned' && <Button size="small" onClick={()=>goToWorkDate(item.work_date)}>اصلاح گزارش</Button>}
      </Space>},
    ]}/>
  )
  const calendarDay=stateFor(selectedDate),dayException=exemptions[calendarDay?.exemption??'']
  const pastDays=(Date.parse(options.today)-Date.parse(selectedDate))/86400000
  const canLogSelectedDate=policy?.enabled!==false&&selectedDate<=options.today&&editable(selectedReport?.status)
  const canAdd=canLogSelectedDate&&(pastDays===0||(policy?.allowPast!==false&&(!policy?.pastDays||pastDays<=policy.pastDays)))

  return <Space direction="vertical" size="middle" style={{width:'100%'}} dir="rtl">
    {page==='tasks' && <TaskAssignmentsPanel/>}
    {isMine&&<PublishedEvaluationSummary/>}
    {(page!=='tasks' || legacyTasks.length>0 || error) &&
    <Card title={<Space><CalendarOutlined/>{labels[page] ?? labels.me}</Space>}>
      {error && <Alert type="error" showIcon message={error} style={{marginBottom:16}} action={<Button size="small" onClick={reload}>تلاش مجدد</Button>}/>}
      {isMine && <Space direction="vertical" size="middle" style={{width:'100%'}}>
        <Row gutter={[16,16]}>
          <Col xs={12} md={8}><Card size="small"><Statistic title="فعالیت‌های روز" loading={loading} value={fa(selectedActivities.length)}/></Card></Col>
          <Col xs={12} md={8}><Card size="small"><Statistic title="مجموع زمان روز" loading={loading} value={duration(selectedActivities.reduce((n,a)=>n+a.minutes,0))}/></Card></Col>
          <Col xs={24} md={8}><Card size="small"><Statistic title="وضعیت گزارش" loading={loading} valueRender={()=>statusTag(selectedReport?.status)}/></Card></Col>
        </Row>
        {!loading && selectedReport?.status==='returned' && <Alert type="warning" showIcon
          message="گزارش این روز برای اصلاح برگشته است."
          action={<Button size="small" onClick={()=>void view(selectedReport)}>مشاهده بازخورد</Button>}/>}
        {!loading && calendarDay?.required && Date.now()>Date.parse(calendarDay.deadline) && (!selectedReport || selectedReport.status==='draft') &&
          <Alert type="warning" showIcon message="مهلت ارسال گزارش این روز کاری گذشته است."/>}
        <Space wrap>
          <PersianDatePicker value={shamsi(selectedDate)} onChange={d=>{if(d)setSelectedDate(isoDate(jalaliToDate(d)))}}/>
          {dayException && <Tag>{dayException}</Tag>}
          {calendarDay?.required && <Tag>مهلت ارسال {dateTime(calendarDay.deadline)}</Tag>}
          {selectedReport && <Button onClick={()=>void view(selectedReport)}>جزئیات گزارش</Button>}
          {canLogSelectedDate && <>
            {canAdd&&<Button icon={<PlusOutlined/>} disabled={loading} onClick={()=>edit(selectedDate)}>ثبت فعالیت جدید</Button>}
            {selectedActivities.length>0?<Button type="primary" disabled={loading} onClick={()=>submit(selectedDate)}>ارسال گزارش روزانه</Button>
             :policy?.allowEmpty&&<Button type="primary" disabled={loading} onClick={()=>setEmptyReason('')}>ارسال گزارش بدون فعالیت</Button>}
          </>}
        </Space>
        <Space wrap>
          <Input.Search placeholder="جست‌وجوی فعالیت" allowClear value={search} onChange={e=>setSearch(e.target.value)} style={{width:220}}/>
          <Select placeholder="نوع فعالیت" allowClear value={kindFilter} onChange={setKindFilter} options={optionsOf(kinds)} style={{width:170}}/>
          <Select placeholder="وضعیت انجام" allowClear value={statusFilter} onChange={setStatusFilter} options={optionsOf(activityStatus)} style={{width:160}}/>
        </Space>
        {renderActivities(activeItems.filter(a=>(!kindFilter||a.kind===kindFilter)&&(!statusFilter||a.status===statusFilter)
          && `${a.title} ${a.description}`.toLocaleLowerCase('fa').includes(search.trim().toLocaleLowerCase('fa'))),selectedReport,true)}
        <Space wrap size="middle">
          <span>وظایف در حال انجام {fa(assignedTasks.filter(t=>[1,2].includes(t.Status)).length)}</span>
          <span>تکمیل‌شده {fa(assignedTasks.filter(t=>t.Status===3).length)}</span>
          <span>معوق {fa(assignedTasks.filter(t=>t.DueDate && t.DueDate.slice(0,10)<options.today && ![3,4].includes(t.Status)).length)}</span>
          <span>گزارش‌های نیازمند اصلاح {fa(reports.filter(r=>r.status==='returned').length)}</span>
        </Space>
      </Space>}
      {page==='tasks' && <Table rowKey="Id" dataSource={legacyTasks} loading={!optionsReady && !error} scroll={{x:1050}} pagination={{pageSize:10}} locale={{emptyText:'وظیفه‌ای به شما واگذار نشده است'}}
        expandable={{expandedRowRender:task=><p style={{whiteSpace:'pre-wrap'}}>{task.Description || 'شرحی ثبت نشده است'}</p>}} columns={[
          {title:'عنوان وظیفه',dataIndex:'Title'},{title:'واگذارکننده',dataIndex:'AssignedByName',render:(v:string)=>v || '—'},
          {title:'تاریخ واگذاری',dataIndex:'CreatedAt',render:(v:string)=>formatJalaliDate(new Date(v))},
          {title:'مهلت انجام',dataIndex:'DueDate',render:(v?:string)=>v?formatJalaliDate(new Date(v)):'—'},
          {title:'اولویت',dataIndex:'Priority',render:(v:number)=>priority[v] ?? '—'},
          {title:'وضعیت',dataIndex:'Status',render:(v:number)=>taskStatus[v] ?? '—'},
          {title:'پیشرفت',dataIndex:'Progress',render:(v:number)=>`${fa(v ?? 0)}٪`},
          {title:'عملیات',render:(_,task)=><Button size="small" onClick={()=>navigate(`/performance/me?task=${encodeURIComponent(task.Id)}`)}>ثبت فعالیت</Button>},
        ]}/>}
      {page==='reports' && <Tabs destroyOnHidden activeKey={(() => {
        const params=new URLSearchParams(location.search)
        if(params.get('tab')==='improvement')return 'improvement'
        return params.has('evaluation')||params.get('tab')==='periodic'?'periodic':'daily'
      })()} onChange={tab=>{
        const params=new URLSearchParams(location.search)
        params.delete('evaluation')
        if(tab==='daily')params.delete('tab')
        else params.set('tab',tab)
        navigate({search:params.toString()},{replace:true})
      }} items={[
        {key:'daily',label:'گزارش‌های روزانه',children:<Space direction="vertical" style={{width:'100%'}} size="middle">
        <Space wrap>تقویم گزارش‌ها <PersianDatePicker value={shamsi(selectedDate)} onChange={d=>{if(d)setSelectedDate(isoDate(jalaliToDate(d)))}}/></Space>
        <Row gutter={[8,8]}>
          {days.map(date=>{
            const report=reports.find(r=>r.work_date===date)
            const dayPolicy=stateFor(date),label=exemptions[dayPolicy?.exemption??'']
            const day=dateToJalali(localDate(date)).jd
            const missing=!loading && dayPolicy?.required && Date.now()>Date.parse(dayPolicy.deadline) && (!report || report.status==='draft')
            return <Col key={date} xs={12} sm={8} md={6} lg={4}>
              <Button block style={{height:'auto',padding:'6px'}} disabled={!report && date>options.today} onClick={()=>{
                if(report && report.status!=='draft')void view(report)
                else goToWorkDate(date)
              }}>
                <div>{fa(day)}</div><Tag color={missing?'red':report?reportStatus[report.status]?.[1]:'default'}>
                  {report?(missing?'ارسال نشده':reportStatus[report.status]?.[0]):label || (missing?'بدون گزارش':'—')}
                </Tag>
              </Button>
            </Col>
          })}
        </Row>
        <Space wrap>
          <Select placeholder="وضعیت گزارش" allowClear value={reportFilter} onChange={setReportFilter} style={{width:170}}
            options={Object.entries(reportStatus).filter(([key])=>key!=='draft').map(([value,[label]])=>({value,label}))}/>
          <Select value={monthOnly?'month':'all'} onChange={value=>setMonthOnly(value==='month')} style={{width:140}}
            options={[{value:'all',label:'همهٔ ماه‌ها'},{value:'month',label:'ماه انتخاب‌شده'}]}/>
        </Space>
        {reportsTable(ownReports)}
        </Space>},
        {key:'periodic',label:'ارزیابی‌های من',children:<EmployeeEvaluationPanel/>},
        {key:'improvement',label:'برنامه بهبود من',children:<EmployeeEvaluationPanel improvement/>},
      ]}/>}
      {isReview && <ReportsReviewPanel open={(id,next)=>void openReport(id,next)} refresh={refresh}/>}
    </Card>}
    <Modal title={editing?.activity?'ویرایش فعالیت':'ثبت فعالیت'} open={!!editing} onCancel={()=>{if(!busy)setEditing(undefined)}}
      onOk={()=>form.submit()} okText="ذخیره فعالیت" cancelText="انصراف" confirmLoading={busy} width={760} forceRender>
      <Form form={form} layout="vertical" onFinish={save}>
        <Row gutter={12}>
          <Col xs={24} md={12}><Form.Item name="title" label="عنوان فعالیت" rules={[{required:true,whitespace:true}]}><Input maxLength={180}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label="تاریخ فعالیت" required>
            <PersianDatePicker disabled={!!editing?.activity} value={editing?shamsi(editing.date):undefined}
              onChange={d=>setEditing(current=>current?{...current,date:isoDate(jalaliToDate(d))}:current)}/>
          </Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="kind" label="نوع فعالیت" rules={[{required:true}]}><Select options={categories}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="status" label="وضعیت انجام" rules={[{required:true}]}><Select options={optionsOf(activityStatus)}/></Form.Item></Col>
          <Col xs={24}><Form.Item name="description" label="شرح فعالیت" rules={[{required:policy?.requireDescription!==false,whitespace:policy?.requireDescription!==false}]}><Input.TextArea rows={3} maxLength={4000}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="taskId" label="وظیفه مرتبط">
            <Select showSearch optionFilterProp="label" allowClear options={options.tasks.map(t=>({value:t.Id,label:t.Title}))}
              onChange={value=>form.setFieldValue('projectId',options.tasks.find(t=>t.Id===value)?.ProjectId ?? undefined)}/>
          </Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="projectId" label="پروژه مرتبط" extra={linkedTask?'پروژه از وظیفه خوانده می‌شود.':undefined}>
            <Select showSearch optionFilterProp="label" allowClear disabled={!!linkedTask} options={options.projects.map(p=>({value:p.Id,label:p.Name}))}/>
          </Form.Item></Col>
        </Row>
        <Form.Item name="timeMode" label="روش ثبت زمان"><Select options={[
          ...(policy?.allowManual===false?[]:[{value:'manual',label:'مدت به‌صورت دستی'}]),
          ...(policy?.requireTime===false?[{value:'none',label:'بدون ثبت زمان'}]:[]),
          {value:'intervals',label:'بازه‌های شروع و پایان'}]}/></Form.Item>
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
        </Form.List> : timeMode==='manual'&&<Space wrap>
          <Form.Item name="hours" label="ساعت"><InputNumber min={0} max={24} precision={0}/></Form.Item>
          <Form.Item name="minutesPart" label="دقیقه"><InputNumber min={0} max={59} precision={0}/></Form.Item>
        </Space>}
        <Form.Item name="outcome" label="نتیجه یا خروجی کار" rules={[{required:policy?.requireOutcome&&activityState==='done',whitespace:policy?.requireOutcome&&activityState==='done'}]}><Input.TextArea maxLength={2000}/></Form.Item>
        <Form.Item name="notes" label="توضیحات تکمیلی"><Input.TextArea maxLength={2000}/></Form.Item>
        <Form.Item label="پیوست‌ها" extra={`حداکثر ${fa(policy?.files.maxCount??5)} فایل، هر فایل ${fa((policy?.files.maxBytes??1048576)/1024)} کیلوبایت`}>
          <input key={editing?.id} type="file" multiple disabled={policy?.files.maxCount===0} accept={policy?.files.mimes.join(',')??'.pdf,.jpg,.jpeg,.png,.txt'} onChange={e=>{
            const picked=Array.from(e.target.files ?? [])
            const retained=editing?.activity?.performance_daily_attachments.filter(f=>!removed.includes(f.id))??[]
            if (picked.length+retained.length>(policy?.files.maxCount??5) || picked.some(f=>!f.size||f.size>(policy?.files.maxBytes??1048576))
              || picked.reduce((n,f)=>n+f.size,retained.reduce((n,f)=>n+f.size_bytes,0))>(policy?.files.totalBytes??5242880)) {
              message.error('تعداد یا حجم فایل‌ها بیش از حد مجاز است');e.target.value='';setFiles([]);return
            }
            setFiles(picked)
          }}/>
          {editing?.activity?.performance_daily_attachments.filter(f=>!removed.includes(f.id)).map(f=>
            <div key={f.id}><Button type="link" onClick={()=>void download(f)}>{f.name}</Button><Button size="small" danger onClick={()=>setRemoved(v=>[...v,f.id])}>حذف از فعالیت</Button></div>)}
        </Form.Item>
      </Form>
    </Modal>
    <Modal title="جزئیات گزارش روزانه" open={detailLoading||!!detail} onCancel={()=>setDetail(undefined)} footer={null} width={1050}>
      {detailLoading ? <Spin/> : detail && <Space direction="vertical" style={{width:'100%'}}>
        <Space wrap>{detail.employee_name && <strong>{detail.employee_name}</strong>}{formatJalaliDate(localDate(detail.work_date))}{statusTag(detail.status)}
          {detail.submitted_at && <span>ارسال {dateTime(detail.submitted_at)}</span>}
          <Tag>{fa(detail.activities?.length??0)} فعالیت</Tag><Tag>{duration(detail.activities?.reduce((n,a)=>n+a.minutes,0)??0)}</Tag>
          {detail.reviewed_at&&<span>بررسی {detail.reviewer_name} · {dateTime(detail.reviewed_at)}</span>}
        </Space>
        {detail.no_activity_reason&&<Alert type="info" showIcon message="گزارش بدون فعالیت" description={detail.no_activity_reason}/>}
        {renderActivities(detail.activities ?? [],detail)}
        {page==='reports' && detail.status==='returned' &&
          <Button type="primary" onClick={()=>goToWorkDate(detail.work_date)}>اصلاح در عملکرد من</Button>}
        {detail.can_reopen&&<Button onClick={()=>Modal.confirm({title:'بازکردن گزارش برای اصلاح',content:'پس از اصلاح، گزارش را دوباره ارسال کنید.',
          okText:'بازکردن',cancelText:'انصراف',onOk:async()=>{try{await request(`/reports/${detail.id}/reopen`,'POST');goToWorkDate(detail.work_date);reload()}
            catch(e){message.error(errorText(e));throw e}}})}>بازکردن برای اصلاح</Button>}
        {isReview && detail.can_review && detail.status==='submitted' && <Space wrap>
          <Button type="primary" onClick={()=>{setDecision('approve');setNote('')}}>تأیید گزارش</Button>
          <Button onClick={()=>{setDecision('return');setNote('')}}>برگشت برای اصلاح</Button>
        </Space>}
        <Card size="small" title="تاریخچه و بازخورد">
          <Timeline items={(detail.history ?? []).map(h=>({children:<div><strong>{actions[h.action] ?? h.action}</strong>
            <div>{[h.actor_name,dateTime(h.created_at)].filter(Boolean).join(' · ')}</div>{h.note&&<p style={{whiteSpace:'pre-wrap'}}>{h.note}</p>}
            {h.snapshot&&<Button type="link" onClick={()=>setSnapshot(h)}>نسخهٔ ارسال‌شده</Button>}</div>}))}/>
        </Card>
      </Space>}
    </Modal>
    <Modal title={itemDetail?.title} open={!!itemDetail} onCancel={()=>setItemDetail(undefined)} footer={null} width={640}>
      {itemDetail && <Descriptions bordered size="small" column={1} items={[
        {key:'kind',label:'نوع و وضعیت',children:`${labelFor(itemDetail,detail)} · ${activityStatus[itemDetail.status]}`},
        {key:'project',label:'پروژه',children:projectFor(itemDetail)},
        {key:'task',label:'وظیفه',children:taskFor(itemDetail)},
        {key:'desc',label:'شرح',children:<span style={{whiteSpace:'pre-wrap'}}>{itemDetail.description}</span>},
        {key:'time',label:'زمان',children:<Space wrap>{duration(itemDetail.minutes)}<Tag>{itemDetail.time_mode==='manual'?'دستی':'بازه زمانی'}</Tag>
          {itemDetail.performance_daily_intervals.map(r=><Tag key={r.id}><span dir="ltr">{clock(r.start_minute)} - {clock(r.end_minute)}</span></Tag>)}</Space>},
        ...(itemDetail.outcome?[{key:'outcome',label:'خروجی',children:itemDetail.outcome}]:[]),
        ...(itemDetail.notes?[{key:'note',label:'توضیحات',children:itemDetail.notes}]:[]),
        {key:'files',label:'پیوست‌ها',children:<Space wrap>{itemDetail.performance_daily_attachments.length?itemDetail.performance_daily_attachments.map(f=>
          detail?.can_download===false?<Tag key={f.id}>{f.name}</Tag>:
          <Button key={f.id} icon={<DownloadOutlined/>} onClick={()=>void download(f)}>{f.name}</Button>):'—'}</Space>},
      ]}/>}
    </Modal>
    <Modal title={snapshot?`نسخهٔ ارسال‌شده · ${dateTime(snapshot.created_at)}`:''} open={!!snapshot} onCancel={()=>setSnapshot(undefined)} footer={null} width={1000}>
      {snapshot&&renderActivities((snapshot.snapshot??[]).map(a=>({...a,performance_daily_intervals:a.intervals,performance_daily_attachments:a.files})),detail)}
    </Modal>
    <Modal title="ارسال گزارش بدون فعالیت" open={emptyReason!==undefined} onCancel={()=>setEmptyReason(undefined)} onOk={()=>void submitEmpty()}
      okText="ارسال برای مدیر" cancelText="انصراف" confirmLoading={busy}>
      <Input.TextArea value={emptyReason} onChange={e=>setEmptyReason(e.target.value)} placeholder="دلیل نداشتن فعالیت در این روز" maxLength={2000} rows={4}/>
    </Modal>
    <Modal title={decision==='return'?'برگشت گزارش برای اصلاح':'تأیید گزارش'} open={!!decision}
      onOk={()=>void review()} onCancel={()=>{if(!busy)setDecision(undefined)}} confirmLoading={busy} okText="ثبت تصمیم" cancelText="انصراف">
      <Input.TextArea value={note} onChange={e=>setNote(e.target.value)} maxLength={2000} rows={4}
        placeholder={decision==='return'?'دلیل برگشت را بنویسید':'یادداشت اختیاری'}/>
    </Modal>
  </Space>
}
