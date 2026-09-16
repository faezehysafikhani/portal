import { adminClient, AuthContext } from './auth.ts'
import { decryptSecret } from './crypto.ts'

type Obj = Record<string, any>
const db = adminClient()
const now = () => new Date().toISOString()
const base = (auth: AuthContext): Obj => ({ Id: crypto.randomUUID(), TenantId: auth.tenantId, CreatedAt: now(), UpdatedAt: null, CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null })
const normalizePhone = (value: unknown): string => {
  const fa='۰۱۲۳۴۵۶۷۸۹',ar='٠١٢٣٤٥٦٧٨٩'
  return String(value??'').trim().replace(/[۰-۹٠-٩]/g,d=>String(fa.indexOf(d)>=0?fa.indexOf(d):ar.indexOf(d))).replace(/^\+98/,'0').replace(/^0098/,'0')
}
const isKavenegar = (provider: unknown, apiUrl: unknown): boolean => {
  if(String(provider??'').trim().replace(/[\s_-]/g,'').toLowerCase()==='kavenegar')return true
  try{return new URL(String(apiUrl??'')).hostname.toLowerCase()==='api.kavenegar.com'}catch{return false}
}

export async function sendTransactionalSms(auth:AuthContext,phoneValue:unknown,message:string):Promise<{success:boolean;phone:string;error?:string}> {
  const phone=normalizePhone(phoneValue)
  let provider:string|null=null,messageId:string|null=null,cost:number|null=null,error:string|undefined
  if(!/^09\d{9}$/.test(phone))error='شماره موبایل گیرنده معتبر یا ثبت‌شده نیست'
  try{
    const settings=await db.from('SmsProviderSettings').select('*').eq('TenantId',auth.tenantId).eq('IsDeleted',false).maybeSingle()
    if(settings.error)throw new Error(settings.error.message)
    const s=settings.data;provider=s?.ProviderName??null
    if(!error&&!s?.IsActive)error='سرویس پیامک فعال نیست'
    if(!error){
      const encrypted=String(s.EncryptedApiKey??'')
      if(!encrypted.startsWith('edge:v1:'))error='API Key پیامک برای Edge Function ذخیره نشده است'
      else{
        const token=await decryptSecret(encrypted);let response:Response
        if(isKavenegar(s.ProviderName,s.ApiUrl)){
          const params=new URLSearchParams({receptor:phone,message});if(s.SenderNumber)params.set('sender',String(s.SenderNumber))
          response=await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(token)}/sms/send.json`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:params.toString()})
        }else response=await fetch(String(s.ApiUrl),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({to:phone,message,sender:s.SenderNumber,username:s.Username})})
        const raw=await response.text();let payload:Obj={};try{payload=JSON.parse(raw)}catch{}
        const success=response.ok&&(!isKavenegar(s.ProviderName,s.ApiUrl)||Number(payload.return?.status??0)===200)
        const entry=Array.isArray(payload.entries)?payload.entries[0]:null
        messageId=entry?.messageid?String(entry.messageid):null;cost=entry?.cost??null
        if(!success)error=String(payload.return?.message||raw||`خطای ${response.status}`).slice(0,500)
      }
    }
  }catch(e){error=e instanceof Error?e.message:'ارسال پیامک ناموفق بود'}
  const success=!error
  const logged=await db.from('SmsMessages').insert({...base(auth),To:phone||String(phoneValue??''),Body:message,Status:success?1:3,Provider:provider,MessageId:messageId,ErrorMessage:error??null,SentAt:success?now():null,ScheduledAt:null,Cost:cost,TemplateId:null,SentByUserId:auth.userId})
  if(logged.error)console.error(logged.error.message)
  return {success,phone,error}
}
