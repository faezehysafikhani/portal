import { useMemo, useState } from 'react'
import {
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  PlusOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import PersianDatePicker from '../../components/PersianDatePicker'
import { SAMPLE_PORTFOLIOS, SAMPLE_PROJECTS, USERS, formatCurrency } from './ptmsData'

const STORAGE_KEY = 'portal:managed-portfolios:v2'
const BRAND = '#8B1A6B'

type StrategicStatus = 'در مسیر' | 'نیازمند توجه' | 'خارج از مسیر' | 'تعیین نشده'
type Scope = 'active' | 'mine' | 'favorite' | 'archived'

interface ManagedPortfolio {
  id: string
  code: string
  name: string
  manager: string
  description: string
  strategicStatus: StrategicStatus
  statusExplanation: string
  projectIds: string[]
  programNames: string[]
  budget: number
  startDate?: string
  endDate?: string
  active: boolean
  archived: boolean
  favorite: boolean
  isPublic: boolean
  updatedAt: string
}

const statusMeta: Record<StrategicStatus, { color: string; label: string }> = {
  'در مسیر': { color: '#52c41a', label: 'در مسیر' },
  'نیازمند توجه': { color: '#fa8c16', label: 'نیازمند توجه' },
  'خارج از مسیر': { color: '#ff4d4f', label: 'خارج از مسیر' },
  'تعیین نشده': { color: '#8c8c8c', label: 'تعیین نشده' },
}

const nowFa = () => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())

const makeSeed = (): ManagedPortfolio[] => SAMPLE_PORTFOLIOS.map((portfolio, index) => ({
  id: portfolio.id,
  code: portfolio.code,
  name: portfolio.name,
  manager: portfolio.manager,
  description: portfolio.description || 'نمای تجمیعی برنامه‌ها و پروژه‌های مرتبط با اهداف راهبردی سازمان',
  strategicStatus: index === 0 ? 'در مسیر' : 'نیازمند توجه',
  statusExplanation: index === 0
    ? 'پیشرفت پروژه‌های زیرمجموعه با برنامه مصوب هم‌راستا است.'
    : 'ریسک‌ها و انحراف هزینه پروژه‌های زیرمجموعه نیازمند تصمیم مدیریتی است.',
  projectIds: SAMPLE_PROJECTS.filter(project => project.portfolioId === portfolio.id).map(project => project.id),
  programNames: index === 0 ? ['تحول دیجیتال', 'زیرساخت سازمانی'] : ['توسعه دارایی‌های عمرانی'],
  budget: portfolio.budget,
  startDate: portfolio.startDate,
  endDate: portfolio.endDate,
  active: portfolio.status !== 'آرشیو',
  archived: portfolio.status === 'آرشیو',
  favorite: index === 0,
  isPublic: false,
  updatedAt: nowFa(),
}))

function readPortfolios(): ManagedPortfolio[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) : makeSeed()
  } catch {
    return makeSeed()
  }
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<ManagedPortfolio[]>(readPortfolios)
  const [scope, setScope] = useState<Scope>('active')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedPortfolio | null>(null)
  const [selected, setSelected] = useState<ManagedPortfolio | null>(null)
  const [form] = Form.useForm()

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('user')
      const user = raw ? JSON.parse(raw) : null
      return user?.fullName || user?.name || user?.firstName || 'مدیر سیستم'
    } catch {
      return 'مدیر سیستم'
    }
  }, [])

  const save = (next: ManagedPortfolio[]) => {
    setPortfolios(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const projectsOf = (portfolio: ManagedPortfolio) => SAMPLE_PROJECTS.filter(project => portfolio.projectIds.includes(project.id))
  const aggregate = (portfolio: ManagedPortfolio) => {
    const projects = projectsOf(portfolio)
    const progress = projects.length ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0
    const cost = projects.reduce((sum, project) => sum + project.actualCost, 0)
    const risks = projects.reduce((sum, project) => sum + project.riskCount, 0)
    const issues = projects.reduce((sum, project) => sum + project.issueCount, 0)
    return { projects, progress, cost, risks, issues }
  }

  const filtered = useMemo(() => portfolios.filter(portfolio => {
    if (scope === 'active' && (!portfolio.active || portfolio.archived)) return false
    if (scope === 'archived' && !portfolio.archived) return false
    if (scope === 'favorite' && !portfolio.favorite) return false
    if (scope === 'mine' && portfolio.manager !== currentUser) return false
    const needle = query.trim().toLowerCase()
    return !needle || `${portfolio.code} ${portfolio.name} ${portfolio.manager} ${portfolio.description}`.toLowerCase().includes(needle)
  }), [currentUser, portfolios, query, scope])

  const openEditor = (portfolio?: ManagedPortfolio) => {
    setEditing(portfolio || null)
    if (portfolio) form.setFieldsValue(portfolio)
    else {
      form.resetFields()
      form.setFieldsValue({ manager: currentUser, strategicStatus: 'تعیین نشده', active: true, isPublic: false, projectIds: [], programNames: [] })
    }
    setModalOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const next: ManagedPortfolio = {
      id: editing?.id || crypto.randomUUID(),
      code: editing?.code || `PF-${String(portfolios.length + 1).padStart(3, '0')}`,
      description: '',
      statusExplanation: '',
      budget: 0,
      projectIds: [],
      programNames: [],
      active: true,
      archived: false,
      favorite: editing?.favorite || false,
      isPublic: false,
      ...editing,
      ...values,
      updatedAt: nowFa(),
    }
    save(editing ? portfolios.map(item => item.id === editing.id ? next : item) : [next, ...portfolios])
    setModalOpen(false)
    if (selected?.id === next.id) setSelected(next)
  }

  const patchPortfolio = (id: string, patch: Partial<ManagedPortfolio>) => {
    const next = portfolios.map(item => item.id === id ? { ...item, ...patch, updatedAt: nowFa() } : item)
    save(next)
    if (selected?.id === id) setSelected({ ...selected, ...patch, updatedAt: nowFa() })
  }

  const duplicate = (portfolio: ManagedPortfolio) => {
    const copy: ManagedPortfolio = {
      ...portfolio,
      id: crypto.randomUUID(),
      code: `${portfolio.code}-COPY`,
      name: `${portfolio.name} - کپی`,
      favorite: false,
      updatedAt: nowFa(),
    }
    save([copy, ...portfolios])
  }

  const activeCount = portfolios.filter(item => item.active && !item.archived).length
  const totalProjects = new Set(portfolios.flatMap(item => item.projectIds)).size
  const atRiskCount = portfolios.filter(item => ['نیازمند توجه', 'خارج از مسیر'].includes(item.strategicStatus) && !item.archived).length

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'پرتفولیوهای فعال', value: activeCount, color: BRAND },
          { label: 'پروژه‌های زیرمجموعه', value: totalProjects, color: '#1677ff' },
          { label: 'نیازمند تصمیم', value: atRiskCount, color: '#fa8c16' },
          { label: 'علاقه‌مندی‌ها', value: portfolios.filter(item => item.favorite).length, color: '#722ed1' },
        ].map(item => (
          <Col xs={12} lg={6} key={item.label}>
            <Card size="small" style={{ borderTop: `3px solid ${item.color}` }}>
              <Typography.Text type="secondary">{item.label}</Typography.Text>
              <div style={{ color: item.color, fontSize: 26, fontWeight: 700 }}>{item.value.toLocaleString('fa-IR')}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title={<Space><ApartmentOutlined style={{ color: BRAND }} />مدیریت پرتفولیو پروژه</Space>}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()} style={{ background: BRAND }}>پرتفولیوی جدید</Button>}
      >
        <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 18 }}>
          <Segmented
            value={scope}
            onChange={value => setScope(value as Scope)}
            options={[
              { label: `فعال (${activeCount.toLocaleString('fa-IR')})`, value: 'active' },
              { label: 'پرتفولیوهای من', value: 'mine' },
              { label: 'علاقه‌مندی‌ها', value: 'favorite' },
              { label: 'آرشیو', value: 'archived' },
            ]}
          />
          <Input
            allowClear
            value={query}
            onChange={event => setQuery(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder="جست‌وجوی پرتفولیو"
            style={{ width: 260 }}
          />
        </Space>

        {filtered.length === 0 ? <Empty description="پرتفولیویی مطابق فیلتر پیدا نشد" /> : (
          <Row gutter={[16, 16]}>
            {filtered.map(portfolio => {
              const summary = aggregate(portfolio)
              const meta = statusMeta[portfolio.strategicStatus]
              return (
                <Col xs={24} xl={12} key={portfolio.id}>
                  <Card
                    hoverable
                    onClick={() => setSelected(portfolio)}
                    styles={{ body: { padding: 18 } }}
                    title={(
                      <Space>
                        <FolderOpenOutlined style={{ color: BRAND }} />
                        <span>{portfolio.name}</span>
                        <Tag>{portfolio.code}</Tag>
                      </Space>
                    )}
                    extra={(
                      <Space onClick={event => event.stopPropagation()}>
                        <Tooltip title={portfolio.favorite ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}>
                          <Button type="text" icon={portfolio.favorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} onClick={() => patchPortfolio(portfolio.id, { favorite: !portfolio.favorite })} />
                        </Tooltip>
                        <Button type="text" icon={<EditOutlined />} onClick={() => openEditor(portfolio)} />
                        <Button type="text" icon={<CopyOutlined />} onClick={() => duplicate(portfolio)} />
                        <Tooltip title={portfolio.archived ? 'بازیابی' : 'آرشیو'}>
                          <Button type="text" icon={<InboxOutlined />} onClick={() => patchPortfolio(portfolio.id, { archived: !portfolio.archived, active: portfolio.archived })} />
                        </Tooltip>
                        <Popconfirm title="این پرتفولیو حذف شود؟" onConfirm={() => save(portfolios.filter(item => item.id !== portfolio.id))}>
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    )}
                  >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Space wrap>
                        <Badge color={meta.color} text={meta.label} />
                        <Tag>{portfolio.manager}</Tag>
                        {portfolio.isPublic && <Tag color="blue">عمومی</Tag>}
                      </Space>
                      <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, minHeight: 44 }}>{portfolio.description}</Typography.Paragraph>
                      <div>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text strong>سلامت و پیشرفت تجمیعی</Typography.Text>
                          <Typography.Text>{summary.progress.toLocaleString('fa-IR')}٪</Typography.Text>
                        </Space>
                        <Progress percent={summary.progress} showInfo={false} strokeColor={meta.color} trailColor="#f0f0f0" />
                      </div>
                      <Row gutter={8}>
                        <Col span={6}><div style={{ textAlign: 'center' }}><b>{summary.projects.length.toLocaleString('fa-IR')}</b><br /><small>پروژه</small></div></Col>
                        <Col span={6}><div style={{ textAlign: 'center' }}><b>{portfolio.programNames.length.toLocaleString('fa-IR')}</b><br /><small>برنامه</small></div></Col>
                        <Col span={6}><div style={{ textAlign: 'center', color: summary.risks ? '#fa8c16' : undefined }}><b>{summary.risks.toLocaleString('fa-IR')}</b><br /><small>ریسک</small></div></Col>
                        <Col span={6}><div style={{ textAlign: 'center', color: summary.issues ? '#ff4d4f' : undefined }}><b>{summary.issues.toLocaleString('fa-IR')}</b><br /><small>مسئله</small></div></Col>
                      </Row>
                      <Typography.Text type="secondary">آخرین به‌روزرسانی: {portfolio.updatedAt}</Typography.Text>
                    </Space>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Card>

      <Modal
        title={editing ? 'ویرایش پرتفولیو' : 'ایجاد پرتفولیوی جدید'}
        open={modalOpen}
        onOk={submit}
        onCancel={() => setModalOpen(false)}
        okText="ذخیره"
        cancelText="انصراف"
        width={800}
        okButtonProps={{ style: { background: BRAND } }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col xs={24} md={16}><Form.Item name="name" label="نام پرتفولیو" rules={[{ required: true, message: 'نام را وارد کنید' }]}><Input maxLength={120} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="manager" label="مدیر پرتفولیو" rules={[{ required: true }]}><Select showSearch options={USERS.map(value => ({ value, label: value }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="strategicStatus" label="وضعیت راهبردی"><Select options={Object.keys(statusMeta).map(value => ({ value, label: value }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="budget" label="بودجه مصوب (ریال)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="statusExplanation" label="توضیح وضعیت"><Input.TextArea rows={2} maxLength={500} showCount /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="هدف و شرح پرتفولیو"><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item></Col>
            <Col span={24}><Form.Item name="programNames" label="برنامه‌ها"><Select mode="tags" tokenSeparators={[',']} placeholder="نام برنامه را بنویسید و Enter بزنید" /></Form.Item></Col>
            <Col span={24}><Form.Item name="projectIds" label="پروژه‌های زیرمجموعه"><Select mode="multiple" optionFilterProp="label" options={SAMPLE_PROJECTS.map(project => ({ value: project.id, label: `${project.code} — ${project.name}` }))} /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="startDate" label="تاریخ شروع"><PersianDatePicker /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="endDate" label="تاریخ پایان"><PersianDatePicker /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="active" label="فعال" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="isPublic" label="قابل مشاهده برای همه" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Drawer title={selected?.name} open={Boolean(selected)} onClose={() => setSelected(null)} width={720}>
        {selected && (() => {
          const summary = aggregate(selected)
          const meta = statusMeta[selected.strategicStatus]
          return (
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Space wrap><Tag>{selected.code}</Tag><Badge color={meta.color} text={meta.label} /><Tag>{selected.manager}</Tag></Space>
              <Typography.Paragraph>{selected.description}</Typography.Paragraph>
              <Card size="small" title="توضیح وضعیت راهبردی">{selected.statusExplanation || 'توضیحی ثبت نشده است.'}</Card>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="بازه">{selected.startDate || '—'} تا {selected.endDate || '—'}</Descriptions.Item>
                <Descriptions.Item label="پیشرفت"><Progress percent={summary.progress} size="small" strokeColor={meta.color} /></Descriptions.Item>
                <Descriptions.Item label="بودجه مصوب">{formatCurrency(selected.budget)}</Descriptions.Item>
                <Descriptions.Item label="هزینه واقعی">{formatCurrency(summary.cost)}</Descriptions.Item>
                <Descriptions.Item label="ریسک‌ها">{summary.risks.toLocaleString('fa-IR')}</Descriptions.Item>
                <Descriptions.Item label="مسائل">{summary.issues.toLocaleString('fa-IR')}</Descriptions.Item>
              </Descriptions>
              <Card size="small" title={<Space><ApartmentOutlined />ساختار برنامه و پروژه</Space>}>
                {selected.programNames.map(program => <Tag color="purple" key={program} style={{ marginBottom: 12 }}>{program}</Tag>)}
                <Space direction="vertical" style={{ width: '100%' }}>
                  {summary.projects.map(project => (
                    <Card size="small" key={project.id}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space><FolderOpenOutlined style={{ color: BRAND }} /><b>{project.name}</b><Tag>{project.code}</Tag></Space>
                        <Space wrap><Tag color="blue">{project.status}</Tag><span>مدیر: {project.manager}</span><span>پیشرفت: {project.progress.toLocaleString('fa-IR')}٪</span></Space>
                        <Progress percent={project.progress} showInfo={false} strokeColor={BRAND} />
                      </Space>
                    </Card>
                  ))}
                  {!summary.projects.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="پروژه‌ای متصل نشده است" />}
                </Space>
              </Card>
              <Space>
                <Button type="primary" style={{ background: BRAND }} icon={<EditOutlined />} onClick={() => openEditor(selected)}>ویرایش</Button>
                <Button icon={<InboxOutlined />} onClick={() => patchPortfolio(selected.id, { archived: !selected.archived, active: selected.archived })}>{selected.archived ? 'بازیابی از آرشیو' : 'انتقال به آرشیو'}</Button>
              </Space>
            </Space>
          )
        })()}
      </Drawer>
    </div>
  )
}
