import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { camelize, HttpError, json } from '../_shared/http.ts'

type Obj = Record<string, any>
const db = adminClient(); const taskStatuses = ['Todo', 'InProgress', 'InReview', 'Done', 'Cancelled']; const priorities = ['Low', 'Medium', 'High', 'Critical']; const letterTypes = ['Internal', 'Incoming', 'Outgoing']; const letterStatuses = ['Draft', 'Sent', 'Received', 'InReview', 'Signed', 'Referred', 'Archived', 'Cancelled']
function check(error: { message: string } | null): void { if (error) { console.error(error.message); throw new HttpError(500, 'خطا در تهیه گزارش') } }
const out = (v: any, names: string[]) => typeof v === 'number' ? names[v] : v
const group = (rows: Obj[], field: string, names?: string[]) => Object.entries(rows.reduce((a: Obj, r) => { const key = String(names ? out(r[field], names) : r[field]); a[key] = (a[key] ?? 0) + 1; return a }, {})).map(([name, value]) => ({ name, value }))

export async function handleReports(request: Request, auth: AuthContext, path: string): Promise<Response | null> {
  if (!path.startsWith('/reports/')) return null
  const url = new URL(request.url)
  if (request.method !== 'GET') throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
  requirePermission(auth, 'reports.view')

  if (path === '/reports/forms/users') {
    const [usersR, submittersR] = await Promise.all([
      db.from('Users').select('Id,FirstName,LastName,Position,Department,IsActive').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('FirstName'),
      db.from('OrganizationalForms').select('SubmitterUserId,SubmitterName').eq('TenantId', auth.tenantId).eq('IsDeleted', false),
    ]); check(usersR.error); check(submittersR.error)
    const users = (usersR.data ?? []).map((x:Obj) => ({ id:x.Id, fullName:`${x.FirstName ?? ''} ${x.LastName ?? ''}`.trim(), position:x.Position, department:x.Department, isActive:Boolean(x.IsActive) }))
    const known = new Set(users.map((x:Obj) => x.id))
    for (const x of submittersR.data ?? []) if (x.SubmitterUserId && !known.has(x.SubmitterUserId)) {
      known.add(x.SubmitterUserId); users.push({ id:x.SubmitterUserId, fullName:x.SubmitterName || 'کارمند سابق', position:null, department:null, isActive:false })
    }
    return json(request, users.sort((a:Obj,b:Obj) => String(a.fullName).localeCompare(String(b.fullName), 'fa')))
  }

  if (path === '/reports/forms/leave') {
    const userId=url.searchParams.get('userId'), fromDate=url.searchParams.get('fromDate')?.replaceAll('-','/'), toDate=url.searchParams.get('toDate')?.replaceAll('-','/')
    if (fromDate && toDate && fromDate > toDate) throw new HttpError(400, 'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد')
    let query=db.from('OrganizationalForms').select('Id,FormType,DataJson,SubmitterUserId,SubmitterName,ManagerName,HrName,Status,RequestedHours,CreatedAt').eq('TenantId',auth.tenantId).eq('IsDeleted',false).in('FormType',['leave_daily','leave_hourly'])
    if(userId) query=query.eq('SubmitterUserId',userId)
    const formsR=await query.order('CreatedAt',{ascending:false});check(formsR.error)
    const ids=(formsR.data??[]).map((x:Obj)=>x.Id)
    const historiesR=ids.length?await db.from('FormWorkflowHistories').select('FormId,Action,ActorName,CreatedAt').eq('TenantId',auth.tenantId).eq('IsDeleted',false).in('FormId',ids).order('CreatedAt'):({data:[],error:null} as any);check(historiesR.error)
    const histories=new Map<string,Obj[]>(); for(const h of historiesR.data??[]){const list=histories.get(h.FormId)??[];list.push(h);histories.set(h.FormId,list)}
    const decision=(action:unknown)=>({approved:'تأیید شده',rejected:'رد شده',returned:'برگشت داده شده'} as Obj)[String(action??'')]??'—'
    const rows:Obj[]=[]
    for(const item of formsR.data??[]){
      let data:Obj={};try{data=typeof item.DataJson==='string'?JSON.parse(item.DataJson):(item.DataJson??{})}catch{continue}
      const daily=item.FormType==='leave_daily', start=String(data[daily?'fromDate':'date']??'').replaceAll('-','/'), end=String(daily?(data.toDate??start):start).replaceAll('-','/')
      if(!/^\d{4}\/\d{2}\/\d{2}$/.test(start)||!/^\d{4}\/\d{2}\/\d{2}$/.test(end))continue
      if((fromDate&&end<fromDate)||(toDate&&start>toDate))continue
      const history=histories.get(item.Id)??[], managerAction=history.find(x=>x.ActorName===item.ManagerName&&x.Action!=='submitted')?.Action, hrAction=history.find(x=>x.ActorName===item.HrName&&x.Action!=='submitted')?.Action
      rows.push({id:item.Id,employeeName:item.SubmitterName,leaveKind:daily?'روزانه':'ساعتی',date:daily&&start!==end?`${start} تا ${end}`:start,startTime:daily?'—':(data.fromTime??'—'),endTime:daily?'—':(data.toTime??'—'),requestedHours:item.RequestedHours,managerName:item.ManagerName,managerDecision:item.Status==='manager_pending'?'در انتظار':decision(managerAction),hrManagerName:item.HrName,hrDecision:['manager_pending','hr_pending'].includes(item.Status)?'در انتظار':decision(hrAction),status:item.Status,createdAt:item.CreatedAt})
    }
    return json(request,rows)
  }

  if (path === '/reports/forms/pending') {
    const result=await db.from('OrganizationalForms').select('Id,Title,FormType,DataJson,SubmitterUserId,SubmitterName,Status,RequestedHours,CreatedAt,ManagerName,HrName').eq('TenantId',auth.tenantId).eq('IsDeleted',false).order('CreatedAt');check(result.error)
    const all=result.data??[], pending=all.filter((x:Obj)=>['manager_pending','hr_pending'].includes(x.Status)), ids=pending.map((x:Obj)=>x.Id)
    const historiesR=ids.length?await db.from('FormWorkflowHistories').select('FormId,Action,ActorName,CreatedAt').eq('TenantId',auth.tenantId).eq('IsDeleted',false).in('FormId',ids).order('CreatedAt'):({data:[],error:null} as any);check(historiesR.error)
    const histories=new Map<string,Obj[]>();for(const h of historiesR.data??[]){const list=histories.get(h.FormId)??[];list.push(h);histories.set(h.FormId,list)}
    const key=(x:Obj)=>`${x.SubmitterUserId}|${x.FormType}|${String(x.DataJson??'')}`
    const completedKeys=new Set(all.filter((x:Obj)=>['approved','completed'].includes(x.Status)).map(key))
    const visible=pending.filter((x:Obj)=>{
      if(completedKeys.has(key(x)))return false
      const history=histories.get(x.Id)??[]
      if(history.some((h:Obj)=>['rejected','returned','complete'].includes(String(h.Action))))return false
      const approver=x.Status==='manager_pending'?x.ManagerName:x.HrName
      return !history.some((h:Obj)=>h.ActorName===approver&&h.Action==='approve')
    })
    return json(request,visible.map((x:Obj)=>({id:x.Id,title:x.Title,formType:x.FormType,submitterName:x.SubmitterName,status:x.Status,requestedHours:x.RequestedHours,createdAt:x.CreatedAt,currentStage:x.Status==='manager_pending'?'تأیید مدیر مستقیم':'تأیید منابع انسانی',currentApprover:x.Status==='manager_pending'?x.ManagerName:x.HrName,waitingDays:Math.max(0,Math.floor((Date.now()-new Date(x.CreatedAt).getTime())/86400000))})))
  }

  if (path !== '/reports/dashboard') return null
  const [lettersR,tasksR,ticketsR,formsR,smsR,usersR,customersR,letterCountR,activeTasksR,openTicketsR,pendingFormsR] = await Promise.all([
    db.from('Letters').select('Id,LetterNumber,IncomingNumber,Type,Subject,FromUserName,IncomingFromOrg,LetterDate,CreatedAt,Status').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
    db.from('Tasks').select('Id,Title,Status,Priority,Progress,DueDate,AssignedToUserId,CreatedAt').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
    db.from('Tickets').select('Id,Code,Title,CustomerId,Category,AssignedToUserId,Status,CreatedAt').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
    db.from('OrganizationalForms').select('Id,FormType,DataJson,SubmitterUserId,Title,SubmitterName,ManagerName,HrName,Status,RequestedHours,CreatedAt').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
    db.from('SmsMessages').select('Status').eq('TenantId', auth.tenantId).eq('IsDeleted', false).limit(1000),
    db.from('Users').select('Id,FirstName,LastName,IsActive').eq('TenantId', auth.tenantId).eq('IsDeleted', false),
    db.from('Customers').select('Id,FullName').eq('TenantId', auth.tenantId).eq('IsDeleted', false),
    db.from('Letters').select('*',{count:'exact',head:true}).eq('TenantId',auth.tenantId).eq('IsDeleted',false),
    db.from('Tasks').select('*',{count:'exact',head:true}).eq('TenantId',auth.tenantId).eq('IsDeleted',false).not('Status','in','(3,4)'),
    db.from('Tickets').select('*',{count:'exact',head:true}).eq('TenantId',auth.tenantId).eq('IsDeleted',false).not('Status','in','(closed,resolved)'),
    db.from('OrganizationalForms').select('*',{count:'exact',head:true}).eq('TenantId',auth.tenantId).eq('IsDeleted',false).in('Status',['manager_pending','hr_pending']),
  ]); [lettersR,tasksR,ticketsR,formsR,smsR,usersR,customersR,letterCountR,activeTasksR,openTicketsR,pendingFormsR].forEach((x) => check(x.error))
  const letters = lettersR.data ?? [], tasks = tasksR.data ?? [], tickets = ticketsR.data ?? [], forms = formsR.data ?? [], users = usersR.data ?? [], customers = customersR.data ?? []
  const userName = new Map(users.map((u) => [u.Id, `${u.FirstName ?? ''} ${u.LastName ?? ''}`.trim()])); const customerName = new Map(customers.map((c) => [c.Id, c.FullName]))
  const formKey=(x:Obj)=>`${x.SubmitterUserId}|${x.FormType}|${String(x.DataJson??'')}`
  const completedFormKeys=new Set(forms.filter((x:Obj)=>['approved','completed'].includes(x.Status)).map(formKey))
  const actualPendingForms=forms.filter((x:Obj)=>['manager_pending','hr_pending'].includes(x.Status)&&!completedFormKeys.has(formKey(x))).length
  const months = Array.from({ length: 6 }, (_, index) => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(d.getUTCMonth() - (5 - index)); return d })
  const monthly = months.map((month) => { const same = (x: Obj) => { const d = new Date(x.CreatedAt); return d.getUTCFullYear() === month.getUTCFullYear() && d.getUTCMonth() === month.getUTCMonth() }; return { month: month.toLocaleDateString('fa-IR', { month: 'short', year: 'numeric' }), internalLetters: letters.filter((x) => same(x) && Number(x.Type) === 0).length, incomingLetters: letters.filter((x) => same(x) && Number(x.Type) === 1).length, outgoingLetters: letters.filter((x) => same(x) && Number(x.Type) === 2).length, tasks: tasks.filter(same).length, tickets: tickets.filter(same).length, forms: forms.filter(same).length } })
  return json(request, {
    summary: { letterCount:letterCountR.count??0,activeTasks:activeTasksR.count??0,openTickets:openTicketsR.count??0,sentSms:(smsR.data??[]).filter((x)=>[1,2,'Sent','Delivered'].includes(x.Status)).length,pendingForms:actualPendingForms,activeUsers:users.filter((x)=>x.IsActive).length,totalUsers:users.length },
    monthly, letterTypes: group(letters, 'Type', letterTypes), taskStatuses: group(tasks, 'Status', taskStatuses), ticketStatuses: group(tickets, 'Status'), formStatuses: group(forms, 'Status'),
    letters: letters.map((x) => ({ id: x.Id, number: x.LetterNumber ?? x.IncomingNumber ?? '—', type: out(x.Type, letterTypes), subject: x.Subject, from: x.FromUserName ?? x.IncomingFromOrg ?? '—', date: x.LetterDate ?? x.CreatedAt, status: out(x.Status, letterStatuses) })),
    tasks: tasks.map((x) => ({ ...(camelize(x) as Obj), status: out(x.Status, taskStatuses), priority: out(x.Priority, priorities), assignee: userName.get(x.AssignedToUserId) ?? '' })),
    tickets: tickets.map((x) => ({ ...(camelize(x) as Obj), customer: customerName.get(x.CustomerId) ?? '', assignee: userName.get(x.AssignedToUserId) ?? '' })),
    forms: camelize(forms),
  })
}
