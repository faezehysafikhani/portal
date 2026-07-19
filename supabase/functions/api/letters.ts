import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { jalaliDateString } from '../_shared/jalali.ts'

type Obj = Record<string, any>
const db = adminClient()
const now = () => new Date().toISOString()
const base = (auth: AuthContext): Obj => ({ Id: crypto.randomUUID(), TenantId: auth.tenantId, CreatedAt: now(), UpdatedAt: null, CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null })
const types = ['Internal', 'Incoming', 'Outgoing']; const statuses = ['Draft', 'Sent', 'Received', 'InReview', 'Signed', 'Referred', 'Archived', 'Cancelled']; const priorities = ['Low', 'Normal', 'High', 'Urgent']; const recipientTypes = ['To', 'CC', 'Referral']; const actions = ['Created', 'Sent', 'Received', 'Signed', 'Referred', 'Archived', 'Cancelled', 'Edited', 'SignatureRevoked']
function check(error: { message: string } | null): void { if (error) { console.error(error.message); throw new HttpError(500, 'خطا در پایگاه داده') } }
function enumIn(value: unknown, names: string[]): number { if (typeof value === 'number') return value; const i = names.findIndex((x) => x.toLowerCase() === String(value).toLowerCase()); return i < 0 ? 0 : i }
function enumOut(value: unknown, names: string[]): unknown { return typeof value === 'number' ? names[value] : value }
async function fullName(auth: AuthContext): Promise<string> { const u = await db.from('Users').select('FirstName,LastName').eq('TenantId', auth.tenantId).eq('Id', auth.userId).single(); check(u.error); return `${u.data.FirstName ?? ''} ${u.data.LastName ?? ''}`.trim() }
const clientIp=(request:Request):string=>(request.headers.get('x-forwarded-for')?.split(',')[0].trim()||request.headers.get('cf-connecting-ip')||'unknown')
async function notify(auth:AuthContext,userId:string,title:string,content:string,actionUrl:string,entityId:string,entityType='Letter'):Promise<void>{if(!userId||userId===auth.userId)return;const actor=await fullName(auth);const result=await db.from('Notifications').insert({...base(auth),UserId:userId,Title:title,Body:content,Type:0,IsRead:false,ReadAt:null,ActionUrl:actionUrl,RelatedEntityId:entityId,RelatedEntityType:entityType,ActorUserId:auth.userId,ActorName:actor});check(result.error)}
async function notifyLetterRecipients(auth:AuthContext,letter:Obj,recipients:Obj[],title?:string,actionUrl='/letters'):Promise<void>{const actor=await fullName(auth);const users=[...new Set(recipients.map(r=>r.userId).filter(Boolean))] as string[];await Promise.all(users.map(id=>notify(auth,id,title??`نامه جدید از ${actor}`,`${letter.LetterNumber ?? ''} — ${letter.Subject}`,actionUrl,letter.Id)))}

async function details(auth: AuthContext, letter: Obj): Promise<Obj> {
  const signerId=letter.SignedByUserId??(Number(letter.Status)===4?letter.FromUserId:null)
  const [recipients, attachments, workflow, template, sender, signer] = await Promise.all([
    db.from('LetterRecipients').select('*').eq('TenantId', auth.tenantId).eq('LetterId', letter.Id).eq('IsDeleted', false).order('CreatedAt'),
    db.from('LetterAttachments').select('Id,FileName,FileSize,ContentType,StoragePath').eq('TenantId', auth.tenantId).eq('LetterId', letter.Id).eq('IsDeleted', false),
    db.from('LetterWorkflowSteps').select('*').eq('TenantId', auth.tenantId).eq('LetterId', letter.Id).eq('IsDeleted', false).order('StepOrder'),
    letter.LetterTemplateId ? db.from('LetterTemplates').select('*').eq('TenantId', auth.tenantId).eq('Id', letter.LetterTemplateId).eq('IsDeleted', false).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from('Users').select('Position,SignatureDataUrl').eq('TenantId', auth.tenantId).eq('Id', letter.FromUserId).maybeSingle(),
    signerId?db.from('Users').select('SignatureDataUrl').eq('TenantId',auth.tenantId).eq('Id',signerId).maybeSingle():Promise.resolve({data:null,error:null}),
  ]); [recipients, attachments, workflow, template, sender, signer].forEach((x) => check(x.error))
  const rs = (recipients.data ?? []).map((r) => ({ ...(camelize(r) as Obj), recipientType: enumOut(r.RecipientType, recipientTypes) }))
  const content=auth.isAdmin||auth.permissions.includes('letters.content.view');const files=auth.isAdmin||auth.permissions.includes('letters.attachments.view');const history=auth.isAdmin||auth.permissions.includes('letters.workflow.view')
  return {
    ...(camelize(letter) as Obj),body:content?letter.Body:null,type: enumOut(letter.Type, types), status: enumOut(letter.Status, statuses), priority: enumOut(letter.Priority, priorities),
    trackingCode: letter.LetterCounter,
    senderPosition: sender.data?.Position, senderSignatureDataUrl: content?signer.data?.SignatureDataUrl:null,
    canEdit:auth.isAdmin||auth.permissions.includes('letters.edit'),canRevokeSignature:(auth.isAdmin||auth.permissions.includes('letters.sign.revoke'))&&letter.SignedByUserId===auth.userId,canCancel:auth.isAdmin||auth.permissions.includes('letters.cancel'),
    recipients: rs, referrals: content?rs.filter((r) => r.recipientType === 'Referral'):[], template:content?camelize(template.data):null,
    attachments: files?camelize(attachments.data):[], workflowSteps: history?(workflow.data ?? []).map((w) => ({ ...(camelize(w) as Obj), action: enumOut(w.Action, actions) })):[],
  }
}

async function addWorkflow(request:Request, auth: AuthContext, letterId: string, action: number, comment: string): Promise<void> {
  const count = await db.from('LetterWorkflowSteps').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('LetterId', letterId); check(count.error)
  const computerName=request.headers.get('x-computer-name')?.trim().slice(0,100)||'ثبت نشده'
  const result = await db.from('LetterWorkflowSteps').insert({ ...base(auth), LetterId: letterId, UserId: auth.userId, UserName: await fullName(auth), Action: action, Comment: comment, IpAddress:clientIp(request), DeviceId:computerName, StepOrder: (count.count ?? 0) + 1 }); check(result.error)
}

export async function handleLetters(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  if (!path.startsWith('/letters')) return null
  const refer = path.match(/^\/letters\/([0-9a-f-]+)\/refer$/i); const archive = path.match(/^\/letters\/([0-9a-f-]+)\/archive$/i); const sign = path.match(/^\/letters\/([0-9a-f-]+)\/sign$/i); const revokeSign = path.match(/^\/letters\/([0-9a-f-]+)\/revoke-signature$/i); const cancel = path.match(/^\/letters\/([0-9a-f-]+)\/cancel$/i); const match = path.match(/^\/letters\/([0-9a-f-]+)$/i)
  const canRegistry = auth.isAdmin || auth.permissions.includes('letters.registry.view'); const canInbox = auth.isAdmin || auth.permissions.includes('letters.inbox.view')
  if (request.method === 'GET' && path === '/letters') {
    const scope=url.searchParams.get('scope')||'mailbox';const registry=scope==='registry';const referrals=scope==='referrals';if(registry?!canRegistry:!canInbox)throw new HttpError(403,'دسترسی غیرمجاز')
    let query = db.from('Letters').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    const type = url.searchParams.get('type'); const status = url.searchParams.get('status'); if (type) query = query.eq('Type', enumIn(type, types)); if (status) query = query.eq('Status', enumIn(status, statuses))
    const [result,rec]=await Promise.all([query.order('CreatedAt',{ascending:false}).limit(500),db.from('LetterRecipients').select('*').eq('TenantId',auth.tenantId).eq('IsDeleted',false).limit(3000)]);check(result.error);check(rec.error);const output:Obj[]=[]
    const byLetter=new Map<string,Obj[]>();for(const row of rec.data??[]){const rows=byLetter.get(row.LetterId)??[];rows.push(row);byLetter.set(row.LetterId,rows)}
    for(const letter of result.data??[]){
      const rows=byLetter.get(letter.Id)??[]
      const primaryRows=rows.filter(x=>Number(x.RecipientType)!==2)
      const referralRows=rows.filter(x=>Number(x.RecipientType)===2)
      const myPrimary=primaryRows.filter(x=>x.UserId===auth.userId)
      const myReferrals=referralRows.filter(x=>x.UserId===auth.userId||x.ReferredByUserId===auth.userId)
      const myIncomingReferrals=myReferrals.filter(x=>x.UserId===auth.userId)
      const myInboxRows=[...myPrimary,...myIncomingReferrals]
      const baseLetter={id:letter.Id,trackingCode:letter.LetterCounter,subject:letter.Subject,letterNumber:letter.LetterNumber,letterDate:letter.LetterDate,type:enumOut(letter.Type,types),status:enumOut(letter.Status,statuses),priority:enumOut(letter.Priority,priorities),classification:letter.Classification,fromUserName:letter.FromUserName,fromUserId:letter.FromUserId,hasAttachment:letter.HasAttachment,toExternalName:letter.ToExternalName,toExternalOrg:letter.ToExternalOrg,incomingFromOrg:letter.IncomingFromOrg,createdAt:letter.CreatedAt,sentAt:letter.SentAt,recipientCount:primaryRows.length,isRead:myInboxRows.length===0||myInboxRows.every(x=>x.IsRead),isSender:letter.FromUserId===auth.userId,isInbox:myInboxRows.length>0,hasMyReferral:myReferrals.length>0,recipients:primaryRows.map(x=>({name:x.UserName||x.ExternalName||x.ExternalOrg||'—',recipientType:enumOut(x.RecipientType,recipientTypes)})),referrals:referralRows.map(x=>({id:x.Id,referralType:x.ReferralType,referralText:x.ReferralText,referredByName:x.ReferredByName||'—',referredToName:x.UserName||x.ExternalName||'—',isRead:x.IsRead,createdAt:x.CreatedAt}))}
      if(referrals){for(const referral of myReferrals)output.push({...baseLetter,isRead:Boolean(referral.IsRead),isReferral:true,referralId:referral.Id,referralType:referral.ReferralType,referralText:referral.ReferralText,referredByName:referral.ReferredByName||'—',referredToName:referral.UserName||referral.ExternalName||'—',referralDirection:referral.UserId===auth.userId?'incoming':'outgoing',referralCreatedAt:referral.CreatedAt});continue}
      const visible=registry||letter.FromUserId===auth.userId||(Number(letter.Status)!==0&&(myPrimary.length>0||myReferrals.length>0))
      if(visible)output.push(baseLetter)
    }
    return json(request, output)
  }
  if (request.method === 'GET' && match) {
    if (!canInbox && !canRegistry) throw new HttpError(403, 'دسترسی غیرمجاز'); const result = await db.from('Letters').select('*').eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('IsDeleted', false).maybeSingle(); check(result.error); if (!result.data) throw new HttpError(404, 'نامه یافت نشد')
    const recipient = await db.from('LetterRecipients').select('Id').eq('TenantId', auth.tenantId).eq('LetterId', match[1]).eq('UserId', auth.userId).eq('IsDeleted', false); check(recipient.error)
    if (!canRegistry && result.data.FromUserId !== auth.userId && !(recipient.data?.length)) throw new HttpError(403, 'دسترسی غیرمجاز'); if (recipient.data?.length) await Promise.all([db.from('LetterRecipients').update({ IsRead: true, ReadAt: now() }).eq('TenantId',auth.tenantId).eq('LetterId',match[1]).eq('UserId',auth.userId).eq('IsDeleted',false),db.from('Notifications').update({IsRead:true,ReadAt:now()}).eq('TenantId',auth.tenantId).eq('UserId',auth.userId).eq('Type',0).eq('RelatedEntityId',match[1]).eq('IsRead',false)])
    return json(request, await details(auth, result.data))
  }
  if (request.method === 'POST' && path === '/letters') {
    requirePermission(auth, 'letters.create'); const input = await body<Obj>(request); const type = enumIn(input.type, types); const status = enumIn(input.status, statuses)
    const requestId=String(input.clientRequestId??'').trim();if(requestId){const existing=await db.from('Letters').select('Id,LetterNumber,LetterCounter,Status').eq('TenantId',auth.tenantId).eq('FromUserId',auth.userId).eq('ClientRequestId',requestId).maybeSingle();check(existing.error);if(existing.data)return json(request,{message:'این نامه قبلاً ثبت شده است',id:existing.data.Id,letterNumber:existing.data.LetterNumber,trackingCode:existing.data.LetterCounter,status:enumOut(existing.data.Status,statuses),duplicate:true})}
    const recipients = Array.isArray(input.recipients) ? input.recipients : []
    if (status !== 0 && recipients.length === 0 && !input.toExternalName) throw new HttpError(400, 'برای ارسال نامه انتخاب گیرنده الزامی است')
    if (status === 1) requirePermission(auth, 'letters.send'); if (status === 4) requirePermission(auth, 'letters.sign')
    const prefix = type === 0 ? 'د' : type === 1 ? 'و' : 'ص'
    const tehranNow = new Date(Date.now() + 3.5 * 60 * 60 * 1000)
    const jalaliDate = jalaliDateString(tehranNow)
    const numberBase = `${prefix}/${jalaliDate}`
    const count = await db.from('Letters').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).like('LetterNumber', `${numberBase}/%`); check(count.error)
    const letterNumber = `${numberBase}/${String((count.count ?? 0) + 1).padStart(3, '0')}`
    const actorName=await fullName(auth);const letter = { ...base(auth), ClientRequestId:requestId||null, Subject: String(input.subject ?? '').trim(), Body: input.body ?? '', Type: type, Status: status, Priority: enumIn(input.priority ?? 'Normal', priorities), Classification: input.classification ?? 'normal', LetterNumber: letterNumber, LetterCounter: null, RegistryId: null, LetterDate: input.letterDate ?? now(), SentAt: status === 1 ? now() : null, SignedByUserId:status===4?auth.userId:null,SignedByName:status===4?actorName:null,SignedAt:status===4?now():null,ReferenceNumber: input.referenceNumber ?? null, ReferenceDate: input.referenceDate ?? null, ReferenceType: input.referenceType ?? null, FolderName: input.folderName ?? null, HasAttachment: false, LetterTemplateId: input.letterTemplateId ?? null, TemplateKey: input.templateKey ?? null, PaperSize: input.paperSize === 'A5' ? 'A5' : 'A4', TemplateHasHeader: input.templateHasHeader !== false, TemplateHasFooter: input.templateHasFooter !== false, FromUserId: auth.userId, FromUserName: actorName, ToExternalName: input.toExternalName ?? null, ToExternalOrg: input.toExternalOrg ?? null, IncomingNumber: input.incomingNumber ?? null, IncomingDate: input.incomingDate ?? null, IncomingFromOrg: input.incomingFromOrg ?? null }
    if (!letter.Subject) throw new HttpError(400, 'موضوع نامه الزامی است'); const created = await db.from('Letters').insert(letter).select().single(); check(created.error)
    if (recipients.length) { const rows = recipients.map((r: Obj) => ({ ...base(auth), LetterId: letter.Id, UserId: r.userId ?? null, ContactId: r.contactId ?? null, UserName: r.userName ?? null, ExternalName: r.externalName ?? null, ExternalOrg: r.externalOrg ?? null, RecipientType: enumIn(r.recipientType, recipientTypes), ReferralType: r.referralType ?? 'اصل', ReferralText: r.referralText ?? null, IsRead: false, ReadAt: null, PhoneNumber: r.phoneNumber ?? null, SmsRequested: Boolean(r.sendSms), SmsStatus: r.sendSms ? 'pending' : null, ReferredByUserId: null, ReferredByName: null, ReferredByPosition: null, RecipientPosition: null })); const added = await db.from('LetterRecipients').insert(rows); check(added.error) }
    await addWorkflow(request,auth, letter.Id, 0, 'ایجاد نامه'); if (status === 1){await addWorkflow(request,auth, letter.Id, 1, 'ارسال نامه');await notifyLetterRecipients(auth,created.data,recipients)}else if(status===4){await addWorkflow(request,auth,letter.Id,3,'تأیید و امضا شد');await notifyLetterRecipients(auth,created.data,recipients,`نامه امضاشده از ${actorName}`)} return json(request, { message: 'نامه با موفقیت ثبت شد', id: letter.Id, letterNumber, trackingCode: created.data.LetterCounter }, 201)
  }
  if (request.method === 'PUT' && match) {
    requirePermission(auth,'letters.edit');const input = await body<Obj>(request); const current = await db.from('Letters').select('*').eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('IsDeleted', false).single(); check(current.error);if(current.data.FromUserId!==auth.userId&&!auth.isAdmin&&!canRegistry){const access=await db.from('LetterRecipients').select('Id').eq('TenantId',auth.tenantId).eq('LetterId',match[1]).eq('UserId',auth.userId).eq('IsDeleted',false).limit(1);check(access.error);if(!access.data?.length)throw new HttpError(403,'دسترسی غیرمجاز')}
    const previous=Number(current.data.Status);const status=enumIn(input.status,statuses);if(previous===4&&status!==4)throw new HttpError(400,'برای تغییر وضعیت ابتدا امضای خود را پس بگیرید');if(status===4&&previous!==4)requirePermission(auth,'letters.sign');if(status===1&&previous!==1)requirePermission(auth,'letters.send')
    const actor=await fullName(auth);const update:Obj={Subject:input.subject,Body:input.body??current.data.Body,Priority:enumIn(input.priority,priorities),Classification:input.classification??current.data.Classification,Status:status,SentAt:status===1?current.data.SentAt??now():current.data.SentAt,UpdatedAt:now()}
    if(status===4&&previous!==4){update.SignedByUserId=auth.userId;update.SignedByName=actor;update.SignedAt=now()}
    const recipients = Array.isArray(input.recipients) ? input.recipients : []
    if (status !== 0 && recipients.length === 0 && !input.toExternalName) throw new HttpError(400, 'برای ارسال نامه انتخاب گیرنده الزامی است')
    const result = await db.from('Letters').update({ ...update, ToExternalName: input.toExternalName ?? current.data.ToExternalName, ToExternalOrg: input.toExternalOrg ?? current.data.ToExternalOrg }).eq('TenantId', auth.tenantId).eq('Id', match[1]).select().single(); check(result.error)
    if (previous===0&&Array.isArray(input.recipients)) {
      const removed = await db.from('LetterRecipients').delete().eq('TenantId', auth.tenantId).eq('LetterId', match[1]).neq('RecipientType', 2); check(removed.error)
      if (recipients.length) {
        const rows = recipients.map((r: Obj) => ({ ...base(auth), LetterId: match[1], UserId: r.userId ?? null, ContactId: r.contactId ?? null, UserName: r.userName ?? null, ExternalName: r.externalName ?? null, ExternalOrg: r.externalOrg ?? null, RecipientType: enumIn(r.recipientType, recipientTypes), ReferralType: r.referralType ?? 'اصل', ReferralText: r.referralText ?? null, IsRead: false, ReadAt: null, PhoneNumber: r.phoneNumber ?? null, SmsRequested: Boolean(r.sendSms), SmsStatus: r.sendSms ? 'pending' : null, ReferredByUserId: null, ReferredByName: null, ReferredByPosition: null, RecipientPosition: null }))
        const added = await db.from('LetterRecipients').insert(rows); check(added.error)
      }
    }
    if(status===1&&previous!==1){await addWorkflow(request,auth,match[1],1,'پیش‌نویس ذخیره و ارسال شد');await notifyLetterRecipients(auth,result.data,recipients)}else if(status===4&&previous!==4)await addWorkflow(request,auth,match[1],3,'پیش‌نویس تأیید و امضا شد');else await addWorkflow(request,auth,match[1],7,'ویرایش نامه')
    return json(request, { message: status === 0 ? 'پیش‌نویس ذخیره شد' : 'تغییرات نامه ذخیره شد', letterNumber: result.data.LetterNumber, status: enumOut(result.data.Status, statuses) })
  }
  if (request.method === 'POST' && refer) {
    requirePermission(auth, 'letters.refer'); const input = await body<Obj>(request); if (!input.toUserId && !input.toContactId) throw new HttpError(400, 'گیرنده ارجاع الزامی است'); if (!String(input.referralText ?? '').trim()) throw new HttpError(400, 'متن ارجاع الزامی است')
    const requestId=String(input.clientRequestId??'').trim();if(requestId){const existing=await db.from('LetterRecipients').select('Id').eq('TenantId',auth.tenantId).eq('LetterId',refer[1]).eq('ReferredByUserId',auth.userId).eq('ClientRequestId',requestId).maybeSingle();check(existing.error);if(existing.data)return json(request,{message:'این ارجاع قبلاً ثبت شده است',duplicate:true})}
    const letterResult=await db.from('Letters').select('Id,LetterNumber,Subject').eq('TenantId',auth.tenantId).eq('Id',refer[1]).eq('IsDeleted',false).single();check(letterResult.error)
    const recipient = { ...base(auth), ClientRequestId:requestId||null, LetterId: refer[1], UserId: input.toUserId ?? null, ContactId: input.toContactId ?? null, UserName: input.toUserName ?? null, ExternalName: null, ExternalOrg: null, RecipientType: 2, ReferralType: input.referralType ?? 'جهت اقدام', ReferralText: String(input.referralText).trim(), IsRead: false, ReadAt: null, PhoneNumber: input.phoneNumber ?? null, SmsRequested: Boolean(input.sendSms), SmsStatus: input.sendSms ? 'pending' : null, ReferredByUserId: auth.userId, ReferredByName: await fullName(auth), ReferredByPosition: null, RecipientPosition: null }; const added = await db.from('LetterRecipients').insert(recipient); check(added.error); const updated = await db.from('Letters').update({ Status: 5, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', refer[1]); check(updated.error); await addWorkflow(request,auth, refer[1], 4, `ارجاع: ${recipient.ReferralText}`); if(recipient.UserId)await notify(auth,recipient.UserId,`ارجاع نامه از ${recipient.ReferredByName}`,`${letterResult.data.LetterNumber} — ${letterResult.data.Subject} — ${recipient.ReferralType}`,'/letters/referrals',refer[1],'LetterReferral');return json(request, { message: 'نامه با موفقیت ارجاع داده شد' })
  }
  if (request.method === 'PATCH' && archive) { requirePermission(auth, 'letters.archive'); const result = await db.from('Letters').update({ Status: 6, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', archive[1]); check(result.error); await addWorkflow(request,auth, archive[1], 5, 'بایگانی شد'); return json(request, { message: 'نامه بایگانی شد' }) }
  if(request.method==='PATCH'&&sign){requirePermission(auth,'letters.sign');const current=await db.from('Letters').select('*').eq('TenantId',auth.tenantId).eq('Id',sign[1]).eq('IsDeleted',false).single();check(current.error);if(Number(current.data.Status)===4)throw new HttpError(400,'نامه قبلاً امضا شده است');if(current.data.FromUserId!==auth.userId&&!auth.isAdmin&&!canRegistry)throw new HttpError(403,'دسترسی غیرمجاز');const actor=await fullName(auth);const result=await db.from('Letters').update({Status:4,SignedByUserId:auth.userId,SignedByName:actor,SignedAt:now(),UpdatedAt:now()}).eq('TenantId',auth.tenantId).eq('Id',sign[1]);check(result.error);await addWorkflow(request,auth,sign[1],3,'امضا شد');return json(request,{message:'نامه امضا شد'})}
  if(request.method==='PATCH'&&revokeSign){requirePermission(auth,'letters.sign.revoke');const current=await db.from('Letters').select('*').eq('TenantId',auth.tenantId).eq('Id',revokeSign[1]).eq('IsDeleted',false).single();check(current.error);if(Number(current.data.Status)!==4||current.data.SignedByUserId!==auth.userId)throw new HttpError(403,'فقط امضاکننده می‌تواند امضای خود را پس بگیرد');const next=current.data.SentAt?1:0;const result=await db.from('Letters').update({Status:next,SignedByUserId:null,SignedByName:null,SignedAt:null,UpdatedAt:now()}).eq('TenantId',auth.tenantId).eq('Id',revokeSign[1]);check(result.error);await addWorkflow(request,auth,revokeSign[1],8,'امضای خود را پس گرفت');return json(request,{message:'امضا پس گرفته شد',status:enumOut(next,statuses)})}
  if(request.method==='PATCH'&&cancel){requirePermission(auth,'letters.cancel');const current=await db.from('Letters').select('Status').eq('TenantId',auth.tenantId).eq('Id',cancel[1]).eq('IsDeleted',false).single();check(current.error);if(Number(current.data.Status)===7)throw new HttpError(400,'نامه قبلاً ابطال شده است');const result=await db.from('Letters').update({Status:7,UpdatedAt:now()}).eq('TenantId',auth.tenantId).eq('Id',cancel[1]);check(result.error);await addWorkflow(request,auth,cancel[1],6,'ابطال نامه');return json(request,{message:'نامه ابطال شد'})}
  if (request.method === 'DELETE' && match) { requirePermission(auth, 'letters.delete'); const result = await db.from('Letters').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', match[1]); check(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) }) }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}
