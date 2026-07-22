import { useEffect, useMemo, useState } from 'react'
import { Card, Table, Select, Input, Tag, Space, Button, Alert, Tooltip } from 'antd'
import { ReloadOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, HistoryOutlined } from '@ant-design/icons'

interface AuditRow {
  id: string
  userId: string | null
  username: string
  fullName: string | null
  success: boolean
  ip: string | null
  userAgent: string | null
  createdAt: string
}
interface UserOption { id: string; fullName: string; username: string }

const api = 'http://localhost:5043/api/v1'
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

function deviceLabel(ua: string | null): string {
  if (!ua) return '—'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'نامشخص'
  const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : ''
  return browser ? `${os} — ${browser}` : os
}

export default function LoginAuditPage() {
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined)
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = async (userId?: string) => {
    setLoading(true)
    try {
      const qs = userId ? `?userId=${userId}` : ''
      const r = await fetch(`${api}/login-audit${qs}`, { headers: headers() })
      setRows(r.ok ? await r.json() : [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    fetch(`${api}/users`, { headers: headers() })
      .then(r => r.ok ? r.json() : [])
      .then((us: any[]) => setUsers(us.map(u => ({ id: u.id, fullName: u.fullName || u.username, username: u.username }))))
      .catch(() => {})
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      String(r.username || '').toLowerCase().includes(q) ||
      String(r.fullName || '').toLowerCase().includes(q) ||
      String(r.ip || '').toLowerCase().includes(q))
  }, [rows, search])

  const columns = [
    { title: 'کاربر', key: 'user', render: (_: unknown, r: AuditRow) => (
      <div><div style={{ fontWeight: 500 }}>{r.fullName || '—'}</div><div style={{ fontSize: 11, color: '#999' }} dir="ltr">{r.username}</div></div>
    ) },
    { title: 'تاریخ و زمان', dataIndex: 'createdAt', key: 'createdAt', width: 190,
      render: (v: string) => v ? new Date(v).toLocaleString('fa-IR', { dateStyle: 'full', timeStyle: 'medium' }) : '-' },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 150,
      render: (v: string) => <Tag color="blue" style={{ fontFamily: 'monospace' }} dir="ltr">{v && v !== 'unknown' ? v : 'ثبت نشده'}</Tag> },
    { title: 'دستگاه', key: 'device', width: 160,
      render: (_: unknown, r: AuditRow) => <Tooltip title={r.userAgent || ''}><span style={{ fontSize: 12, color: '#666' }}>{deviceLabel(r.userAgent)}</span></Tooltip> },
    { title: 'وضعیت', dataIndex: 'success', key: 'success', width: 110,
      render: (s: boolean) => s
        ? <Tag color="green" icon={<CheckCircleOutlined />}>موفق</Tag>
        : <Tag color="red" icon={<CloseCircleOutlined />}>ناموفق</Tag> },
  ]

  return (
    <Card title={<Space><HistoryOutlined style={{ color: '#8B1A6B' }} /><span>تاریخچه ورود کاربران</span></Space>}
      extra={<Button icon={<ReloadOutlined />} onClick={() => void load(selectedUser)} loading={loading}>به‌روزرسانی</Button>}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="گزارش ورود موفق و ناموفق کاربران در ۳۰ روز اخیر"
        description="برای مشاهده‌ی سابقه‌ی یک کاربر خاص، او را از فهرست انتخاب کنید. رکوردهای قدیمی‌تر از ۳۰ روز به‌صورت خودکار حذف می‌شوند." />
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear showSearch optionFilterProp="label" style={{ width: 280 }}
          placeholder="همه‌ی کاربران — یا یک کاربر را انتخاب کنید"
          value={selectedUser}
          onChange={(v) => { setSelectedUser(v); void load(v) }}
          options={users.map(u => ({ value: u.id, label: `${u.fullName} (${u.username})` }))} />
        <Input allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="جستجو در نام کاربری یا IP…"
          value={search} onChange={e => setSearch(e.target.value)} style={{ width: 260 }} />
      </Space>
      <Table columns={columns} dataSource={filtered} rowKey="id" loading={loading} size="middle"
        pagination={{ pageSize: 15, showTotal: total => `${total.toLocaleString('fa-IR')} رکورد ورود` }} />
    </Card>
  )
}
