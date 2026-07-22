import { useEffect, useState } from 'react'
import { Alert, Button, Input, Space, Tag, Typography, message } from 'antd'
import { SafetyCertificateOutlined, CopyOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { apiFetch } from '../utils/api'

const API = 'http://localhost:5043/api/v1'

export default function TwoFactorSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'idle' | 'setup' | 'disable'>('idle')
  const [loading, setLoading] = useState(false)

  const loadStatus = async () => {
    const r = await apiFetch(`${API}/auth/mfa/status`)
    if (r.ok) setEnabled(!!(await r.json()).enabled)
  }
  useEffect(() => { void loadStatus() }, [])

  const startSetup = async () => {
    setLoading(true)
    try {
      const r = await apiFetch(`${API}/auth/mfa/setup`, { method: 'POST' })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { message.error(data.message || 'شروع راه‌اندازی انجام نشد'); return }
      setSecret(data.secret); setCode(''); setMode('setup')
    } finally { setLoading(false) }
  }

  const enable = async () => {
    setLoading(true)
    try {
      const r = await apiFetch(`${API}/auth/mfa/enable`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { message.error(data.message || 'کد نادرست است'); return }
      message.success(data.message || 'فعال شد'); setMode('idle'); setSecret(''); setCode(''); setEnabled(true)
    } finally { setLoading(false) }
  }

  const disable = async () => {
    setLoading(true)
    try {
      const r = await apiFetch(`${API}/auth/mfa/disable`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) { message.error(data.message || 'غیرفعال‌سازی انجام نشد'); return }
      message.success(data.message || 'غیرفعال شد'); setMode('idle'); setPassword(''); setEnabled(false)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <Space align="center" style={{ marginBottom: 16 }}>
        <SafetyCertificateOutlined style={{ fontSize: 22, color: '#8B1A6B' }} />
        <span style={{ fontSize: 16, fontWeight: 600 }}>احراز هویت دو مرحله‌ای</span>
        {enabled === true && <Tag color="green" icon={<CheckCircleOutlined />}>فعال</Tag>}
        {enabled === false && <Tag>غیرفعال</Tag>}
      </Space>

      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="یک لایه امنیتی اضافه روی حساب شما"
        description="با فعال‌سازی، هنگام ورود علاوه بر رمز عبور، یک کد ۶ رقمی از برنامه احرازهویت (Google Authenticator، Microsoft Authenticator، ...) هم لازم می‌شود." />

      {enabled === false && mode === 'idle' && (
        <Button type="primary" onClick={() => void startSetup()} loading={loading} style={{ background: '#8B1A6B' }}>فعال‌سازی احراز هویت دو مرحله‌ای</Button>
      )}

      {mode === 'setup' && (
        <div>
          <p style={{ marginBottom: 8 }}>۱) در برنامه احرازهویت، «افزودن حساب دستی» را بزنید و این کلید را وارد کنید:</p>
          <Space.Compact style={{ width: '100%', marginBottom: 6 }}>
            <Input readOnly value={secret} style={{ fontFamily: 'monospace', letterSpacing: 2, direction: 'ltr', textAlign: 'center', fontWeight: 700 }} />
            <Button icon={<CopyOutlined />} onClick={() => { navigator.clipboard?.writeText(secret); message.success('کلید کپی شد') }}>کپی</Button>
          </Space.Compact>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>نوع: مبتنی بر زمان (TOTP) — ۶ رقمی</Typography.Text>
          <p style={{ margin: '16px 0 8px' }}>۲) کد ۶ رقمی نمایش‌داده‌شده در برنامه را برای تأیید وارد کنید:</p>
          <Space>
            <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="------"
              maxLength={6} inputMode="numeric" style={{ width: 150, fontSize: 20, letterSpacing: 8, textAlign: 'center', fontFamily: 'monospace', direction: 'ltr' }} />
            <Button type="primary" onClick={() => void enable()} loading={loading} disabled={code.length !== 6} style={{ background: '#8B1A6B' }}>تأیید و فعال‌سازی</Button>
            <Button onClick={() => { setMode('idle'); setSecret(''); setCode('') }}>انصراف</Button>
          </Space>
        </div>
      )}

      {enabled === true && mode === 'idle' && (
        <Button danger onClick={() => setMode('disable')}>غیرفعال‌سازی احراز هویت دو مرحله‌ای</Button>
      )}

      {mode === 'disable' && (
        <div>
          <p style={{ marginBottom: 8 }}>برای غیرفعال‌سازی، رمز عبور فعلی خود را وارد کنید:</p>
          <Space>
            <Input.Password value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز عبور فعلی" style={{ width: 220 }} />
            <Button danger onClick={() => void disable()} loading={loading} disabled={!password}>غیرفعال کن</Button>
            <Button onClick={() => { setMode('idle'); setPassword('') }}>انصراف</Button>
          </Space>
        </div>
      )}
    </div>
  )
}
