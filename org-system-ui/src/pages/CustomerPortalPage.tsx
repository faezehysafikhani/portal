import { useState, useEffect } from 'react'
import { Layout, Card, Button, Table, Tag, Space, Modal, Form, Input, Select, Badge, Avatar, Upload, Empty } from 'antd'
import { PlusOutlined, LogoutOutlined, CustomerServiceOutlined, UserOutlined, UploadOutlined, EyeOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

type TicketStatus = 'باز' | 'در بررسی' | 'پاسخ داده شده' | 'بسته'
type TicketPriority = 'کم' | 'متوسط' | 'بالا' | 'بحرانی'

interface Ticket {
  id: string
  code: string
  title: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  date: string
  lastUpdate: string
  messages: { id: string; text: string; by: string; date: string; isCustomer: boolean }[]
}

const STATUS_COLOR: Record<TicketStatus, string> = {
  'باز': 'blue', 'در بررسی': 'orange', 'پاسخ داده شده': 'purple', 'بسته': 'default'
}

const PRIORITY_COLOR: Record<TicketPriority, string> = {
  'کم': 'green', 'متوسط': 'blue', 'بالا': 'orange', 'بحرانی': 'red'
}

const INITIAL_TICKETS: Ticket[] = [
  {
    id: '1', code: 'TKT-001', title: 'مشکل در دسترسی به سیستم', category: 'فنی',
    priority: 'بالا', status: 'پاسخ داده شده', date: '۱۴۰۳/۰۴/۱۰', lastUpdate: '۱۴۰۳/۰۴/۱۲',
    messages: [
      { id: '1', text: 'سلام، نمی‌توانم وارد سیستم شوم.', by: 'شرکت آلفا', date: '۱۴۰۳/۰۴/۱۰ ۱۰:۳۰', isCustomer: true },
      { id: '2', text: 'سلام، رمز عبور شما بازنشانی شد. ایمیل خود را بررسی کنید.', by: 'پشتیبانی', date: '۱۴۰۳/۰۴/۱۱ ۰۹:۱۵', isCustomer: false },
      { id: '3', text: 'ممنون، مشکل حل شد.', by: 'شرکت آلفا', date: '۱۴۰۳/۰۴/۱۲ ۱۱:۰۰', isCustomer: true },
    ]
  },
  {
    id: '2', code: 'TKT-002', title: 'درخواست افزایش سطح دسترسی', category: 'اداری',
    priority: 'متوسط', status: 'در بررسی', date: '۱۴۰۳/۰۴/۱۳', lastUpdate: '۱۴۰۳/۰۴/۱۳',
    messages: [
      { id: '1', text: 'لطفاً دسترسی من را به ماژول گزارشات افزایش دهید.', by: 'شرکت آلفا', date: '۱۴۰۳/۰۴/۱۳ ۱۴:۰۰', isCustomer: true },
    ]
  },
]

export default function CustomerPortalPage() {
  const navigate = useNavigate()

  // چک لاگین
  const customerData = localStorage.getItem('customer')
  if (!customerData) {
    window.location.href = '/customer-login'
    return null
  }
  const customer = JSON.parse(customerData)

  const [tickets, setTickets] = useState<Ticket[]>([])
const [ticketsLoading, setTicketsLoading] = useState(true)

useEffect(() => {
  fetch(`http://localhost:5043/api/v1/customers/${customer.id}/tickets`, { headers: { Authorization: `Bearer ${customer.accessToken}` } })
    .then(r => r.json())
    .then(data => { setTickets(data); setTicketsLoading(false) })
    .catch(() => setTicketsLoading(false))
}, [customer.id])
  const [newTicketModal, setNewTicketModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [form] = Form.useForm()

  const handleLogout = () => {
    localStorage.removeItem('customer')
    navigate('/customer-login')
  }

 const handleNewTicket = () => {
  form.validateFields().then(async values => {
    try {
      const res = await fetch(`http://localhost:5043/api/v1/customers/${customer.id}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.accessToken}` },
        body: JSON.stringify({
          title: values.title,
          category: values.category,
          priority: values.priority,
          description: values.description
        })
      })
      const data = await res.json()
      if (!res.ok) { alert(data.message); return }
      // reload tickets
      const res2 = await fetch(`http://localhost:5043/api/v1/customers/${customer.id}/tickets`, { headers: { Authorization: `Bearer ${customer.accessToken}` } })
      setTickets(await res2.json())
      setNewTicketModal(false)
      form.resetFields()
    } catch {
      alert('خطا در اتصال به سرور')
    }
  })
}

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return
    const response = await fetch(`http://localhost:5043/api/v1/customers/tickets/${selectedTicket.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.accessToken}` },
      body: JSON.stringify({ text: replyText, authorName: customer.fullName, isCustomer: true })
    })
    if (!response.ok) return
    const updated = {
      ...selectedTicket,
      messages: [...selectedTicket.messages, {
        id: Date.now().toString(), text: replyText,
        by: customer.fullName, date: '۱۴۰۳/۰۴/۱۵ ۱۱:۰۰', isCustomer: true
      }]
    }
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t))
    setSelectedTicket(updated)
    setReplyText('')
  }

  const columns = [
    {
      title: 'کد', dataIndex: 'code', key: 'code', width: 90,
      render: (c: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{c}</Tag>
    },
    { title: 'عنوان', dataIndex: 'title', key: 'title' },
    { title: 'دسته', dataIndex: 'category', key: 'category', width: 90, render: (c: string) => <Tag>{c}</Tag> },
    {
      title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 90,
      render: (p: TicketPriority) => <Tag color={PRIORITY_COLOR[p]}>{p}</Tag>
    },
    {
      title: 'وضعیت', dataIndex: 'status', key: 'status', width: 130,
      render: (s: TicketStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>
    },
    {
      title: 'تاریخ', dataIndex: 'date', key: 'date', width: 110,
      render: (d: string) => <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d}</span>
    },
    {
      title: 'عملیات', key: 'actions', width: 90,
      render: (_: unknown, r: Ticket) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedTicket(r); setViewModal(true) }}>
          مشاهده
        </Button>
      )
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* هدر */}
      <div style={{
        background: 'linear-gradient(135deg, #3D0A2E, #8B1A6B)',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Space>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CustomerServiceOutlined style={{ color: 'white', fontSize: 18 }} />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>پورتال مشتریان</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>مدیریت پروژه پارس</div>
          </div>
        </Space>
        <Space>
          <Avatar icon={<UserOutlined />} style={{ background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ color: 'white', fontSize: 13 }}>{customer.fullName}</span>
          <Button
            icon={<LogoutOutlined />} size="small"
            style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)', background: 'transparent' }}
            onClick={handleLogout}
          >
            خروج
          </Button>
        </Space>
      </div>

      <div style={{ padding: 24 }}>
        {/* کارت‌های آماری */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'کل تیکت‌ها', value: tickets.length, color: '#8B1A6B' },
            { label: 'باز', value: tickets.filter(t => t.status === 'باز').length, color: '#1677ff' },
            { label: 'در بررسی', value: tickets.filter(t => t.status === 'در بررسی').length, color: '#fa8c16' },
            { label: 'پاسخ داده شده', value: tickets.filter(t => t.status === 'پاسخ داده شده').length, color: '#722ed1' },
            { label: 'بسته', value: tickets.filter(t => t.status === 'بسته').length, color: '#8c8c8c' },
          ].map((s, i) => (
            <Card key={i} size="small" style={{ flex: 1, minWidth: 110, borderTop: `3px solid ${s.color}`, borderRadius: 10 }} styles={{ body: { padding: '12px 16px' } }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{s.label}</div>
            </Card>
          ))}
        </div>

        {/* جدول تیکت‌ها */}
        <Card
          title={
            <Space>
              <CustomerServiceOutlined style={{ color: '#8B1A6B' }} />
              <span>تیکت‌های من</span>
              <Badge count={tickets.filter(t => t.status === 'پاسخ داده شده').length} style={{ background: '#8B1A6B' }} />
            </Space>
          }
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewTicketModal(true)}
              style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>
              تیکت جدید
            </Button>
          }
          style={{ borderRadius: 12 }}
        >
          {tickets.length === 0
            ? <Empty description="تیکتی ثبت نشده است" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            //: <Table columns={columns} dataSource={tickets} rowKey="id" size="small" scroll={{ x: 700 }} />
           : <Table columns={columns} dataSource={tickets} rowKey="id" size="small" scroll={{ x: 700 }} loading={ticketsLoading} />
          }
        </Card>
      </div>

      {/* Modal تیکت جدید */}
      <Modal
        title={<Space><PlusOutlined style={{ color: '#8B1A6B' }} /><span>ثبت تیکت جدید</span></Space>}
        open={newTicketModal} onOk={handleNewTicket} onCancel={() => { setNewTicketModal(false); form.resetFields() }}
        okText="ثبت تیکت" cancelText="انصراف" width={580}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' }, icon: <SendOutlined /> }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="عنوان مشکل" rules={[{ required: true, message: 'الزامی است' }]}>
            <Input placeholder="خلاصه مشکل یا درخواست خود را بنویسید..." size="large" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="category" label="دسته‌بندی" style={{ flex: 1 }} rules={[{ required: true, message: 'الزامی است' }]}>
              <Select placeholder="انتخاب دسته" size="large">
                {['فنی', 'مالی', 'اداری', 'آموزش', 'سایر'].map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label="اولویت" style={{ flex: 1 }} initialValue="متوسط">
              <Select size="large">
                {['کم', 'متوسط', 'بالا', 'بحرانی'].map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="description" label="شرح کامل" rules={[{ required: true, message: 'الزامی است' }]}>
            <Input.TextArea rows={5} placeholder="مشکل یا درخواست خود را به طور کامل توضیح دهید..." />
          </Form.Item>
          <Form.Item name="attachments" label="پیوست فایل">
            <Upload beforeUpload={() => false} maxCount={3} accept=".pdf,.jpg,.png,.docx">
              <Button icon={<UploadOutlined />}>افزودن فایل</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal مشاهده تیکت */}
      <Modal
        title={selectedTicket && (
          <Space>
            <Tag color="purple">{selectedTicket.code}</Tag>
            <span>{selectedTicket.title}</span>
            <Tag color={STATUS_COLOR[selectedTicket.status]}>{selectedTicket.status}</Tag>
          </Space>
        )}
        open={viewModal} onCancel={() => { setViewModal(false); setReplyText('') }}
        footer={null} width={680}
      >
        {selectedTicket && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <Tag>دسته: {selectedTicket.category}</Tag>
              <Tag color={PRIORITY_COLOR[selectedTicket.priority]}>اولویت: {selectedTicket.priority}</Tag>
              <Tag color="blue">تاریخ: {selectedTicket.date}</Tag>
            </div>

            {/* پیام‌ها */}
            <div style={{ maxHeight: 350, overflowY: 'auto', marginBottom: 16, padding: 8 }}>
              {selectedTicket.messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: msg.isCustomer ? 'row-reverse' : 'row', gap: 10, marginBottom: 16 }}>
                  <Avatar size={36} icon={<UserOutlined />} style={{ background: msg.isCustomer ? '#8B1A6B' : '#1677ff', flexShrink: 0 }} />
                  <div style={{ maxWidth: '75%' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, textAlign: msg.isCustomer ? 'right' : 'left' }}>
                      {msg.by} — {msg.date}
                    </div>
                    <div style={{
                      padding: '10px 14px', borderRadius: 12, fontSize: 13,
                      background: msg.isCustomer ? '#f9f0ff' : '#e6f4ff',
                      border: `1px solid ${msg.isCustomer ? '#d3adf7' : '#91caff'}`,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* پاسخ */}
            {selectedTicket.status !== 'بسته' && (
              <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <Input.TextArea
                  rows={2} value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="پاسخ خود را بنویسید..." style={{ flex: 1 }}
                />
                <Button
                  type="primary" icon={<SendOutlined />} onClick={handleReply}
                  disabled={!replyText.trim()}
                  style={{ background: '#8B1A6B', borderColor: '#8B1A6B', alignSelf: 'flex-end' }}
                >
                  ارسال
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  )
}
