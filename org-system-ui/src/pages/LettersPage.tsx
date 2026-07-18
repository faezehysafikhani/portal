import { useState, useEffect, useRef } from 'react'
import { Table, Button, Tag, Space, Badge, Tabs, Input, Modal, notification, Tooltip, Avatar, Card, Row, Col, Divider, Select, Collapse, Form, Checkbox, Popconfirm } from 'antd'
import { PlusOutlined, MailOutlined, InboxOutlined, SendOutlined, FileTextOutlined, FolderOutlined, EyeOutlined, SettingOutlined, SearchOutlined, FilterOutlined, SwapLeftOutlined, EditOutlined, PrinterOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons'
import LetterComposePage from './LetterComposePage'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../utils/api'

const API = 'http://localhost:5043/api/v1'
const getToken = () => localStorage.getItem('token') || ''
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` })

interface Letter {
  id: string
  trackingCode: number
  subject: string
  letterNumber: string
  letterDate: string
  type: string
  status: string
  priority: string
  classification: string
  fromUserName: string
  toExternalName?: string
  hasAttachment: boolean
  recipientCount: number
  isRead: boolean
  isSender: boolean
  isInbox?: boolean
  isReferral?: boolean
  referralType?: string
  referralText?: string
  referredByName?: string
  referredToName?: string
  referralDirection?: 'incoming' | 'outgoing'
  referralCreatedAt?: string
  referrals?: Array<{ id: string; referralType?: string; referralText?: string; referredByName?: string; referredToName?: string; createdAt?: string }>
  createdAt: string
}

interface ApiUser { id: string; fullName: string; position?: string }
interface ApiContact { id: string; fullName: string; companyName?: string; mobile?: string; phone?: string }

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  Internal: { label: 'داخلی', color: '#1677ff' },
  Incoming: { label: 'وارده', color: '#52c41a' },
  Outgoing: { label: 'صادره', color: '#fa8c16' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  Draft: { label: 'پیش‌نویس', color: 'default' },
  Sent: { label: 'ارسال شده', color: 'blue' },
  Received: { label: 'دریافت شده', color: 'green' },
  InReview: { label: 'در بررسی', color: 'orange' },
  Signed: { label: 'امضا شده', color: 'cyan' },
  Referred: { label: 'ارجاع شده', color: 'purple' },
  Archived: { label: 'بایگانی', color: 'default' },
  Cancelled: { label: 'ابطال شده', color: 'red' },
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  Low: { label: 'عادی', color: 'default' },
  Normal: { label: 'عادی', color: 'default' },
  High: { label: 'فوری', color: 'orange' },
  Urgent: { label: 'خیلی فوری', color: 'red' },
}

const REFERRAL_TYPES = ['اصل', 'رونوشت', 'تصویر', 'جهت اطلاع', 'جهت اقدام', 'جهت بایگانی', 'جهت تأیید']

const sanitizeRichHtml=(html:string)=>{
  const doc=new DOMParser().parseFromString(html||'','text/html')
  doc.querySelectorAll('script,iframe,object,embed,link,meta').forEach(x=>x.remove())
  doc.body.querySelectorAll('*').forEach(element=>{
    for(const attribute of Array.from(element.attributes)){
      if(attribute.name.toLowerCase().startsWith('on') || /javascript:/i.test(attribute.value)) element.removeAttribute(attribute.name)
    }
  })
  return doc.body.innerHTML
}

function SavedLetterPage({detail,compact=false}:{detail:any;compact?:boolean}){
  const paper=detail.paperSize==='A5'?'A5':'A4'
  const image=detail.template?.imageData
  const metrics=paper==='A5'
    ? {width:'148mm',height:'210mm',x:'12mm',receiver:image?'30mm':'14mm',meta:image?'36mm':'18mm',subject:image?'49mm':'29mm',content:image?'57mm':'36mm',bottom:'24mm',signature:'22mm',font:11}
    : {width:'210mm',height:'297mm',x:'20mm',receiver:image?'52mm':'20mm',meta:image?'66mm':'27mm',subject:image?'78mm':'38mm',content:image?'85mm':'45mm',bottom:'35mm',signature:'38mm',font:13}
  const primary=detail.recipients?.find((x:any)=>x.recipientType!=='Referral') || detail.recipients?.[0]
  const receiver=primary?.userName||primary?.externalName||detail.toExternalName||'—'
  return <div id="saved-letter-print" style={{width:metrics.width,minHeight:metrics.height,position:'relative',boxSizing:'border-box',margin:'0 auto',direction:'rtl',backgroundColor:'#fff',backgroundImage:image?`url(${image})`:undefined,backgroundSize:'100% 100%',backgroundRepeat:'no-repeat',padding:`${metrics.content} ${metrics.x} ${metrics.bottom}`,boxShadow:'0 2px 18px #0002',fontFamily:'Vazirmatn,Tahoma',zoom:compact?.72:1}}>
    <div style={{position:'absolute',top:metrics.receiver,right:metrics.x,fontSize:paper==='A5'?10:12}}><strong>گیرنده:</strong> {receiver}</div>
    <div style={{position:'absolute',top:metrics.meta,left:metrics.x,textAlign:'left',fontSize:paper==='A5'?10:12}}>
      <div><strong>تاریخ:</strong> {detail.letterDate?new Intl.DateTimeFormat('fa-IR-u-nu-latn').format(new Date(detail.letterDate)):'—'}</div>
      <div><strong>شماره:</strong> {detail.letterNumber||'—'}</div>
      <div><strong>پیوست:</strong> {detail.hasAttachment?'دارد':'ندارد'}</div>
    </div>
    <div style={{position:'absolute',top:metrics.subject,left:metrics.x,right:metrics.x,textAlign:'center',fontWeight:700,fontSize:paper==='A5'?12:15}}>موضوع: {detail.subject}</div>
    <div style={{fontSize:metrics.font,lineHeight:2.15,textAlign:'justify'}} dangerouslySetInnerHTML={{__html:sanitizeRichHtml(detail.body||'<p>متن نامه خالی است</p>')}}/>
    <div style={{position:'absolute',left:metrics.x,bottom:metrics.signature,textAlign:'center',fontSize:paper==='A5'?10:12}}>
      <div style={{fontWeight:600}}>{detail.fromUserName}</div>
      {detail.senderPosition&&<div>{detail.senderPosition}</div>}
      {detail.senderSignatureDataUrl&&<img src={detail.senderSignatureDataUrl} alt="امضا" style={{width:paper==='A5'?80:110,height:paper==='A5'?44:60,objectFit:'contain'}}/>}
    </div>
  </div>
}

function ReferralMessages({detail}:{detail:any}){
  const referrals=detail.referrals||[]
  return <div id="referral-print" style={{direction:'rtl',fontFamily:'Vazirmatn,Tahoma'}}>
    <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>پیام‌های ارجاع ({referrals.length})</div>
    {referrals.length===0?<div style={{padding:20,textAlign:'center',color:'#999',border:'1px dashed #ddd',borderRadius:8}}>پیام ارجاعی ثبت نشده است</div>:referrals.map((r:any,i:number)=><div key={r.id} style={{border:'1px solid #ead7e4',borderRight:'4px solid #8B1A6B',borderRadius:8,padding:10,marginBottom:10,background:'#fffafd'}}>
      <div style={{fontWeight:700,fontSize:12}}>{i+1}. {r.referredByName||'—'} {r.referredByPosition&&<span style={{fontWeight:400,color:'#666'}}>— {r.referredByPosition}</span>}</div>
      <div style={{fontSize:11,color:'#666',marginTop:4}}>به: {r.recipientName||'—'} {r.recipientPosition&&<>— {r.recipientPosition}</>} | {r.referralType}</div>
      <div style={{marginTop:8,lineHeight:1.9,whiteSpace:'pre-wrap',fontSize:12}}>{r.referralText||'بدون پیام'}</div>
      <div style={{fontSize:10,color:'#aaa',marginTop:6}}>{r.createdAt?new Intl.DateTimeFormat('fa-IR',{dateStyle:'short',timeStyle:'short'}).format(new Date(r.createdAt)):''}</div>
    </div>)}
  </div>
}

interface SearchFilters {
  keyword: string
  letterNumber: string
  type: string
  status: string
  fromUser: string
  toUser: string
  trackingId: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: SearchFilters = {
  keyword: '', letterNumber: '', type: '', status: '',
  fromUser: '', toUser: '', trackingId: '', dateFrom: '', dateTo: ''
}

function AdvancedSearch({ onSearch, onReset }: { onSearch: (f: SearchFilters) => void; onReset: () => void }) {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  const update = (key: keyof SearchFilters, val: string) => setFilters(prev => ({ ...prev, [key]: val }))

  return (
    <Card size="small" style={{ marginBottom: 16, border: '1px solid #e8e8e8' }}>
      <Collapse ghost items={[{
        key: '1',
        label: <Space><FilterOutlined style={{ color: '#8B1A6B' }} /><span style={{ fontWeight: 600 }}>جستجوی پیشرفته</span></Space>,
        children: (
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>کلمه کلیدی</div>
              <Input placeholder="موضوع یا فرستنده..." value={filters.keyword} onChange={e => update('keyword', e.target.value)} prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />} allowClear />
            </Col>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>شماره نامه</div>
              <Input placeholder="مثلاً: د/۱۴۰۳/۰۰۱" value={filters.letterNumber} onChange={e => update('letterNumber', e.target.value)} allowClear />
            </Col>
            <Col xs={24} md={8}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>کد رهگیری</div>
              <Input placeholder="کد رهگیری نامه" value={filters.trackingId} onChange={e => update('trackingId', e.target.value)} allowClear />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>نوع نامه</div>
              <Select placeholder="همه انواع" value={filters.type || undefined} onChange={v => update('type', v || '')} style={{ width: '100%' }} allowClear>
                <Select.Option value="Internal">داخلی</Select.Option>
                <Select.Option value="Incoming">وارده</Select.Option>
                <Select.Option value="Outgoing">صادره</Select.Option>
              </Select>
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>وضعیت</div>
              <Select placeholder="همه وضعیت‌ها" value={filters.status || undefined} onChange={v => update('status', v || '')} style={{ width: '100%' }} allowClear>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v.label}</Select.Option>)}
              </Select>
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>فرستنده</div>
              <Input placeholder="نام فرستنده..." value={filters.fromUser} onChange={e => update('fromUser', e.target.value)} allowClear />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>گیرنده</div>
              <Input placeholder="نام گیرنده..." value={filters.toUser} onChange={e => update('toUser', e.target.value)} allowClear />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>از تاریخ</div>
              <Input placeholder="۱۴۰۳/۰۱/۰۱" value={filters.dateFrom} onChange={e => update('dateFrom', e.target.value)} allowClear />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>تا تاریخ</div>
              <Input placeholder="۱۴۰۳/۱۲/۲۹" value={filters.dateTo} onChange={e => update('dateTo', e.target.value)} allowClear />
            </Col>
            <Col xs={24} md={12} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => onSearch(filters)} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>جستجو</Button>
              <Button onClick={() => { setFilters(EMPTY_FILTERS); onReset() }}>پاک کردن</Button>
            </Col>
          </Row>
        )
      }]} />
    </Card>
  )
}

function RegistryPage({ letters }: { letters: Letter[] }) {
  const [filtered, setFiltered] = useState<Letter[]>(letters)
  const [detailOpen,setDetailOpen]=useState(false)
  const [detailLoading,setDetailLoading]=useState(false)
  const [detail,setDetail]=useState<any>(null)
  useEffect(() => { setFiltered(letters) }, [letters])

  const openLetter=async(letter:Letter)=>{
    setDetailOpen(true);setDetailLoading(true);setDetail(null)
    try{
      const response=await apiFetch(`${API}/letters/${letter.id}`,{headers:authHeaders()})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.message||`خطای ${response.status}`)
      setDetail(data)
    }catch(error){notification.error({message:'بازکردن نامه ناموفق بود',description:error instanceof Error?error.message:undefined});setDetailOpen(false)}
    finally{setDetailLoading(false)}
  }

  const applySearch = (f: SearchFilters) => {
    setFiltered(letters.filter(l => {
      const kw = f.keyword.toLowerCase()
      if (f.trackingId && !String(l.trackingCode ?? '').includes(f.trackingId.trim())) return false
      if (f.letterNumber && !l.letterNumber?.includes(f.letterNumber)) return false
      if (f.type && l.type !== f.type) return false
      if (f.status && l.status !== f.status) return false
      if (f.fromUser && !l.fromUserName?.includes(f.fromUser)) return false
      if (f.keyword && !l.subject?.toLowerCase().includes(kw) && !l.fromUserName?.toLowerCase().includes(kw)) return false
      return true
    }))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <SettingOutlined style={{ fontSize: 20, color: '#8B1A6B' }} />
        <span style={{ fontSize: 18, fontWeight: 700 }}>دبیرخانه مرکزی</span>
      </div>

      <Divider>جستجو و آرشیو نامه‌ها</Divider>
      <AdvancedSearch onSearch={applySearch} onReset={() => setFiltered(letters)} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{filtered.length} نامه یافت شد</span>
      </div>

      <Table size="small" dataSource={filtered} rowKey="id" onRow={record=>({onClick:()=>void openLetter(record),style:{cursor:'pointer'}})} columns={[
        { title: 'کد رهگیری', dataIndex: 'trackingCode', key: 'trackingCode', width: 120, render: (trackingCode: number) => <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 12 }}>{trackingCode ?? '—'}</Tag> },
        { title: 'شماره', dataIndex: 'letterNumber', key: 'num', width: 130, render: (n: string) => n ? <Tag color="purple" style={{ fontFamily: 'monospace' }}>{n}</Tag> : <Tag color="default">پیش‌نویس</Tag> },
        { title: 'موضوع', dataIndex: 'subject', key: 'subject' },
        { title: 'نوع', dataIndex: 'type', key: 'type', width: 80, render: (t: string) => <Tag color={TYPE_LABELS[t]?.color}>{TYPE_LABELS[t]?.label}</Tag> },
        { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 110, render: (s: string) => <Tag color={STATUS_LABELS[s]?.color}>{STATUS_LABELS[s]?.label}</Tag> },
        { title: 'فرستنده', dataIndex: 'fromUserName', key: 'from', width: 120 },
        { title: 'ارجاعات', key: 'referrals', width: 260, render: (_: unknown, letter: Letter) => letter.referrals?.length ? <Space direction="vertical" size={2}>{letter.referrals.map(referral => <div key={referral.id} style={{ fontSize: 11 }}><Tag color="purple">{referral.referralType || 'ارجاع'}</Tag>{referral.referredByName || '—'} ← {referral.referredToName || '—'}</div>)}</Space> : <span style={{ color: '#aaa' }}>بدون ارجاع</span> },
        { title: 'تاریخ', dataIndex: 'createdAt', key: 'date', width: 110, render: (d: string) => <span style={{ fontSize: 11, color: '#8c8c8c' }}>{d ? new Intl.DateTimeFormat('fa-IR').format(new Date(d)) : '—'}</span> },
        { title:'بازکردن',key:'open',width:80,render:(_:unknown,record:Letter)=><Button size="small" icon={<EyeOutlined/>} onClick={event=>{event.stopPropagation();void openLetter(record)}}/> },
      ]} pagination={{ pageSize: 10 }} />
      <Modal title={detail ? `نامه ${detail.letterNumber || 'پیش‌نویس'} — ${detail.subject}` : 'جزئیات نامه'} open={detailOpen} onCancel={()=>setDetailOpen(false)} footer={<Button onClick={()=>setDetailOpen(false)}>بستن</Button>} width={850} loading={detailLoading}>
        {detail && <div>
          <Row gutter={[12,12]} style={{marginBottom:16}}>
            <Col span={8}><strong>وضعیت:</strong> <Tag color={STATUS_LABELS[detail.status]?.color}>{STATUS_LABELS[detail.status]?.label||detail.status}</Tag></Col>
            <Col span={8}><strong>نوع:</strong> {TYPE_LABELS[detail.type]?.label||detail.type}</Col>
            <Col span={8}><strong>فرستنده:</strong> {detail.fromUserName||'—'}</Col>
            <Col span={12}><strong>تاریخ:</strong> {detail.letterDate?new Intl.DateTimeFormat('fa-IR').format(new Date(detail.letterDate)):'—'}</Col>
            <Col span={12}><strong>پیوست:</strong> {detail.hasAttachment?'دارد':'ندارد'}</Col>
          </Row>
          <Divider>متن نامه</Divider>
          <div style={{whiteSpace:'pre-wrap',lineHeight:2,minHeight:160,padding:16,background:'#fafafa',borderRadius:8}}>{String(detail.body||'').replace(/<[^>]+>/g,' ')||'متنی ثبت نشده است'}</div>
        </div>}
      </Modal>
    </div>
  )
}

export default function LettersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [letters, setLetters] = useState<Letter[]>([])
  const [users, setUsers] = useState<ApiUser[]>([])
  const [contacts, setContacts] = useState<ApiContact[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('inbox')
  const [composing, setComposing] = useState(false)
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null)
  const [viewModal, setViewModal] = useState(false)
  const [letterDetail, setLetterDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [referModal, setReferModal] = useState(false)
  const [referLoading,setReferLoading]=useState(false)
  const referralRequestId=useRef(crypto.randomUUID())
  const [referForm] = Form.useForm()
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  const [editingDraft, setEditingDraft] = useState<any>(null)
  const [printSettingsOpen,setPrintSettingsOpen]=useState(false)
  const [printSettings,setPrintSettings]=useState<{paperSize:'auto'|'A4'|'A5';orientation:'portrait'|'landscape';margin:number;includeReferrals:boolean}>(()=>{try{return{paperSize:'auto',orientation:'portrait',margin:0,includeReferrals:true,...JSON.parse(localStorage.getItem('letter-print-settings')||'{}')}}catch{return{paperSize:'auto',orientation:'portrait',margin:0,includeReferrals:true}}})

  const isRegistry = location.pathname === '/letters/registry'
  const isReferrals=location.pathname==='/letters/referrals'
  const isDrafts=location.pathname==='/letters/drafts'
  const currentUser=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})()
  const grantedPermissions:string[]=(()=>{try{return JSON.parse(localStorage.getItem('permissions')||'[]')}catch{return []}})()
  const allowed=(code:string)=>(Array.isArray(currentUser.roles)&&currentUser.roles.includes('Admin'))||grantedPermissions.includes(code)

  useEffect(() => {
    if (location.pathname === '/letters/new') setComposing(true)
    else {setComposing(false);if(location.pathname==='/letters/referrals')setActiveTab('all');else if(location.pathname==='/letters/drafts')setActiveTab('draft');else if(location.pathname==='/letters/registry')setActiveTab('all')}
  }, [location.pathname])

  const fetchLetters = async (silent=false) => {
    try {
      if(!silent)setLoading(true)
      const scope=isRegistry?'registry':isReferrals?'referrals':'mailbox'
      const status=isDrafts?'&status=Draft':''
      const res = await apiFetch(`${API}/letters?scope=${scope}${status}`, { headers: authHeaders(),cache:'no-store' })
      if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(e.message||`خطای ${res.status}`) }
      setLetters(await res.json())
    } catch (e) {
      if(!silent)notification.error({ message: 'خطا در دریافت نامه‌ها',description:e instanceof Error?e.message:undefined })
    } finally {
      if(!silent)setLoading(false)
    }
  }

  const fetchDirectory = async () => {
    try {
      const res = await apiFetch(`${API}/directory`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data=await res.json()
      setUsers(data.users||[])
      setContacts(data.contacts||[])
    } catch {}
  }

  useEffect(() => {
    fetchLetters()
    fetchDirectory()
    const refresh=()=>void fetchLetters(true)
    const timer=window.setInterval(refresh,8000)
    const onVisibility=()=>{if(document.visibilityState==='visible')refresh()}
    window.addEventListener('focus',refresh);window.addEventListener('portal:data-changed',refresh);document.addEventListener('visibilitychange',onVisibility)
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('portal:data-changed',refresh);document.removeEventListener('visibilitychange',onVisibility)}
  }, [isRegistry,isReferrals,isDrafts])

  const handleViewLetter = async (letter: Letter) => {
    setSelectedLetter(letter)
    setDetailLoading(true)
    setViewModal(true)
    try {
      const res = await apiFetch(`${API}/letters/${letter.id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      setLetterDetail(await res.json())
    } catch {
      notification.error({ message: 'خطا در دریافت جزئیات نامه' })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await apiFetch(`${API}/letters/${id}/archive`, { method: 'PATCH', headers: authHeaders() })
      notification.success({ message: 'نامه بایگانی شد' })
      setViewModal(false)
      fetchLetters()
    } catch {
      notification.error({ message: 'خطا در بایگانی' })
    }
  }

  const handleSign = async (id: string) => {
    try {
      await apiFetch(`${API}/letters/${id}/sign`, { method: 'PATCH', headers: authHeaders() })
      notification.success({ message: 'نامه امضا شد' })
      const res = await apiFetch(`${API}/letters/${id}`, { headers: authHeaders() })
      setLetterDetail(await res.json())
      fetchLetters()
    } catch {
      notification.error({ message: 'خطا در امضا' })
    }
  }

  const handleRefer = async (values: any) => {
    try {
      setReferLoading(true)
      const [kind,id]=String(values.toPerson).split(':')
      const user=kind==='user'?users.find(u=>u.id===id):undefined
      const contact=kind==='contact'?contacts.find(c=>c.id===id):undefined
      const res = await apiFetch(`${API}/letters/${letterDetail.id}/refer`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          toUserId: user?.id || null,
          toUserName: user?.fullName || contact?.fullName,
          toContactId: contact?.id || null,
          phoneNumber: contact?.mobile || contact?.phone || null,
          sendSms: !!values.sendSms,
          referralType: values.referralType,
          referralText: values.referralText,
          clientRequestId:referralRequestId.current
        })
      })
      const result=await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(result.message||`خطای ${res.status}`)
      notification.success({ message: 'نامه با موفقیت ارجاع داده شد' })
      setReferModal(false)
      setViewModal(false)
      referForm.resetFields()
      referralRequestId.current=crypto.randomUUID()
      setLetterDetail(null)
      setSelectedLetter(null)
      fetchLetters()
    } catch (error) {
      notification.error({ message: 'خطا در ارجاع نامه',description:error instanceof Error?error.message:undefined })
    } finally {
      setReferLoading(false)
    }
  }

  const handleDeleteLetter=async(id:string)=>{
    const response=await apiFetch(`${API}/letters/${id}`,{method:'DELETE',headers:authHeaders()})
    if(!response.ok){const error=await response.json().catch(()=>({}));notification.error({message:error.message||'حذف نامه انجام نشد'});return}
    notification.success({message:'نامه حذف شد'});setViewModal(false);setLetterDetail(null);await fetchLetters(true)
  }

  const handlePrintLetter=(includeTemplate=true)=>{
    const letterElement=document.getElementById('saved-letter-print')
    const referralElement=document.getElementById('referral-print')
    if(!letterElement||!letterDetail)return
    const clone=letterElement.cloneNode(true) as HTMLElement
    if(!includeTemplate)clone.style.backgroundImage='none'
    clone.style.boxShadow='none'
    clone.style.zoom='1'
    const popup=window.open('','_blank')
    if(!popup){notification.error({message:'مرورگر پنجره چاپ را مسدود کرده است'});return}
    const paper=printSettings.paperSize==='auto'?(letterDetail.paperSize==='A5'?'A5':'A4'):printSettings.paperSize
    const referrals=printSettings.includeReferrals&&referralElement?`<div class="referrals">${referralElement.outerHTML}</div>`:''
    popup.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>${letterDetail.letterNumber||'نامه'} - چاپ</title><style>@page{size:${paper} ${printSettings.orientation};margin:${printSettings.margin}mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:IRANSans,Tahoma,sans-serif}.referrals{page-break-before:always;padding:15mm}.no-print-shadow{box-shadow:none!important}@media print{button{display:none!important}}</style></head><body>${clone.outerHTML}${referrals}</body></html>`)
    popup.document.close();popup.focus();popup.onafterprint=()=>popup.close()
    setTimeout(()=>popup.print(),800)
  }

  const handleSaveLetter = async (data: Record<string, any>) => {
    try {
      const typeMap: Record<string, string> = { internal: 'Internal', incoming: 'Incoming', outgoing: 'Outgoing' }
      const statusMap: Record<string, string> = { draft: 'Draft', sent: 'Sent', signed: 'Signed', cancelled: 'Cancelled' }
      const priorityMap: Record<string, string> = { 'عادی': 'Normal', 'فوری': 'High', 'خیلی فوری': 'Urgent', 'آنی': 'Urgent' }

      const body = {
        subject: data.subject || 'بدون موضوع',
        body: data.body || '',
        type: typeMap[data.letterType] || 'Internal',
        status: statusMap[data.status] || 'Draft',
        priority: priorityMap[data.priority] || 'Normal',
        classification: data.classification || 'normal',
        letterDate: new Date().toISOString(),
        toExternalName: data.toExternal || null,
        toExternalOrg: data.toExternalOrg || null,
        incomingNumber: data.incomingNumber || null,
        incomingDate: data.incomingDate || null,
        incomingFromOrg: data.fromOrg || null,
        referenceNumber: data.referenceNumber || null,
        referenceDate: data.referenceDate || null,
        referenceType: data.referenceType || null,
        folderName: data.folder || null,
        letterTemplateId: data.letterTemplateId || null,
        templateKey: data.templateKey || null,
        paperSize: data.paperSize || 'A4',
        templateHasHeader: data.hasHeader !== false,
        templateHasFooter: data.hasFooter !== false,
        clientRequestId:data.clientRequestId,
        recipients: data.recipients?.map((r: any) => ({
          userId: r.type === 'internal' ? r.personId || null : null,
          userName: r.name,
          externalName: r.type === 'external' ? r.name : null,
          externalOrg: r.organization || null,
          recipientType: 'To',
          referralType: r.referralType || 'اصل',
          referralText: r.referralText || null
          ,contactId: r.type === 'external' ? r.personId || null : null
          ,phoneNumber: r.phoneNumber || null
          ,sendSms: !!r.sendSms
        })) || []
      }

      const res = await apiFetch(editingDraft ? `${API}/letters/${editingDraft.id}` : `${API}/letters`, { method: editingDraft ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      const result = await res.json()
      if (!res.ok) { notification.error({ message: result.message || 'خطا در ذخیره نامه' }); return false }

      notification.success({ message: result.letterNumber ? `نامه با شماره ${result.letterNumber} ثبت شد` : 'پیش‌نویس ذخیره شد' })
      setComposing(false)
      setEditingDraft(null)
      navigate('/letters')
      fetchLetters()
      return true
    } catch {
      notification.error({ message: 'خطا در اتصال به سرور' })
      return false
    }
  }

  const applyFilters = (ls: Letter[], f: SearchFilters) => {
    return ls.filter(l => {
      const kw = f.keyword.toLowerCase()
      if (f.trackingId && !String(l.trackingCode ?? '').includes(f.trackingId.trim())) return false
      if (f.letterNumber && !l.letterNumber?.includes(f.letterNumber)) return false
      if (f.type && l.type !== f.type) return false
      if (f.status && l.status !== f.status) return false
      if (f.fromUser && !l.fromUserName?.toLowerCase().includes(f.fromUser.toLowerCase())) return false
      if (f.keyword && !l.subject?.toLowerCase().includes(kw) && !l.fromUserName?.toLowerCase().includes(kw)) return false
      return true
    })
  }

  const tabFilteredLetters = letters.filter(l => isRegistry ? (
    activeTab === 'all' ||
    (activeTab === 'incoming' && l.type === 'Incoming') ||
    (activeTab === 'outgoing' && l.type === 'Outgoing') ||
    (activeTab === 'draft' && l.status === 'Draft') ||
    (activeTab === 'archived' && l.status === 'Archived')
  ) : (
    activeTab === 'all' ||
    (activeTab === 'inbox' && l.isInbox && l.status !== 'Draft') ||
    (activeTab === 'incoming' && l.isInbox && l.status !== 'Draft' && l.type === 'Incoming') ||
    (activeTab === 'outgoing' && l.isSender && l.status !== 'Draft') ||
    (activeTab === 'draft' && l.isSender && l.status === 'Draft') ||
    (activeTab === 'archived' && l.status === 'Archived')
  ))

  const filteredLetters = applyFilters(tabFilteredLetters, searchFilters)
  const unreadCount = letters.filter(l => !l.isRead && (isReferrals ? l.referralDirection === 'incoming' : l.isInbox && l.status !== 'Draft')).length

  const columns = [
    {
      title: '', key: 'read', width: 16,
      render: (_: unknown, r: Letter) => !r.isRead && !r.isSender ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B1A6B' }} /> : null
    },
    {
      title: 'کد رهگیری', dataIndex: 'trackingCode', key: 'tracking', width: 100,
      render: (trackingCode: number) => (
        <Tooltip title="کلیک برای کپی">
          <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 12, cursor: 'pointer', minWidth: 48, textAlign: 'center' }} onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(String(trackingCode)) }}>
            {trackingCode ?? '—'}
          </Tag>
        </Tooltip>
      )
    },
    {
      title: 'موضوع', dataIndex: 'subject', key: 'subject',
      render: (s: string, r: Letter) => (
        <div>
          <div style={{ fontWeight: r.isRead ? 400 : 700, fontSize: 13 }}>{s}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.fromUserName}{r.hasAttachment && <span style={{ marginRight: 6 }}>📎</span>}</div>
        </div>
      )
    },
    {
      title: 'شماره', dataIndex: 'letterNumber', key: 'letterNumber', width: 130,
      render: (n: string) => n ? <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 11 }}>{n}</Tag> : <Tag color="default">پیش‌نویس</Tag>
    },
    { title: 'نوع', dataIndex: 'type', key: 'type', width: 80, render: (t: string) => <Tag color={TYPE_LABELS[t]?.color}>{TYPE_LABELS[t]?.label}</Tag> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 110, render: (s: string) => <Tag color={STATUS_LABELS[s]?.color}>{STATUS_LABELS[s]?.label}</Tag> },
    { title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 90, render: (p: string) => <Tag color={PRIORITY_LABELS[p]?.color}>{PRIORITY_LABELS[p]?.label}</Tag> },
    { title: 'تاریخ', dataIndex: 'createdAt', key: 'date', width: 110, render: (d: string) => <span style={{ fontSize: 11, color: '#8c8c8c' }}>{d ? new Intl.DateTimeFormat('fa-IR').format(new Date(d)) : '—'}</span> },
    {
      title: 'عملیات', key: 'actions', width: 130,
      render: (_: unknown, r: Letter) => (
        <Space onClick={e => e.stopPropagation()}>
          <Tooltip title="مشاهده"><Button size="small" icon={<EyeOutlined />} onClick={() => handleViewLetter(r)} /></Tooltip>
          {allowed('letters.edit') && r.status === 'Draft' && r.isSender && <Tooltip title="ادامه ویرایش پیش‌نویس"><Button size="small" type="primary" icon={<EditOutlined />} onClick={async()=>{const res=await apiFetch(`${API}/letters/${r.id}`,{headers:authHeaders()});if(res.ok){setEditingDraft(await res.json());setComposing(true);setViewModal(false)}}}/></Tooltip>}
          {allowed('letters.archive') && r.status !== 'Archived' && <Tooltip title="بایگانی"><Button size="small" icon={<FolderOutlined />} onClick={() => handleArchive(r.id)} /></Tooltip>}
          {allowed('letters.sign') && r.isSender && r.status === 'Sent' && <Tooltip title="امضا"><Button size="small" icon={<FileTextOutlined />} style={{ color: '#13c2c2', borderColor: '#13c2c2' }} onClick={() => handleSign(r.id)} /></Tooltip>}
          {allowed('letters.delete') && <Popconfirm title="این نامه حذف شود؟" okText="حذف" cancelText="انصراف" onConfirm={()=>handleDeleteLetter(r.id)}><Tooltip title="حذف"><Button size="small" danger icon={<DeleteOutlined/>}/></Tooltip></Popconfirm>}
        </Space>
      )
    },
  ]

  const referralColumns = [
    { title: 'موضوع نامه', dataIndex: 'subject', key: 'subject', render: (subject: string, row: Letter) => <div><strong>{subject}</strong><div style={{ fontSize: 11, color: '#888' }}>{row.letterNumber || 'بدون شماره'}</div></div> },
    { title: 'نوع ارجاع', dataIndex: 'referralType', key: 'referralType', width: 130, render: (value: string) => <Tag color="purple">{value || 'ارجاع'}</Tag> },
    { title: 'فرستنده ارجاع', dataIndex: 'referredByName', key: 'referredByName', width: 150 },
    { title: 'گیرنده ارجاع', dataIndex: 'referredToName', key: 'referredToName', width: 150 },
    { title: 'جهت', dataIndex: 'referralDirection', key: 'referralDirection', width: 90, render: (value: string) => <Tag color={value === 'incoming' ? 'green' : 'blue'}>{value === 'incoming' ? 'دریافتی' : 'ارسالی'}</Tag> },
    { title: 'متن ارجاع', dataIndex: 'referralText', key: 'referralText', ellipsis: true },
    { title: 'تاریخ', dataIndex: 'referralCreatedAt', key: 'referralCreatedAt', width: 110, render: (value: string) => value ? new Intl.DateTimeFormat('fa-IR').format(new Date(value)) : '—' },
    { title: 'مشاهده', key: 'view', width: 80, render: (_: unknown, row: Letter) => <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewLetter(row)} /> },
  ]

  if (composing) {
    return <LetterComposePage initialData={editingDraft} onSave={handleSaveLetter} onCancel={() => { setComposing(false); setEditingDraft(null); navigate('/letters') }} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{isRegistry?'📚 دبیرخانه — همه نامه‌های سازمان':isReferrals?'↩️ ارجاعات من':isDrafts?'📝 پیش‌نویس‌های من':'📬 کارتابل نامه'}</span>
        <Space><Button icon={<SyncOutlined/>} onClick={()=>fetchLetters()} loading={loading}>به‌روزرسانی</Button>{allowed('letters.create') && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setComposing(true); navigate('/letters/new') }} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>نامه جدید</Button>}</Space>
      </div>

      <AdvancedSearch onSearch={f => setSearchFilters(f)} onReset={() => setSearchFilters(EMPTY_FILTERS)} />

      {!isReferrals && <Tabs activeKey={activeTab} onChange={setActiveTab} items={(isRegistry?[
        { key: 'all', label: <span><MailOutlined /> همه نامه‌ها <Badge count={letters.length} style={{ background: '#8B1A6B' }} /></span> },
        { key: 'incoming', label: <span>📥 وارده</span> },
        { key: 'outgoing', label: <span><SendOutlined /> صادره</span> },
        { key: 'draft', label: <span><FileTextOutlined /> پیش‌نویس‌ها</span> },
        { key: 'archived', label: <span><FolderOutlined /> بایگانی</span> },
      ]:[
        { key: 'all', label: <span><MailOutlined /> همه <Badge count={letters.length} style={{ background: '#8B1A6B' }} /></span> },
        { key: 'inbox', label: <span><InboxOutlined /> کارتابل <Badge count={unreadCount} style={{ background: '#f5222d' }} /></span> },
        { key: 'incoming', label: <span>📥 وارده</span> },
        { key: 'outgoing', label: <span><SendOutlined /> صادره</span> },
        { key: 'draft', label: <span><FileTextOutlined /> پیش‌نویس</span> },
        { key: 'archived', label: <span><FolderOutlined /> بایگانی</span> },
      ])} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>{filteredLetters.length} نامه</span>
      </div>

      <Table columns={isReferrals ? referralColumns : columns} dataSource={filteredLetters} rowKey={row => isReferrals ? `${row.id}-${row.referralCreatedAt}-${row.referredToName}` : row.id} loading={loading} size="small" scroll={{ x: isReferrals ? 1200 : 1000 }}
        onRow={r => ({ onClick: () => handleViewLetter(r), style: { cursor: 'pointer' } })} />

      {/* Modal مشاهده نامه */}
      <Modal
        title={selectedLetter && (
          <Space>
            <Tag color={TYPE_LABELS[selectedLetter.type]?.color}>{TYPE_LABELS[selectedLetter.type]?.label}</Tag>
            {selectedLetter.letterNumber
              ? <Tag color="purple" style={{ fontFamily: 'monospace' }}>{selectedLetter.letterNumber}</Tag>
              : <Tag color="default">پیش‌نویس</Tag>
            }
            <span>{selectedLetter.subject}</span>
          </Space>
        )}
        open={viewModal} onCancel={() => { setViewModal(false); setLetterDetail(null) }}
        footer={letterDetail ? (
          <Space>
            {allowed('letters.edit') && letterDetail.status === 'Draft' && <Button type="primary" icon={<EditOutlined />} onClick={()=>{setEditingDraft(letterDetail);setViewModal(false);setComposing(true)}}>ادامه ویرایش</Button>}
            {allowed('letters.refer') && <Button
              icon={<SwapLeftOutlined />}
              style={{ background: '#fa8c16', color: 'white', borderColor: '#fa8c16' }}
              onClick={() => setReferModal(true)}
            >
              ارجاع
            </Button>}
            {allowed('letters.sign') && letterDetail.status === 'Sent' && (
              <Button icon={<FileTextOutlined />} style={{ color: '#13c2c2', borderColor: '#13c2c2' }} onClick={() => handleSign(letterDetail.id)}>امضا</Button>
            )}
            {allowed('letters.archive') && letterDetail.status !== 'Archived' && (
              <Button icon={<FolderOutlined />} onClick={() => handleArchive(letterDetail.id)}>بایگانی</Button>
            )}
            {allowed('letters.print') && <Button icon={<PrinterOutlined />} onClick={()=>handlePrintLetter(true)}>چاپ کامل</Button>}
            {allowed('letters.print') && <Button icon={<PrinterOutlined />} onClick={()=>handlePrintLetter(false)}>چاپ روی سربرگ فیزیکی</Button>}
            {allowed('letters.print') && <Button icon={<SettingOutlined/>} onClick={()=>setPrintSettingsOpen(true)}>تنظیمات چاپ</Button>}
            {allowed('letters.delete') && <Popconfirm title="این نامه حذف شود؟" okText="حذف" cancelText="انصراف" onConfirm={()=>handleDeleteLetter(letterDetail.id)}><Button danger icon={<DeleteOutlined/>}>حذف</Button></Popconfirm>}
            <Button onClick={() => setViewModal(false)}>بستن</Button>
          </Space>
        ) : null}
        width={980}
        styles={{body:{maxHeight:'76vh',overflowY:'auto'}}}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>در حال بارگذاری...</div>
        ) : letterDetail && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'230px minmax(0,1fr)',gap:12,alignItems:'start',direction:'ltr'}}>
              <aside style={{direction:'rtl',position:'sticky',top:0,maxHeight:'75vh',overflowY:'auto',padding:12,background:'#fafafa',border:'1px solid #eee',borderRadius:10}}>
                <ReferralMessages detail={letterDetail}/>
              </aside>
              <main style={{direction:'rtl',overflowX:'auto',padding:6,background:'#f5f5f5',borderRadius:10}}>
                <SavedLetterPage detail={letterDetail} compact/>
              </main>
            </div>

            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 14px', margin:'16px 0', border: '1px solid #e8e8e8' }}>
              <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:12}}>
                <span><strong>کد رهگیری:</strong> {letterDetail.trackingCode}</span>
                <span><strong>نوع:</strong> {TYPE_LABELS[letterDetail.type]?.label}</span>
                <span><strong>وضعیت:</strong> {STATUS_LABELS[letterDetail.status]?.label}</span>
              </div>
            </div>

            {letterDetail.workflowSteps?.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>تاریخچه گردش نامه:</div>
                {letterDetail.workflowSteps.map((w: any) => (
                  <div key={w.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <Avatar size={24} style={{ background: '#8B1A6B', fontSize: 11 }}>{w.userName?.charAt(0) || '?'}</Avatar>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: 12 }}>{w.userName}</span>
                      <span style={{ fontSize: 11, color: '#8c8c8c', margin: '0 8px' }}>{w.comment}</span>
                      <span style={{ fontSize: 10, color: '#bbb' }}>{w.createdAt ? new Intl.DateTimeFormat('fa-IR').format(new Date(w.createdAt)) : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal title={<Space><PrinterOutlined/><span>تنظیمات چاپ</span></Space>} open={printSettingsOpen} onCancel={()=>setPrintSettingsOpen(false)} onOk={()=>{localStorage.setItem('letter-print-settings',JSON.stringify(printSettings));setPrintSettingsOpen(false);notification.success({message:'تنظیمات چاپ ذخیره شد'})}} okText="ذخیره تنظیمات" cancelText="انصراف" width={480}>
        <Form layout="vertical">
          <Form.Item label="اندازه کاغذ"><Select value={printSettings.paperSize} onChange={paperSize=>setPrintSettings(current=>({...current,paperSize}))} options={[{value:'auto',label:'مطابق قالب نامه'},{value:'A4',label:'A4'},{value:'A5',label:'A5'}]}/></Form.Item>
          <Form.Item label="جهت چاپ"><Select value={printSettings.orientation} onChange={orientation=>setPrintSettings(current=>({...current,orientation}))} options={[{value:'portrait',label:'عمودی'},{value:'landscape',label:'افقی'}]}/></Form.Item>
          <Form.Item label="حاشیه چاپ"><Select value={printSettings.margin} onChange={margin=>setPrintSettings(current=>({...current,margin}))} options={[{value:0,label:'بدون حاشیه'},{value:5,label:'۵ میلی‌متر'},{value:10,label:'۱۰ میلی‌متر'},{value:15,label:'۱۵ میلی‌متر'}]}/></Form.Item>
          <Checkbox checked={printSettings.includeReferrals} onChange={event=>setPrintSettings(current=>({...current,includeReferrals:event.target.checked}))}>پیام‌های ارجاع نیز چاپ شوند</Checkbox>
          <div style={{marginTop:14,padding:10,borderRadius:8,background:'#f6ffed',color:'#3f6600',fontSize:11}}>پس از زدن دکمه چاپ، پنجره استاندارد چاپ سیستم باز می‌شود و می‌توانید هر پرینتر نصب‌شده، شبکه‌ای یا اشتراکی شرکت را انتخاب کنید.</div>
        </Form>
      </Modal>

      {/* Modal ارجاع */}
      <Modal
        title={<Space><SwapLeftOutlined style={{ color: '#fa8c16' }} /><span>ارجاع نامه</span></Space>}
        open={referModal}
        onCancel={() => { setReferModal(false); referForm.resetFields() }}
        onOk={() => referForm.validateFields().then(handleRefer)}
        okText="ارجاع دهید" cancelText="انصراف"
        okButtonProps={{ loading:referLoading, style: { background: '#fa8c16', borderColor: '#fa8c16' } }}
        width={500}
      >
        <Form form={referForm} layout="vertical">
          <Form.Item name="toPerson" label="ارجاع به" rules={[{ required: true, message: 'انتخاب گیرنده الزامی است' }]}>
            <Select showSearch placeholder="انتخاب شخص" size="large">
              {users.map(u => (
                <Select.Option key={`user:${u.id}`} value={`user:${u.id}`}>
                  <Space>
                    <Avatar size={22} icon={<MailOutlined />} style={{ background: '#1677ff' }} />
                    {u.fullName}
                    {u.position && <span style={{ fontSize: 11, color: '#8c8c8c' }}>— {u.position}</span>}
                  </Space>
                </Select.Option>
              ))}
              {contacts.map(c=><Select.Option key={`contact:${c.id}`} value={`contact:${c.id}`}><Space><Avatar size={22} icon={<MailOutlined/>}/>{c.fullName}<span style={{fontSize:11,color:'#888'}}>— {c.companyName||'مخاطب'}</span></Space></Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="referralType" label="نوع ارجاع" initialValue="جهت اقدام">
            <Select size="large">
              {REFERRAL_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="referralText" label="متن ارجاع" rules={[{required:true,message:'متن ارجاع الزامی است'},{max:2000,message:'حداکثر ۲۰۰۰ کاراکتر'}]}>
            <Input.TextArea rows={4} placeholder="متن ارجاع را بنویسید..." />
          </Form.Item>
          <Form.Item name="sendSms" valuePropName="checked"><Checkbox>برای گیرنده پیامک ارجاع ارسال شود</Checkbox></Form.Item>
        </Form>
        <div style={{ padding: '8px 12px', background: '#fff7e6', borderRadius: 8, fontSize: 12, color: '#8c8c8c', border: '1px solid #ffd591', marginTop: 12 }}>
          ⚠️ پس از ارجاع، این شخص در لیست گیرندگان نامه اضافه می‌شود.
        </div>
      </Modal>
    </div>
  )
}
