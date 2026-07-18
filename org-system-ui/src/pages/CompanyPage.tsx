import { useEffect, useState } from 'react'
import { Card, Form, Input, Button, Upload, Modal, Row, Col, message, Spin } from 'antd'
import { EditOutlined, UploadOutlined } from '@ant-design/icons'

const API = 'http://localhost:5043/api/v1'
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

interface Company {
  id: string
  name: string
  logoUrl?: string | null
  phone?: string
  email?: string
  address?: string
  website?: string
  nationalId?: string
  economicCode?: string
  isActive: boolean
}

export default function CompanyPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [form] = Form.useForm()
  const signedInUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
  const permissions: string[] = (() => { try { return JSON.parse(localStorage.getItem('permissions') || '[]') } catch { return [] } })()
  const canEdit = (Array.isArray(signedInUser.roles) && signedInUser.roles.includes('Admin')) || permissions.includes('company.edit')

  const loadCompany = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API}/company`, { headers: headers() })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'دریافت اطلاعات شرکت ناموفق بود')
      setCompany(data)
      setLogoPreview(data.logoUrl || null)
      localStorage.setItem('company', JSON.stringify(data))
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'دریافت اطلاعات شرکت ناموفق بود')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadCompany() }, [])

  const openModal = () => {
    if (!company) return
    form.setFieldsValue(company)
    setLogoPreview(company.logoUrl || null)
    setModalOpen(true)
  }

  const selectLogo = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      message.error('فرمت لوگو باید PNG، JPG، WEBP یا GIF باشد')
      return Upload.LIST_IGNORE
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('حجم لوگو حداکثر باید ۲ مگابایت باشد')
      return Upload.LIST_IGNORE
    }
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result)
      setLogoPreview(value)
      form.setFieldValue('logoUrl', value)
    }
    reader.readAsDataURL(file)
    return false
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const response = await fetch(`${API}/company`, { method: 'PUT', headers: headers(), body: JSON.stringify(values) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'ذخیره اطلاعات شرکت ناموفق بود')
      setCompany(data)
      setLogoPreview(data.logoUrl || null)
      localStorage.setItem('company', JSON.stringify(data))
      window.dispatchEvent(new CustomEvent('company-updated', { detail: data }))
      setModalOpen(false)
      message.success('اطلاعات و لوگوی شرکت ذخیره شد')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ذخیره اطلاعات شرکت ناموفق بود')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', minHeight: 300 }}><Spin size="large" /></div>
  if (!company) return <Card>اطلاعات شرکت یافت نشد.</Card>

  return (
    <div>
      <Card title="اطلاعات شرکت اصلی" extra={canEdit && <Button icon={<EditOutlined />} onClick={openModal}>ویرایش</Button>}>
        <Row gutter={[20, 20]} align="middle">
          <Col xs={24} md={5} style={{ textAlign: 'center' }}>
            {company.logoUrl
              ? <img src={company.logoUrl} alt={`لوگوی ${company.name}`} style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 12, border: '1px solid #eee', padding: 8 }} />
              : <div style={{ width: 120, height: 120, margin: 'auto', display: 'grid', placeItems: 'center', background: '#f5f5f5', borderRadius: 12, fontSize: 42 }}>🏢</div>}
          </Col>
          <Col xs={24} md={19}>
            <Row gutter={[16, 12]}>
              <Col xs={24} md={8}><strong>نام شرکت:</strong> {company.name}</Col>
              <Col xs={24} md={8}><strong>تلفن:</strong> {company.phone || '—'}</Col>
              <Col xs={24} md={8}><strong>ایمیل:</strong> {company.email || '—'}</Col>
              <Col xs={24} md={8}><strong>وب‌سایت:</strong> {company.website || '—'}</Col>
              <Col xs={24} md={8}><strong>شناسه ملی:</strong> {company.nationalId || '—'}</Col>
              <Col xs={24} md={8}><strong>کد اقتصادی:</strong> {company.economicCode || '—'}</Col>
              <Col span={24}><strong>آدرس:</strong> {company.address || '—'}</Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Modal title="ویرایش اطلاعات شرکت" open={modalOpen} onOk={handleSave} confirmLoading={saving} onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={680}>
        <Form form={form} layout="vertical">
          <Form.Item name="logoUrl" hidden><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={24}><Form.Item name="name" label="نام شرکت" rules={[{ required: true, message: 'نام شرکت الزامی است' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="phone" label="تلفن"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="email" label="ایمیل" rules={[{ type: 'email', message: 'ایمیل معتبر نیست' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="website" label="وب‌سایت"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="nationalId" label="شناسه ملی"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="economicCode" label="کد اقتصادی"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="address" label="آدرس"><Input.TextArea rows={2} /></Form.Item></Col>
            <Col span={24}>
              <Form.Item label="لوگوی شرکت" extra="فرمت‌های PNG، JPG، WEBP یا GIF؛ حداکثر ۲ مگابایت">
                <Upload accept="image/png,image/jpeg,image/webp,image/gif" showUploadList={false} beforeUpload={selectLogo}>
                  <Button icon={<UploadOutlined />}>انتخاب لوگو</Button>
                </Upload>
                {logoPreview && <div style={{ marginTop: 12 }}><img src={logoPreview} alt="پیش‌نمایش لوگو" style={{ width: 100, height: 100, objectFit: 'contain', border: '1px solid #eee', borderRadius: 8, padding: 6 }} /></div>}
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
