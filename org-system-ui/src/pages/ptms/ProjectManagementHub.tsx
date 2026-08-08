import { useMemo, useState, type ReactNode } from 'react'
import { Button, Card, Col, Descriptions, Form, Input, Modal, Progress, Row, Select, Space, Table, Tabs, Tag, Timeline } from 'antd'
import { AppstoreOutlined, FileTextOutlined, PlusOutlined, ProjectOutlined, TeamOutlined } from '@ant-design/icons'
import ProjectContextHeader from './ProjectContextHeader'
import { SAMPLE_PROJECTS, SAMPLE_TASKS, USERS } from './ptmsData'

const controlSeed = [
  { id: '1', type: 'ریسک', title: 'تأخیر تأمین زیرساخت', owner: 'علی محمدی', status: 'نیازمند اقدام' },
  { id: '2', type: 'مسئله و مانع', title: 'محدودیت دسترسی سرویس', owner: 'مریم احمدی', status: 'در حال بررسی' },
  { id: '3', type: 'تصمیم', title: 'استفاده از معماری ماژولار', owner: 'مدیر سیستم', status: 'تصویب شد' },
  { id: '4', type: 'تغییر محدوده', title: 'افزودن گزارش مدیریتی', owner: 'مدیر سیستم', status: 'منتظر تأیید' },
]

interface Props {
  projectId: string
  onProjectChange: (value: string) => void
  statusContent: ReactNode
}

export default function ProjectManagementHub({ projectId, onProjectChange, statusContent }: Props) {
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [controlOpen, setControlOpen] = useState(false)
  const [controls, setControls] = useState(controlSeed)
  const [projectForm] = Form.useForm()
  const [controlForm] = Form.useForm()
  const project = SAMPLE_PROJECTS.find(p => p.id === projectId) || SAMPLE_PROJECTS[0]
  const tasks = useMemo(() => SAMPLE_TASKS.filter(t => t.projectId === projectId), [projectId])

  const saveProject = async () => {
    await projectForm.validateFields()
    setNewProjectOpen(false)
    projectForm.resetFields()
  }
  const saveControl = async () => {
    const values = await controlForm.validateFields()
    setControls(prev => [{ id: String(Date.now()), status: 'ثبت شده', ...values }, ...prev])
    setControlOpen(false)
    controlForm.resetFields()
  }

  const ganttColumns = [
    { title: 'فعالیت', dataIndex: 'title', width: 260 },
    { title: 'مسئول', dataIndex: 'assignee', width: 140 },
    { title: 'شروع', dataIndex: 'startDate', width: 120 },
    { title: 'پایان', dataIndex: 'deadline', width: 120 },
    { title: 'مدت', dataIndex: 'estimatedHours', width: 100, render: (v: number) => `${v} ساعت` },
    { title: 'وابستگی', key: 'dependency', width: 150, render: (_: unknown, __: unknown, index: number) => index ? tasks[index - 1]?.code : '—' },
    { title: 'نمودار گانت', key: 'gantt', width: 320, render: (_: unknown, r: typeof tasks[number]) => <div style={{ minWidth: 260, background: '#f5f5f5', height: 18, borderRadius: 9, overflow: 'hidden' }}><div style={{ width: `${Math.max(r.progress, 12)}%`, height: '100%', background: '#8B1A6B', color: 'white', fontSize: 10, textAlign: 'center' }}>{r.progress}٪</div></div> },
  ]

  const executionViews = <Tabs type="card" items={[
    {
      key: 'kanban', label: 'کانبان', children: <Table size="middle" rowKey="id" pagination={false} scroll={{ x: 1100 }} dataSource={tasks} columns={[
        { title: 'کد', dataIndex: 'code', width: 100 }, { title: 'کارت وظیفه', dataIndex: 'title', width: 300 }, { title: 'ستون کانبان', dataIndex: 'status', width: 160, render: (v: string) => <Tag color="purple">{v}</Tag> },
        { title: 'مسئول', dataIndex: 'assignee', width: 150 }, { title: 'اولویت', dataIndex: 'priority', width: 110, render: (v: string) => <Tag>{v}</Tag> }, { title: 'سررسید', dataIndex: 'deadline', width: 130 }, { title: 'پیشرفت', dataIndex: 'progress', width: 190, render: (v: number) => <Progress percent={v} size="small" strokeColor="#8B1A6B" /> },
      ]} />
    },
    {
      key: 'scrum', label: 'اسکرام', children: <Table size="middle" rowKey="id" pagination={false} scroll={{ x: 1150 }} dataSource={tasks} columns={[
        { title: 'آیتم بک‌لاگ', dataIndex: 'title', width: 300 }, { title: 'اسپرینت', key: 'sprint', width: 140, render: (_: unknown, __: unknown, i: number) => `اسپرینت ${Math.floor(i / 3) + 1}` },
        { title: 'امتیاز داستان', dataIndex: 'estimatedHours', width: 130, render: (v: number) => Math.max(1, Math.round(v / 8)) }, { title: 'مسئول', dataIndex: 'assignee', width: 150 },
        { title: 'وضعیت', dataIndex: 'status', width: 150, render: (v: string) => <Tag color="blue">{v}</Tag> }, { title: 'برچسب‌ها', dataIndex: 'tags', width: 220, render: (v: string[]) => v.map(x => <Tag key={x}>{x}</Tag>) },
      ]} />
    },
    { key: 'gantt', label: 'گانت', children: <Table size="middle" rowKey="id" pagination={false} scroll={{ x: 1250 }} dataSource={tasks} columns={ganttColumns} /> },
  ]} />

  return (
    <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
      <ProjectContextHeader title="مدیریت پروژه‌ها" projectId={projectId} onProjectChange={onProjectChange} onAdd={() => setNewProjectOpen(true)} addLabel="پروژه جدید" />
      <Tabs destroyOnHidden style={{ marginTop: 12 }} items={[
        { key: 'status', label: <span><ProjectOutlined /> داشبورد وضعیت</span>, children: statusContent },
        { key: 'views', label: <span><AppstoreOutlined /> نماهای اجرا</span>, children: executionViews },
        {
          key: 'charter', label: <span><FileTextOutlined /> منشور پروژه</span>, children: <Row gutter={[12, 12]}>
            <Col xs={24} xl={10}><Card size="small" title="منشور و اطلاعات پایه"><Descriptions column={1} size="small" items={[
              { key: '1', label: 'هدف', children: project.description || 'یکپارچه‌سازی فرایندهای سازمان' }, { key: '2', label: 'حامی', children: project.sponsor }, { key: '3', label: 'مدیر پروژه', children: project.manager }, { key: '4', label: 'روش اجرا', children: project.method }, { key: '5', label: 'بازه پروژه', children: `${project.startDate} تا ${project.endDate}` },
            ]} /><Button block>ویرایش منشور</Button></Card></Col>
            <Col xs={24} xl={14}><Card size="small" title="برنامه، نقاط عطف و خط مبنا"><Timeline items={[
              { color: 'green', children: 'آغاز پروژه — ' + project.startDate }, { color: 'blue', children: 'تحلیل و طراحی — تکمیل شده' }, { color: 'orange', children: 'تحویل نسخه آزمایشی — ۷ روز انحراف' }, { color: 'gray', children: 'پایان برنامه‌ریزی‌شده — ' + project.endDate },
            ]} /><Descriptions column={2} size="small" items={[{ key: '1', label: 'خط مبنا', children: 'نسخه ۱.۲' }, { key: '2', label: 'تکرار', children: 'گزارش وضعیت ماهانه' }]} /><Space><Button>ثبت نقطه عطف</Button><Button>به‌روزرسانی خط مبنا</Button></Space></Card></Col>
          </Row>
        },
        {
          key: 'roles', label: <span><TeamOutlined /> نقش‌ها و فیلدهای سفارشی</span>, children: <>
            <Row gutter={[12, 12]}>
              <Col xs={24} lg={12}><Card size="small" title="اعضا و نقش‌های پروژه"><Space wrap>{project.team.map(m => <Tag icon={<TeamOutlined />} key={m.id}>{m.name} — {m.role}</Tag>)}</Space><Button block style={{ marginTop: 16 }}>مدیریت اعضا و نقش‌ها</Button></Card></Col>
              <Col xs={24} lg={12}><Card size="small" title="فیلدهای سفارشی"><Space wrap><Tag color="purple">کد قرارداد: CT-1403-12</Tag><Tag color="blue">مرکز هزینه: IT-01</Tag><Tag color="green">سطح محرمانگی: داخلی</Tag></Space><Button block style={{ marginTop: 16 }}>مدیریت فیلدهای سفارشی</Button></Card></Col>
            </Row>
            <Card size="small" title="ریسک‌ها، مسائل، تصمیمات و تغییرات محدوده" style={{ marginTop: 12 }} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setControlOpen(true)} style={{ background: '#8B1A6B' }}>ثبت مورد</Button>}>
              <Table size="middle" rowKey="id" pagination={false} dataSource={controls} columns={[
                { title: 'نوع', dataIndex: 'type', width: 150, render: (v: string) => <Tag color="magenta">{v}</Tag> }, { title: 'عنوان', dataIndex: 'title' }, { title: 'مسئول', dataIndex: 'owner', width: 150 }, { title: 'وضعیت', dataIndex: 'status', width: 140, render: (v: string) => <Tag>{v}</Tag> },
              ]} />
            </Card>
          </>
        },
      ]} />

      <Modal title="ثبت پروژه جدید" open={newProjectOpen} onCancel={() => setNewProjectOpen(false)} onOk={saveProject} okText="ایجاد پروژه" cancelText="انصراف" width={680}>
        <Form form={projectForm} layout="vertical"><Row gutter={12}><Col span={12}><Form.Item name="template" label="ایجاد از قالب" rules={[{ required: true }]}><Select options={['پروژه چابک نرم‌افزاری', 'پروژه عمرانی', 'پروژه تحقیقاتی', 'پروژه خالی'].map(x => ({ value: x, label: x }))} /></Form.Item></Col><Col span={12}><Form.Item name="name" label="نام پروژه" rules={[{ required: true }]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="manager" label="مدیر پروژه" rules={[{ required: true }]}><Select options={USERS.map(x => ({ value: x, label: x }))} /></Form.Item></Col><Col span={12}><Form.Item name="repeat" label="تکرار پروژه"><Select options={[{ value: 'none', label: 'بدون تکرار' }, { value: 'monthly', label: 'ماهانه' }, { value: 'quarterly', label: 'فصلی' }]} /></Form.Item></Col><Col span={24}><Form.Item name="description" label="هدف و محدوده اولیه"><Input.TextArea rows={3} /></Form.Item></Col></Row></Form>
      </Modal>
      <Modal title="ثبت مورد کنترلی" open={controlOpen} onCancel={() => setControlOpen(false)} onOk={saveControl} okText="ثبت" cancelText="انصراف"><Form form={controlForm} layout="vertical"><Form.Item name="type" label="نوع" rules={[{ required: true }]}><Select options={['ریسک', 'مسئله و مانع', 'تصمیم', 'تغییر محدوده', 'گزارش وضعیت دوره‌ای'].map(x => ({ value: x, label: x }))} /></Form.Item><Form.Item name="title" label="عنوان" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="owner" label="مسئول" rules={[{ required: true }]}><Select options={USERS.map(x => ({ value: x, label: x }))} /></Form.Item></Form></Modal>
    </Card>
  )
}
