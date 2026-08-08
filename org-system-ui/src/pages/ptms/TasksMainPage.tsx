import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar, Badge, Button, Card, Checkbox, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber,
  message, Modal, Popconfirm, Progress, Row, Segmented, Select, Space, Spin, Switch, Table, Tabs, Tag,
  Timeline, Tooltip, Typography,
} from 'antd'
import {
  AppstoreOutlined, CheckCircleOutlined, CheckOutlined, ClockCircleOutlined,
  DeleteOutlined, FilterOutlined, HistoryOutlined, PlusOutlined, RedoOutlined, SaveOutlined,
  SearchOutlined, TagsOutlined, UnorderedListOutlined, UserSwitchOutlined, UserOutlined,
} from '@ant-design/icons'
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
type RecurrenceType = 'Daily' | 'Monthly' | 'Yearly' | 'EveryNDays' | 'LastWeekdayOfMonth' | 'FirstWeekdayOfMonth'

interface TaskItem {
  id: string; title: string; description?: string; projectId?: string; projectIds: string[]
  status: TaskStatus; priority: TaskPriority; startDate?: string; dueDate?: string
  estimatedHours?: number; actualHours?: number; progress: number; assignedByUserId: string
  assignedToUserId?: string; assigneeUserIds: string[]; parentTaskId?: string; tags: string[]
  isRecurring: boolean; recurrenceType?: RecurrenceType; recurrenceInterval: number
  recurrenceWeekday?: number; recurrenceEndDate?: string; recurrenceCount?: number
  recurrenceSequence: number; requiresCompletionApproval: boolean; completionRequestedAt?: string
  completionRequestedByUserId?: string; isCompletionApproved: boolean; completionApprovedAt?: string
  createdAt?: string
}

interface DirectoryUser {
  id: string; username?: string; fullName?: string; position?: string; department?: string; avatarUrl?: string
}

interface TaskLog {
  id: string; actorUserId: string; action: string; details?: Record<string, unknown>; createdAt: string
}

interface TaskFilters {
  query: string; assigneeUserIds: string[]; statuses: TaskStatus[]; priorities: TaskPriority[]
  projectIds: string[]; startFrom?: string; startTo?: string; dueFrom?: string; dueTo?: string
}

interface SavedView { id: string; name: string; filters: TaskFilters }

const EMPTY_FILTERS: TaskFilters = {
  query: '', assigneeUserIds: [], statuses: [], priorities: [], projectIds: [FALLBACK_PROJECT_ID],
}

const STATUS_COLUMNS: Array<{ key: TaskStatus; title: string; color: string }> = [
  { key: 'Todo', title: 'برای انجام', color: '#8c8c8c' },
  { key: 'InProgress', title: 'در حال انجام', color: '#1677ff' },
  { key: 'InReview', title: 'منتظر تأیید', color: '#fa8c16' },
  { key: 'Done', title: 'تأیید و تکمیل‌شده', color: '#52c41a' },
]

const PRIORITIES: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: 'Critical', label: 'بحرانی', color: 'red' }, { value: 'High', label: 'بالا', color: 'orange' },
  { value: 'Medium', label: 'متوسط', color: 'blue' }, { value: 'Low', label: 'پایین', color: 'default' },
]

const RECURRENCES: Array<{ value: RecurrenceType; label: string }> = [
  { value: 'Daily', label: 'روزانه' }, { value: 'EveryNDays', label: 'هر چند روز یک‌بار' },
  { value: 'Monthly', label: 'ماهانه' }, { value: 'LastWeekdayOfMonth', label: 'آخرین چندشنبه ماه' },
  { value: 'FirstWeekdayOfMonth', label: 'اولین چندشنبه ماه' },
  { value: 'Yearly', label: 'سالانه' },
]

const WEEKDAYS = [
  { value: 6, label: 'شنبه' }, { value: 0, label: 'یکشنبه' }, { value: 1, label: 'دوشنبه' },
  { value: 2, label: 'سه‌شنبه' }, { value: 3, label: 'چهارشنبه' }, { value: 4, label: 'پنجشنبه' }, { value: 5, label: 'جمعه' },
]

const ACTION_LABELS: Record<string, string> = {
  Created: 'وظیفه ایجاد شد', Updated: 'وظیفه ویرایش شد', Reassigned: 'وظیفه مجدداً ارجاع شد',
  SubtaskCreated: 'زیروظیفه ایجاد و به وظیفه اصلی متصل شد',
  CompletionRequested: 'انجام‌دهنده پایان کار را اعلام کرد', CompletionApproved: 'نویسنده پایان کار را تأیید کرد',
  CompletionRejected: 'نویسنده پایان کار را برای اصلاح بازگرداند', Deleted: 'وظیفه حذف شد',
}

const statusMeta = (value: TaskStatus) => STATUS_COLUMNS.find(item => item.key === value) || STATUS_COLUMNS[0]
const priorityMeta = (value: TaskPriority) => PRIORITIES.find(item => item.value === value) || PRIORITIES[2]
const projectLabel = (id: string) => SAMPLE_PROJECTS.find(project => project.id === id)?.name || id
const userLabel = (user?: DirectoryUser) => user?.fullName || user?.username || 'کاربر نامشخص'
const safeDate = (value?: string) => {
  if (!value) return 'ثبت نشده'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : formatJalaliDate(date)
}
const toIso = (value?: string) => value ? jalaliToDate(value).toISOString() : null
const normalizeTask = (task: TaskItem): TaskItem => ({
  ...task, projectIds: task.projectIds?.length ? task.projectIds : task.projectId ? [task.projectId] : [],
  assigneeUserIds: task.assigneeUserIds?.length ? task.assigneeUserIds : task.assignedToUserId ? [task.assignedToUserId] : [],
  tags: task.tags || [], progress: Number(task.progress || 0), recurrenceInterval: Number(task.recurrenceInterval || 1),
  recurrenceSequence: Number(task.recurrenceSequence || 1),
})

export default function TasksMainPage() {
  const [projectId, setProjectId] = useState(FALLBACK_PROJECT_ID)
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [createOpen, setCreateOpen] = useState(false)
  const [subtaskParent, setSubtaskParent] = useState<TaskItem>()
  const [filterOpen, setFilterOpen] = useState(false)
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskItem>()
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [draggingId, setDraggingId] = useState<string>()
  const [quickStatus, setQuickStatus] = useState<TaskStatus>()
  const [quickTitle, setQuickTitle] = useState('')
  const [reassignIds, setReassignIds] = useState<string[]>([])
  const [form] = Form.useForm()
  const [subtaskForm] = Form.useForm()
  const [viewForm] = Form.useForm()
  const currentUser: { id?: string; fullName?: string } = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()
  const userById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskResponse, directoryResponse, viewResponse] = await Promise.all([
        apiFetch(`${API}/tasks`), apiFetch(`${API}/directory`), apiFetch(`${API}/tasks/views`),
      ])
      const taskResult = await taskResponse.json().catch(() => [])
      if (!taskResponse.ok) throw new Error(taskResult.message || 'دریافت وظایف انجام نشد')
      setTasks((Array.isArray(taskResult) ? taskResult : []).map(normalizeTask))
      const directory = await directoryResponse.json().catch(() => ({}))
      if (directoryResponse.ok) setUsers(Array.isArray(directory.users) ? directory.users : [])
      const views = await viewResponse.json().catch(() => [])
      if (viewResponse.ok) setSavedViews(Array.isArray(views) ? views : [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'دریافت وظایف انجام نشد')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!selectedTask) return
    // Loading a newly selected task synchronizes the drawer with its server-side activity stream.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReassignIds(selectedTask.assigneeUserIds)
    setLogsLoading(true)
    apiFetch(`${API}/tasks/${selectedTask.id}/logs`).then(async response => {
      const data = await response.json().catch(() => [])
      if (response.ok) setLogs(Array.isArray(data) ? data : [])
    }).finally(() => setLogsLoading(false))
  }, [selectedTask])

  const filteredTasks = useMemo(() => tasks.filter(task => {
    const haystack = `${task.title} ${task.description || ''} ${task.tags.join(' ')} ${task.assigneeUserIds.map(id => userLabel(userById.get(id))).join(' ')}`.toLocaleLowerCase('fa')
    const start = task.startDate ? new Date(task.startDate).getTime() : undefined
    const due = task.dueDate ? new Date(task.dueDate).getTime() : undefined
    const selectedProjects = filters.projectIds.length ? filters.projectIds : [projectId]
    return (!filters.query.trim() || haystack.includes(filters.query.trim().toLocaleLowerCase('fa')))
      && (!filters.assigneeUserIds.length || filters.assigneeUserIds.some(id => task.assigneeUserIds.includes(id)))
      && (!filters.statuses.length || filters.statuses.includes(task.status))
      && (!filters.priorities.length || filters.priorities.includes(task.priority))
      && (!selectedProjects.length || selectedProjects.some(id => task.projectIds.includes(id)))
      && (!filters.startFrom || (start !== undefined && start >= jalaliToDate(filters.startFrom).getTime()))
      && (!filters.startTo || (start !== undefined && start <= jalaliToDate(filters.startTo).getTime() + 86_399_999))
      && (!filters.dueFrom || (due !== undefined && due >= jalaliToDate(filters.dueFrom).getTime()))
      && (!filters.dueTo || (due !== undefined && due <= jalaliToDate(filters.dueTo).getTime() + 86_399_999))
  }), [tasks, filters, projectId, userById])

  const openCreate = (status: TaskStatus = 'Todo') => {
    form.resetFields()
    form.setFieldsValue({
      status, priority: 'Medium', assigneeUserIds: currentUser.id ? [currentUser.id] : [], projectIds: [projectId],
      requiresCompletionApproval: true, recurrenceInterval: 1, recurrenceCount: 5,
    })
    setCreateOpen(true)
  }

  const createTask = async (quick?: { title: string; status: TaskStatus }) => {
    const values = quick ? { title: quick.title, status: quick.status, priority: 'Medium', projectIds: [projectId], assigneeUserIds: currentUser.id ? [currentUser.id] : [], requiresCompletionApproval: true } : await form.validateFields()
    if (!String(values.title || '').trim()) return
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values, title: String(values.title).trim(), startDate: toIso(values.startDate), dueDate: toIso(values.dueDate),
          recurrenceEndDate: toIso(values.recurrenceEndDate),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ایجاد وظیفه انجام نشد')
      message.success(result.isRecurring ? 'وظیفه و دوره‌های تکرار آن ایجاد شد' : 'وظیفه ایجاد شد')
      setCreateOpen(false); setQuickTitle(''); setQuickStatus(undefined); await load()
    } catch (error) { message.error(error instanceof Error ? error.message : 'ایجاد وظیفه انجام نشد') }
    finally { setSaving(false) }
  }

  const patchTask = async (task: TaskItem, changes: Record<string, unknown>, success: string) => {
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'به‌روزرسانی وظیفه انجام نشد')
      const normalized = normalizeTask(result)
      setTasks(previous => previous.map(item => item.id === normalized.id ? normalized : item))
      setSelectedTask(previous => previous?.id === normalized.id ? normalized : previous)
      message.success(success)
    } catch (error) { message.error(error instanceof Error ? error.message : 'به‌روزرسانی وظیفه انجام نشد') }
    finally { setSaving(false) }
  }

  const deleteTask = async (task: TaskItem) => {
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks/${task.id}`, { method: 'DELETE' })
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.message || 'حذف وظیفه انجام نشد') }
      setTasks(previous => previous.filter(item => item.id !== task.id)); setSelectedTask(undefined); message.success('وظیفه حذف شد')
    } catch (error) { message.error(error instanceof Error ? error.message : 'حذف وظیفه انجام نشد') }
    finally { setSaving(false) }
  }

  const openSubtask = (parent: TaskItem) => {
    subtaskForm.resetFields()
    subtaskForm.setFieldsValue({ assigneeUserIds: parent.assigneeUserIds, priority: parent.priority })
    setSubtaskParent(parent)
  }

  const createSubtask = async () => {
    if (!subtaskParent) return
    const values = await subtaskForm.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks/${subtaskParent.id}/subtasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, dueDate: toIso(values.dueDate) }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ایجاد زیروظیفه انجام نشد')
      message.success('زیروظیفه ایجاد و به وظیفه والد متصل شد')
      setSubtaskParent(undefined); await load()
    } catch (error) { message.error(error instanceof Error ? error.message : 'ایجاد زیروظیفه انجام نشد') }
    finally { setSaving(false) }
  }

  const saveView = async () => {
    const values = await viewForm.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks/views`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.name, filters }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ذخیره نما انجام نشد')
      setSavedViews(previous => [...previous.filter(item => item.id !== result.id && item.name !== result.name), result])
      setSaveViewOpen(false); viewForm.resetFields(); message.success('نمای فیلترشده ذخیره شد')
    } catch (error) { message.error(error instanceof Error ? error.message : 'ذخیره نما انجام نشد') }
    finally { setSaving(false) }
  }

  const deleteView = async (id: string) => {
    const response = await apiFetch(`${API}/tasks/views/${id}`, { method: 'DELETE' })
    if (response.ok) { setSavedViews(previous => previous.filter(item => item.id !== id)); message.success('نما حذف شد') }
    else message.error('حذف نما انجام نشد')
  }

  const subtasks = selectedTask ? tasks.filter(task => task.parentTaskId === selectedTask.id) : []
  const activeFilterCount = filters.assigneeUserIds.length + filters.statuses.length + filters.priorities.length
    + Math.max(0, filters.projectIds.length - 1) + [filters.startFrom, filters.startTo, filters.dueFrom, filters.dueTo].filter(Boolean).length

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <ProjectContextHeader title="مدیریت وظایف" projectId={projectId} onProjectChange={value => {
      setProjectId(value); setFilters(previous => ({ ...previous, projectIds: [value] }))
    }} onAdd={() => openCreate()} addLabel="وظیفه جدید" />

    <Card size="small" style={{ borderRadius: 12 }}>
      <Row gutter={[10, 10]} align="middle">
        <Col flex="320px"><Input allowClear prefix={<SearchOutlined />} value={filters.query} onChange={event => setFilters(previous => ({ ...previous, query: event.target.value }))} placeholder="جستجو در وظایف..." style={{ maxWidth: 320 }} /></Col>
        <Col><Select allowClear placeholder="نماهای ذخیره‌شده" style={{ width: 190 }} options={savedViews.map(item => ({ value: item.id, label: item.name }))} onChange={id => {
          const selected = savedViews.find(item => item.id === id); if (selected) setFilters({ ...EMPTY_FILTERS, ...selected.filters })
        }} /></Col>
        <Col><Badge count={activeFilterCount} size="small"><Button icon={<FilterOutlined />} onClick={() => setFilterOpen(true)}>فیلتر</Button></Badge></Col>
        <Col><Button icon={<SaveOutlined />} onClick={() => setSaveViewOpen(true)}>ذخیره به‌عنوان نما</Button></Col>
        <Col><Segmented value={view} onChange={value => setView(value as 'board' | 'list')} options={[{ value: 'board', icon: <AppstoreOutlined />, label: 'برد کانبان' }, { value: 'list', icon: <UnorderedListOutlined />, label: 'فهرست' }]} /></Col>
      </Row>
      {savedViews.length > 0 && <Space wrap style={{ marginTop: 10 }}>{savedViews.map(item => <Tag key={item.id} closable onClose={event => { event.preventDefault(); void deleteView(item.id) }} onClick={() => setFilters({ ...EMPTY_FILTERS, ...item.filters })} style={{ cursor: 'pointer' }}>{item.name}</Tag>)}</Space>}
    </Card>

    <Spin spinning={loading || saving}>
      {view === 'board'
        ? <BoardView tasks={filteredTasks} users={userById} draggingId={draggingId} onDrag={setDraggingId} onDrop={(id, status) => {
          const task = tasks.find(item => item.id === id); if (task) void patchTask(task, { status }, status === 'Done' ? 'پایان وظیفه برای تأیید نویسنده ارسال شد' : 'وضعیت وظیفه تغییر کرد')
        }} onOpen={task => { setLogs([]); setSelectedTask(task) }} quickStatus={quickStatus} quickTitle={quickTitle} onQuickStatus={setQuickStatus} onQuickTitle={setQuickTitle} onQuickCreate={() => quickStatus && void createTask({ title: quickTitle, status: quickStatus })} onCreate={openCreate} saving={saving} />
        : <ListView tasks={filteredTasks} users={userById} onOpen={task => { setLogs([]); setSelectedTask(task) }} onStatusChange={(task, status) => void patchTask(task, { status }, status === 'Done' ? 'پایان وظیفه برای تأیید ارسال شد' : 'وضعیت تغییر کرد')} />}
    </Spin>

    <TaskCreateModal open={createOpen} form={form} users={users} saving={saving} onCancel={() => setCreateOpen(false)} onSubmit={() => void createTask()} />

    <Drawer open={filterOpen} onClose={() => setFilterOpen(false)} title="فیلتر وظایف" width={460} extra={<Button type="link" onClick={() => setFilters({ ...EMPTY_FILTERS, projectIds: [projectId] })}>پاک‌کردن</Button>}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <FilterSelect label="انجام‌دهنده" value={filters.assigneeUserIds} onChange={value => setFilters(previous => ({ ...previous, assigneeUserIds: value }))} options={users.map(user => ({ value: user.id, label: `${userLabel(user)}${user.position ? ` — ${user.position}` : ''}` }))} />
        <FilterSelect label="وضعیت" value={filters.statuses} onChange={value => setFilters(previous => ({ ...previous, statuses: value as TaskStatus[] }))} options={STATUS_COLUMNS.map(item => ({ value: item.key, label: item.title }))} />
        <FilterSelect label="اولویت" value={filters.priorities} onChange={value => setFilters(previous => ({ ...previous, priorities: value as TaskPriority[] }))} options={PRIORITIES.map(item => ({ value: item.value, label: item.label }))} />
        <FilterSelect label="پروژه" value={filters.projectIds} onChange={value => setFilters(previous => ({ ...previous, projectIds: value }))} options={SAMPLE_PROJECTS.map(item => ({ value: item.id, label: `${item.code} — ${item.name}` }))} />
        <DateRange label="بازه تاریخ شروع" from={filters.startFrom} to={filters.startTo} onFrom={value => setFilters(previous => ({ ...previous, startFrom: value }))} onTo={value => setFilters(previous => ({ ...previous, startTo: value }))} />
        <DateRange label="بازه تاریخ پایان" from={filters.dueFrom} to={filters.dueTo} onFrom={value => setFilters(previous => ({ ...previous, dueFrom: value }))} onTo={value => setFilters(previous => ({ ...previous, dueTo: value }))} />
        <Button type="primary" block style={{ background: PRIMARY }} onClick={() => setFilterOpen(false)}>اعمال فیلتر ({filteredTasks.length.toLocaleString('fa-IR')} نتیجه)</Button>
      </Space>
    </Drawer>

    <Modal open={saveViewOpen} title="ذخیره فیلتر به‌عنوان یک نما" onCancel={() => setSaveViewOpen(false)} onOk={() => void saveView()} confirmLoading={saving} okText="ذخیره نما" cancelText="انصراف">
      <Form form={viewForm} layout="vertical"><Form.Item name="name" label="نام نما" rules={[{ required: true, message: 'نام نما را وارد کنید' }, { max: 80 }]}><Input maxLength={80} placeholder="مثلاً وظایف فوری این هفته" /></Form.Item></Form>
    </Modal>

    <TaskDetails task={selectedTask} users={userById} currentUserId={currentUser.id} subtasks={subtasks} logs={logs} logsLoading={logsLoading} saving={saving} reassignIds={reassignIds} onReassignIds={setReassignIds} onClose={() => setSelectedTask(undefined)} onPatch={patchTask} onDelete={deleteTask} onAddSubtask={openSubtask} />

    <Modal open={Boolean(subtaskParent)} title={subtaskParent ? `زیروظیفه جدید برای «${subtaskParent.title}»` : 'زیروظیفه جدید'} onCancel={() => setSubtaskParent(undefined)} onOk={() => void createSubtask()} confirmLoading={saving} okText="ایجاد زیروظیفه" cancelText="انصراف" centered maskClosable={false} okButtonProps={{ style: { background: PRIMARY } }}>
      <Form form={subtaskForm} layout="vertical">
        <Form.Item name="title" label="عنوان زیروظیفه" rules={[{ required: true, message: 'عنوان زیروظیفه را وارد کنید' }, { max: 200 }]}><Input maxLength={200} showCount autoFocus /></Form.Item>
        <Form.Item name="description" label="شرح"><Input.TextArea rows={3} maxLength={1500} showCount /></Form.Item>
        <Row gutter={12}><Col span={12}><Form.Item name="assigneeUserIds" label="انجام‌دهندگان" rules={[{ required: true, message: 'حداقل یک نفر را انتخاب کنید' }]}><Select mode="multiple" showSearch optionFilterProp="label" options={users.map(user => ({ value: user.id, label: userLabel(user) }))} /></Form.Item></Col><Col span={12}><Form.Item name="priority" label="اولویت"><Select options={PRIORITIES.map(item => ({ value: item.value, label: item.label }))} /></Form.Item></Col></Row>
        <Form.Item name="dueDate" label="تاریخ پایان"><PersianDatePicker style={{ width: '100%' }} /></Form.Item>
        <Typography.Text type="secondary">پروژه‌ها و تنظیم تأیید پایان از وظیفه والد به‌صورت خودکار به ارث می‌رسند.</Typography.Text>
      </Form>
    </Modal>
  </div>
}

function TaskCreateModal({ open, form, users, saving, onCancel, onSubmit }: { open: boolean; form: ReturnType<typeof Form.useForm>[0]; users: DirectoryUser[]; saving: boolean; onCancel: () => void; onSubmit: () => void }) {
  const recurring = Form.useWatch('isRecurring', form)
  const recurrenceType = Form.useWatch('recurrenceType', form)
  return <Modal open={open} onCancel={onCancel} onOk={onSubmit} confirmLoading={saving} title="ایجاد وظیفه جدید" okText="ایجاد وظیفه" cancelText="انصراف" width={860} centered maskClosable={false} okButtonProps={{ style: { background: PRIMARY } }}>
    <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
      <Tabs items={[
        { key: 'main', label: 'مشخصات وظیفه', children: <>
          <Form.Item name="title" label="عنوان وظیفه" rules={[{ required: true, message: 'عنوان وظیفه را وارد کنید' }, { max: 200 }]}><Input maxLength={200} showCount /></Form.Item>
          <Form.Item name="description" label="شرح و معیار تحویل"><Input.TextArea rows={3} maxLength={3000} showCount /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="assigneeUserIds" label="ارجاع به یک یا چند نفر" rules={[{ required: true, message: 'حداقل یک نفر را انتخاب کنید' }]}><Select mode="multiple" showSearch optionFilterProp="label" options={users.map(user => ({ value: user.id, label: `${userLabel(user)}${user.position ? ` — ${user.position}` : ''}` }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="projectIds" label="تعلق به یک یا چند پروژه" rules={[{ required: true, message: 'حداقل یک پروژه را انتخاب کنید' }]}><Select mode="multiple" options={SAMPLE_PROJECTS.map(project => ({ value: project.id, label: `${project.code} — ${project.name}` }))} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="priority" label="اولویت"><Select options={PRIORITIES.map(item => ({ value: item.value, label: item.label }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="وضعیت"><Select options={STATUS_COLUMNS.map(item => ({ value: item.key, label: item.title }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="estimatedHours" label="برآورد ساعت"><InputNumber min={0} max={10000} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="startDate" label="تاریخ شروع"><PersianDatePicker style={{ width: '100%' }} placeholder="انتخاب تاریخ شروع" /></Form.Item></Col>
            <Col span={12}><Form.Item name="dueDate" label="تاریخ پایان" dependencies={['startDate']} rules={[({ getFieldValue }) => ({ validator(_, value) { const start = getFieldValue('startDate'); return !start || !value || jalaliToDate(value) >= jalaliToDate(start) ? Promise.resolve() : Promise.reject(new Error('تاریخ پایان نباید قبل از شروع باشد')) } })]}><PersianDatePicker style={{ width: '100%' }} placeholder="انتخاب تاریخ پایان" /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}><Form.Item name="tags" label="تگ یا برچسب"><Select mode="tags" tokenSeparators={[',', '،']} maxTagCount="responsive" placeholder="مثلاً فوری، طراحی، مشتری" /></Form.Item></Col>
          </Row>
          <Form.Item name="requiresCompletionApproval" valuePropName="checked"><Checkbox>پس از اعلام پایان توسط انجام‌دهنده، تأیید نویسنده الزامی باشد</Checkbox></Form.Item>
        </> },
        { key: 'recurrence', label: 'تکرار وظیفه', children: <>
          <Form.Item name="isRecurring" valuePropName="checked" label="تسک تکرارشونده"><Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" /></Form.Item>
          {recurring && <>
            <Row gutter={12}>
              <Col span={12}><Form.Item name="recurrenceType" label="الگوی تکرار" rules={[{ required: true, message: 'الگوی تکرار را انتخاب کنید' }]}><Select options={RECURRENCES} /></Form.Item></Col>
              <Col span={12}><Form.Item name="recurrenceInterval" label={recurrenceType === 'EveryNDays' ? 'هر چند روز یک‌بار' : 'فاصله دوره‌ها'} rules={[{ required: true }]}><InputNumber min={1} max={365} style={{ width: '100%' }} addonAfter={recurrenceType === 'Yearly' ? 'سال' : ['Monthly', 'LastWeekdayOfMonth', 'FirstWeekdayOfMonth'].includes(String(recurrenceType)) ? 'ماه' : 'روز'} /></Form.Item></Col>
            </Row>
            {['LastWeekdayOfMonth', 'FirstWeekdayOfMonth'].includes(String(recurrenceType)) && <Form.Item name="recurrenceWeekday" label={recurrenceType === 'LastWeekdayOfMonth' ? 'آخرین چندشنبه ماه؟' : 'اولین چندشنبه ماه؟'} initialValue={1} rules={[{ required: true }]}><Select options={WEEKDAYS} /></Form.Item>}
            <Row gutter={12}>
              <Col span={12}><Form.Item name="recurrenceEndDate" label="تاریخ پایان دوره‌های تکرار"><PersianDatePicker style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={12}><Form.Item name="recurrenceCount" label="تعداد کل تکرار"><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            <Typography.Text type="secondary">برای جلوگیری از ایجاد بی‌نهایت وظیفه، حداقل تاریخ پایان یا تعداد تکرار باید مشخص باشد؛ حداکثر ۱۰۰ دوره ساخته می‌شود.</Typography.Text>
          </>}
        </> },
      ]} />
    </Form>
  </Modal>
}

function TaskCard({ task, users, onDrag, onOpen }: { task: TaskItem; users: Map<string, DirectoryUser>; onDrag: () => void; onOpen: () => void }) {
  const priority = priorityMeta(task.priority)
  const overdue = Boolean(task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done')
  return <Card draggable onDragStart={onDrag} onClick={onOpen} size="small" hoverable style={{ marginBottom: 9, borderRadius: 10, cursor: 'pointer', borderRight: `3px solid ${statusMeta(task.status).color}` }}>
    <Space wrap size={[4, 5]}><Tag color={priority.color}>{priority.label}</Tag>{task.tags.slice(0, 2).map(tag => <Tag key={tag} icon={<TagsOutlined />}>{tag}</Tag>)}{task.isRecurring && <Tag color="purple" icon={<RedoOutlined />}>{task.recurrenceSequence.toLocaleString('fa-IR')}</Tag>}{task.parentTaskId && <Tag>زیروظیفه</Tag>}</Space>
    <Typography.Text strong style={{ display: 'block', margin: '8px 0', lineHeight: 1.8 }}>{task.title}</Typography.Text>
    {task.progress > 0 && <Progress percent={task.progress} size="small" strokeColor={PRIMARY} />}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <Avatar.Group max={{ count: 3 }} size={26}>{task.assigneeUserIds.map(id => <Tooltip key={id} title={userLabel(users.get(id))}><Avatar src={users.get(id)?.avatarUrl} icon={<UserOutlined />} style={{ background: PRIMARY }} /></Tooltip>)}</Avatar.Group>
      <span style={{ color: overdue ? '#f5222d' : '#8c8c8c', fontSize: 11 }}><ClockCircleOutlined /> {safeDate(task.dueDate)}</span>
    </div>
    {task.completionRequestedAt && !task.isCompletionApproved && <Tag color="orange" style={{ marginTop: 8 }}>منتظر تأیید نویسنده</Tag>}
  </Card>
}

function BoardView({ tasks, users, draggingId, onDrag, onDrop, onOpen, quickStatus, quickTitle, onQuickStatus, onQuickTitle, onQuickCreate, onCreate, saving }: {
  tasks: TaskItem[]; users: Map<string, DirectoryUser>; draggingId?: string; onDrag: (id: string) => void; onDrop: (id: string, status: TaskStatus) => void; onOpen: (task: TaskItem) => void
  quickStatus?: TaskStatus; quickTitle: string; onQuickStatus: (status?: TaskStatus) => void; onQuickTitle: (title: string) => void; onQuickCreate: () => void; onCreate: (status: TaskStatus) => void; saving: boolean
}) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(270px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
    {STATUS_COLUMNS.map(column => {
      const cards = tasks.filter(task => task.status === column.key)
      return <section key={column.key} onDragOver={event => event.preventDefault()} onDrop={() => draggingId && onDrop(draggingId, column.key)} style={{ minHeight: 540, background: '#f6f7f9', border: '1px solid #ececef', borderRadius: 12, padding: 10 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px 11px' }}><Space><Badge color={column.color} /><b>{column.title}</b><Tag>{cards.length.toLocaleString('fa-IR')}</Tag></Space><Button type="text" size="small" icon={<PlusOutlined />} onClick={() => onCreate(column.key)} /></header>
        <div style={{ minHeight: 430 }}>{cards.map(task => <TaskCard key={task.id} task={task} users={users} onDrag={() => onDrag(task.id)} onOpen={() => onOpen(task)} />)}{!cards.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="وظیفه‌ای در این ستون نیست" />}</div>
        {quickStatus === column.key ? <div style={{ background: 'white', borderRadius: 10, padding: 8 }}><Input.TextArea autoFocus value={quickTitle} onChange={event => onQuickTitle(event.target.value)} onPressEnter={event => { if (!event.shiftKey) { event.preventDefault(); onQuickCreate() } }} autoSize={{ minRows: 2, maxRows: 4 }} maxLength={200} placeholder="عنوان وظیفه..." /><Space style={{ marginTop: 8 }}><Button type="primary" size="small" loading={saving} disabled={!quickTitle.trim()} onClick={onQuickCreate} style={{ background: PRIMARY }}>افزودن</Button><Button size="small" onClick={() => { onQuickStatus(undefined); onQuickTitle('') }}>انصراف</Button></Space></div> : <Button block type="text" icon={<PlusOutlined />} onClick={() => onQuickStatus(column.key)} style={{ textAlign: 'right' }}>افزودن سریع وظیفه</Button>}
      </section>
    })}
  </div>
}

function ListView({ tasks, users, onOpen, onStatusChange }: { tasks: TaskItem[]; users: Map<string, DirectoryUser>; onOpen: (task: TaskItem) => void; onStatusChange: (task: TaskItem, status: TaskStatus) => void }) {
  return <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}><Table rowKey="id" dataSource={tasks} pagination={{ pageSize: 15, showSizeChanger: false }} scroll={{ x: 1100 }} onRow={record => ({ onClick: () => onOpen(record), style: { cursor: 'pointer' } })} columns={[
    { title: 'وظیفه', dataIndex: 'title', render: (title: string, task: TaskItem) => <div><b>{title}</b><Space wrap size={2} style={{ display: 'flex', marginTop: 5 }}>{task.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</Space></div> },
    { title: 'انجام‌دهندگان', width: 180, render: (_: unknown, task: TaskItem) => <Avatar.Group max={{ count: 4 }}>{task.assigneeUserIds.map(id => <Tooltip key={id} title={userLabel(users.get(id))}><Avatar size={26} src={users.get(id)?.avatarUrl} icon={<UserOutlined />} /></Tooltip>)}</Avatar.Group> },
    { title: 'پروژه‌ها', width: 180, render: (_: unknown, task: TaskItem) => task.projectIds.map(id => <Tag key={id}>{projectLabel(id)}</Tag>) },
    { title: 'اولویت', dataIndex: 'priority', width: 90, render: (value: TaskPriority) => { const item = priorityMeta(value); return <Tag color={item.color}>{item.label}</Tag> } },
    { title: 'شروع', dataIndex: 'startDate', width: 120, render: safeDate }, { title: 'پایان', dataIndex: 'dueDate', width: 120, render: safeDate },
    { title: 'وضعیت', dataIndex: 'status', width: 155, render: (value: TaskStatus, task: TaskItem) => <Select size="small" value={value} onClick={event => event.stopPropagation()} onChange={status => onStatusChange(task, status)} style={{ width: 145 }} options={STATUS_COLUMNS.map(item => ({ value: item.key, label: item.title }))} /> },
  ]} /></Card>
}

function TaskDetails({ task, users, currentUserId, subtasks, logs, logsLoading, saving, reassignIds, onReassignIds, onClose, onPatch, onDelete, onAddSubtask }: {
  task?: TaskItem; users: Map<string, DirectoryUser>; currentUserId?: string; subtasks: TaskItem[]; logs: TaskLog[]; logsLoading: boolean; saving: boolean
  reassignIds: string[]; onReassignIds: (ids: string[]) => void; onClose: () => void; onPatch: (task: TaskItem, changes: Record<string, unknown>, success: string) => Promise<void>; onDelete: (task: TaskItem) => Promise<void>; onAddSubtask: (task: TaskItem) => void
}) {
  if (!task) return null
  const isCreator = task.assignedByUserId === currentUserId
  const isAssignee = Boolean(currentUserId && task.assigneeUserIds.includes(currentUserId))
  return <Drawer open title="جزئیات و گردش وظیفه" onClose={onClose} width={650} extra={<Popconfirm title="حذف وظیفه" description="این وظیفه به‌صورت امن حذف می‌شود. ادامه می‌دهید؟" okText="حذف" cancelText="انصراف" onConfirm={() => void onDelete(task)}><Button danger icon={<DeleteOutlined />}>حذف</Button></Popconfirm>}>
    <Space wrap style={{ marginBottom: 12 }}><Tag color={statusMeta(task.status).color}>{statusMeta(task.status).title}</Tag><Tag color={priorityMeta(task.priority).color}>{priorityMeta(task.priority).label}</Tag>{task.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}</Space>
    <Typography.Title level={4} style={{ marginTop: 0 }}>{task.title}</Typography.Title>
    <Typography.Paragraph type="secondary" style={{ whiteSpace: 'pre-wrap' }}>{task.description || 'توضیحی ثبت نشده است.'}</Typography.Paragraph>
    <Tabs items={[
      { key: 'info', label: 'مشخصات و اقدام', children: <>
        <Descriptions bordered size="small" column={2} items={[
          { key: 'start', label: 'شروع', children: safeDate(task.startDate) }, { key: 'due', label: 'پایان', children: safeDate(task.dueDate) },
          { key: 'projects', label: 'پروژه‌ها', span: 2, children: <Space wrap>{task.projectIds.map(id => <Tag key={id}>{projectLabel(id)}</Tag>)}</Space> },
          { key: 'assignees', label: 'انجام‌دهندگان', span: 2, children: <Space wrap>{task.assigneeUserIds.map(id => <Tag key={id} icon={<UserOutlined />}>{userLabel(users.get(id))}</Tag>)}</Space> },
          { key: 'repeat', label: 'تکرار', span: 2, children: task.isRecurring ? `${RECURRENCES.find(item => item.value === task.recurrenceType)?.label || task.recurrenceType}، دوره ${task.recurrenceSequence.toLocaleString('fa-IR')}${task.recurrenceCount ? ` از ${task.recurrenceCount.toLocaleString('fa-IR')}` : ''}` : 'بدون تکرار' },
        ]} />
        <Card size="small" title={<><UserSwitchOutlined /> ارجاع مجدد</>} style={{ marginTop: 14 }}><Space.Compact block><Select mode="multiple" value={reassignIds} onChange={onReassignIds} style={{ width: '100%' }} options={[...users.values()].map(user => ({ value: user.id, label: userLabel(user) }))} /><Button type="primary" disabled={!reassignIds.length} onClick={() => void onPatch(task, { assigneeUserIds: reassignIds }, 'وظیفه مجدداً ارجاع شد')} style={{ background: PRIMARY }}>ثبت ارجاع</Button></Space.Compact></Card>
        <Space wrap style={{ marginTop: 14 }}>
          {isAssignee && !task.isCompletionApproved && !task.completionRequestedAt && <Button type="primary" icon={<CheckOutlined />} onClick={() => void onPatch(task, { requestCompletion: true }, 'پایان کار برای تأیید نویسنده ارسال شد')} style={{ background: PRIMARY }}>اعلام پایان وظیفه</Button>}
          {isAssignee && task.completionRequestedAt && !task.isCompletionApproved && <Tag color="orange" icon={<ClockCircleOutlined />}>این وظیفه تا تأیید نویسنده در کارتابل شما باقی می‌ماند</Tag>}
          {isCreator && task.completionRequestedAt && !task.isCompletionApproved && <><Button type="primary" icon={<CheckCircleOutlined />} onClick={() => void onPatch(task, { approveCompletion: true }, 'پایان وظیفه تأیید شد')} style={{ background: '#389e0d' }}>تأیید پایان</Button><Button danger onClick={() => void onPatch(task, { rejectCompletion: true }, 'وظیفه برای اصلاح بازگردانده شد')}>بازگشت برای اصلاح</Button></>}
          {task.isCompletionApproved && <Tag color="green" icon={<CheckCircleOutlined />}>پایان وظیفه تأیید شده است</Tag>}
        </Space>
      </> },
      { key: 'subtasks', label: `زیروظیفه‌ها (${subtasks.length.toLocaleString('fa-IR')})`, children: <><Button icon={<PlusOutlined />} onClick={() => onAddSubtask(task)} style={{ marginBottom: 12 }}>افزودن زیروظیفه</Button>{subtasks.length ? <Space direction="vertical" style={{ width: '100%' }}>{subtasks.map(item => <Card key={item.id} size="small"><Space><Checkbox checked={item.status === 'Done'} disabled /><b>{item.title}</b><Tag color={statusMeta(item.status).color}>{statusMeta(item.status).title}</Tag></Space></Card>)}</Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="زیروظیفه‌ای ثبت نشده است" />}</> },
      { key: 'logs', label: <><HistoryOutlined /> لاگ تغییرات</>, children: <Spin spinning={logsLoading}><Timeline items={logs.map(log => ({ color: log.action.includes('Approved') ? 'green' : log.action.includes('Rejected') ? 'red' : PRIMARY, children: <div><b>{ACTION_LABELS[log.action] || log.action}</b><div style={{ color: '#8c8c8c', marginTop: 3 }}>{userLabel(users.get(log.actorUserId))} — {new Date(log.createdAt).toLocaleString('fa-IR')}</div></div> }))} />{!logs.length && !logsLoading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لاگی ثبت نشده است" />}</Spin> },
    ]} />
    {saving && <Progress percent={100} status="active" showInfo={false} />}
  </Drawer>
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string[]; onChange: (value: string[]) => void; options: Array<{ value: string; label: string }> }) {
  return <div><div style={{ marginBottom: 7, fontWeight: 600 }}>{label}</div><Select mode="multiple" allowClear value={value} onChange={onChange} options={options} style={{ width: '100%' }} maxTagCount="responsive" /></div>
}

function DateRange({ label, from, to, onFrom, onTo }: { label: string; from?: string; to?: string; onFrom: (value?: string) => void; onTo: (value?: string) => void }) {
  return <div><div style={{ marginBottom: 7, fontWeight: 600 }}>{label}</div><Row gutter={8}><Col span={12}><PersianDatePicker value={from} onChange={onFrom} placeholder="از تاریخ" style={{ width: '100%' }} /></Col><Col span={12}><PersianDatePicker value={to} onChange={onTo} placeholder="تا تاریخ" style={{ width: '100%' }} /></Col></Row></div>
}
