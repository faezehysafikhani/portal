import { useState } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, Space, Card, Statistic, Row, Col } from 'antd'
import { PlusOutlined, SendOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

interface SmsMessage {
  id: string
  to: string
  body: string
  status: 'pending' | 'sent' | 'delivered' | 'failed'
  sentAt?: string
  scheduledAt?: string
  cost?: number
}

const STATUS_CONFIG = {
  pending: { label: 'در انتظار', color: 'default', icon: <ClockCircleOutlined /> },
  sent: { label: 'ارسال شده', color: 'blue', icon: <SendOutlined /> },
  delivered: { label: 'تحویل داده شده', color: 'green', icon: <CheckCircleOutlined /> },
  failed: { label: 'ناموفق', color: 'red', icon: <CloseCircleOutlined /> },
}

const INITIAL_SMS: SmsMessage[] = [
  { id: '1', to: '09121234567', body: 'نامه جدید در کارتابل شما ثبت شد', status: 'delivered', sentAt: '۱۴۰۳/۰۴/۱۵ ۱۰:۳۰', cost: 120 },
  { id: '2', to: '09351234567', body: 'وظیفه جدید به شما محول شد', status: 'delivered', sentAt: '۱۴۰۳/۰۴/۱۵ ۱۱:۰۰', cost: 120 },
  { id: '3', to: '09121111111', body: 'تیکت شما بررسی شد', status: 'sent', sentAt: '۱۴۰۳/۰۴/۱۵ ۱۲:۰۰', cost: 120 },
  { id: '4', to: '09122222222', body: 'فرم مرخصی شما تأیید شد', status: 'failed', sentAt: '۱۴۰۳/۰۴/۱۵ ۱۳:۰۰' },
  { id: '5', to: '09123333333', body: 'یادآوری جلسه فردا ساعت ۱۰', status: 'pending', scheduledAt: '۱۴۰۳/۰۴/۱۶ ۰۸:۰۰' },
]

const TEMPLATES = [
  'نامه جدید در کارتابل شما ثبت شد',
  'وظیفه جدید به شما محول شد',
  'تیکت شما بررسی شد',
  'فرم {نوع} شما {وضعیت} شد',
  'یادآوری جلسه فردا ساعت {ساعت}',
]

export default function SmsPage() {
  const [messages, setMessages] = useState<SmsMessage[]>(INITIAL_SMS)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const handleSend = () => {
    form.validateFields().then(values => {
      const newSms: SmsMessage = {
        id: Date.now().toString(),
        status: values.scheduledAt ? 'pending' : 'sent',
        sentAt: values.scheduledAt ? undefined : new Date().toLocaleString('fa-IR'),
        scheduledAt: values.scheduledAt,
        cost: 120,
        ...values
      }
      setMessages(prev => [newSms, ...prev])
      setModalOpen(false)
      form.resetFields()
    })
  }

  const columns = [
    { title: 'شماره', dataIndex: 'to', key: 'to', width: 130 },
    { title: 'متن پیامک', dataIndex: 'body', key: 'body' },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 150,
      render: (s: string) => (
        <Tag color={STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].color} icon={STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].icon}>
          {STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
        </Tag>
      )},
    { title: 'زمان ارسال', key: 'time', width: 160,
      render: (_: unknown, r: SmsMessage) => r.scheduledAt ? `زمان‌بندی: ${r.scheduledAt}` : r.sentAt || '-' },
    { title: 'هزینه (ریال)', dataIndex: 'cost', key: 'cost', width: 110,
      render: (c: number) => c ? c.toLocaleString('fa-IR') : '-' },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="کل ارسال‌ها" value={messages.length} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="تحویل داده شده" value={messages.filter(m => m.status === 'delivered').length} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="ناموفق" value={messages.filter(m => m.status === 'failed').length} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="هزینه کل (ریال)" value={messages.reduce((a, m) => a + (m.cost || 0), 0)} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <Tag key={key} color={val.color}>{val.label}: {messages.filter(m => m.status === key).length}</Tag>
          ))}
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>پیامک جدید</Button>
      </div>

      <Table columns={columns} dataSource={messages} rowKey="id" />

      <Modal title="ارسال پیامک" open={modalOpen} onOk={handleSend} onCancel={() => setModalOpen(false)} okText="ارسال" cancelText="انصراف">
        <Form form={form} layout="vertical">
          <Form.Item name="sendType" label="نوع ارسال" initialValue="single">
            <Select>
              <Select.Option value="single">تکی</Select.Option>
              <Select.Option value="group">گروهی</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="to" label="شماره موبایل" rules={[{ required: true, message: 'شماره را وارد کنید' }]}>
            <Input placeholder="09121234567" />
          </Form.Item>
          <Form.Item name="template" label="قالب پیامک">
            <Select placeholder="انتخاب قالب" onChange={val => form.setFieldValue('body', val)} allowClear>
              {TEMPLATES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="body" label="متن پیامک" rules={[{ required: true, message: 'متن را وارد کنید' }]}>
            <Input.TextArea rows={4} showCount maxLength={160} />
          </Form.Item>
          <Form.Item name="scheduledAt" label="زمان‌بندی ارسال (اختیاری)">
            <Input placeholder="مثلاً ۱۴۰۳/۰۴/۲۰ ۱۰:۰۰" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}