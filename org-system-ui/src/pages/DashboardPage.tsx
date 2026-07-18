import { useEffect, useState } from 'react'
import { Card, Row, Col, Badge, Button, Modal, Form, Input, Select, Tag, Space, Avatar, List, Progress, Divider, Tabs, Empty, DatePicker, TimePicker, Alert, message, Checkbox } from 'antd'
import type { Dayjs } from 'dayjs'
import PersianDatePicker from '../components/PersianDatePicker'
import { currentJalali, isLeapJalali, jalaliToDate } from '../utils/jalali'
import { getIranHoliday } from '../utils/iranHolidays'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'
import {
  MailOutlined, CheckSquareOutlined, CustomerServiceOutlined,
  PlusOutlined, BellOutlined, ClockCircleOutlined,
  CalendarOutlined, RightOutlined, LeftOutlined, UserOutlined, DeleteOutlined, TeamOutlined, FileTextOutlined, MessageOutlined
} from '@ant-design/icons'

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const PERSIAN_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

interface CalEvent {
  id: string
  title: string
  date: string
  time?: string
  type: 'meeting' | 'task' | 'reminder'
  color: string
}

const EVENT_COLORS = {
  meeting: '#1677ff',
  task: '#52c41a',
  reminder: '#fa8c16',
}

function getDaysInMonth(month: number, year: number): number {
  if (month <= 6) return 31
  if (month <= 11) return 30
  return isLeapJalali(year) ? 30 : 29
}

function getFirstDayOfMonth(month: number, year: number): number {
  const jsWeekday = jalaliToDate(`${year}/${month}/1`).getDay()
  return (jsWeekday + 1) % 7
}

const INITIAL_EVENTS: CalEvent[] = [
  { id: '1', title: 'جلسه هیئت مدیره', date: '1403/4/15', time: '۱۰:۰۰', type: 'meeting', color: '#1677ff' },
  { id: '2', title: 'مهلت تحویل گزارش', date: '1403/4/18', type: 'task', color: '#52c41a' },
  { id: '3', title: 'جلسه با مشتریان', date: '1403/4/20', time: '۱۴:۰۰', type: 'meeting', color: '#1677ff' },
  { id: '4', title: 'بررسی قراردادها', date: '1403/4/22', type: 'reminder', color: '#fa8c16' },
]

const USERS = ['مدیر سیستم', 'علی محمدی', 'مریم احمدی', 'رضا کریمی']
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
const API = 'http://localhost:5043/api/v1'
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` })
interface PersonOption { key: string; type: 'user' | 'contact'; id: string; name: string; detail: string }
interface LetterOption { id: string; subject: string; letterNumber?: string }
interface TaskOption { id: string; title: string }
function currentPersian() { return currentJalali() }

function EnhancedEventModal(props: any) {
  const { open,onCancel,onSave,saving,form,error,people,letters,tasks,persianDate,setPersianDate,relatedPeople,setRelatedPeople,relatedLetters,setRelatedLetters,relatedTasks,setRelatedTasks }=props
  return <Modal title="رویداد جدید" open={open} onCancel={onCancel} onOk={onSave} confirmLoading={saving} okText="ذخیره" cancelText="بازگشت" width={800}>
    {error&&<Alert type="error" showIcon message={error} style={{marginBottom:12}}/>}
    <Form form={form} layout="vertical" initialValues={{type:'meeting'}}><Tabs items={[
      {key:'details',label:'مشخصات رویداد',children:<Row gutter={16}>
        <Col xs={24} md={12}><Form.Item name="title" label="عنوان رویداد" rules={[{required:true}]}><Input/></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="type" label="نوع رویداد"><Select options={[{value:'meeting',label:'جلسه'},{value:'task',label:'وظیفه'},{value:'reminder',label:'یادآوری'}]}/></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="تاریخ شمسی" required><PersianDatePicker value={persianDate} onChange={setPersianDate} placeholder="انتخاب تاریخ شمسی"/></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name="startTime" label="ساعت شروع" rules={[{required:true}]}><TimePicker format="HH:mm" minuteStep={5} style={{width:'100%'}}/></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name="endTime" label="ساعت پایان" rules={[{required:true}]}><TimePicker format="HH:mm" minuteStep={5} style={{width:'100%'}}/></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="location" label="مکان"><Input/></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="organizer" label="برگزارکننده"><Select allowClear showSearch optionFilterProp="label" options={people.map((p:PersonOption)=>({value:p.key,label:p.name+' — '+p.detail}))}/></Form.Item></Col>
        <Col span={24}><Form.Item name="description" label="توضیحات"><Input.TextArea rows={3}/></Form.Item></Col>
        <Col span={24}><Form.Item name="sendSms" valuePropName="checked"><Checkbox>برای افراد مرتبط پیامک دعوت جلسه ارسال شود</Checkbox></Form.Item></Col>
      </Row>},
      {key:'people',label:'افراد مرتبط',children:<Select mode="multiple" showSearch optionFilterProp="label" style={{width:'100%'}} value={relatedPeople} onChange={setRelatedPeople} options={people.map((p:PersonOption)=>({value:p.key,label:p.name+' — '+p.detail}))}/>},
      {key:'agenda',label:'دستور جلسه',children:<EventAgendaTab/>},{key:'minutes',label:'صورتجلسه و اقدامات',children:<EventMinutesTab/>},
      {key:'letters',label:'ارتباط با نامه',children:<Select mode="multiple" showSearch optionFilterProp="label" style={{width:'100%'}} value={relatedLetters} onChange={setRelatedLetters} options={letters.map((l:LetterOption)=>({value:l.id,label:(l.letterNumber||'بدون شماره')+' — '+l.subject}))}/>},
      {key:'tasks',label:'ارتباط با وظایف',children:<Select mode="multiple" showSearch optionFilterProp="label" style={{width:'100%'}} value={relatedTasks} onChange={setRelatedTasks} options={tasks.map((t:TaskOption)=>({value:t.id,label:t.title}))}/>} ]}/></Form>
  </Modal>
}

// ── هدر داشبورد ──────────────────────────────────────
function DashboardHeader() {
  const now = new Date()
  const persianDate = new Intl.DateTimeFormat('fa-IR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).format(now)
  const persianTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
  const gregorianDate = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  return (
    <Card
      style={{ borderRadius: 16, background: 'linear-gradient(135deg, #ad2185 0%, #963c7c 50%, #bd579f 100%)', border: 'none' }}
      styles={{ body: { padding: '16px 24px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' }}>
            <UserOutlined style={{ fontSize: 24, color: 'white' }} />
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>خوش آمدید</div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{user.fullName || 'مدیر سیستم'}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{user.position || 'مدیرعامل'}</div>
          </div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 22, direction: 'rtl' }}>{persianTime}</div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 500 }}>{persianDate}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{gregorianDate}</div>
        </div>
      </div>
    </Card>
  )
}

// ── تب افراد مرتبط ──────────────────────────────────
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
        <span style={{ color: '#8c8c8c', fontSize: 13 }}>افراد شرکت‌کننده در رویداد را تعریف کنید</span>
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
            <Space><Avatar size={28} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} /><span style={{ fontSize: 13 }}>{p.name}</span></Space>
            <Tag color="blue">{p.role}</Tag>
            <Tag color={p.status === 'confirmed' ? 'green' : 'orange'}>{p.status === 'confirmed' ? 'تأیید شده' : 'در انتظار'}</Tag>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setPeople(prev => prev.filter(x => x.id !== p.id))} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── تب دستور جلسه ────────────────────────────────────
function EventAgendaTab() {
  const [items, setItems] = useState([{ id: '1', title: 'بررسی گزارش عملکرد ماهانه', duration: '۱۵ دقیقه', presenter: 'مدیر مالی' }])
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
              <Button type="primary" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => agendaForm.validateFields().then(v => { setItems(p => [...p, { id: Date.now().toString(), ...v }]); agendaForm.resetFields(); setShowAdd(false) })}>افزودن</Button>
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

// ── تب صورتجلسه ──────────────────────────────────────
function EventMinutesTab() {
  const [actions, setActions] = useState<{ id: string; title: string; assignee: string; deadline: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [minutesForm] = Form.useForm()

  return (
    <div>
      <Form.Item label="ثبت صورتجلسه">
        <Input.TextArea rows={3} placeholder="خلاصه مذاکرات و تصمیمات جلسه..." />
      </Form.Item>
          <Divider>اقدامات</Divider>
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
              <Button type="primary" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => minutesForm.validateFields().then(v => { setActions(p => [...p, { id: Date.now().toString(), ...v }]); minutesForm.resetFields(); setShowAdd(false) })}>افزودن</Button>
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

// ── تب ارتباط با نامه ────────────────────────────────
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

// ── تب ارتباط با کار ─────────────────────────────────
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

// ── Main Dashboard ────────────────────────────────────
export default function DashboardPage() {
  const navigate=useNavigate()
  const {notifications:storedNotifications,markAsRead}=useNotificationStore()
  const today=currentPersian()
  const [currentMonth, setCurrentMonth] = useState(today.month)
  const [currentYear, setCurrentYear] = useState(today.year)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [eventModal, setEventModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [dayEventsModal, setDayEventsModal] = useState(false)
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalEvent[]>([])
  const [eventForm] = Form.useForm()
  const [peopleOptions,setPeopleOptions]=useState<PersonOption[]>([]),[letterOptions,setLetterOptions]=useState<LetterOption[]>([]),[taskOptions,setTaskOptions]=useState<TaskOption[]>([])
  const [eventOptionsLoaded,setEventOptionsLoaded]=useState(false)
  const [relatedPeople,setRelatedPeople]=useState<string[]>([]),[relatedLetters,setRelatedLetters]=useState<string[]>([]),[relatedTasks,setRelatedTasks]=useState<string[]>([])
  const [persianEventDate,setPersianEventDate]=useState('')
  const [calendarError,setCalendarError]=useState(''),[savingEvent,setSavingEvent]=useState(false)
  const [summary,setSummary]=useState<any>({newLetters:0,activeTasks:0,openTickets:0,todayEvents:0,recentLetters:[],recentTasks:[]})
  const currentUser=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})()
  const grantedPermissions:string[]=(()=>{try{return JSON.parse(localStorage.getItem('permissions')||'[]')}catch{return []}})()
  const allowed=(code:string)=>(Array.isArray(currentUser.roles)&&currentUser.roles.includes('Admin'))||grantedPermissions.includes(code)

  const loadCalendar=async()=>{setCalendarError('');try{const response=await fetch(`${API}/calendar`,{headers:authHeaders()});if(!response.ok)throw new Error('تقویم از backend دریافت نشد');const ev=await response.json();setEvents(ev.map((e:any)=>({id:e.id,title:e.title,date:e.persianStartDate.replace(/\/0/g,'/'),time:new Date(e.startAt).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}),type:e.eventType,color:EVENT_COLORS[e.eventType as keyof typeof EVENT_COLORS]||'#1677ff'})))}catch(e){setCalendarError(e instanceof Error?e.message:'خطای اتصال')}}
  const loadEventOptions=async()=>{if(eventOptionsLoaded)return;const [dr,lr,tr]=await Promise.all([fetch(`${API}/directory`,{headers:authHeaders()}),fetch(`${API}/letters?scope=mailbox`,{headers:authHeaders()}),fetch(`${API}/tasks`,{headers:authHeaders()})]);const directory=dr.ok?await dr.json():{users:[],contacts:[]};setPeopleOptions([...(directory.users||[]).map((u:any)=>({key:`user:${u.id}`,type:'user',id:u.id,name:u.fullName||u.username,detail:u.department||'کاربر داخلی'})),...(directory.contacts||[]).map((c:any)=>({key:`contact:${c.id}`,type:'contact',id:c.id,name:c.fullName,detail:c.companyName||'مخاطب'}))]);setLetterOptions(lr.ok?await lr.json():[]);setTaskOptions(tr.ok?await tr.json():[]);setEventOptionsLoaded(true)}
  useEffect(()=>{void loadCalendar();fetch(`${API}/dashboard/summary`,{headers:authHeaders()}).then(r=>r.ok?r.json():Promise.reject()).then(setSummary).catch(()=>setCalendarError('آمار داشبورد دریافت نشد'))},[])

  const daysInMonth = getDaysInMonth(currentMonth, currentYear)
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear)

  const getEventsForDay = (day: number) => events.filter(e => e.date === `${currentYear}/${currentMonth}/${day}`)
  const isHoliday = (day: number) => !!getIranHoliday(currentYear, currentMonth, day)
  const isFriday = (day: number) => ((firstDay + day - 1) % 7) === 6
  const isToday = (day: number) => day===today.day&&currentMonth===today.month&&currentYear===today.year
  const nextMonth=()=>{if(currentMonth===12){setCurrentMonth(1);setCurrentYear(year=>year+1)}else setCurrentMonth(month=>month+1)}
  const previousMonth=()=>{if(currentMonth===1){setCurrentMonth(12);setCurrentYear(year=>year-1)}else setCurrentMonth(month=>month-1)}
  const openNewEvent=(date:string)=>{setSelectedDate(date);setPersianEventDate(date);eventForm.resetFields();setEventModal(true);void loadEventOptions()}

  const handleDayClick = (day: number) => {
    const date = `${currentYear}/${currentMonth}/${day}`
    const dayEvents = getEventsForDay(day)
    if (dayEvents.length > 0) { setSelectedDayEvents(dayEvents); setSelectedDate(date); setDayEventsModal(true) }
    else if (allowed('calendar.create')) openNewEvent(date)
  }

  const handleAddEvent=async()=>{const v=await eventForm.validateFields() as {title:string;type:string;startTime:Dayjs;endTime:Dayjs;location?:string;organizer?:string;description?:string;sendSms?:boolean};if(!persianEventDate){message.error('تاریخ شمسی را انتخاب کنید');return}const start=jalaliToDate(persianEventDate),end=jalaliToDate(persianEventDate);start.setHours(v.startTime.hour(),v.startTime.minute(),0,0);end.setHours(v.endTime.hour(),v.endTime.minute(),0,0);if(end<=start){message.error('ساعت پایان باید بعد از شروع باشد');return}const person=(k:string,r:string)=>{const p=peopleOptions.find(x=>x.key===k);return p?{personType:p.type,personId:p.id,displayName:p.name,role:r}:null};setSavingEvent(true);try{const res=await fetch(`${API}/calendar`,{method:'POST',headers:authHeaders(),body:JSON.stringify({title:v.title,description:v.description,startAt:start.toISOString(),endAt:end.toISOString(),isAllDay:false,timeZone:'Asia/Tehran',eventType:v.type,location:v.location,onlineMeetingUrl:null,organizer:v.organizer?person(v.organizer,'organizer'):null,participants:relatedPeople.map(k=>person(k,'attendee')).filter(Boolean),relatedLetterIds:relatedLetters,relatedTaskIds:relatedTasks,sendSms:!!v.sendSms})});if(!res.ok)throw new Error((await res.json()).message||'ثبت ناموفق بود');message.success('رویداد ثبت شد');setEventModal(false);setPersianEventDate('');await loadCalendar()}catch(e){message.error(e instanceof Error?e.message:'خطا')}finally{setSavingEvent(false)}}

  const stats = [
    { label: 'نامه‌های جدید', value: summary.newLetters, icon: <MailOutlined />, color: '#8B1A6B', bg: '#8B1A6B11', change: 'خوانده‌نشده' },
    { label: 'وظایف جاری', value: summary.activeTasks, icon: <CheckSquareOutlined />, color: '#1677ff', bg: '#e6f4ff', change: 'فعال' },
    { label: 'تیکت‌های باز', value: summary.openTickets, icon: <CustomerServiceOutlined />, color: '#fa8c16', bg: '#fff7e6', change: 'تخصیص‌یافته' },
    { label: 'رویدادهای امروز', value: summary.todayEvents, icon: <CalendarOutlined />, color: '#722ed1', bg: '#f9f0ff', change: 'امروز' },
    { label: 'کل نامه‌ها', value: summary.totalLetters||0, icon: <FileTextOutlined />, color: '#13c2c2', bg: '#e6fffb', change: 'ثبت‌شده در سامانه' },
    { label: 'کاربران فعال', value: summary.users||0, icon: <TeamOutlined />, color: '#52c41a', bg: '#f6ffed', change: 'کاربر فعال' },
  ]

  const notificationVisual=(type:string)=>({
    letter:{color:'#8B1A6B',icon:<MailOutlined/>},task:{color:'#1677ff',icon:<CheckSquareOutlined/>},ticket:{color:'#fa8c16',icon:<CustomerServiceOutlined/>},form:{color:'#52c41a',icon:<FileTextOutlined/>},calendar:{color:'#722ed1',icon:<CalendarOutlined/>},project:{color:'#2f54eb',icon:<TeamOutlined/>},chat:{color:'#13c2c2',icon:<MessageOutlined/>},warning:{color:'#f5222d',icon:<BellOutlined/>}
  }[type]||{color:'#8B1A6B',icon:<BellOutlined/>})
  const notifications: {id:string;text:string;time:string;color:string;icon:React.ReactNode;link?:string;isRead:boolean}[] = (storedNotifications.length?storedNotifications:(summary.notifications||[]).map((n:any)=>({id:n.id,type:String(n.type).toLowerCase(),title:n.title,description:n.body,time:new Date(n.createdAt).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}),link:n.actionUrl,isRead:n.isRead}))).slice(0,8).map((n:any)=>{const visual=notificationVisual(String(n.type).toLowerCase());return{id:n.id,text:`${n.title}${n.description?` — ${n.description}`:''}`,time:n.time||'',color:visual.color,icon:visual.icon,link:n.link,isRead:Boolean(n.isRead)}})
  const openNotification=(item:{id:string;link?:string})=>{markAsRead(item.id);void fetch(`${API}/notifications/${item.id}/read`,{method:'PATCH',headers:authHeaders()});if(item.link)navigate(item.link)}

  const recentLetters = summary.recentLetters.map((l:any)=>({id:l.id,subject:l.subject,from:l.fromUserName||'—',date:new Date(l.createdAt).toLocaleDateString('fa-IR'),status:String(l.status).toLowerCase(),color:'#8B1A6B'}))

  const STATUS_LABELS: Record<string, string> = {
    signed: 'امضا شده', sent: 'ارسال شده', received: 'دریافت', draft: 'پیش‌نویس'
  }

  const recentTasks = summary.recentTasks.map((t:any)=>({id:t.id,title:t.title,project:'',priority:String(t.priority).toLowerCase(),progress:t.progress}))

  const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    critical: { label: 'بحرانی', color: 'red' },
    high: { label: 'زیاد', color: 'orange' },
    medium: { label: 'متوسط', color: 'blue' },
    low: { label: 'کم', color: 'default' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <EnhancedEventModal open={eventModal} onCancel={()=>setEventModal(false)} onSave={handleAddEvent} saving={savingEvent} form={eventForm} error={calendarError}
        people={peopleOptions} letters={letterOptions} tasks={taskOptions} persianDate={persianEventDate} setPersianDate={setPersianEventDate} relatedPeople={relatedPeople} setRelatedPeople={setRelatedPeople}
        relatedLetters={relatedLetters} setRelatedLetters={setRelatedLetters} relatedTasks={relatedTasks} setRelatedTasks={setRelatedTasks}/>

      {/* هدر */}
      <DashboardHeader />

      {/* آمار */}
      <Row gutter={[12, 12]}>
        {stats.map((s, i) => (
          <Col xs={12} md={8} lg={4} key={i}>
            <Card style={{ background: s.bg, border: 'none', borderRadius: 10, borderTop: `3px solid ${s.color}` }} styles={{ body: { padding: '10px 14px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>{s.change}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: s.color }}>
                  {s.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* تقویم + اعلان‌ها */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          <Card
            styles={{ body: { padding: 16 } }}
            style={{ borderRadius: 12 }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button type="text" icon={<LeftOutlined />} onClick={nextMonth} />
                <span style={{ fontWeight: 700, fontSize: 16 }}>{PERSIAN_MONTHS[currentMonth - 1]} {currentYear}</span>
                <Button type="text" icon={<RightOutlined />} onClick={previousMonth} />
              </div>
            }
            extra={allowed('calendar.create') ?
              <Button type="primary" size="small" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}
                onClick={() => openNewEvent(`${currentYear}/${currentMonth}/1`)}>
                رویداد جدید
              </Button> : null
            }
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
                const holiday = isHoliday(day)
                const friday = isFriday(day)
                const today = isToday(day)
                return (
                  <div key={day} onClick={() => handleDayClick(day)}
                    style={{ minHeight: 68, border: `1px solid ${today ? '#8B1A6B' : '#f0f0f0'}`, borderRadius: 8, padding: '4px 6px', cursor: 'pointer', background: today ? '#8B1A6B11' : holiday || friday ? '#fff1f0' : 'white', transition: 'all 0.15s', boxShadow: today ? '0 0 0 2px #8B1A6B44' : 'none' }}
                    onMouseEnter={e => { if (!today) (e.currentTarget as HTMLDivElement).style.background = '#f9f0ff' }}
                    onMouseLeave={e => { if (!today) (e.currentTarget as HTMLDivElement).style.background = holiday || friday ? '#fff1f0' : 'white' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: today ? 700 : 400, color: holiday || friday ? '#f5222d' : today ? '#8B1A6B' : '#333', marginBottom: 2 }}>{day}</div>
                    {(holiday || friday) && <div title={getIranHoliday(currentYear, currentMonth, day) || 'جمعه'} style={{ fontSize: 8, color: '#cf1322', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getIranHoliday(currentYear, currentMonth, day) || 'جمعه'}</div>}
                    {dayEvents.slice(0, 2).map(ev => (
                      <div key={ev.id} style={{ background: ev.color, color: 'white', borderRadius: 3, padding: '1px 4px', fontSize: 9, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.time && `${ev.time} `}{ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div style={{ fontSize: 9, color: '#8B1A6B' }}>+{dayEvents.length - 2}</div>}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#8c8c8c', justifyContent: 'center' }}>
              <span><span style={{ color: '#1677ff' }}>●</span> جلسه</span>
              <span><span style={{ color: '#52c41a' }}>●</span> وظیفه</span>
              <span><span style={{ color: '#fa8c16' }}>●</span> یادآوری</span>
              <span><span style={{ color: '#f5222d' }}>●</span> تعطیل</span>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<Space><BellOutlined style={{ color: '#fa8c16' }} /><span>اعلان‌ها</span><Badge count={notifications.filter(n=>!n.isRead).length} style={{ background: '#fa8c16' }} /></Space>}
            styles={{ body: { padding: '8px 16px' }, header: { minHeight: 44 } }}
            style={{ borderRadius: 12, height: '100%' }}
          >
            {notifications.map(n => (
              <div key={n.id} onClick={()=>openNotification(n)} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #fafafa', alignItems: 'flex-start',cursor:n.link?'pointer':'default',background:n.isRead?'transparent':'#faf5ff',borderRadius:6 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${n.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: n.color, fontSize: 13, flexShrink: 0 }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#333', lineHeight: 1.4 }}>{n.text}</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 2 }}>{n.time}</div>
                </div>
              </div>
            ))}
            {notifications.length===0&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="اعلان جدیدی ندارید" />}
          </Card>
        </Col>
      </Row>

      {/* نامه‌ها + وظایف */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            title={<Space><MailOutlined style={{ color: '#8B1A6B' }} /><span>آخرین نامه‌ها</span></Space>}
            extra={<Button type="link" size="small">همه نامه‌ها</Button>}
            styles={{ body: { padding: '8px 16px' }, header: { minHeight: 44 } }}
            style={{ borderRadius: 12 }}
          >
            {recentLetters.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #fafafa' }}>
                <Avatar size={32} style={{ background: l.color, fontSize: 13, flexShrink: 0 }}>{l.from.charAt(0)}</Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.subject}</div>
                  <div style={{ fontSize: 10, color: '#8c8c8c' }}>{l.from} — {l.date}</div>
                </div>
                <Tag color={l.color} style={{ fontSize: 10, flexShrink: 0 }}>{STATUS_LABELS[l.status] || l.status}</Tag>
              </div>
            ))}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<Space><CheckSquareOutlined style={{ color: '#1677ff' }} /><span>وظایف جاری</span></Space>}
            extra={<Button type="link" size="small">همه وظایف</Button>}
            styles={{ body: { padding: '8px 16px' }, header: { minHeight: 44 } }}
            style={{ borderRadius: 12 }}
          >
            {recentTasks.map((t: any) => (
              <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 8 }}>{t.title}</div>
                  <Tag color={PRIORITY_CONFIG[t.priority].color} style={{ fontSize: 10, flexShrink: 0 }}>{PRIORITY_CONFIG[t.priority].label}</Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress percent={t.progress} size="small" style={{ flex: 1, marginBottom: 0 }} strokeColor={t.priority === 'critical' ? '#f5222d' : t.priority === 'high' ? '#fa8c16' : '#8B1A6B'} />
                  <span style={{ fontSize: 10, color: '#8c8c8c', width: 28 }}>{t.progress}%</span>
                </div>
                <div style={{ fontSize: 10, color: '#8c8c8c' }}>{t.project}</div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Modal ثبت رویداد */}
      <Modal
        title={<Space><CalendarOutlined style={{ color: '#8B1A6B' }} /><span>رویداد جدید</span><Tag color="purple">{selectedDate}</Tag></Space>}
        open={false} onOk={handleAddEvent} onCancel={() => setEventModal(false)}
        okText="ذخیره" cancelText="بازگشت" width={780}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={eventForm} layout="vertical">
          <Tabs items={[
            {
              key: '1', label: 'مشخصات رویداد',
              children: (
                <Row gutter={16}>
                  <Col xs={24} md={12}><Form.Item name="title" label="عنوان رویداد" rules={[{ required: true }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="type" label="نوع رویداد" initialValue="meeting"><Select><Select.Option value="meeting">🔵 جلسه</Select.Option><Select.Option value="task">🟢 وظیفه</Select.Option><Select.Option value="reminder">🟡 یادآوری</Select.Option></Select></Form.Item></Col>
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
            { key: '6', label: 'ارتباط با وظایف', children: <EventTasksTab /> },
          ]} />
        </Form>
      </Modal>

      {/* Modal رویدادهای روز */}
      <Modal
        title={<Space><CalendarOutlined style={{ color: '#8B1A6B' }} /><span>رویدادهای {selectedDate}</span></Space>}
        open={dayEventsModal} onCancel={() => setDayEventsModal(false)}
        footer={[
          allowed('calendar.create') ? <Button key="add" type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}
            onClick={() => { setDayEventsModal(false); openNewEvent(selectedDate) }}>رویداد جدید</Button> : null,
          <Button key="close" onClick={() => setDayEventsModal(false)}>بستن</Button>
        ].filter(Boolean)}
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
