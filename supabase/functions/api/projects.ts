import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json, uuid } from '../_shared/http.ts'

type Obj = Record<string, any>
const db = adminClient()
const now = () => new Date().toISOString()
function check(error: { message: string } | null, fallback = 'خطا در دسترسی به پایگاه داده'): void {
  if (error) { console.error(error.message); throw new HttpError(500, fallback) }
}
function isAdminScope(auth: AuthContext): boolean {
  return auth.isAdmin || auth.permissions.includes('performance.admin')
}

const projectStatus = ['Active', 'Archived']
function projectDto(item: Obj): Obj {
  const result = camelize(item) as Obj
  result.status = typeof item.Status === 'number' ? projectStatus[item.Status] : item.Status
  return result
}

async function listProjects(request: Request, auth: AuthContext): Promise<Response> {
  requirePermission(auth, 'performance.view')
  const result = await db.from('Projects').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('Status', 0).order('Name')
  check(result.error)
  return json(request, (result.data ?? []).map(projectDto))
}

async function createProject(request: Request, auth: AuthContext): Promise<Response> {
  if (!isAdminScope(auth)) throw new HttpError(403, 'فقط مدیر منابع انسانی می‌تواند پروژه ثبت کند')
  const input = await body<Obj>(request)
  const name = String(input.name ?? '').trim()
  if (!name) throw new HttpError(400, 'نام پروژه الزامی است')
  const row = {
    Id: uuid(), TenantId: auth.tenantId, Name: name.slice(0, 200),
    Code: input.code ? String(input.code).trim().slice(0, 40) : null,
    ManagerUserId: input.managerUserId || null, Status: 0,
    CreatedAt: now(), UpdatedAt: null, CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null,
  }
  const result = await db.from('Projects').insert(row).select().single()
  check(result.error, 'ثبت پروژه انجام نشد')
  return json(request, projectDto(result.data), 201)
}

async function updateProject(request: Request, auth: AuthContext, id: string): Promise<Response> {
  if (!isAdminScope(auth)) throw new HttpError(403, 'فقط مدیر منابع انسانی می‌تواند پروژه را ویرایش کند')
  const input = await body<Obj>(request)
  const update: Obj = { UpdatedAt: now() }
  if (input.name !== undefined) update.Name = String(input.name).trim().slice(0, 200)
  if (input.code !== undefined) update.Code = input.code ? String(input.code).trim().slice(0, 40) : null
  if (input.managerUserId !== undefined) update.ManagerUserId = input.managerUserId || null
  if (input.status !== undefined) update.Status = String(input.status).toLowerCase() === 'archived' ? 1 : 0
  const result = await db.from('Projects').update(update).eq('TenantId', auth.tenantId).eq('Id', id).eq('IsDeleted', false).select().maybeSingle()
  check(result.error)
  if (!result.data) throw new HttpError(404, 'پروژه یافت نشد')
  return json(request, projectDto(result.data))
}

export async function handleProjects(request: Request, auth: AuthContext, path: string): Promise<Response | null> {
  if (!path.startsWith('/projects')) return null
  if (path === '/projects' && request.method === 'GET') return await listProjects(request, auth)
  if (path === '/projects' && request.method === 'POST') return await createProject(request, auth)
  const idMatch = path.match(/^\/projects\/([0-9a-f-]+)$/i)
  if (idMatch && request.method === 'PATCH') return await updateProject(request, auth, idMatch[1])
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

export async function projectExists(tenantId: string, projectId: string): Promise<boolean> {
  const result = await db.from('Projects').select('Id').eq('TenantId', tenantId).eq('Id', projectId).eq('IsDeleted', false).maybeSingle()
  check(result.error)
  return !!result.data
}
