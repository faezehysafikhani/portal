import bcrypt from 'bcryptjs'
import { adminClient, AuthContext, issueToken, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createNotification, notificationType } from '../_shared/notifications.ts'

type Obj = Record<string, any>
const db = adminClient()
const tenantDefault = '00000000-0000-0000-0000-000000000001'
const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()

function check(error: { message: string } | null): void {
  if (error) { console.error(error.message); throw new HttpError(500, 'خطا در پایگاه داده') }
}

function base(tenantId: string, userId?: string): Obj {
  return { Id: id(), TenantId: tenantId, CreatedAt: now(), UpdatedAt: null, CreatedByUserId: userId ?? null, IsDeleted: false, DeletedAt: null }
}

async function ticketDto(ticket: Obj): Promise<Obj> {
  const [customer, assignee, comments] = await Promise.all([
    db.from('Customers').select('FullName').eq('Id', ticket.CustomerId).eq('TenantId', ticket.TenantId).maybeSingle(),
    ticket.AssignedToUserId
      ? db.from('Users').select('FirstName,LastName').eq('Id', ticket.AssignedToUserId).eq('TenantId', ticket.TenantId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from('TicketComments').select('*').eq('TicketId', ticket.Id).eq('TenantId', ticket.TenantId).eq('IsDeleted', false).order('CreatedAt'),
  ])
  check(customer.error); check(assignee.error); check(comments.error)
  return {
    ...(camelize(ticket) as Obj),
    customerName: customer.data?.FullName ?? '',
    assignedToName: assignee.data ? `${assignee.data.FirstName ?? ''} ${assignee.data.LastName ?? ''}`.trim() : '',
    commentCount: comments.data?.length ?? 0,
    comments: camelize(comments.data ?? []),
  }
}

export async function handlePublicCustomer(request: Request, path: string): Promise<Response | null> {
  if (request.method === 'POST' && path === '/customers/login') {
    const input = await body<{ email?: string; password?: string }>(request)
    const email = String(input.email ?? '').trim().toLowerCase()
    const result = await db.from('Customers').select('*').eq('Email', email).eq('IsDeleted', false).eq('IsActive', true).maybeSingle()
    check(result.error)
    if (!result.data || !result.data.PasswordHash || !await bcrypt.compare(String(input.password ?? ''), result.data.PasswordHash)) {
      throw new HttpError(401, 'ایمیل یا رمز عبور اشتباه است')
    }
    const customer = result.data
    const accessToken = await issueToken({
      userId: customer.Id, tenantId: customer.TenantId, username: customer.Email,
      permissions: ['customer'], isAdmin: false,
    })
    return json(request, {
      id: customer.Id, fullName: customer.FullName, email: customer.Email,
      phone: customer.Phone, companyName: customer.CompanyName, accessToken,
    })
  }

  if (request.method === 'POST' && path === '/customers/register') {
    const input = await body<Obj>(request)
    const email = String(input.email ?? '').trim().toLowerCase()
    const password = String(input.password ?? '')
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'ایمیل معتبر الزامی است')
    if (password.length < 8) throw new HttpError(400, 'رمز عبور حداقل باید ۸ کاراکتر باشد')
    const duplicate = await db.from('Customers').select('Id').eq('Email', email).maybeSingle()
    check(duplicate.error)
    if (duplicate.data) throw new HttpError(409, 'این ایمیل قبلاً ثبت شده است')
    const customer = {
      ...base(tenantDefault), FullName: String(input.fullName ?? '').trim(), Email: email,
      Phone: input.phone ?? null, CompanyName: input.companyName ?? null,
      PasswordHash: await bcrypt.hash(password, 12), IsActive: true,
    }
    if (!customer.FullName) throw new HttpError(400, 'نام و نام خانوادگی الزامی است')
    const created = await db.from('Customers').insert(customer).select().single()
    check(created.error)
    const accessToken = await issueToken({ userId: created.data.Id, tenantId: created.data.TenantId, username: email, permissions: ['customer'], isAdmin: false })
    return json(request, { id: created.data.Id, fullName: created.data.FullName, email, phone: created.data.Phone, companyName: created.data.CompanyName, accessToken }, 201)
  }
  return null
}

export async function handleTicketsCustomers(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  if (path === '/customers' && request.method === 'GET') {
    if (auth.permissions.includes('customer')) throw new HttpError(403, 'دسترسی غیرمجاز')
    const result = await db.from('Customers').select('Id,FullName,CompanyName,Phone,Email,IsActive')
      .eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('FullName')
    check(result.error); return json(request, camelize(result.data))
  }

  const customerTickets = path.match(/^\/customers\/([0-9a-f-]+)\/tickets$/i)
  if (customerTickets) {
    const customerId = customerTickets[1]
    if (auth.permissions.includes('customer') && auth.userId !== customerId) throw new HttpError(403, 'دسترسی غیرمجاز')
    if (request.method === 'GET') {
      const result = await db.from('Tickets').select('*').eq('TenantId', auth.tenantId).eq('CustomerId', customerId)
        .eq('IsDeleted', false).order('CreatedAt', { ascending: false })
      check(result.error)
      const output = await Promise.all((result.data ?? []).map(async (ticket) => {
        const count = await db.from('TicketComments').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('TicketId', ticket.Id).eq('IsDeleted', false)
        check(count.error); return { ...(camelize(ticket) as Obj), messageCount: count.count ?? 0 }
      }))
      return json(request, output)
    }
    if (request.method === 'POST') {
      const input = await body<Obj>(request)
      const count = await db.from('Tickets').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId)
      check(count.error)
      const ticket = {
        ...base(auth.tenantId, auth.permissions.includes('customer') ? undefined : auth.userId),
        Code: `TKT-${String((count.count ?? 0) + 1).padStart(5, '0')}`,
        Title: String(input.title ?? '').trim(), Description: String(input.description ?? '').trim(),
        Category: String(input.category ?? 'سایر'), Priority: String(input.priority ?? 'normal'),
        Status: 'open', CustomerId: customerId, AssignedToUserId: null, ResolvedAt: null, Resolution: null,
      }
      if (!ticket.Title || !ticket.Description) throw new HttpError(400, 'عنوان و توضیحات الزامی است')
      const created = await db.from('Tickets').insert(ticket).select().single(); check(created.error)
      const customer = await db.from('Customers').select('FullName').eq('TenantId', auth.tenantId).eq('Id', customerId).single(); check(customer.error)
      const comment = await db.from('TicketComments').insert({
        ...base(auth.tenantId), TicketId: created.data.Id, Text: ticket.Description,
        AuthorName: customer.data.FullName, IsCustomer: true,
      }); check(comment.error)
      return json(request, { message: 'تیکت با موفقیت ثبت شد', id: created.data.Id, code: created.data.Code }, 201)
    }
  }

  const customerMessages = path.match(/^\/customers\/tickets\/([0-9a-f-]+)\/messages$/i)
  if (customerMessages) {
    const ticketResult = await db.from('Tickets').select('CustomerId').eq('TenantId', auth.tenantId).eq('Id', customerMessages[1]).eq('IsDeleted', false).maybeSingle()
    check(ticketResult.error)
    if (!ticketResult.data) throw new HttpError(404, 'تیکت یافت نشد')
    if (auth.permissions.includes('customer') && ticketResult.data.CustomerId !== auth.userId) throw new HttpError(403, 'دسترسی غیرمجاز')
    if (request.method === 'GET') {
      const result = await db.from('TicketComments').select('*').eq('TenantId', auth.tenantId).eq('TicketId', customerMessages[1]).eq('IsDeleted', false).order('CreatedAt')
      check(result.error); return json(request, camelize(result.data))
    }
    if (request.method === 'POST') {
      const input = await body<Obj>(request)
      if (!String(input.text ?? '').trim()) throw new HttpError(400, 'متن پیام الزامی است')
      const result = await db.from('TicketComments').insert({
        ...base(auth.tenantId, auth.permissions.includes('customer') ? undefined : auth.userId),
        TicketId: customerMessages[1], Text: String(input.text).trim(),
        AuthorName: String(input.authorName ?? auth.username), IsCustomer: auth.permissions.includes('customer'),
      }); check(result.error)
      return json(request, { message: 'پیام ارسال شد' }, 201)
    }
  }

  if (!path.startsWith('/tickets')) return null
  if (auth.permissions.includes('customer')) throw new HttpError(403, 'دسترسی غیرمجاز')
  requirePermission(auth, 'tickets.view')
  const commentMatch = path.match(/^\/tickets\/([0-9a-f-]+)\/comments$/i)
  const ticketMatch = path.match(/^\/tickets\/([0-9a-f-]+)$/i)

  if (request.method === 'GET' && !ticketMatch) {
    let query = db.from('Tickets').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    const status = url.searchParams.get('status'); const assignedTo = url.searchParams.get('assignedTo')
    if (status) query = query.eq('Status', status)
    if (assignedTo) query = query.eq('AssignedToUserId', assignedTo)
    const result = await query.order('CreatedAt', { ascending: false }); check(result.error)
    return json(request, await Promise.all((result.data ?? []).map(ticketDto)))
  }
  if (request.method === 'GET' && ticketMatch) {
    const result = await db.from('Tickets').select('*').eq('TenantId', auth.tenantId).eq('Id', ticketMatch[1]).eq('IsDeleted', false).maybeSingle()
    check(result.error); if (!result.data) throw new HttpError(404, 'تیکت یافت نشد'); return json(request, await ticketDto(result.data))
  }
  if (request.method === 'POST' && path === '/tickets') {
    requirePermission(auth, 'tickets.create')
    const input = await body<Obj>(request)
    const count = await db.from('Tickets').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId); check(count.error)
    const ticket = {
      ...base(auth.tenantId, auth.userId), Code: `TKT-${new Date().getUTCFullYear().toString().slice(-2)}-${String((count.count ?? 0) + 1).padStart(5, '0')}`,
      Title: String(input.title ?? '').trim(), Description: String(input.description ?? '').trim(),
      Category: input.category, Priority: input.priority, Status: 'open', CustomerId: input.customerId,
      AssignedToUserId: input.assignedToUserId ?? null, ResolvedAt: null, Resolution: null,
    }
    if (!ticket.Title || !ticket.Description || !ticket.CustomerId) throw new HttpError(400, 'عنوان، توضیحات و مشتری الزامی است')
    const result = await db.from('Tickets').insert(ticket).select().single(); check(result.error)
    await createNotification(db,auth,{userId:ticket.AssignedToUserId,title:'تیکت جدید به شما تخصیص یافت',body:ticket.Title,type:notificationType.ticket,actionUrl:'/tickets',entityId:result.data.Id,entityType:'Ticket'})
    return json(request, camelize(result.data), 201)
  }
  if (request.method === 'PATCH' && ticketMatch) {
    requirePermission(auth, 'tickets.edit')
    const input = await body<Obj>(request); const update: Obj = { UpdatedAt: now() }
    if (input.status !== undefined) update.Status = input.status
    if (input.priority !== undefined) update.Priority = input.priority
    if (input.assignedToUserId !== undefined) update.AssignedToUserId = input.assignedToUserId
    if (input.resolution !== undefined) update.Resolution = input.resolution
    if (['resolved', 'closed'].includes(String(input.status))) update.ResolvedAt = now()
    const result = await db.from('Tickets').update(update).eq('TenantId', auth.tenantId).eq('Id', ticketMatch[1]).eq('IsDeleted', false).select().maybeSingle()
    check(result.error); if (!result.data) throw new HttpError(404, 'تیکت یافت نشد'); await createNotification(db,auth,{userId:result.data.AssignedToUserId,title:'تیکت به‌روزرسانی شد',body:result.data.Title,type:notificationType.ticket,actionUrl:'/tickets',entityId:result.data.Id,entityType:'Ticket'}); return json(request, camelize(result.data))
  }
  if (request.method === 'POST' && commentMatch) {
    requirePermission(auth, 'tickets.comment')
    const input = await body<Obj>(request); const text = String(input.text ?? '').trim()
    if (!text) throw new HttpError(400, 'متن پاسخ الزامی است')
    const user = await db.from('Users').select('FirstName,LastName').eq('TenantId', auth.tenantId).eq('Id', auth.userId).single(); check(user.error)
    const result = await db.from('TicketComments').insert({ ...base(auth.tenantId, auth.userId), TicketId: commentMatch[1], Text: text, AuthorName: `${user.data.FirstName} ${user.data.LastName}`, IsCustomer: false }).select().single()
    check(result.error); const ticket=await db.from('Tickets').select('Id,Title,AssignedToUserId,CreatedByUserId').eq('TenantId',auth.tenantId).eq('Id',commentMatch[1]).single();check(ticket.error);const target=ticket.data.CreatedByUserId===auth.userId?ticket.data.AssignedToUserId:ticket.data.CreatedByUserId;await createNotification(db,auth,{userId:target,title:'پاسخ جدید در تیکت',body:ticket.data.Title,type:notificationType.ticket,actionUrl:'/tickets',entityId:ticket.data.Id,entityType:'Ticket'}); return json(request, camelize(result.data), 201)
  }
  if (request.method === 'DELETE' && ticketMatch) {
    requirePermission(auth, 'tickets.delete')
    const result = await db.from('Tickets').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', ticketMatch[1]); check(result.error)
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}
