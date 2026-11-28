import { adminClient, requirePermission, type AuthContext } from '../_shared/auth.ts'
import { body, HttpError, json } from '../_shared/http.ts'

const db=adminClient()
type DbError={message:string;code?:string}
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const allowed=(auth:AuthContext,...permissions:string[])=>auth.isAdmin||permissions.some(p=>auth.permissions.includes(p))
const errors:Record<string,[number,string]>={
  org_manager_invalid:[400,'مدیر یا مسئول باید کاربر مجاز و فعال همین سازمان باشد.'],
  org_cycle:[409,'این تغییر رابطهٔ دوری ایجاد می‌کند.'],
  org_parent:[400,'واحد یا سمت بالادست معتبر نیست.'],
  org_dependencies:[409,'ابتدا افراد یا گره‌های وابسته را منتقل کنید.'],
  org_inactive:[409,'سمت یا واحد غیرفعال برای انتساب جدید قابل انتخاب نیست.'],
  org_duplicate:[409,'این نام قبلاً ثبت شده است.'],
  org_name:[400,'نام سازمانی معتبر نیست.'],
  org_missing:[404,'آیتم سازمانی یافت نشد.'],
  org_system_position:[403,'ویرایش سمت سیستمی مجاز نیست.'],
}
export function organizationError(error:DbError|null){
  if(!error)return
  const mapped=errors[error.message]??(error.code==='23505'?errors.org_duplicate:undefined)
  if(mapped)throw new HttpError(...mapped)
  console.error(error.message)
  throw new HttpError(500,'دریافت یا ذخیره اطلاعات سازمانی انجام نشد.')
}
async function departments(auth:AuthContext){
  const result=await db.from('organization_departments').select('id,name,active,parent_id,lead_id').eq('tenant_id',auth.tenantId).order('name')
  organizationError(result.error);return result.data??[]
}
export async function organizationPeople(auth:AuthContext){
  const people:{id:string;full_name:string;department:string|null;position:string|null;active:boolean;manager_id:string|null;unresolved:boolean}[]=[]
  for(let offset=0;;offset+=500){
    const result=await db.rpc('organization_people',{p_tenant:auth.tenantId}).order('id').range(offset,offset+499)
    organizationError(result.error)
    const rows=result.data??[]
    people.push(...rows)
    if(rows.length<500)return people
  }
}
export async function handleOrganization(request:Request,auth:AuthContext,path:string):Promise<Response|null>{
  if(!path.startsWith('/organization/'))return null
  if(!allowed(auth,'positions.view','users.view'))throw new HttpError(403,'مجوز دیدن چارت سازمانی لازم است.')
  if(path==='/organization/chart'&&request.method==='GET'){
    const [people,units,positions,avatars]=await Promise.all([
      organizationPeople(auth),departments(auth),
      db.from('OrgPositions').select('Id,Title,IsActive,IsSystem').eq('TenantId',auth.tenantId).eq('IsDeleted',false).order('Title'),
      db.from('Users').select('Id,AvatarUrl,Username').eq('TenantId',auth.tenantId).eq('IsDeleted',false),
    ])
    organizationError(positions.error);organizationError(avatars.error)
    const profiles=new Map((avatars.data??[]).map(u=>[u.Id,u]))
    return json(request,{people:people.map(p=>({id:p.id,name:p.full_name,department:p.department,position:p.position,
      active:p.active,managerId:p.manager_id,unresolved:p.unresolved,avatar:profiles.get(p.id)?.AvatarUrl,
      canToggle:p.id!==auth.userId&&profiles.has(p.id)&&profiles.get(p.id)?.Username?.toLowerCase()!=='admin'})),
      departments:units,positions:(positions.data??[]).map(p=>({id:p.Id,title:p.Title,isActive:p.IsActive,isSystem:p.IsSystem})),
      access:{employee:auth.isAdmin||allowed(auth,'users.view')&&allowed(auth,'users.edit'),
        create:allowed(auth,'positions.view')&&allowed(auth,'positions.create'),
        edit:allowed(auth,'positions.view')&&allowed(auth,'positions.edit')}})
  }
  if(path==='/organization/departments'&&request.method==='GET')return json(request,await departments(auth))
  const department=path.match(/^\/organization\/departments(?:\/([^/]+))?$/)
  if(department&&(department[1]?request.method==='PUT':request.method==='POST')){
    requirePermission(auth,'positions.view')
    requirePermission(auth,department[1]?'positions.edit':'positions.create')
    if(department[1]&&!uuid(department[1]))throw new HttpError(404,'واحد سازمانی یافت نشد.')
    const input=await body<Record<string,unknown>>(request)
    const name=typeof input.name==='string'?input.name.trim():''
    if(!name||name.length>160||typeof input.active!=='boolean')throw new HttpError(400,'نام و وضعیت واحد را بررسی کنید.')
    for(const value of [input.parent_id,input.lead_id])if(value!=null&&!uuid(value))throw new HttpError(400,'شناسهٔ واحد یا مسئول معتبر نیست.')
    const result=await db.rpc('organization_save_department',{p_tenant:auth.tenantId,p_actor:auth.userId,p_id:department[1]??null,
      p_name:name,p_parent:input.parent_id??null,p_lead:input.lead_id??null,p_active:input.active})
    organizationError(result.error);return json(request,result.data,department[1]?200:201)
  }
  const history=path.match(/^\/organization\/history\/([^/]+)$/)
  if(history&&uuid(history[1])&&request.method==='GET'){
    let query=db.from('organization_change_history').select('id,entity_kind,actor_id,before_data,after_data,changed_at')
      .eq('tenant_id',auth.tenantId).eq('entity_id',history[1])
    const kinds=[...(auth.isAdmin||allowed(auth,'users.view')&&allowed(auth,'users.edit')?['employee']:[]),
      ...(allowed(auth,'positions.view')&&allowed(auth,'positions.edit')?['department','position']:[])]
    if(!kinds.length)throw new HttpError(403,'مجوز مشاهدهٔ تاریخچه سازمانی لازم است.')
    query=query.in('entity_kind',kinds)
    const result=await query.order('changed_at',{ascending:false}).limit(100)
    organizationError(result.error);return json(request,result.data??[])
  }
  throw new HttpError(405,'عملیات پشتیبانی نمی‌شود.')
}
