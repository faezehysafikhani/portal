import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Table, Button, Tag, Form, Input, Select, Space, Card, Statistic, Row, Col, Alert, Tooltip, message, Tabs, Popconfirm } from 'antd'
import { SendOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, TeamOutlined, ContactsOutlined, ReloadOutlined, MessageOutlined, DeleteOutlined, SettingOutlined, SearchOutlined, RedoOutlined, HistoryOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface SmsMessage { id: string; to: string; body: string; status: number; provider?: string; messageId?: string; errorMessage?: string; sentAt?: string; createdAt?: string; cost?: number }
interface DirectoryUser { id: string; fullName: string; phoneNumber?: string; department?: string; position?: string }
interface DirectoryContact { id: string; fullName: string; companyName?: string; jobTitle?: string; mobile?: string; phone?: string }

const STATUS_CONFIG: Record<number, { label: string; color: string; icon: ReactNode }> = {
  0: { label: 'در انتظار', color: 'default', icon: <ClockCircleOutlined /> },
  1: { label: 'ارسال شده', color: 'blue', icon: <SendOutlined /> },
  2: { label: 'تحویل شده', color: 'green', icon: <CheckCircleOutlined /> },
  3: { label: 'ناموفق', color: 'red', icon: <CloseCircleOutlined /> },
}

const normalizePhone = (value: string): string => {
  const fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩'
  return value.trim().replace(/[۰-۹٠-٩]/g, (d) => String(fa.indexOf(d) >= 0 ? fa.indexOf(d) : ar.indexOf(d))).replace(/[\s\-()]/g, '')
}
const isValidPhone = (value: string): boolean => /^09\d{9}$/.test(value)
const smsParts = (text: string): number => (text.length === 0 ? 0 : text.length <= 70 ? 1 : Math.ceil(text.length / 67))

export default function SmsPage() {
  const toast = message
  const navigate = useNavigate()
  const api = 'http://localhost:5043/api/v1'
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` })
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [contacts, setContacts] = useState<DirectoryContact[]>([])
  const [serviceActive, setServiceActive] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [recipients, setRecipients] = useState<string[]>([])
  const [text, setText] = useState('')
  const [activeTab, setActiveTab] = useState('send')
  const [search, setSearch] = useState('')
  const [resendingId, setResendingId] = useState<string | null>(null)

  const loadMessages = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${api}/sms/messages`, { headers: headers() })
      if (r.ok) setMessages(await r.json())
    } finally { setLoading(false) }
  }

  useEffect(() => {
    void loadMessages()
    fetch(`${api}/directory`, { headers: headers() }).then(r => r.ok ? r.json() : null).then(d => { if (d) { setUsers(d.users || []); setContacts(d.contacts || []) } }).catch(() => {})
    fetch(`${api}/sms-settings`, { headers: headers() }).then(r => r.ok ? r.json() : null).then(s => { if (s) setServiceActive(!!s.isActive) }).catch(() => {})
  }, [])

  const { userOptions, contactOptions } = useMemo(() => {
    const seen = new Set<string>()
    const userOptions = users.flatMap(u => {
      const phone = normalizePhone(u.phoneNumber || '')
      if (!phone) return []
      if (!isValidPhone(phone)) return [{ value: `invalid-user-${u.id}`, label: `${u.fullName} — ⚠️ شماره نامعتبر (${phone}) — در مدیریت کاربران اصلاح کنید`, name: u.fullName, disabled: true }]
      if (seen.has(phone)) return []
      seen.add(phone)
      return [{ value: phone, label: `${u.fullName}${u.position ? ` — ${u.position}` : ''} (${phone})`, name: u.fullName, disabled: false }]
    })
    const contactOptions = contacts.flatMap(c => {
      const phone = normalizePhone(c.mobile || c.phone || '')
      if (!phone) return []
      if (!isValidPhone(phone)) return [{ value: `invalid-contact-${c.id}`, label: `${c.fullName} — ⚠️ شماره نامعتبر (${phone})`, name: c.fullName, disabled: true }]
      if (seen.has(phone)) return []
      seen.add(phone)
      return [{ value: phone, label: `${c.fullName}${c.companyName ? ` — ${c.companyName}` : ''} (${phone})`, name: c.fullName, disabled: false }]
    })
    return { userOptions, contactOptions }
  }, [users, contacts])

  const invalidRecipients = recipients.filter(r => !isValidPhone(normalizePhone(r)))

  const selectAll = (options: { value: string; disabled?: boolean }[]) => setRecipients(prev => [...new Set([...prev, ...options.filter(o => !o.disabled).map(o => o.value)])])

  const send = async () => {
    const cleaned = [...new Set(recipients.map(normalizePhone))]
    const invalid = cleaned.filter(r => !isValidPhone(r))
    if (!cleaned.length) { toast.warning('حداقل یک شماره گیرنده انتخاب کنید'); return }
    if (invalid.length) { toast.error(`این شماره‌ها معتبر نیستند: ${invalid.slice(0, 3).join('، ')}`); return }
    if (!text.trim()) { toast.warning('متن پیامک را بنویسید'); return }
    setSending(true)
    try {
      const r = await fetch(`${api}/sms/send`, { method: 'POST', headers: headers(), body: JSON.stringify({ recipients: cleaned, message: text.trim() }) })
      const result = await r.json().catch(() => ({}))
      if (r.ok) {
        toast.success(result.message || 'پیامک ارسال شد')
        setRecipients([]); setText('')
        await loadMessages()
      } else {
        toast.error(result.message || 'ارسال پیامک ناموفق بود')
      }
    } finally { setSending(false) }
  }

  const resend = async (m: SmsMessage) => {
    setResendingId(m.id)
    try {
      const r = await fetch(`${api}/sms/send`, { method: 'POST', headers: headers(), body: JSON.stringify({ recipients: [m.to], message: m.body }) })
      const result = await r.json().catch(() => ({}))
      if (r.ok) { toast.success(result.message || 'پیامک دوباره ارسال شد'); await loadMessages() }
      else toast.error(result.message || 'ارسال مجدد ناموفق بود')
    } finally { setResendingId(null) }
  }

  const filteredMessages = useMemo(() => {
    const q = normalizePhone(search) || search.trim()
    if (!q) return messages
    return messages.filter(m => String(m.to || '').includes(q) || String(m.body || '').includes(search.trim()))
  }, [messages, search])

  const stats = useMemo(() => ({
    total: messages.length,
    sent: messages.filter(m => m.status === 1 || m.status === 2).length,
    failed: messages.filter(m => m.status === 3).length,
    cost: messages.reduce((a, m) => a + (Number(m.cost) || 0), 0),
  }), [messages])

  const columns = [
    { title: 'شماره', dataIndex: 'to', key: 'to', width: 130, render: (v: string) => <span dir="ltr">{v}</span> },
    { title: 'متن پیامک', dataIndex: 'body', key: 'body', ellipsis: true },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 130,
      render: (s: number, r: SmsMessage) => {
        const config = STATUS_CONFIG[s] ?? STATUS_CONFIG[0]
        const tag = <Tag color={config.color} icon={config.icon}>{config.label}</Tag>
        return r.errorMessage ? <Tooltip title={r.errorMessage}>{tag}</Tooltip> : tag
      } },
    { title: 'زمان', key: 'time', width: 160,
      render: (_: unknown, r: SmsMessage) => { const t = r.sentAt || r.createdAt; return t ? new Date(t).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '-' } },
    { title: 'هزینه (ریال)', dataIndex: 'cost', key: 'cost', width: 110, render: (c: number) => c ? Number(c).toLocaleString('fa-IR') : '-' },
    { title: 'ارسال مجدد', key: 'resend', width: 130,
      render: (_: unknown, r: SmsMessage) => (
        <Popconfirm title="این پیامک دوباره به همین شماره ارسال شود؟" okText="ارسال" cancelText="انصراف"
          onConfirm={() => void resend(r)} disabled={serviceActive === false || !r.body}>
          <Button size="small" icon={<RedoOutlined />} loading={resendingId === r.id}
            disabled={serviceActive === false || !r.body || (resendingId !== null && resendingId !== r.id)}>ارسال مجدد</Button>
        </Popconfirm>
      ) },
  ]

  const parts = smsParts(text.trim().length ? text.trim() : '')

  return (
    <div>
      <Card style={{ marginBottom: 16, border: 'none', background: 'linear-gradient(120deg, #831843 0%, #be185d 55%, #7c3aed 100%)' }} styles={{ body: { padding: '20px 24px' } }}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col>
            <Space direction="vertical" size={2}>
              <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}><MessageOutlined /> ارسال پیامک گروهی</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>ارسال به کاربران سامانه، مخاطبین یا هر شماره دلخواه — متصل به پنل پیامکی کاوه‌نگار</span>
            </Space>
          </Col>
          <Col>
            {serviceActive === false
              ? <Button ghost icon={<SettingOutlined />} onClick={() => navigate('/settings')}>سرویس غیرفعال است — تنظیمات</Button>
              : serviceActive === true && <Tag color="green" style={{ fontSize: 13, padding: '4px 10px' }}><CheckCircleOutlined /> سرویس پیامک فعال</Tag>}
          </Col>
        </Row>
      </Card>

      {serviceActive === false && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="سرویس پیامک غیرفعال است"
          description="برای ارسال پیامک ابتدا از بخش تنظیمات ← پنل پیامکی، سرویس را فعال کنید."
          action={<Button size="small" type="primary" onClick={() => navigate('/settings')}>رفتن به تنظیمات</Button>} />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="کل ارسال‌ها" value={stats.total} valueStyle={{ color: '#be185d' }} prefix={<SendOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="موفق" value={stats.sent} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="ناموفق" value={stats.failed} valueStyle={{ color: '#f5222d' }} prefix={<CloseCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="هزینه کل (ریال)" value={stats.cost} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key: 'send', label: <span><SendOutlined /> ارسال پیامک</span>, children: (
        <Form layout="vertical">
          <Form.Item
            label="گیرندگان"
            help={invalidRecipients.length ? <span style={{ color: '#f5222d' }}>شماره‌های نامعتبر: {invalidRecipients.slice(0, 3).join('، ')}</span> : 'از فهرست انتخاب کنید یا شماره را تایپ کرده و Enter بزنید (مثلاً 09121234567)'}
            validateStatus={invalidRecipients.length ? 'error' : undefined}>
            <Select
              mode="tags"
              value={recipients}
              onChange={(values: string[]) => setRecipients(values.map(normalizePhone))}
              placeholder="انتخاب از کاربران و مخاطبین یا تایپ شماره جدید…"
              optionFilterProp="label"
              maxTagCount="responsive"
              tokenSeparators={[',', '،', ' ', '\n']}
              options={[
                { label: <span><TeamOutlined /> کاربران سامانه</span>, title: 'users', options: userOptions },
                { label: <span><ContactsOutlined /> مخاطبین و افراد مرتبط</span>, title: 'contacts', options: contactOptions },
              ]}
            />
          </Form.Item>
          <Space wrap style={{ marginBottom: 16 }}>
            <Button size="small" icon={<TeamOutlined />} onClick={() => selectAll(userOptions)} disabled={!userOptions.some(o => !o.disabled)}>افزودن همه کاربران ({userOptions.filter(o => !o.disabled).length})</Button>
            <Button size="small" icon={<ContactsOutlined />} onClick={() => selectAll(contactOptions)} disabled={!contactOptions.some(o => !o.disabled)}>افزودن همه مخاطبین ({contactOptions.filter(o => !o.disabled).length})</Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setRecipients([])} disabled={!recipients.length}>پاک کردن</Button>
            {recipients.length > 0 && <Tag color="magenta">{recipients.length.toLocaleString('fa-IR')} گیرنده</Tag>}
          </Space>
          <Form.Item label="متن پیامک" style={{ marginBottom: 8 }}>
            <Input.TextArea rows={4} value={text} onChange={e => setText(e.target.value)} showCount maxLength={500} placeholder="متن پیامک را بنویسید…" />
          </Form.Item>
          <Row justify="space-between" align="middle">
            <Col>
              {parts > 0 && <Tag color={parts > 1 ? 'orange' : 'green'}>{parts.toLocaleString('fa-IR')} بخش پیامکی</Tag>}
            </Col>
            <Col>
              <Button type="primary" size="large" icon={<SendOutlined />} loading={sending}
                disabled={sending || serviceActive === false || !recipients.length || !text.trim()}
                onClick={() => void send()}>
                ارسال به {recipients.length ? recipients.length.toLocaleString('fa-IR') : '۰'} شماره
              </Button>
            </Col>
          </Row>
        </Form>
          ) },
          { key: 'history', label: <span><HistoryOutlined /> پیام‌های ارسال‌شده ({messages.length.toLocaleString('fa-IR')})</span>, children: (
            <div>
              <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 16 }}>
                <Col flex="auto">
                  <Input allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="جستجو بر اساس شماره یا متن پیامک…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </Col>
                <Col>
                  <Button icon={<ReloadOutlined />} onClick={() => void loadMessages()} loading={loading}>به‌روزرسانی</Button>
                </Col>
              </Row>
              {search.trim() && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`${filteredMessages.length.toLocaleString('fa-IR')} پیامک با جستجوی شما مطابقت دارد`} />}
              <Table columns={columns} dataSource={filteredMessages} rowKey="id" loading={loading} size="middle"
                pagination={{ pageSize: 10, showTotal: total => `${total.toLocaleString('fa-IR')} پیامک` }} />
            </div>
          ) },
        ]} />
      </Card>
    </div>
  )
}
