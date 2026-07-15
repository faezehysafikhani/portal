import { useState } from 'react'
import { Card, Table, Button, Tag, Progress, Space, Input, Select, Modal, Form, Row, Col, Slider, Tabs, Avatar, Tooltip } from 'antd'
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { SAMPLE_PROJECTS, getPriorityColor, getStatusColor, formatCurrency, USERS } from './ptmsData'
import type { Project, ProjectStatus, Priority } from './ptmsData'

const STATUS_OPTIONS: ProjectStatus[] = ['تعریف شده', 'در حال اجرا', 'تعلیق', 'تکمیل شده', 'لغو شده']
const PRIORITY_OPTIONS: Priority[] = ['بحرانی', 'بالا', 'متوسط', 'پایین']

export default function PTMSProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>(SAMPLE_PROJECTS)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deleteModal, setDeleteModal] = useState<Project | null>(null)
  const [form] = Form.useForm()

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.code.includes(search) || p.manager.includes(search)
    const matchStatus = !filterStatus || p.status === filterStatus
    const matchPriority = !filterPriority || p.priority === filterPriority
    return matchSearch && matchStatus && matchPriority
  })

  const openModal = (project?: Project) => {
    if (project) { setEditingProject(project); form.setFieldsValue(project) }
    else { setEditingProject(null); form.resetFields(); form.setFieldsValue({ status: 'تعریف شده', priority: 'متوسط', progress: 0, type: 'IT', method: 'آبشاری' }) }
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingProject) {
        setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...values } : p))
      } else {
        setProjects(prev => [{ id: Date.now().toString(), code: `PRJ-${String(projects.length + 1).padStart(3, '0')}`, actualCost: 0, riskCount: 0, issueCount: 0, taskCount: 0, team: [], ...values }, ...prev])
      }
      setModalOpen(false)
    })
  }

  const columns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{c}</Tag> },
    {
      title: 'نام پروژه', dataIndex: 'name', key: 'name',
      render: (name: string, r: Project) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.portfolio || '—'}</div>
        </div>
      )
    },
    { title: 'مدیر پروژه', dataIndex: 'manager', key: 'manager', width: 130, render: (m: string) => <Space><Avatar size={24} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} /><span style={{ fontSize: 12 }}>{m}</span></Space> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 120, render: (s: ProjectStatus) => <Tag color={getStatusColor(s) as string}>{s}</Tag> },
    { title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 90, render: (p: Priority) => <Tag color={getPriorityColor(p) as string}>{p}</Tag> },
    { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', width: 150, render: (p: number) => <Progress percent={p} size="small" strokeColor="#8B1A6B" /> },
    { title: 'بودجه', dataIndex: 'budget', key: 'budget', width: 140, render: (b: number) => <span style={{ fontSize: 11 }}>{formatCurrency(b)}</span> },
    { title: 'تاریخ پایان', dataIndex: 'endDate', key: 'endDate', width: 110, render: (d: string) => <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d}</span> },
    {
      title: 'عملیات', key: 'actions', width: 130,
      render: (_: unknown, r: Project) => (
        <Space>
          <Tooltip title="جزئیات"><Button size="small" icon={<EyeOutlined />} type="primary" ghost onClick={() => navigate(`/ptms/projects/${r.id}`)} /></Tooltip>
          <Tooltip title="ویرایش"><Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
          <Tooltip title="حذف"><Button size="small" icon={<DeleteOutlined />} danger onClick={() => setDeleteModal(r)} /></Tooltip>
        </Space>
      )
    },
  ]

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {STATUS_OPTIONS.map(s => (
          <Col key={s} xs={12} md={4}>
            <Card size="small" style={{ textAlign: 'center', cursor: 'pointer', borderTop: `3px solid ${getStatusColor(s) === 'blue' ? '#1677ff' : getStatusColor(s) === 'green' ? '#52c41a' : getStatusColor(s) === 'orange' ? '#fa8c16' : getStatusColor(s) === 'red' ? '#f5222d' : '#d9d9d9'}` }} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{projects.filter(p => p.status === s).length}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{s}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input prefix={<SearchOutlined />} placeholder="جستجو..." style={{ width: 220 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
            <Select placeholder="وضعیت" style={{ width: 140 }} value={filterStatus || undefined} onChange={setFilterStatus} allowClear>
              {STATUS_OPTIONS.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
            </Select>
            <Select placeholder="اولویت" style={{ width: 120 }} value={filterPriority || undefined} onChange={setFilterPriority} allowClear>
              {PRIORITY_OPTIONS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>پروژه جدید</Button>
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" scroll={{ x: 1100 }} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title={editingProject ? 'ویرایش پروژه' : 'پروژه جدید'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={800} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={form} layout="vertical">
          <Tabs items={[
            {
              key: '1', label: 'اطلاعات اصلی',
              children: (
                <Row gutter={16}>
                  <Col xs={24} md={12}><Form.Item name="name" label="نام پروژه" rules={[{ required: true }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="portfolio" label="سبد پروژه"><Select allowClear><Select.Option value="سبد پروژه‌های IT">سبد IT</Select.Option><Select.Option value="سبد پروژه‌های عمرانی">سبد عمرانی</Select.Option></Select></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="manager" label="مدیر پروژه" rules={[{ required: true }]}><Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="sponsor" label="حامی پروژه"><Select allowClear>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="status" label="وضعیت" rules={[{ required: true }]}><Select>{STATUS_OPTIONS.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="priority" label="اولویت" rules={[{ required: true }]}><Select>{PRIORITY_OPTIONS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="type" label="نوع پروژه"><Select>{['عمرانی', 'IT', 'تحقیقاتی', 'سازمانی', 'سایر'].map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="method" label="روش اجرا"><Select>{['آبشاری', 'چابک', 'ترکیبی'].map(m => <Select.Option key={m} value={m}>{m}</Select.Option>)}</Select></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="startDate" label="تاریخ شروع" rules={[{ required: true }]}><Input placeholder="۱۴۰۳/۰۱/۰۱" /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="endDate" label="تاریخ پایان" rules={[{ required: true }]}><Input placeholder="۱۴۰۳/۱۲/۲۹" /></Form.Item></Col>
                  <Col span={24}><Form.Item name="progress" label="درصد پیشرفت"><Slider marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }} /></Form.Item></Col>
                  <Col span={24}><Form.Item name="description" label="توضیحات"><Input.TextArea rows={3} /></Form.Item></Col>
                </Row>
              )
            },
            {
              key: '2', label: 'مالی',
              children: (
                <Row gutter={16}>
                  <Col xs={24} md={12}><Form.Item name="budget" label="بودجه مصوب (ریال)"><Input type="number" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="actualCost" label="هزینه واقعی (ریال)"><Input type="number" /></Form.Item></Col>
                </Row>
              )
            },
          ]} />
        </Form>
      </Modal>

      <Modal title="تأیید حذف" open={!!deleteModal} onOk={() => { if (deleteModal) { setProjects(prev => prev.filter(p => p.id !== deleteModal.id)); setDeleteModal(null) } }} onCancel={() => setDeleteModal(null)} okText="حذف" cancelText="انصراف" okButtonProps={{ danger: true }}>
        <p>آیا از حذف پروژه <strong>{deleteModal?.name}</strong> اطمینان دارید؟</p>
      </Modal>
    </div>
  )
}