import { useState } from 'react'
import { Card, Row, Col, Badge, Button, Modal, Form, Input, Select, Tag, Space, Avatar, List, Progress, Divider, Tabs, Empty } from 'antd'
import {
  MailOutlined, CheckSquareOutlined, CustomerServiceOutlined,
  PlusOutlined, BellOutlined, ClockCircleOutlined,
  CalendarOutlined, RightOutlined, LeftOutlined, UserOutlined, DeleteOutlined
} from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts'
import { useNavigate } from 'react-router-dom'
import {
  SAMPLE_PROJECTS, SAMPLE_TASKS, SAMPLE_RISKS,
  getPriorityColor, getStatusColor, formatCurrency, USERS
} from './ptmsData'
import type { Risk, Task } from './ptmsData'

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const PERSIAN_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const COLORS = ['#8B1A6B', '#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1']

interface CalEvent {
  id: string; title: string; date: string; time?: string
  type: 'meeting' | 'task' | 'reminder'; color: string
}

function getDaysInMonth(month: number): number {
  return month <= 6 ? 31 : month <= 11 ? 30 : 29
}

function getFirstDayOfMonth(month: number, year: number): number {
  const totalDays = (year - 1400) * 365 + Math.floor((year - 1400) / 4) +
    [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336][month - 1]
  return ((totalDays + 6) % 7)
}

// ── تب افراد مرتبط ────────────────────────────────────
function EventPeopleTab() {
  const [people, setPeople] = useState([
    { id: '1', name: 'مدیر سیستم', role: 'برگزارکننده', status: 'confirmed' },
    { id: '2', name: 'علی محمدی', role: 'شرکت‌کننده', status: 'pending' },
  ])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('شرکت‌کننده')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#8c8c8c', fontSize: 13 }}>افراد شرکت‌کننده در رویداد</span>
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>افزودن</Button>
      </div>
      {showAdd && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: 12, background: '#f0f7ff', borderRadius: 8 }}>
          <Select value={newName} onChange={setNewName} style={{ flex: 1 }} placeholder="انتخاب شخص">
            {USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}
          </Select>
          <Select value={newRole} onChange={setNewRole} style={{ width: 140 }}>
            {['برگزارکننده', 'شرکت‌کننده', 'دعوت‌شده', 'ناظر'].map(r => <Select.Option key={r} value={r}>{r}</Select.Option>)}
          </Select>
          <Button type="primary" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => {
            if (newName) { setPeople(p => [...p, { id: Date.now().toString(), name: newName, role: newRole, status: 'pending' }]); setNewName(''); setShowAdd(false) }
          }}>افزودن</Button>
          <Button onClick={() => setShowAdd(false)}>انصراف</Button>
        </div>
      )}
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 60px', padding: '8px 12px', background: '#fafafa', fontSize: 12, fontWeight: 600, color: '#8c8c8c' }}>
          <div>نام</div><div>نقش</div><div>وضعیت</div><div></div>
        </div>
        {people.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 60px', padding: '10px 12px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
            <Space><Avatar size={28} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} /><span>{p.name}</span></Space>
            <Tag color="blue">{p.role}</Tag>
            <Tag color={p.status === 'confirmed' ? 'green' : 'orange'}>{p.status === 'confirmed' ? 'تأیید شده' : 'در انتظار'}</Tag>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setPeople(prev => prev.filter(x => x.id !== p.id))} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── تب دستور جلسه ─────────────────────────────────────
function EventAgendaTab() {
  const [items, setItems] = useState([{ id: '1', title: 'بررسی گزارش عملکرد', duration: '۱۵ دقیقه', presenter: 'مدیر مالی' }])
  const [showAdd, setShowAdd] = useState(false)
  const [agendaForm] = Form.useForm()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#8c8c8c', fontSize: 13 }}>دستور جلسه را تعریف کنید</span>
        <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setShowAdd(true)} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>افزودن بند</Button>
      </div>
      {showAdd && (
        <Card size="small" style={{ marginBottom: 12, background: '#f0f7ff' }}>
          <Form form={agendaForm} layout="vertical">
            <Row gutter={12}>
              <Col span={12}><Form.Item name="title" label="عنوان" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="duration" label="مدت"><Input placeholder="۱۵ دقیقه" /></Form.Item></Col>
              <Col span={6}><Form.Item name="presenter" label="ارائه‌دهنده"><Select allowClear>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
            </Row>
            <Space>
              <Button type="primary" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => { agendaForm.validateFields().then(v => { setItems(p => [...p, { id: Date.now().toString(), ...v }]); agendaForm.resetFields(); setShowAdd(false) }) }}>افزودن</Button>
              <Button onClick={() => setShowAdd(false)}>انصراف</Button>
            </Space>
          </Form>
        </Card>
      )}
      {items.length === 0 ? <Empty description="دستور جلسه‌ای تعریف نشده" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 140px 60px', padding: '8px 12px', background: '#fafafa', fontSize: 12, fontWeight: 600, color: '#8c8c8c' }}>
            <div>#</div><div>عنوان</div><div>مدت</div><div>ارائه‌دهنده</div><div></div>
          </div>
          {items.map((item, idx) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 140px 60px', padding: '10px 12px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: '#8B1A6B' }}>{idx + 1}</div>
              <div style={{ fontSize: 13 }}>{item.title}</div>
              <Tag>{item.duration || '—'}</Tag>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>{item.presenter || '—'}</span>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setItems(p => p.filter(x => x.id !== item.id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── تب صورتجلسه ───────────────────────────────────────
function EventMinutesTab() {
  const [actions, setActions] = useState<{ id: string; title: string; assignee: string; deadline: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [minutesForm] = Form.useForm()

  return (
    <div>
      <Form.Item label="ثبت صورتجلسه">
        <Input.TextArea rows={3} placeholder="خلاصه مذاکرات و تصمیمات جلسه..." />
      </Form.Item>
      <Divider>ثبت اقدامات</Divider>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button size="small" type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setShowAdd(true)}>اقدام جدید</Button>
      </div>
      {showAdd && (
        <Card size="small" style={{ marginBottom: 12, background: '#f0f7ff' }}>
          <Form form={minutesForm} layout="vertical">
            <Row gutter={12}>
              <Col span={12}><Form.Item name="title" label="شرح اقدام" rules={[{ required: true }]}><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="assignee" label="اقدام‌کننده"><Select allowClear>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
              <Col span={6}><Form.Item name="deadline" label="تاریخ خاتمه"><Input placeholder="۱۴۰۳/۰۵/۰۱" /></Form.Item></Col>
            </Row>
            <Space>
              <Button type="primary" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => { minutesForm.validateFields().then(v => { setActions(p => [...p, { id: Date.now().toString(), ...v }]); minutesForm.resetFields(); setShowAdd(false) }) }}>افزودن</Button>
              <Button onClick={() => setShowAdd(false)}>انصراف</Button>
            </Space>
          </Form>
        </Card>
      )}
      {actions.length === 0 ? <Empty description="اقدامی ثبت نشده" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          {actions.map(a => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 50px', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
              <span>{a.title}</span>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>{a.assignee || '—'}</span>
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>{a.deadline || '—'}</span>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setActions(p => p.filter(x => x.id !== a.id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── تب ارتباط با نامه ─────────────────────────────────
function EventLettersTab() {
  const [letters, setLetters] = useState<{ id: string; number: string; subject: string; date: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const sampleLetters = [
    { number: 'د/۱۴۰۳/۰۱۵۲', subject: 'درخواست بودجه سالانه', date: '۱۴۰۳/۰۴/۱۵' },
    { number: 'ص/۱۴۰۳/۰۰۹۵', subject: 'قرارداد همکاری شرکت آلفا', date: '۱۴۰۳/۰۴/۱۴' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#8c8c8c', fontSize: 13 }}>نامه‌های مرتبط با این رویداد</span>
        <Button size="small" type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setShowAdd(true)}>افزودن نامه</Button>
      </div>
      {showAdd && (
        <Card size="small" style={{ marginBottom: 12, background: '#f0f7ff' }}>
          <Select style={{ width: '100%', marginBottom: 8 }} placeholder="انتخاب نامه..."
            onChange={(v: string) => { const l = sampleLetters.find(x => x.number === v); if (l) { setLetters(p => [...p, { id: Date.now().toString(), ...l }]); setShowAdd(false) } }}>
            {sampleLetters.map(l => <Select.Option key={l.number} value={l.number}><Tag color="purple">{l.number}</Tag> {l.subject}</Select.Option>)}
          </Select>
          <Button size="small" onClick={() => setShowAdd(false)}>انصراف</Button>
        </Card>
      )}
      {letters.length === 0 ? <Empty description="نامه‌ای انتخاب نشده" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
          {letters.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <Tag color="purple">{l.number}</Tag>
              <span style={{ flex: 1 }}>{l.subject}</span>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}>{l.date}</span>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setLetters(p => p.filter(x => x.id !== l.id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── تب ارتباط با کار ──────────────────────────────────
function EventTasksTab() {
  const [tasks, setTasks] = useState<{ id: string; title: string; project: string; assignee: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const sampleTasks = [
    { title: 'تهیه گزارش جامع فناوری', project: 'بانک تجارت', assignee: 'علی محمدی' },
    { title: 'طراحی سامانه حسابرسی', project: 'بانک تجارت', assignee: 'مریم احمدی' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#8c8c8c', fontSize: 13 }}>کارها و وظایف مرتبط</span>
        <Button size="small" type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setShowAdd(true)}>افزودن کار</Button>
      </div>
      {showAdd && (
        <Card size="small" style={{ marginBottom: 12, background: '#f0f7ff' }}>
          <Select style={{ width: '100%', marginBottom: 8 }} placeholder="انتخاب کار..."
            onChange={(v: number) => { const t = sampleTasks[v]; if (t) { setTasks(p => [...p, { id: Date.now().toString(), ...t }]); setShowAdd(false) } }}>
            {sampleTasks.map((t, i) => <Select.Option key={i} value={i}><Tag color="blue">{t.project}</Tag> {t.title}</Select.Option>)}
          </Select>
          <Button size="small" onClick={() => setShowAdd(false)}>انصراف</Button>
        </Card>
      )}
      {tasks.length === 0 ? <Empty description="کاری انتخاب نشده" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <Tag color="blue">{t.project}</Tag>
              <span style={{ flex: 1 }}>{t.title}</span>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}>{t.assignee}</span>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setTasks(p => p.filter(x => x.id !== t.id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────
export default function PTMSDashboardPage() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(4)
  const [currentYear] = useState(1403)
  const [events, setEvents] = useState<CalEvent[]>([
    { id: '1', title: 'جلسه هیئت مدیره', date: '1403/4/15', time: '۱۰:۰۰', type: 'meeting', color: '#1677ff' },
    { id: '2', title: 'مهلت تحویل گزارش', date: '1403/4/18', type: 'task', color: '#52c41a' },
    { id: '3', title: 'جلسه با مشتریان', date: '1403/4/20', time: '۱۴:۰۰', type: 'meeting', color: '#1677ff' },
    { id: '4', title: 'بررسی قراردادها', date: '1403/4/22', type: 'reminder', color: '#fa8c16' },
  ])
  const [eventModal, setEventModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [dayEventsModal, setDayEventsModal] = useState(false)
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalEvent[]>([])
  const [eventForm] = Form.useForm()

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear)

  const getEventsForDay = (day: number) =>
    events.filter(e => e.date === `${currentYear}/${currentMonth}/${day}`)

  const isFriday = (day: number) => ((firstDay + day - 1) % 7) === 6
  const isToday = (day: number) => day === 15 && currentMonth === 4

  const handleDayClick = (day: number) => {
    const date = `${currentYear}/${currentMonth}/${day}`
    const dayEvents = getEventsForDay(day)
    if (dayEvents.length > 0) { setSelectedDayEvents(dayEvents); setSelectedDate(date); setDayEventsModal(true) }
    else { setSelectedDate(date); eventForm.resetFields(); setEventModal(true) }
  }

  const handleAddEvent = () => {
    eventForm.validateFields().then(values => {
      setEvents(prev => [...prev, {
        id: Date.now().toString(), date: selectedDate,
        color: values.type === 'meeting' ? '#1677ff' : values.type === 'task' ? '#52c41a' : '#fa8c16',
        ...values
      }])
      setEventModal(false)
    })
  }

  const activeProjects = SAMPLE_PROJECTS.filter(p => p.status === 'در حال اجرا').length
  const myTasks = SAMPLE_TASKS.filter(t => t.assignee === 'مدیر سیستم')
  const activeRisks = SAMPLE_RISKS.filter(r => r.status === 'فعال')

  const stats = [
    { label: 'کل پروژه‌ها', value: SAMPLE_PROJECTS.length, icon: <CheckSquareOutlined />, color: '#8B1A6B', bg: '#8B1A6B11', sub: `${activeProjects} فعال` },
    { label: 'وظایف باز من', value: myTasks.filter(t => t.status !== 'تکمیل شده').length, icon: <CheckSquareOutlined />, color: '#1677ff', bg: '#e6f4ff', sub: 'در حال انجام' },
    { label: 'ریسک‌های فعال', value: activeRisks.length, icon: <BellOutlined />, color: '#fa8c16', bg: '#fff7e6', sub: `${SAMPLE_RISKS.filter(r => r.level === 'بحرانی').length} بحرانی` },
    { label: 'رویدادهای امروز', value: getEventsForDay(15).length, icon: <CalendarOutlined />, color: '#722ed1', bg: '#f9f0ff', sub: 'جلسه ۱۰:۰۰' },
  ]

  const projectStatusData = [
    { name: 'در حال اجرا', value: SAMPLE_PROJECTS.filter(p => p.status === 'در حال اجرا').length },
    { name: 'تعریف شده', value: SAMPLE_PROJECTS.filter(p => p.status === 'تعریف شده').length },
    { name: 'تکمیل شده', value: SAMPLE_PROJECTS.filter(p => p.status === 'تکمیل شده').length },
  ].filter(d => d.value > 0)

  const progressData = [
    { month: 'فروردین', planned: 10, actual: 8 },
    { month: 'اردیبهشت', planned: 20, actual: 18 },
    { month: 'خرداد', planned: 35, actual: 30 },
    { month: 'تیر', planned: 50, actual: 45 },
  ]

  const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* آمار */}
      <Row gutter={[12, 12]}>
        {stats.map((s, i) => (
          <Col xs={12} md={6} key={i}>
            <Card style={{ background: s.bg, border: 'none', borderRadius: 12, borderTop: `3px solid ${s.color}` }} styles={{ body: { padding: '16px 20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>{s.sub}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: s.color }}>{s.icon}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* نمودارها */}
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card title="وضعیت پروژه‌ها" size="small" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={projectStatusData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {projectStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title="پیشرفت برنامه vs واقعی" size="small" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="planned" stroke="#1677ff" name="برنامه" strokeWidth={2} />
                <Line type="monotone" dataKey="actual" stroke="#8B1A6B" name="واقعی" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* تقویم + اعلان */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Card
            style={{ borderRadius: 12 }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button type="text" icon={<LeftOutlined />} onClick={() => setCurrentMonth(m => m < 12 ? m + 1 : 1)} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>{PERSIAN_MONTHS[currentMonth - 1]} {currentYear}</span>
                <Button type="text" icon={<RightOutlined />} onClick={() => setCurrentMonth(m => m > 1 ? m - 1 : 12)} />
              </div>
            }
            extra={<Button type="primary" size="small" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => { setSelectedDate(`${currentYear}/${currentMonth}/1`); eventForm.resetFields(); setEventModal(true) }}>رویداد جدید</Button>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {PERSIAN_DAYS.map((d, i) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '6px 0', color: i === 6 ? '#f5222d' : '#8c8c8c', background: '#fafafa', borderRadius: 6 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {Array(firstDay).fill(null).map((_, i) => <div key={`e-${i}`} />)}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1
                const dayEvents = getEventsForDay(day)
                const friday = isFriday(day)
                const today = isToday(day)
                return (
                  <div key={day} onClick={() => handleDayClick(day)} style={{ minHeight: 72, border: `1px solid ${today ? '#8B1A6B' : '#f0f0f0'}`, borderRadius: 8, padding: '4px 6px', cursor: 'pointer', background: today ? '#8B1A6B11' : friday ? '#fff1f0' : 'white', boxShadow: today ? '0 0 0 2px #8B1A6B44' : 'none', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!today) (e.currentTarget as HTMLDivElement).style.background = '#f9f0ff' }}
                    onMouseLeave={e => { if (!today) (e.currentTarget as HTMLDivElement).style.background = friday ? '#fff1f0' : 'white' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: today ? 700 : 400, color: friday ? '#f5222d' : today ? '#8B1A6B' : '#333', marginBottom: 2 }}>{day}</div>
                    {dayEvents.slice(0, 2).map(ev => (
                      <div key={ev.id} style={{ background: ev.color, color: 'white', borderRadius: 4, padding: '1px 4px', fontSize: 10, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.time && `${ev.time} `}{ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div style={{ fontSize: 10, color: '#8B1A6B' }}>+{dayEvents.length - 2}</div>}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#8c8c8c', justifyContent: 'center' }}>
              <span><span style={{ color: '#1677ff' }}>●</span> جلسه</span>
              <span><span style={{ color: '#52c41a' }}>●</span> وظیفه</span>
              <span><span style={{ color: '#fa8c16' }}>●</span> یادآوری</span>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Row gutter={[0, 12]}>
            <Col span={24}>
              <Card title={<Space><BellOutlined style={{ color: '#fa8c16' }} /><span>اعلان‌ها</span></Space>} size="small" style={{ borderRadius: 12 }}>
                {[
                  { text: 'نامه جدید از واحد مالی', time: '۱۰ دقیقه پیش', color: '#1677ff' },
                  { text: 'وظیفه جدید واگذار شد', time: '۱ ساعت پیش', color: '#52c41a' },
                  { text: 'ریسک بحرانی شناسایی شد', time: '۲ ساعت پیش', color: '#f5222d' },
                  { text: 'جلسه فردا ۱۰:۰۰', time: '۳ ساعت پیش', color: '#722ed1' },
                ].map((n, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #fafafa', alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.color, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{n.text}</div>
                      <div style={{ fontSize: 10, color: '#8c8c8c' }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </Col>
            <Col span={24}>
              <Card title={<Space><CheckSquareOutlined style={{ color: '#8B1A6B' }} /><span>پروژه‌های فعال</span></Space>} size="small" style={{ borderRadius: 12 }} extra={<Button type="link" size="small" onClick={() => navigate('/ptms/projects')}>همه</Button>}>
                {SAMPLE_PROJECTS.map(p => (
                  <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                      <Tag color={getStatusColor(p.status) as string} style={{ fontSize: 10 }}>{p.status}</Tag>
                    </div>
                    <Progress percent={p.progress} size="small" strokeColor="#8B1A6B" />
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* وظایف + ریسک */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card title={<Space><CheckSquareOutlined style={{ color: '#1677ff' }} /><span>وظایف من</span><Badge count={myTasks.filter(t => t.status !== 'تکمیل شده').length} style={{ background: '#1677ff' }} /></Space>} size="small" style={{ borderRadius: 12 }} extra={<Button type="link" size="small" onClick={() => navigate('/ptms/tasks/mine')}>همه</Button>}>
            {myTasks.slice(0, 4).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #fafafa' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.status === 'تکمیل شده' ? '#52c41a' : t.status === 'در حال انجام' ? '#1677ff' : '#fa8c16', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>{t.project}</div>
                </div>
                <Tag color={getPriorityColor(t.priority) as string} style={{ fontSize: 10 }}>{t.priority}</Tag>
                {t.deadline && <span style={{ fontSize: 10, color: '#f5222d' }}><ClockCircleOutlined /> {t.deadline}</span>}
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><BellOutlined style={{ color: '#fa8c16' }} /><span>ریسک‌های بحرانی</span></Space>} size="small" style={{ borderRadius: 12 }} extra={<Button type="link" size="small" onClick={() => navigate('/ptms/risks')}>همه</Button>}>
            {SAMPLE_RISKS.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #fafafa' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.level === 'بحرانی' ? '#f5222d' : '#fa8c16', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{r.title}</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>{r.project}</div>
                </div>
                <Tag color={r.level === 'بحرانی' ? 'red' : 'orange'} style={{ fontSize: 10 }}>امتیاز: {r.score}</Tag>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Modal ثبت رویداد */}
      <Modal
        title={<Space><CalendarOutlined style={{ color: '#8B1A6B' }} /><span>رویداد جدید</span><Tag color="purple">{selectedDate}</Tag></Space>}
        open={eventModal} onOk={handleAddEvent} onCancel={() => setEventModal(false)}
        okText="ذخیره" cancelText="بازگشت" width={780}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={eventForm} layout="vertical">
          <Tabs items={[
            {
              key: '1', label: 'مشخصات رویداد',
              children: (
                <Row gutter={16}>
                  <Col xs={24} md={12}><Form.Item name="title" label="عنوان" rules={[{ required: true }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="type" label="نوع" initialValue="meeting"><Select><Select.Option value="meeting">🔵 جلسه</Select.Option><Select.Option value="task">🟢 وظیفه</Select.Option><Select.Option value="reminder">🟡 یادآوری</Select.Option></Select></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item label="تاریخ"><Input value={selectedDate} readOnly /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="startTime" label="ساعت شروع"><Select allowClear>{HOURS.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="endTime" label="ساعت پایان"><Select allowClear>{HOURS.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="location" label="مکان"><Input placeholder="اتاق کنفرانس" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="organizer" label="برگزارکننده"><Select allowClear>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
                  <Col span={24}><Form.Item name="description" label="توضیحات"><Input.TextArea rows={2} /></Form.Item></Col>
                </Row>
              )
            },
            { key: '2', label: 'افراد مرتبط', children: <EventPeopleTab /> },
            { key: '3', label: 'دستور جلسه', children: <EventAgendaTab /> },
            { key: '4', label: 'صورتجلسه و اقدامات', children: <EventMinutesTab /> },
            { key: '5', label: 'ارتباط با نامه', children: <EventLettersTab /> },
            { key: '6', label: 'ارتباط با کار', children: <EventTasksTab /> },
          ]} />
        </Form>
      </Modal>

      {/* Modal رویدادهای روز */}
      <Modal
        title={<Space><CalendarOutlined style={{ color: '#8B1A6B' }} /><span>رویدادهای {selectedDate}</span></Space>}
        open={dayEventsModal} onCancel={() => setDayEventsModal(false)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => { setDayEventsModal(false); eventForm.resetFields(); setEventModal(true) }}>رویداد جدید</Button>,
          <Button key="close" onClick={() => setDayEventsModal(false)}>بستن</Button>
        ]}
        width={420}
      >
        <List dataSource={selectedDayEvents} renderItem={ev => (
          <List.Item>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{ev.title}</div>
                {ev.time && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{ev.time}</div>}
              </div>
              <Tag color={ev.type === 'meeting' ? 'blue' : ev.type === 'task' ? 'green' : 'orange'}>
                {ev.type === 'meeting' ? 'جلسه' : ev.type === 'task' ? 'وظیفه' : 'یادآوری'}
              </Tag>
            </div>
          </List.Item>
        )} />
      </Modal>
    </div>
  )
}
