import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { camelize, HttpError, json } from '../_shared/http.ts'

type Obj = Record<string, any>
const db = adminClient(); const taskStatuses = ['Todo', 'InProgress', 'InReview', 'Done', 'Cancelled']; const priorities = ['Low', 'Medium', 'High', 'Critical']; const letterTypes = ['Internal', 'Incoming', 'Outgoing']; const letterStatuses = ['Draft', 'Sent', 'Received', 'InReview', 'Signed', 'Referred', 'Archived', 'Cancelled']
function check(error: { message: string } | null): void { if (error) { console.error(error.message); throw new HttpError(500, 'خطا در تهیه گزارش') } }
const out = (v: any, names: string[]) => typeof v === 'number' ? names[v] : v
const group = (rows: Obj[], field: string, names?: string[]) => Object.entries(rows.reduce((a: Obj, r) => { const key = String(names ? out(r[field], names) : r[field]); a[key] = (a[key] ?? 0) + 1; return a }, {})).map(([name, value]) => ({ name, value }))

export async function handleReports(request: Request, auth: AuthContext, path: string): Promise<Response | null> {
  if (path !== '/reports/dashboard') return null
  if (request.method !== 'GET') throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
  requirePermission(auth, 'reports.view')
  const [lettersR,tasksR,ticketsR,formsR,smsR,usersR,customersR,letterCountR,activeTasksR,openTicketsR,pendingFormsR] = await Promise.all([
    db.from('Letters').select('Id,LetterNumber,IncomingNumber,Type,Subject,FromUserName,IncomingFromOrg,LetterDate,CreatedAt,Status').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
    db.from('Tasks').select('Id,Title,Status,Priority,Progress,DueDate,AssignedToUserId,CreatedAt').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
    db.from('Tickets').select('Id,Code,Title,CustomerId,Category,AssignedToUserId,Status,CreatedAt').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
    db.from('OrganizationalForms').select('Id,FormType,Title,SubmitterName,ManagerName,HrName,Status,RequestedHours,CreatedAt').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(500),
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
  const months = Array.from({ length: 6 }, (_, index) => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(d.getUTCMonth() - (5 - index)); return d })
  const monthly = months.map((month) => { const same = (x: Obj) => { const d = new Date(x.CreatedAt); return d.getUTCFullYear() === month.getUTCFullYear() && d.getUTCMonth() === month.getUTCMonth() }; return { month: month.toLocaleDateString('fa-IR', { month: 'short', year: 'numeric' }), internalLetters: letters.filter((x) => same(x) && Number(x.Type) === 0).length, incomingLetters: letters.filter((x) => same(x) && Number(x.Type) === 1).length, outgoingLetters: letters.filter((x) => same(x) && Number(x.Type) === 2).length, tasks: tasks.filter(same).length, tickets: tickets.filter(same).length, forms: forms.filter(same).length } })
  return json(request, {
    summary: { letterCount:letterCountR.count??0,activeTasks:activeTasksR.count??0,openTickets:openTicketsR.count??0,sentSms:(smsR.data??[]).filter((x)=>[1,2,'Sent','Delivered'].includes(x.Status)).length,pendingForms:pendingFormsR.count??0,activeUsers:users.filter((x)=>x.IsActive).length,totalUsers:users.length },
    monthly, letterTypes: group(letters, 'Type', letterTypes), taskStatuses: group(tasks, 'Status', taskStatuses), ticketStatuses: group(tickets, 'Status'), formStatuses: group(forms, 'Status'),
    letters: letters.map((x) => ({ id: x.Id, number: x.LetterNumber ?? x.IncomingNumber ?? '—', type: out(x.Type, letterTypes), subject: x.Subject, from: x.FromUserName ?? x.IncomingFromOrg ?? '—', date: x.LetterDate ?? x.CreatedAt, status: out(x.Status, letterStatuses) })),
    tasks: tasks.map((x) => ({ ...(camelize(x) as Obj), status: out(x.Status, taskStatuses), priority: out(x.Priority, priorities), assignee: userName.get(x.AssignedToUserId) ?? '' })),
    tickets: tickets.map((x) => ({ ...(camelize(x) as Obj), customer: customerName.get(x.CustomerId) ?? '', assignee: userName.get(x.AssignedToUserId) ?? '' })),
    forms: camelize(forms),
  })
}
