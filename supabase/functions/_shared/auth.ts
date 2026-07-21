import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { jwtVerify, SignJWT } from 'jose'
import { HttpError } from './http.ts'

export interface AuthContext {
  userId: string
  tenantId: string
  username: string
  permissions: string[]
  isAdmin: boolean
}

const jwtSecret = Deno.env.get('EDGE_JWT_SECRET')
const secret = jwtSecret ? new TextEncoder().encode(jwtSecret) : null

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Supabase server environment is not configured')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function issueToken(context: AuthContext, jti: string = crypto.randomUUID()): Promise<string> {
  if (!secret) throw new Error('EDGE_JWT_SECRET is not configured')
  return await new SignJWT({
    user_id: context.userId,
    tenant_id: context.tenantId,
    username: context.username,
    permission: context.permissions,
    role: context.isAdmin ? 'Admin' : 'User',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('org-system-edge')
    .setAudience('org-system-web')
    .setIssuedAt()
    .setExpirationTime('12h')
    .setJti(jti)
    .sign(secret)
}

let sharedClient: SupabaseClient | null = null
function sessionClient(): SupabaseClient {
  if (!sharedClient) sharedClient = adminClient()
  return sharedClient
}

export async function authenticate(request: Request): Promise<AuthContext> {
  if (!secret) throw new Error('EDGE_JWT_SECRET is not configured')
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError(401, 'ورود به سامانه الزامی است')

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'org-system-edge',
      audience: 'org-system-web',
    })
    const userId = String(payload.user_id ?? '')
    const tenantId = String(payload.tenant_id ?? '')
    const username = String(payload.username ?? '')
    if (!userId || !tenantId || !username) throw new Error('Missing claims')
    const permissions = Array.isArray(payload.permission)
      ? payload.permission.map(String)
      : payload.permission ? [String(payload.permission)] : []

    // Session-limit enforcement: reject only sessions explicitly revoked (fail-open on any error).
    let sessionRevoked = false
    try {
      const jti = String(payload.jti ?? '')
      if (jti) {
        const { data } = await sessionClient().from('UserSessions')
          .select('IsRevoked').eq('Jti', jti).eq('IsRevoked', true).maybeSingle()
        sessionRevoked = !!data
      }
    } catch {
      sessionRevoked = false
    }
    if (sessionRevoked) throw new HttpError(401, 'این نشست به‌دلیل محدودیت تعداد دستگاه‌ها خاتمه یافته است')

    return {
      userId,
      tenantId,
      username,
      permissions,
      isAdmin: payload.role === 'Admin' || username.toLowerCase() === 'admin',
    }
  } catch {
    throw new HttpError(401, 'نشست شما نامعتبر یا منقضی شده است')
  }
}

export function requirePermission(auth: AuthContext, permission: string): void {
  if (!auth.isAdmin && !auth.permissions.includes(permission)) {
    throw new HttpError(403, 'شما مجوز انجام این عملیات را ندارید')
  }
}

