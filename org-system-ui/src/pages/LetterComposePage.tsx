import { useState, useRef, useEffect } from 'react'
import { Form, Input, Select, Button, Tag, Space, Modal, Switch, Upload, List, Dropdown, Tabs, Avatar, Empty, Steps, Divider, Row, Col, Tooltip, Table, Radio, Checkbox } from 'antd'
import {
  SaveOutlined, PrinterOutlined, StopOutlined,
  CheckCircleOutlined, ArrowRightOutlined, FileTextOutlined,
  PaperClipOutlined, DeleteOutlined, UploadOutlined, DownOutlined,
  BoldOutlined, ItalicOutlined, UnderlineOutlined, OrderedListOutlined,
  UnorderedListOutlined as ULOutlined, AlignRightOutlined, AlignCenterOutlined,
  AlignLeftOutlined, FontColorsOutlined, PlusOutlined, UserOutlined,
  EyeOutlined, HistoryOutlined, TeamOutlined, LinkOutlined, SwapLeftOutlined
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { apiFetch } from '../utils/api'

const API = 'http://localhost:5043/api/v1'
const getToken = () => localStorage.getItem('token') || ''
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` })

const REGISTRIES = [
  { id: '1', name: 'دبیرخانه مرکزی', type: 'internal', prefix: 'د', counter: 153 },
  { id: '2', name: 'دبیرخانه مرکزی', type: 'incoming', prefix: 'و', counter: 49 },
  { id: '3', name: 'دبیرخانه مرکزی', type: 'outgoing', prefix: 'ص', counter: 96 },
]

const CLASSIFICATIONS = [
  { value: 'normal', label: 'عادی', color: '#52c41a' },
  { value: 'confidential', label: 'محرمانه', color: '#fa8c16' },
  { value: 'secret', label: 'سری', color: '#f5222d' },
  { value: 'top_secret', label: 'خیلی سری', color: '#722ed1' },
]

const PRIORITIES = [
  { value: 'عادی', color: '#8c8c8c' },
  { value: 'فوری', color: '#fa8c16' },
  { value: 'خیلی فوری', color: '#f5222d' },
  { value: 'آنی', color: '#722ed1' },
]

const REFERRAL_TYPES = ['اصل', 'رونوشت', 'تصویر', 'جهت اطلاع', 'جهت اقدام', 'جهت بایگانی', 'جهت تأیید']

const TEMPLATES = [
  { id: 'official-a4', name: 'قالب رسمی A4', size: 'A4', hasHeader: true, hasFooter: true },
  { id: 'official-a5', name: 'قالب رسمی A5', size: 'A5', hasHeader: true, hasFooter: true },
  { id: 'plain-a4', name: 'قالب ساده A4', size: 'A4', hasHeader: false, hasFooter: false },
  { id: 'plain-a5', name: 'قالب ساده A5', size: 'A5', hasHeader: false, hasFooter: false },
]

interface Recipient {
  id: string
  name: string
  organization?: string
  type: 'internal' | 'external'
  referralType: string
  referralText?: string
  personId?: string
  phoneNumber?: string
  sendSms?: boolean
}

interface ApiUser {
  id: string
  fullName: string
  position?: string
  phoneNumber?: string
  signatureDataUrl?: string
  signatureText?: string
}
interface ApiContact { id: string; fullName: string; companyName?: string; jobTitle?: string; mobile?: string; phone?: string }

export interface LetterComposeProps {
  onSave: (data: Record<string, any>) => Promise<boolean>
  onCancel: () => void
  initialData?: any
}

function RichEditor({ onChange, initialHtml = '' }: { onChange: (html: string) => void; initialHtml?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current && ref.current.innerHTML !== initialHtml) ref.current.innerHTML = initialHtml }, [initialHtml])
  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    if (ref.current) onChange(ref.current.innerHTML)
  }
  const colors = ['#000', '#f5222d', '#1677ff', '#52c41a', '#fa8c16', '#722ed1']

  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '5px 8px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap', alignItems: 'center' }}>
        <Tooltip title="بولد"><Button size="small" icon={<BoldOutlined />} onClick={() => exec('bold')} /></Tooltip>
        <Tooltip title="ایتالیک"><Button size="small" icon={<ItalicOutlined />} onClick={() => exec('italic')} /></Tooltip>
        <Tooltip title="زیرخط"><Button size="small" icon={<UnderlineOutlined />} onClick={() => exec('underline')} /></Tooltip>
        <Divider type="vertical" />
        <Tooltip title="لیست"><Button size="small" icon={<ULOutlined />} onClick={() => exec('insertUnorderedList')} /></Tooltip>
        <Tooltip title="لیست شماره‌دار"><Button size="small" icon={<OrderedListOutlined />} onClick={() => exec('insertOrderedList')} /></Tooltip>
        <Divider type="vertical" />
        <Tooltip title="راست‌چین"><Button size="small" icon={<AlignRightOutlined />} onClick={() => exec('justifyRight')} /></Tooltip>
        <Tooltip title="وسط"><Button size="small" icon={<AlignCenterOutlined />} onClick={() => exec('justifyCenter')} /></Tooltip>
        <Tooltip title="چپ‌چین"><Button size="small" icon={<AlignLeftOutlined />} onClick={() => exec('justifyLeft')} /></Tooltip>
        <Divider type="vertical" />
        <Dropdown trigger={['click']} dropdownRender={() => (
          <div style={{ background: 'white', padding: 8, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', gap: 6 }}>
            {colors.map(c => <div key={c} onClick={() => exec('foreColor', c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: '2px solid white', boxShadow: '0 0 0 1px #d9d9d9' }} />)}
          </div>
        )}>
          <Tooltip title="رنگ متن"><Button size="small" icon={<FontColorsOutlined />} /></Tooltip>
        </Dropdown>
        <Divider type="vertical" />
        <Select size="small" defaultValue="3" style={{ width: 65 }} onChange={v => exec('fontSize', v)}>
          {['1','2','3','4','5','6','7'].map(s => <Select.Option key={s} value={s}>{['8','10','12','14','18','24','36'][+s-1]}</Select.Option>)}
        </Select>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={e => onChange(e.currentTarget.innerHTML)}
        suppressContentEditableWarning
        style={{ minHeight: 280, padding: 14, fontSize: 14, lineHeight: 2.2, fontFamily: 'Vazirmatn, Tahoma', textAlign: 'justify', outline: 'none', direction: 'rtl' }}
      />
    </div>
  )
}

export default function LetterComposePage({ onSave, onCancel, initialData }: LetterComposeProps) {
  const [form] = Form.useForm()
  const [saving,setSaving]=useState(false)
  const clientRequestId=useRef(crypto.randomUUID())
  const [users, setUsers] = useState<ApiUser[]>([])
  const [contacts, setContacts] = useState<ApiContact[]>([])
  const [letterType, setLetterType] = useState<'internal' | 'incoming' | 'outgoing'>('internal')
  const [registry, setRegistry] = useState(REGISTRIES[0])
  const [paperSize, setPaperSize] = useState('A4')
  const [hasHeader, setHasHeader] = useState(true)
  const [hasFooter, setHasFooter] = useState(true)
  const [hasSignature, setHasSignature] = useState(true)
  const [classification, setClassification] = useState('normal')
  const [priority, setPriority] = useState('عادی')
  const [bodyHtml, setBodyHtml] = useState('')
  const [attachments, setAttachments] = useState<UploadFile[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientModal, setRecipientModal] = useState(false)
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null)
  const [printModal, setPrintModal] = useState(false)
  const [printMode, setPrintMode] = useState<'full' | 'minimal'>('full')
  const [referralModal, setReferralModal] = useState(false)
  const [referralFiles, setReferralFiles] = useState<UploadFile[]>([])
  const [recipientForm] = Form.useForm()
  const [referralForm] = Form.useForm()
  const [selectedTemplate, setSelectedTemplate] = useState<any>()
  const [availableTemplates,setAvailableTemplates]=useState<any[]>(TEMPLATES)
  const watchedSubject = Form.useWatch('subject', form)
  const watchedFrom = Form.useWatch('fromUser', form)
  const watchedToUser = Form.useWatch('toUser', form)
  const watchedToExternal = Form.useWatch('toExternal', form)
  const watchedDate = Form.useWatch('letterDate', form)
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
  const signer = users.find(x => x.id === currentUser.id)
  const signerName = currentUser.fullName || watchedFrom || ''
  const grantedPermissions:string[] = (()=>{try{return JSON.parse(localStorage.getItem('permissions')||'[]')}catch{return []}})()
  const isAdmin = Array.isArray(currentUser.roles) && currentUser.roles.includes('Admin')
  const allowed = (code:string) => isAdmin || grantedPermissions.includes(code)
  const structuralFieldsLocked = Boolean(initialData)
  const recipientsLocked = Boolean(initialData && initialData.status !== 'Draft')

  useEffect(() => {
    Promise.all([
      apiFetch(`${API}/directory`, { headers: authHeaders() }),
      apiFetch(`${API}/letter-templates`,{headers:authHeaders()})
    ]).then(async([directoryResponse,t])=>{
      const directory=directoryResponse.ok?await directoryResponse.json():{users:[],contacts:[]}
      setUsers(directory.users||[])
      setContacts(directory.contacts||[])
      const me=(directory.users||[]).find((user:ApiUser&{id:string})=>user.id===currentUser.id)
      if(!initialData)form.setFieldValue('fromUser',me?.fullName||currentUser.fullName||currentUser.username)
      const stored=t.ok?await t.json():[]
      const merged=TEMPLATES.map(base=>{
        const db=stored.find((x:any)=>x.templateKey===base.id)
        return db?{...base,...db,databaseId:db.id,id:db.templateKey,size:db.paperSize}:base
      })
      setAvailableTemplates(merged)
      const initialKey=initialData?.templateKey || initialData?.template?.templateKey || 'official-a4'
      const chosen=merged.find((x:any)=>x.id===initialKey) || merged[0]
      setSelectedTemplate(chosen)
      if(chosen){setPaperSize(chosen.size);setHasHeader(chosen.hasHeader);setHasFooter(chosen.hasFooter)}
    }).catch(()=>{})
    if (!initialData) {
      const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date())
      const get = (type:string) => parts.find(x=>x.type===type)?.value || ''
      form.setFieldValue('letterDate', `${get('year')}/${get('month')}/${get('day')}`)
    }
  }, [])

  useEffect(() => {
    if (!initialData) return
    const type = String(initialData.type || 'Internal').toLowerCase() as 'internal'|'incoming'|'outgoing'
    setLetterType(type); setRegistry(REGISTRIES.find(r=>r.type===type) || REGISTRIES[0])
    setBodyHtml(initialData.body || ''); setClassification(initialData.classification || 'normal')
    const recipient = initialData.recipients?.find((r:any)=>r.userId)
    form.setFieldsValue({ subject:initialData.subject, fromUser:initialData.fromUserName, letterDate:initialData.letterDate ? new Intl.DateTimeFormat('fa-IR-u-nu-latn').format(new Date(initialData.letterDate)).replace(/-/g,'/') : undefined, toUser:recipient?.userId, toExternal:initialData.toExternalName, toExternalOrg:initialData.toExternalOrg, incomingNumber:initialData.incomingNumber, incomingDate:initialData.incomingDate })
  }, [initialData, form])

  const letterNumber = initialData?.letterNumber || `${registry.prefix}/جدید`
  const cls = CLASSIFICATIONS.find(c => c.value === classification)!

  const handleLetterTypeChange = (type: 'internal' | 'incoming' | 'outgoing') => {
    setLetterType(type)
    const reg = REGISTRIES.find(r => r.type === type)
    if (reg) setRegistry(reg)
    form.setFieldsValue({ toUser: undefined, toExternal: undefined, toExternalOrg: undefined })
  }

  const handleAction = async (status: string) => {
    if(saving)return
    try {
      const values = status === 'draft' ? form.getFieldsValue() : await form.validateFields()
      if(status!=='draft' && letterType==='internal' && !values.toUser) throw new Error('انتخاب گیرنده داخلی الزامی است')
      if(status!=='draft' && letterType!=='internal' && !values.toExternal) throw new Error('انتخاب مخاطب گیرنده الزامی است')
      const primary: Recipient[]=[]
      if(letterType==='internal'&&values.toUser){const u=users.find(x=>x.id===values.toUser);if(u)primary.push({id:`primary-${u.id}`,personId:u.id,name:u.fullName,type:'internal',referralType:'اصل',phoneNumber:u.phoneNumber,sendSms:!!values.sendPrimarySms})}
      if(letterType!=='internal'&&values.toExternal){const c=contacts.find(x=>x.id===values.toExternal);if(c)primary.push({id:`primary-${c.id}`,personId:c.id,name:c.fullName,organization:c.companyName,type:'external',referralType:'اصل',phoneNumber:c.mobile||c.phone,sendSms:!!values.sendPrimarySms})}
      setSaving(true)
      await onSave({ ...values, toExternal:contacts.find(x=>x.id===values.toExternal)?.fullName||values.toExternal, toExternalOrg:contacts.find(x=>x.id===values.toExternal)?.companyName||values.toExternalOrg, status, paperSize, hasHeader, hasFooter, hasSignature, classification, priority, body: bodyHtml, attachments, recipients:[...primary,...recipients.filter(r=>!primary.some(p=>p.personId===r.personId))], letterType, letterNumber, clientRequestId:clientRequestId.current, letterTemplateId:selectedTemplate?.databaseId||null, templateKey:selectedTemplate?.templateKey||selectedTemplate?.id })
    } catch(error) {
      Modal.warning({title:'اطلاعات نامه کامل نیست',content:error instanceof Error?error.message:'فیلدهای الزامی را کامل کنید'})
    } finally { setSaving(false) }
  }

  const handleCancelLetter = () => {
    if (!initialData?.id) { onCancel(); return }
    Modal.confirm({ title:'ابطال نامه', content:'این نامه ابطال شود؟ این عملیات در تاریخچه گردش ثبت می‌شود.', okText:'ابطال', cancelText:'انصراف', okButtonProps:{danger:true}, onOk:async()=>{
      const response=await apiFetch(`${API}/letters/${initialData.id}/cancel`,{method:'PATCH',headers:authHeaders()})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.message||'ابطال نامه انجام نشد')
      onCancel()
    }})
  }

  const getFileIcon = (name: string) => {
    if (name.endsWith('.pdf')) return '📄'
    if (name.match(/\.(doc|docx)$/)) return '📝'
    if (name.match(/\.(zip|rar)$/)) return '🗜️'
    if (name.match(/\.(jpg|jpeg|png|gif)$/)) return '🖼️'
    return '📎'
  }

  const openRecipientModal = (r?: Recipient) => {
    if (r) { setEditingRecipient(r); recipientForm.setFieldsValue(r) }
    else { setEditingRecipient(null); recipientForm.resetFields(); recipientForm.setFieldValue('referralType', 'اصل') }
    setRecipientModal(true)
  }

  const saveRecipient = () => {
    recipientForm.validateFields().then(values => {
      const [kind,id]=(values.personKey||'').split(':')
      const user=kind==='user'?users.find(x=>x.id===id):undefined,contact=kind==='contact'?contacts.find(x=>x.id===id):undefined
      const normalized={...values,personId:id,name:user?.fullName||contact?.fullName||values.name,type:kind==='user'?'internal':'external',organization:contact?.companyName||values.organization,phoneNumber:user?.phoneNumber||contact?.mobile||contact?.phone,sendSms:!!values.sendSms}
      if (editingRecipient) {
        setRecipients(prev => prev.map(r => r.id === editingRecipient.id ? { ...r, ...normalized } : r))
      } else {
        setRecipients(prev => [...prev, { id: Date.now().toString(), ...normalized }])
      }
      setRecipientModal(false)
    })
  }

  const handleSaveReferral = () => {
    referralForm.validateFields().then(values => {
      setRecipients(prev => [...prev, {
        id: Date.now().toString(),
        name: values.toUser,
        type: 'internal',
        referralType: values.referralType || 'جهت اقدام',
        referralText: values.referralText
      }])
      setReferralFiles([])
      referralForm.resetFields()
      setReferralModal(false)
    })
  }

  const pageMetrics = paperSize === 'A5'
    ? { width:'148mm', height:'210mm', x:'12mm', receiverTopWithTemplate:'36mm', metaTopWithTemplate:'36mm', subjectTopWithTemplate:'48mm', contentTopWithTemplate:'59mm', receiverTopPlain:'16mm', metaTopPlain:'16mm', subjectTopPlain:'28mm', contentTopPlain:'39mm', bottom:'20mm', signatureBottom:'22mm' }
    : { width:'210mm', height:'297mm', x:'20mm', receiverTopWithTemplate:'62mm', metaTopWithTemplate:'62mm', subjectTopWithTemplate:'76mm', contentTopWithTemplate:'89mm', receiverTopPlain:'22mm', metaTopPlain:'22mm', subjectTopPlain:'36mm', contentTopPlain:'49mm', bottom:'24mm', signatureBottom:'38mm' }

  const LetterPreview = ({ minimal = false }: { minimal?: boolean }) => {
    const v = form.getFieldsValue()
    const receiverText = letterType === 'internal' ? users.find(x=>x.id===v.toUser)?.fullName : contacts.find(x=>x.id===v.toExternal)?.fullName || v.toExternal
    const showTemplate = !minimal && !!selectedTemplate?.imageData
    const receiverTop=showTemplate?pageMetrics.receiverTopWithTemplate:pageMetrics.receiverTopPlain
    const metaTop=showTemplate?pageMetrics.metaTopWithTemplate:pageMetrics.metaTopPlain
    const subjectTop=showTemplate?pageMetrics.subjectTopWithTemplate:pageMetrics.subjectTopPlain
    const contentTop=showTemplate?pageMetrics.contentTopWithTemplate:pageMetrics.contentTopPlain
    return (
      <div id="letter-print" style={{ width:pageMetrics.width, minHeight:pageMetrics.height, margin:'0 auto', backgroundColor:'white', backgroundImage:showTemplate?`url(${selectedTemplate.imageData})`:undefined, backgroundSize:`${pageMetrics.width} ${pageMetrics.height}`, backgroundRepeat:'repeat-y', padding:`${contentTop} ${pageMetrics.x} ${pageMetrics.bottom}`, fontFamily:'IRANSans, Tahoma', direction:'rtl', boxSizing:'border-box', position:'relative', display:'flex', flexDirection:'column' }}>
        {classification !== 'normal' && <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center', color: cls.color, fontWeight: 700, fontSize: 13 }}>{cls.label}</div>}
        <div style={{ fontSize:paperSize==='A5'?10:12, position:'absolute', top:metaTop, left:pageMetrics.x, textAlign:'left' }}>
          <div><strong>تاریخ:</strong> {form.getFieldValue('letterDate') || '—'}</div>
          {letterNumber && <div><strong>شماره:</strong> {letterNumber}</div>}
          <div><strong>پیوست:</strong> {attachments.length ? 'دارد' : 'ندارد'}</div>
        </div>
        <div style={{fontSize:paperSize==='A5'?10:12,position:'absolute',top:receiverTop,right:pageMetrics.x}}><strong>گیرنده:</strong> {receiverText || '—'}</div>
        <div style={{position:'absolute',top:subjectTop,right:pageMetrics.x,left:pageMetrics.x,fontWeight:700,textAlign:'right',fontSize:paperSize==='A5'?12:15}}>{v.subject && <>موضوع: {v.subject}</>}</div>
        <div style={{ minHeight:paperSize==='A5'?120:200, fontSize:paperSize==='A5'?11:13, lineHeight:2.1, flex:'1 0 auto' }} dangerouslySetInnerHTML={{ __html: bodyHtml || 'متن نامه...' }} />
        {attachments.length > 0 && <div style={{ marginTop: 12, fontSize: 12 }}><strong>پیوست:</strong><ul style={{ paddingRight: 16 }}>{attachments.map((f, i) => <li key={i}>{getFileIcon(f.name)} {f.name}</li>)}</ul></div>}
        {hasSignature && <div style={{ marginTop:paperSize==='A5'?'12mm':'18mm', marginRight:'auto', width:paperSize==='A5'?'44mm':'58mm', textAlign:'center',fontSize:paperSize==='A5'?10:12,breakInside:'avoid',pageBreakInside:'avoid' }}><p style={{ fontWeight:600, marginBottom:4 }}>{signerName}</p>{signer?.signatureDataUrl && <img src={signer.signatureDataUrl} alt="امضا" style={{width:paperSize==='A5'?80:110,height:paperSize==='A5'?44:60,objectFit:'contain'}}/>}</div>}
        {!showTemplate && hasFooter && <div style={{position:'absolute',bottom:'8mm',left:pageMetrics.x,right:pageMetrics.x,borderTop:'1px solid #eee',paddingTop:8,textAlign:'center',fontSize:9,color:'#999'}}>این نامه با سیستم مدیریت اسناد سازمانی صادر شده است</div>}
      </div>
    )
  }

  const handlePrint = () => {
    const el = document.getElementById('letter-print')
    if (!el) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>چاپ نامه</title><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:IRANSans,Tahoma,sans-serif}@page{size:${paperSize} portrait;margin:0}#letter-print{width:${pageMetrics.width}!important;min-height:${pageMetrics.height}!important}.saved-letter-signature{break-inside:avoid;page-break-inside:avoid}</style></head><body>${el.outerHTML}</body></html>`)
    w.document.close()
    w.focus();w.onafterprint=()=>w.close();setTimeout(() => w.print(), 800)
  }

  const recipientColumns = [
    { title: '#', key: 'idx', width: 40, render: (_: unknown, __: unknown, i: number) => i + 1 },
    {
      title: 'گیرنده', dataIndex: 'name', key: 'name',
      render: (n: string, r: Recipient) => (
        <Space>
          <Avatar size={22} icon={<UserOutlined />} style={{ background: r.type === 'internal' ? '#1677ff' : '#722ed1' }} />
          {n}
          {r.organization && <Tag style={{ fontSize: 10 }}>{r.organization}</Tag>}
        </Space>
      )
    },
    { title: 'نوع ارجاع', dataIndex: 'referralType', key: 'referralType', render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: 'متن ارجاع', dataIndex: 'referralText', key: 'referralText', render: (t: string) => t || '—' },
    {
      title: 'عملیات', key: 'actions',
      render: (_: unknown, r: Recipient) => (
        <Space>
          <Button disabled={recipientsLocked} size="small" icon={<EyeOutlined />} onClick={() => openRecipientModal(r)} />
          <Button disabled={recipientsLocked} size="small" danger icon={<DeleteOutlined />} onClick={() => setRecipients(p => p.filter(x => x.id !== r.id))} />
        </Space>
      )
    }
  ]

  return (
    <div style={{ direction: 'rtl' }}>
      {/* نوار اول */}
      <div style={{ background: '#1e3a5f', padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', borderRadius: '8px 8px 0 0' }}>
        <Button icon={<ArrowRightOutlined />} size="small" onClick={onCancel} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }}>بازگشت</Button>
        <Divider type="vertical" style={{ background: 'rgba(255,255,255,0.2)', height: 20 }} />
        {allowed('letters.send') && (!initialData || initialData.status === 'Draft') && <Button loading={saving} disabled={saving} icon={<SaveOutlined />} size="small" onClick={() => handleAction('sent')} style={{ background: '#52c41a', color: 'white', border: 'none' }}>ذخیره و ارسال</Button>}
        {allowed('letters.sign') && (!initialData || initialData.status === 'Draft') && <Button loading={saving} disabled={saving} icon={<CheckCircleOutlined />} size="small" onClick={() => handleAction('signed')} style={{ background: '#13c2c2', color: 'white', border: 'none' }}>تأیید و امضا</Button>}
        {(initialData ? allowed('letters.edit') : allowed('letters.create')) && (!initialData || initialData.status === 'Draft') && <Button loading={saving} disabled={saving} icon={<SaveOutlined />} size="small" onClick={() => handleAction('draft')} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }}>ذخیره پیش‌نویس</Button>}
        {initialData && initialData.status !== 'Draft' && initialData.status !== 'Cancelled' && allowed('letters.edit') && <Button loading={saving} disabled={saving} icon={<SaveOutlined />} size="small" onClick={() => handleAction(String(initialData.status).toLowerCase())} style={{ background:'#1677ff',color:'white',border:'none' }}>ذخیره ویرایش</Button>}
        {allowed('letters.refer') && <Button icon={<SwapLeftOutlined />} size="small" onClick={() => setReferralModal(true)} style={{ background: '#fa8c16', color: 'white', border: 'none' }}>ارجاع</Button>}
        {allowed('letters.print') && <Dropdown menu={{
          items: [
            { key: 'full', label: 'چاپ کامل', icon: <PrinterOutlined />, onClick: () => { setPrintMode('full'); setPrintModal(true) } },
            { key: 'minimal', label: 'چاپ روی سربرگ فیزیکی', icon: <FileTextOutlined />, onClick: () => { setPrintMode('minimal'); setPrintModal(true) } },
          ]
        }}>
          <Button icon={<PrinterOutlined />} size="small" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }}>چاپ <DownOutlined /></Button>
        </Dropdown>}
        {allowed('letters.cancel') && initialData && initialData.status !== 'Cancelled' && <Button icon={<StopOutlined />} size="small" danger onClick={handleCancelLetter} style={{ border: 'none' }}>ابطال</Button>}
        <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 13, padding: '3px 10px' }}>{letterNumber}</Tag>
      </div>

      {/* نوار دوم */}
      <div style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', padding: '8px 16px' }}>
        <Form form={form} layout="inline">
          <Row gutter={[8, 8]} style={{ width: '100%' }} align="middle">
            <Col>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>نوع نامه</div>
              <Radio.Group disabled={structuralFieldsLocked} value={letterType} onChange={e => handleLetterTypeChange(e.target.value)} size="small" buttonStyle="solid">
                {(allowed('letters.type.outgoing') || letterType === 'outgoing') && <Radio.Button value="outgoing" disabled={!allowed('letters.type.outgoing')}>صادره</Radio.Button>}
                <Radio.Button value="internal">داخلی</Radio.Button>
                {(allowed('letters.type.incoming') || letterType === 'incoming') && <Radio.Button value="incoming" disabled={!allowed('letters.type.incoming')}>وارده</Radio.Button>}
              </Radio.Group>
            </Col>
            <Divider type="vertical" style={{ height: 40 }} />
            <Col>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>دبیرخانه</div>
              <Select disabled={structuralFieldsLocked} size="small" value={registry.id} popupMatchSelectWidth={260} style={{ width: 210 }} onChange={id => { const r = REGISTRIES.find(x => x.id === id); if (r) setRegistry(r) }}>
                {REGISTRIES.filter(r=>r.type===letterType).map(r => <Select.Option key={r.id} value={r.id}>{r.name} — {r.type === 'outgoing' ? 'صادره' : r.type === 'internal' ? 'داخلی' : 'وارده'}</Select.Option>)}
              </Select>
            </Col>
            <Col>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>تاریخ نامه</div>
              <Form.Item name="letterDate" style={{ margin: 0 }}>
                <Input disabled={structuralFieldsLocked} size="small" style={{ width: 110 }} placeholder="۱۴۰۳/۰۴/۱۵" />
              </Form.Item>
            </Col>
            <Col>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>طبقه‌بندی</div>
              <Select disabled={structuralFieldsLocked} size="small" value={classification} onChange={setClassification} style={{ width: 120 }}>
                {CLASSIFICATIONS.map(c => <Select.Option key={c.value} value={c.value}><span style={{ color: c.color }}>● </span>{c.label}</Select.Option>)}
              </Select>
            </Col>
            <Col>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>فوریت</div>
              <Select disabled={structuralFieldsLocked} size="small" value={priority} onChange={setPriority} style={{ width: 110 }}>
                {PRIORITIES.map(p => <Select.Option key={p.value} value={p.value}><span style={{ color: p.color }}>● </span>{p.value}</Select.Option>)}
              </Select>
            </Col>
            <Col>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>قالب</div>
              <Select disabled={structuralFieldsLocked} size="small" style={{ width: 180 }} placeholder="انتخاب قالب آپلودشده" allowClear
                onChange={id => { const t = availableTemplates.find((x:any) => x.id === id); setSelectedTemplate(t); if (t) { setPaperSize(t.size); setHasHeader(t.hasHeader); setHasFooter(t.hasFooter) } }}>
                {availableTemplates.map((t:any) => <Select.Option key={t.id} value={t.id}>{t.name}{t.imageData?' ✓':''}</Select.Option>)}
              </Select>
            </Col>
            <Col style={{ marginRight: 'auto', alignSelf: 'center' }}>
              <Form.Item name="sendPrimarySms" valuePropName="checked" style={{ margin: 0 }}><Checkbox>برای گیرنده اصلی پیامک ارسال شود</Checkbox></Form.Item>
            </Col>
          </Row>
        </Form>
      </div>

      {/* نوار سوم */}
      <div style={{ background: 'white', borderBottom: '1px solid #e8edf2', padding: '10px 16px' }}>
        <Form form={form} layout="inline">
          <Row gutter={[12, 8]} style={{ width: '100%' }} align="middle">
            <Col xs={24} md={5}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>فرستنده نامه</div>
              <Form.Item name="fromUser" style={{ margin: 0 }} rules={[{ required: true, message: 'الزامی' }]}>
                <Input size="small" readOnly value={currentUser.fullName||currentUser.username} />
              </Form.Item>
            </Col>
            <Col md={1} style={{ textAlign: 'center' }}>
              <SwapLeftOutlined style={{ color: '#1677ff', fontSize: 18, marginTop: 20 }} />
            </Col>
            <Col xs={24} md={6}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>
                گیرنده نامه {letterType === 'internal' ? '(داخلی)' : '(خارجی)'}
              </div>
              {letterType === 'internal' ? (
                <Form.Item name="toUser" style={{ margin: 0 }} rules={[{ required: true, message: 'الزامی' }]}>
                  <Select disabled={recipientsLocked} size="small" style={{ width: '100%' }} placeholder="انتخاب گیرنده" showSearch>
                    {users.map(u => <Select.Option key={u.id} value={u.id}>{u.fullName}</Select.Option>)}
                  </Select>
                </Form.Item>
              ) : (
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="toExternal" style={{ margin: 0, width: '55%' }} rules={[{ required: true, message: 'الزامی' }]}>
                    <Select disabled={recipientsLocked} size="small" showSearch optionFilterProp="label" placeholder="انتخاب مخاطب" options={contacts.map(c=>({value:c.id,label:`${c.fullName} — ${c.companyName||'مخاطب'}`}))}/>
                  </Form.Item>
                  <Form.Item name="toExternalOrg" style={{ margin: 0, width: '45%' }}>
                    <Input disabled={recipientsLocked} size="small" placeholder="سازمان" />
                  </Form.Item>
                </Space.Compact>
              )}
            </Col>
            {letterType === 'incoming' && (
              <Col xs={24} md={4}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>سازمان فرستنده</div>
                <Form.Item name="fromOrg" style={{ margin: 0 }}>
                  <Select size="small" showSearch allowClear placeholder="انتخاب سازمان/مخاطب" options={contacts.map(c=>({value:c.companyName||c.fullName,label:c.companyName||c.fullName}))}/>
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={letterType === 'incoming' ? 7 : 11}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>موضوع نامه *</div>
              <Form.Item name="subject" style={{ margin: 0 }} rules={[{ required: true, message: 'موضوع الزامی است' }]}>
                <Input size="small" placeholder="موضوع نامه را وارد کنید..." />
              </Form.Item>
            </Col>
          </Row>
          {letterType === 'incoming' && (
            <Row gutter={[12, 8]} style={{ width: '100%', marginTop: 8 }} align="middle">
              <Col xs={24} md={5}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>شماره نامه وارده</div>
                <Form.Item name="incomingNumber" style={{ margin: 0 }}>
                  <Input size="small" placeholder="شماره نامه فرستنده" />
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>تاریخ نامه وارده</div>
                <Form.Item name="incomingDate" style={{ margin: 0 }}>
                  <Input size="small" placeholder="۱۴۰۳/۰۴/۱۰" />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>بارکد</div>
                <Form.Item name="barcode" style={{ margin: 0 }}>
                  <Input size="small" placeholder="بارکد" />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>پرونده نامه</div>
                <Form.Item name="folder" style={{ margin: 0 }}>
                  <Input size="small" placeholder="پرونده" />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </div>

      {/* بدنه */}
      <div style={{ background: 'white', border: '1px solid #e8edf2', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
        <Tabs size="small" style={{ padding: '0 16px' }} items={[
          {
            key: '1',
            label: <span><FileTextOutlined /> بدنه نامه</span>,
            children: (
              <div style={{ padding: '12px 0', overflowX:'auto' }}>
                <div style={{ width:pageMetrics.width, minHeight:pageMetrics.height, margin:'0 auto', padding:`${selectedTemplate?.imageData?pageMetrics.contentTopWithTemplate:pageMetrics.contentTopPlain} ${pageMetrics.x} ${pageMetrics.bottom}`, boxSizing:'border-box', position:'relative', backgroundColor:'#fff', backgroundImage:selectedTemplate?.imageData?`url(${selectedTemplate.imageData})`:undefined, backgroundSize:'100% 100%', backgroundPosition:'top center', backgroundRepeat:'no-repeat', boxShadow:'0 2px 18px #0002' }}>
                  <div style={{position:'absolute',top:selectedTemplate?.imageData?pageMetrics.receiverTopWithTemplate:pageMetrics.receiverTopPlain,right:pageMetrics.x,fontSize:paperSize==='A5'?10:12,textAlign:'right'}}><strong>گیرنده:</strong> {letterType==='internal' ? users.find(x=>x.id===watchedToUser)?.fullName || '—' : contacts.find(x=>x.id===watchedToExternal)?.fullName || '—'}</div>
                  <div style={{position:'absolute',top:selectedTemplate?.imageData?pageMetrics.metaTopWithTemplate:pageMetrics.metaTopPlain,left:pageMetrics.x,fontSize:paperSize==='A5'?10:12,textAlign:'left'}}><div><strong>تاریخ:</strong> {watchedDate || '—'}</div><div><strong>شماره:</strong> {letterNumber}</div><div><strong>پیوست:</strong> {attachments.length?'دارد':'ندارد'}</div></div>
                  <div style={{position:'absolute',top:selectedTemplate?.imageData?pageMetrics.subjectTopWithTemplate:pageMetrics.subjectTopPlain,right:pageMetrics.x,left:pageMetrics.x,fontWeight:700,textAlign:'right',fontSize:paperSize==='A5'?12:15}}>{watchedSubject && <>موضوع: {watchedSubject}</>}</div>
                  <RichEditor onChange={setBodyHtml} initialHtml={bodyHtml} />
                  {hasSignature && <div style={{textAlign:'center',position:'absolute',left:pageMetrics.x,bottom:pageMetrics.signatureBottom,fontSize:paperSize==='A5'?10:13}}><strong>{signerName}</strong><br/>{signer?.signatureDataUrl && <img src={signer.signatureDataUrl} alt="امضا" style={{width:paperSize==='A5'?80:110,height:paperSize==='A5'?44:60,objectFit:'contain'}}/>}</div>}
                </div>
              </div>
            )
          },
          {
            key: '2',
            label: (
              <span>
                <TeamOutlined /> گیرندگان / ارجاعات
                {recipients.length > 0 && <Tag color="blue" style={{ marginRight: 4, fontSize: 10 }}>{recipients.length}</Tag>}
              </span>
            ),
            children: (
              <div style={{ padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Space>
                    <Button disabled={recipientsLocked} size="small" type="primary" icon={<PlusOutlined />} onClick={() => openRecipientModal()}>درج گیرنده</Button>
                    <Button disabled={recipientsLocked} size="small" onClick={() => {
                      users.forEach(u => {
                        setRecipients(prev => [...prev, { id: Date.now().toString() + Math.random(), name: u.fullName, type: 'internal', referralType: 'جهت اطلاع' }])
                      })
                    }}>درج همه پرسنل</Button>
                  </Space>
                </div>
                <Table size="small" columns={recipientColumns} dataSource={recipients} rowKey="id" pagination={false}
                  locale={{ emptyText: <Empty description="گیرنده‌ای اضافه نشده" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }} />
              </div>
            )
          },
          {
            key: '3',
            label: (
              <span>
                <PaperClipOutlined /> پیوست‌ها
                {attachments.length > 0 && <Tag color="blue" style={{ marginRight: 4, fontSize: 10 }}>{attachments.length}</Tag>}
              </span>
            ),
            children: (
              <div style={{ padding: '12px 0' }}>
                <Space style={{ marginBottom: 12 }}>
                  <Upload multiple accept=".doc,.docx,.pdf,.zip,.rar,.jpg,.jpeg,.png" beforeUpload={f => { setAttachments(p => [...p, f as unknown as UploadFile]); return false }} showUploadList={false}>
                    <Button icon={<UploadOutlined />} type="dashed">انتخاب فایل</Button>
                  </Upload>
                </Space>
                {attachments.length === 0 ? (
                  <Empty description="پیوستی اضافه نشده" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <List size="small" bordered dataSource={attachments} renderItem={(f, i) => (
                    <List.Item actions={[<Button size="small" danger icon={<DeleteOutlined />} onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))} />]}>
                      <Space>{getFileIcon(f.name)}<span>{f.name}</span><Tag>{((f.size || 0) / 1024).toFixed(0)} KB</Tag></Space>
                    </List.Item>
                  )} />
                )}
              </div>
            )
          },
          {
            key: '4',
            label: <span><HistoryOutlined /> گردش نامه</span>,
            children: (
              <div style={{ padding: '16px 0' }}>
                <Steps direction="vertical" size="small" items={[
                  { title: 'ایجاد پیش‌نویس', description: <span style={{ fontSize: 11 }}>در انتظار ارسال</span>, status: 'finish' },
                  { title: 'ارسال', description: <span style={{ fontSize: 11 }}>—</span>, status: 'wait' },
                ]} />
              </div>
            )
          },
          {
            key: '5',
            label: <span><LinkOutlined /> پیوند نامه</span>,
            children: (
              <div style={{ padding: '12px 0' }}>
                <Form form={form} layout="vertical">
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item name="referenceNumber" label="شماره نامه مرتبط">
                        <Input placeholder="مثلاً: ص/۱۴۰۳/۰۰۹۰" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="referenceDate" label="تاریخ نامه مرتبط">
                        <Input placeholder="۱۴۰۳/۰۴/۱۰" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="referenceType" label="نوع ارتباط">
                        <Select allowClear placeholder="انتخاب نوع">
                          <Select.Option value="reply">پاسخ به نامه</Select.Option>
                          <Select.Option value="followup">پیرو نامه</Select.Option>
                          <Select.Option value="related">نامه مرتبط</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </div>
            )
          },
        ]} />
      </div>

      {/* Modal گیرنده */}
      <Modal
        title={editingRecipient ? 'ویرایش گیرنده' : 'افزودن گیرنده'}
        open={recipientModal} onOk={saveRecipient} onCancel={() => setRecipientModal(false)}
        okText="ذخیره" cancelText="انصراف" width={500}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={recipientForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="type" label="نوع گیرنده" initialValue="internal">
                <Select>
                  <Select.Option value="internal">داخلی</Select.Option>
                  <Select.Option value="external">خارجی</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="personKey" label="نام گیرنده" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" placeholder="انتخاب کاربر یا مخاطب" allowClear>
                  {users.map(u => <Select.Option key={`user:${u.id}`} value={`user:${u.id}`} label={`${u.fullName} کاربر داخلی`}>{u.fullName} — کاربر داخلی</Select.Option>)}
                  {contacts.map(c => <Select.Option key={`contact:${c.id}`} value={`contact:${c.id}`} label={`${c.fullName} ${c.companyName||''}`}>{c.fullName} — {c.companyName||'مخاطب'}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="organization" label="سازمان (اختیاری)">
                <Input placeholder="نام سازمان" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="referralType" label="نوع ارجاع" initialValue="اصل">
                <Select>{REFERRAL_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="referralText" label="متن ارجاع (اختیاری)">
                <Input.TextArea rows={2} placeholder="متن ارجاع..." />
              </Form.Item>
            </Col>
            <Col span={24}><Form.Item name="sendSms" valuePropName="checked"><Checkbox>پس از ثبت نامه برای این گیرنده پیامک ارسال شود</Checkbox></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal ارجاع */}
      <Modal
        title={<Space><SwapLeftOutlined style={{ color: '#fa8c16' }} /><span>ارجاع نامه</span></Space>}
        open={referralModal} onOk={handleSaveReferral} onCancel={() => { setReferralModal(false); referralForm.resetFields(); setReferralFiles([]) }}
        okText="ارجاع دهید" cancelText="انصراف" width={520}
        okButtonProps={{ style: { background: '#fa8c16', borderColor: '#fa8c16' } }}
      >
        <Form form={referralForm} layout="vertical">
          <Form.Item name="toUser" label="ارجاع به" rules={[{ required: true, message: 'انتخاب گیرنده الزامی است' }]}>
            <Select showSearch placeholder="انتخاب شخص" size="large">
              {users.map(u => (
                <Select.Option key={u.id} value={u.id}>
                  <Space>
                    <Avatar size={22} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                    {u.fullName}
                    {u.position && <span style={{ fontSize: 11, color: '#8c8c8c' }}>— {u.position}</span>}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="referralType" label="نوع ارجاع" initialValue="جهت اقدام">
            <Select size="large">
              {REFERRAL_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="referralText" label="متن ارجاع">
            <Input.TextArea rows={4} placeholder="متن ارجاع را بنویسید..." style={{ fontSize: 14 }} />
          </Form.Item>
          <Form.Item label="پیوست ارجاع">
            <Upload
              multiple
              beforeUpload={f => { setReferralFiles(p => [...p, f as unknown as UploadFile]); return false }}
              fileList={referralFiles}
              onRemove={f => setReferralFiles(p => p.filter(x => x.uid !== f.uid))}
              accept=".pdf,.doc,.docx,.jpg,.png"
            >
              <Button icon={<UploadOutlined />}>افزودن فایل پیوست</Button>
            </Upload>
          </Form.Item>
        </Form>
        <div style={{ padding: '8px 12px', background: '#fff7e6', borderRadius: 8, fontSize: 12, color: '#8c8c8c', border: '1px solid #ffd591' }}>
          ⚠️ پس از ارجاع، این شخص در لیست گیرندگان اضافه می‌شود.
        </div>
      </Modal>

      {/* Modal چاپ */}
      <Modal
        title={printMode === 'full' ? 'پیش‌نمایش کامل' : 'پیش‌نمایش روی سربرگ فیزیکی'}
        open={printModal} onCancel={() => setPrintModal(false)}
        width={paperSize === 'A4' ? 860 : 640}
        footer={[
          <Button key="c" onClick={() => setPrintModal(false)}>بستن</Button>,
          <Button key="p" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>چاپ</Button>
        ]}
      >
        <div style={{ overflowY: 'auto', maxHeight: '70vh', background: '#f5f5f5', padding: 16 }}>
          <LetterPreview minimal={printMode === 'minimal'} />
        </div>
      </Modal>
    </div>
  )
}
