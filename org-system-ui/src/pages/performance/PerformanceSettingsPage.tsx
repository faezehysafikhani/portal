import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, message, Popconfirm, Row, Select, Space, Table, Tabs, Tag } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { apiFetch } from '../../utils/api'
import { API, bandColor, bandLabel, monthNames } from './common'
import type { DirectoryUser, EvaluationRow } from './common'

const PRIMARY = '#8B1A6B'

function WeightsTab() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`${API}/performance/settings`)
      const result = await response.json().catch(() => ({}))
      if (response.ok) form.setFieldsValue(result)
    } finally { setLoading(false) }
  }, [form])
  useEffect(() => { void load() }, [load])

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ذخیره تنظیمات انجام نشد')
      message.success('تنظیمات ذخیره شد')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ذخیره تنظیمات انجام نشد')
    } finally { setSaving(false) }
  }

  return (
    <Card size="small" title="وزن فاکتورها و آستانه‌های امتیازی" loading={loading}>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={8}><Form.Item name="weightTaskCompletion" label="وزن تکمیل وظایف" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="weightQuality" label="وزن کیفیت" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="weightTimeliness" label="وزن به‌موقع‌بودن" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="weightManagerQualitative" label="وزن ارزیابی کیفی مدیر" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="weightReportingDiscipline" label="وزن نظم گزارش‌دهی" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="managerQualitativeCapPercent" label="سقف وزن ارزیابی کیفی مدیر" tooltip="وزن ارزیابی کیفی مدیر نمی‌تواند از این سقف بیشتر شود"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="selfAddedCapPercent" label="سقف سهم وظایف خودافزوده (٪)"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={4}><Form.Item name="bandExceptionalMin" label="آستانه فوق‌العاده"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={4}><Form.Item name="bandExcellentMin" label="آستانه عالی"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={4}><Form.Item name="bandGoodMin" label="آستانه خوب"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={24} md={4}><Form.Item name="bandNeedsImprovementMin" label="آستانه نیازمند بهبود"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        <Button type="primary" style={{ background: PRIMARY }} loading={saving} onClick={save}>ذخیره تنظیمات</Button>
      </Form>
    </Card>
  )
}

function ReviewersTab() {
  const [rows, setRows] = useState<any[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reviewersRes, dirRes] = await Promise.all([apiFetch(`${API}/performance/reviewers`), apiFetch(`${API}/directory`)])
      const reviewersResult = await reviewersRes.json().catch(() => [])
      if (reviewersRes.ok) setRows(reviewersResult)
      const dirResult = await dirRes.json().catch(() => ({ users: [] }))
      if (dirRes.ok) setUsers(dirResult.users || [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const submit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/reviewers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت نگاشت ارزیاب انجام نشد')
      message.success('نگاشت ثبت شد'); form.resetFields(); await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت نگاشت ارزیاب انجام نشد')
    } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    const response = await apiFetch(`${API}/performance/reviewers/${id}`, { method: 'DELETE' })
    if (response.ok) { message.success('حذف شد'); await load() } else message.error('حذف انجام نشد')
  }

  return (
    <Card size="small" title="نگاشت ارزیاب‌ها" loading={loading}>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="employeeUserId" label="کارمند" rules={[{ required: true }]}>
          <Select style={{ width: 220 }} showSearch optionFilterProp="label" options={users.map(u => ({ value: u.id, label: u.fullName }))} />
        </Form.Item>
        <Form.Item name="reviewerUserId" label="ارزیاب" rules={[{ required: true }]}>
          <Select style={{ width: 220 }} showSearch optionFilterProp="label" options={users.map(u => ({ value: u.id, label: u.fullName }))} />
        </Form.Item>
        <Form.Item><Button type="primary" style={{ background: PRIMARY }} loading={saving} onClick={submit}>ثبت</Button></Form.Item>
      </Form>
      <Table rowKey="id" size="small" dataSource={rows} pagination={{ pageSize: 10 }} columns={[
        { title: 'کارمند', dataIndex: 'employeeName' },
        { title: 'ارزیاب', dataIndex: 'reviewerName' },
        { title: 'عملیات', render: (_: unknown, r: any) => <Popconfirm title="حذف این نگاشت؟" onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> },
      ]} />
    </Card>
  )
}

function RewardsTab() {
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [userId, setUserId] = useState<string>()
  const [rows, setRows] = useState<EvaluationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const response = await apiFetch(`${API}/directory`)
      const result = await response.json().catch(() => ({ users: [] }))
      if (response.ok) setUsers(result.users || [])
    })()
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const response = await apiFetch(`${API}/performance/evaluations?userId=${userId}&status=finalized`)
      const result = await response.json().catch(() => [])
      if (response.ok) setRows(result)
    } finally { setLoading(false) }
  }, [userId])
  useEffect(() => { void load() }, [load])

  const setDecision = async (evaluationId: string, rewardDecision: string) => {
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/evaluations/${evaluationId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rewardDecision }) })
      if (!response.ok) throw new Error('ثبت تصمیم انجام نشد')
      message.success('تصمیم ثبت شد'); await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت تصمیم انجام نشد')
    } finally { setSaving(false) }
  }

  return (
    <Card size="small" title="پاداش و جریمه">
      <Select style={{ width: 260, marginBottom: 16 }} placeholder="انتخاب کارمند" showSearch optionFilterProp="label"
        options={users.map(u => ({ value: u.id, label: u.fullName }))} value={userId} onChange={setUserId} />
      <Table rowKey="id" size="small" loading={loading} dataSource={rows} pagination={{ pageSize: 8 }} columns={[
        { title: 'دوره', render: (_: unknown, r: EvaluationRow) => `${monthNames[r.periodMonth - 1]} ${r.periodYear}` },
        { title: 'امتیاز', dataIndex: 'finalScore' },
        { title: 'برد', dataIndex: 'scoreBand', render: (v: string) => <Tag color={bandColor[v]}>{bandLabel[v] || v}</Tag> },
        { title: 'تصمیم فعلی', dataIndex: 'rewardDecision', render: (v?: string) => v || '—' },
        {
          title: 'ثبت تصمیم', render: (_: unknown, r: EvaluationRow) => (
            <Space size="small">
              <Button size="small" disabled={saving} onClick={() => setDecision(r.id, 'reward')}>پاداش</Button>
              <Button size="small" disabled={saving} onClick={() => setDecision(r.id, 'penalty_recommended')}>پیشنهاد جریمه</Button>
            </Space>
          ),
        },
      ]} />
      {!userId && <Input disabled placeholder="ابتدا یک کارمند انتخاب کنید" style={{ marginTop: 8 }} />}
    </Card>
  )
}

export default function PerformanceSettingsPage() {
  return (
    <Tabs items={[
      { key: 'weights', label: 'وزن‌ها و آستانه‌ها', children: <WeightsTab /> },
      { key: 'reviewers', label: 'نگاشت ارزیاب‌ها', children: <ReviewersTab /> },
      { key: 'rewards', label: 'پاداش و جریمه', children: <RewardsTab /> },
    ]} />
  )
}
