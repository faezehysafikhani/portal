import { useState, useEffect } from 'react'
import { Form, Input, Button, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { formatJalaliDate } from '../utils/jalali'

function PersianClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const persianDate = formatJalaliDate(time, true)
  const persianTime = time.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const gregorianDate = time.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <div style={{ fontSize: 42, fontWeight: 800, color: 'white', letterSpacing: 2, fontFamily: 'monospace' }}>{persianTime}</div>
      <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 6, fontWeight: 500 }}>{persianDate}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{gregorianDate}</div>
    </div>
  )
}

// حروف و اعداد بدون کاراکترهای گیج‌کننده (O/0 و I/1/l)
const CAPTCHA_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function makeCaptcha(length = 5) {
  let value = ''
  for (let i = 0; i < length; i++) value += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]
  return value
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [company, setCompany] = useState<{ name?: string; logoUrl?: string | null; captchaAfterAttempts?: number }>({ name: 'موسسه مدیریت پروژه پارس' })
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [captcha, setCaptcha] = useState(() => makeCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')
  const captchaThreshold = company.captchaAfterAttempts ?? 3
  const captchaRequired = failedAttempts >= captchaThreshold
  const newCaptcha = () => { setCaptcha(makeCaptcha()); setCaptchaInput('') }
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [pendingName, setPendingName] = useState('')

  useEffect(() => {
    fetch('http://localhost:5043/api/v1/company/public?tenantId=00000000-0000-0000-0000-000000000001')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { setCompany(data); localStorage.setItem('company', JSON.stringify(data)) })
      .catch(() => undefined)
  }, [])

  const completeLogin = (data: any, fallbackName?: string) => {
    localStorage.setItem('token', data.accessToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('permissions', JSON.stringify(data.permissions || []))
    if (data.company) localStorage.setItem('company', JSON.stringify(data.company))
    sessionStorage.setItem('welcome-user', data.user?.fullName || `${data.user?.firstName || ''} ${data.user?.lastName || ''}`.trim() || data.user?.username || fallbackName || '')
    if (data.mustChangePassword) {
      localStorage.setItem('force-password-change', '1')
      window.location.assign('/change-password')
      return
    }
    window.location.assign('/dashboard')
  }

  const handleLogin = async (values: { username: string; password: string }) => {
    if (captchaRequired && captchaInput.trim().toUpperCase() !== captcha.toUpperCase()) {
      setError('کد امنیتی وارد شده درست نیست')
      newCaptcha()
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:5043/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
          tenantId: '00000000-0000-0000-0000-000000000001'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'نام کاربری یا رمز عبور اشتباه است')
        setFailedAttempts(n => n + 1)
        newCaptcha()
        return
      }
      if (data.mfaRequired) { setMfaToken(data.mfaToken); setPendingName(values.username); return }
      completeLogin(data, values.username)
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  const verifyMfa = async () => {
    if (!/^\d{6}$/.test(mfaCode.trim())) { setError('کد ۶ رقمی برنامه احرازهویت را وارد کنید'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:5043/api/v1/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: mfaCode.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'کد تأیید اشتباه است')
        if (res.status === 401 && String(data.message || '').includes('مهلت')) { setMfaToken(null); setMfaCode('') }
        return
      }
      completeLogin(data, pendingName)
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'linear-gradient(135deg, #1a0533 0%, #3D0A2E 40%, #8B1A6B 100%)',
      direction: 'rtl',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* حباب‌های تزئینی پس‌زمینه */}
      <div className="login-orb" style={{ width: 320, height: 320, background: 'rgba(233,30,140,0.35)', top: '-80px', right: '-60px' }} />
      <div className="login-orb" style={{ width: 280, height: 280, background: 'rgba(122,21,96,0.45)', bottom: '-90px', left: '-70px', animationDelay: '3s' }} />

      {/* ستون راست — فرم */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 52px',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        position: 'relative', zIndex: 1,
      }}>
        <div className="login-card" style={{
          width: '100%', maxWidth: 440,
          background: 'white', borderRadius: 20,
          padding: 36, boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}>
          <div style={{ height: 4, margin: '-36px -36px 28px', background: 'linear-gradient(90deg, #8B1A6B, #E91E8C, #8B1A6B)' }} />
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #8B1A6B, #A83585)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <UserOutlined style={{ fontSize: 28, color: 'white' }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>ورود به سیستم</div>
            <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6 }}>سامانه مدیریت سازمانی پارس</div>
          </div>

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {mfaToken ? (
            <div>
              <Alert type="info" showIcon style={{ marginBottom: 16 }}
                message="کد تأیید دو مرحله‌ای"
                description="کد ۶ رقمی نمایش‌داده‌شده در برنامه احرازهویت (مثل Google Authenticator) را وارد کنید." />
              <Input
                autoFocus value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onPressEnter={() => void verifyMfa()}
                placeholder="------" size="large" maxLength={6} inputMode="numeric"
                style={{ height: 56, fontSize: 26, letterSpacing: 12, textAlign: 'center', fontFamily: 'monospace', direction: 'ltr' }} />
              <Button type="primary" block size="large" loading={loading} onClick={() => void verifyMfa()}
                style={{ background: 'linear-gradient(135deg, #8B1A6B, #A83585)', border: 'none', borderRadius: 12, height: 54, fontWeight: 700, fontSize: 16, marginTop: 16 }}>
                تأیید و ورود
              </Button>
              <Button type="link" block onClick={() => { setMfaToken(null); setMfaCode(''); setError('') }} style={{ marginTop: 8, color: '#8c8c8c' }}>
                بازگشت به صفحه ورود
              </Button>
            </div>
          ) : (
          <Form layout="vertical" onFinish={handleLogin}>
            <Form.Item name="username" label="نام کاربری" rules={[{ required: true, message: 'نام کاربری الزامی است' }]}>
              <Input
                prefix={<UserOutlined style={{ color: '#8B1A6B' }} />}
                placeholder="نام کاربری"
                size="large"
                style={{ height: 50 }}
              />
            </Form.Item>
            <Form.Item name="password" label="رمز عبور" rules={[{ required: true, message: 'رمز عبور الزامی است' }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8B1A6B' }} />}
                placeholder="رمز عبور"
                size="large"
                style={{ height: 50 }}
              />
            </Form.Item>
            {captchaRequired && (
              <Form.Item label="کد امنیتی" required help="بزرگی و کوچکی حروف اهمیتی ندارد">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    fontWeight: 800, fontSize: 22, letterSpacing: 6, userSelect: 'none', direction: 'ltr',
                    minWidth: 130, textAlign: 'center', padding: '9px 12px', borderRadius: 8, color: '#5C0F47',
                    fontFamily: 'monospace', textDecoration: 'line-through', textDecorationColor: '#8B1A6B55',
                    background: 'repeating-linear-gradient(45deg, #f7eef4, #f7eef4 6px, #efe0ea 6px, #efe0ea 12px)',
                  }}>{captcha}</div>
                  <Input value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} placeholder="کد بالا را وارد کنید"
                    size="large" style={{ height: 50, flex: 1 }} maxLength={8} autoComplete="off" />
                  <Button type="text" onClick={newCaptcha} title="کد جدید" style={{ height: 50, fontSize: 18 }}>⟳</Button>
                </div>
              </Form.Item>
            )}
            <Button
              type="primary" htmlType="submit" block size="large" loading={loading}
              style={{ background: 'linear-gradient(135deg, #8B1A6B, #A83585)', border: 'none', borderRadius: 12, height: 54, fontWeight: 700, fontSize: 16, marginTop: 8 }}
            >
              ورود به سامانه
            </Button>
          </Form>
          )}
        </div>
      </div>

      {/* ستون چپ — اطلاعات */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 48, color: 'white', direction: 'rtl',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ width: 96, height: 96, borderRadius: 18, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '2px solid rgba(255,255,255,0.25)', padding: 8 }}>
          {company.logoUrl ? <img src={company.logoUrl} alt={`لوگوی ${company.name || 'شرکت'}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 38 }}>🏢</span>}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>{company.name || 'موسسه مدیریت پروژه پارس'}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>سامانه یکپارچه مدیریت سازمانی</div>

        <PersianClock />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340 }}>
          {[
            { icon: '📧', title: 'مدیریت نامه‌نگاری', desc: 'ثبت و پیگیری مکاتبات سازمانی' },
            { icon: '📊', title: 'مدیریت پروژه', desc: 'برنامه‌ریزی و کنترل پروژه‌ها' },
            { icon: '🎫', title: 'سیستم تیکتینگ', desc: 'پشتیبانی و رسیدگی به درخواست‌ها' },
            { icon: '📋', title: 'فرم‌های سازمانی', desc: 'گردش کار الکترونیکی فرم‌ها' },
          ].map((item, i) => (
            <div key={i} className="login-feature" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 36, fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
          مدیریت پروژه پارس © ۱۴۰۳
        </div>
      </div>
    </div>
  )
}
