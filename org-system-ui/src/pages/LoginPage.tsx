import { useState, useEffect } from 'react'
import { Form, Input, Button, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'

function PersianClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const persianDate = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(time)
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

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (values: { username: string; password: string }) => {
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
      if (!res.ok) { setError(data.message || 'نام کاربری یا رمز عبور اشتباه است'); return }
      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('permissions', JSON.stringify(data.permissions || []))
      window.location.assign('/dashboard')
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
    }}>
      {/* ستون راست — فرم */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 52px',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{
          width: '100%', maxWidth: 440,
          background: 'white', borderRadius: 20,
          padding: 36, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #8B1A6B, #A83585)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <UserOutlined style={{ fontSize: 28, color: 'white' }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>ورود به سیستم</div>
            <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6 }}>سامانه مدیریت سازمانی پارس</div>
          </div>

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

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
            <Button
              type="primary" htmlType="submit" block size="large" loading={loading}
              style={{ background: 'linear-gradient(135deg, #8B1A6B, #A83585)', border: 'none', borderRadius: 12, height: 54, fontWeight: 700, fontSize: 16, marginTop: 8 }}
            >
              ورود به سامانه
            </Button>
          </Form>
        </div>
      </div>

      {/* ستون چپ — اطلاعات */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 48, color: 'white', direction: 'rtl',
      }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '2px solid rgba(255,255,255,0.25)' }}>
          <span style={{ fontSize: 38 }}>🏢</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>موسسه مدیریت پروژه پارس</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>سامانه یکپارچه مدیریت سازمانی</div>

        <PersianClock />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340 }}>
          {[
            { icon: '📧', title: 'مدیریت نامه‌نگاری', desc: 'ثبت و پیگیری مکاتبات سازمانی' },
            { icon: '📊', title: 'مدیریت پروژه', desc: 'برنامه‌ریزی و کنترل پروژه‌ها' },
            { icon: '🎫', title: 'سیستم تیکتینگ', desc: 'پشتیبانی و رسیدگی به درخواست‌ها' },
            { icon: '📋', title: 'فرم‌های سازمانی', desc: 'گردش کار الکترونیکی فرم‌ها' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
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
