import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'

type Obj = Record<string, any>
const db = adminClient()
const now = () => new Date().toISOString()
const base = (auth: AuthContext): Obj => ({ Id: crypto.randomUUID(), TenantId: auth.tenantId, CreatedAt: now(), UpdatedAt: null, CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null })
const types = ['Internal', 'Incoming', 'Outgoing']; const statuses = ['Draft', 'Sent', 'Received', 'InReview', 'Signed', 'Referred', 'Archived', 'Cancelled']; const priorities = ['Low', 'Normal', 'High', 'Urgent']; const recipientTypes = ['To', 'CC', 'Referral']; const actions = ['Created', 'Sent', 'Received', 'Signed', 'Referred', 'Archived', 'Cancelled']
function check(error: { message: string } | null): void { if (error) { console.error(error.message); throw new HttpError(500, 'خطا در پایگاه داده') } }
function enumIn(value: unknown, names: string[]): number { if (typeof value === 'number') return value; const i = names.findIndex((x) => x.toLowerCase() === String(value).toLowerCase()); return i < 0 ? 0 : i }
function enumOut(value: unknown, names: string[]): unknown { return typeof value === 'number' ? names[value] : value }
async function fullName(auth: AuthContext): Promise<string> { const u = await db.from('Users').select('FirstName,LastName').eq('TenantId', auth.tenantId).eq('Id', auth.userId).single(); check(u.error); return `${u.data.FirstName ?? ''} ${u.data.LastName ?? ''}`.trim() }
async function notify(auth:AuthContext,userId:string,title:string,content:string,actionUrl:string,entityId:string):Promise<void>{if(!userId||userId===auth.userId)return;const result=await db.from('Notifications').insert({...base(auth),UserId:userId,Title:title,Body:content,Type:0,IsRead:false,ReadAt:null,ActionUrl:actionUrl,RelatedEntityId:entityId,RelatedEntityType:'Letter'});check(result.error)}
async function notifyLetterRecipients(auth:AuthContext,letter:Obj,recipients:Obj[],title='نامه جدید دریافت شد',actionUrl='/letters'):Promise<void>{const users=[...new Set(recipients.map(r=>r.userId).filter(Boolean))] as string[];await Promise.all(users.map(id=>notify(auth,id,title,`${letter.LetterNumber ?? ''} — ${letter.Subject}`,actionUrl,letter.Id)))}

async function details(auth: AuthContext, letter: Obj): Promise<Obj> {
  const [recipients, attachments, workflow, template, sender] = await Promise.all([
    db.from('LetterRecipients').select('*').eq('TenantId', auth.tenantId).eq('LetterId', letter.Id).eq('IsDeleted', false).order('CreatedAt'),
    db.from('LetterAttachments').select('Id,FileName,FileSize,ContentType,StoragePath').eq('TenantId', auth.tenantId).eq('LetterId', letter.Id).eq('IsDeleted', false),
    db.from('LetterWorkflowSteps').select('*').eq('TenantId', auth.tenantId).eq('LetterId', letter.Id).eq('IsDeleted', false).order('StepOrder'),
    letter.LetterTemplateId ? db.from('LetterTemplates').select('*').eq('TenantId', auth.tenantId).eq('Id', letter.LetterTemplateId).eq('IsDeleted', false).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from('Users').select('Position,SignatureDataUrl').eq('TenantId', auth.tenantId).eq('Id', letter.FromUserId).maybeSingle(),
  ]); [recipients, attachments, workflow, template, sender].forEach((x) => check(x.error))
  const rs = (recipients.data ?? []).map((r) => ({ ...(camelize(r) as Obj), recipientType: enumOut(r.RecipientType, recipientTypes) }))
  return {
    ...(camelize(letter) as Obj), type: enumOut(letter.Type, types), status: enumOut(letter.Status, statuses), priority: enumOut(letter.Priority, priorities),
    senderPosition: sender.data?.Position, senderSignatureDataUrl: sender.data?.SignatureDataUrl,
    recipients: rs, referrals: rs.filter((r) => r.recipientType === 'Referral'), template: camelize(template.data),
    attachments: camelize(attachments.data), workflowSteps: (workflow.data ?? []).map((w) => ({ ...(camelize(w) as Obj), action: enumOut(w.Action, actions) })),
  }
}

async function addWorkflow(auth: AuthContext, letterId: string, action: number, comment: string): Promise<void> {
  const count = await db.from('LetterWorkflowSteps').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('LetterId', letterId); check(count.error)
  const result = await db.from('LetterWorkflowSteps').insert({ ...base(auth), LetterId: letterId, UserId: auth.userId, UserName: await fullName(auth), Action: action, Comment: comment, StepOrder: (count.count ?? 0) + 1 }); check(result.error)
}

export async function handleLetters(request: Request, auth: AuthContext, path: string, url: URL): Promise<Response | null> {
  if (!path.startsWith('/letters')) return null
  const refer = path.match(/^\/letters\/([0-9a-f-]+)\/refer$/i); const archive = path.match(/^\/letters\/([0-9a-f-]+)\/archive$/i); const sign = path.match(/^\/letters\/([0-9a-f-]+)\/sign$/i); const match = path.match(/^\/letters\/([0-9a-f-]+)$/i)
  const canRegistry = auth.isAdmin || auth.permissions.includes('letters.registry.view'); const canInbox = auth.isAdmin || auth.permissions.includes('letters.inbox.view')
  if (request.method === 'GET' && path === '/letters') {
    const scope=url.searchParams.get('scope');const registry=scope==='registry';const referrals=scope==='referrals';if(registry?!canRegistry:!canInbox)throw new HttpError(403,'دسترسی غیرمجاز')
    let query = db.from('Letters').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false)
    const type = url.searchParams.get('type'); const status = url.searchParams.get('status'); if (type) query = query.eq('Type', enumIn(type, types)); if (status) query = query.eq('Status', enumIn(status, statuses))
    const [result,rec]=await Promise.all([query.order('CreatedAt',{ascending:false}),db.from('LetterRecipients').select('*').eq('TenantId',auth.tenantId).eq('IsDeleted',false)]);check(result.error);check(rec.error);const output:Obj[]=[]
    const byLetter=new Map<string,Obj[]>();for(const row of rec.data??[]){const rows=byLetter.get(row.LetterId)??[];rows.push(row);byLetter.set(row.LetterId,rows)}
    for(const letter of result.data??[]){const rows=byLetter.get(letter.Id)??[],mine=rows.filter(x=>x.UserId===auth.userId),myReferral=mine.find(x=>Number(x.RecipientType)===2);const visible=referrals?Boolean(myReferral):registry||canRegistry||letter.FromUserId===auth.userId||mine.length>0;if(!visible)continue;output.push({id:letter.Id,subject:letter.Subject,letterNumber:letter.LetterNumber,letterDate:letter.LetterDate,type:enumOut(letter.Type,types),status:enumOut(letter.Status,statuses),priority:enumOut(letter.Priority,priorities),classification:letter.Classification,fromUserName:letter.FromUserName,hasAttachment:letter.HasAttachment,toExternalName:letter.ToExternalName,toExternalOrg:letter.ToExternalOrg,incomingFromOrg:letter.IncomingFromOrg,createdAt:letter.CreatedAt,sentAt:letter.SentAt,recipientCount:rows.length,isRead:mine.length>0&&mine.every(x=>x.IsRead),isSender:letter.FromUserId===auth.userId,isReferral:Boolean(myReferral),referralType:myReferral?.ReferralType,referralText:myReferral?.ReferralText,referredByName:myReferral?.ReferredByName})}
    return json(request, output)
  }
  if (request.method === 'GET' && match) {
    if (!canInbox && !canRegistry) throw new HttpError(403, 'دسترسی غیرمجاز'); const result = await db.from('Letters').select('*').eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('IsDeleted', false).maybeSingle(); check(result.error); if (!result.data) throw new HttpError(404, 'نامه یافت نشد')
    const recipient = await db.from('LetterRecipients').select('Id').eq('TenantId', auth.tenantId).eq('LetterId', match[1]).eq('UserId', auth.userId).eq('IsDeleted', false).maybeSingle(); check(recipient.error)
    if (!canRegistry && result.data.FromUserId !== auth.userId && !recipient.data) throw new HttpError(403, 'دسترسی غیرمجاز'); if (recipient.data) await db.from('LetterRecipients').update({ IsRead: true, ReadAt: now() }).eq('Id', recipient.data.Id)
    return json(request, await details(auth, result.data))
  }
  if (request.method === 'POST' && path === '/letters') {
    requirePermission(auth, 'letters.create'); const input = await body<Obj>(request); const type = enumIn(input.type, types); const status = enumIn(input.status, statuses)
    const requestId=String(input.clientRequestId??'').trim();if(requestId){const existing=await db.from('Letters').select('Id,LetterNumber,Status').eq('TenantId',auth.tenantId).eq('FromUserId',auth.userId).eq('ClientRequestId',requestId).maybeSingle();check(existing.error);if(existing.data)return json(request,{message:'این نامه قبلاً ثبت شده است',id:existing.data.Id,letterNumber:existing.data.LetterNumber,status:enumOut(existing.data.Status,statuses),duplicate:true})}
    const recipients = Array.isArray(input.recipients) ? input.recipients : []
    if (status !== 0 && recipients.length === 0 && !input.toExternalName) throw new HttpError(400, 'برای ارسال نامه انتخاب گیرنده الزامی است')
    if (status === 1) requirePermission(auth, 'letters.send'); if (status === 4) requirePermission(auth, 'letters.sign')
    const count = await db.from('Letters').select('*', { count: 'exact', head: true }).eq('TenantId', auth.tenantId).eq('Type', type); check(count.error); const prefix = type === 0 ? 'د' : type === 1 ? 'و' : 'ص'; const letterNumber = `${prefix}/${new Date().getFullYear()}/${String((count.count ?? 0) + 1).padStart(4, '0')}`
    const letter = { ...base(auth), ClientRequestId:requestId||null, Subject: String(input.subject ?? '').trim(), Body: input.body ?? '', Type: type, Status: status, Priority: enumIn(input.priority ?? 'Normal', priorities), Classification: input.classification ?? 'normal', LetterNumber: letterNumber, LetterCounter: (count.count ?? 0) + 1, RegistryId: null, LetterDate: input.letterDate ?? now(), SentAt: status === 1 ? now() : null, ReferenceNumber: input.referenceNumber ?? null, ReferenceDate: input.referenceDate ?? null, ReferenceType: input.referenceType ?? null, FolderName: input.folderName ?? null, HasAttachment: false, LetterTemplateId: input.letterTemplateId ?? null, TemplateKey: input.templateKey ?? null, PaperSize: input.paperSize === 'A5' ? 'A5' : 'A4', TemplateHasHeader: input.templateHasHeader !== false, TemplateHasFooter: input.templateHasFooter !== false, FromUserId: auth.userId, FromUserName: await fullName(auth), ToExternalName: input.toExternalName ?? null, ToExternalOrg: input.toExternalOrg ?? null, IncomingNumber: input.incomingNumber ?? null, IncomingDate: input.incomingDate ?? null, IncomingFromOrg: input.incomingFromOrg ?? null }
    if (!letter.Subject) throw new HttpError(400, 'موضوع نامه الزامی است'); const created = await db.from('Letters').insert(letter).select().single(); check(created.error)
    if (recipients.length) { const rows = recipients.map((r: Obj) => ({ ...base(auth), LetterId: letter.Id, UserId: r.userId ?? null, ContactId: r.contactId ?? null, UserName: r.userName ?? null, ExternalName: r.externalName ?? null, ExternalOrg: r.externalOrg ?? null, RecipientType: enumIn(r.recipientType, recipientTypes), ReferralType: r.referralType ?? 'اصل', ReferralText: r.referralText ?? null, IsRead: false, ReadAt: null, PhoneNumber: r.phoneNumber ?? null, SmsRequested: Boolean(r.sendSms), SmsStatus: r.sendSms ? 'pending' : null, ReferredByUserId: null, ReferredByName: null, ReferredByPosition: null, RecipientPosition: null })); const added = await db.from('LetterRecipients').insert(rows); check(added.error) }
    await addWorkflow(auth, letter.Id, 0, 'ایجاد نامه'); if (status === 1){await addWorkflow(auth, letter.Id, 1, 'ارسال نامه');await notifyLetterRecipients(auth,letter,recipients)} return json(request, { message: 'نامه با موفقیت ثبت شد', id: letter.Id, letterNumber }, 201)
  }
  if (request.method === 'PUT' && match) {
    const input = await body<Obj>(request); const current = await db.from('Letters').select('*').eq('TenantId', auth.tenantId).eq('Id', match[1]).eq('IsDeleted', false).single(); check(current.error); if (current.data.FromUserId !== auth.userId && !auth.isAdmin) throw new HttpError(403, 'دسترسی غیرمجاز')
    const status = enumIn(input.status, statuses); requirePermission(auth, status === 4 ? 'letters.sign' : status === 1 ? 'letters.send' : 'letters.edit'); const update = { Subject: input.subject, Body: input.body ?? current.data.Body, Priority: enumIn(input.priority, priorities), Classification: input.classification ?? current.data.Classification, Status: status, LetterTemplateId: input.letterTemplateId ?? current.data.LetterTemplateId, TemplateKey: input.templateKey ?? current.data.TemplateKey, PaperSize: input.paperSize ?? current.data.PaperSize, TemplateHasHeader: input.templateHasHeader ?? current.data.TemplateHasHeader, TemplateHasFooter: input.templateHasFooter ?? current.data.TemplateHasFooter, SentAt: status === 1 ? current.data.SentAt ?? now() : current.data.SentAt, UpdatedAt: now() }
    if(Number(current.data.Status)===1&&status===1)return json(request,{message:'این نامه قبلاً ارسال شده است',letterNumber:current.data.LetterNumber,status:'Sent',duplicate:true})
    const recipients = Array.isArray(input.recipients) ? input.recipients : []
    if (status !== 0 && recipients.length === 0 && !input.toExternalName) throw new HttpError(400, 'برای ارسال نامه انتخاب گیرنده الزامی است')
    const result = await db.from('Letters').update({ ...update, ToExternalName: input.toExternalName ?? current.data.ToExternalName, ToExternalOrg: input.toExternalOrg ?? current.data.ToExternalOrg }).eq('TenantId', auth.tenantId).eq('Id', match[1]).select().single(); check(result.error)
    if (Array.isArray(input.recipients)) {
      const removed = await db.from('LetterRecipients').delete().eq('TenantId', auth.tenantId).eq('LetterId', match[1]).neq('RecipientType', 2); check(removed.error)
      if (recipients.length) {
        const rows = recipients.map((r: Obj) => ({ ...base(auth), LetterId: match[1], UserId: r.userId ?? null, ContactId: r.contactId ?? null, UserName: r.userName ?? null, ExternalName: r.externalName ?? null, ExternalOrg: r.externalOrg ?? null, RecipientType: enumIn(r.recipientType, recipientTypes), ReferralType: r.referralType ?? 'اصل', ReferralText: r.referralText ?? null, IsRead: false, ReadAt: null, PhoneNumber: r.phoneNumber ?? null, SmsRequested: Boolean(r.sendSms), SmsStatus: r.sendSms ? 'pending' : null, ReferredByUserId: null, ReferredByName: null, ReferredByPosition: null, RecipientPosition: null }))
        const added = await db.from('LetterRecipients').insert(rows); check(added.error)
      }
    }
    if(status===1&&Number(current.data.Status)!==1)await notifyLetterRecipients(auth,result.data,recipients)
    return json(request, { message: status === 0 ? 'پیش‌نویس ذخیره شد' : 'نامه ذخیره و ارسال شد', letterNumber: result.data.LetterNumber, status: enumOut(result.data.Status, statuses) })
  }
  if (request.method === 'POST' && refer) {
    requirePermission(auth, 'letters.refer'); const input = await body<Obj>(request); if (!input.toUserId && !input.toContactId) throw new HttpError(400, 'گیرنده ارجاع الزامی است'); if (!String(input.referralText ?? '').trim()) throw new HttpError(400, 'متن ارجاع الزامی است')
    const requestId=String(input.clientRequestId??'').trim();if(requestId){const existing=await db.from('LetterRecipients').select('Id').eq('TenantId',auth.tenantId).eq('LetterId',refer[1]).eq('ReferredByUserId',auth.userId).eq('ClientRequestId',requestId).maybeSingle();check(existing.error);if(existing.data)return json(request,{message:'این ارجاع قبلاً ثبت شده است',duplicate:true})}
    const letterResult=await db.from('Letters').select('Id,LetterNumber,Subject').eq('TenantId',auth.tenantId).eq('Id',refer[1]).eq('IsDeleted',false).single();check(letterResult.error)
    const recipient = { ...base(auth), ClientRequestId:requestId||null, LetterId: refer[1], UserId: input.toUserId ?? null, ContactId: input.toContactId ?? null, UserName: input.toUserName ?? null, ExternalName: null, ExternalOrg: null, RecipientType: 2, ReferralType: input.referralType ?? 'جهت اقدام', ReferralText: String(input.referralText).trim(), IsRead: false, ReadAt: null, PhoneNumber: input.phoneNumber ?? null, SmsRequested: Boolean(input.sendSms), SmsStatus: input.sendSms ? 'pending' : null, ReferredByUserId: auth.userId, ReferredByName: await fullName(auth), ReferredByPosition: null, RecipientPosition: null }; const added = await db.from('LetterRecipients').insert(recipient); check(added.error); const updated = await db.from('Letters').update({ Status: 5, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', refer[1]); check(updated.error); await addWorkflow(auth, refer[1], 4, `ارجاع: ${recipient.ReferralText}`); if(recipient.UserId)await notify(auth,recipient.UserId,'نامه به شما ارجاع شد',`${letterResult.data.LetterNumber} — ${letterResult.data.Subject} — ${recipient.ReferralType}`,'/letters/referrals',refer[1]);return json(request, { message: 'نامه با موفقیت ارجاع داده شد' })
  }
  if (request.method === 'PATCH' && archive) { requirePermission(auth, 'letters.archive'); const result = await db.from('Letters').update({ Status: 6, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', archive[1]); check(result.error); await addWorkflow(auth, archive[1], 5, 'بایگانی شد'); return json(request, { message: 'نامه بایگانی شد' }) }
  if (request.method === 'PATCH' && sign) { requirePermission(auth, 'letters.sign'); const result = await db.from('Letters').update({ Status: 4, UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', sign[1]); check(result.error); await addWorkflow(auth, sign[1], 3, 'امضا شد'); return json(request, { message: 'نامه امضا شد' }) }
  if (request.method === 'DELETE' && match) { requirePermission(auth, 'letters.delete'); const result = await db.from('Letters').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', match[1]); check(result.error); return new Response(null, { status: 204, headers: corsHeaders(request) }) }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}
