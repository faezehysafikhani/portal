import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, Col, Drawer, Empty, Form, Input, InputNumber, message, Modal, Progress, Row, Segmented, Select, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd'
import { AppstoreOutlined, CalendarOutlined, CheckCircleOutlined, CheckSquareOutlined, ClockCircleOutlined, FilterOutlined, PlusOutlined, SearchOutlined, UnorderedListOutlined, UserOutlined } from '@ant-design/icons'
import PersianDatePicker from '../../components/PersianDatePicker'
import { apiFetch } from '../../utils/api'
import { formatJalaliDate, jalaliToDate } from '../../utils/jalali'
import ProjectContextHeader from './ProjectContextHeader'
import { SAMPLE_PROJECTS } from './ptmsData'

const API = 'http://localhost:5043/api/v1'
const PRIMARY = '#8B1A6B'
const FALLBACK_PROJECT_ID = SAMPLE_PROJECTS[0]?.id || '1'

type TaskStatus = 'Todo' | 'InProgress' | 'InReview' | 'Done' | 'Cancelled'
type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical'

interface TaskItem {
  id: string
  title: string
  description?: string
  projectId?: string
  status: TaskStatus
  priority: TaskPriority
  startDate?: string
  dueDate?: string
  estimatedHours?: number
  actualHours?: number
  progress: number
  assignedToUserId?: string
  createdAt?: string
}

interface DirectoryUser {
  id: string
  username?: string
  fullName?: string
  position?: string
  department?: string
  avatarUrl?: string
}

const STATUS_COLUMNS: Array<{ key: TaskStatus; title: string; color: string }> = [
  { key: 'Todo', title: 'برای انجام', color: '#8c8c8c' },
  { key: 'InProgress', title: 'در حال انجام', color: '#1677ff' },
  { key: 'InReview', title: 'در انتظار بازبینی', color: '#fa8c16' },
  { key: 'Done', title: 'انجام‌شده', color: '#52c41a' },
]

const PRIORITIES: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: 'Critical', label: 'بحرانی', color: 'red' },
  { value: 'High', label: 'بالا', color: 'orange' },
  { value: 'Medium', label: 'متوسط', color: 'blue' },
  { value: 'Low', label: 'پایین', color: 'default' },
]

const statusMeta = (value: TaskStatus) => STATUS_COLUMNS.find(item => item.key === value) || { key: value, title: value, color: '#8c8c8c' }
const priorityMeta = (value: TaskPriority) => PRIORITIES.find(item => item.value === value) || PRIORITIES[2]
const projectOf = (task: TaskItem) => task.projectId || FALLBACK_PROJECT_ID
const safeDate = (value?: string) => {
  if (!value) return 'بدون سررسید'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : formatJalaliDate(date)
}
const normalizeTask = (task: TaskItem): TaskItem => ({
  ...task,
  status: (['Todo', 'InProgress', 'InReview', 'Done', 'Cancelled'].includes(String(task.status)) ? task.status : 'Todo') as TaskStatus,
  priority: (['Low', 'Medium', 'High', 'Critical'].includes(String(task.priority)) ? task.priority : 'Medium') as TaskPriority,
  progress: Number(task.progress || 0),
})

export default function TasksMainPage() {
  const [projectId, setProjectId] = useState(FALLBACK_PROJECT_ID)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState<string>()
  const [priority, setPriority] = useState<TaskPriority>()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskItem>()
  const [draggingId, setDraggingId] = useState<string>()
  const [quickStatus, setQuickStatus] = useState<TaskStatus>()
  const [quickTitle, setQuickTitle] = useState('')
  const [form] = Form.useForm()
  const currentUser: { id?: string; fullName?: string } = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()

  const userById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskResponse, directoryResponse] = await Promise.all([
        apiFetch(`${API}/tasks?projectId=${encodeURIComponent(projectId)}`),
        apiFetch(`${API}/directory`),
      ])
      const taskResult = await taskResponse.json().catch(() => [])
      if (!taskResponse.ok) throw new Error(taskResult.message || 'دریافت وظایف انجام نشد')
      setTasks((Array.isArray(taskResult) ? taskResult : []).map(normalizeTask))
      const directory = await directoryResponse.json().catch(() => ({}))
      if (directoryResponse.ok) setUsers(Array.isArray(directory.users) ? directory.users : [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'دریافت وظایف انجام نشد')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const projectTasks = useMemo(
    () => tasks.filter(task => projectOf(task) === projectId),
    [tasks, projectId],
  )

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa')
    return projectTasks.filter(task => {
      const owner = userById.get(task.assignedToUserId || '')
      const ownerName = owner?.fullName || owner?.username || ''
      return (!query || `${task.title} ${task.description || ''} ${ownerName}`.toLocaleLowerCase('fa').includes(query))
        && (!assignee || task.assignedToUserId === assignee)
        && (!priority || task.priority === priority)
    })
  }, [projectTasks, search, assignee, priority, userById])

  const openCreate = (status: TaskStatus = 'Todo') => {
    form.resetFields()
    form.setFieldsValue({ status, priority: 'Medium', assignedToUserId: currentUser.id, projectId })
    setCreateOpen(true)
  }

  const createTask = async (quick?: { title: string; status: TaskStatus }) => {
    const values = quick || await form.validateFields()
    const title = String(values.title || '').trim()
    const status: TaskStatus = quick?.status || form.getFieldValue('status') || 'Todo'
    if (!title) return
    setSaving(true)
    try {
      const startDate = quick ? undefined : form.getFieldValue('startDate')
      const dueDate = quick ? undefined : form.getFieldValue('dueDate')
      const response = await apiFetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          projectId,
          description: quick ? undefined : form.getFieldValue('description'),
          priority: quick ? 'Medium' : form.getFieldValue('priority'),
          status,
          assignedToUserId: quick ? currentUser.id : form.getFieldValue('assignedToUserId'),
          estimatedHours: quick ? undefined : form.getFieldValue('estimatedHours'),
          startDate: startDate ? jalaliToDate(startDate).toISOString() : null,
          dueDate: dueDate ? jalaliToDate(dueDate).toISOString() : null,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت وظیفه انجام نشد')
      const created = normalizeTask({ ...result, projectId, status: result.status || status })
      setTasks(current => [...current, created])
      setCreateOpen(false)
      setQuickStatus(undefined)
      setQuickTitle('')
      message.success('وظیفه جدید ثبت شد')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت وظیفه انجام نشد')
    } finally {
      setSaving(false)
    }
  }

  const moveTask = async (taskId: string, status: TaskStatus) => {
    const previous = tasks
    const task = tasks.find(item => item.id === taskId)
    if (!task || task.status === status) { setDraggingId(undefined); return }
    const progress = status === 'Done' ? 100 : task.progress === 100 ? 75 : task.progress
    setTasks(current => current.map(item => item.id === taskId ? { ...item, status, progress } : item))
    setDraggingId(undefined)
    const response = await apiFetch(`${API}/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, progress }),
    })
    if (!response.ok) {
      setTasks(previous)
      const result = await response.json().catch(() => ({}))
      message.error(result.message || 'تغییر وضعیت وظیفه انجام نشد')
    }
  }

  const toolbar = <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }} styles={{ body: { padding: 12 } }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <Space wrap>
        <Input allowClear prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} placeholder="جستجو در وظایف..." style={{ width: 230 }} />
        <Select allowClear showSearch optionFilterProp="label" value={assignee} onChange={setAssignee} placeholder="همه مسئولان" style={{ width: 180 }} options={users.map(user => ({ value: user.id, label: user.fullName || user.username }))} />
        <Select allowClear value={priority} onChange={setPriority} placeholder="همه اولویت‌ها" style={{ width: 140 }} options={PRIORITIES} />
        {(search || assignee || priority) && <Button icon={<FilterOutlined />} onClick={() => { setSearch(''); setAssignee(undefined); setPriority(undefined) }}>پاک‌کردن فیلتر</Button>}
      </Space>
      <Segmented value={view} onChange={value => setView(value as 'board' | 'list')} options={[
        { value: 'board', label: <Space size={5}><AppstoreOutlined />برد</Space> },
        { value: 'list', label: <Space size={5}><UnorderedListOutlined />فهرست</Space> },
      ]} />
    </div>
  </Card>

  return <div>
    <Card style={{ borderRadius: 12, marginBottom: 12 }} styles={{ body: { padding: 16 } }}>
      <ProjectContextHeader title="مدیریت وظایف" projectId={projectId} onProjectChange={setProjectId} onAdd={() => openCreate()} addLabel="وظیفه جدید" />
    </Card>
    {toolbar}
    {loading ? <Card style={{ minHeight: 440, borderRadius: 12 }} styles={{ body: { minHeight: 440, display: 'grid', placeItems: 'center' } }}><Spin size="large" tip="در حال دریافت وظایف..." /></Card>
      : view === 'board'
        ? <BoardView tasks={filteredTasks} users={userById} draggingId={draggingId} onDrag={setDraggingId} onDrop={moveTask} onOpen={setSelectedTask} quickStatus={quickStatus} quickTitle={quickTitle} onQuickStatus={setQuickStatus} onQuickTitle={setQuickTitle} onQuickCreate={() => quickStatus && void createTask({ title: quickTitle, status: quickStatus })} onCreate={openCreate} saving={saving} />
        : <ListView tasks={filteredTasks} users={userById} onOpen={setSelectedTask} onStatusChange={moveTask} />}

    <Modal open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void createTask()} confirmLoading={saving} title="ایجاد وظیفه جدید" okText="ایجاد وظیفه" cancelText="انصراف" width={720} centered maskClosable={false} okButtonProps={{ style: { background: PRIMARY } }}>
      <Form form={form} layout="vertical" initialValues={{ priority: 'Medium', status: 'Todo' }}>
        <Form.Item name="title" label="عنوان وظیفه" rules={[{ required: true, message: 'عنوان وظیفه را وارد کنید' }, { max: 200 }]}><Input autoFocus maxLength={200} showCount placeholder="مثلاً آماده‌سازی گزارش هفتگی پروژه" /></Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={8}><Form.Item name="status" label="ستون شروع"><Select options={STATUS_COLUMNS.map(item => ({ value: item.key, label: item.title }))} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="priority" label="اولویت"><Select options={PRIORITIES} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="assignedToUserId" label="مسئول"><Select allowClear showSearch optionFilterProp="label" options={users.map(user => ({ value: user.id, label: user.fullName || user.username }))} placeholder="انتخاب مسئول" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="startDate" label="تاریخ شروع"><PersianDatePicker placeholder="انتخاب تاریخ شروع" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="dueDate" label="تاریخ سررسید"><PersianDatePicker placeholder="انتخاب تاریخ سررسید" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="estimatedHours" label="برآورد زمان (ساعت)"><InputNumber min={0} max={10000} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Form.Item name="description" label="توضیحات" rules={[{ max: 4000 }]}><Input.TextArea rows={4} maxLength={4000} showCount placeholder="جزئیات لازم برای انجام وظیفه را بنویسید..." /></Form.Item>
      </Form>
    </Modal>

    <TaskDetails task={selectedTask} user={selectedTask ? userById.get(selectedTask.assignedToUserId || '') : undefined} onClose={() => setSelectedTask(undefined)} />
  </div>
}

function TaskCard({ task, user, onOpen, onDrag }: { task: TaskItem; user?: DirectoryUser; onOpen: () => void; onDrag: () => void }) {
  const priority = priorityMeta(task.priority)
  return <Card draggable onDragStart={onDrag} onClick={onOpen} size="small" hoverable className="task-board-card" style={{ borderRadius: 10, cursor: 'grab', marginBottom: 9, borderRight: `4px solid ${priority.color === 'default' ? '#bfbfbf' : priority.color}` }} styles={{ body: { padding: 12 } }}>
    <Space size={5} wrap><Tag color={priority.color}>{priority.label}</Tag>{task.estimatedHours ? <Tag>{task.estimatedHours.toLocaleString('fa-IR')} ساعت</Tag> : null}</Space>
    <Typography.Text strong style={{ display: 'block', margin: '8px 0 10px', lineHeight: 1.8 }}>{task.title}</Typography.Text>
    {task.progress > 0 && <Progress percent={task.progress} size="small" strokeColor={PRIMARY} />}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 }}>
      <Tooltip title={user?.fullName || user?.username || 'بدون مسئول'}><Avatar size={25} src={user?.avatarUrl} icon={<UserOutlined />} style={{ background: PRIMARY }} /></Tooltip>
      <span style={{ color: task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done' ? '#f5222d' : '#8c8c8c', fontSize: 11 }}><ClockCircleOutlined /> {safeDate(task.dueDate)}</span>
    </div>
  </Card>
}

function BoardView({ tasks, users, draggingId, onDrag, onDrop, onOpen, quickStatus, quickTitle, onQuickStatus, onQuickTitle, onQuickCreate, onCreate, saving }: {
  tasks: TaskItem[]; users: Map<string, DirectoryUser>; draggingId?: string; onDrag: (id: string) => void; onDrop: (id: string, status: TaskStatus) => void; onOpen: (task: TaskItem) => void
  quickStatus?: TaskStatus; quickTitle: string; onQuickStatus: (status?: TaskStatus) => void; onQuickTitle: (title: string) => void; onQuickCreate: () => void; onCreate: (status: TaskStatus) => void; saving: boolean
}) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(255px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
    {STATUS_COLUMNS.map(column => {
      const cards = tasks.filter(task => task.status === column.key)
      return <section key={column.key} onDragOver={event => event.preventDefault()} onDrop={() => draggingId && onDrop(draggingId, column.key)} style={{ minHeight: 535, background: '#f6f7f9', border: '1px solid #ececef', borderRadius: 12, padding: 10 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px 11px' }}>
          <Space><Badge color={column.color} /><b>{column.title}</b><Tag>{cards.length.toLocaleString('fa-IR')}</Tag></Space>
          <Tooltip title="ایجاد وظیفه در این ستون"><Button type="text" size="small" icon={<PlusOutlined />} onClick={() => onCreate(column.key)} /></Tooltip>
        </header>
        <div style={{ minHeight: 425 }}>
          {cards.map(task => <TaskCard key={task.id} task={task} user={users.get(task.assignedToUserId || '')} onDrag={() => onDrag(task.id)} onOpen={() => onOpen(task)} />)}
          {!cards.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="وظیفه‌ای در این ستون نیست" />}
        </div>
        {quickStatus === column.key ? <div style={{ background: 'white', borderRadius: 10, padding: 8, boxShadow: '0 2px 8px #0000000d' }}>
          <Input.TextArea autoFocus value={quickTitle} onChange={event => onQuickTitle(event.target.value)} onPressEnter={event => { if (!event.shiftKey) { event.preventDefault(); onQuickCreate() } }} autoSize={{ minRows: 2, maxRows: 4 }} maxLength={200} placeholder="عنوان وظیفه..." />
          <Space style={{ marginTop: 8 }}><Button type="primary" size="small" loading={saving} disabled={!quickTitle.trim()} onClick={onQuickCreate} style={{ background: PRIMARY }}>افزودن</Button><Button size="small" onClick={() => { onQuickStatus(undefined); onQuickTitle('') }}>انصراف</Button></Space>
        </div> : <Button block type="text" icon={<PlusOutlined />} onClick={() => onQuickStatus(column.key)} style={{ textAlign: 'right', color: '#595959' }}>افزودن سریع وظیفه</Button>}
      </section>
    })}
  </div>
}

function ListView({ tasks, users, onOpen, onStatusChange }: { tasks: TaskItem[]; users: Map<string, DirectoryUser>; onOpen: (task: TaskItem) => void; onStatusChange: (id: string, status: TaskStatus) => void }) {
  return <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
    <Table rowKey="id" dataSource={tasks} pagination={{ pageSize: 15, showSizeChanger: false }} scroll={{ x: 900 }} onRow={record => ({ onClick: () => onOpen(record), style: { cursor: 'pointer' } })} columns={[
      { title: 'وظیفه', dataIndex: 'title', render: (title: string, task: TaskItem) => <div><b>{title}</b>{task.description && <div style={{ color: '#8c8c8c', fontSize: 11, maxWidth: 360, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.description}</div>}</div> },
      { title: 'مسئول', width: 170, render: (_: unknown, task: TaskItem) => { const user = users.get(task.assignedToUserId || ''); return <Space><Avatar size={24} src={user?.avatarUrl} icon={<UserOutlined />} /><span>{user?.fullName || user?.username || 'بدون مسئول'}</span></Space> } },
      { title: 'اولویت', dataIndex: 'priority', width: 100, render: (value: TaskPriority) => { const item = priorityMeta(value); return <Tag color={item.color}>{item.label}</Tag> } },
      { title: 'سررسید', dataIndex: 'dueDate', width: 145, render: (value?: string) => <span><CalendarOutlined /> {safeDate(value)}</span> },
      { title: 'پیشرفت', dataIndex: 'progress', width: 140, render: (value: number) => <Progress percent={value} size="small" strokeColor={PRIMARY} /> },
      { title: 'وضعیت', dataIndex: 'status', width: 155, render: (value: TaskStatus, task: TaskItem) => <Select size="small" value={value} onClick={event => event.stopPropagation()} onChange={status => void onStatusChange(task.id, status)} style={{ width: 140 }} options={STATUS_COLUMNS.map(item => ({ value: item.key, label: item.title }))} /> },
    ]} />
  </Card>
}

function TaskDetails({ task, user, onClose }: { task?: TaskItem; user?: DirectoryUser; onClose: () => void }) {
  if (!task) return null
  const status = statusMeta(task.status)
  const priority = priorityMeta(task.priority)
  return <Drawer open title="جزئیات وظیفه" onClose={onClose} width={520}>
    <Space wrap style={{ marginBottom: 16 }}><Tag color={status.color}>{status.title}</Tag><Tag color={priority.color}>{priority.label}</Tag></Space>
    <Typography.Title level={4} style={{ marginTop: 0 }}>{task.title}</Typography.Title>
    <Typography.Paragraph style={{ color: '#595959', whiteSpace: 'pre-wrap', lineHeight: 2 }}>{task.description || 'توضیحی برای این وظیفه ثبت نشده است.'}</Typography.Paragraph>
    <Card size="small" style={{ borderRadius: 10, marginBottom: 12 }}>
      <Row gutter={[12, 16]}>
        <Col span={12}><div style={{ color: '#8c8c8c', fontSize: 11 }}>مسئول</div><Space style={{ marginTop: 5 }}><Avatar size={26} src={user?.avatarUrl} icon={<UserOutlined />} /><b>{user?.fullName || user?.username || 'بدون مسئول'}</b></Space></Col>
        <Col span={12}><div style={{ color: '#8c8c8c', fontSize: 11 }}>سررسید</div><div style={{ marginTop: 8 }}><ClockCircleOutlined /> {safeDate(task.dueDate)}</div></Col>
        <Col span={12}><div style={{ color: '#8c8c8c', fontSize: 11 }}>تاریخ شروع</div><div style={{ marginTop: 8 }}>{safeDate(task.startDate)}</div></Col>
        <Col span={12}><div style={{ color: '#8c8c8c', fontSize: 11 }}>برآورد</div><div style={{ marginTop: 8 }}>{task.estimatedHours ? `${task.estimatedHours.toLocaleString('fa-IR')} ساعت` : 'ثبت نشده'}</div></Col>
      </Row>
    </Card>
    <div style={{ marginBottom: 6 }}><CheckSquareOutlined /> پیشرفت وظیفه</div><Progress percent={task.progress} strokeColor={PRIMARY} />
    {task.status === 'Done' && <div style={{ marginTop: 14, color: '#389e0d' }}><CheckCircleOutlined /> این وظیفه انجام شده است.</div>}
  </Drawer>
}
