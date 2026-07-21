import { adminClient, AuthContext, requirePermission } from '../_shared/auth.ts'
import { body, camelize, HttpError, json } from '../_shared/http.ts'
import { corsHeaders } from '../_shared/cors.ts'

type Obj = Record<string, any>
const db = adminClient(); const now = () => new Date().toISOString()
const base = (auth: AuthContext): Obj => ({ Id: crypto.randomUUID(), TenantId: auth.tenantId, CreatedAt: now(), UpdatedAt: null, CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null })
const isKavenegarProvider = (provider: unknown, apiUrl?: unknown): boolean => {
  const normalized = String(provider ?? '').trim().replace(/[\s_-]/g, '').toLowerCase()
  if (normalized === 'kavenegar') return true
  try { return new URL(String(apiUrl ?? '')).hostname.toLowerCase() === 'api.kavenegar.com' } catch { return false }
}
function check(error: { message: string } | null): void { if (error) { console.error(error.message); throw new HttpError(500, 'خطا در پایگاه داده') } }

async function key(): Promise<CryptoKey> {
  const master = Deno.env.get('INTEGRATION_MASTER_KEY'); if (!master || master.length < 32) throw new Error('INTEGRATION_MASTER_KEY must contain at least 32 characters')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(master)); return await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function protect(value: string): Promise<string> { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value))); return `edge:v1:${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...encrypted))}` }
async function unprotect(value: string): Promise<string> { if (!value.startsWith('edge:v1:')) throw new HttpError(400, 'کلید قبلی مربوط به ASP.NET است؛ لطفاً کلید API را دوباره در تنظیمات ذخیره کنید'); const [, , iv64, data64] = value.split(':'); const iv = Uint8Array.from(atob(iv64), (c) => c.charCodeAt(0)); const data = Uint8Array.from(atob(data64), (c) => c.charCodeAt(0)); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(), data)) }

async function aiSettings(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'ai.settings')
  const current = async () => { const r = await db.from('AiProviderSettings').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).maybeSingle(); check(r.error); return r.data }
  if (request.method === 'GET' && path === '/ai-settings/models') {
    const item = await current(); if (!item || !String(item.EncryptedApiKey ?? '').startsWith('edge:v1:')) throw new HttpError(400, 'ابتدا API Key را ذخیره کنید')
    const apiKey = await unprotect(String(item.EncryptedApiKey))
    const response = await fetch(`${String(item.BaseUrl).replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${apiKey}` } })
    const data = await response.json() as Obj; if (!response.ok) throw new HttpError(400, String(data.error?.message ?? 'دریافت فهرست مدل‌ها ناموفق بود'))
    const models = (Array.isArray(data.data) ? data.data : []).map((m: Obj) => String(m.id)).sort()
    return json(request, { models })
  }
  if (request.method === 'GET') { const item = await current(); return json(request, item ? { providerName: item.ProviderName, baseUrl: item.BaseUrl, model: item.Model, maxTokens: item.MaxTokens, temperature: item.Temperature, systemPrompt: item.SystemPrompt, isActive: item.IsActive, hasApiKey: String(item.EncryptedApiKey ?? '').startsWith('edge:v1:') } : null) }
  if (request.method === 'PUT' && path === '/ai-settings') {
    const input = await body<Obj>(request); let uri: URL; try { uri = new URL(String(input.baseUrl)) } catch { throw new HttpError(400, 'آدرس API معتبر نیست') }
    if (uri.protocol !== 'https:' || !['api.groq.com', 'openrouter.ai'].includes(uri.hostname)) throw new HttpError(400, 'فقط Groq و OpenRouter با HTTPS مجاز هستند')
    const old = await current(); const encrypted = input.apiKey ? await protect(String(input.apiKey).trim()) : old?.EncryptedApiKey ?? ''
    if (input.isActive && !String(encrypted).startsWith('edge:v1:')) throw new HttpError(400, 'برای فعال‌سازی، API Key را دوباره وارد کنید')
    const values = { ProviderName: input.providerName ?? 'Groq', BaseUrl: uri.toString().replace(/\/$/, ''), Model: input.model, MaxTokens: Math.max(100, Math.min(4000, Number(input.maxTokens ?? 1000))), Temperature: Math.max(0, Math.min(1.5, Number(input.temperature ?? 0.4))), SystemPrompt: String(input.systemPrompt ?? '').slice(0, 3000), IsActive: Boolean(input.isActive), EncryptedApiKey: encrypted, UpdatedAt: now() }
    const result = old ? await db.from('AiProviderSettings').update(values).eq('TenantId', auth.tenantId).eq('Id', old.Id) : await db.from('AiProviderSettings').insert({ ...base(auth), ...values }); check(result.error); return json(request, { message: 'تنظیمات هوش مصنوعی با کلید رمزنگاری‌شده ذخیره شد' })
  }
  if (request.method === 'POST' && path === '/ai-settings/test') { const item = await current(); if (!item) throw new HttpError(400, 'ابتدا تنظیمات را ذخیره کنید'); const answer = await complete(item, [{ role: 'user', content: 'فقط بنویس: اتصال موفق است' }]); return json(request, { message: 'اتصال موفق بود', response: answer.content }) }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function complete(setting: Obj, messages: Obj[]): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const apiKey = await unprotect(String(setting.EncryptedApiKey ?? '')); const endpoint = `${String(setting.BaseUrl).replace(/\/$/, '')}/chat/completions`
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: setting.Model, messages, max_tokens: setting.MaxTokens, temperature: setting.Temperature }) })
  const data = await response.json() as Obj; if (!response.ok) throw new HttpError(400, String(data.error?.message ?? 'سرویس هوش مصنوعی پاسخ نامعتبر داد'))
  return { content: String(data.choices?.[0]?.message?.content ?? ''), promptTokens: Number(data.usage?.prompt_tokens ?? 0), completionTokens: Number(data.usage?.completion_tokens ?? 0) }
}

async function ai(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'ai.view')
  const settingResult = await db.from('AiProviderSettings').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).eq('IsActive', true).maybeSingle(); check(settingResult.error)
  if (request.method === 'GET' && path === '/ai/status') { const s = settingResult.data; return json(request, s ? { configured: String(s.EncryptedApiKey ?? '').startsWith('edge:v1:'), providerName: s.ProviderName, model: s.Model } : { configured: false, providerName: '', model: '' }) }
  if (request.method === 'GET' && path === '/ai/conversations') { const r = await db.from('AiConversations').select('*').eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('IsDeleted', false).order('UpdatedAt', { ascending: false }).limit(50); check(r.error); return json(request, camelize(r.data)) }
  const conversation = path.match(/^\/ai\/conversations\/([0-9a-f-]+)$/i)
  if (conversation && request.method === 'GET') { const c = await db.from('AiConversations').select('*').eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('Id', conversation[1]).eq('IsDeleted', false).maybeSingle(); check(c.error); if (!c.data) throw new HttpError(404, 'گفتگو یافت نشد'); const m = await db.from('AiChatMessages').select('Id,Role,Content,CreatedAt').eq('TenantId', auth.tenantId).eq('ConversationId', conversation[1]).eq('IsDeleted', false).order('CreatedAt'); check(m.error); return json(request, { ...(camelize(c.data) as Obj), messages: camelize(m.data) }) }
  if (conversation && request.method === 'DELETE') { const r = await db.from('AiConversations').update({ IsDeleted: true, DeletedAt: now() }).eq('TenantId', auth.tenantId).eq('UserId', auth.userId).eq('Id', conversation[1]); check(r.error); return new Response(null, { status: 204, headers: corsHeaders(request) }) }
  if (request.method === 'POST' && path === '/ai/chat') {
    requirePermission(auth, 'ai.use'); if (!settingResult.data) throw new HttpError(400, 'سرویس هوش مصنوعی فعال نشده است'); const input = await body<Obj>(request); const text = String(input.message ?? '').trim(); if (!text || text.length > 4000) throw new HttpError(400, 'متن سؤال باید بین ۱ تا ۴۰۰۰ کاراکتر باشد')
    let conversationId = input.conversationId as string | undefined; if (!conversationId) { conversationId = crypto.randomUUID(); const created = await db.from('AiConversations').insert({ ...base(auth), Id: conversationId, UserId: auth.userId, Title: text.slice(0, 70) }); check(created.error) }
    const history = await db.from('AiChatMessages').select('Role,Content').eq('TenantId', auth.tenantId).eq('ConversationId', conversationId).eq('IsDeleted', false).order('CreatedAt').limit(20); check(history.error)
    const userMessage = await db.from('AiChatMessages').insert({ ...base(auth), ConversationId: conversationId, UserId: auth.userId, Role: 'user', Content: text, PromptTokens: null, CompletionTokens: null }); check(userMessage.error)
    const prompt = String(settingResult.data.SystemPrompt ?? 'شما دستیار فارسی سامانه سازمانی هستید. پاسخ دقیق، کوتاه و امن بده.'); const answer = await complete(settingResult.data, [{ role: 'system', content: prompt }, ...(history.data ?? []).map((m) => ({ role: String(m.Role).toLowerCase(), content: m.Content })), { role: 'user', content: text }]); const answerId = crypto.randomUUID()
    const saved = await db.from('AiChatMessages').insert({ ...base(auth), Id: answerId, ConversationId: conversationId, UserId: auth.userId, Role: 'assistant', Content: answer.content, PromptTokens: answer.promptTokens, CompletionTokens: answer.completionTokens }); check(saved.error); await db.from('AiConversations').update({ UpdatedAt: now() }).eq('TenantId', auth.tenantId).eq('Id', conversationId)
    return json(request, { conversationId, message: { id: answerId, role: 'assistant', content: answer.content, createdAt: now() }, usage: { promptTokens: answer.promptTokens, completionTokens: answer.completionTokens } })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function sms(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'sms.settings'); const current = async () => { const r = await db.from('SmsProviderSettings').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).maybeSingle(); check(r.error); return r.data }
  if (request.method === 'GET') { const s = await current(); return json(request, s ? { id: s.Id, providerName: isKavenegarProvider(s.ProviderName, s.ApiUrl) ? 'Kavenegar' : s.ProviderName, apiUrl: isKavenegarProvider(s.ProviderName, s.ApiUrl) ? 'https://api.kavenegar.com/v1/' : s.ApiUrl, senderNumber: s.SenderNumber, username: s.Username, hasPassword: String(s.EncryptedPassword ?? '').startsWith('edge:v1:'), hasApiKey: String(s.EncryptedApiKey ?? '').startsWith('edge:v1:'), isActive: s.IsActive, letterTemplate: s.LetterTemplate, referralTemplate: s.ReferralTemplate, meetingTemplate: s.MeetingTemplate } : null) }
  if (request.method === 'PUT' && path === '/sms-settings') {
    const input = await body<Obj>(request); const provider=String(input.providerName??'').trim(); const isKavenegar=isKavenegarProvider(provider,input.apiUrl)
    let uri: URL; try { uri = new URL(isKavenegar?'https://api.kavenegar.com/v1/':String(input.apiUrl)) } catch { throw new HttpError(400, 'آدرس API معتبر نیست') }
    if (uri.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(uri.hostname)) throw new HttpError(400, 'آدرس API باید HTTPS عمومی باشد')
    if(isKavenegar&&uri.hostname!=='api.kavenegar.com')throw new HttpError(400,'آدرس سرویس کاوه‌نگار معتبر نیست')
    const old = await current(); const encryptedApiKey=input.apiKey?await protect(String(input.apiKey).trim()):old?.EncryptedApiKey??''
    if(Boolean(input.isActive)&&!String(encryptedApiKey).startsWith('edge:v1:'))throw new HttpError(400,'برای فعال‌سازی، API Key الزامی است')
    const sender=String(input.senderNumber??'').trim();if(sender&&!/^\+?\d{5,20}$/.test(sender))throw new HttpError(400,'شماره فرستنده معتبر نیست')
    const values = { ProviderName: isKavenegar?'Kavenegar':provider, ApiUrl: uri.toString(), SenderNumber: sender||null, Username:isKavenegar?null:input.username??null, EncryptedPassword:isKavenegar?'':input.password?await protect(String(input.password)):old?.EncryptedPassword??'', EncryptedApiKey:encryptedApiKey, IsActive:Boolean(input.isActive), LetterTemplate:input.letterTemplate, ReferralTemplate:input.referralTemplate, MeetingTemplate:input.meetingTemplate, UpdatedAt:now() }
    const r = old ? await db.from('SmsProviderSettings').update(values).eq('TenantId', auth.tenantId).eq('Id', old.Id) : await db.from('SmsProviderSettings').insert({ ...base(auth), ...values }); check(r.error); return json(request, { message: isKavenegar?'تنظیمات کاوه‌نگار با API Key رمزنگاری‌شده ذخیره شد':'تنظیمات پیامک ذخیره شد' })
  }
  if (request.method === 'POST' && path === '/sms-settings/test') {
    const input=await body<Obj>(request),phone=String(input.phone??'').trim(),message=String(input.message??'').trim();if(!/^09\d{9}$/.test(phone))throw new HttpError(400,'شماره گیرنده معتبر نیست');if(!message)throw new HttpError(400,'متن پیام الزامی است')
    const s=await current();if(!s?.IsActive)throw new HttpError(400,'سرویس پیامک فعال نیست');const token=s.EncryptedApiKey?await unprotect(s.EncryptedApiKey):'';if(!token)throw new HttpError(400,'API Key ذخیره نشده است')
    const isKavenegar=isKavenegarProvider(s.ProviderName,s.ApiUrl);let response:Response
    if(isKavenegar){const endpoint=`https://api.kavenegar.com/v1/${encodeURIComponent(token)}/sms/send.json`;const params=new URLSearchParams({receptor:phone,message});if(s.SenderNumber)params.set('sender',String(s.SenderNumber));response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:params.toString()})}
    else response=await fetch(s.ApiUrl,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({to:phone,message,sender:s.SenderNumber,username:s.Username})})
    const raw=await response.text();let payload:Obj={};try{payload=JSON.parse(raw)}catch{}const apiStatus=isKavenegar?Number(payload.return?.status??0):response.status;const success=response.ok&&(!isKavenegar||apiStatus===200);const entry=Array.isArray(payload.entries)?payload.entries[0]:null;const errorMessage=success?null:String(payload.return?.message||raw||`خطای ${response.status}`).slice(0,500)
    const log=await db.from('SmsMessages').insert({...base(auth),To:phone,Body:message,Status:success?1:3,Provider:s.ProviderName,MessageId:entry?.messageid?String(entry.messageid):null,ErrorMessage:errorMessage,SentAt:success?now():null,ScheduledAt:null,Cost:entry?.cost??null,TemplateId:null,SentByUserId:auth.userId});check(log.error);if(!success)throw new HttpError(400,errorMessage||'ارسال پیامک ناموفق بود');return json(request,{message:entry?.statustext?`پیامک ارسال شد: ${entry.statustext}`:'پیامک آزمایشی ارسال شد',messageId:entry?.messageid??null})
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

async function smsMessaging(request: Request, auth: AuthContext, path: string): Promise<Response> {
  requirePermission(auth, 'sms.view')
  if (request.method === 'GET' && path === '/sms/messages') {
    const r = await db.from('SmsMessages').select('Id,To,Body,Status,Provider,MessageId,ErrorMessage,SentAt,CreatedAt,Cost').eq('TenantId', auth.tenantId).eq('IsDeleted', false).order('CreatedAt', { ascending: false }).limit(200)
    check(r.error); return json(request, camelize(r.data))
  }
  if (request.method === 'POST' && path === '/sms/send') {
    const input = await body<Obj>(request)
    const fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩'
    const normalize = (v: unknown) => String(v ?? '').trim().replace(/[۰-۹٠-٩]/g, (d) => String(fa.indexOf(d) >= 0 ? fa.indexOf(d) : ar.indexOf(d)))
    const message = String(input.message ?? '').trim()
    if (!message || message.length > 500) throw new HttpError(400, 'متن پیام باید بین ۱ تا ۵۰۰ کاراکتر باشد')
    const recipients = [...new Set(((Array.isArray(input.recipients) ? input.recipients : []) as unknown[]).map(normalize).filter(Boolean))]
    if (!recipients.length) throw new HttpError(400, 'حداقل یک شماره گیرنده انتخاب کنید')
    if (recipients.length > 100) throw new HttpError(400, 'در هر ارسال حداکثر ۱۰۰ شماره مجاز است')
    const invalid = recipients.filter((p) => !/^09\d{9}$/.test(p))
    if (invalid.length) throw new HttpError(400, `این شماره‌ها معتبر نیستند: ${invalid.slice(0, 5).join('، ')}`)
    // محدودیت نرخ: جلوگیری از تخلیه اعتبار پیامک توسط حساب لو رفته یا اسکریپت
    try {
      const since = new Date(Date.now() - 60 * 60_000).toISOString()
      const recent = await db.from('SmsMessages').select('Id', { count: 'exact', head: true })
        .eq('TenantId', auth.tenantId).gte('CreatedAt', since)
      const sentLastHour = recent.count ?? 0
      if (sentLastHour + recipients.length > 300) {
        throw new HttpError(429, `سقف ارسال پیامک در یک ساعت گذشته پر شده است (${sentLastHour} پیامک). لطفاً بعداً دوباره تلاش کنید.`)
      }
    } catch (e) {
      if (e instanceof HttpError) throw e   // خطای سقف را عبور بده
      console.error('sms rate-limit check failed', e)  // خطای پایگاه داده نباید ارسال مجاز را قطع کند
    }
    const settings = await db.from('SmsProviderSettings').select('*').eq('TenantId', auth.tenantId).eq('IsDeleted', false).maybeSingle()
    check(settings.error); const s = settings.data
    if (!s?.IsActive) throw new HttpError(400, 'سرویس پیامک فعال نیست؛ ابتدا از تنظیمات، پنل پیامکی را فعال کنید')
    const token = s.EncryptedApiKey ? await unprotect(s.EncryptedApiKey) : ''
    if (!token) throw new HttpError(400, 'API Key ذخیره نشده است')
    const isKavenegar = isKavenegarProvider(s.ProviderName, s.ApiUrl)
    let response: Response
    if (isKavenegar) {
      const endpoint = `https://api.kavenegar.com/v1/${encodeURIComponent(token)}/sms/send.json`
      const params = new URLSearchParams({ receptor: recipients.join(','), message })
      if (s.SenderNumber) params.set('sender', String(s.SenderNumber))
      response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: params.toString() })
    } else {
      response = await fetch(s.ApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ to: recipients, message, sender: s.SenderNumber, username: s.Username }) })
    }
    const raw = await response.text(); let payload: Obj = {}; try { payload = JSON.parse(raw) } catch { /* non-JSON body is kept in raw */ }
    const apiStatus = isKavenegar ? Number(payload.return?.status ?? 0) : response.status
    const success = response.ok && (!isKavenegar || apiStatus === 200)
    const entries: Obj[] = Array.isArray(payload.entries) ? payload.entries : []
    const errorMessage = success ? null : String(payload.return?.message || raw || `خطای ${response.status}`).slice(0, 500)
    const rows = recipients.map((phone, index) => {
      const entry = entries.find((e) => String(e.receptor) === phone) ?? entries[index] ?? null
      return { ...base(auth), To: phone, Body: message, Status: success ? 1 : 3, Provider: s.ProviderName, MessageId: entry?.messageid ? String(entry.messageid) : null, ErrorMessage: errorMessage, SentAt: success ? now() : null, ScheduledAt: null, Cost: entry?.cost ?? null, TemplateId: null, SentByUserId: auth.userId }
    })
    const log = await db.from('SmsMessages').insert(rows); check(log.error)
    if (!success) throw new HttpError(400, errorMessage || 'ارسال پیامک ناموفق بود')
    return json(request, { message: recipients.length === 1 ? 'پیامک ارسال شد' : `پیامک برای ${recipients.length} شماره ارسال شد`, sent: recipients.length })
  }
  throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود')
}

export async function handleIntegrations(request: Request, auth: AuthContext, path: string): Promise<Response | null> {
  if (path.startsWith('/ai-settings')) return aiSettings(request, auth, path)
  if (path.startsWith('/ai')) return ai(request, auth, path)
  if (path.startsWith('/sms-settings')) return sms(request, auth, path)
  if (path.startsWith('/sms')) return smsMessaging(request, auth, path)
  return null
}
