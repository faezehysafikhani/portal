import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Avatar, Badge, Button, Card, Checkbox, Col, Divider, Empty, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Switch, Tabs, Tag, Tooltip } from 'antd'
import { CalendarOutlined, CheckSquareOutlined, ClockCircleOutlined, FilterOutlined, FlagOutlined, PlusOutlined, SettingOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { SAMPLE_TASKS, USERS, getPriorityColor } from './ptmsData'
import type { Task, TaskStatus } from './ptmsData'

interface BoardTask extends Task { sprint: string; storyPoints: number; order: number; baselineStart: number; timelineStart: number; duration: number; dependency?: string }
interface Props { projectId: string }

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string; limit: number }[] = [
  { key: 'جدید', label: 'برای انجام', color: '#8c8c8c', limit: 6 },
  { key: 'در حال انجام', label: 'در حال انجام', color: '#1677ff', limit: 4 },
  { key: 'در انتظار بازبینی', label: 'بازبینی', color: '#fa8c16', limit: 3 },
  { key: 'تکمیل شده', label: 'انجام‌شده', color: '#52c41a', limit: 99 },
]

const makeTasks = (projectId: string): BoardTask[] => SAMPLE_TASKS.filter(t => t.projectId === projectId).map((t, index) => ({
  ...t,
  sprint: index < 2 ? 'backlog' : 'sprint-1',
  storyPoints: Math.max(1, Math.round(t.estimatedHours / 8)),
  order: index,
  baselineStart: index * 2 + 1,
  timelineStart: index * 2 + 1 + (index % 3 === 1 ? 1 : 0),
  duration: Math.max(2, Math.min(6, Math.round(t.estimatedHours / 16))),
  dependency: index ? SAMPLE_TASKS.filter(x => x.projectId === projectId)[index - 1]?.code : undefined,
}))

export default function ProjectExecutionViews({ projectId }: Props) {
  const [tasks, setTasks] = useState<BoardTask[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`ptms-execution-${projectId}`) || 'null')
      return Array.isArray(saved) ? saved : makeTasks(projectId)
    } catch { return makeTasks(projectId) }
  })
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null)
  const [search, setSearch] = useState('')
  const [member, setMember] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addStatus, setAddStatus] = useState<TaskStatus>('جدید')
  const [taskForm] = Form.useForm()

  useEffect(() => { localStorage.setItem(`ptms-execution-${projectId}`, JSON.stringify(tasks)) }, [projectId, tasks])

  const filtered = useMemo(() => tasks.filter(t => (!search || t.title.includes(search)) && (!member || t.assignee === member)), [tasks, search, member])

  const moveToStatus = (status: TaskStatus) => {
    if (!dragTaskId) return
    setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, status, order: Date.now() } : t))
    setDragTaskId(null)
  }
  const moveToSprint = (sprint: string) => {
    if (!dragTaskId) return
    setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, sprint, order: Date.now() } : t))
    setDragTaskId(null)
  }
  const openAdd = (status: TaskStatus) => { setAddStatus(status); taskForm.resetFields(); taskForm.setFieldsValue({ priority: 'متوسط', assignee: USERS[0], storyPoints: 3 }); setAddOpen(true) }
  const addTask = async () => {
    const values = await taskForm.validateFields()
    const task: BoardTask = {
      id: String(Date.now()), code: `TSK-${String(tasks.length + 1).padStart(3, '0')}`, projectId, project: '', type: 'وظیفه', status: addStatus,
      title: values.title, priority: values.priority, assignee: values.assignee, estimatedHours: values.storyPoints * 8, actualHours: 0, progress: 0,
      tags: values.tags || [], checklist: [], comments: [], sprint: 'backlog', storyPoints: values.storyPoints, order: Date.now(), baselineStart: 1, timelineStart: 1, duration: 3,
    }
    setTasks(prev => [...prev, task]); setAddOpen(false)
  }

  return <>
    <Tabs type="card" items={[
      { key: 'kanban', label: 'کانبان', children: <KanbanBoard tasks={filtered} setTasks={setTasks} onDrag={setDragTaskId} onDrop={moveToStatus} onOpen={setSelectedTask} onAdd={openAdd} search={search} setSearch={setSearch} member={member} setMember={setMember} /> },
      { key: 'scrum', label: 'اسکرام', children: <ScrumBoard tasks={filtered} setTasks={setTasks} onDrag={setDragTaskId} onDrop={moveToSprint} onOpen={setSelectedTask} /> },
      { key: 'gantt', label: 'گانت', children: <GanttBoard tasks={filtered} setTasks={setTasks} onOpen={setSelectedTask} /> },
    ]} />

    <Modal title={selectedTask?.title} open={Boolean(selectedTask)} onCancel={() => setSelectedTask(null)} footer={<Button onClick={() => setSelectedTask(null)}>بستن</Button>} width={720}>
      {selectedTask && <Row gutter={[16, 16]}>
        <Col span={12}><b>کد:</b> {selectedTask.code}</Col><Col span={12}><b>مسئول:</b> {selectedTask.assignee}</Col>
        <Col span={12}><b>وضعیت:</b> <Tag color="blue">{selectedTask.status}</Tag></Col><Col span={12}><b>اولویت:</b> <Tag color={getPriorityColor(selectedTask.priority) as string}>{selectedTask.priority}</Tag></Col>
        <Col span={12}><b>Story Point:</b> {selectedTask.storyPoints}</Col><Col span={12}><b>سررسید:</b> {selectedTask.deadline || 'ثبت نشده'}</Col>
        <Col span={24}><Progress percent={selectedTask.progress} strokeColor="#8B1A6B" /></Col>
        <Col span={24}><b>برچسب‌ها:</b> {selectedTask.tags.map(x => <Tag key={x}>{x}</Tag>)}</Col>
        <Col span={24}><Divider>چک‌لیست</Divider>{selectedTask.checklist.length ? selectedTask.checklist.map(x => <div key={x.id}><Checkbox checked={x.done}>{x.title}</Checkbox></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="چک‌لیستی ثبت نشده" />}</Col>
      </Row>}
    </Modal>
    <Modal title="کارت جدید" open={addOpen} onCancel={() => setAddOpen(false)} onOk={addTask} okText="افزودن" cancelText="انصراف">
      <Form form={taskForm} layout="vertical"><Form.Item name="title" label="عنوان" rules={[{ required: true }]}><Input /></Form.Item><Row gutter={12}><Col span={12}><Form.Item name="assignee" label="مسئول"><Select options={USERS.map(x => ({ value: x, label: x }))} /></Form.Item></Col><Col span={12}><Form.Item name="priority" label="اولویت"><Select options={['بحرانی', 'بالا', 'متوسط', 'پایین'].map(x => ({ value: x, label: x }))} /></Form.Item></Col><Col span={12}><Form.Item name="storyPoints" label="Story Point"><InputNumber min={1} max={21} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="tags" label="برچسب"><Select mode="tags" /></Form.Item></Col></Row></Form>
    </Modal>
  </>
}

function BoardCard({ task, onDrag, onOpen }: { task: BoardTask; onDrag: (id: string) => void; onOpen: (task: BoardTask) => void }) {
  return <Card draggable onDragStart={() => onDrag(task.id)} onClick={() => onOpen(task)} size="small" hoverable style={{ marginBottom: 10, cursor: 'grab', borderRadius: 10, borderRight: `4px solid ${getPriorityColor(task.priority) === 'red' ? '#f5222d' : '#8B1A6B'}` }} styles={{ body: { padding: 12 } }}>
    <Space wrap size={[4, 4]}>{task.tags.slice(0, 2).map(x => <Tag key={x} style={{ fontSize: 10 }}>{x}</Tag>)}</Space>
    <div style={{ fontWeight: 600, margin: '8px 0', lineHeight: 1.7 }}>{task.title}</div>
    <Progress percent={task.progress} size="small" strokeColor="#8B1A6B" />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}><Tooltip title={task.assignee}><Avatar size={26} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} /></Tooltip><Space size={6}><span style={{ fontSize: 11, color: '#8c8c8c' }}><CheckSquareOutlined /> {task.checklist.filter(x => x.done).length}/{task.checklist.length}</span><Tag color="purple">{task.storyPoints} SP</Tag></Space></div>
    {task.deadline && <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 6 }}><ClockCircleOutlined /> {task.deadline}</div>}
  </Card>
}

function KanbanBoard({ tasks, setTasks, onDrag, onDrop, onOpen, onAdd, search, setSearch, member, setMember }: { tasks: BoardTask[]; setTasks: Dispatch<SetStateAction<BoardTask[]>>; onDrag: (id: string) => void; onDrop: (s: TaskStatus) => void; onOpen: (t: BoardTask) => void; onAdd: (s: TaskStatus) => void; search: string; setSearch: (s: string) => void; member: string; setMember: (s: string) => void }) {
  const [hideEmpty, setHideEmpty] = useState(false)
  return <div>
    <Card size="small" style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><Space wrap><Input prefix={<FilterOutlined />} placeholder="جستجوی کارت..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 210 }} allowClear /><Select allowClear placeholder="عضو" value={member || undefined} onChange={v => setMember(v || '')} options={USERS.map(x => ({ value: x, label: x }))} style={{ width: 160 }} /><Checkbox checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)}>مخفی‌کردن ستون خالی</Checkbox></Space><Space><Button icon={<SettingOutlined />}>تنظیم کارت‌ها</Button><Button onClick={() => setTasks(prev => prev.map((t, i) => ({ ...t, order: i })))}>مرتب‌سازی</Button></Space></div></Card>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
      {STATUS_COLUMNS.filter(col => !hideEmpty || tasks.some(t => t.status === col.key)).map(col => { const cards = tasks.filter(t => t.status === col.key).sort((a, b) => a.order - b.order); const over = cards.length > col.limit; return <div key={col.key} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(col.key)} style={{ background: '#f7f7f8', borderRadius: 12, padding: 10, minHeight: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 4px 12px' }}><Space><Badge color={col.color} /><b>{col.label}</b><Tag color={over ? 'red' : 'default'}>{cards.length}/{col.limit === 99 ? '∞' : col.limit}</Tag></Space><Button type="text" icon={<PlusOutlined />} onClick={() => onAdd(col.key)} /></div>
        {over && <div style={{ background: '#fff1f0', color: '#cf1322', padding: 7, borderRadius: 7, marginBottom: 8, fontSize: 11 }}>محدودیت WIP رد شده است</div>}
        {cards.map(t => <BoardCard key={t.id} task={t} onDrag={onDrag} onOpen={onOpen} />)}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => onAdd(col.key)}>افزودن کارت</Button>
      </div> })}
    </div>
  </div>
}

function ScrumBoard({ tasks, setTasks, onDrag, onDrop, onOpen }: { tasks: BoardTask[]; setTasks: Dispatch<SetStateAction<BoardTask[]>>; onDrag: (id: string) => void; onDrop: (s: string) => void; onOpen: (t: BoardTask) => void }) {
  const [sprints, setSprints] = useState([{ id: 'sprint-1', name: 'اسپرینت ۱', goal: 'تحویل نسخه قابل آزمایش', active: true }])
  const [newSprint, setNewSprint] = useState(false)
  const [name, setName] = useState('')
  const active = sprints.find(s => s.active) || sprints[0]
  const sprintTasks = tasks.filter(t => t.sprint === active?.id)
  const totalSp = sprintTasks.reduce((s, t) => s + t.storyPoints, 0)
  const doneSp = sprintTasks.filter(t => t.status === 'تکمیل شده').reduce((s, t) => s + t.storyPoints, 0)
  const burndown = [0, 1, 2, 3, 4, 5, 6].map(day => ({ day: `روز ${day + 1}`, ideal: Math.max(0, totalSp - Math.round(totalSp / 6 * day)), actual: Math.max(0, totalSp - Math.round(doneSp / 6 * day)) }))
  return <div>
    <Card size="small" style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}><Space wrap><Tag color="green">اسپرینت فعال</Tag><b>{active?.name}</b><span style={{ color: '#8c8c8c' }}>هدف: {active?.goal}</span></Space><Space><Tag>{totalSp} SP برنامه</Tag><Tag color="green">{doneSp} SP انجام‌شده</Tag><Button type="primary" icon={<PlusOutlined />} onClick={() => setNewSprint(true)} style={{ background: '#8B1A6B' }}>اسپرینت جدید</Button></Space></div></Card>
    <Row gutter={[12, 12]}>
      <Col xs={24} xl={16}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(300px, 1fr))', gap: 12, overflowX: 'auto' }}>
        {[{ id: 'backlog', name: 'Backlog', color: '#8c8c8c' }, { id: active?.id || 'sprint-1', name: active?.name || 'اسپرینت فعال', color: '#8B1A6B' }].map(group => { const cards = tasks.filter(t => t.sprint === group.id); return <div key={group.id} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(group.id)} style={{ background: '#f7f7f8', borderRadius: 12, minHeight: 520, padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><Space><Badge color={group.color} /><b>{group.name}</b></Space><Tag>{cards.reduce((s, t) => s + t.storyPoints, 0)} SP</Tag></div>{cards.map(t => <BoardCard key={t.id} task={t} onDrag={onDrag} onOpen={onOpen} />)}{!cards.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="کارت را به این بخش بکشید" />}</div> })}
      </div></Col>
      <Col xs={24} xl={8}><Card size="small" title="Burndown اسپرینت"><ResponsiveContainer width="100%" height={260}><LineChart data={burndown}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tick={{ fontSize: 9 }} /><YAxis /><ChartTooltip /><Legend /><Line dataKey="ideal" name="ایده‌آل" stroke="#8c8c8c" strokeDasharray="5 5" /><Line dataKey="actual" name="واقعی" stroke="#8B1A6B" strokeWidth={3} /></LineChart></ResponsiveContainer><Divider /><Space direction="vertical"><span><TeamOutlined /> ظرفیت تیم: ۳۲ SP</span><span><FlagOutlined /> کار برنامه‌ریزی‌نشده: ۲ SP</span><span><CheckSquareOutlined /> پیشرفت: {totalSp ? Math.round(doneSp / totalSp * 100) : 0}٪</span></Space></Card></Col>
    </Row>
    <Modal title="اسپرینت جدید" open={newSprint} onCancel={() => setNewSprint(false)} onOk={() => { if (!name.trim()) return; const id = `sprint-${Date.now()}`; setSprints(prev => [...prev.map(s => ({ ...s, active: false })), { id, name, goal: 'هدف اسپرینت جدید', active: true }]); setTasks(prev => prev.map(t => t.sprint === 'backlog' ? { ...t, sprint: id } : t)); setName(''); setNewSprint(false) }} okText="ایجاد اسپرینت" cancelText="انصراف"><Input value={name} onChange={e => setName(e.target.value)} placeholder="نام اسپرینت" /></Modal>
  </div>
}

function GanttBoard({ tasks, setTasks, onOpen }: { tasks: BoardTask[]; setTasks: Dispatch<SetStateAction<BoardTask[]>>; onOpen: (t: BoardTask) => void }) {
  const [showBaseline, setShowBaseline] = useState(true)
  const [showDeps, setShowDeps] = useState(true)
  const [criticalPath, setCriticalPath] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const days = Array.from({ length: 20 }, (_, i) => i + 1)
  const moveBar = (day: number) => { if (!dragId) return; setTasks(prev => prev.map(t => t.id === dragId ? { ...t, timelineStart: day } : t)); setDragId(null) }
  return <div>
    <Card size="small" style={{ marginBottom: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><Space wrap><span>Baseline</span><Switch checked={showBaseline} onChange={setShowBaseline} /><span>وابستگی‌ها</span><Switch checked={showDeps} onChange={setShowDeps} /><span>مسیر بحرانی</span><Switch checked={criticalPath} onChange={setCriticalPath} /></Space><Space><Select defaultValue="week" options={[{ value: 'day', label: 'روز' }, { value: 'week', label: 'هفته' }, { value: 'month', label: 'ماه' }]} style={{ width: 100 }} /><Button icon={<CalendarOutlined />}>امروز</Button></Space></div></Card>
    <div style={{ border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'auto', background: 'white' }}>
      <div style={{ minWidth: 1250 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', position: 'sticky', top: 0, zIndex: 2, background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}><div style={{ padding: 12, fontWeight: 700 }}>وظایف پروژه</div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>{days.map(d => <div key={d} onDragOver={e => e.preventDefault()} onDrop={() => moveBar(d)} style={{ textAlign: 'center', padding: '10px 0', borderRight: '1px solid #eee', fontSize: 11 }}>{d}</div>)}</div></div>
        {tasks.map((task, index) => { const critical = criticalPath && (index === 0 || index === tasks.length - 1 || task.priority === 'بحرانی'); return <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '330px 1fr', minHeight: 68, borderBottom: '1px solid #f0f0f0' }}>
          <div onClick={() => onOpen(task)} style={{ padding: '10px 12px', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}><div><b>{task.title}</b><div style={{ fontSize: 10, color: '#8c8c8c' }}>{task.code} · {task.assignee}</div></div><Tag color={critical ? 'red' : 'blue'}>{task.progress}٪</Tag></div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gridTemplateRows: showBaseline ? '24px 24px' : '1fr', alignContent: 'center', position: 'relative', backgroundImage: 'linear-gradient(to left,#f0f0f0 1px,transparent 1px)', backgroundSize: `${100 / days.length}% 100%` }} onDragOver={e => e.preventDefault()}>
            {showBaseline && <div style={{ gridColumn: `${Math.min(task.baselineStart, 19)} / span ${Math.min(task.duration, 20 - task.baselineStart + 1)}`, gridRow: 1, alignSelf: 'center', height: 8, background: '#bfbfbf', borderRadius: 4, opacity: .7 }} />}
            <Tooltip title="برای جابه‌جایی، نوار را بکشید"><div draggable onDragStart={() => setDragId(task.id)} style={{ gridColumn: `${Math.min(task.timelineStart, 19)} / span ${Math.min(task.duration, 20 - task.timelineStart + 1)}`, gridRow: showBaseline ? 2 : 1, alignSelf: 'center', height: 22, background: critical ? '#f5222d' : task.timelineStart > task.baselineStart ? '#fa8c16' : '#8B1A6B', borderRadius: 5, color: 'white', fontSize: 10, textAlign: 'center', lineHeight: '22px', cursor: 'grab', zIndex: 1 }}>{task.progress}٪</div></Tooltip>
            {showDeps && task.dependency && <div style={{ position: 'absolute', right: 6, top: 2, fontSize: 9, color: '#8c8c8c' }}>وابسته به ← {task.dependency}</div>}
          </div>
        </div> })}
      </div>
    </div>
    <div style={{ marginTop: 10, fontSize: 11, color: '#8c8c8c' }}><Space wrap><span><Badge color="#8B1A6B" /> طبق برنامه</span><span><Badge color="#fa8c16" /> دارای تأخیر</span><span><Badge color="#f5222d" /> مسیر بحرانی</span><span><Badge color="#bfbfbf" /> خط مبنا</span></Space></div>
  </div>
}
