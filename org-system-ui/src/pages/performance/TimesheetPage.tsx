import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, message, Select, Space, Table } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { apiFetch } from '../../utils/api'
import PersianDatePicker from '../../components/PersianDatePicker'
import { jalaliToDate, dateToJalali } from '../../utils/jalali'
import { API, permissionState } from './common'

const PRIMARY = '#8B1A6B'

const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const faJalaliDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const j = dateToJalali(new Date(y, m - 1, d))
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`
}
const todayJalaliLabel = faJalaliDate(toIsoDate(new Date()))

interface TimesheetEntry { description: string; minutes: number }
interface TimesheetRow { id: string; entryDate: string; entries: TimesheetEntry[] }
type RowsSetter = (updater: (rows: TimesheetEntry[]) => TimesheetEntry[]) => void

function EntryRows({ rows, setRows }: { rows: TimesheetEntry[]; setRows: RowsSetter }) {
  const addRow = () => setRows((r) => [...r, { description: '', minutes: 30 }])
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const updateRow = (i: number, patch: Partial<TimesheetEntry>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {rows.map((row, i) => (
        <Space key={i} style={{ width: '100%' }}>
          <Input style={{ width: 360 }} placeholder="توضیح فعالیت (مثلاً: پروژه X، تماس با مشتری، کمک به همکار)"
            value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} />
          <InputNumber min={0} max={1440} addonAfter="دقیقه" value={row.minutes} onChange={(v) => updateRow(i, { minutes: Number(v) || 0 })} />
          {rows.length > 1 && <Button icon={<DeleteOutlined />} onClick={() => removeRow(i)} />}
        </Space>
      ))}
      <Button icon={<PlusOutlined />} onClick={addRow}>افزودن فعالیت</Button>
    </Space>
  )
}

export default function TimesheetPage() {
  const { canManage, canAdmin } = permissionState()
  const [rows, setRows] = useState<TimesheetEntry[]>([{ description: '', minutes: 30 }])
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<TimesheetRow[]>([])
  const [loading, setLoading] = useState(true)

  const [employees, setEmployees] = useState<{ userId: string; userName: string }[]>([])
  const [teamUserId, setTeamUserId] = useState<string>()
  const [teamHistory, setTeamHistory] = useState<TimesheetRow[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  const [assignUserId, setAssignUserId] = useState<string>()
  const [assignDate, setAssignDate] = useState<string>()
  const [assignRows, setAssignRows] = useState<TimesheetEntry[]>([{ description: '', minutes: 30 }])
  const [assignSaving, setAssignSaving] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`${API}/timesheets`)
      const result = await response.json().catch(() => [])
      if (response.ok) setHistory(result)
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadHistory() }, [loadHistory])

  useEffect(() => {
    if (!canManage) return
    void (async () => {
      const response = await apiFetch(`${API}/performance/dashboard?scope=${canAdmin ? 'company' : 'team'}`)
      const result = await response.json().catch(() => ({ employees: [] }))
      if (response.ok) setEmployees((result.employees || []).map((e: any) => ({ userId: e.userId, userName: e.userName })))
    })()
  }, [canManage, canAdmin])

  useEffect(() => {
    if (!canManage || !teamUserId) return
    setTeamLoading(true)
    void (async () => {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6)
      const response = await apiFetch(`${API}/timesheets?userId=${teamUserId}&from=${toIsoDate(from)}&to=${toIsoDate(to)}`)
      const result = await response.json().catch(() => [])
      if (response.ok) setTeamHistory(result)
      setTeamLoading(false)
    })()
  }, [canManage, teamUserId])

  const submit = async () => {
    const entries = rows.filter((r) => r.description.trim())
    if (!entries.length) { message.warning('حداقل یک فعالیت وارد کنید'); return }
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/timesheets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت تایم‌شیت انجام نشد')
      message.success('تایم‌شیت امروز ثبت شد')
      setRows([{ description: '', minutes: 30 }])
      await loadHistory()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت تایم‌شیت انجام نشد')
    } finally { setSaving(false) }
  }

  const submitForEmployee = async () => {
    if (!assignUserId) { message.warning('کارمند را انتخاب کنید'); return }
    if (!assignDate) { message.warning('تاریخ را انتخاب کنید'); return }
    const entries = assignRows.filter((r) => r.description.trim())
    if (!entries.length) { message.warning('حداقل یک فعالیت وارد کنید'); return }
    setAssignSaving(true)
    try {
      const response = await apiFetch(`${API}/timesheets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: assignUserId, date: toIsoDate(jalaliToDate(assignDate)), entries }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت تایم‌شیت انجام نشد')
      message.success('تایم‌شیت برای کارمند ثبت شد')
      setAssignRows([{ description: '', minutes: 30 }])
      if (teamUserId === assignUserId) {
        const to = new Date(); const from = new Date(); from.setDate(from.getDate() - 6)
        const refreshed = await apiFetch(`${API}/timesheets?userId=${teamUserId}&from=${toIsoDate(from)}&to=${toIsoDate(to)}`)
        if (refreshed.ok) setTeamHistory(await refreshed.json())
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت تایم‌شیت انجام نشد')
    } finally { setAssignSaving(false) }
  }

  const historyColumns = [
    { title: 'تاریخ', dataIndex: 'entryDate', render: faJalaliDate },
    { title: 'فعالیت‌ها', dataIndex: 'entries', render: (entries: TimesheetEntry[]) => entries.map((e) => e.description).join('، ') },
    { title: 'جمع دقیقه', dataIndex: 'entries', render: (entries: TimesheetEntry[]) => entries.reduce((s, e) => s + e.minutes, 0) },
  ]

  return (
    <div>
      <Card size="small" title={`ثبت تایم‌شیت امروز — ${todayJalaliLabel}`}>
        <Alert type="info" showIcon style={{ marginBottom: 12 }} message="تایم‌شیت شخصی فقط برای امروز ثبت می‌شود؛ امکان ثبت یا اصلاح روزهای گذشته وجود ندارد." />
        <EntryRows rows={rows} setRows={setRows} />
        <Button type="primary" style={{ background: PRIMARY, marginTop: 12 }} loading={saving} onClick={submit}>ثبت تایم‌شیت امروز</Button>
      </Card>

      <Card size="small" title="تاریخچه تایم‌شیت من" style={{ marginTop: 16 }} loading={loading}>
        <Table rowKey="id" size="small" dataSource={history} pagination={{ pageSize: 10 }} columns={historyColumns} />
      </Card>

      {canManage && (
        <>
          <Card size="small" title="ثبت تایم‌شیت برای کارمند" style={{ marginTop: 16 }}>
            <Alert type="info" showIcon style={{ marginBottom: 12 }} message="چون شما به‌جای کارمند ثبت می‌کنید، انتخاب هر تاریخی (از جمله روزهای گذشته) آزاد است." />
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Space wrap>
                <Select style={{ width: 220 }} placeholder="انتخاب کارمند" showSearch optionFilterProp="label"
                  value={assignUserId} onChange={setAssignUserId} options={employees.map((u) => ({ value: u.userId, label: u.userName }))} />
                <PersianDatePicker value={assignDate} onChange={setAssignDate} placeholder="انتخاب تاریخ" style={{ width: 200 }} />
              </Space>
              <EntryRows rows={assignRows} setRows={setAssignRows} />
              <Button type="primary" style={{ background: PRIMARY }} loading={assignSaving} onClick={submitForEmployee}>ثبت تایم‌شیت برای این کارمند</Button>
            </Space>
          </Card>

          <Card size="small" title="بازبینی هفتگی تیم" style={{ marginTop: 16 }}>
            <Select style={{ width: 240, marginBottom: 16 }} placeholder="انتخاب کارمند" showSearch optionFilterProp="label"
              value={teamUserId} onChange={setTeamUserId} options={employees.map((u) => ({ value: u.userId, label: u.userName }))} />
            <Table rowKey="id" size="small" loading={teamLoading} dataSource={teamHistory} pagination={false} columns={historyColumns}
              locale={{ emptyText: teamUserId ? 'در ۷ روز گذشته تایم‌شیتی ثبت نشده' : 'ابتدا یک کارمند انتخاب کنید' }} />
          </Card>
        </>
      )}
    </div>
  )
}
