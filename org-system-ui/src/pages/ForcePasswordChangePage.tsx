import { useState } from 'react'
import { Form, Input, Button, Alert } from 'antd'
import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'

export default function ForcePasswordChangePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()

  const submit = async (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('http://localhost:5043/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { setError(data.message || 'تغییر رمز عبور انجام نشد'); return }
      localStorage.removeItem('force-password-change')
      window.location.assign('/dashboard')
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  const signOut = () => { localStorage.clear(); window.location.assign('/login') }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', direction: 'rtl',
      background: 'linear-gradient(135deg, #1a0533 0%, #3D0A2E 40%, #8B1A6B 100%)', padding: 24,
    }}>
      <div className="login-card" style={{
        width: '100%', maxWidth: 460, background: 'white', borderRadius: 20,
        padding: 36, boxShadow: '0 24px 70px rgba(0,0,0,0.45)', overflow: 'hidden',
      }}>
        <div style={{ height: 4, margin: '-36px -36px 28px', background: 'linear-gradient(90deg, #8B1A6B, #E91E8C, #8B1A6B)' }} />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #8B1A6B, #A83585)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <SafetyCertificateOutlined style={{ fontSize: 28, color: 'white' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>تعیین رمز عبور جدید</div>
          <div style={{ fontSize: 13, color: '#8c8c8c', marginTop: 6 }}>
            {user.fullName ? `${user.fullName} عزیز، ` : ''}مدت اعتبار رمز عبور شما به پایان رسیده است
          </div>
        </div>

        <Alert type="warning" showIcon style={{ marginBottom: 18 }}
          message="برای ادامه باید رمز عبور خود را تغییر دهید"
          description="تا زمانی که رمز جدید ثبت نشود، دسترسی به سامانه امکان‌پذیر نیست." />

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={submit}>
          <Form.Item name="currentPassword" label="رمز عبور فعلی" rules={[{ required: true, message: 'رمز عبور فعلی الزامی است' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#8B1A6B' }} />} placeholder="رمز فعلی" size="large" style={{ height: 48 }} />
          </Form.Item>
          <Form.Item name="newPassword" label="رمز عبور جدید" rules={[{ required: true, message: 'رمز جدید الزامی است' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#8B1A6B' }} />} placeholder="رمز جدید" size="large" style={{ height: 48 }} />
          </Form.Item>
          <Form.Item name="confirmPassword" label="تکرار رمز عبور جدید" dependencies={['newPassword']}
            rules={[
              { required: true, message: 'تکرار رمز الزامی است' },
              ({ getFieldValue }) => ({
                validator: (_, value) => !value || getFieldValue('newPassword') === value
                  ? Promise.resolve() : Promise.reject(new Error('رمز جدید و تکرار آن یکسان نیستند')),
              }),
            ]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#8B1A6B' }} />} placeholder="تکرار رمز جدید" size="large" style={{ height: 48 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}
            style={{ background: 'linear-gradient(135deg, #8B1A6B, #A83585)', border: 'none', borderRadius: 12, height: 50, fontWeight: 700, fontSize: 15, marginTop: 4 }}>
            ثبت رمز جدید و ورود
          </Button>
          <Button type="link" block onClick={signOut} style={{ marginTop: 10, color: '#8c8c8c' }}>خروج از حساب</Button>
        </Form>
      </div>
    </div>
  )
}
