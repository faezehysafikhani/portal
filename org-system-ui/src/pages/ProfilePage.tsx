import { useEffect, useState } from 'react'
import { Avatar, Button, Card, Col, Form, Input, message, Row, Space, Tabs, Tag, Upload } from 'antd'
import { EditOutlined, LockOutlined, SaveOutlined, UploadOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { apiFetch } from '../utils/api'
import TwoFactorSettings from '../components/TwoFactorSettings'

const API = 'http://localhost:5043/api/v1'
const codePattern = /<[^>]*>|javascript\s*:|--|\/\*|\*\/|;\s*(select|insert|update|delete|drop|alter|exec)|\bunion\s+select/i
const digits = (value = '') => value.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g, '')
const safeRule = { validator: (_: unknown, value?: string) => !value || !codePattern.test(value) ? Promise.resolve() : Promise.reject(new Error('ورود کد HTML، JavaScript یا SQL مجاز نیست')) }
const nameRule = { pattern: /^[\p{L}\p{M}\s\u200c-]+$/u, message: 'این فیلد فقط باید شامل حروف باشد' }

type Profile = {
  username?: string; fullName?: string; email?: string; phoneNumber?: string; fixedPhone?: string
  address?: string; department?: string; position?: string; avatarUrl?: string
  signatureDataUrl?: string; signatureText?: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>({})
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [personalForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [signatureForm] = Form.useForm()

  const syncLocalUser = (data: Profile) => {
    const previous = JSON.parse(localStorage.getItem('user') || '{}')
    const next = { ...previous, ...data }
    localStorage.setItem('user', JSON.stringify(next))
    window.dispatchEvent(new Event('profile-updated'))
  }

  const load = async () => {
    const response = await apiFetch(`${API}/profile`)
    if (!response.ok) return message.error('خطا در دریافت اطلاعات پروفایل')
    const data = await response.json()
    setProfile(data)
    personalForm.setFieldsValue({ ...data, mobile: data.phoneNumber, phone: data.fixedPhone, nationalCode: data.username })
    signatureForm.setFieldsValue({ text: data.signatureText })
  }
  useEffect(() => { load() }, [])

  const readImage = (file: File, done: (dataUrl: string) => void) => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) { message.error('فقط تصویر PNG یا JPEG مجاز است'); return false }
    if (file.size > 500 * 1024) { message.error('حجم تصویر باید حداکثر ۵۰۰ کیلوبایت باشد'); return false }
    const reader = new FileReader(); reader.onload = () => done(String(reader.result)); reader.readAsDataURL(file)
    return false
  }

  const uploadAvatar = (file: File) => readImage(file, async imageData => {
    setLoading(true)
    const response = await apiFetch(`${API}/profile/avatar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData }) })
    const data = await response.json().catch(() => ({})); setLoading(false)
    if (!response.ok) return message.error(data.message || 'ذخیره عکس انجام نشد')
    const next = { ...profile, avatarUrl: data.avatarUrl }; setProfile(next); syncLocalUser(next); message.success('عکس پروفایل ذخیره شد')
  })

  const saveProfile = async () => {
    const values = await personalForm.validateFields(); setLoading(true)
    const response = await apiFetch(`${API}/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      fullName: values.fullName, email: values.email, phoneNumber: values.mobile, fixedPhone: values.phone,
      department: values.department, position: values.position, address: values.address
    }) })
    const data = await response.json().catch(() => ({})); setLoading(false)
    if (!response.ok) return message.error(data.message || 'ذخیره اطلاعات انجام نشد')
    setProfile(data); syncLocalUser(data); setEditing(false); message.success('اطلاعات پروفایل ذخیره شد')
  }

  const changePassword = async () => {
    const values = await passwordForm.validateFields(); setLoading(true)
    const response = await apiFetch(`${API}/auth/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
    const data = await response.json().catch(() => ({})); setLoading(false)
    if (!response.ok) return message.error(data.message || 'تغییر رمز عبور انجام نشد')
    passwordForm.resetFields(); message.success('رمز عبور تغییر کرد')
  }

  const saveSignature = async (imageData?: string) => {
    const text = signatureForm.getFieldValue('text')
    if (text && codePattern.test(text)) return message.error('ورود کد در متن امضا مجاز نیست')
    setLoading(true)
    const response = await apiFetch(`${API}/profile/signature`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData, text }) })
    const data = await response.json().catch(() => ({})); setLoading(false)
    if (!response.ok) return message.error(data.message || 'ذخیره امضا انجام نشد')
    setProfile(data); syncLocalUser(data); message.success('امضا ذخیره شد')
  }

  const personal = <div>
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <Avatar size={112} src={profile.avatarUrl} icon={<UserOutlined />} style={{ background: '#8b1a6b', border: '4px solid #f5e8f1' }} />
        <Upload accept="image/png,image/jpeg" showUploadList={false} beforeUpload={uploadAvatar}>
          <Button loading={loading} shape="circle" icon={<UploadOutlined />} style={{ position: 'absolute', bottom: 2, left: -4 }} />
        </Upload>
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, marginTop: 10 }}>{profile.fullName}</div>
      <Tag color="magenta">{profile.position || 'کاربر سامانه'}</Tag>
    </div>
    <Form form={personalForm} layout="vertical">
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item name="fullName" label="نام و نام خانوادگی" rules={[{ required: true, min: 2, max: 150 }, nameRule]}><Input disabled={!editing} maxLength={150} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="nationalCode" label="نام کاربری / کد ملی"><Input disabled maxLength={10} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="email" label="ایمیل" rules={[{ type: 'email' }, safeRule]}><Input disabled={!editing} maxLength={150} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="mobile" label="موبایل" rules={[{ pattern: /^\d{10,15}$/, message: 'موبایل باید فقط ۱۰ تا ۱۵ رقم باشد' }]}><Input disabled={!editing} maxLength={15} inputMode="numeric" onChange={e => personalForm.setFieldValue('mobile', digits(e.target.value))} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="phone" label="تلفن ثابت" rules={[{ pattern: /^\d{7,15}$/, message: 'تلفن باید فقط ۷ تا ۱۵ رقم باشد' }]}><Input disabled={!editing} maxLength={15} inputMode="numeric" onChange={e => personalForm.setFieldValue('phone', digits(e.target.value))} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="department" label="واحد سازمانی" rules={[nameRule]}><Input disabled={!editing} maxLength={100} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="position" label="سمت" rules={[nameRule]}><Input disabled={!editing} maxLength={100} /></Form.Item></Col>
        <Col span={24}><Form.Item name="address" label="آدرس" rules={[safeRule]}><Input.TextArea disabled={!editing} rows={3} maxLength={500} showCount /></Form.Item></Col>
      </Row>
      {!editing ? <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>ویرایش اطلاعات</Button> : <Space>
        <Button type="primary" loading={loading} icon={<SaveOutlined />} onClick={saveProfile}>ذخیره</Button>
        <Button onClick={() => { setEditing(false); personalForm.setFieldsValue({ ...profile, mobile: profile.phoneNumber, phone: profile.fixedPhone, nationalCode: profile.username }) }}>انصراف</Button>
      </Space>}
    </Form>
  </div>

  const password = <Form form={passwordForm} layout="vertical" style={{ maxWidth: 480 }} onFinish={changePassword}>
    <Form.Item name="currentPassword" label="رمز عبور فعلی" rules={[{ required: true }]}><Input.Password maxLength={128} /></Form.Item>
    <Form.Item name="newPassword" label="رمز عبور جدید" rules={[{ required: true, min: 8, max: 128 }]}><Input.Password /></Form.Item>
    <Form.Item name="confirmPassword" label="تکرار رمز عبور" dependencies={['newPassword']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return !value || value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('تکرار رمز عبور یکسان نیست')) } })]}><Input.Password /></Form.Item>
    <Button type="primary" htmlType="submit" loading={loading}>تغییر رمز عبور</Button>
  </Form>

  const signature = <Row gutter={20}>
    <Col xs={24} md={10}><Card size="small" title="تصویر امضا" style={{ height: '100%' }}>
      {profile.signatureDataUrl && <img src={profile.signatureDataUrl} alt="امضا" style={{ maxWidth: '100%', height: 110, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />}
      <Upload accept="image/png,image/jpeg" showUploadList={false} beforeUpload={file => readImage(file, data => saveSignature(data))}><Button block icon={<UploadOutlined />}>انتخاب و ذخیره تصویر امضا</Button></Upload>
    </Card></Col>
    <Col xs={24} md={14}><Card size="small" title="متن امضا"><Form form={signatureForm} layout="vertical"><Form.Item name="text" rules={[safeRule]}><Input.TextArea rows={4} maxLength={500} showCount placeholder="متن اختیاری زیر امضا" /></Form.Item><Button type="primary" loading={loading} onClick={() => saveSignature()}>ذخیره متن امضا</Button></Form></Card></Col>
  </Row>

  return <Card style={{ borderRadius: 16 }}><Tabs items={[
    { key: 'profile', label: <span><UserOutlined /> اطلاعات شخصی</span>, children: personal },
    { key: 'password', label: <span><LockOutlined /> رمز عبور</span>, children: password },
    { key: 'mfa', label: <span><SafetyCertificateOutlined /> احراز هویت دو مرحله‌ای</span>, children: <TwoFactorSettings /> },
    { key: 'signature', label: '✍️ امضا', children: signature }
  ]} /></Card>
}
