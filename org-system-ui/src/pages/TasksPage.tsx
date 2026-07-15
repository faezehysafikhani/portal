import { useState } from 'react'
import { Card, Button, Tag, Space, Badge, Avatar, Tooltip, Modal, Form, Input, Select, Row, Col, Progress, Table } from 'antd'
//import {
 // PlusOutlined, UserOutlined, FlagOutlined,
 // AppstoreOutlined, UnorderedListOutlined,
//  ClockCircleOutlined, InfoCircleOutlined, MessageOutlined,
//} from '@ant-design/icons' 

import {
  PlusOutlined, UserOutlined, FlagOutlined,
  AppstoreOutlined, UnorderedListOutlined,
  ClockCircleOutlined, InfoCircleOutlined, MessageOutlined,
  CalendarOutlined,
} from '@ant-design/icons'


import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay,
  useDroppable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLocation } from 'react-router-dom'


interface Task {
  id: string
  title: string
  description?: string
  project: string
  status: 'todo' | 'inprogress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee?: string
  dueDate?: string
  progress: number
  approvalStatus?: 'pending' | 'approved' | 'rejected'
}

const PROJECTS = [
  { id: '1', name: 'کارهای بانک تجارت', color: '#1677ff' },
  { id: '2', name: 'کارهای توسعه‌ای اپ TMS', color: '#52c41a' },
  { id: '3', name: 'امور اداری', color: '#fa8c16' },
]

const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'تهیه گزارش جامع فناوری اطلاعات', project: 'کارهای بانک تجارت', status: 'todo', priority: 'high', assignee: 'علی', progress: 0 },
  { id: '2', title: 'طراحی و استقرار سامانه حسابرسی', project: 'کارهای بانک تجارت', status: 'inprogress', priority: 'critical', assignee: 'مریم', progress: 45, approvalStatus: 'pending' },
  { id: '3', title: 'بررسی لاگ منشور پروژه', project: 'کارهای بانک تجارت', status: 'inprogress', priority: 'medium', assignee: 'رضا', progress: 30, approvalStatus: 'pending' },
  { id: '4', title: 'انجام اصلاحات گزارش ارزیابی', project: 'کارهای بانک تجارت', status: 'review', priority: 'high', assignee: 'علی', progress: 80, approvalStatus: 'pending' },
  { id: '5', title: 'اصلاح گزارش پوینتر', project: 'کارهای بانک تجارت', status: 'review', priority: 'low', assignee: 'مریم', progress: 90, approvalStatus: 'pending' },
  { id: '6', title: 'تخصیص کار به چند کاربر', project: 'کارهای توسعه‌ای اپ TMS', status: 'inprogress', priority: 'high', assignee: 'رضا', progress: 60 },
  { id: '7', title: 'گردش کار غیرفعال', project: 'کارهای توسعه‌ای اپ TMS', status: 'todo', priority: 'medium', progress: 0 },
  { id: '8', title: 'تنظیم جلسه هفتگی', project: 'امور اداری', status: 'done', priority: 'low', assignee: 'مدیر', progress: 100 },
  { id: '9', title: 'بررسی قراردادهای جدید', project: 'امور اداری', status: 'todo', priority: 'medium', assignee: 'علی', progress: 0 },
]

const STATUS_CONFIG = {
  todo: { label: 'در انتظار', color: '#8c8c8c', bg: '#f5f5f5' },
  inprogress: { label: 'در حال انجام', color: '#1677ff', bg: '#e6f4ff' },
  review: { label: 'در حال بررسی', color: '#fa8c16', bg: '#fff7e6' },
  done: { label: 'انجام شده', color: '#52c41a', bg: '#f6ffed' },
}

const PRIORITY_CONFIG = {
  low: { label: 'کم', color: 'default' },
  medium: { label: 'متوسط', color: 'blue' },
  high: { label: 'زیاد', color: 'orange' },
  critical: { label: 'بحرانی', color: 'red' },
}

const APPROVAL_CONFIG = {
  pending: { label: 'منتظر تأیید', color: 'orange' },
  approved: { label: 'تأیید شده', color: 'green' },
  rejected: { label: 'رد شده', color: 'red' },
}

// ── Droppable Column با useDroppable ──────────────────
function DroppableColumn({ id, children, style }: { id: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} style={{ ...style, outline: isOver ? `2px dashed ${STATUS_CONFIG[id as keyof typeof STATUS_CONFIG]?.color || '#1677ff'}` : 'none', transition: 'outline 0.2s' }}>
      {children}
    </div>
  )
}

// ── Kanban Card ───────────────────────────────────────
function KanbanCard({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1, marginBottom: 8 }} {...attributes} {...listeners}>
      <Card
        size="small"
        style={{ borderRadius: 8, cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRight: `3px solid ${STATUS_CONFIG[task.status].color}` }}
        onClick={() => onEdit(task)}
      >
        <p style={{ margin: '0 0 6px', fontWeight: 500, fontSize: 13 }}>{task.title}</p>
        <Tag style={{ fontSize: 10, marginBottom: 6 }} color="blue">{task.project}</Tag>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tag color={PRIORITY_CONFIG[task.priority].color} style={{ fontSize: 10 }}>
            <FlagOutlined /> {PRIORITY_CONFIG[task.priority].label}
          </Tag>
          {task.assignee && <Tooltip title={task.assignee}><Avatar size={20} icon={<UserOutlined />} style={{ background: '#1677ff' }} /></Tooltip>}
        </div>
        {task.progress > 0 && <Progress percent={task.progress} size="small" style={{ marginTop: 6 }} />}
      </Card>
    </div>
  )
}

// ── تقویم فارسی ────────────────────────────────────
const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const PERSIAN_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

function PersianCalendar({ tasks }: { tasks: Task[] }) {
  const [currentMonth, setCurrentMonth] = useState(3) // خرداد
  const [currentYear] = useState(1403)

  const daysInMonth = currentMonth <= 6 ? 31 : currentMonth <= 11 ? 30 : 29
  const firstDayOffset = 2 // شروع از دوشنبه (قابل تنظیم)

  const tasksByDay: Record<number, Task[]> = {}
  tasks.forEach(t => {
    if (t.dueDate) {
      const day = parseInt(t.dueDate.split('/')[2] || '0')
      if (!tasksByDay[day]) tasksByDay[day] = []
      tasksByDay[day].push(t)
    }
  })

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button onClick={() => setCurrentMonth(m => m > 1 ? m - 1 : 12)}>{'>'}</Button>
        <h3 style={{ margin: 0 }}>{PERSIAN_MONTHS[currentMonth - 1]} {currentYear}</h3>
        <Button onClick={() => setCurrentMonth(m => m < 12 ? m + 1 : 1)}>{'<'}</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {PERSIAN_DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontWeight: 700, padding: '8px 0', color: '#8c8c8c', fontSize: 13 }}>{d}</div>
        ))}
        {Array(firstDayOffset).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1
          const dayTasks = tasksByDay[day] || []
          const isToday = day === 14 && currentMonth === 3
          return (
            <div key={day} style={{
              minHeight: 60, border: '1px solid #f0f0f0', borderRadius: 6, padding: 4,
              background: isToday ? '#e6f4ff' : 'white',
              borderColor: isToday ? '#1677ff' : '#f0f0f0'
            }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? '#1677ff' : '#333', marginBottom: 2 }}>{day}</div>
              {dayTasks.map(t => (
                <div key={t.id} style={{ background: STATUS_CONFIG[t.status].color, color: 'white', borderRadius: 3, padding: '1px 4px', fontSize: 10, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function TasksPage() {
  const location = useLocation()
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS)
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [filterProject, setFilterProject] = useState('all')
  const [form] = Form.useForm()

  // Modal هنگام جابجایی
  const [moveModal, setMoveModal] = useState(false)
  const [moveInfo, setMoveInfo] = useState<{ taskId: string; newStatus: string } | null>(null)
  const [moveNote, setMoveNote] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }))
  const currentView = location.pathname

  const openModal = (task?: Task) => {
    if (task) { setEditingTask(task); form.setFieldsValue(task) }
    else { setEditingTask(null); form.resetFields() }
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingTask) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...values } : t))
      } else {
        setTasks(prev => [...prev, { id: Date.now().toString(), status: 'todo', progress: 0, ...values }])
      }
      setModalOpen(false)
    })
  }

  const handleDragStart = (e: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === e.active.id) || null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setActiveTask(null)
    if (!over) return

    const overColumn = ['todo', 'inprogress', 'review', 'done'].find(c => c === over.id)
    if (overColumn) {
      const task = tasks.find(t => t.id === active.id)
      if (task && task.status !== overColumn) {
        // باز کردن modal برای توضیحات جابجایی
        setMoveInfo({ taskId: active.id as string, newStatus: overColumn })
        setMoveNote('')
        setMoveModal(true)
      }
    }
  }

  const confirmMove = () => {
    if (!moveInfo) return
    setTasks(prev => prev.map(t =>
      t.id === moveInfo.taskId
        ? { ...t, status: moveInfo.newStatus as Task['status'], description: moveNote ? `${t.description || ''}\n[${STATUS_CONFIG[moveInfo.newStatus as keyof typeof STATUS_CONFIG].label}]: ${moveNote}` : t.description }
        : t
    ))
    setMoveModal(false)
    setMoveInfo(null)
    setMoveNote('')
  }

  const filteredTasks = filterProject === 'all' ? tasks : tasks.filter(t => t.project === filterProject)
  const groupedTasks = PROJECTS.map(p => ({
    project: p,
    tasks: filteredTasks.filter(t => t.project === p.name)
  })).filter(g => g.tasks.length > 0)

  const KANBAN_COLUMNS = ['todo', 'inprogress', 'review', 'done'] as const

  const TaskModal = () => (
    <Modal title={editingTask ? 'ویرایش وظیفه' : 'وظیفه جدید'} open={modalOpen} onOk={handleSave}
      onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={600}>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={24}><Form.Item name="title" label="عنوان" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col xs={24} md={12}>
            <Form.Item name="project" label="پروژه" rules={[{ required: true }]}>
              <Select>{PROJECTS.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}</Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="priority" label="اولویت" initialValue="medium">
              <Select>
                <Select.Option value="low">کم</Select.Option>
                <Select.Option value="medium">متوسط</Select.Option>
                <Select.Option value="high">زیاد</Select.Option>
                <Select.Option value="critical">بحرانی</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="assignee" label="مسئول">
              <Select allowClear>
                {['مدیر سیستم', 'علی محمدی', 'مریم احمدی', 'رضا کریمی'].map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="status" label="وضعیت" initialValue="todo">
              <Select>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <Select.Option key={k} value={k}>{v.label}</Select.Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="dueDate" label="مهلت (مثلاً ۱۴۰۳/۰۳/۱۴)">
              <Input placeholder="۱۴۰۳/۰۳/۱۴" />
            </Form.Item>
          </Col>
          <Col span={24}><Form.Item name="description" label="توضیحات"><Input.TextArea rows={3} /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  )



  // ── کارتابل تأییدیه‌ها ────────────────────────────
  if (currentView === '/tasks/approvals') {
    const pendingTasks = tasks.filter(t => t.approvalStatus === 'pending')
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Badge count={pendingTasks.length} style={{ background: '#fa8c16' }}>
              <Tag color="orange">در انتظار تأیید</Tag>
            </Badge>
            <Tag color="green">تأیید شده: {tasks.filter(t => t.approvalStatus === 'approved').length}</Tag>
            <Tag color="red">رد شده: {tasks.filter(t => t.approvalStatus === 'rejected').length}</Tag>
          </Space>
        </Card>
        {PROJECTS.map(project => {
          const projectPending = pendingTasks.filter(t => t.project === project.name)
          if (projectPending.length === 0) return null
          return (
            <Card key={project.id} style={{ marginBottom: 12, borderRight: `4px solid ${project.color}` }}
              title={<Space><span style={{ color: project.color }}>●</span>{project.name}<Tag color="orange">{projectPending.length} مورد</Tag></Space>}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#8c8c8c' }}>
                    <th style={{ padding: '8px', textAlign: 'right', width: 40 }}>#</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>عنوان</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: 100 }}>پیشرفت</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: 100 }}>اولویت</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: 80 }}>مسئول</th>
                    <th style={{ padding: '8px', textAlign: 'center', width: 180 }}>عملیات تأیید</th>
                  </tr>
                </thead>
                <tbody>
                  {projectPending.map((task, i) => (
                    <tr key={task.id} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: '10px 8px', fontSize: 12, color: '#8c8c8c' }}>{i + 1}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500 }}>{task.title}</td>
                      <td style={{ padding: '10px 8px' }}><Progress percent={task.progress} size="small" /></td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <Tag color={PRIORITY_CONFIG[task.priority].color}>{PRIORITY_CONFIG[task.priority].label}</Tag>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        {task.assignee && <Tooltip title={task.assignee}><Avatar size={24} icon={<UserOutlined />} style={{ background: '#1677ff' }} /></Tooltip>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <Space>
                          <Button size="small" style={{ background: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                            onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, approvalStatus: 'approved', status: 'done', progress: 100 } : t))}>
                            تأیید
                          </Button>
                          <Button size="small" danger
                            onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, approvalStatus: 'rejected' } : t))}>
                            رد
                          </Button>
                        </Space>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )
        })}
      </div>
    )
  }

  // ── موارد واگذار شده ──────────────────────────────
  if (currentView === '/tasks/assigned') {
    const assignedTasks = tasks.filter(t => t.assignee && t.status !== 'done')
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>موارد واگذار شده <Tag color="blue">{assignedTasks.length} مورد</Tag></h3>
        </Card>
        {PROJECTS.map(project => {
          const pts = assignedTasks.filter(t => t.project === project.name)
          if (!pts.length) return null
          return (
            <Card key={project.id} style={{ marginBottom: 12, borderRight: `4px solid ${project.color}` }}
              title={<Space><span style={{ color: project.color }}>●</span>{project.name}<Tag>{pts.length} مورد</Tag></Space>}>
              <Table size="small" dataSource={pts} rowKey="id" columns={[
                { title: '#', key: 'i', width: 40, render: (_: unknown, __: unknown, i: number) => i + 1 },
                { title: 'عنوان', dataIndex: 'title', key: 'title' },
                { title: 'مسئول', dataIndex: 'assignee', key: 'assignee', render: (a: string) => <Space><Avatar size={22} icon={<UserOutlined />} style={{ background: '#1677ff' }} />{a}</Space> },
                { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}</Tag> },
                { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', render: (p: number) => <Progress percent={p} size="small" /> },
                { title: 'اولویت', dataIndex: 'priority', key: 'priority', render: (p: string) => <Tag color={PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].color}>{PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}</Tag> },
              ]} />
            </Card>
          )
        })}
      </div>
    )
  }

  // ── خاتمه یافته‌ها ────────────────────────────────
  if (currentView === '/tasks/done') {
    const doneTasks = tasks.filter(t => t.status === 'done')
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Space><h3 style={{ margin: 0 }}>خاتمه یافته‌ها</h3><Tag color="green">{doneTasks.length} مورد</Tag></Space>
        </Card>
        <Card>
          <Table dataSource={doneTasks} rowKey="id" columns={[
            { title: '#', key: 'i', width: 40, render: (_: unknown, __: unknown, i: number) => i + 1 },
            { title: 'عنوان', dataIndex: 'title', key: 'title' },
            { title: 'پروژه', dataIndex: 'project', key: 'project', render: (p: string) => <Tag color="blue">{p}</Tag> },
            { title: 'مسئول', dataIndex: 'assignee', key: 'assignee', render: (a: string) => a ? <Space><Avatar size={22} icon={<UserOutlined />} style={{ background: '#52c41a' }} />{a}</Space> : '-' },
            { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', render: (p: number) => <Progress percent={p} size="small" status="success" /> },
          ]} />
        </Card>
      </div>
    )
  }

  // ── نمای لیست ─────────────────────────────────────
  const ListView = () => (
    <div>
      {groupedTasks.map(({ project, tasks: projectTasks }) => (
        <Card key={project.id} style={{ marginBottom: 12, borderRight: `4px solid ${project.color}` }}
          title={<Space><span style={{ color: project.color }}>●</span>{project.name}<Tag color="blue">{projectTasks.length} مورد</Tag></Space>}
          extra={<Button size="small" icon={<PlusOutlined />} onClick={() => { form.setFieldValue('project', project.name); openModal() }}>افزودن</Button>}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#8c8c8c' }}>
                <th style={{ padding: '8px', textAlign: 'right', width: 40 }}>#</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>عنوان</th>
                <th style={{ padding: '8px', textAlign: 'center', width: 160 }}>وضعیت</th>
                <th style={{ padding: '8px', textAlign: 'center', width: 100 }}>پیشرفت</th>
                <th style={{ padding: '8px', textAlign: 'center', width: 100 }}>اولویت</th>
                <th style={{ padding: '8px', textAlign: 'center', width: 80 }}>مسئول</th>
                <th style={{ padding: '8px', textAlign: 'center', width: 180 }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {projectTasks.map((task, index) => (
                <tr key={task.id} style={{ borderBottom: '1px solid #fafafa' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <td style={{ padding: '10px 8px', fontSize: 12, color: '#8c8c8c' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG[task.status].color, display: 'inline-block', marginLeft: 6 }} />
                    {index + 1}
                  </td>
                  <td style={{ padding: '10px 8px', fontWeight: 500, fontSize: 13 }}>{task.title}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    {task.approvalStatus ? (
                      <Tag color={APPROVAL_CONFIG[task.approvalStatus].color} style={{ fontSize: 11 }}>{APPROVAL_CONFIG[task.approvalStatus].label}</Tag>
                    ) : (
                      <Tag style={{ fontSize: 11 }}>{STATUS_CONFIG[task.status].label}</Tag>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}><Progress percent={task.progress} size="small" /></td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <Tag color={PRIORITY_CONFIG[task.priority].color} style={{ fontSize: 11 }}>{PRIORITY_CONFIG[task.priority].label}</Tag>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    {task.assignee ? <Tooltip title={task.assignee}><Avatar size={24} icon={<UserOutlined />} style={{ background: '#1677ff' }} /></Tooltip> : '-'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <Space>
                      <Tooltip title="جزئیات"><Button size="small" icon={<InfoCircleOutlined />} onClick={() => openModal(task)} /></Tooltip>
                      <Tooltip title="تاریخچه"><Button size="small" icon={<ClockCircleOutlined />} /></Tooltip>
                      <Tooltip title="نظرات"><Button size="small" icon={<MessageOutlined />} /></Tooltip>
                      <Select size="small" value={task.status} style={{ width: 110 }}
                        onChange={val => {
                          setMoveInfo({ taskId: task.id, newStatus: val })
                          setMoveNote('')
                          setMoveModal(true)
                        }}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <Select.Option key={k} value={k}>{v.label}</Select.Option>)}
                      </Select>
                    </Space>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  )

  // ── نمای کانبان ────────────────────────────────────
  const KanbanView = () => (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {KANBAN_COLUMNS.map(col => {
          const colTasks = filteredTasks.filter(t => t.status === col)
          return (
            <DroppableColumn key={col} id={col} style={{
              background: STATUS_CONFIG[col].bg, borderRadius: 12, padding: 12, minHeight: 400,
              border: `1px solid ${STATUS_CONFIG[col].color}33`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Space>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_CONFIG[col].color, display: 'inline-block' }} />
                  <span style={{ fontWeight: 600, color: STATUS_CONFIG[col].color }}>{STATUS_CONFIG[col].label}</span>
                </Space>
                <Badge count={colTasks.length} style={{ background: STATUS_CONFIG[col].color }} />
              </div>
              <SortableContext id={col} items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {colTasks.map(task => <KanbanCard key={task.id} task={task} onEdit={openModal} />)}
              </SortableContext>
              <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => openModal()}>افزودن</Button>
            </DroppableColumn>
          )
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', width: 250, opacity: 0.95 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{activeTask.title}</p>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  )

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Button type={viewMode === 'list' ? 'primary' : 'default'} icon={<UnorderedListOutlined />} onClick={() => setViewMode('list')}>نمای لیست</Button>
            <Button type={viewMode === 'kanban' ? 'primary' : 'default'} icon={<AppstoreOutlined />} onClick={() => setViewMode('kanban')}>نمای کانبان</Button>
            <Button type={viewMode === 'calendar' ? 'primary' : 'default'} icon={<CalendarOutlined />} onClick={() => setViewMode('calendar')}>نمای تقویم</Button>

          </Space>
          <Space>
            <Select value={filterProject} onChange={setFilterProject} style={{ width: 200 }}>
              <Select.Option value="all">همه پروژه‌ها</Select.Option>
              {PROJECTS.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>وظیفه جدید</Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
          <Col xs={12} md={6} key={key}>
            <Card size="small" style={{ borderRight: `3px solid ${val.color}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: val.color }}>{tasks.filter(t => t.status === key).length}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{val.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {viewMode === 'list' && <ListView />}
      {viewMode === 'kanban' && <KanbanView />}
      {viewMode === 'calendar' && <PersianCalendar tasks={filteredTasks} />}

      <TaskModal />

      {/* Modal جابجایی */}
      <Modal
        title={`تغییر وضعیت به: ${STATUS_CONFIG[moveInfo?.newStatus as keyof typeof STATUS_CONFIG]?.label || ''}`}
        open={moveModal}
        onOk={confirmMove}
        onCancel={() => { setMoveModal(false); setMoveInfo(null) }}
        okText="تأیید"
        cancelText="انصراف"
      >
        <p style={{ color: '#8c8c8c', marginBottom: 12 }}>در صورت نیاز توضیحات یا دلیل تغییر وضعیت را وارد کنید:</p>
        <Input.TextArea
          rows={4}
          placeholder="توضیحات تغییر وضعیت (اختیاری)..."
          value={moveNote}
          onChange={e => setMoveNote(e.target.value)}
        />
      </Modal>
    </div>
  )
}