import { useState, useEffect } from 'react'
import { Form, Input, Button, Card, Alert, Tabs } from 'antd'
import { LockOutlined, MailOutlined, PhoneOutlined, CustomerServiceOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

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
      <div style={{ fontSize: 40, fontWeight: 800, color: 'white', letterSpacing: 2, fontFamily: 'monospace' }}>{persianTime}</div>
      <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 6, fontWeight: 500 }}>{persianDate}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{gregorianDate}</div>
    </div>
  )
}

export default function CustomerLoginPage() {
  const navigate = useNavigate()
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = () => {
    loginForm.validateFields().then(async values => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('http://localhost:5043/api/v1/customers/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: values.email, password: values.password })
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message || 'خطا در ورود'); return }
        localStorage.setItem('customer', JSON.stringify(data))
        navigate('/customer-portal')
      } catch {
        setError('خطا در اتصال به سرور')
      } finally {
        setLoading(false)
      }
    }).catch(() => {})
  }

  const handleRegister = () => {
    registerForm.validateFields().then(async values => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('http://localhost:5043/api/v1/customers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: values.fullName,
            email: values.email,
            phone: values.mobile,
            companyName: values.company || null,
            password: values.password
          })
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message || 'خطا در ثبت‌نام'); return }
        localStorage.setItem('customer', JSON.stringify(data))
        navigate('/customer-portal')
      } catch {
        setError('خطا در اتصال به سرور')
      } finally {
        setLoading(false)
      }
    }).catch(() => {})
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 52px',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
      }}>
        <Card style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: 'none',
          direction: 'rtl',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #8B1A6B, #A83585)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <CustomerServiceOutlined style={{ fontSize: 30, color: 'white' }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>پورتال پشتیبانی</div>
            <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6 }}>برای ثبت و پیگیری تیکت وارد شوید</div>
          </div>

          {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
<Form form={loginForm} layout="vertical" style={{ marginTop: 8 }}>
  <Form.Item name="email" label="ایمیل" rules={[{ required: true, message: 'ایمیل الزامی است' }, { type: 'email', message: 'ایمیل معتبر وارد کنید' }]}>
    <Input
      prefix={<MailOutlined style={{ color: '#8B1A6B' }} />}
      placeholder="example@email.com"
      size="large"
      style={{ height: 50, fontSize: 14 }}
    />
  </Form.Item>
  <Form.Item name="password" label="رمز عبور" rules={[{ required: true, message: 'رمز عبور الزامی است' }]}>
    <Input.Password
      prefix={<LockOutlined style={{ color: '#8B1A6B' }} />}
      placeholder="رمز عبور"
      size="large"
      style={{ height: 50, fontSize: 14 }}
      onPressEnter={handleLogin}
    />
  </Form.Item>
  <Button
    type="primary" block size="large" loading={loading} onClick={handleLogin}
    style={{ background: 'linear-gradient(135deg, #8B1A6B, #A83585)', border: 'none', borderRadius: 12, height: 54, fontWeight: 700, fontSize: 17, marginTop: 8 }}
  >
    ورود به پورتال
  </Button>
  <div style={{ textAlign: 'center', marginTop: 14, padding: '10px 14px', background: '#f9f0ff', borderRadius: 10, fontSize: 12, color: '#8c8c8c' }}>
    برای دریافت دسترسی با پشتیبانی تماس بگیرید
  </div>
</Form>
          
        </Card>
      </div>

      {/* ستون چپ — اطلاعات */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        color: 'white',
        direction: 'rtl',
      }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '2px solid rgba(255,255,255,0.25)' }}>
          <CustomerServiceOutlined style={{ fontSize: 38, color: 'white' }} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>سامانه ثبت تیکت مشتریان</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>مدیریت پروژه پارس</div>

        <PersianClock />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
          {[
            { icon: '🎫', title: 'ثبت تیکت آنلاین', desc: 'مشکلات و درخواست‌های خود را ثبت کنید' },
            { icon: '📊', title: 'پیگیری درخواست‌ها', desc: 'وضعیت تیکت‌های خود را دنبال کنید' },
            { icon: '💬', title: 'ارتباط مستقیم', desc: 'با کارشناسان ما در ارتباط باشید' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 18px', background: 'rgba(255,255,255,0.08)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{item.desc}</div>
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