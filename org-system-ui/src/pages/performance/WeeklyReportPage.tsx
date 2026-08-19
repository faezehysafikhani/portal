import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, List, Row, Select, Space, Spin, Statistic } from 'antd'
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { apiFetch } from '../../utils/api'
import { API, currentUser, permissionState } from './common'
import type { DirectoryUser } from './common'

interface WeeklyReport {
  userId: string; from: string; to: string
  plannedCount: number; completedCount: number; inProgressCount: number; overdueCount: number; extraCompletedCount: number
  commitmentPercent: number | null; onTimePercent: number | null
  overdueTasks: { id: string; title: string; dueDate?: string }[]
}

const toDateInput = (d: Date) => d.toISOString().slice(0, 10)
const faDate = (v?: string) => v ? new Date(v).toLocaleDateString('fa-IR') : '—'

export default function WeeklyReportPage() {
  const { canManage } = permissionState()
  const me = currentUser()
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [userId, setUserId] = useState<string | undefined>(me.id)
  const [to, setTo] = useState(() => toDateInput(new Date()))
  const [report, setReport] = useState<WeeklyReport>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canManage) return
    void (async () => {
      const response = await apiFetch(`${API}/directory`)
      const result = await response.json().catch(() => ({ users: [] }))
      if (response.ok) setUsers(result.users || [])
    })()
  }, [canManage])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ to })
      if (userId) params.set('userId', userId)
      const response = await apiFetch(`${API}/performance/weekly?${params}`)
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'دریافت گزارش هفتگی انجام نشد')
      setReport(result)
    } finally { setLoading(false) }
  }, [to, userId])
  useEffect(() => { void load() }, [load])

  const shiftWeek = (days: number) => { const d = new Date(to); d.setUTCDate(d.getUTCDate() + days); setTo(toDateInput(d)) }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          {canManage && (
            <Select style={{ width: 220 }} placeholder="کارمند" value={userId} allowClear
              options={users.map(u => ({ value: u.id, label: u.fullName }))}
              onChange={(v) => setUserId(v || me.id)} />
          )}
          <Button icon={<RightOutlined />} onClick={() => shiftWeek(-7)}>هفته قبل</Button>
          <span>تا تاریخ: {faDate(to)}</span>
          <Button icon={<LeftOutlined />} onClick={() => shiftWeek(7)}>هفته بعد</Button>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>به‌روزرسانی</Button>
        </Space>
      </Card>

      {loading && <div style={{ height: 300, display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>}
      {!loading && report && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={4}><Card size="small" style={{ borderTop: '4px solid #1677ff', borderRadius: 12 }}><Statistic title="برنامه‌ریزی‌شده" value={report.plannedCount} /></Card></Col>
            <Col xs={12} md={4}><Card size="small" style={{ borderTop: '4px solid #52c41a', borderRadius: 12 }}><Statistic title="تکمیل‌شده" value={report.completedCount} /></Card></Col>
            <Col xs={12} md={4}><Card size="small" style={{ borderTop: '4px solid #fa8c16', borderRadius: 12 }}><Statistic title="در حال انجام" value={report.inProgressCount} /></Card></Col>
            <Col xs={12} md={4}><Card size="small" style={{ borderTop: '4px solid #f5222d', borderRadius: 12 }}><Statistic title="عقب‌افتاده" value={report.overdueCount} /></Card></Col>
            <Col xs={12} md={4}><Card size="small" style={{ borderTop: '4px solid #722ed1', borderRadius: 12 }}><Statistic title="کار اضافه انجام‌شده" value={report.extraCompletedCount} /></Card></Col>
            <Col xs={12} md={4}><Card size="small" style={{ borderTop: '4px solid #8B1A6B', borderRadius: 12 }}><Statistic title="تعهد کاری" suffix="٪" value={report.commitmentPercent ?? '—'} /></Card></Col>
          </Row>
          {report.onTimePercent != null && <Alert style={{ marginBottom: 16 }} type="info" showIcon message={`نرخ تحویل به‌موقع این هفته: ${report.onTimePercent}٪`} />}
          <Card size="small" title="وظایف عقب‌افتاده این هفته">
            {report.overdueTasks.length
              ? <List size="small" dataSource={report.overdueTasks} renderItem={(item) => <List.Item>{item.title} — مهلت: {faDate(item.dueDate)}</List.Item>} />
              : <span style={{ color: '#999' }}>موردی وجود ندارد</span>}
          </Card>
        </>
      )}
    </div>
  )
}
