import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, message, Select, Space, Table } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { apiFetch } from '../../utils/api'
import PersianDatePicker from '../../components/PersianDatePicker'
import { jalaliToDate, dateToJalali } from '../../utils/jalali'
import { API, permissionState } from './common'
import type { DirectoryUser } from './common'

const PRIMARY = '#8B1A6B'

const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const faJalaliDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const j = dateToJalali(new Date(y, m - 1, d))
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`
}

interface TimesheetEntry { description: string; minutes: number }
interface TimesheetRow { id: string; entryDate: string; entries: TimesheetEntry[] }

export default function TimesheetPage() {
  const { canManage } = permissionState()
  const [date, setDate] = useState<string>()
  const [rows, setRows] = useState<TimesheetEntry[]>([{ description: '', minutes: 30 }])
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<TimesheetRow[]>([])
  const [loading, setLoading] = useState(true)

  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [teamUserId, setTeamUserId] = useState<string>()
  const [teamHistory, setTeamHistory] = useState<TimesheetRow[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

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
      const response = await apiFetch(`${API}/directory`)
      const result = await response.json().catch(() => ({ users: [] }))
      if (response.ok) setUsers(result.users || [])
    })()
  }, [canManage])

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

  const addRow = () => setRows((r) => [...r, { description: '', minutes: 30 }])
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const updateRow = (i: number, patch: Partial<TimesheetEntry>) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  const submit = async () => {
    if (!date) { message.warning('تاریخ را انتخاب کنید'); return }
    const entries = rows.filter((r) => r.description.trim())
    if (!entries.length) { message.warning('حداقل یک فعالیت وارد کنید'); return }
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/timesheets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: toIsoDate(jalaliToDate(date)), entries }),
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

  const historyColumns = [
    { title: 'تاریخ', dataIndex: 'entryDate', render: faJalaliDate },
    { title: 'فعالیت‌ها', dataIndex: 'entries', render: (entries: TimesheetEntry[]) => entries.map((e) => e.description).join('، ') },
    { title: 'جمع دقیقه', dataIndex: 'entries', render: (entries: TimesheetEntry[]) => entries.reduce((s, e) => s + e.minutes, 0) },
  ]

  return (
    <div>
      <Card size="small" title="ثبت تایم‌شیت روزانه">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <PersianDatePicker value={date} onChange={setDate} placeholder="تاریخ امروز را انتخاب کنید" style={{ width: 220 }} />
          {rows.map((row, i) => (
            <Space key={i} style={{ width: '100%' }}>
              <Input style={{ width: 360 }} placeholder="توضیح فعالیت (مثلاً: پروژه X، تماس با مشتری، کمک به همکار)"
                value={row.description} onChange={(e) => updateRow(i, { description: e.target.value })} />
              <InputNumber min={0} max={1440} addonAfter="دقیقه" value={row.minutes} onChange={(v) => updateRow(i, { minutes: Number(v) || 0 })} />
              {rows.length > 1 && <Button icon={<DeleteOutlined />} onClick={() => removeRow(i)} />}
            </Space>
          ))}
          <Button icon={<PlusOutlined />} onClick={addRow}>افزودن فعالیت</Button>
          <Button type="primary" style={{ background: PRIMARY }} loading={saving} onClick={submit}>ثبت تایم‌شیت</Button>
        </Space>
      </Card>

      <Card size="small" title="تاریخچه تایم‌شیت من" style={{ marginTop: 16 }} loading={loading}>
        <Table rowKey="id" size="small" dataSource={history} pagination={{ pageSize: 10 }} columns={historyColumns} />
      </Card>

      {canManage && (
        <Card size="small" title="بازبینی هفتگی تیم" style={{ marginTop: 16 }}>
          <Select style={{ width: 240, marginBottom: 16 }} placeholder="انتخاب کارمند" showSearch optionFilterProp="label"
            value={teamUserId} onChange={setTeamUserId} options={users.map((u) => ({ value: u.id, label: u.fullName }))} />
          <Table rowKey="id" size="small" loading={teamLoading} dataSource={teamHistory} pagination={false} columns={historyColumns}
            locale={{ emptyText: teamUserId ? 'در ۷ روز گذشته تایم‌شیتی ثبت نشده' : 'ابتدا یک کارمند انتخاب کنید' }} />
        </Card>
      )}
    </div>
  )
}
