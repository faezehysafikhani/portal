import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Descriptions, Form, Input, InputNumber, message, Modal, Row, Select, Slider, Space, Statistic, Table, Tabs, Tag } from 'antd'
import { apiFetch } from '../../utils/api'
import {
  API, bandColor, bandLabel, evaluationStatusColor, evaluationStatusLabel, monthNames, permissionState,
} from './common'
import type { EvaluationRow } from './common'

const PRIMARY = '#8B1A6B'

function ScoreCard({ evaluation }: { evaluation?: EvaluationRow }) {
  if (!evaluation) return <Card size="small"><span style={{ color: '#999' }}>هنوز ارزیابی برای شما ثبت نشده است</span></Card>
  return (
    <Card size="small" style={{ borderTop: `4px solid ${bandColor[evaluation.scoreBand || ''] || '#8B1A6B'}` }}>
      <Row gutter={16} align="middle">
        <Col xs={24} md={6}><Statistic title={`دوره ${monthNames[evaluation.periodMonth - 1]} ${evaluation.periodYear}`} value={evaluation.finalScore ?? '—'} suffix="/ ۱۰۰" /></Col>
        <Col xs={24} md={6}><Tag color={bandColor[evaluation.scoreBand || '']}>{bandLabel[evaluation.scoreBand || ''] || '—'}</Tag></Col>
        <Col xs={24} md={6}><Tag color={evaluationStatusColor[evaluation.status]}>{evaluationStatusLabel[evaluation.status] || evaluation.status}</Tag></Col>
        {evaluation.rewardDecision && <Col xs={24} md={6}>تصمیم: {evaluation.rewardDecision}</Col>}
      </Row>
      {evaluation.componentScores && (
        <Descriptions size="small" column={3} style={{ marginTop: 12 }}>
          <Descriptions.Item label="تکمیل وظایف">{evaluation.componentScores.taskCompletionScore}</Descriptions.Item>
          <Descriptions.Item label="کیفیت">{evaluation.componentScores.qualityScore}</Descriptions.Item>
          <Descriptions.Item label="به‌موقع‌بودن">{evaluation.componentScores.timelinessScore}</Descriptions.Item>
          <Descriptions.Item label="ارزیابی کیفی مدیر">{evaluation.componentScores.managerQualitativeScore}</Descriptions.Item>
          <Descriptions.Item label="نظم گزارش‌دهی">{evaluation.componentScores.reportingDisciplineScore}</Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}

function MyEvaluations() {
  const [rows, setRows] = useState<EvaluationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [appealOpen, setAppealOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`${API}/performance/evaluations`)
      const result = await response.json().catch(() => [])
      if (response.ok) setRows(result)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const current = rows[0]
  const history = rows.slice(1)

  const submitAppeal = async () => {
    if (!current || !reason.trim()) { message.warning('دلیل اعتراض را وارد کنید'); return }
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/appeals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationId: current.id, reason }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت اعتراض انجام نشد')
      message.success('اعتراض شما ثبت شد')
      setAppealOpen(false); setReason('')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت اعتراض انجام نشد')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        {current?.status === 'Finalized' && <Button onClick={() => setAppealOpen(true)}>اعتراض به ارزیابی</Button>}
      </Space>
      <ScoreCard evaluation={current} />
      <Card size="small" title="تاریخچه ارزیابی‌ها" style={{ marginTop: 16 }} loading={loading}>
        <Table rowKey="id" size="small" dataSource={history} pagination={{ pageSize: 8 }} columns={[
          { title: 'دوره', render: (_: unknown, r: EvaluationRow) => `${monthNames[r.periodMonth - 1]} ${r.periodYear}` },
          { title: 'امتیاز', dataIndex: 'finalScore' },
          { title: 'برد', dataIndex: 'scoreBand', render: (v: string) => <Tag color={bandColor[v]}>{bandLabel[v] || v}</Tag> },
          { title: 'وضعیت', dataIndex: 'status', render: (v: string) => <Tag color={evaluationStatusColor[v]}>{evaluationStatusLabel[v] || v}</Tag> },
        ]} />
      </Card>
      <Modal title="اعتراض به ارزیابی" open={appealOpen} onCancel={() => setAppealOpen(false)} onOk={submitAppeal} confirmLoading={saving}>
        <Input.TextArea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل اعتراض خود را بنویسید" />
      </Modal>
    </div>
  )
}

function ReviewTab() {
  const [pending, setPending] = useState<EvaluationRow[]>([])
  const [employees, setEmployees] = useState<{ userId: string; userName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [finalizeTarget, setFinalizeTarget] = useState<EvaluationRow>()
  const [rewardDecision, setRewardDecision] = useState<string>('none')
  const [rewardNotes, setRewardNotes] = useState('')
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, dashRes] = await Promise.all([
        apiFetch(`${API}/performance/evaluations/pending`), apiFetch(`${API}/performance/dashboard?scope=team`),
      ])
      const pendingResult = await pendingRes.json().catch(() => [])
      if (pendingRes.ok) setPending(pendingResult)
      const dashResult = await dashRes.json().catch(() => ({ employees: [] }))
      if (dashRes.ok) setEmployees((dashResult.employees || []).map((e: any) => ({ userId: e.userId, userName: e.userName })))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const submitCompute = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/evaluations/compute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: values.userId, periodYear: values.periodYear, periodMonth: values.periodMonth, managerQualitativeScore: values.managerQualitativeScore }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'محاسبه ارزیابی انجام نشد')
      message.success(`امتیاز محاسبه شد: ${result.finalScore}`)
      await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'محاسبه ارزیابی انجام نشد')
    } finally { setSaving(false) }
  }

  const submitFinalize = async () => {
    if (!finalizeTarget) return
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/evaluations/${finalizeTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalize: true, rewardDecision, rewardNotes }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'نهایی‌سازی انجام نشد')
      message.success('ارزیابی نهایی شد')
      setFinalizeTarget(undefined); setRewardDecision('none'); setRewardNotes(''); await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'نهایی‌سازی انجام نشد')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <Card size="small" title="محاسبه ارزیابی ماهانه جدید" style={{ marginBottom: 16 }}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="دوره‌های ارزیابی بر اساس تقویم میلادی محاسبه می‌شوند" />
        <Form form={form} layout="inline" initialValues={{ periodYear: new Date().getFullYear(), periodMonth: new Date().getMonth() + 1, managerQualitativeScore: 100 }}>
          <Form.Item name="userId" label="کارمند" rules={[{ required: true }]}>
            <Select style={{ width: 200 }} options={employees.map(e => ({ value: e.userId, label: e.userName }))} />
          </Form.Item>
          <Form.Item name="periodYear" label="سال" rules={[{ required: true }]}><InputNumber style={{ width: 100 }} /></Form.Item>
          <Form.Item name="periodMonth" label="ماه" rules={[{ required: true }]}>
            <Select style={{ width: 130 }} options={monthNames.map((m, i) => ({ value: i + 1, label: m }))} />
          </Form.Item>
          <Form.Item name="managerQualitativeScore" label="ارزیابی کیفی (۰ تا ۱۰۰)" style={{ minWidth: 220 }}>
            <Slider min={0} max={100} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" style={{ background: PRIMARY }} loading={saving} onClick={submitCompute}>محاسبه</Button>
          </Form.Item>
        </Form>
      </Card>
      <Card size="small" title="در انتظار بازبینی" loading={loading}>
        <Table rowKey="id" size="small" dataSource={pending} pagination={{ pageSize: 8 }} columns={[
          { title: 'کارمند', dataIndex: 'userName' },
          { title: 'دوره', render: (_: unknown, r: EvaluationRow) => `${monthNames[r.periodMonth - 1]} ${r.periodYear}` },
          { title: 'امتیاز', dataIndex: 'finalScore' },
          { title: 'برد', dataIndex: 'scoreBand', render: (v: string) => <Tag color={bandColor[v]}>{bandLabel[v] || v}</Tag> },
          { title: 'عملیات', render: (_: unknown, r: EvaluationRow) => <Button size="small" type="primary" style={{ background: PRIMARY }} onClick={() => setFinalizeTarget(r)}>نهایی‌سازی</Button> },
        ]} />
      </Card>
      <Modal title="نهایی‌سازی ارزیابی" open={!!finalizeTarget} onCancel={() => setFinalizeTarget(undefined)} onOk={submitFinalize} confirmLoading={saving}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>امتیاز نهایی: <b>{finalizeTarget?.finalScore}</b> — برد: <Tag color={bandColor[finalizeTarget?.scoreBand || '']}>{bandLabel[finalizeTarget?.scoreBand || ''] || '—'}</Tag></div>
          <Select style={{ width: '100%' }} value={rewardDecision} onChange={setRewardDecision} options={[
            { value: 'reward', label: 'پاداش' }, { value: 'none', label: 'بدون تصمیم خاص' }, { value: 'penalty_recommended', label: 'پیشنهاد جریمه' },
          ]} />
          <Input.TextArea rows={3} placeholder="یادداشت برای منابع انسانی" value={rewardNotes} onChange={(e) => setRewardNotes(e.target.value)} />
        </Space>
      </Modal>
    </div>
  )
}

export default function MonthlyEvaluationPage() {
  const { canManage } = permissionState()
  const items = [
    { key: 'me', label: 'ارزیابی من', children: <MyEvaluations /> },
    ...(canManage ? [{ key: 'review', label: 'بازبینی زیرمجموعه', children: <ReviewTab /> }] : []),
  ]
  return <Tabs items={items} />
}
