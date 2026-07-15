import { useState } from 'react'
import PersianDatePicker from '../components/PersianDatePicker'
import { Card, Button, Tag, Space, Modal, Form, Input, Select, Row, Col, Tabs, Table, Progress, Avatar, Tooltip, Popconfirm, Badge } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined,
  ClockCircleOutlined, UserOutlined, FolderOutlined, ProjectOutlined
} from '@ant-design/icons'

interface Project {
  id: string
  name: string
  owner: string
  manager: string
  department: string
  priority: 'low' | 'medium' | 'high'
  status: 'notstarted' | 'inprogress' | 'done' | 'cancelled'
  startDate?: string
  endDate?: string
  goal?: string
  description?: string
  progress: number
}

interface Action {
  id: string
  projectId?: string
  title: string
  owner: string
  assignee: string
  approver: string
  department: string
  priority: 'low' | 'medium' | 'high'
  status: 'notstarted' | 'inprogress' | 'done'
  startDate?: string
  endDate?: string
  progress: number
}

const PRIORITY_CONFIG = {
  low: { label: 'کم', color: '#52c41a' },
  medium: { label: 'متوسط', color: '#fa8c16' },
  high: { label: 'زیاد', color: '#f5222d' },
}

const STATUS_CONFIG = {
  notstarted: { label: 'شروع نشده', color: 'default' },
  inprogress: { label: 'در حال اجرا', color: 'processing' },
  done: { label: 'خاتمه یافته', color: 'success' },
  cancelled: { label: 'لغو شده', color: 'error' },
}

const USERS = ['مدیر سیستم', 'علی محمدی', 'مریم احمدی', 'رضا کریمی']
const DEPARTMENTS = ['مدیریت', 'فناوری', 'مالی', 'فروش', 'اداری']

const INITIAL_PROJECTS: Project[] = [
  { id: '1', name: 'کارهای توسعه‌ای اپ TMS', owner: 'مدیر سیستم', manager: 'مدیر سیستم', department: 'اداری', priority: 'medium', status: 'inprogress', startDate: '۱۴۰۴/۰۶/۱۸', endDate: '۱۴۰۴/۰۶/۳۱', goal: 'توسعه اپ مدیریت وظایف TMS', progress: 45 },
  { id: '2', name: 'کارهای بانک تجارت', owner: 'مدیر سیستم', manager: 'مدیر سیستم', department: 'اداری', priority: 'medium', status: 'inprogress', startDate: '۱۴۰۴/۰۶/۱۸', endDate: '۱۴۰۴/۰۶/۳۱', goal: 'پیاده‌سازی سیستم بانکی', progress: 60 },
]

const INITIAL_ACTIONS: Action[] = [
  { id: '1', projectId: '1', title: 'تخصیص کار به چند کاربر', owner: 'مدیر سیستم', assignee: 'علی محمدی', approver: 'مدیر سیستم', department: 'اداری', priority: 'medium', status: 'inprogress', startDate: '۱۴۰۴/۰۳/۱۴', endDate: '۱۴۰۴/۰۳/۱۴', progress: 60 },
  { id: '2', projectId: '1', title: 'درست کردن لوگوی او OKR & PTMS', owner: 'مدیر سیستم', assignee: 'مریم احمدی', approver: 'مدیر سیستم', department: 'اداری', priority: 'medium', status: 'notstarted', progress: 0 },
  { id: '3', projectId: '1', title: 'تنظیم یادآوری‌ها', owner: 'مدیر سیستم', assignee: 'رضا کریمی', approver: 'مدیر سیستم', department: 'اداری', priority: 'medium', status: 'notstarted', progress: 0 },
  { id: '4', title: 'ساخت سایت انگلیسی', owner: 'مدیر سیستم', assignee: 'علی محمدی', approver: 'مدیر سیستم', department: 'اداری', priority: 'high', status: 'notstarted', progress: 0 },
  { id: '5', title: 'تماس درخصوص مشتریان EPPM', owner: 'مدیر سیستم', assignee: 'مریم احمدی', approver: 'مدیر سیستم', department: 'اداری', priority: 'medium', status: 'notstarted', progress: 0 },
  { id: '6', title: 'بررسی ساخت اپ موبایل IOS و Android', owner: 'مدیر سیستم', assignee: 'رضا کریمی', approver: 'مدیر سیستم', department: 'اداری', priority: 'high', status: 'notstarted', progress: 0 },
]

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS)
  const [actions, setActions] = useState<Action[]>(INITIAL_ACTIONS)
  const [projectModal, setProjectModal] = useState(false)
  const [actionModal, setActionModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [newItemModal, setNewItemModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [filterStatus, setFilterStatus] = useState('active')
  const [projectForm] = Form.useForm()
  const [actionForm] = Form.useForm()

  const openProjectModal = (project?: Project) => {
    if (project) { setEditingProject(project); projectForm.setFieldsValue(project) }
    else { setEditingProject(null); projectForm.resetFields() }
    setProjectModal(true)
  }

  const openActionModal = (action?: Action, projectId?: string) => {
    if (action) { setEditingAction(action); actionForm.setFieldsValue(action) }
    else {
      setEditingAction(null)
      actionForm.resetFields()
      if (projectId) actionForm.setFieldValue('projectId', projectId)
    }
    setActionModal(true)
  }

  const handleSaveProject = () => {
    projectForm.validateFields().then(values => {
      if (editingProject) {
        setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...values } : p))
      } else {
        setProjects(prev => [...prev, { id: Date.now().toString(), progress: 0, ...values }])
      }
      setProjectModal(false)
    })
  }

  const handleSaveAction = () => {
    actionForm.validateFields().then(values => {
      if (editingAction) {
        setActions(prev => prev.map(a => a.id === editingAction.id ? { ...a, ...values } : a))
      } else {
        setActions(prev => [...prev, { id: Date.now().toString(), progress: 0, ...values }])
      }
      setActionModal(false)
    })
  }

  const projectActions = (project: Project) => (
    <Space>
      <Tooltip title="جزئیات">
        <Button size="small" icon={<InfoCircleOutlined />} onClick={() => { setSelectedProject(project); setDetailModal(true) }} />
      </Tooltip>
      <Tooltip title="ویرایش">
        <Button size="small" icon={<EditOutlined />} onClick={() => openProjectModal(project)} />
      </Tooltip>
      <Popconfirm title="حذف شود؟" onConfirm={() => setProjects(prev => prev.filter(p => p.id !== project.id))}>
        <Button size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    </Space>
  )

  const actionColumns = (projectId?: string) => [
    { title: '#', key: 'index', width: 40, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: 'عنوان', dataIndex: 'title', key: 'title',
      render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].color}>{STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}</Tag> },
    { title: 'اهمیت', dataIndex: 'priority', key: 'priority',
      render: (p: string) => (
        <Tag style={{ background: PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].color, color: 'white', border: 'none' }}>
          {PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}
        </Tag>
      )
    },
    { title: 'توضیحات', dataIndex: 'description', key: 'description', 
  render: (d: string) => d ? <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d}</span> : '-' },
    { title: 'مسئول', dataIndex: 'assignee', key: 'assignee',
      render: (a: string) => a ? <Space><Avatar size={22} icon={<UserOutlined />} style={{ background: '#1677ff' }} />{a}</Space> : '-' },
    { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', width: 100,
      render: (p: number) => <Progress percent={p} size="small" /> },
    { title: 'عملیات', key: 'actions',
      render: (_: unknown, record: Action) => (
        <Space>
          <Tooltip title="تاریخچه"><Button size="small" icon={<ClockCircleOutlined />} /></Tooltip>
          <Tooltip title="ویرایش"><Button size="small" icon={<EditOutlined />} onClick={() => openActionModal(record)} /></Tooltip>
          <Popconfirm title="حذف شود؟" onConfirm={() => setActions(prev => prev.filter(a => a.id !== record.id))}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ]

  const filteredProjects = projects.filter(p =>
    filterStatus === 'active' ? p.status !== 'done' && p.status !== 'cancelled' : true
  )

  const standaloneActions = actions.filter(a => !a.projectId)

  return (
    <div>
      {/* هدر */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 180 }}>
              <Select.Option value="active">جاری و شروع نشده</Select.Option>
              <Select.Option value="all">همه</Select.Option>
              <Select.Option value="done">خاتمه یافته</Select.Option>
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewItemModal(true)}>
            تعریف مورد جدید
          </Button>
        </div>
      </Card>

      {/* پروژه‌ها */}
      <Card
        title={<Space><ProjectOutlined /><span>پروژه‌ها ({filteredProjects.length} مورد)</span></Space>}
        style={{ marginBottom: 12, borderRight: '4px solid #1677ff' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#8c8c8c', background: '#fafafa' }}>
              <th style={{ padding: '8px 12px', textAlign: 'right', width: 40 }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>عنوان</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', width: 120 }}>وضعیت</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', width: 100 }}>اهمیت</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', width: 120 }}>پیشرفت</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', width: 130 }}>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, i) => (
              <tr key={project.id} style={{ borderBottom: '1px solid #fafafa' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                <td style={{ padding: '12px', fontSize: 12, color: '#8c8c8c' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1677ff', display: 'inline-block', marginLeft: 6 }} />
                  {i + 1}
                </td>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 500 }}>{project.name}</div>
                  {project.goal && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{project.goal}</div>}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <Tag color={STATUS_CONFIG[project.status].color}>{STATUS_CONFIG[project.status].label}</Tag>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <Tag style={{ background: PRIORITY_CONFIG[project.priority].color, color: 'white', border: 'none' }}>
                    {PRIORITY_CONFIG[project.priority].label}
                  </Tag>
                </td>
                <td style={{ padding: '12px' }}>
                  <Progress percent={project.progress} size="small" />
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  {projectActions(project)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* اقدامات مستقل */}
      <Card
        title={<Space><FolderOutlined /><span>اقدامات ({standaloneActions.length} مورد)</span></Space>}
        style={{ borderRight: '4px solid #52c41a' }}
        extra={<Button size="small" icon={<PlusOutlined />} onClick={() => openActionModal()}>اقدام جدید</Button>}
      >
        <Table
          columns={actionColumns()}
          dataSource={standaloneActions}
          rowKey="id"
          size="small"
        />
      </Card>

      {/* Modal انتخاب نوع */}
      <Modal title="تعریف مورد جدید" open={newItemModal} onCancel={() => setNewItemModal(false)} footer={null} width={400}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ marginBottom: 24, color: '#8c8c8c' }}>قصد تعریف کدام مورد را دارید؟</p>
          <Space size={32}>
            <div style={{ cursor: 'pointer', textAlign: 'center' }}
              onClick={() => { setNewItemModal(false); openProjectModal() }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 28 }}>
                <FolderOutlined style={{ color: '#1677ff' }} />
              </div>
              <span style={{ fontWeight: 500 }}>پروژه</span>
            </div>
            <div style={{ cursor: 'pointer', textAlign: 'center' }}
              onClick={() => { setNewItemModal(false); openActionModal() }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 28 }}>
                <PlusOutlined style={{ color: '#52c41a', fontSize: 28 }} />
              </div>
              <span style={{ fontWeight: 500 }}>اقدام</span>
            </div>
          </Space>
        </div>
      </Modal>

      {/* Modal پروژه با تب */}
      <Modal
        title={editingProject ? `ویرایش پروژه: ${editingProject.name}` : 'تعریف پروژه جدید'}
        open={projectModal}
        onCancel={() => setProjectModal(false)}
        footer={null}
        width={700}
      >
        <Form form={projectForm} layout="vertical" onFinish={handleSaveProject}>
          <Tabs items={[
            {
              key: '1',
              label: 'اطلاعات اصلی پروژه',
              children: (
                <div>
                  <h4 style={{ marginBottom: 16 }}>مشخصات کلی پروژه</h4>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="name" label="نام پروژه" rules={[{ required: true }]}><Input /></Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="owner" label="مالک" initialValue="مدیر سیستم">
                        <Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="manager" label="مدیر پروژه" initialValue="مدیر سیستم">
                        <Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="department" label="بخش" initialValue="اداری">
                        <Select>{DEPARTMENTS.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}</Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="priority" label="درجه اهمیت" initialValue="medium">
                        <Select>
                          <Select.Option value="low">کم</Select.Option>
                          <Select.Option value="medium">متوسط</Select.Option>
                          <Select.Option value="high">زیاد</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="status" label="وضعیت پروژه" initialValue="notstarted">
                        <Select>
                          <Select.Option value="notstarted">شروع نشده</Select.Option>
                          <Select.Option value="inprogress">در حال اجرا</Select.Option>
                          <Select.Option value="done">خاتمه یافته</Select.Option>
                          <Select.Option value="cancelled">لغو شده</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  <Col xs={24} md={12}>
                  <Form.Item name="startDate" label="تاریخ شروع">
                  <PersianDatePicker placeholder="انتخاب تاریخ شروع" onChange={(date) => projectForm.setFieldValue('startDate', date)} value={projectForm.getFieldValue('startDate')} />
                 </Form.Item>
                    </Col>
                  <Col xs={24} md={12}>
                   <Form.Item name="endDate" label="تاریخ پایان">
                   <PersianDatePicker placeholder="انتخاب تاریخ پایان" onChange={(date) => projectForm.setFieldValue('endDate', date)} value={projectForm.getFieldValue('endDate')} />
                </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="goal" label="هدف پروژه"><Input.TextArea rows={3} /></Form.Item>
                    </Col>
                  </Row>
                </div>
              )
            },
            {
              key: '2',
              label: 'فعالیت‌های پروژه',
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4 style={{ margin: 0 }}>لیست فعالیت‌ها</h4>
                    <Button size="small" type="primary" icon={<PlusOutlined />}
                      onClick={() => { setProjectModal(false); openActionModal(undefined, editingProject?.id) }}>
                      فعالیت جدید
                    </Button>
                  </div>
                  <Table
                    columns={actionColumns(editingProject?.id)}
                    dataSource={actions.filter(a => a.projectId === editingProject?.id)}
                    rowKey="id"
                    size="small"
                  />
                </div>
              )
            }
          ]} />
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setProjectModal(false)}>انصراف</Button>
              <Button type="primary" htmlType="submit">ذخیره اطلاعات</Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Modal جزئیات پروژه */}
      <Modal title="جزئیات پروژه" open={detailModal} onCancel={() => setDetailModal(false)} footer={[
        <Button key="close" onClick={() => setDetailModal(false)}>بستن</Button>
      ]} width={500}>
        {selectedProject && (
          <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
            <Col span={12}><strong>عنوان:</strong><br />{selectedProject.name}</Col>
            <Col span={12}><strong>مالک:</strong><br />{selectedProject.owner}</Col>
            <Col span={12}><strong>مدیر پروژه:</strong><br />{selectedProject.manager}</Col>
            <Col span={12}><strong>وضعیت:</strong><br /><Tag color={STATUS_CONFIG[selectedProject.status].color}>{STATUS_CONFIG[selectedProject.status].label}</Tag></Col>
            <Col span={12}><strong>بخش:</strong><br />{selectedProject.department}</Col>
            <Col span={12}><strong>درجه اهمیت:</strong><br />
              <Tag style={{ background: PRIORITY_CONFIG[selectedProject.priority].color, color: 'white', border: 'none' }}>
                {PRIORITY_CONFIG[selectedProject.priority].label}
              </Tag>
            </Col>
            <Col span={12}><strong>تاریخ شروع:</strong><br />{selectedProject.startDate || '-'}</Col>
            <Col span={12}><strong>تاریخ پایان:</strong><br />{selectedProject.endDate || '-'}</Col>
            {selectedProject.goal && <Col span={24}><strong>هدف پروژه:</strong><br />{selectedProject.goal}</Col>}
            <Col span={24}><strong>پیشرفت:</strong><br /><Progress percent={selectedProject.progress} /></Col>
          </Row>
        )}
      </Modal>

      {/* Modal اقدام */}
      <Modal
        title={editingAction ? 'ویرایش اقدام' : 'تعریف اقدام جدید'}
        open={actionModal}
        onCancel={() => setActionModal(false)}
        footer={null}
        width={600}
      >
        <Form form={actionForm} layout="vertical" onFinish={handleSaveAction}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="title" label="عنوان اقدام" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="owner" label="مالک" initialValue="مدیر سیستم">
                <Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
           <Col xs={24} md={12}>
          <Form.Item name="startDate" label="تاریخ شروع">
               <PersianDatePicker placeholder="انتخاب تاریخ" onChange={(date) => actionForm.setFieldValue('startDate', date)} value={actionForm.getFieldValue('startDate')} />
               </Form.Item>
                  </Col>
                <Col xs={24} md={12}>
                <Form.Item name="endDate" label="تاریخ پایان">
                 <PersianDatePicker placeholder="انتخاب تاریخ" onChange={(date) => actionForm.setFieldValue('endDate', date)} value={actionForm.getFieldValue('endDate')} />
                   </Form.Item>
                  </Col>
            <Col xs={24} md={12}>
              <Form.Item name="assignee" label="مسئول انجام" initialValue="مدیر سیستم">
                <Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="approver" label="تأیید کننده" initialValue="مدیر سیستم">
                <Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="priority" label="درجه اهمیت" initialValue="medium">
                <Select>
                  <Select.Option value="low">کم</Select.Option>
                  <Select.Option value="medium">متوسط</Select.Option>
                  <Select.Option value="high">زیاد</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="department" label="بخش" initialValue="اداری">
                <Select>{DEPARTMENTS.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="وضعیت" initialValue="notstarted">
                <Select>
                  <Select.Option value="notstarted">شروع نشده</Select.Option>
                  <Select.Option value="inprogress">در حال اجرا</Select.Option>
                  <Select.Option value="done">خاتمه یافته</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
  <Form.Item name="description" label="توضیحات">
    <Input.TextArea rows={3} placeholder="توضیحات اقدام..." />
  </Form.Item>
</Col>
            <Col xs={24} md={12}>
              <Form.Item name="projectId" label="پروژه (اختیاری)">
                <Select allowClear placeholder="بدون پروژه">
                  {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Space>
              <Button onClick={() => setActionModal(false)}>انصراف</Button>
              <Button type="primary" htmlType="submit">ذخیره اطلاعات</Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  )
}