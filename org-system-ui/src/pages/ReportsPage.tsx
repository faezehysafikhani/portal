import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Empty, message, Row, Space, Spin, Statistic, Table, Tabs, Tag } from 'antd'
import { CheckSquareOutlined, CustomerServiceOutlined, DownloadOutlined, FileTextOutlined, MailOutlined, MessageOutlined, PrinterOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiFetch } from '../utils/api'

const API='http://localhost:5043/api/v1'
const COLORS=['#8b1a6b','#1677ff','#52c41a','#fa8c16','#f5222d','#722ed1']
const faDate=(v?:string)=>v?new Date(v).toLocaleDateString('fa-IR'):'—'
const typeLabel:Record<string,string>={Internal:'داخلی',Incoming:'وارده',Outgoing:'صادره'}
const statusLabel:Record<string,string>={Draft:'پیش‌نویس',Sent:'ارسال شده',Received:'دریافت شده',InReview:'در بررسی',Signed:'امضا شده',Referred:'ارجاع شده',Archived:'بایگانی',Cancelled:'لغو شده',Todo:'جدید',InProgress:'در حال انجام',InReviewTask:'بازبینی',Done:'تکمیل شده',CancelledTask:'لغو شده',open:'باز',inprogress:'در حال بررسی',waiting:'در انتظار',resolved:'حل شده',closed:'بسته',manager_pending:'در بررسی مدیر',hr_pending:'در بررسی منابع انسانی',approved:'تأیید نهایی',rejected:'رد شده',returned:'برگشت برای اصلاح'}
const labelStatus=(value:string)=>statusLabel[value]||value

export default function ReportsPage(){
  const [data,setData]=useState<any>()
  const [loading,setLoading]=useState(true)
  const load=async()=>{setLoading(true);const response=await apiFetch(`${API}/reports/dashboard`);const result=await response.json().catch(()=>({}));setLoading(false);if(!response.ok){message.error(result.message||'دریافت گزارش‌ها انجام نشد');return}setData(result)}
  useEffect(()=>{load()},[])
  const exportCsv=(rows:any[],name:string)=>{if(!rows?.length)return message.warning('داده‌ای برای خروجی وجود ندارد');const keys=Object.keys(rows[0]);const clean=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv='\uFEFF'+[keys.join(','),...rows.map(r=>keys.map(k=>clean(r[k])).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`${name}.csv`;a.click();URL.revokeObjectURL(a.href)}
  if(loading)return <div style={{height:420,display:'grid',placeItems:'center'}}><Spin size="large" tip="در حال خواندن گزارش از دیتابیس"/></div>
  if(!data)return <Alert type="error" showIcon message="گزارش‌ها از سرور دریافت نشد" action={<Button onClick={load}>تلاش مجدد</Button>}/>
  const cards=[
    {label:'کل نامه‌ها',value:data.summary.letterCount,color:'#8b1a6b',icon:<MailOutlined/>},
    {label:'وظایف فعال',value:data.summary.activeTasks,color:'#1677ff',icon:<CheckSquareOutlined/>},
    {label:'تیکت‌های باز',value:data.summary.openTickets,color:'#fa8c16',icon:<CustomerServiceOutlined/>},
    {label:'پیامک ارسال‌شده',value:data.summary.sentSms,color:'#722ed1',icon:<MessageOutlined/>},
    {label:'فرم در انتظار',value:data.summary.pendingForms,color:'#f5222d',icon:<FileTextOutlined/>},
    {label:'کاربران فعال',value:data.summary.activeUsers,color:'#52c41a',icon:<TeamOutlined/>}
  ]
  const letterColumns=[{title:'شماره',dataIndex:'number'},{title:'نوع',dataIndex:'type',render:(v:string)=><Tag>{typeLabel[v]||v}</Tag>},{title:'موضوع',dataIndex:'subject'},{title:'فرستنده',dataIndex:'from'},{title:'تاریخ',dataIndex:'date',render:faDate},{title:'وضعیت',dataIndex:'status',render:(v:string)=><Tag color="purple">{labelStatus(v)}</Tag>}]
  const taskColumns=[{title:'کد',dataIndex:'id',render:(v:string)=>`TSK-${v.slice(0,8)}`},{title:'عنوان',dataIndex:'title'},{title:'مسئول',dataIndex:'assignee',render:(v?:string)=>v||'—'},{title:'وضعیت',dataIndex:'status',render:(v:string)=><Tag color="blue">{labelStatus(v)}</Tag>},{title:'اولویت',dataIndex:'priority'},{title:'پیشرفت',dataIndex:'progress',render:(v:number)=>`${v}%`},{title:'مهلت',dataIndex:'dueDate',render:faDate}]
  const ticketColumns=[{title:'کد',dataIndex:'code'},{title:'عنوان',dataIndex:'title'},{title:'مشتری',dataIndex:'customer'},{title:'دسته',dataIndex:'category'},{title:'مسئول',dataIndex:'assignee',render:(v?:string)=>v||'—'},{title:'وضعیت',dataIndex:'status',render:(v:string)=><Tag color="orange">{labelStatus(v)}</Tag>},{title:'تاریخ ثبت',dataIndex:'createdAt',render:faDate}]
  const formColumns=[{title:'عنوان',dataIndex:'title'},{title:'ثبت‌کننده',dataIndex:'submitterName'},{title:'مدیر مستقیم',dataIndex:'managerName'},{title:'منابع انسانی',dataIndex:'hrName'},{title:'وضعیت',dataIndex:'status',render:(v:string)=><Tag color="magenta">{labelStatus(v)}</Tag>},{title:'ساعت مرخصی',dataIndex:'requestedHours'},{title:'تاریخ',dataIndex:'createdAt',render:faDate}]
  const pie=(items:any[])=>items?.length?<ResponsiveContainer width="100%" height={260}><PieChart><Pie data={items} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label={({name,value})=>{const key=String(name||'');return `${labelStatus(typeLabel[key]||key)}: ${value}`}}>{items.map((_:any,i:number)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>:<Empty/>
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div><h2 style={{margin:0}}>📊 گزارشات واقعی سیستم</h2><small style={{color:'#888'}}>تمام اعداد و جداول مستقیماً از دیتابیس خوانده شده‌اند</small></div><Space><Button icon={<ReloadOutlined/>} onClick={load}>به‌روزرسانی</Button><Button icon={<PrinterOutlined/>} onClick={()=>window.print()}>چاپ</Button></Space></div>
    <Row gutter={[12,12]} style={{marginBottom:16}}>{cards.map((c:any)=><Col xs={12} md={8} xl={4} key={c.label}><Card size="small" style={{borderTop:`4px solid ${c.color}`,borderRadius:12}}><Statistic title={c.label} value={c.value} prefix={<span style={{color:c.color}}>{c.icon}</span>}/></Card></Col>)}</Row>
    <Tabs items={[
      {key:'summary',label:'نمای کلی',children:<Row gutter={[16,16]}><Col xs={24} xl={16}><Card title="روند ثبت اطلاعات در ۶ ماه اخیر"><ResponsiveContainer width="100%" height={300}><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip/><Legend/><Bar dataKey="internalLetters" name="نامه داخلی" fill="#8b1a6b"/><Bar dataKey="incomingLetters" name="نامه وارده" fill="#1677ff"/><Bar dataKey="outgoingLetters" name="نامه صادره" fill="#52c41a"/><Bar dataKey="tasks" name="وظیفه" fill="#fa8c16"/><Bar dataKey="tickets" name="تیکت" fill="#722ed1"/><Bar dataKey="forms" name="فرم" fill="#f5222d"/></BarChart></ResponsiveContainer></Card></Col><Col xs={24} xl={8}><Card title="نوع نامه‌ها">{pie(data.letterTypes)}</Card></Col></Row>},
      {key:'letters',label:'نامه‌ها',children:<Card title="آخرین نامه‌های ثبت‌شده" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.letters,'letters-report')}>خروجی CSV</Button>}><Table rowKey="id" columns={letterColumns} dataSource={data.letters} scroll={{x:850}}/></Card>},
      {key:'tasks',label:'وظایف',children:<Row gutter={[16,16]}><Col xs={24} lg={8}><Card title="وضعیت وظایف">{pie(data.taskStatuses)}</Card></Col><Col xs={24} lg={16}><Card title="آخرین وظایف" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.tasks,'tasks-report')}>خروجی</Button>}><Table rowKey="id" columns={taskColumns} dataSource={data.tasks} scroll={{x:800}}/></Card></Col></Row>},
      {key:'tickets',label:'تیکت‌ها',children:<Row gutter={[16,16]}><Col xs={24} lg={8}><Card title="وضعیت تیکت‌ها">{pie(data.ticketStatuses)}</Card></Col><Col xs={24} lg={16}><Card title="آخرین تیکت‌ها" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.tickets,'tickets-report')}>خروجی</Button>}><Table rowKey="id" columns={ticketColumns} dataSource={data.tickets} scroll={{x:850}}/></Card></Col></Row>},
      {key:'forms',label:'فرم‌های سازمانی',children:<Row gutter={[16,16]}><Col xs={24} lg={8}><Card title="وضعیت فرم‌ها">{pie(data.formStatuses)}</Card></Col><Col xs={24} lg={16}><Card title="آخرین فرم‌ها" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.forms,'forms-report')}>خروجی</Button>}><Table rowKey="id" columns={formColumns} dataSource={data.forms} scroll={{x:900}}/></Card></Col></Row>}
    ]}/>
  </div>
}
