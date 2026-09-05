import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Collapse, Form, Input, InputNumber, message, Progress, Row, Segmented, Select, Space, Statistic, Table, Tag,
} from 'antd'
import { apiFetch } from '../../utils/api'
import { currentJalali } from '../../utils/jalali'
import { API, currentUser, permissionState } from './common'

const PRIMARY = '#8B1A6B'
const quarterLabel = ['بهار', 'تابستان', 'پاییز', 'زمستان']

interface RubricItem { code: string; label: string; max: number }
interface RubricCategory { code: string; label: string; group: 'Technical' | 'Behavioral'; max: number; items: RubricItem[] }
interface AdjustmentCatalogItem { code: string; label: string; points: number }
interface ScoreCard {
  id: string; employeeUserId: string; evaluatorUserId: string; evaluatorName: string
  periodYear: number; periodQuarter: number; scores: Record<string, number>
  technicalScore: number; behavioralScore: number; totalScore: number
}
interface Adjustment { id: string; type: 'Bonus' | 'Malus'; code: string; points: number; note?: string; createdAt: string }
interface QuarterlyResult {
  id: string; employeeUserId: string; periodYear: number; periodQuarter: number
  averageScore?: number; adjustmentTotal: number; finalScore?: number; band?: string; financialOutcomeText?: string
  status: 'Draft' | 'Finalized'
}

export default function QuarterlyReviewPage() {
  const { canManage, canAdmin } = permissionState()
  const me = currentUser()
  const jalaliNow = currentJalali()

  const [rubric, setRubric] = useState<RubricCategory[]>([])
  const [adjustmentCatalog, setAdjustmentCatalog] = useState<{ Bonus: AdjustmentCatalogItem[]; Malus: AdjustmentCatalogItem[] }>({ Bonus: [], Malus: [] })
  const [employees, setEmployees] = useState<{ userId: string; userName: string }[]>([])
  const [visibility, setVisibility] = useState<'team' | 'company'>(canAdmin ? 'company' : 'team')
  const [employeeUserId, setEmployeeUserId] = useState<string>()
  const [periodYear, setPeriodYear] = useState(jalaliNow.year)
  const [periodQuarter, setPeriodQuarter] = useState(Math.ceil(jalaliNow.month / 3))

  const [cards, setCards] = useState<ScoreCard[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [result, setResult] = useState<QuarterlyResult>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [adjForm] = Form.useForm()

  const canPickTarget = canManage || canAdmin
  const targetEmployeeId = canPickTarget ? employeeUserId : me.id

  useEffect(() => {
    void (async () => {
      const response = await apiFetch(`${API}/performance/rubric`)
      const result = await response.json().catch(() => ({}))
      if (response.ok) { setRubric(result.rubric || []); setAdjustmentCatalog(result.adjustmentCatalog || { Bonus: [], Malus: [] }) }
    })()
  }, [])

  useEffect(() => {
    if (!canPickTarget) return
    void (async () => {
      const response = await apiFetch(`${API}/performance/dashboard?scope=${visibility}`)
      const result = await response.json().catch(() => ({ employees: [] }))
      if (response.ok) setEmployees((result.employees || []).map((e: any) => ({ userId: e.userId, userName: e.userName })))
    })()
  }, [canPickTarget, visibility])

  const load = useCallback(async () => {
    if (!targetEmployeeId) return
    setLoading(true)
    try {
      const qs = `employeeUserId=${targetEmployeeId}&periodYear=${periodYear}&periodQuarter=${periodQuarter}`
      const [cardsRes, resultRes] = await Promise.all([
        apiFetch(`${API}/performance/scorecards?${qs}`),
        apiFetch(`${API}/performance/quarterly?employeeUserId=${targetEmployeeId}`),
      ])
      const cardsResult = await cardsRes.json().catch(() => [])
      if (cardsRes.ok) {
        setCards(cardsResult)
        const mine = (cardsResult as ScoreCard[]).find((c) => c.evaluatorUserId === me.id)
        form.setFieldsValue(mine ? mine.scores : {})
      }
      const resultsList = await resultRes.json().catch(() => [])
      if (resultRes.ok) setResult((resultsList as QuarterlyResult[]).find((r) => r.periodYear === periodYear && r.periodQuarter === periodQuarter))
      if (canAdmin) {
        const adjRes = await apiFetch(`${API}/performance/adjustments?${qs}`)
        const adjResult = await adjRes.json().catch(() => [])
        if (adjRes.ok) setAdjustments(adjResult)
      }
    } finally { setLoading(false) }
  }, [targetEmployeeId, periodYear, periodQuarter, canAdmin, me.id, form])
  useEffect(() => { void load() }, [load])

  const watched = Form.useWatch([], form) || {}
  const liveTotals = useMemo(() => {
    let technical = 0, behavioral = 0
    const perCategory: Record<string, number> = {}
    for (const category of rubric) {
      const sum = category.items.reduce((s, item) => s + Math.max(0, Math.min(item.max, Number((watched as Record<string, unknown>)[item.code]) || 0)), 0)
      perCategory[category.code] = sum
      if (category.group === 'Technical') technical += sum; else behavioral += sum
    }
    return { technical, behavioral, total: technical + behavioral, perCategory }
  }, [watched, rubric])

  const submitScoreCard = async () => {
    if (!targetEmployeeId) { message.warning('کارمند را انتخاب کنید'); return }
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/scorecards`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeUserId: targetEmployeeId, periodYear, periodQuarter, scores: values }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت امتیاز انجام نشد')
      message.success('امتیاز شما ثبت شد')
      await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت امتیاز انجام نشد')
    } finally { setSaving(false) }
  }

  const submitAdjustment = async () => {
    if (!targetEmployeeId) return
    const values = await adjForm.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/adjustments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeUserId: targetEmployeeId, periodYear, periodQuarter, type: values.type, code: values.code, note: values.note }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت امتیاز تعدیلی انجام نشد')
      message.success('امتیاز تعدیلی ثبت شد'); adjForm.resetFields(); await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت امتیاز تعدیلی انجام نشد')
    } finally { setSaving(false) }
  }

  const removeAdjustment = async (id: string) => {
    const response = await apiFetch(`${API}/performance/adjustments/${id}`, { method: 'DELETE' })
    if (response.ok) { message.success('حذف شد'); await load() } else message.error('حذف انجام نشد')
  }

  const computeQuarter = async () => {
    if (!targetEmployeeId) return
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/quarterly/compute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeUserId: targetEmployeeId, periodYear, periodQuarter }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'محاسبه انجام نشد')
      message.success(`محاسبه شد — امتیاز نهایی: ${data.finalScore}`)
      await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'محاسبه انجام نشد')
    } finally { setSaving(false) }
  }

  const finalizeQuarter = async (finalize: boolean) => {
    if (!result) return
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/performance/quarterly/${result.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalize ? { finalize: true } : { reopen: true }),
      })
      if (!response.ok) throw new Error('عملیات انجام نشد')
      message.success(finalize ? 'دوره نهایی شد' : 'دوره بازگشایی شد')
      await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'عملیات انجام نشد')
    } finally { setSaving(false) }
  }

  const collapseItems = rubric.map((category) => ({
    key: category.code,
    label: (
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <b>{category.label}</b>
        <Tag color={category.group === 'Technical' ? 'blue' : 'purple'}>
          {(liveTotals.perCategory[category.code] ?? 0).toFixed(2)} / {category.max}
        </Tag>
      </Space>
    ),
    children: (
      <Row gutter={[12, 12]}>
        {category.items.map((item) => (
          <Col xs={24} md={12} key={item.code}>
            <Form.Item name={item.code} label={`${item.label} (حداکثر ${item.max})`} style={{ marginBottom: 0 }} initialValue={0}>
              <InputNumber min={0} max={item.max} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        ))}
      </Row>
    ),
  }))

  return (
    <div>
      <Card size="small" title="ارزیابی فصلی HR (۹ سرفصل، ۱۰۰ امتیاز)">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {canPickTarget && (
            <Space wrap>
              {canAdmin && (
                <Segmented value={visibility} onChange={(v) => setVisibility(v as 'team' | 'company')}
                  options={[{ label: 'زیرمجموعه من', value: 'team' }, { label: 'کل شرکت', value: 'company' }]} />
              )}
              <Select style={{ width: 220 }} showSearch optionFilterProp="label" placeholder="کارمند"
                value={employeeUserId} onChange={setEmployeeUserId}
                options={employees.map((e) => ({ value: e.userId, label: e.userName }))} />
            </Space>
          )}
          <Space wrap>
            <InputNumber addonBefore="سال" value={periodYear} onChange={(v) => setPeriodYear(Number(v) || jalaliNow.year)} style={{ width: 160 }} />
            <Segmented value={periodQuarter} onChange={(v) => setPeriodQuarter(Number(v))}
              options={quarterLabel.map((label, i) => ({ label: `${label} (فصل ${i + 1})`, value: i + 1 }))} />
          </Space>
        </Space>
      </Card>

      {!targetEmployeeId ? (
        <Alert style={{ marginTop: 16 }} type="info" showIcon message="یک کارمند و دوره را انتخاب کنید" />
      ) : (
        <>
          <Card size="small" title="فرم امتیازدهی شما" style={{ marginTop: 16 }} loading={loading}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={24} md={8}><Statistic title="فنی و عملیاتی (از ۷۰)" value={liveTotals.technical.toFixed(1)} /></Col>
              <Col xs={24} md={8}><Statistic title="رفتاری و انضباطی (از ۳۰)" value={liveTotals.behavioral.toFixed(1)} /></Col>
              <Col xs={24} md={8}><Statistic title="جمع کل (از ۱۰۰)" value={liveTotals.total.toFixed(1)} valueStyle={{ color: PRIMARY }} /></Col>
            </Row>
            <Progress percent={Math.round(liveTotals.total)} strokeColor={PRIMARY} style={{ marginBottom: 16 }} />
            <Form form={form} layout="vertical">
              <Collapse items={collapseItems} />
            </Form>
            <Button type="primary" style={{ background: PRIMARY, marginTop: 16 }} loading={saving} onClick={submitScoreCard}>
              ثبت امتیاز من برای این دوره
            </Button>
          </Card>

          <Card size="small" title="امتیازهای ثبت‌شده توسط ارزیاب‌ها" style={{ marginTop: 16 }} loading={loading}>
            <Table rowKey="id" size="small" dataSource={cards} pagination={false} columns={[
              { title: 'ارزیاب', dataIndex: 'evaluatorName' },
              { title: 'فنی', dataIndex: 'technicalScore' },
              { title: 'رفتاری', dataIndex: 'behavioralScore' },
              { title: 'جمع', dataIndex: 'totalScore' },
            ]} />
            {cards.length > 0 && (
              <Alert style={{ marginTop: 12 }} type="info" showIcon
                message={`میانگین ${cards.length} ارزیاب: ${(cards.reduce((s, c) => s + c.totalScore, 0) / cards.length).toFixed(1)} از ۱۰۰`} />
            )}
          </Card>

          {canAdmin && (
            <Card size="small" title="امتیازات تعدیلی (بونوس/کسورات)" style={{ marginTop: 16 }}>
              <Form form={adjForm} layout="inline" style={{ marginBottom: 16 }}>
                <Form.Item name="type" rules={[{ required: true }]}>
                  <Select style={{ width: 120 }} placeholder="نوع" options={[{ value: 'Bonus', label: 'تشویقی' }, { value: 'Malus', label: 'تنبیهی' }]}
                    onChange={() => adjForm.setFieldValue('code', undefined)} />
                </Form.Item>
                <Form.Item shouldUpdate={(prev, cur) => prev.type !== cur.type} noStyle>
                  {({ getFieldValue }) => {
                    const type = getFieldValue('type')
                    const options = (type === 'Bonus' ? adjustmentCatalog.Bonus : type === 'Malus' ? adjustmentCatalog.Malus : [])
                      .map((c) => ({ value: c.code, label: `${c.label} (${c.points > 0 ? '+' : ''}${c.points})` }))
                    return <Form.Item name="code" rules={[{ required: true }]}><Select style={{ width: 280 }} placeholder="شاخص" options={options} disabled={!type} /></Form.Item>
                  }}
                </Form.Item>
                <Form.Item name="note"><Input style={{ width: 200 }} placeholder="یادداشت (اختیاری)" /></Form.Item>
                <Form.Item><Button loading={saving} onClick={submitAdjustment}>ثبت</Button></Form.Item>
              </Form>
              <Table rowKey="id" size="small" dataSource={adjustments} pagination={false} columns={[
                { title: 'نوع', dataIndex: 'type', render: (v: string) => <Tag color={v === 'Bonus' ? 'green' : 'red'}>{v === 'Bonus' ? 'تشویقی' : 'تنبیهی'}</Tag> },
                { title: 'شاخص', dataIndex: 'code' },
                { title: 'امتیاز', dataIndex: 'points' },
                { title: 'یادداشت', dataIndex: 'note', render: (v?: string) => v || '—' },
                { title: '', render: (_: unknown, r: Adjustment) => <Button size="small" danger onClick={() => removeAdjustment(r.id)}>حذف</Button> },
              ]} />
            </Card>
          )}

          {canAdmin && (
            <Card size="small" title="محاسبه و نهایی‌سازی دوره" style={{ marginTop: 16 }}>
              {result ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Row gutter={16}>
                    <Col xs={24} md={6}><Statistic title="میانگین ارزیاب‌ها" value={result.averageScore ?? '—'} /></Col>
                    <Col xs={24} md={6}><Statistic title="جمع تعدیلی" value={result.adjustmentTotal} /></Col>
                    <Col xs={24} md={6}><Statistic title="امتیاز نهایی" value={result.finalScore ?? '—'} valueStyle={{ color: PRIMARY }} /></Col>
                    <Col xs={24} md={6}><Tag color={result.status === 'Finalized' ? 'green' : 'gold'}>{result.status === 'Finalized' ? 'نهایی‌شده' : 'پیش‌نویس'}</Tag></Col>
                  </Row>
                  {result.band && <Alert type="info" showIcon message={`رده: ${result.band} — پیامد مالی: ${result.financialOutcomeText}`} />}
                </Space>
              ) : <Alert type="warning" showIcon message="هنوز برای این دوره محاسبه‌ای انجام نشده است" />}
              <Space style={{ marginTop: 16 }}>
                <Button loading={saving} onClick={computeQuarter}>محاسبه دوره</Button>
                {result && result.status !== 'Finalized' && (
                  <Button type="primary" style={{ background: PRIMARY }} loading={saving} onClick={() => finalizeQuarter(true)}>نهایی‌سازی</Button>
                )}
                {result && result.status === 'Finalized' && (
                  <Button danger loading={saving} onClick={() => finalizeQuarter(false)}>بازگشایی</Button>
                )}
              </Space>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
