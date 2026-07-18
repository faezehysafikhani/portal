import bcrypt from 'bcryptjs'
import { adminClient, authenticate, AuthContext, issueToken, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json, pascalize, uuid } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handlePublicCustomer, handleTicketsCustomers } from './tickets-customers.ts'
import { handleCollaboration } from './collaboration.ts'
import { handleLetters } from './letters.ts'
import { handleIntegrations } from './integrations.ts'
import { handleReports } from './reports.ts'

type JsonObject = Record<string, unknown>
type Db = ReturnType<typeof adminClient>

const db = adminClient()
const tenantDefault = '00000000-0000-0000-0000-000000000001'
const now = () => new Date().toISOString()

function requireAdmin(auth: AuthContext): void {
  if (!auth.isAdmin) {
    throw new HttpError(403, 'فقط مدیر سیستم مجاز به مدیریت دسترسی‌های کاربران است')
  }
}

const permissionDependencies: Record<string, string[]> = {
  'users.view': ['users.create', 'users.edit', 'users.delete', 'users.password.reset'],
  'letters.inbox.view': ['letters.create', 'letters.edit', 'letters.sign', 'letters.send', 'letters.refer', 'letters.archive', 'letters.delete', 'letters.print'],
  'tickets.view': ['tickets.create', 'tickets.edit', 'tickets.comment', 'tickets.delete'],
  'contacts.view': ['contacts.create', 'contacts.edit', 'contacts.delete'],
  'calendar.view': ['calendar.create', 'calendar.edit', 'calendar.delete', 'calendar.respond'],
  'tasks.view': ['tasks.create', 'tasks.edit', 'tasks.assign'],
  'forms.view': ['forms.create', 'forms.approve', 'forms.access'],
  'sms.view': ['sms.settings'],
  'settings.view': ['settings.edit', 'positions.view', 'positions.create', 'positions.edit', 'positions.delete'],
  'positions.view': ['positions.create', 'positions.edit', 'positions.delete'],
  'reports.view': ['reports.export'],
  'company.view': ['company.edit'],
  'ai.view': ['ai.use', 'ai.settings'],
}

function routePath(url: URL): string {
  const marker = '/api/v1'
  const index = url.pathname.indexOf(marker)
  return index >= 0 ? url.pathname.slice(index + marker.length).replace(/\/$/, '') || '/' : url.pathname
}

function failOnDb(error: { message: string } | null, fallback = 'خطا در دسترسی به پایگاه داده'): void {
  if (error) {
    console.error(error.message)
    throw new HttpError(500, fallback)
  }
}

function baseInsert(auth: AuthContext): JsonObject {
  return {
    Id: uuid(), TenantId: auth.tenantId, CreatedAt: now(), UpdatedAt: null,
    CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null,
  }
}

function asCamel(value: unknown): unknown {
  return camelize(value)
}

async function login(request: Request): Promise<Response> {
  const input = await body<{ username?: string; password?: string; tenantId?: string }>(request)
  const username = String(input.username ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')
  const tenantId = String(input.tenantId ?? tenantDefault)
  if (!username || !password) throw new HttpError(400, 'نام کاربری و رمز عبور الزامی است')

  const { data: user, error } = await db.from('Users').select('*')
    .eq('TenantId', tenantId).eq('Username', username).eq('IsDeleted', false).maybeSingle()
  failOnDb(error)
  if (!user || !user.IsActive || !await bcrypt.compare(password, user.PasswordHash)) {
    if (user) {
      const failed = Number(user.FailedLoginCount ?? 0) + 1
      await db.from('Users').update({
        FailedLoginCount: failed,
        LockoutEnd: failed >= 5 ? new Date(Date.now() + 30 * 60_000).toISOString() : null,
      }).eq('Id', user.Id).eq('TenantId', tenantId)
    }
    throw new HttpError(401, 'نام کاربری یا رمز عبور اشتباه است')
  }
  if (user.LockoutEnd && new Date(user.LockoutEnd).getTime() > Date.now()) {
    throw new HttpError(423, 'حساب کاربری موقتاً قفل است')
  }

  const { data: links, error: linkError } = await db.from('UserPermissions')
    .select('PermissionId').eq('TenantId', tenantId).eq('UserId', user.Id).eq('IsDeleted', false)
  failOnDb(linkError)
  const permissionIds = (links ?? []).map((item) => item.PermissionId)
  let permissions: string[] = []
  if (permissionIds.length) {
    const { data: rows, error: permissionError } = await db.from('Permissions')
      .select('Code').eq('TenantId', tenantId).eq('IsDeleted', false).in('Id', permissionIds)
    failOnDb(permissionError)
    permissions = (rows ?? []).map((item) => String(item.Code))
  }

  const auth: AuthContext = {
    userId: user.Id, tenantId, username: user.Username,
    permissions, isAdmin: String(user.Username).toLowerCase() === 'admin',
  }
  const accessToken = await issueToken(auth)
  const companyResult = await db.from('Tenants').select('Id,Name,LogoUrl,Website').eq('Id', tenantId).maybeSingle()
  failOnDb(companyResult.error)
  await db.from('Users').update({ FailedLoginCount: 0, LockoutEnd: null, LastLoginAt: now() })
    .eq('Id', user.Id).eq('TenantId', tenantId)

  return json(request, {
    accessToken,
    user: {
      id: user.Id, username: user.Username,
      fullName: `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim(),
      email: user.Email, avatarUrl: user.AvatarUrl,
      department: user.Department, position: user.Position,
      roles: auth.isAdmin ? ['Admin'] : [],
    },
    permissions,
    company: asCamel(companyResult.data),
    expiresIn: 43200,
  })
}

async function publicCompany(request: Request, url: URL): Promise<Response> {
  const tenantId = String(url.searchParams.get('tenantId') ?? tenantDefault)
  const result = await db.from('Tenants').select('Id,Name,LogoUrl,Website').eq('Id', tenantId).eq('IsActive', true).maybeSingle()
  failOnDb(result.error)
  if (!result.data) throw new HttpError(404, 'اطلاعات شرکت یافت نشد')
  return json(request, asCamel(result.data))
}

async function company(request: Request, auth: AuthContext): Promise<Response> {
  if (request.method === 'GET') {
    requirePermission(auth, 'company.view')
    const result = await db.from('Tenants').select('Id,Name,LogoUrl,Phone,Email,Address,Website,NationalId,EconomicCode,IsActive')
      .eq('Id', auth.tenantId).maybeSingle()
    failOnDb(result.error)
    if (!result.data) throw new HttpError(404, 'اطلاعات شرکت یافت نشد')
    return json(request, asCamel(result.data))
  }
  if (request.method === 'PUT') {
    requirePermission(auth, 'company.edit')
    const input = await body<JsonObject>(request)
    const logoUrl = input.logoUrl == null ? null : String(input.logoUrl)
    if (logoUrl && (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(logoUrl) || logoUrl.length > 3_000_000)) {
      throw new HttpError(400, 'لوگو باید تصویر PNG، JPG، WEBP یا GIF و حداکثر ۲ مگابایت باشد')
    }
    const name = String(input.name ?? '').trim()
    if (!name) throw new HttpError(400, 'نام شرکت الزامی است')
    const values = {
      Name: name,
      LogoUrl: logoUrl,
      Phone: input.phone ? String(input.phone) : null,
      Email: input.email ? String(input.email) : null,
      Address: input.address ? String(input.address) : null,
      Website: input.website ? String(input.website) : null,
      NationalId: input.nationalId ? String(input.nationalId) : null,
      EconomicCode: input.economicCode ? String(input.economicCode) : null,
      UpdatedAt: now(),
    }
    const result = await db.from('Tenants').update(values).eq('Id', auth.tenantId)
      .select('Id,Name,LogoUrl,Phone,Email,Address,Website,NationalId,EconomicCode,IsActive').maybeSingle()
    failOnDb(result.error)
    if (!result.data) throw new HttpError(404, 'اطلاعات شرکت یافت نشد')
    return json(request, asCamel(result.data))
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

const registryFields = ['Name', 'Prefix', 'Separator', 'IncludeYear', 'IncludeMonth', 'CurrentNumber', 'PadLength', 'IsActive', 'Description'] as const

async function registries(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response> {
  requireAdmin(auth)
  const accessMatch = path.match(/^\/registries\/([0-9a-f-]+)\/access$/i)
  if (accessMatch) {
    const registry = await db.from('Registries').select('Id').eq('TenantId', auth.tenantId).eq('Id', accessMatch[1]).eq('IsDeleted', false).maybeSingle()
    failOnDb(registry.error)
    if (!registry.data) throw new HttpError(404, 'دبیرخانه یافت نشد')
    const input = request.method === 'PUT' ? await body<JsonObject>(request) : null
    const userId = request.method === 'GET' ? String(url.searchParams.get('userId') ?? '') : String(input?.userId ?? '')
    if (!userId) throw new HttpError(400, 'انتخاب کاربر الزامی است')
    const user = await db.from('Users').select('Id').eq('TenantId', auth.tenantId).eq('Id', userId).eq('IsDeleted', false).eq('IsActive', true).maybeSingle()
    failOnDb(user.error)
    if (!user.data) throw new HttpError(400, 'کاربر انتخاب‌شده معتبر نیست')
    if (request.method === 'GET') {
      const result = await db.from('RegistryUserAccess').select('*').eq('TenantId', auth.tenantId).eq('RegistryId', accessMatch[1]).eq('UserId', userId).eq('IsDeleted', false).maybeSingle()
      failOnDb(result.error)
      return json(request, result.data ? asCamel(result.data) : null)
    }
    if (request.method === 'PUT') {
      const accessObjects = [input?.internalAccess, input?.outgoingAccess, input?.incomingAccess] as JsonObject[]
      const hasDetailedAccess = String(input?.draftScope ?? 'none') !== 'none' || accessObjects.some((access) =>
        access && (String(access.view) !== 'ندارد' || Object.entries(access).some(([key, value]) => key !== 'view' && value === true))
      )
      const permission = await db.from('Permissions').select('Id').eq('TenantId', auth.tenantId).eq('Code', 'letters.registry.view').eq('IsDeleted', false).maybeSingle()
      failOnDb(permission.error)
      if (!permission.data) throw new HttpError(500, 'مجوز دبیرخانه در سیستم تعریف نشده است')
      if (!hasDetailedAccess) {
        const removed = await db.from('RegistryUserAccess').delete().eq('TenantId', auth.tenantId).eq('RegistryId', accessMatch[1]).eq('UserId', userId)
        failOnDb(removed.error)
        const remaining = await db.from('RegistryUserAccess').select('Id', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('UserId', userId).eq('IsDeleted', false)
        failOnDb(remaining.error)
        if ((remaining.count ?? 0) === 0) {
          const revoked = await db.from('UserPermissions').delete().eq('TenantId', auth.tenantId).eq('UserId', userId).eq('PermissionId', permission.data.Id)
          failOnDb(revoked.error)
        }
        return json(request, { removed: true, message: 'دسترسی این کاربر به دبیرخانه برداشته شد' })
      }
      const values = {
        DraftScope: ['all', 'own', 'none'].includes(String(input?.draftScope)) ? String(input?.draftScope) : 'none',
        InternalAccess: input?.internalAccess ?? {}, OutgoingAccess: input?.outgoingAccess ?? {}, IncomingAccess: input?.incomingAccess ?? {},
        UpdatedAt: now(), IsDeleted: false, DeletedAt: null,
      }
      const existing = await db.from('RegistryUserAccess').select('Id').eq('TenantId', auth.tenantId).eq('RegistryId', accessMatch[1]).eq('UserId', userId).maybeSingle()
      failOnDb(existing.error)
      const result = existing.data
        ? await db.from('RegistryUserAccess').update(values).eq('Id', existing.data.Id).eq('TenantId', auth.tenantId).select().single()
        : await db.from('RegistryUserAccess').insert({ ...baseInsert(auth), RegistryId: accessMatch[1], UserId: userId, ...values }).select().single()
      failOnDb(result.error)
      if (String(userId) !== tenantDefault) {
        const directPermission = await db.from('UserPermissions').select('Id').eq('TenantId', auth.tenantId).eq('UserId', userId).eq('PermissionId', permission.data.Id).eq('IsDeleted', false).maybeSingle()
        failOnDb(directPermission.error)
        if (!directPermission.data) {
          const granted = await db.from('UserPermissions').insert({ ...baseInsert(auth), UserId: userId, PermissionId: permission.data.Id })
          failOnDb(granted.error)
        }
      }
      return json(request, asCamel(result.data))
    }
    throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
  }

  const match = path.match(/^\/registries\/([0-9a-f-]+)$/i)
  if (request.method === 'GET' && !match) {
    const [registryResult, accessResult, usersResult] = await Promise.all([
      db.from('Registries').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt'),
      db.from('RegistryUserAccess').select('RegistryId,UserId').eq('TenantId', auth.tenantId).eq('IsDeleted', false),
      db.from('Users').select('Id,FirstName,LastName,Username').eq('TenantId', auth.tenantId).eq('IsDeleted', false),
    ])
    failOnDb(registryResult.error); failOnDb(accessResult.error); failOnDb(usersResult.error)
    const names = new Map((usersResult.data ?? []).map((user) => [user.Id, `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim() || user.Username]))
    return json(request, (registryResult.data ?? []).map((registry) => ({
      ...(asCamel(registry) as JsonObject),
      userAccess: (accessResult.data ?? []).filter((item) => item.RegistryId === registry.Id).map((item) => names.get(item.UserId)).filter(Boolean),
    })))
  }
  if (request.method === 'POST' && !match) {
    const input = await body<JsonObject>(request)
    const name = String(input.name ?? '').trim()
    if (!name) throw new HttpError(400, 'نام دبیرخانه الزامی است')
    const result = await db.from('Registries').insert({ ...baseInsert(auth), ...pascalize(input, registryFields), Name: name }).select().single()
    failOnDb(result.error); return json(request, asCamel(result.data), 201)
  }
  if (request.method === 'PUT' && match) {
    const input = await body<JsonObject>(request)
    const result = await db.from('Registries').update({ ...pascalize(input, registryFields), UpdatedAt: now() })
      .eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('IsDeleted', false).select().maybeSingle()
    failOnDb(result.error); if (!result.data) throw new HttpError(404, 'دبیرخانه یافت نشد'); return json(request, asCamel(result.data))
  }
  if (request.method === 'DELETE' && match) {
    const result = await db.from('Registries').update({ IsDeleted: true, DeletedAt: now(), UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', match[1])
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function changePassword(request: Request, auth: AuthContext): Promise<Response> {
  const input = await body<{ currentPassword?: string; newPassword?: string }>(request)
  if (!input.newPassword || input.newPassword.length < 8) throw new HttpError(400, 'رمز جدید حداقل باید ۸ کاراکتر باشد')
  const { data: user, error } = await db.from('Users').select('PasswordHash')
    .eq('Id', auth.userId).eq('TenantId', auth.tenantId).single()
  failOnDb(error)
  if (!await bcrypt.compare(String(input.currentPassword ?? ''), user.PasswordHash)) {
    throw new HttpError(400, 'رمز عبور فعلی اشتباه است')
  }
  const PasswordHash = await bcrypt.hash(input.newPassword, 12)
  const result = await db.from('Users').update({ PasswordHash, UpdatedAt: now() })
    .eq('Id', auth.userId).eq('TenantId', auth.tenantId)
  failOnDb(result.error)
  return json(request, { message: 'رمز عبور با موفقیت تغییر کرد' })
}

const contactFields = [
  'FullName', 'CompanyName', 'JobTitle', 'Mobile', 'Phone', 'Email', 'Address', 'Notes',
  'IsInternal', 'LinkedUserId', 'Industry', 'Fax', 'Website', 'PostalCode', 'NationalId',
  'EconomicCode', 'Department', 'Extension',
] as const

async function contacts(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response> {
  requirePermission(auth, 'contacts.view')
  const match = path.match(/^\/contacts\/([0-9a-f-]+)$/i)
  if (request.method === 'GET' && !match) {
    let query = db.from('Contacts').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    const search = url.searchParams.get('search')?.trim()
    if (search) query = query.or(`FullName.ilike.%${search.replaceAll(',', '')}%,CompanyName.ilike.%${search.replaceAll(',', '')}%,Mobile.ilike.%${search.replaceAll(',', '')}%`)
    const result = await query.order('FullName')
    failOnDb(result.error)
    return json(request, asCamel(result.data))
  }
  if (request.method === 'GET' && match) {
    const result = await db.from('Contacts').select('*').eq('TenantId', auth.tenantId)
      .eq('Id', match[1]).eq('IsDeleted', false).maybeSingle()
    failOnDb(result.error)
    if (!result.data) throw new HttpError(404, 'مخاطب یافت نشد')
    return json(request, asCamel(result.data))
  }
  if (request.method === 'POST' && !match) {
    requirePermission(auth, 'contacts.create')
    const input = pascalize(await body<JsonObject>(request), contactFields)
    if (!String(input.FullName ?? '').trim()) throw new HttpError(400, 'نام مخاطب الزامی است')
    input.FullName = String(input.FullName).trim()
    const result = await db.from('Contacts').insert({ ...baseInsert(auth), ...input }).select().single()
    failOnDb(result.error)
    return json(request, asCamel(result.data), 201)
  }
  if (request.method === 'PUT' && match) {
    requirePermission(auth, 'contacts.edit')
    const input = pascalize(await body<JsonObject>(request), contactFields)
    const result = await db.from('Contacts').update({ ...input, UpdatedAt: now() })
      .eq('Id', match[1]).eq('TenantId', auth.tenantId).eq('IsDeleted', false).select().maybeSingle()
    failOnDb(result.error)
    if (!result.data) throw new HttpError(404, 'مخاطب یافت نشد')
    return json(request, asCamel(result.data))
  }
  if (request.method === 'DELETE' && match) {
    requirePermission(auth, 'contacts.delete')
    const result = await db.from('Contacts').update({ IsDeleted: true, DeletedAt: now() })
      .eq('Id', match[1]).eq('TenantId', auth.tenantId)
    failOnDb(result.error)
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function directory(request: Request, auth: AuthContext): Promise<Response> {
  const [users, contacts] = await Promise.all([
    db.from('Users').select('Id,Username,FirstName,LastName,AvatarUrl,Department,Position,PhoneNumber,SignatureDataUrl,SignatureText')
      .eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('IsActive', true).order('FirstName'),
    db.from('Contacts').select('Id,FullName,CompanyName,JobTitle,Mobile,Phone,Email,LinkedUserId')
      .eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('FullName'),
  ])
  failOnDb(users.error); failOnDb(contacts.error)
  return json(request, {
    users: (users.data ?? []).map((user) => ({
      id: user.Id, username: user.Username,
      fullName: `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim() || user.Username,
      avatarUrl: user.AvatarUrl, department: user.Department, position: user.Position,
      phoneNumber: user.PhoneNumber, signatureDataUrl: user.SignatureDataUrl, signatureText: user.SignatureText,
      isCurrentUser: user.Id === auth.userId,
    })),
    contacts: asCamel(contacts.data),
  })
}

const taskStatus = ['Todo', 'InProgress', 'InReview', 'Done', 'Cancelled']
const taskPriority = ['Low', 'Medium', 'High', 'Critical']
function taskDto(item: JsonObject): JsonObject {
  const result = asCamel(item) as JsonObject
  result.status = typeof item.Status === 'number' ? taskStatus[item.Status] : item.Status
  result.priority = typeof item.Priority === 'number' ? taskPriority[item.Priority] : item.Priority
  return result
}
function enumValue(value: unknown, names: string[]): unknown {
  if (typeof value !== 'string') return value
  const index = names.findIndex((name) => name.toLowerCase() === value.toLowerCase())
  return index >= 0 ? index : value
}

async function tasks(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response> {
  requirePermission(auth, 'tasks.view')
  const match = path.match(/^\/tasks\/([0-9a-f-]+)$/i)
  if (request.method === 'GET' && !match) {
    let query = db.from('Tasks').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    query = url.searchParams.get('scope') === 'assigned'
      ? query.eq('AssignedByUserId', auth.userId)
      : query.or(`AssignedToUserId.eq.${auth.userId},AssignedByUserId.eq.${auth.userId}`)
    const status = url.searchParams.get('status')
    if (status) query = query.eq('Status', enumValue(status, taskStatus))
    const result = await query.order('DueDate', { nullsFirst: false })
    failOnDb(result.error)
    return json(request, (result.data ?? []).map((item) => taskDto(item)))
  }
  if (request.method === 'POST' && !match) {
    requirePermission(auth, 'tasks.create')
    const input = await body<JsonObject>(request)
    const assignee = String(input.assignedToUserId ?? auth.userId)
    if (assignee !== auth.userId) requirePermission(auth, 'tasks.assign')
    const row = {
      ...baseInsert(auth), Title: String(input.title ?? '').trim(), Description: input.description ?? null,
      Priority: enumValue(input.priority ?? 1, taskPriority), Status: 0,
      StartDate: input.startDate ?? null, DueDate: input.dueDate ?? null,
      AssignedByUserId: auth.userId, AssignedToUserId: assignee,
      ParentTaskId: input.parentTaskId ?? null, EstimatedHours: input.estimatedHours ?? null, Progress: 0,
    }
    if (!row.Title) throw new HttpError(400, 'عنوان وظیفه الزامی است')
    const result = await db.from('Tasks').insert(row).select().single()
    failOnDb(result.error)
    return json(request, taskDto(result.data))
  }
  if (request.method === 'PATCH' && match) {
    requirePermission(auth, 'tasks.edit')
    const input = await body<JsonObject>(request)
    const update: JsonObject = { UpdatedAt: now() }
    if (input.status !== undefined) update.Status = enumValue(input.status, taskStatus)
    if (input.progress !== undefined) update.Progress = Math.max(0, Math.min(100, Number(input.progress)))
    if (input.actualHours !== undefined) update.ActualHours = input.actualHours
    if (input.dueDate !== undefined) update.DueDate = input.dueDate
    const result = await db.from('Tasks').update(update).eq('TenantId', auth.tenantId).eq('Id', match[1])
      .or(`AssignedToUserId.eq.${auth.userId},AssignedByUserId.eq.${auth.userId}`).eq('IsDeleted', false).select().maybeSingle()
    failOnDb(result.error)
    if (!result.data) throw new HttpError(404, 'وظیفه یافت نشد')
    return json(request, taskDto(result.data))
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function positions(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'positions.view')
  const match = path.match(/^\/positions\/([0-9a-f-]+)$/i)
  if (request.method === 'GET') {
    const result = await db.from('OrgPositions').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('Title')
    failOnDb(result.error)
    return json(request, asCamel(result.data))
  }
  const rawInput = request.method === 'DELETE' ? {} : await body<JsonObject>(request)
  const input = pascalize(rawInput, ['Title', 'Description', 'ParentId', 'Color', 'OrgId'])
  if (request.method === 'POST' && !match) {
    requirePermission(auth, 'positions.create')
    const title = String(input.Title ?? '').trim()
    if (!title) throw new HttpError(400, 'عنوان سمت الزامی است')
    const result = await db.from('OrgPositions').insert({
      ...baseInsert(auth), ...input, Title: title,
      Color: String(input.Color ?? '#1677ff'), OrgId: String(input.OrgId ?? '1'), IsSystem: false,
    }).select().single()
    failOnDb(result.error); return json(request, asCamel(result.data), 201)
  }
  if (request.method === 'PUT' && match) {
    requirePermission(auth, 'positions.edit')
    const result = await db.from('OrgPositions').update({ ...input, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', match[1]).select().maybeSingle()
    failOnDb(result.error); if (!result.data) throw new HttpError(404, 'سمت یافت نشد'); return json(request, asCamel(result.data))
  }
  if (request.method === 'DELETE' && match) {
    requirePermission(auth, 'positions.delete')
    const result = await db.from('OrgPositions').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', match[1])
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function notifications(request: Request, auth: AuthContext, path: string): Promise<Response> {
  const read = path.match(/^\/notifications\/([0-9a-f-]+)\/read$/i)
  const one = path.match(/^\/notifications\/([0-9a-f-]+)$/i)
  if (request.method === 'GET') {
    const result = await db.from('Notifications').select('*').eq('TenantId', auth.tenantId)
      .eq('UserId', auth.userId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(100)
    failOnDb(result.error); return json(request, asCamel(result.data))
  }
  if (request.method === 'PATCH' && read) {
    const result = await db.from('Notifications').update({ IsRead: true, ReadAt: now() }).eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('Id', read[1])
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  if (request.method === 'PATCH' && path === '/notifications/read-all') {
    const result = await db.from('Notifications').update({ IsRead: true, ReadAt: now() }).eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('IsRead', false)
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  if (request.method === 'DELETE' && one) {
    const result = await db.from('Notifications').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('Id', one[1])
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  if (request.method === 'DELETE' && path === '/notifications') {
    const result = await db.from('Notifications').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('UserId', auth.userId)
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

function profileDto(user: JsonObject): JsonObject {
  return {
    id: user.Id, username: user.Username,
    fullName: `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim(),
    firstName: user.FirstName, lastName: user.LastName, email: user.Email,
    phoneNumber: user.PhoneNumber, fixedPhone: user.FixedPhone, address: user.Address,
    department: user.Department, position: user.Position, avatarUrl: user.AvatarUrl,
    signatureDataUrl: user.SignatureDataUrl, signatureText: user.SignatureText,
  }
}

async function profile(request: Request, auth: AuthContext, path: string): Promise<Response> {
  if (request.method === 'GET') {
    const result = await db.from('Users').select('*').eq('TenantId', auth.tenantId).eq('Id', auth.userId).single()
    failOnDb(result.error); return json(request, profileDto(result.data))
  }
  const input = await body<JsonObject>(request)
  const update: JsonObject = { UpdatedAt: now() }
  if (path === '/profile/avatar') update.AvatarUrl = input.imageData ?? null
  else if (path === '/profile/signature') {
    if (input.imageData !== undefined) update.SignatureDataUrl = input.imageData
    if (input.text !== undefined) update.SignatureText = input.text
  } else {
    const names = String(input.fullName ?? '').trim().split(/\s+/)
    if (names[0]) update.FirstName = names[0]
    if (names.length > 1) update.LastName = names.slice(1).join(' ')
    Object.assign(update, pascalize(input, ['Email', 'PhoneNumber', 'FixedPhone', 'Department', 'Position', 'Address']))
  }
  const result = await db.from('Users').update(update).eq('TenantId', auth.tenantId).eq('Id', auth.userId).select().single()
  failOnDb(result.error); return json(request, path === '/profile/avatar' ? { avatarUrl: result.data.AvatarUrl } : profileDto(result.data))
}

async function users(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'users.view')
  if (path === '/users/permissions' && request.method === 'GET') {
    requireAdmin(auth)
    const result = await db.from('Permissions').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('Module').order('Code')
    failOnDb(result.error); return json(request, asCamel(result.data))
  }
  const permissionMatch = path.match(/^\/users\/([0-9a-f-]+)\/permissions$/i)
  if (permissionMatch && request.method === 'GET') {
    requireAdmin(auth)
    const result = await db.from('UserPermissions').select('PermissionId').eq('TenantId', auth.tenantId).eq('UserId', permissionMatch[1]).eq('IsDeleted', false)
    failOnDb(result.error); return json(request, (result.data ?? []).map((item) => item.PermissionId))
  }
  if (permissionMatch && request.method === 'PUT') {
    requireAdmin(auth)
    const input = await body<{ permissionIds?: string[] }>(request)
    const target = await db.from('Users').select('Id, Username').eq('TenantId', auth.tenantId).eq('Id', permissionMatch[1]).eq('IsDeleted', false).maybeSingle()
    failOnDb(target.error)
    if (!target.data) throw new HttpError(404, 'کاربر یافت نشد')
    if (String(target.data.Username).toLowerCase() === 'admin') throw new HttpError(400, 'دسترسی مدیر سیستم قابل محدود کردن نیست')

    const requestedIds = [...new Set(input.permissionIds ?? [])]
    let selectedPermissions: { Id: string; Code: string }[] = []
    if (requestedIds.length) {
      const selected = await db.from('Permissions').select('Id, Code').eq('TenantId', auth.tenantId).eq('IsDeleted', false).in('Id', requestedIds)
      failOnDb(selected.error)
      if ((selected.data ?? []).length !== requestedIds.length) throw new HttpError(400, 'یک یا چند دسترسی نامعتبر است')
      selectedPermissions = selected.data ?? []
    }

    const selectedCodes = new Set(selectedPermissions.map((permission) => permission.Code))
    const requiredCodes = Object.entries(permissionDependencies)
      .filter(([, actions]) => actions.some((action) => selectedCodes.has(action)))
      .map(([viewCode]) => viewCode)
      .filter((code) => !selectedCodes.has(code))
    if (requiredCodes.length) {
      const required = await db.from('Permissions').select('Id, Code').eq('TenantId', auth.tenantId).eq('IsDeleted', false).in('Code', requiredCodes)
      failOnDb(required.error)
      selectedPermissions.push(...(required.data ?? []))
    }

    const existing = await db.from('UserPermissions').delete().eq('TenantId', auth.tenantId).eq('UserId', permissionMatch[1])
    failOnDb(existing.error)
    const rows = [...new Set(selectedPermissions.map((permission) => permission.Id))].map((permissionId) => ({
      ...baseInsert(auth), UserId: target.data.Id, PermissionId: permissionId,
    }))
    if (rows.length) { const added = await db.from('UserPermissions').insert(rows); failOnDb(added.error) }
    return json(request, { message: 'دسترسی‌های کاربر ذخیره شد؛ کاربر باید دوباره وارد سامانه شود' })
  }

  const resetMatch = path.match(/^\/users\/([0-9a-f-]+)\/reset-password$/i)
  if (resetMatch && request.method === 'POST') {
    requirePermission(auth, 'users.password.reset')
    const input = await body<{ newPassword?: string }>(request)
    if (!input.newPassword || input.newPassword.length < 8) throw new HttpError(400, 'رمز عبور حداقل باید ۸ کاراکتر باشد')
    const result = await db.from('Users').update({ PasswordHash: await bcrypt.hash(input.newPassword, 12), UpdatedAt: now() })
      .eq('TenantId', auth.tenantId).eq('Id', resetMatch[1])
    failOnDb(result.error); return json(request, { message: 'رمز عبور تغییر کرد' })
  }
  const toggleMatch = path.match(/^\/users\/([0-9a-f-]+)\/toggle-active$/i)
  if (toggleMatch && request.method === 'PATCH') {
    requirePermission(auth, 'users.edit')
    const current = await db.from('Users').select('IsActive').eq('TenantId', auth.tenantId).eq('Id', toggleMatch[1]).single()
    failOnDb(current.error)
    const result = await db.from('Users').update({ IsActive: !current.data.IsActive, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', toggleMatch[1]).select().single()
    failOnDb(result.error); return json(request, asCamel(result.data))
  }
  const userMatch = path.match(/^\/users\/([0-9a-f-]+)$/i)
  if (request.method === 'GET' && !userMatch) {
    const result = await db.from('Users').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('FirstName')
    failOnDb(result.error)
    const links = await db.from('UserPermissions').select('UserId').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    failOnDb(links.error)
    const permissionCounts = new Map<string, number>()
    for (const link of links.data ?? []) {
      permissionCounts.set(link.UserId, (permissionCounts.get(link.UserId) ?? 0) + 1)
    }
    return json(request, (result.data ?? []).map((user) => ({
      ...profileDto(user),
      permissionCount: String(user.Username).toLowerCase() === 'admin' ? null : (permissionCounts.get(user.Id) ?? 0),
    })))
  }
  if (request.method === 'GET' && userMatch) {
    const result = await db.from('Users').select('*').eq('TenantId', auth.tenantId).eq('Id', userMatch[1]).eq('IsDeleted', false).maybeSingle()
    failOnDb(result.error); if (!result.data) throw new HttpError(404, 'کاربر یافت نشد'); return json(request, profileDto(result.data))
  }
  const userFields = ['Username', 'Email', 'FirstName', 'LastName', 'PhoneNumber', 'Department', 'Position', 'DirectManager', 'HrManager', 'SignatureDataUrl', 'SignatureText'] as const
  if (request.method === 'POST' && !userMatch) {
    requirePermission(auth, 'users.create')
    const input = await body<JsonObject>(request)
    const row = { ...baseInsert(auth), ...pascalize(input, userFields), PasswordHash: await bcrypt.hash(String(input.password ?? ''), 12), IsActive: true, FailedLoginCount: 0, IsTwoFactorEnabled: false }
    if (!row.Username || String(input.password ?? '').length < 8) throw new HttpError(400, 'نام کاربری و رمز حداقل ۸ کاراکتری الزامی است')
    const result = await db.from('Users').insert(row).select().single()
    failOnDb(result.error, 'نام کاربری یا ایمیل تکراری است'); return json(request, profileDto(result.data), 201)
  }
  if (request.method === 'PUT' && userMatch) {
    requirePermission(auth, 'users.edit')
    const update = { ...pascalize(await body<JsonObject>(request), userFields.filter((x) => x !== 'Username')), UpdatedAt: now() }
    const result = await db.from('Users').update(update).eq('TenantId', auth.tenantId).eq('Id', userMatch[1]).select().maybeSingle()
    failOnDb(result.error); if (!result.data) throw new HttpError(404, 'کاربر یافت نشد'); return json(request, profileDto(result.data))
  }
  if (request.method === 'DELETE' && userMatch) {
    requirePermission(auth, 'users.delete')
    if (userMatch[1] === auth.userId) throw new HttpError(400, 'حذف حساب جاری مجاز نیست')
    const result = await db.from('Users').update({ IsDeleted: true, IsActive: false, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', userMatch[1])
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function letterTemplates(request: Request, auth: AuthContext, path: string): Promise<Response> {
  const match = path.match(/^\/letter-templates\/(.+)$/)
  if (request.method === 'GET') {
    const result = await db.from('LetterTemplates').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('TemplateKey')
    failOnDb(result.error); return json(request, asCamel(result.data))
  }
  if (request.method === 'PUT' && match) {
    requirePermission(auth, 'settings.edit')
    const input = await body<JsonObject>(request)
    const templateKey = decodeURIComponent(match[1])
    const name = String(input.name ?? '').trim()
    const imageData = String(input.imageData ?? '')
    if (!name || !imageData) throw new HttpError(400, 'نام و تصویر قالب الزامی است')
    const existing = await db.from('LetterTemplates').select('Id').eq('TenantId', auth.tenantId).eq('TemplateKey', templateKey).maybeSingle()
    failOnDb(existing.error)
    const values = {
      Name: name,
      PaperSize: String(input.paperSize ?? 'A4'),
      HasHeader: Boolean(input.hasHeader),
      HasFooter: Boolean(input.hasFooter),
      ImageData: imageData,
      FileName: input.fileName ? String(input.fileName) : null,
      IsActive: true,
      IsDeleted: false,
      DeletedAt: null,
      UpdatedAt: now(),
    }
    const result = existing.data
      ? await db.from('LetterTemplates').update(values).eq('Id', existing.data.Id).eq('TenantId', auth.tenantId).select().single()
      : await db.from('LetterTemplates').insert({ ...baseInsert(auth), TemplateKey: templateKey, ...values }).select().single()
    failOnDb(result.error); return json(request, asCamel(result.data))
  }
  if (request.method === 'DELETE' && match) {
    requirePermission(auth, 'settings.edit')
    const result = await db.from('LetterTemplates').update({ IsDeleted: true, DeletedAt: now(), UpdatedAt: now() })
      .eq('TenantId', auth.tenantId).eq('TemplateKey', decodeURIComponent(match[1]))
    failOnDb(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function dashboard(request: Request, auth: AuthContext): Promise<Response> {
  const count = async (table: string, customize?: (query: any) => any): Promise<number> => {
    let query: any = db.from(table).select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    if (customize) query = customize(query)
    const result = await query; failOnDb(result.error); return result.count ?? 0
  }
  const [unreadLetters, activeTasks, openTickets, usersCount, contactsCount] = await Promise.all([
    count('LetterRecipients', (q) => q.eq('UserId', auth.userId).eq('IsRead', false)),
    count('Tasks', (q) => q.or(`AssignedToUserId.eq.${auth.userId},AssignedByUserId.eq.${auth.userId}`).not('Status', 'in', '(3,4)')),
    count('Tickets', (q) => q.not('Status', 'in', '(closed,resolved)')),
    count('Users', (q) => q.eq('IsActive', true)), count('Contacts'),
  ])
  const recentTasksResult = await db.from('Tasks').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    .or(`AssignedToUserId.eq.${auth.userId},AssignedByUserId.eq.${auth.userId}`).order('CreatedAt', { ascending: false }).limit(5)
  failOnDb(recentTasksResult.error)
  return json(request, {
    unreadLetters, activeTasks, openTickets, todayEvents: 0,
    users: usersCount, contacts: contactsCount, recentLetters: [],
    recentTasks: (recentTasksResult.data ?? []).map(taskDto),
  })
}

async function dispatch(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  const url = new URL(request.url)
  const path = routePath(url)
  if (path === '/health' && request.method === 'GET') return json(request, { status: 'ok', runtime: 'supabase-edge' })
  if (path === '/auth/login' && request.method === 'POST') return await login(request)
  if (path === '/company/public' && request.method === 'GET') return await publicCompany(request, url)
  const publicCustomerResponse = await handlePublicCustomer(request, path)
  if (publicCustomerResponse) return publicCustomerResponse

  const auth = await authenticate(request)
  if (path === '/auth/logout' && request.method === 'POST') return json(request, { message: 'خروج موفق' })
  if (path === '/auth/change-password' && request.method === 'POST') return await changePassword(request, auth)
  if (path.startsWith('/contacts')) return await contacts(request, auth, path, url)
  if (path === '/directory' && request.method === 'GET') return await directory(request, auth)
  if (path.startsWith('/tasks')) return await tasks(request, auth, path, url)
  if (path.startsWith('/positions')) return await positions(request, auth, path)
  if (path.startsWith('/notifications')) return await notifications(request, auth, path)
  if (path.startsWith('/profile')) return await profile(request, auth, path)
  if (path.startsWith('/users')) return await users(request, auth, path)
  if (path === '/company') return await company(request, auth)
  if (path.startsWith('/registries')) return await registries(request, auth, path, url)
  if (path.startsWith('/letter-templates')) return await letterTemplates(request, auth, path)
  const ticketCustomerResponse = await handleTicketsCustomers(request, auth, path, url)
  if (ticketCustomerResponse) return ticketCustomerResponse
  const collaborationResponse = await handleCollaboration(request, auth, path, url)
  if (collaborationResponse) return collaborationResponse
  const lettersResponse = await handleLetters(request, auth, path, url)
  if (lettersResponse) return lettersResponse
  const integrationsResponse = await handleIntegrations(request, auth, path)
  if (integrationsResponse) return integrationsResponse
  const reportsResponse = await handleReports(request, auth, path)
  if (reportsResponse) return reportsResponse
  if (path === '/dashboard/summary' && request.method === 'GET') return await dashboard(request, auth)

  throw new HttpError(501, `مسیر ${path} هنوز به Edge Function منتقل نشده است`)
}

Deno.serve(async (request) => {
  try {
    return await dispatch(request)
  } catch (error) {
    if (error instanceof HttpError) return json(request, { message: error.message, details: error.details }, error.status)
    console.error(error)
    return json(request, { message: 'خطای داخلی سرویس' }, 500)
  }
})
