import { useCallback, useEffect, useState } from 'react'
import { Card, Col, Row, Spin, Statistic, Table, Tabs, Tag } from 'antd'
import { apiFetch } from '../../utils/api'
import ManagerDonutChart from '../../components/ManagerDonutChart'
import { API, bandColor, bandLabel, monthNames, permissionState } from './common'
import type { EvaluationRow } from './common'

function useDashboard(scope: string) {
  const [data, setData] = useState<any>()
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`${API}/performance/dashboard?scope=${scope}`)
      const result = await response.json().catch(() => ({}))
      if (response.ok) setData(result)
    } finally { setLoading(false) }
  }, [scope])
  useEffect(() => { void load() }, [load])
  return { data, loading }
}

function MeTab() {
  const { data, loading } = useDashboard('me')
  if (loading) return <div style={{ height: 260, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>
  const current: EvaluationRow | undefined = data?.current
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <Card size="small" style={{ borderTop: `4px solid ${bandColor[current?.scoreBand || ''] || '#8B1A6B'}`, borderRadius: 12 }}>
          <Statistic title={current ? `امتیاز دوره ${monthNames[current.periodMonth - 1]} ${current.periodYear}` : 'امتیاز فعلی'} value={current?.finalScore ?? '—'} suffix="/ ۱۰۰" />
          {current?.scoreBand && <Tag color={bandColor[current.scoreBand]} style={{ marginTop: 8 }}>{bandLabel[current.scoreBand]}</Tag>}
        </Card>
      </Col>
      <Col xs={24} md={16}>
        <Card size="small" title="تاریخچه امتیازها">
          <Table rowKey="id" size="small" dataSource={data?.history || []} pagination={{ pageSize: 6 }} columns={[
            { title: 'دوره', render: (_: unknown, r: EvaluationRow) => `${monthNames[r.periodMonth - 1]} ${r.periodYear}` },
            { title: 'امتیاز', dataIndex: 'finalScore' },
            { title: 'برد', dataIndex: 'scoreBand', render: (v: string) => <Tag color={bandColor[v]}>{bandLabel[v] || v}</Tag> },
          ]} />
        </Card>
      </Col>
    </Row>
  )
}

function TeamTab() {
  const { data, loading } = useDashboard('team')
  if (loading) return <div style={{ height: 260, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={6}>
        <Card size="small" style={{ borderTop: '4px solid #1677ff', borderRadius: 12 }}><Statistic title="اعضای تیم" value={(data?.employees || []).length} /></Card>
      </Col>
      <Col xs={24} md={6}>
        <Card size="small" style={{ borderTop: '4px solid #f5222d', borderRadius: 12 }}><Statistic title="در انتظار تأیید ثبت وظیفه" value={data?.pendingApprovals ?? 0} /></Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" title="توزیع برد امتیازی تیم">
          <ManagerDonutChart items={(data?.bandDistribution || []).map((b: any) => ({ name: b.name, value: b.value, color: bandColor[b.name] }))} formatLabel={(n) => bandLabel[n] || n} centerLabel="نفرات" />
        </Card>
      </Col>
      <Col xs={24}>
        <Card size="small" title="وضعیت اعضای تیم">
          <Table rowKey="userId" size="small" dataSource={data?.employees || []} pagination={{ pageSize: 8 }} columns={[
            { title: 'کارمند', dataIndex: 'userName' },
            { title: 'آخرین امتیاز', render: (_: unknown, r: any) => r.evaluation?.finalScore ?? '—' },
            { title: 'برد', render: (_: unknown, r: any) => r.evaluation?.scoreBand ? <Tag color={bandColor[r.evaluation.scoreBand]}>{bandLabel[r.evaluation.scoreBand]}</Tag> : '—' },
          ]} />
        </Card>
      </Col>
    </Row>
  )
}

function CompanyTab() {
  const { data, loading } = useDashboard('company')
  if (loading) return <div style={{ height: 260, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>
  return (
    <Row gutter={[16, 16]}>
      <Col xs={12} md={6}><Card size="small" style={{ borderTop: '4px solid #8B1A6B', borderRadius: 12 }}><Statistic title="میانگین امتیاز شرکت" value={data?.averageScore ?? '—'} /></Card></Col>
      <Col xs={12} md={6}><Card size="small" style={{ borderTop: '4px solid #52c41a', borderRadius: 12 }}><Statistic title="کارمندان ارزیابی‌شده" value={data?.evaluatedEmployeeCount ?? 0} /></Card></Col>
      <Col xs={12} md={6}><Card size="small" style={{ borderTop: '4px solid #fa8c16', borderRadius: 12 }}><Statistic title="در انتظار بازبینی" value={data?.pendingReviewCount ?? 0} /></Card></Col>
      <Col xs={24} md={12}>
        <Card size="small" title="توزیع برد امتیازی کل شرکت">
          <ManagerDonutChart items={(data?.bandDistribution || []).map((b: any) => ({ name: b.name, value: b.value, color: bandColor[b.name] }))} formatLabel={(n) => bandLabel[n] || n} centerLabel="نفرات" />
        </Card>
      </Col>
    </Row>
  )
}

export default function PerformanceDashboardPage() {
  const { canManage, canAdmin } = permissionState()
  const items = [
    { key: 'me', label: 'داشبورد من', children: <MeTab /> },
    ...(canManage ? [{ key: 'team', label: 'عملکرد تیم', children: <TeamTab /> }] : []),
    ...(canAdmin ? [{ key: 'company', label: 'کل شرکت', children: <CompanyTab /> }] : []),
  ]
  return <Tabs items={items} />
}
