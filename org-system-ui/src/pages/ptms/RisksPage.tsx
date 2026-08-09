import { useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Descriptions, Drawer, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Progress, Row, Select, Slider, Space, Statistic, Table, Tabs, Tag, Timeline, Typography } from 'antd'
import { AlertOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SearchOutlined, ThunderboltOutlined } from '@ant-design/icons'
import PersianDatePicker from '../../components/PersianDatePicker'
import { currentJalali } from '../../utils/jalali'
import { SAMPLE_PROJECTS, SAMPLE_RISKS, USERS } from './ptmsData'
import ProjectContextHeader from './ProjectContextHeader'

const PRIMARY = '#8B1A6B'
const STORAGE_KEY = 'portal:managed-risks:v2'
const SELECTED_PROJECT_KEY = 'portal:selected-project-id'

type RiskStatus = 'شناسایی‌شده' | 'ارزیابی‌شده' | 'پاسخ برنامه‌ریزی‌شده' | 'در حال پایش' | 'بسته‌شده' | 'محقق‌شده'
type RiskLevel = 'پایین' | 'متوسط' | 'بالا' | 'بحرانی'
type RiskTrend = 'کاهشی' | 'ثابت' | 'افزایشی'

interface RiskHistory { id: string; action: string; actor: string; at: string }
interface ManagedRisk {
  id: string; code: string; title: string; projectId: string; category: string; owner: string
  probability: number; impact: number; score: number; residualProbability: number; residualImpact: number; residualScore: number
  level: RiskLevel; status: RiskStatus; strategy: string; description?: string; cause?: string; consequence?: string
  trigger?: string; responsePlan?: string; contingencyPlan?: string; reviewDate?: string; responseDeadline?: string
  actionProgress: number; trend: RiskTrend; escalated: boolean; history: RiskHistory[]; updatedAt: string
}

const todayJalali = () => { const value = currentJalali(); return `${value.year}/${String(value.month).padStart(2, '0')}/${String(value.day).padStart(2, '0')}` }
const levelOf = (score: number): RiskLevel => score >= 16 ? 'بحرانی' : score >= 10 ? 'بالا' : score >= 5 ? 'متوسط' : 'پایین'
const levelColor = (level: RiskLevel) => ({ پایین: '#52c41a', متوسط: '#fadb14', بالا: '#fa8c16', بحرانی: '#ff4d4f' }[level])
const statusColor = (status: RiskStatus) => status === 'بسته‌شده' ? 'green' : status === 'محقق‌شده' ? 'red' : status === 'در حال پایش' ? 'purple' : status === 'پاسخ برنامه‌ریزی‌شده' ? 'blue' : 'default'
const projectName = (id: string) => SAMPLE_PROJECTS.find(project => project.id === id)?.name || id

const seedRisks = (): ManagedRisk[] => SAMPLE_RISKS.map((risk, index) => {
  const project = SAMPLE_PROJECTS.find(item => item.name === risk.project) || SAMPLE_PROJECTS[0]
  const residualProbability = Math.max(1, risk.probability - 1)
  const residualImpact = Math.max(1, risk.impact - (index % 2))
  return {
    id: risk.id, code: risk.code, title: risk.title, projectId: project.id, category: risk.category, owner: risk.owner,
    probability: risk.probability, impact: risk.impact, score: risk.score, residualProbability, residualImpact,
    residualScore: residualProbability * residualImpact, level: levelOf(risk.score),
    status: index === 0 ? 'در حال پایش' : index === 1 ? 'پاسخ برنامه‌ریزی‌شده' : 'ارزیابی‌شده',
    strategy: risk.strategy, description: risk.description, responsePlan: risk.response, trigger: 'عبور شاخص از آستانه مورد توافق',
    reviewDate: risk.actionDeadline, responseDeadline: risk.actionDeadline, actionProgress: 20 + index * 15,
    trend: index === 0 ? 'افزایشی' : index === 1 ? 'کاهشی' : 'ثابت', escalated: risk.score >= 16,
    history: [{ id: `seed-${index}`, action: 'ریسک شناسایی و در دفتر ریسک ثبت شد', actor: risk.owner, at: todayJalali() }], updatedAt: todayJalali(),
  }
})

function loadRisks(): ManagedRisk[] {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return Array.isArray(saved) ? saved : seedRisks() } catch { return seedRisks() }
}

interface ProjectRiskManagementProps { projectId?: string }

export default function ProjectRiskManagement({ projectId }: ProjectRiskManagementProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const saved = localStorage.getItem(SELECTED_PROJECT_KEY)
    return SAMPLE_PROJECTS.some(project => project.id === saved) ? saved! : SAMPLE_PROJECTS[0].id
  })
  const activeProjectId = projectId || selectedProjectId
  const [risks, setRisks] = useState<ManagedRisk[]>(loadRisks)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<RiskLevel>()
  const [statusFilter, setStatusFilter] = useState<RiskStatus>()
  const [heatCell, setHeatCell] = useState<{ probability: number; impact: number }>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedRisk>()
  const [selected, setSelected] = useState<ManagedRisk>()
  const [form] = Form.useForm()

  const persist = (next: ManagedRisk[]) => { setRisks(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
  const projectRisks = useMemo(() => risks.filter(risk => risk.projectId === activeProjectId), [risks, activeProjectId])
  const filtered = useMemo(() => projectRisks.filter(risk => {
    const query = search.trim().toLocaleLowerCase('fa')
    return (!query || `${risk.code} ${risk.title} ${risk.owner} ${risk.category}`.toLocaleLowerCase('fa').includes(query))
      && (!levelFilter || risk.level === levelFilter) && (!statusFilter || risk.status === statusFilter)
      && (!heatCell || (risk.probability === heatCell.probability && risk.impact === heatCell.impact))
  }), [projectRisks, search, levelFilter, statusFilter, heatCell])

  const openModal = (risk?: ManagedRisk) => {
    setEditing(risk)
    form.resetFields()
    form.setFieldsValue(risk || { projectId: activeProjectId, probability: 3, impact: 3, residualProbability: 2, residualImpact: 2, status: 'شناسایی‌شده', strategy: 'کاهش', actionProgress: 0, trend: 'ثابت', owner: USERS[0] })
    setModalOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    const score = Number(values.probability) * Number(values.impact)
    const residualScore = Number(values.residualProbability) * Number(values.residualImpact)
    const now = todayJalali()
    const item: ManagedRisk = {
      ...(editing || { id: crypto.randomUUID(), code: `RSK-${String(risks.length + 1).padStart(3, '0')}`, history: [] }),
      ...values, score, residualScore, level: levelOf(score), updatedAt: now,
      history: [...(editing?.history || []), { id: crypto.randomUUID(), action: editing ? 'اطلاعات و ارزیابی ریسک به‌روزرسانی شد' : 'ریسک شناسایی و ثبت شد', actor: values.owner, at: now }],
    }
    persist(editing ? risks.map(risk => risk.id === editing.id ? item : risk) : [item, ...risks])
    setModalOpen(false); setSelected(item); message.success(editing ? 'ریسک به‌روزرسانی شد' : 'ریسک در دفتر ریسک ثبت شد')
  }

  const updateRisk = (risk: ManagedRisk, changes: Partial<ManagedRisk>, action: string) => {
    const updated = { ...risk, ...changes, updatedAt: todayJalali(), history: [...risk.history, { id: crypto.randomUUID(), action, actor: 'مدیر سیستم', at: todayJalali() }] }
    persist(risks.map(item => item.id === risk.id ? updated : item)); setSelected(updated); message.success(action)
  }

  const columns = [
    { title: 'کد', dataIndex: 'code', width: 95, render: (value: string) => <Tag color="orange">{value}</Tag> },
    { title: 'ریسک', dataIndex: 'title', render: (value: string, risk: ManagedRisk) => <div><b>{value}</b><div style={{ color: '#8c8c8c', fontSize: 11 }}>{risk.category} — {risk.owner}</div></div> },
    { title: 'ذاتی', width: 85, render: (_: unknown, risk: ManagedRisk) => <Score score={risk.score} level={risk.level} /> },
    { title: 'باقیمانده', width: 95, render: (_: unknown, risk: ManagedRisk) => <Score score={risk.residualScore} level={levelOf(risk.residualScore)} /> },
    { title: 'پاسخ', dataIndex: 'strategy', width: 90, render: (value: string) => <Tag color="blue">{value}</Tag> },
    { title: 'پیشرفت اقدام', dataIndex: 'actionProgress', width: 140, render: (value: number) => <Progress percent={value} size="small" strokeColor={PRIMARY} /> },
    { title: 'روند', dataIndex: 'trend', width: 80, render: (value: RiskTrend) => <Tag color={value === 'افزایشی' ? 'red' : value === 'کاهشی' ? 'green' : 'default'}>{value}</Tag> },
    { title: 'وضعیت', dataIndex: 'status', width: 140, render: (value: RiskStatus) => <Tag color={statusColor(value)}>{value}</Tag> },
    { title: 'عملیات', width: 120, render: (_: unknown, risk: ManagedRisk) => <Space><Button size="small" icon={<EyeOutlined />} onClick={() => setSelected(risk)} /><Button size="small" icon={<EditOutlined />} onClick={() => openModal(risk)} /><Popconfirm title="حذف ریسک؟" onConfirm={() => persist(risks.filter(item => item.id !== risk.id))}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space> },
  ]

  const highCount = projectRisks.filter(risk => risk.score >= 10 && risk.status !== 'بسته‌شده').length
  const residualAverage = projectRisks.length ? Math.round(projectRisks.reduce((sum, risk) => sum + risk.residualScore, 0) / projectRisks.length) : 0

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    {!projectId && <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
      <ProjectContextHeader
        title="مدیریت ریسک"
        projectId={activeProjectId}
        onProjectChange={value => { localStorage.setItem(SELECTED_PROJECT_KEY, value); setSelectedProjectId(value) }}
        onAdd={() => openModal()}
        addLabel="ریسک جدید"
      />
    </Card>}
    <Card size="small" style={{ borderRight: `4px solid ${PRIMARY}` }}>
      <Space direction="vertical" size={2}>
        <Typography.Title level={4} style={{ margin: 0 }}>دفتر و داشبورد ریسک پروژه</Typography.Title>
        <Typography.Text type="secondary">شناسایی، ارزیابی، برنامه پاسخ و پایش ریسک‌های پروژه انتخاب‌شده</Typography.Text>
      </Space>
    </Card>
    <Row gutter={[12, 12]}>
      <Col xs={12} lg={6}><Card size="small"><Statistic title="ریسک‌های باز" value={projectRisks.filter(risk => !['بسته‌شده', 'محقق‌شده'].includes(risk.status)).length} prefix={<AlertOutlined style={{ color: PRIMARY }} />} /></Card></Col>
      <Col xs={12} lg={6}><Card size="small"><Statistic title="مواجهه بالا و بحرانی" value={highCount} valueStyle={{ color: highCount ? '#f5222d' : '#389e0d' }} /></Card></Col>
      <Col xs={12} lg={6}><Card size="small"><Statistic title="میانگین ریسک باقیمانده" value={residualAverage} /></Card></Col>
      <Col xs={12} lg={6}><Card size="small"><Statistic title="موارد تشدیدشده" value={projectRisks.filter(risk => risk.escalated).length} prefix={<ThunderboltOutlined style={{ color: '#fa8c16' }} />} /></Card></Col>
    </Row>

    <Card title="ماتریس احتمال × اثر" size="small" extra={heatCell && <Button type="link" onClick={() => setHeatCell(undefined)}>حذف انتخاب ماتریس</Button>}>
      <RiskMatrix risks={projectRisks} selected={heatCell} onSelect={(probability, impact) => setHeatCell(previous => previous?.probability === probability && previous.impact === impact ? undefined : { probability, impact })} />
    </Card>

    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Space wrap><Input prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} allowClear placeholder="جستجو در دفتر ریسک..." style={{ width: 240 }} /><Select allowClear placeholder="سطح ریسک" value={levelFilter} onChange={setLevelFilter} style={{ width: 130 }} options={['بحرانی', 'بالا', 'متوسط', 'پایین'].map(value => ({ value, label: value }))} /><Select allowClear placeholder="مرحله چرخه ریسک" value={statusFilter} onChange={setStatusFilter} style={{ width: 180 }} options={['شناسایی‌شده', 'ارزیابی‌شده', 'پاسخ برنامه‌ریزی‌شده', 'در حال پایش', 'بسته‌شده', 'محقق‌شده'].map(value => ({ value, label: value }))} /></Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ background: PRIMARY }}>ریسک جدید</Button>
      </div>
      <Table rowKey="id" dataSource={filtered} columns={columns} scroll={{ x: 1100 }} pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description="ریسکی مطابق فیلتر وجود ندارد" /> }} />
    </Card>

    <RiskModal open={modalOpen} editing={editing} form={form} projectId={activeProjectId} onCancel={() => setModalOpen(false)} onSave={() => void save()} />
    <RiskDrawer risk={selected} onClose={() => setSelected(undefined)} onEdit={openModal} onUpdate={updateRisk} />
  </div>
}

function Score({ score, level }: { score: number; level: RiskLevel }) { return <div style={{ textAlign: 'center' }}><b style={{ color: levelColor(level), fontSize: 17 }}>{score.toLocaleString('fa-IR')}</b><div style={{ fontSize: 10, color: levelColor(level) }}>{level}</div></div> }

function RiskMatrix({ risks, selected, onSelect }: { risks: ManagedRisk[]; selected?: { probability: number; impact: number }; onSelect: (probability: number, impact: number) => void }) {
  return <div style={{ maxWidth: 760, margin: 'auto' }}><div style={{ display: 'grid', gridTemplateColumns: '42px repeat(5, 1fr)', gap: 4 }}>
    <div />{[1, 2, 3, 4, 5].map(value => <div key={`head-${value}`} style={{ textAlign: 'center', color: '#8c8c8c' }}>اثر {value.toLocaleString('fa-IR')}</div>)}
    {[5, 4, 3, 2, 1].flatMap(probability => [<div key={`p-${probability}`} style={{ display: 'grid', placeItems: 'center', color: '#8c8c8c' }}>ا {probability.toLocaleString('fa-IR')}</div>, ...[1, 2, 3, 4, 5].map(impact => {
      const score = probability * impact; const level = levelOf(score); const count = risks.filter(risk => risk.probability === probability && risk.impact === impact).length; const active = selected?.probability === probability && selected.impact === impact
      return <button key={`${probability}-${impact}`} onClick={() => onSelect(probability, impact)} style={{ minHeight: 55, borderRadius: 7, cursor: 'pointer', background: `${levelColor(level)}22`, border: active ? `3px solid ${PRIMARY}` : `1px solid ${levelColor(level)}88` }}><b>{score.toLocaleString('fa-IR')}</b>{count > 0 && <Badge count={count} color={levelColor(level)} style={{ marginRight: 8 }} />}</button>
    })])}
  </div></div>
}

function RiskModal({ open, editing, form, projectId, onCancel, onSave }: { open: boolean; editing?: ManagedRisk; form: ReturnType<typeof Form.useForm>[0]; projectId: string; onCancel: () => void; onSave: () => void }) {
  return <Modal open={open} title={editing ? 'ویرایش و ارزیابی ریسک' : 'ثبت ریسک جدید'} onCancel={onCancel} onOk={onSave} okText="ذخیره" cancelText="انصراف" width={820} centered maskClosable={false} okButtonProps={{ style: { background: PRIMARY } }}><Form form={form} layout="vertical"><Tabs items={[
    { key: 'identify', label: 'شناسایی', children: <Row gutter={12}><Col span={16}><Form.Item name="title" label="عنوان ریسک" rules={[{ required: true }, { max: 200 }]}><Input maxLength={200} /></Form.Item></Col><Col span={8}><Form.Item name="projectId" label="پروژه" rules={[{ required: true }]}><Select disabled value={projectId} options={SAMPLE_PROJECTS.map(project => ({ value: project.id, label: project.name }))} /></Form.Item></Col><Col span={8}><Form.Item name="category" label="دسته" rules={[{ required: true }]}><Select options={['زمان', 'هزینه', 'کیفیت', 'فنی', 'منابع', 'تأمین', 'ذی‌نفعان', 'ایمنی'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="owner" label="مالک ریسک" rules={[{ required: true }]}><Select options={USERS.map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="status" label="مرحله"><Select options={['شناسایی‌شده', 'ارزیابی‌شده', 'پاسخ برنامه‌ریزی‌شده', 'در حال پایش', 'بسته‌شده', 'محقق‌شده'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={24}><Form.Item name="description" label="شرح رویداد نامطمئن"><Input.TextArea rows={2} /></Form.Item></Col><Col span={12}><Form.Item name="cause" label="علت"><Input.TextArea rows={2} /></Form.Item></Col><Col span={12}><Form.Item name="consequence" label="پیامد"><Input.TextArea rows={2} /></Form.Item></Col><Col span={24}><Form.Item name="trigger" label="محرک یا نشانه وقوع"><Input /></Form.Item></Col></Row> },
    { key: 'assess', label: 'ارزیابی', children: <Row gutter={16}><Col span={12}><Card size="small" title="ریسک ذاتی"><Form.Item name="probability" label="احتمال ۱ تا ۵"><Slider min={1} max={5} marks={{ 1: '۱', 3: '۳', 5: '۵' }} /></Form.Item><Form.Item name="impact" label="اثر ۱ تا ۵"><Slider min={1} max={5} marks={{ 1: '۱', 3: '۳', 5: '۵' }} /></Form.Item></Card></Col><Col span={12}><Card size="small" title="ریسک باقیمانده پس از پاسخ"><Form.Item name="residualProbability" label="احتمال باقیمانده"><Slider min={1} max={5} marks={{ 1: '۱', 3: '۳', 5: '۵' }} /></Form.Item><Form.Item name="residualImpact" label="اثر باقیمانده"><Slider min={1} max={5} marks={{ 1: '۱', 3: '۳', 5: '۵' }} /></Form.Item></Card></Col></Row> },
    { key: 'response', label: 'پاسخ و پایش', children: <Row gutter={12}><Col span={8}><Form.Item name="strategy" label="راهبرد پاسخ"><Select options={['اجتناب', 'کاهش', 'انتقال', 'پذیرش', 'بهره‌برداری'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="trend" label="روند"><Select options={['کاهشی', 'ثابت', 'افزایشی'].map(value => ({ value, label: value }))} /></Form.Item></Col><Col span={8}><Form.Item name="actionProgress" label="پیشرفت اقدام"><InputNumber min={0} max={100} addonAfter="٪" style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="reviewDate" label="تاریخ بازبینی بعدی"><PersianDatePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="responseDeadline" label="مهلت اجرای پاسخ"><PersianDatePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={24}><Form.Item name="responsePlan" label="برنامه پاسخ"><Input.TextArea rows={3} /></Form.Item></Col><Col span={24}><Form.Item name="contingencyPlan" label="برنامه احتیاطی در صورت وقوع"><Input.TextArea rows={2} /></Form.Item></Col></Row> },
  ]} /></Form></Modal>
}

function RiskDrawer({ risk, onClose, onEdit, onUpdate }: { risk?: ManagedRisk; onClose: () => void; onEdit: (risk: ManagedRisk) => void; onUpdate: (risk: ManagedRisk, changes: Partial<ManagedRisk>, action: string) => void }) {
  if (!risk) return null
  return <Drawer open width={620} title={`${risk.code} — ${risk.title}`} onClose={onClose} extra={<Button icon={<EditOutlined />} onClick={() => onEdit(risk)}>ویرایش</Button>}><Space wrap style={{ marginBottom: 14 }}><Tag color={levelColor(risk.level)}>{risk.level}</Tag><Tag color={statusColor(risk.status)}>{risk.status}</Tag>{risk.escalated && <Tag color="red" icon={<ThunderboltOutlined />}>تشدیدشده</Tag>}</Space><Tabs items={[
    { key: 'overview', label: 'نمای کلی', children: <><Descriptions bordered size="small" column={2} items={[{ key: 'project', label: 'پروژه', children: projectName(risk.projectId) }, { key: 'owner', label: 'مالک', children: risk.owner }, { key: 'inherent', label: 'امتیاز ذاتی', children: <Score score={risk.score} level={risk.level} /> }, { key: 'residual', label: 'امتیاز باقیمانده', children: <Score score={risk.residualScore} level={levelOf(risk.residualScore)} /> }, { key: 'cause', label: 'علت', span: 2, children: risk.cause || 'ثبت نشده' }, { key: 'consequence', label: 'پیامد', span: 2, children: risk.consequence || 'ثبت نشده' }, { key: 'trigger', label: 'محرک', span: 2, children: risk.trigger || 'ثبت نشده' }]} /></> },
    { key: 'response', label: 'اقدامات پاسخ', children: <><Card size="small" title={`راهبرد: ${risk.strategy}`}><Typography.Paragraph>{risk.responsePlan || 'برنامه پاسخ ثبت نشده است.'}</Typography.Paragraph><Progress percent={risk.actionProgress} strokeColor={PRIMARY} /><Space wrap style={{ marginTop: 12 }}><Button disabled={risk.actionProgress >= 100} onClick={() => onUpdate(risk, { actionProgress: Math.min(100, risk.actionProgress + 25), status: 'در حال پایش' }, 'پیشرفت اقدام پاسخ ثبت شد')}>ثبت ۲۵٪ پیشرفت</Button><Button type="primary" icon={<CheckCircleOutlined />} onClick={() => onUpdate(risk, { actionProgress: 100, status: 'بسته‌شده', trend: 'کاهشی' }, 'ریسک بسته شد')} style={{ background: '#389e0d' }}>بستن ریسک</Button><Button danger icon={<ThunderboltOutlined />} onClick={() => onUpdate(risk, { escalated: true }, 'ریسک به کمیته راهبری تشدید شد')}>تشدید</Button></Space></Card><Card size="small" title="برنامه احتیاطی" style={{ marginTop: 12 }}>{risk.contingencyPlan || 'ثبت نشده'}</Card></> },
    { key: 'history', label: 'تاریخچه', children: <Timeline items={[...risk.history].reverse().map(item => ({ children: <div><b>{item.action}</b><div style={{ color: '#8c8c8c' }}>{item.actor} — {item.at}</div></div> }))} /> },
  ]} /></Drawer>
}
