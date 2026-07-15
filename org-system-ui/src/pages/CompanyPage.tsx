import { useState } from 'react'
import { Card, Form, Input, Button, Upload, Table, Modal, Switch, Tag, Space, Row, Col, Divider, message } from 'antd'
import { PlusOutlined, EditOutlined, UploadOutlined, BankOutlined, PhoneOutlined, MailOutlined, GlobalOutlined } from '@ant-design/icons'
import { usePermissionStore } from '../store/permissionStore'

interface Company {
  id: string
  name: string
  logo?: string
  phone?: string
  email?: string
  address?: string
  website?: string
  nationalId?: string
  economicCode?: string
  isActive: boolean
  isMain: boolean
}

const INITIAL_COMPANIES: Company[] = [
  {
    id: '1', name: 'شرکت پارس PMI', phone: '021-12345678',
    email: 'info@parspmi.ir', address: 'تهران، خیابان ولیعصر',
    website: 'www.parspmi.ir', nationalId: '10100012345',
    economicCode: '411123456789', isActive: true, isMain: true
  }
]

export default function CompanyPage() {
  const { companyMode } = usePermissionStore()
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [form] = Form.useForm()

  const openModal = (company?: Company) => {
    if (company) { setEditingCompany(company); form.setFieldsValue(company) }
    else { setEditingCompany(null); form.resetFields() }
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingCompany) {
        setCompanies(prev => prev.map(c => c.id === editingCompany.id ? { ...c, ...values } : c))
      } else {
        if (companyMode === 'single' && companies.length >= 1) {
          message.error('در حالت تک شرکتی فقط یک شرکت مجاز است!')
          return
        }
        setCompanies(prev => [...prev, { id: Date.now().toString(), isActive: true, isMain: false, ...values }])
      }
      setModalOpen(false)
    })
  }

  const columns = [
    { title: 'نام شرکت', dataIndex: 'name', key: 'name',
      render: (name: string, r: Company) => (
        <Space>
          <BankOutlined />
          <div>
            <div style={{ fontWeight: 500 }}>{name}</div>
            {r.isMain && <Tag color="gold">شرکت اصلی</Tag>}
          </div>
        </Space>
      )
    },
    { title: 'تلفن', dataIndex: 'phone', key: 'phone', render: (p: string) => p ? <Space><PhoneOutlined />{p}</Space> : '-' },
    { title: 'ایمیل', dataIndex: 'email', key: 'email', render: (e: string) => e ? <Space><MailOutlined />{e}</Space> : '-' },
    { title: 'وب‌سایت', dataIndex: 'website', key: 'website', render: (w: string) => w ? <Space><GlobalOutlined />{w}</Space> : '-' },
    { title: 'وضعیت', dataIndex: 'isActive', key: 'isActive',
      render: (active: boolean, record: Company) => (
        <Switch checked={active} onChange={val => setCompanies(prev => prev.map(c => c.id === record.id ? { ...c, isActive: val } : c))} />
      )
    },
    { title: 'عملیات', key: 'actions',
      render: (_: unknown, record: Company) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>ویرایش</Button>
      )
    },
  ]

  const mainCompany = companies.find(c => c.isMain)

  return (
    <div>
      {/* اطلاعات شرکت اصلی */}
      {mainCompany && (
        <Card
          title="اطلاعات شرکت اصلی"
          extra={<Button icon={<EditOutlined />} onClick={() => openModal(mainCompany)}>ویرایش</Button>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={4} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 12, background: '#f0f0f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32
              }}>🏢</div>
            </Col>
            <Col xs={24} md={20}>
              <Row gutter={[16, 8]}>
                <Col xs={24} md={8}><strong>نام شرکت:</strong> {mainCompany.name}</Col>
                <Col xs={24} md={8}><strong>تلفن:</strong> {mainCompany.phone}</Col>
                <Col xs={24} md={8}><strong>ایمیل:</strong> {mainCompany.email}</Col>
                <Col xs={24} md={8}><strong>وب‌سایت:</strong> {mainCompany.website}</Col>
                <Col xs={24} md={8}><strong>شناسه ملی:</strong> {mainCompany.nationalId}</Col>
                <Col xs={24} md={8}><strong>کد اقتصادی:</strong> {mainCompany.economicCode}</Col>
                <Col xs={24}><strong>آدرس:</strong> {mainCompany.address}</Col>
              </Row>
            </Col>
          </Row>
        </Card>
      )}

      {/* لیست شرکت‌ها در حالت Multi */}
      {companyMode === 'multi' && (
        <Card title="لیست شرکت‌ها" extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>شرکت جدید</Button>
        }>
          <Table columns={columns} dataSource={companies} rowKey="id" />
        </Card>
      )}

      {companyMode === 'single' && (
        <Card style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
          <p>💡 برای افزودن چند شرکت، ابتدا از بخش <strong>تنظیمات → حالت شرکت</strong> را به <strong>چند شرکتی</strong> تغییر دهید.</p>
        </Card>
      )}

      <Modal
        title={editingCompany ? 'ویرایش شرکت' : 'شرکت جدید'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="ذخیره"
        cancelText="انصراف"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="name" label="نام شرکت" rules={[{ required: true }]}><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="تلفن"><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="ایمیل"><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="website" label="وب‌سایت"><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="nationalId" label="شناسه ملی"><Input /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="economicCode" label="کد اقتصادی"><Input /></Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="address" label="آدرس"><Input.TextArea rows={2} /></Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="logo" label="لوگو">
                <Upload listType="picture-card" maxCount={1}>
                  <div><UploadOutlined /><div>آپلود لوگو</div></div>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}