import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Progress, Row, Select, Slider, Space, Statistic, Switch, Table, Tag, TimePicker, Tooltip } from 'antd'
import { BellOutlined, ClockCircleOutlined, HistoryOutlined, SaveOutlined, TeamOutlined } from '@ant-design/icons'
import ProjectContextHeader from './ProjectContextHeader'
import { SAMPLE_PROJECTS, SAMPLE_TASKS, USERS } from './ptmsData'

const capacities = [
  { id: '1', name: 'مدیر سیستم', role: 'مدیر پروژه', capacity: 40, assigned: 34, leave: false },
  { id: '2', name: 'علی محمدی', role: 'تحلیلگر', capacity: 40, assigned: 47, leave: false },
  { id: '3', name: 'مریم احمدی', role: 'طراح UI', capacity: 32, assigned: 18, leave: true },
  { id: '4', name: 'رضا کریمی', role: 'توسعه‌دهنده', capacity: 40, assigned: 22, leave: false },
]

const slaRows = [
  { id: '1', type: 'بحرانی', first: '۱ ساعت', resolve: '۴ ساعت', remaining: '۰۰:۴۸', status: 'نزدیک نقض', compliance: 82 },
  { id: '2', type: 'بالا', first: '۴ ساعت', resolve: '۱ روز', remaining: '۰۶:۲۰', status: 'در محدوده', compliance: 94 },
  { id: '3', type: 'عادی', first: '۱ روز', resolve: '۳ روز', remaining: '۲ روز', status: 'متوقف در انتظار', compliance: 98 },
]

export default function TaskManagementHub() {
  const [projectId, setProjectId] = useState(SAMPLE_PROJECTS[0].id)
  const [member, setMember] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [draftSaved, setDraftSaved] = useState(() => Boolean(localStorage.getItem('ptms-task-draft')))
  const [form] = Form.useForm()
  const project = SAMPLE_PROJECTS.find(p => p.id === projectId) || SAMPLE_PROJECTS[0]
  const projectMembers = useMemo(() => project.team.map(m => m.name), [project])

  useEffect(() => {
    const draft = localStorage.getItem('ptms-task-draft')
    if (draft) {
      try { form.setFieldsValue(JSON.parse(draft)) } catch { /* پیش‌نویس نامعتبر نادیده گرفته می‌شود */ }
    }
  }, [form])

  const saveDraft = () => {
    localStorage.setItem('ptms-task-draft', JSON.stringify(form.getFieldsValue(true)))
    setDraftSaved(true)
  }
  const createTask = async () => {
    await form.validateFields()
    localStorage.removeItem('ptms-task-draft')
    setDraftSaved(false)
    setModalOpen(false)
    form.resetFields()
  }

  return (
    <Card style={{ borderRadius: 12, marginBottom: 12 }} styles={{ body: { padding: 16 } }}>
      <ProjectContextHeader title="مدیریت وظایف" projectId={projectId} onProjectChange={setProjectId} member={member} onMemberChange={setMember} onAdd={() => setModalOpen(true)} addLabel="وظیفه جدید" />
      <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="وظایف پروژه" value={SAMPLE_TASKS.filter(t => t.projectId === projectId).length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="مسدود" value={2} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="نزدیک نقض SLA" value={1} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="بار تیم" value={76} suffix="٪" valueStyle={{ color: '#8B1A6B' }} /></Card></Col>
      </Row>
      <Space wrap style={{ marginTop: 12 }}>
        <Button>عملیات گروهی</Button><Button>زمان‌بندی مجدد گروهی</Button><Button>بازیابی وظیفه حذف‌شده</Button>
        <Tooltip title="N: وظیفه جدید، /: جستجو، Ctrl+S: ذخیره پیش‌نویس"><Button>میانبرهای صفحه‌کلید</Button></Tooltip>
        <Tag color="blue">ویرایش درجا فعال</Tag><Tag color="purple">کشیدن و رهاکردن در نمای بورد</Tag>
      </Space>
      <div style={{ marginTop: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} xl={14}>
            <Card size="small" title={<span><TeamOutlined /> ظرفیت و حجم کار تیم</span>}>
              <Table size="small" rowKey="id" pagination={false} dataSource={capacities} columns={[
                { title: 'عضو', dataIndex: 'name' }, { title: 'نقش/مهارت', dataIndex: 'role' },
                { title: 'ظرفیت هفتگی', dataIndex: 'capacity', render: (v: number) => `${v} ساعت` },
                { title: 'بار تخصیص', key: 'load', render: (_: unknown, r: typeof capacities[number]) => <Progress percent={Math.round(r.assigned / r.capacity * 100)} size="small" status={r.assigned > r.capacity ? 'exception' : 'normal'} /> },
                { title: 'دسترسی', key: 'availability', render: (_: unknown, r: typeof capacities[number]) => r.leave ? <Tag color="orange">در مرخصی</Tag> : r.assigned > r.capacity ? <Tag color="red">اضافه‌بار</Tag> : r.assigned < r.capacity * .65 ? <Tag color="green">آزاد</Tag> : <Tag color="blue">متعادل</Tag> },
                { title: 'پیشنهاد', key: 'suggestion', render: (_: unknown, r: typeof capacities[number]) => r.assigned > r.capacity ? <Button size="small">تغییر مسئول</Button> : r.leave ? <Button size="small">جابه‌جایی تاریخ</Button> : '—' },
              ]} scroll={{ x: 760 }} />
              <Alert style={{ marginTop: 12 }} type="info" showIcon message="تقویم ظرفیت تیم" description="ظرفیت بر اساس نقش و مهارت، تعطیلات و مرخصی اعضا در پیشنهاد زمان و مسئول لحاظ می‌شود." />
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card size="small" title={<span><ClockCircleOutlined /> کنترل SLA</span>}>
              <Table size="small" rowKey="id" pagination={false} dataSource={slaRows} columns={[
                { title: 'نوع کار', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> }, { title: 'پاسخ', dataIndex: 'first' }, { title: 'حل', dataIndex: 'resolve' },
                { title: 'شمارش', dataIndex: 'remaining', render: (v: string, r: typeof slaRows[number]) => <Badge status={r.status === 'نزدیک نقض' ? 'warning' : r.status.includes('متوقف') ? 'default' : 'success'} text={v} /> },
              ]} />
              <Space wrap style={{ marginTop: 12 }}><Button icon={<BellOutlined />}>هشدار نقض</Button><Button>تقویم کاری SLA</Button><Button>گزارش تیم/پروژه</Button></Space>
            </Card>
          </Col>
        </Row>
      </div>

      <Modal title="ثبت وظیفه جدید" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={createTask} okText="ثبت وظیفه" cancelText="انصراف" width={920} footer={(_, { OkBtn, CancelBtn }) => <><CancelBtn /><Button icon={<SaveOutlined />} onClick={saveDraft}>ذخیره پیش‌نویس</Button><OkBtn /></>}>
        {draftSaved && <Alert closable style={{ marginBottom: 12 }} type="success" showIcon message="پیش‌نویس خودکار قابل بازیابی است" />}
        <Form form={form} layout="vertical" initialValues={{ projectId, priority: 'متوسط', status: 'جدید', recurring: false, sla: 'عادی' }} onValuesChange={(_, all) => { localStorage.setItem('ptms-task-draft', JSON.stringify(all)); setDraftSaved(true) }}>
          <Row gutter={12}>
            <Col xs={24} md={16}><Form.Item name="title" label="عنوان وظیفه" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="projectId" label="پروژه"><Select options={SAMPLE_PROJECTS.map(p => ({ value: p.id, label: p.name }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="assignee" label="مسئول اصلی" rules={[{ required: true }]}><Select options={projectMembers.map(x => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="collaborators" label="همکاران وظیفه"><Select mode="multiple" options={USERS.map(x => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="approver" label="تأییدکننده"><Select options={USERS.map(x => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="startDate" label="تاریخ شروع"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="deadline" label="تاریخ سررسید"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="deadlineTime" label="ساعت دقیق"><TimePicker style={{ width: '100%' }} format="HH:mm" /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="priority" label="اولویت"><Select options={['بحرانی', 'بالا', 'متوسط', 'پایین'].map(x => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="status" label="وضعیت سفارشی"><Select options={['جدید', 'در حال انجام', 'در انتظار', 'مسدود', 'تکمیل شده'].map(x => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="tags" label="برچسب‌ها"><Select mode="tags" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="estimate" label="برآورد زمان (ساعت)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="spent" label="زمان صرف‌شده"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="parent" label="وظیفه والد / زیروظیفه"><Select allowClear options={SAMPLE_TASKS.map(t => ({ value: t.id, label: t.title }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="dependency" label="وابستگی میان وظایف"><Select mode="multiple" options={SAMPLE_TASKS.map(t => ({ value: t.id, label: t.title }))} /></Form.Item></Col>
            <Col span={24}><Form.Item name="checklist" label="چک‌لیست داخلی"><Select mode="tags" placeholder="هر مورد را تایپ و Enter کنید" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="blocked" label="وظیفه مسدود است؟" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="stopReason" label="دلیل توقف اجباری"><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="recurring" label="وظیفه تکرارشونده" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="sla" label="SLA نوع کار"><Select options={['بحرانی', 'بالا', 'عادی'].map(x => ({ value: x, label: x }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item label="شدت تلاش"><Slider marks={{ 0: 'کم', 50: 'متوسط', 100: 'زیاد' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="شرح، نظر و اشاره به کاربران"><Input.TextArea rows={3} placeholder="برای اشاره از @ استفاده کنید" /></Form.Item></Col>
          </Row>
          <Space wrap><Button>پیوست فایل</Button><Button icon={<HistoryOutlined />}>تاریخچه کامل تغییرات</Button><Checkbox>تشدید خودکار به مدیر هنگام نقض</Checkbox><Checkbox>تغییر مسئول هنگام نقض</Checkbox></Space>
        </Form>
      </Modal>
    </Card>
  )
}
