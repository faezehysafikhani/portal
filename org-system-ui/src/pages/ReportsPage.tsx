import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, message, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag } from 'antd'
import { CheckSquareOutlined, CustomerServiceOutlined, DownloadOutlined, FileTextOutlined, MailOutlined, MessageOutlined, PrinterOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiFetch } from '../utils/api'
import PersianDatePicker from '../components/PersianDatePicker'
import ManagerDonutChart from '../components/ManagerDonutChart'

const API='http://localhost:5043/api/v1'
const faDate=(v?:string)=>v?new Date(v).toLocaleDateString('fa-IR'):'—'
const formatDuration=(value?:number|string)=>{
  if(value===undefined||value===null||value==='')return '—'
  const numeric=Number(value)
  if(!Number.isFinite(numeric))return String(value)
  const minutes=Math.round(numeric*60)
  const hours=Math.floor(minutes/60),rest=minutes%60
  if(hours<=0)return `${rest.toLocaleString('fa-IR')} دقیقه`
  if(rest===0)return `${hours.toLocaleString('fa-IR')} ساعت`
  return `${hours.toLocaleString('fa-IR')} ساعت و ${rest.toLocaleString('fa-IR')} دقیقه`
}
const typeLabel:Record<string,string>={Internal:'داخلی',Incoming:'وارده',Outgoing:'صادره'}
const statusLabel:Record<string,string>={Draft:'پیش‌نویس',Sent:'ارسال شده',Received:'دریافت شده',InReview:'در بررسی',Signed:'امضا شده',Referred:'ارجاع شده',Archived:'بایگانی',Cancelled:'لغو شده',Todo:'جدید',InProgress:'در حال انجام',InReviewTask:'بازبینی',Done:'تکمیل شده',CancelledTask:'لغو شده',open:'باز',inprogress:'در حال بررسی',waiting:'در انتظار',resolved:'حل شده',closed:'بسته',manager_pending:'در بررسی مدیر',hr_pending:'در بررسی منابع انسانی',approved:'تأیید نهایی',completed:'خاتمه یافته',rejected:'رد شده',returned:'برگشت برای اصلاح'}
const labelStatus=(value:string)=>statusLabel[value]||value
let reportsCache:{data:any;at:number}|undefined

export default function ReportsPage(){
  const [data,setData]=useState<any>()
  const [loading,setLoading]=useState(true)
  const [leaveUsers,setLeaveUsers]=useState<any[]>([])
  const [leaveRows,setLeaveRows]=useState<any[]>([])
  const [pendingRows,setPendingRows]=useState<any[]>([])
  const [leaveLoading,setLeaveLoading]=useState(false)
  const [formReportsLoading,setFormReportsLoading]=useState(false)
  const [activeTab,setActiveTab]=useState('summary')
  const formReportsLoaded=useRef(false)
  const [leaveForm]=Form.useForm()
  const load=async(force=false)=>{if(!force&&reportsCache&&Date.now()-reportsCache.at<60000){setData(reportsCache.data);setLoading(false);return}setLoading(true);const response=await apiFetch(`${API}/reports/dashboard`);const result=await response.json().catch(()=>({}));setLoading(false);if(!response.ok){message.error(result.message||'دریافت گزارش‌ها انجام نشد');return}reportsCache={data:result,at:Date.now()};setData(result)}
  const loadLeave=async(values?:any)=>{setLeaveLoading(true);const params=new URLSearchParams();if(values?.userId)params.set('userId',values.userId);if(values?.fromDate)params.set('fromDate',values.fromDate);if(values?.toDate)params.set('toDate',values.toDate);const response=await apiFetch(`${API}/reports/forms/leave?${params}`);const result=await response.json().catch(()=>({}));setLeaveLoading(false);if(!response.ok){message.error(result.message||'دریافت گزارش مرخصی انجام نشد');return}setLeaveRows(result)}
  const loadPending=async()=>{const response=await apiFetch(`${API}/reports/forms/pending`);if(response.ok)setPendingRows(await response.json())}
  const loadFormReports=async()=>{if(formReportsLoaded.current)return;formReportsLoaded.current=true;setFormReportsLoading(true);try{const usersResponse=await apiFetch(`${API}/reports/forms/users`);const usersResult=await usersResponse.json().catch(()=>({}));if(usersResponse.ok&&Array.isArray(usersResult))setLeaveUsers(usersResult);else message.error(usersResult.message||'فهرست کارمندان دریافت نشد');await Promise.all([loadLeave(),loadPending()])}finally{setFormReportsLoading(false)}}
  useEffect(()=>{void load()},[])
  const exportCsv=(rows:any[],name:string)=>{if(!rows?.length)return message.warning('داده‌ای برای خروجی وجود ندارد');const keys=Object.keys(rows[0]);const clean=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;const csv='\uFEFF'+[keys.join(','),...rows.map(r=>keys.map(k=>clean(r[k])).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`${name}.csv`;a.click();URL.revokeObjectURL(a.href)}
  const printReport=(title:string,columns:{title:string;dataIndex:string;renderText?:(value:any,row:any)=>string}[],rows:any[])=>{
    if(!rows.length){message.warning('داده‌ای برای چاپ وجود ندارد');return}
    const esc=(value:any)=>String(value??'—').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char))
    const company=(()=>{try{return JSON.parse(localStorage.getItem('company')||'{}')}catch{return {}}})() as {name?:string;logoUrl?:string}
    const printedAt=new Date().toLocaleString('fa-IR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
    const headers=columns.map(column=>`<th>${esc(column.title)}</th>`).join('')
    const body=rows.map(row=>`<tr>${columns.map(column=>`<td>${esc(column.renderText?column.renderText(row[column.dataIndex],row):row[column.dataIndex])}</td>`).join('')}</tr>`).join('')
    const logo=company.logoUrl?`<img src="${esc(company.logoUrl)}" alt="آرم شرکت">`:'<div class="logo-fallback">🏢</div>'
    const html=`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title></title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#222}.report-header{display:grid;grid-template-columns:150px 1fr 150px;align-items:center;gap:12px;border-bottom:3px solid #711452;padding:0 0 12px;margin-bottom:14px}.brand{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700}.brand img{width:58px;height:58px;object-fit:contain}.logo-fallback{font-size:34px}.title{text-align:center}.title h1{font-size:20px;margin:0 0 6px;color:#55103e}.title div{font-size:11px;color:#666}.print-meta{text-align:left;font-size:11px;line-height:2;color:#444}.print-meta b{color:#711452}table{border-collapse:collapse;width:100%;font-size:10px;table-layout:auto}th,td{border:1px solid #777;padding:6px 4px;text-align:center;white-space:nowrap}th{background:#711452!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}tr:nth-child(even){background:#f8f1f6!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.footer{margin-top:10px;padding-top:7px;border-top:1px solid #ddd;text-align:center;color:#888;font-size:9px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header class="report-header"><div class="brand">${logo}<span>${esc(company.name||'مدیریت پروژه پارس')}</span></div><div class="title"><h1>${esc(title)}</h1><div>گزارش رسمی سامانه مدیریت سازمانی</div></div><div class="print-meta"><div><b>تاریخ چاپ:</b> ${esc(printedAt)}</div><div><b>تعداد رکورد:</b> ${rows.length.toLocaleString('fa-IR')}</div></div></header><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table><div class="footer">${esc(company.name||'مدیریت پروژه پارس')} — چاپ‌شده از سامانه</div></body></html>`
    const frame=document.createElement('iframe');frame.setAttribute('aria-hidden','true');frame.style.cssText='position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden';document.body.appendChild(frame)
    const printWindow=frame.contentWindow,printDocument=frame.contentDocument
    if(!printWindow||!printDocument){frame.remove();message.error('امکان بازکردن پنجره چاپ وجود ندارد');return}
    const cleanup=()=>window.setTimeout(()=>frame.remove(),500)
    printWindow.onafterprint=cleanup
    frame.onload=()=>window.setTimeout(()=>{printWindow.focus();printWindow.print()},250)
    printDocument.open();printDocument.write(html);printDocument.close()
    window.setTimeout(()=>{if(frame.isConnected)cleanup()},120000)
  }
  if(loading)return <div style={{height:420,display:'grid',placeItems:'center'}}><Spin size="large" tip="در حال خواندن گزارش از دیتابیس"/></div>
  if(!data)return <Alert type="error" showIcon message="گزارش‌ها از سرور دریافت نشد" action={<Button onClick={()=>load(true)}>تلاش مجدد</Button>}/>
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
  const formColumns=[{title:'عنوان',dataIndex:'title'},{title:'ثبت‌کننده',dataIndex:'submitterName'},{title:'مدیر مستقیم',dataIndex:'managerName'},{title:'منابع انسانی',dataIndex:'hrName'},{title:'وضعیت',dataIndex:'status',render:(v:string)=><Tag color="magenta">{labelStatus(v)}</Tag>},{title:'مدت مرخصی',dataIndex:'requestedHours',render:formatDuration,renderText:formatDuration},{title:'تاریخ',dataIndex:'createdAt',render:faDate}]
  const leaveColumns=[{title:'نام و نام خانوادگی',dataIndex:'employeeName'},{title:'نوع مرخصی',dataIndex:'leaveKind'},{title:'روز شروع',dataIndex:'startDate'},{title:'روز پایان',dataIndex:'endDate'},{title:'تعداد روز',dataIndex:'dayCount'},{title:'تاریخ مرخصی ساعتی',dataIndex:'hourlyDate'},{title:'زمان خروج',dataIndex:'startTime'},{title:'زمان ورود',dataIndex:'endTime'},{title:'مجموع زمان',dataIndex:'totalHours',render:formatDuration,renderText:formatDuration},{title:'مدیر مستقیم',dataIndex:'managerName'}]
  const pendingColumns=[{title:'فرم',dataIndex:'title'},{title:'کارمند',dataIndex:'submitterName'},{title:'مرحله جاری',dataIndex:'currentStage'},{title:'تأییدکننده فعلی',dataIndex:'currentApprover'},{title:'مدت',dataIndex:'requestedHours',render:formatDuration,renderText:formatDuration},{title:'روزهای انتظار',dataIndex:'waitingDays'},{title:'تاریخ ثبت',dataIndex:'createdAt',render:faDate,renderText:(v:string)=>faDate(v)}]
  const pie=(items:any[])=><ManagerDonutChart items={items} formatLabel={name=>labelStatus(typeLabel[name]||name)} centerLabel="کل موارد" />
  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><div><h2 style={{margin:0}}>📊 گزارشات واقعی سیستم</h2><small style={{color:'#888'}}>تمام اعداد و جداول مستقیماً از دیتابیس خوانده شده‌اند</small></div><Space><Button icon={<ReloadOutlined/>} onClick={()=>load(true)}>به‌روزرسانی</Button><Button icon={<PrinterOutlined/>} onClick={()=>window.print()}>چاپ</Button></Space></div>
    <Row gutter={[12,12]} style={{marginBottom:16}}>{cards.map((c:any)=><Col xs={12} md={8} xl={4} key={c.label}><Card size="small" style={{borderTop:`4px solid ${c.color}`,borderRadius:12}}><Statistic title={c.label} value={c.value} prefix={<span style={{color:c.color}}>{c.icon}</span>}/></Card></Col>)}</Row>
    <Tabs activeKey={activeTab} destroyOnHidden onChange={key=>{setActiveTab(key);if(key==='forms')void loadFormReports()}} items={[
      {key:'summary',label:'نمای کلی',children:<Row gutter={[16,16]}><Col xs={24} xl={16}><Card title="روند ثبت اطلاعات در ۶ ماه اخیر"><ResponsiveContainer width="100%" height={300}><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip/><Legend/><Bar dataKey="internalLetters" name="نامه داخلی" fill="#8b1a6b"/><Bar dataKey="incomingLetters" name="نامه وارده" fill="#1677ff"/><Bar dataKey="outgoingLetters" name="نامه صادره" fill="#52c41a"/><Bar dataKey="tasks" name="وظیفه" fill="#fa8c16"/><Bar dataKey="tickets" name="تیکت" fill="#722ed1"/><Bar dataKey="forms" name="فرم" fill="#f5222d"/></BarChart></ResponsiveContainer></Card></Col><Col xs={24} xl={8}><Card title="نوع نامه‌ها">{pie(data.letterTypes)}</Card></Col></Row>},
      {key:'letters',label:'نامه‌ها',children:<Card title="آخرین نامه‌های ثبت‌شده" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.letters,'letters-report')}>خروجی CSV</Button>}><Table rowKey="id" columns={letterColumns} dataSource={data.letters} scroll={{x:850}}/></Card>},
      {key:'tasks',label:'وظایف',children:<Row gutter={[16,16]}><Col xs={24} lg={8}><Card title="وضعیت وظایف">{pie(data.taskStatuses)}</Card></Col><Col xs={24} lg={16}><Card title="آخرین وظایف" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.tasks,'tasks-report')}>خروجی</Button>}><Table rowKey="id" columns={taskColumns} dataSource={data.tasks} scroll={{x:800}}/></Card></Col></Row>},
      {key:'tickets',label:'تیکت‌ها',children:<Row gutter={[16,16]}><Col xs={24} lg={8}><Card title="وضعیت تیکت‌ها">{pie(data.ticketStatuses)}</Card></Col><Col xs={24} lg={16}><Card title="آخرین تیکت‌ها" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.tickets,'tickets-report')}>خروجی</Button>}><Table rowKey="id" columns={ticketColumns} dataSource={data.tickets} scroll={{x:850}}/></Card></Col></Row>},
      {key:'forms',label:'فرم‌های سازمانی',children:formReportsLoading?<div style={{height:260,display:'grid',placeItems:'center'}}><Spin tip="در حال دریافت گزارش فرم‌ها"/></div>:<Tabs destroyOnHidden type="card" items={[
        {key:'leave-report',label:'گزارش مرخصی کارکنان',children:<Card title="گزارش نهایی مرخصی‌های تأییدشده" extra={<Space wrap><Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(leaveRows,'leave-report')}>CSV</Button><Button type="primary" icon={<PrinterOutlined/>} onClick={()=>printReport('گزارش نهایی مرخصی کارکنان',leaveColumns as any,leaveRows)} style={{background:'#8b1a6b'}}>چاپ</Button></Space>}><Form form={leaveForm} layout="vertical" onFinish={loadLeave}><Row gutter={12}><Col xs={24} md={8}><Form.Item name="userId" label="کارمند"><Select allowClear showSearch optionFilterProp="label" placeholder="همه کارمندان" options={leaveUsers.map(user=>({value:user.id,label:`${user.fullName}${user.position?' — '+user.position:''}${user.isActive===false?' (غیرفعال)':''}`}))}/></Form.Item></Col><Col xs={12} md={5}><Form.Item name="fromDate" label="از تاریخ"><PersianDatePicker/></Form.Item></Col><Col xs={12} md={5}><Form.Item name="toDate" label="تا تاریخ"><PersianDatePicker/></Form.Item></Col><Col xs={24} md={6} style={{display:'flex',alignItems:'center',paddingTop:14}}><Space><Button type="primary" htmlType="submit" loading={leaveLoading} style={{background:'#8b1a6b'}}>اعمال فیلتر</Button><Button onClick={()=>{leaveForm.resetFields();loadLeave()}}>پاک‌کردن</Button></Space></Col></Row></Form><Table rowKey="id" loading={leaveLoading} columns={leaveColumns} dataSource={leaveRows} scroll={{x:1150}} pagination={{pageSize:20}}/></Card>},
        {key:'pending',label:<span>فرایندهای تأییدنشده <Badge count={pendingRows.length}/></span>,children:<Card title="فرایندهای در انتظار تأیید" extra={<Space><Button icon={<ReloadOutlined/>} onClick={loadPending}>به‌روزرسانی</Button><Button type="primary" icon={<PrinterOutlined/>} onClick={()=>printReport('فرایندهای تأییدنشده فرم‌های سازمانی',pendingColumns as any,pendingRows)} style={{background:'#8b1a6b'}}>چاپ</Button></Space>}><Alert type="warning" showIcon message="این فهرست شامل فرم‌های منتظر مدیر مستقیم و منتظر منابع انسانی است" style={{marginBottom:12}}/><Table rowKey="id" columns={pendingColumns} dataSource={pendingRows} scroll={{x:900}} pagination={{pageSize:20}}/></Card>},
        {key:'overview',label:'نمای کلی فرم‌ها',children:<Row gutter={[16,16]}><Col xs={24} lg={8}><Card title="وضعیت فرم‌ها">{pie(data.formStatuses)}</Card></Col><Col xs={24} lg={16}><Card title="آخرین فرم‌ها" extra={<Button icon={<DownloadOutlined/>} onClick={()=>exportCsv(data.forms,'forms-report')}>خروجی</Button>}><Table rowKey="id" columns={formColumns} dataSource={data.forms} scroll={{x:900}}/></Card></Col></Row>}
      ]}/>}
    ]}/>
  </div>
}
