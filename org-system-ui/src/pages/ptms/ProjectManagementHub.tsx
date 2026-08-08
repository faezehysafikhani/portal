import { useMemo, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Progress, Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline } from 'antd'
import { AppstoreOutlined, CalendarOutlined, ClockCircleOutlined, FileTextOutlined, PlusOutlined, ProjectOutlined, ReloadOutlined, SafetyCertificateOutlined, TeamOutlined, UnorderedListOutlined } from '@ant-design/icons'
import ProjectContextHeader from './ProjectContextHeader'
import { SAMPLE_PROJECTS, SAMPLE_TASKS, USERS } from './ptmsData'

const governanceSeed = [
  { id: '1', type: 'ریسک', title: 'تأخیر تأمین زیرساخت', owner: 'علی محمدی', status: 'نیازمند اقدام' },
  { id: '2', type: 'مسئله و مانع', title: 'محدودیت دسترسی سرویس', owner: 'مریم احمدی', status: 'در حال بررسی' },
  { id: '3', type: 'تصمیم', title: 'استفاده از معماری ماژولار', owner: 'مدیر سیستم', status: 'تصویب شد' },
  { id: '4', type: 'تغییر محدوده', title: 'افزودن گزارش مدیریتی', owner: 'مدیر سیستم', status: 'منتظر تأیید' },
]

export default function ProjectManagementHub() {
  const [projectId, setProjectId] = useState(SAMPLE_PROJECTS[0].id)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [governanceOpen, setGovernanceOpen] = useState(false)
  const [archived, setArchived] = useState<string[]>([])
  const [governance, setGovernance] = useState(governanceSeed)
  const [projectForm] = Form.useForm()
  const [governanceForm] = Form.useForm()
  const project = SAMPLE_PROJECTS.find(p => p.id === projectId) || SAMPLE_PROJECTS[0]
  const projectTasks = useMemo(() => SAMPLE_TASKS.filter(t => t.projectId === projectId), [projectId])

  const saveProject = async () => {
    await projectForm.validateFields()
    setNewProjectOpen(false)
    projectForm.resetFields()
  }
  const saveGovernance = async () => {
    const values = await governanceForm.validateFields()
    setGovernance(prev => [{ id: String(Date.now()), status: 'ثبت شده', ...values }, ...prev])
    setGovernanceOpen(false)
    governanceForm.resetFields()
  }

  const projectColumns = [
    { title: 'کد', dataIndex: 'code', width: 100 },
    { title: 'نام پروژه', dataIndex: 'name' },
    { title: 'مدیر', dataIndex: 'manager', width: 130 },
    { title: 'روش', dataIndex: 'method', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'پیشرفت', dataIndex: 'progress', width: 180, render: (v: number) => <Progress percent={v} size="small" strokeColor="#8B1A6B" /> },
    { title: 'وضعیت', dataIndex: 'status', width: 120, render: (v: string, r: { id: string }) => <Tag color={archived.includes(r.id) ? 'default' : 'blue'}>{archived.includes(r.id) ? 'آرشیو شده' : v}</Tag> },
    { title: 'عملیات', key: 'actions', width: 130, render: (_: unknown, r: { id: string }) => <Button size="small" icon={archived.includes(r.id) ? <ReloadOutlined /> : undefined} onClick={() => setArchived(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}>{archived.includes(r.id) ? 'بازیابی' : 'آرشیو'}</Button> },
  ]

  const taskColumns = [
    { title: 'وظیفه', dataIndex: 'title' },
    { title: 'مسئول', dataIndex: 'assignee', width: 130 },
    { title: 'سررسید', dataIndex: 'deadline', width: 120 },
    { title: 'وضعیت', dataIndex: 'status', width: 130, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: 'پیشرفت', dataIndex: 'progress', width: 150, render: (v: number) => <Progress percent={v} size="small" /> },
  ]

  return (
    <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
      <ProjectContextHeader title="مدیریت پروژه‌ها" projectId={projectId} onProjectChange={setProjectId} onAdd={() => setNewProjectOpen(true)} addLabel="پروژه جدید" />
      <Tabs style={{ marginTop: 12 }} items={[
        {
          key: 'status', label: <span><ProjectOutlined /> داشبورد وضعیت</span>, children: <>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}><Card size="small"><Statistic title="پیشرفت واقعی" value={project.progress} suffix="٪" valueStyle={{ color: '#8B1A6B' }} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="وظایف پروژه" value={project.taskCount} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="نقاط عطف باز" value={3} /></Card></Col>
              <Col xs={12} md={6}><Card size="small"><Statistic title="انحراف از خط مبنا" value={7} suffix="روز" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
            </Row>
            <Alert style={{ marginTop: 12 }} showIcon type="warning" message="گزارش وضعیت دوره‌ای" description="پیشرفت واقعی ۵٪ کمتر از برنامه است؛ بازبینی نقطه عطف «تحویل نسخه آزمایشی» پیشنهاد می‌شود." action={<Button size="small">ثبت گزارش جدید</Button>} />
          </>
        },
        { key: 'projects', label: <span><UnorderedListOutlined /> فهرست پروژه‌ها</span>, children: <Table size="small" rowKey="id" pagination={false} dataSource={SAMPLE_PROJECTS} columns={projectColumns} scroll={{ x: 850 }} /> },
        {
          key: 'views', label: <span><AppstoreOutlined /> نماهای اجرا</span>, children: <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Button type="primary" icon={<UnorderedListOutlined />}>نمای فهرستی وظایف</Button>
              <Button icon={<AppstoreOutlined />}>نمای بورد</Button><Button icon={<CalendarOutlined />}>نمای تقویم</Button><Button icon={<ClockCircleOutlined />}>نمای خط زمانی</Button>
            </Space>
            <Table size="small" rowKey="id" pagination={false} dataSource={projectTasks} columns={taskColumns} locale={{ emptyText: 'برای این پروژه وظیفه‌ای ثبت نشده است' }} />
            <Alert style={{ marginTop: 12 }} type="info" showIcon message="اتصال وظایف میان پروژه‌ها فعال است" description="وابستگی‌های میان‌پروژه‌ای در خط زمانی و خط مبنای برنامه کنترل می‌شوند." />
          </>
        },
        {
          key: 'plan', label: <span><ClockCircleOutlined /> برنامه و نقاط عطف</span>, children: <Row gutter={[12, 12]}>
            <Col xs={24} lg={14}><Card size="small" title="خط زمانی و خط مبنا"><Timeline items={[
              { color: 'green', children: 'آغاز پروژه — ' + project.startDate },
              { color: 'blue', children: 'تحلیل و طراحی — تکمیل شده' },
              { color: 'orange', children: 'تحویل نسخه آزمایشی — ۷ روز انحراف' },
              { color: 'gray', children: 'پایان برنامه‌ریزی‌شده — ' + project.endDate },
            ]} /></Card></Col>
            <Col xs={24} lg={10}><Card size="small" title="پروژه‌های تکرارشونده"><Descriptions column={1} size="small" items={[
              { key: '1', label: 'الگو', children: 'گزارش وضعیت ماهانه' }, { key: '2', label: 'تکرار', children: 'اول هر ماه' }, { key: '3', label: 'نسخه بعد', children: '۱۴۰۳/۰۵/۰۱' },
            ]} /><Button block>تنظیم برنامه تکرار</Button></Card></Col>
          </Row>
        },
        {
          key: 'charter', label: <span><FileTextOutlined /> منشور و تنظیمات</span>, children: <Row gutter={[12, 12]}>
            <Col xs={24} lg={12}><Card size="small" title="منشور و اطلاعات پایه"><Descriptions column={1} size="small" items={[
              { key: '1', label: 'هدف', children: project.description || 'یکپارچه‌سازی فرایندهای سازمان' }, { key: '2', label: 'حامی', children: project.sponsor }, { key: '3', label: 'مدیر پروژه', children: project.manager }, { key: '4', label: 'روش اجرا', children: project.method },
            ]} /><Button block>ویرایش منشور</Button></Card></Col>
            <Col xs={24} lg={12}><Card size="small" title="اعضا، نقش‌ها و فیلدهای سفارشی"><Space wrap>{project.team.map(m => <Tag icon={<TeamOutlined />} key={m.id}>{m.name} — {m.role}</Tag>)}</Space><div style={{ marginTop: 16 }}><Tag color="purple">کد قرارداد: CT-1403-12</Tag><Tag color="blue">مرکز هزینه: IT-01</Tag></div><Button block style={{ marginTop: 16 }}>مدیریت اعضا و فیلدها</Button></Card></Col>
          </Row>
        },
        {
          key: 'governance', label: <span><SafetyCertificateOutlined /> کنترل و حاکمیت</span>, children: <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><Button type="primary" icon={<PlusOutlined />} onClick={() => setGovernanceOpen(true)} style={{ background: '#8B1A6B' }}>ثبت مورد</Button></div>
            <Table size="small" rowKey="id" pagination={false} dataSource={governance} columns={[
              { title: 'نوع', dataIndex: 'type', width: 140, render: (v: string) => <Tag color="magenta">{v}</Tag> }, { title: 'عنوان', dataIndex: 'title' }, { title: 'مسئول', dataIndex: 'owner', width: 130 }, { title: 'وضعیت', dataIndex: 'status', width: 130, render: (v: string) => <Tag>{v}</Tag> },
            ]} />
          </>
        },
      ]} />

      <Modal title="ثبت پروژه جدید" open={newProjectOpen} onCancel={() => setNewProjectOpen(false)} onOk={saveProject} okText="ایجاد پروژه" cancelText="انصراف" width={680}>
        <Form form={projectForm} layout="vertical"><Row gutter={12}>
          <Col span={12}><Form.Item name="template" label="ایجاد از قالب" rules={[{ required: true }]}><Select options={['پروژه چابک نرم‌افزاری', 'پروژه عمرانی', 'پروژه تحقیقاتی', 'پروژه خالی'].map(x => ({ value: x, label: x }))} /></Form.Item></Col>
          <Col span={12}><Form.Item name="name" label="نام پروژه" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="manager" label="مدیر پروژه" rules={[{ required: true }]}><Select options={USERS.map(x => ({ value: x, label: x }))} /></Form.Item></Col>
          <Col span={12}><Form.Item name="repeat" label="تکرار پروژه"><Select options={[{ value: 'none', label: 'بدون تکرار' }, { value: 'monthly', label: 'ماهانه' }, { value: 'quarterly', label: 'فصلی' }]} /></Form.Item></Col>
          <Col span={24}><Form.Item name="description" label="هدف و محدوده اولیه"><Input.TextArea rows={3} /></Form.Item></Col>
        </Row></Form>
      </Modal>
      <Modal title="ثبت مورد کنترلی" open={governanceOpen} onCancel={() => setGovernanceOpen(false)} onOk={saveGovernance} okText="ثبت" cancelText="انصراف">
        <Form form={governanceForm} layout="vertical"><Form.Item name="type" label="نوع" rules={[{ required: true }]}><Select options={['ریسک', 'مسئله و مانع', 'تصمیم', 'تغییر محدوده', 'گزارش وضعیت دوره‌ای'].map(x => ({ value: x, label: x }))} /></Form.Item><Form.Item name="title" label="عنوان" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="owner" label="مسئول" rules={[{ required: true }]}><Select options={USERS.map(x => ({ value: x, label: x }))} /></Form.Item></Form>
      </Modal>
    </Card>
  )
}
