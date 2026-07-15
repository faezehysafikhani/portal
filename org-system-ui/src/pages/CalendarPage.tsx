import { useEffect, useState } from 'react'
import { Alert, Button, Card, DatePicker, Empty, Form, Input, List, Modal, Select, Space, Tag, message } from 'antd'
import { CalendarOutlined, EnvironmentOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'

const API = 'http://localhost:5043/api/v1'
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

interface UserOption { id: string; fullName: string; username: string }
interface CalendarEvent {
  id: string; title: string; description?: string; startAt: string; endAt: string
  persianStartDate: string; gregorianStartDate: string; eventType: string
  location?: string; onlineMeetingUrl?: string; status: string
  attendees: { userId: string; responseStatus: string }[]
}

interface EventForm {
  title: string; description?: string; range: [Dayjs, Dayjs]; eventType: string
  location?: string; onlineMeetingUrl?: string; attendeeUserIds?: string[]
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form] = Form.useForm<EventForm>()

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [eventsRes, usersRes] = await Promise.all([
        fetch(`${API}/calendar`, { headers: authHeaders() }),
        fetch(`${API}/users`, { headers: authHeaders() })
      ])
      if (!eventsRes.ok) throw new Error((await eventsRes.json()).message || 'خطا در دریافت تقویم')
      setEvents(await eventsRes.json())
      if (usersRes.ok) setUsers(await usersRes.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'ارتباط با backend برقرار نشد') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const create = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const res = await fetch(`${API}/calendar`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({
          title: values.title, description: values.description,
          startAt: values.range[0].toISOString(), endAt: values.range[1].toISOString(),
          isAllDay: false, timeZone: 'Asia/Tehran', eventType: values.eventType,
          location: values.location, onlineMeetingUrl: values.onlineMeetingUrl,
          organizer: null,
          participants: (values.attendeeUserIds || []).map(id => ({ personType: 'user', personId: id,
            displayName: users.find(u => u.id === id)?.fullName || users.find(u => u.id === id)?.username || '', role: 'attendee' })),
          relatedLetterIds: [], relatedTaskIds: []
        })
      })
      if (!res.ok) throw new Error((await res.json()).message || 'ثبت رویداد ناموفق بود')
      message.success('رویداد با موفقیت ثبت شد')
      setOpen(false); form.resetFields(); await load()
    } catch (e) { message.error(e instanceof Error ? e.message : 'خطا در ثبت رویداد') }
    finally { setSaving(false) }
  }

  return <div dir="rtl">
    <Card title={<Space><CalendarOutlined />تقویم جلسات و رویدادها</Space>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>ایجاد رویداد</Button>}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <List loading={loading} dataSource={events} locale={{ emptyText: <Empty description="رویدادی ثبت نشده است" /> }}
        renderItem={item => <List.Item>
          <List.Item.Meta
            avatar={<CalendarOutlined style={{ fontSize: 26, color: '#8B1A6B' }} />}
            title={<Space><strong>{item.title}</strong><Tag color="purple">{item.eventType === 'meeting' ? 'جلسه' : 'رویداد'}</Tag></Space>}
            description={<Space direction="vertical" size={2}>
              <span>شمسی: {item.persianStartDate} | میلادی: {item.gregorianStartDate}</span>
              <span>{new Date(item.startAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} تا {new Date(item.endAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
              {item.location && <span><EnvironmentOutlined /> {item.location}</span>}
              <span><TeamOutlined /> {item.attendees.length} شرکت‌کننده</span>
            </Space>}
          />
        </List.Item>} />
    </Card>

    <Modal title="ایجاد جلسه یا رویداد" open={open} onCancel={() => setOpen(false)}
      onOk={() => void create()} confirmLoading={saving} okText="ثبت رویداد" cancelText="انصراف" width={620}>
      <Form form={form} layout="vertical" initialValues={{ eventType: 'meeting' }}>
        <Form.Item name="title" label="عنوان" rules={[{ required: true, message: 'عنوان الزامی است' }]}><Input /></Form.Item>
        <Form.Item name="range" label="زمان شروع و پایان" rules={[{ required: true, message: 'زمان را انتخاب کنید' }]}>
          <DatePicker.RangePicker showTime format="YYYY/MM/DD HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="eventType" label="نوع"><Select options={[{ value: 'meeting', label: 'جلسه' }, { value: 'event', label: 'رویداد' }, { value: 'reminder', label: 'یادآوری' }]} /></Form.Item>
        <Form.Item name="attendeeUserIds" label="شرکت‌کنندگان داخلی"><Select mode="multiple" showSearch optionFilterProp="label"
          options={users.map(u => ({ value: u.id, label: u.fullName || u.username }))} /></Form.Item>
        <Form.Item name="location" label="محل جلسه"><Input /></Form.Item>
        <Form.Item name="onlineMeetingUrl" label="لینک جلسه آنلاین"><Input /></Form.Item>
        <Form.Item name="description" label="توضیحات"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  </div>
}
