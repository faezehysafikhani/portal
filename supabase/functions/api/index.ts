import bcrypt from 'bcryptjs'
import { adminClient, authenticate, AuthContext, issueMfaToken, issueToken, requirePermission, verifyMfaToken } from '../_shared/auth.ts'
import { decryptSecret, encryptSecret } from '../_shared/crypto.ts'
import { generateBase32Secret, otpauthUri, verifyTotp } from '../_shared/totp.ts'
import { body, camelize, HttpError, json, pascalize, uuid } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { handlePublicCustomer, handleTicketsCustomers } from './tickets-customers.ts'
import { handleCollaboration } from './collaboration.ts'
import { handleLetters } from './letters.ts'
import { handleIntegrations } from './integrations.ts'
import { handleReports } from './reports.ts'
import { createNotification, notificationType } from '../_shared/notifications.ts'

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
  'forms.view': ['forms.create', 'forms.approve', 'forms.access','forms.type.leave_daily','forms.type.leave_hourly','forms.type.mission','forms.type.loan','forms.type.payslip','forms.type.resignation','forms.type.equipment','forms.type.personnel'],
  'forms.create': ['forms.type.leave_daily','forms.type.leave_hourly','forms.type.mission','forms.type.loan','forms.type.payslip','forms.type.resignation','forms.type.equipment','forms.type.personnel'],
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

interface SecurityPolicy {
  passwordMinLength: number; requireComplexity: boolean; maxFailedAttempts: number; lockoutMinutes: number
  captchaAfterAttempts: number; passwordExpiryDays: number; maxConcurrentSessions: number; twoFactorRequired: boolean
}
const DEFAULT_SECURITY: SecurityPolicy = {
  passwordMinLength: 8, requireComplexity: false, maxFailedAttempts: 5, lockoutMinutes: 30,
  captchaAfterAttempts: 3, passwordExpiryDays: 0, maxConcurrentSessions: 0, twoFactorRequired: false,
}
async function loadSecurity(tenantId: string): Promise<SecurityPolicy> {
  try {
    const r = await db.from('SecuritySettings').select('*').eq('TenantId', tenantId).eq('IsDeleted', false).maybeSingle()
    if (r.error || !r.data) return DEFAULT_SECURITY
    const d = r.data
    return {
      passwordMinLength: Number(d.PasswordMinLength ?? 8),
      requireComplexity: Boolean(d.RequireComplexity),
      maxFailedAttempts: Number(d.MaxFailedAttempts ?? 5),
      lockoutMinutes: Number(d.LockoutMinutes ?? 30),
      captchaAfterAttempts: Number(d.CaptchaAfterAttempts ?? 3),
      passwordExpiryDays: Number(d.PasswordExpiryDays ?? 0),
      maxConcurrentSessions: Number(d.MaxConcurrentSessions ?? 0),
      twoFactorRequired: Boolean(d.TwoFactorRequired),
    }
  } catch { return DEFAULT_SECURITY }
}
const requestIp = (request: Request): string | null =>
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('cf-connecting-ip') || null
async function recordLogin(tenantId: string, user: JsonObject | null, username: string, success: boolean, request: Request): Promise<void> {
  try {
    await db.from('LoginAudit').insert({
      Id: uuid(), TenantId: tenantId, UserId: user?.Id ?? null, Username: username,
      FullName: user ? `${user.FirstName ?? ''} ${user.LastName ?? ''}`.trim() : null,
      Success: success, Ip: requestIp(request),
      UserAgent: String(request.headers.get('user-agent') ?? '').slice(0, 300), CreatedAt: now(),
    })
    // Best-effort 30-day retention.
    await db.from('LoginAudit').delete().eq('TenantId', tenantId).lt('CreatedAt', new Date(Date.now() - 30 * 86_400_000).toISOString())
  } catch (e) {
    console.error('login audit failed', e)
  }
}
// Revoke a user's active sessions so their existing JWTs stop working on the next request.
async function revokeUserSessions(tenantId: string, userId: string, exceptJti?: string): Promise<void> {
  try {
    let q = db.from('UserSessions').update({ IsRevoked: true })
      .eq('TenantId', tenantId).eq('UserId', userId).eq('IsRevoked', false)
    if (exceptJti) q = q.neq('Jti', exceptJti)
    await q
  } catch (e) {
    console.error('revoke sessions failed', e)
  }
}

// Fixed-window rate limit. Returns true when the caller has exceeded `limit` within the window.
// Fail-open: any DB error returns false so a rate-limit outage never blocks legitimate traffic.
async function rateLimited(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await db.rpc('rate_limit_hit', { p_bucket: bucket, p_window_seconds: windowSeconds })
    if (error) { console.error('rate_limit_hit', error.message); return false }
    if (Math.random() < 0.02) { void db.from('RateLimits').delete().lt('ExpiresAt', now()).then(() => {}, () => {}) }
    return Number(data) > limit
  } catch { return false }
}

function passwordProblem(pw: string, policy: SecurityPolicy): string | null {
  if (pw.length < policy.passwordMinLength) return `رمز عبور باید حداقل ${policy.passwordMinLength} کاراکتر باشد`
  if (policy.requireComplexity && (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw))) {
    return 'رمز عبور باید شامل حروف کوچک و بزرگ انگلیسی و عدد باشد'
  }
  return null
}

async function login(request: Request): Promise<Response> {
  const input = await body<{ username?: string; password?: string; tenantId?: string }>(request)
  const username = String(input.username ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')
  const tenantId = String(input.tenantId ?? tenantDefault)
  if (!username || !password) throw new HttpError(400, 'نام کاربری و رمز عبور الزامی است')
  if (await rateLimited(`login:${requestIp(request) ?? 'unknown'}`, 30, 300)) {
    throw new HttpError(429, 'تلاش‌های ورود بیش از حد مجاز است؛ چند دقیقه دیگر دوباره تلاش کنید')
  }
  const policy = await loadSecurity(tenantId)

  const { data: user, error } = await db.from('Users').select('*')
    .eq('TenantId', tenantId).eq('Username', username).eq('IsDeleted', false).maybeSingle()
  failOnDb(error)
  if (!user || !user.IsActive || !await bcrypt.compare(password, user.PasswordHash)) {
    if (user) {
      const failed = Number(user.FailedLoginCount ?? 0) + 1
      await db.from('Users').update({
        FailedLoginCount: failed,
        LockoutEnd: failed >= policy.maxFailedAttempts ? new Date(Date.now() + policy.lockoutMinutes * 60_000).toISOString() : null,
      }).eq('Id', user.Id).eq('TenantId', tenantId)
      await recordLogin(tenantId, user, username, false, request)
    }
    throw new HttpError(401, 'نام کاربری یا رمز عبور اشتباه است')
  }
  if (user.LockoutEnd && new Date(user.LockoutEnd).getTime() > Date.now()) {
    throw new HttpError(423, 'حساب کاربری موقتاً قفل است')
  }

  // Second factor — only for users who have explicitly enabled TOTP; everyone else logs in as before.
  if (user.IsTwoFactorEnabled && user.TwoFactorSecret) {
    const mfaToken = await issueMfaToken(user.Id, tenantId)
    return json(request, { mfaRequired: true, mfaToken })
  }
  return await issueSession(request, user as JsonObject, tenantId, policy)
}

async function issueSession(request: Request, user: JsonObject, tenantId: string, policy: SecurityPolicy): Promise<Response> {
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
    userId: String(user.Id), tenantId, username: String(user.Username),
    permissions, isAdmin: String(user.Username).toLowerCase() === 'admin',
  }
  const jti = crypto.randomUUID()
  const accessToken = await issueToken(auth, jti)
  const companyResult = await db.from('Tenants').select('Id,Name,LogoUrl,Website').eq('Id', tenantId).maybeSingle()
  failOnDb(companyResult.error)
  await db.from('Users').update({ FailedLoginCount: 0, LockoutEnd: null, LastLoginAt: now() })
    .eq('Id', user.Id).eq('TenantId', tenantId)
  await recordLogin(tenantId, user, String(user.Username), true, request)

  // Always record the session so it can be revoked on block/delete/password-change.
  // Concurrent-session limiting only kicks in when enabled. Fail-safe: never blocks login on error.
  try {
    if (policy.maxConcurrentSessions > 0) {
      const active = await db.from('UserSessions').select('Id')
        .eq('TenantId', tenantId).eq('UserId', user.Id).eq('IsRevoked', false)
        .order('LastSeenAt', { ascending: true })
      const rows = active.data ?? []
      const overflow = rows.length - (policy.maxConcurrentSessions - 1)
      if (overflow > 0) {
        const revokeIds = rows.slice(0, overflow).map((r) => r.Id)
        await db.from('UserSessions').update({ IsRevoked: true }).in('Id', revokeIds)
      }
    }
    await db.from('UserSessions').insert({
      Id: uuid(), TenantId: tenantId, UserId: user.Id, Jti: jti,
      UserAgent: String(request.headers.get('user-agent') ?? '').slice(0, 300),
      Ip: requestIp(request),
      CreatedAt: now(), LastSeenAt: now(), IsRevoked: false,
    })
    // Bound table growth: drop this user's sessions whose tokens have certainly expired (>2 days).
    await db.from('UserSessions').delete().eq('TenantId', tenantId).eq('UserId', user.Id)
      .lt('CreatedAt', new Date(Date.now() - 2 * 86_400_000).toISOString())
  } catch (e) {
    console.error('session tracking failed', e)
  }

  // Password expiry: flag (does not block) when enabled and password is older than the limit.
  let mustChangePassword = false
  if (policy.passwordExpiryDays > 0) {
    const changedAt = user.PasswordChangedAt ?? user.CreatedAt
    if (changedAt) {
      const ageDays = (Date.now() - new Date(changedAt).getTime()) / 86_400_000
      mustChangePassword = ageDays >= policy.passwordExpiryDays
    }
  }

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
    mustChangePassword,
    expiresIn: 43200,
  })
}

async function publicCompany(request: Request, url: URL): Promise<Response> {
  const tenantId = String(url.searchParams.get('tenantId') ?? tenantDefault)
  const result = await db.from('Tenants').select('Id,Name,LogoUrl,Website').eq('Id', tenantId).eq('IsActive', true).maybeSingle()
  failOnDb(result.error)
  if (!result.data) throw new HttpError(404, 'اطلاعات شرکت یافت نشد')
  const policy = await loadSecurity(tenantId)
  return json(request, { ...asCamel(result.data) as JsonObject, captchaAfterAttempts: policy.captchaAfterAttempts })
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
  const policy = await loadSecurity(auth.tenantId)
  const problem = passwordProblem(String(input.newPassword ?? ''), policy)
  if (problem) throw new HttpError(400, problem)
  const { data: user, error } = await db.from('Users').select('PasswordHash')
    .eq('Id', auth.userId).eq('TenantId', auth.tenantId).single()
  failOnDb(error)
  if (!await bcrypt.compare(String(input.currentPassword ?? ''), user.PasswordHash)) {
    throw new HttpError(400, 'رمز عبور فعلی اشتباه است')
  }
  const PasswordHash = await bcrypt.hash(String(input.newPassword), 12)
  const result = await db.from('Users').update({ PasswordHash, PasswordChangedAt: now(), UpdatedAt: now() })
    .eq('Id', auth.userId).eq('TenantId', auth.tenantId)
  failOnDb(result.error)
  await revokeUserSessions(auth.tenantId, auth.userId, auth.jti)
  return json(request, { message: 'رمز عبور با موفقیت تغییر کرد؛ سایر دستگاه‌ها از حساب خارج شدند' })
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
    await createNotification(db,auth,{userId:assignee,title:'وظیفه جدید برای شما ثبت شد',body:row.Title,type:notificationType.task,actionUrl:'/tasks',entityId:String(result.data.Id),entityType:'Task'})
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
    const target=result.data.AssignedByUserId===auth.userId?result.data.AssignedToUserId:result.data.AssignedByUserId
    await createNotification(db,auth,{userId:target,title:'وضعیت وظیفه تغییر کرد',body:String(result.data.Title??''),type:notificationType.task,actionUrl:'/tasks',entityId:String(result.data.Id),entityType:'Task'})
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
  const notificationTypes=['Letter','Task','Ticket','Form','System','Sms','Chat','Calendar','Project']
  const read = path.match(/^\/notifications\/([0-9a-f-]+)\/read$/i)
  const one = path.match(/^\/notifications\/([0-9a-f-]+)$/i)
  if (request.method === 'GET') {
    const result = await db.from('Notifications').select('*').eq('TenantId', auth.tenantId)
      .eq('UserId', auth.userId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(100)
    failOnDb(result.error); return json(request,(result.data??[]).map(item=>({...asCamel(item) as Record<string,unknown>,type:typeof item.Type==='number'?notificationTypes[item.Type]??'System':item.Type})))
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
    birthDate: user.BirthDate ?? null,
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
    const policy = await loadSecurity(auth.tenantId)
    const problem = passwordProblem(String(input.newPassword ?? ''), policy)
    if (problem) throw new HttpError(400, problem)
    const result = await db.from('Users').update({ PasswordHash: await bcrypt.hash(String(input.newPassword), 12), PasswordChangedAt: now(), UpdatedAt: now() })
      .eq('TenantId', auth.tenantId).eq('Id', resetMatch[1])
    failOnDb(result.error); await revokeUserSessions(auth.tenantId, resetMatch[1]); return json(request, { message: 'رمز عبور تغییر کرد و کاربر از همه دستگاه‌ها خارج شد' })
  }
  const toggleMatch = path.match(/^\/users\/([0-9a-f-]+)\/toggle-active$/i)
  if (toggleMatch && request.method === 'PATCH') {
    requirePermission(auth, 'users.edit')
    const current = await db.from('Users').select('IsActive').eq('TenantId', auth.tenantId).eq('Id', toggleMatch[1]).single()
    failOnDb(current.error)
    const result = await db.from('Users').update({ IsActive: !current.data.IsActive, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', toggleMatch[1]).select().single()
    failOnDb(result.error)
    if (!result.data.IsActive) await revokeUserSessions(auth.tenantId, toggleMatch[1])
    return json(request, asCamel(result.data))
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
  const userFields = ['Username', 'Email', 'FirstName', 'LastName', 'PhoneNumber', 'BirthDate', 'Department', 'Position', 'DirectManager', 'HrManager', 'SignatureDataUrl', 'SignatureText'] as const
  if (request.method === 'POST' && !userMatch) {
    requirePermission(auth, 'users.create')
    const input = await body<JsonObject>(request)
    const policy = await loadSecurity(auth.tenantId)
    if (!String(input.username ?? '').trim()) throw new HttpError(400, 'نام کاربری الزامی است')
    const pwProblem = passwordProblem(String(input.password ?? ''), policy)
    if (pwProblem) throw new HttpError(400, pwProblem)
    const row = { ...baseInsert(auth), ...pascalize(input, userFields), PasswordHash: await bcrypt.hash(String(input.password ?? ''), 12), PasswordChangedAt: now(), IsActive: true, FailedLoginCount: 0, IsTwoFactorEnabled: false }
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
    failOnDb(result.error); await revokeUserSessions(auth.tenantId, userMatch[1]); return new Response(null, { status: 204, headers: corsHeaders(request) })
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
  const tehranNow=new Date(Date.now()+3.5*60*60*1000),tehranStart=new Date(Date.UTC(tehranNow.getUTCFullYear(),tehranNow.getUTCMonth(),tehranNow.getUTCDate())-3.5*60*60*1000),tehranEnd=new Date(tehranStart.getTime()+86400000)
  const [unreadLetters,totalLetters,activeTasks,openTickets,usersCount,contactsCount,todayEvents,recentLettersResult,recentNotifications] = await Promise.all([
    count('LetterRecipients', (q) => q.eq('UserId', auth.userId).eq('IsRead', false)),
    count('Letters'),
    count('Tasks', (q) => q.or(`AssignedToUserId.eq.${auth.userId},AssignedByUserId.eq.${auth.userId}`).not('Status', 'in', '(3,4)')),
    count('Tickets', (q) => q.not('Status', 'in', '(closed,resolved)')),
    count('Users', (q) => q.eq('IsActive', true)), count('Contacts'),
    count('CalendarEvents',(q)=>q.gte('StartAt',tehranStart.toISOString()).lt('StartAt',tehranEnd.toISOString())),
    db.from('Letters').select('Id,Subject,FromUserName,Status,CreatedAt').eq('TenantId',auth.tenantId).eq('IsDeleted',false).order('CreatedAt',{ascending:false}).limit(5),
    db.from('Notifications').select('Id,Title,Body,Type,ActionUrl,CreatedAt,IsRead,ActorUserId,ActorName,RelatedEntityType').eq('TenantId',auth.tenantId).eq('UserId',auth.userId).eq('IsDeleted',false).order('CreatedAt',{ascending:false}).limit(20),
  ])
  failOnDb(recentLettersResult.error);failOnDb(recentNotifications.error)
  const recentTasksResult = await db.from('Tasks').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    .or(`AssignedToUserId.eq.${auth.userId},AssignedByUserId.eq.${auth.userId}`).order('CreatedAt', { ascending: false }).limit(5)
  failOnDb(recentTasksResult.error)
  return json(request, {
    unreadLetters,newLetters:unreadLetters,totalLetters,activeTasks,openTickets,todayEvents,
    users: usersCount, contacts: contactsCount, recentLetters:(recentLettersResult.data??[]).map(item=>({id:item.Id,subject:item.Subject,fromUserName:item.FromUserName,status:typeof item.Status==='number'?['Draft','Sent','Received','InReview','Signed','Referred','Archived','Cancelled'][item.Status]:item.Status,createdAt:item.CreatedAt})),
    notifications:(recentNotifications.data??[]).map(item=>({id:item.Id,title:item.Title,body:item.Body,type:typeof item.Type==='number'?['Letter','Task','Ticket','Form','System','Sms','Chat','Calendar','Project'][item.Type]:item.Type,actionUrl:item.ActionUrl,createdAt:item.CreatedAt,isRead:item.IsRead,actorUserId:item.ActorUserId,actorName:item.ActorName,relatedEntityType:item.RelatedEntityType})),
    recentTasks: (recentTasksResult.data ?? []).map(taskDto),
  })
}

async function securitySettings(request: Request, auth: AuthContext): Promise<Response> {
  requireAdmin(auth)
  if (request.method === 'GET') return json(request, await loadSecurity(auth.tenantId))
  if (request.method === 'PUT') {
    const input = await body<JsonObject>(request)
    const clamp = (v: unknown, min: number, max: number, def: number) => {
      const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : def
    }
    const values = {
      PasswordMinLength: clamp(input.passwordMinLength, 6, 64, 8),
      RequireComplexity: Boolean(input.requireComplexity),
      MaxFailedAttempts: clamp(input.maxFailedAttempts, 3, 20, 5),
      LockoutMinutes: clamp(input.lockoutMinutes, 1, 1440, 30),
      CaptchaAfterAttempts: clamp(input.captchaAfterAttempts, 1, 20, 3),
      PasswordExpiryDays: clamp(input.passwordExpiryDays, 0, 3650, 0),
      MaxConcurrentSessions: clamp(input.maxConcurrentSessions, 0, 100, 0),
      TwoFactorRequired: Boolean(input.twoFactorRequired),
      UpdatedAt: now(),
    }
    const existing = await db.from('SecuritySettings').select('Id').eq('TenantId', auth.tenantId).eq('IsDeleted', false).maybeSingle()
    failOnDb(existing.error)
    const result = existing.data
      ? await db.from('SecuritySettings').update(values).eq('Id', existing.data.Id)
      : await db.from('SecuritySettings').insert({ Id: uuid(), TenantId: auth.tenantId, IsDeleted: false, CreatedAt: now(), ...values })
    failOnDb(result.error)
    return json(request, { message: 'تنظیمات امنیتی ذخیره شد' })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function loginAudit(request: Request, auth: AuthContext, url: URL): Promise<Response> {
  requireAdmin(auth)
  if (request.method !== 'GET') throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
  const userId = url.searchParams.get('userId')
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  let query = db.from('LoginAudit').select('Id,UserId,Username,FullName,Success,Ip,UserAgent,CreatedAt')
    .eq('TenantId', auth.tenantId).gte('CreatedAt', since).order('CreatedAt', { ascending: false }).limit(500)
  if (userId) query = query.eq('UserId', userId)
  const result = await query
  failOnDb(result.error)
  return json(request, asCamel(result.data))
}

async function mfaVerify(request: Request): Promise<Response> {
  const input = await body<{ mfaToken?: string; code?: string }>(request)
  let claim: { userId: string; tenantId: string }
  try { claim = await verifyMfaToken(String(input.mfaToken ?? '')) }
  catch { throw new HttpError(401, 'مهلت تأیید دو مرحله‌ای به پایان رسید؛ دوباره وارد شوید') }
  if (await rateLimited(`mfa:${claim.userId}`, 8, 300)) throw new HttpError(429, 'تعداد تلاش زیاد است؛ کمی بعد دوباره تلاش کنید')
  const policy = await loadSecurity(claim.tenantId)
  const { data: user, error } = await db.from('Users').select('*')
    .eq('TenantId', claim.tenantId).eq('Id', claim.userId).eq('IsDeleted', false).maybeSingle()
  failOnDb(error)
  if (!user || !user.IsActive || !user.IsTwoFactorEnabled || !user.TwoFactorSecret) throw new HttpError(401, 'درخواست نامعتبر است')
  const secretValue = await decryptSecret(String(user.TwoFactorSecret))
  if (!await verifyTotp(secretValue, String(input.code ?? ''))) {
    await recordLogin(claim.tenantId, user, String(user.Username), false, request)
    throw new HttpError(401, 'کد تأیید اشتباه است')
  }
  return await issueSession(request, user as JsonObject, claim.tenantId, policy)
}

async function mfaManage(request: Request, auth: AuthContext, path: string): Promise<Response> {
  if (path === '/auth/mfa/status' && request.method === 'GET') {
    const { data } = await db.from('Users').select('IsTwoFactorEnabled').eq('TenantId', auth.tenantId).eq('Id', auth.userId).maybeSingle()
    return json(request, { enabled: !!data?.IsTwoFactorEnabled })
  }
  if (path === '/auth/mfa/setup' && request.method === 'POST') {
    const secretB32 = generateBase32Secret()
    const result = await db.from('Users').update({ TwoFactorSecret: await encryptSecret(secretB32), IsTwoFactorEnabled: false, UpdatedAt: now() })
      .eq('TenantId', auth.tenantId).eq('Id', auth.userId)
    failOnDb(result.error)
    return json(request, { secret: secretB32, otpauth: otpauthUri('Portal Parspmi', auth.username, secretB32) })
  }
  if (path === '/auth/mfa/enable' && request.method === 'POST') {
    const input = await body<{ code?: string }>(request)
    const { data: user, error } = await db.from('Users').select('TwoFactorSecret').eq('TenantId', auth.tenantId).eq('Id', auth.userId).single()
    failOnDb(error)
    if (!user?.TwoFactorSecret) throw new HttpError(400, 'ابتدا راه‌اندازی را آغاز کنید')
    const secretValue = await decryptSecret(String(user.TwoFactorSecret))
    if (!await verifyTotp(secretValue, String(input.code ?? ''))) throw new HttpError(400, 'کد وارد شده صحیح نیست')
    const result = await db.from('Users').update({ IsTwoFactorEnabled: true, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', auth.userId)
    failOnDb(result.error)
    return json(request, { message: 'احراز هویت دو مرحله‌ای فعال شد' })
  }
  if (path === '/auth/mfa/disable' && request.method === 'POST') {
    const input = await body<{ password?: string }>(request)
    const { data: user, error } = await db.from('Users').select('PasswordHash').eq('TenantId', auth.tenantId).eq('Id', auth.userId).single()
    failOnDb(error)
    if (!await bcrypt.compare(String(input.password ?? ''), user.PasswordHash)) throw new HttpError(400, 'رمز عبور اشتباه است')
    const result = await db.from('Users').update({ IsTwoFactorEnabled: false, TwoFactorSecret: null, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', auth.userId)
    failOnDb(result.error)
    return json(request, { message: 'احراز هویت دو مرحله‌ای غیرفعال شد' })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function dispatch(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  const url = new URL(request.url)
  const path = routePath(url)
  if (path === '/health' && request.method === 'GET') return json(request, { status: 'ok', runtime: 'supabase-edge' })
  if (path === '/auth/login' && request.method === 'POST') return await login(request)
  if (path === '/auth/mfa-verify' && request.method === 'POST') return await mfaVerify(request)
  if (path === '/company/public' && request.method === 'GET') return await publicCompany(request, url)
  const publicCustomerResponse = await handlePublicCustomer(request, path)
  if (publicCustomerResponse) return publicCustomerResponse

  const auth = await authenticate(request)
  // General per-user rate limit (generous; guards against scraping/abuse). Fail-open on error.
  if (await rateLimited(`u:${auth.userId}`, 600, 60)) throw new HttpError(429, 'تعداد درخواست‌های شما بیش از حد مجاز است؛ لطفاً چند لحظه صبر کنید')
  if (path === '/auth/logout' && request.method === 'POST') return json(request, { message: 'خروج موفق' })
  if (path.startsWith('/auth/mfa/')) return await mfaManage(request, auth, path)
  if (path === '/auth/change-password' && request.method === 'POST') return await changePassword(request, auth)
  if (path === '/security-settings') return await securitySettings(request, auth)
  if (path === '/login-audit') return await loginAudit(request, auth, url)
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
