import { useState } from 'react'
import { Card, Table, Button, Tag, Progress, Space, Modal, Form, Input, Select, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons'
import { SAMPLE_PORTFOLIOS, formatCurrency, USERS } from './ptmsData'
import type { Portfolio } from './ptmsData'

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>(SAMPLE_PORTFOLIOS)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Portfolio | null>(null)
  const [form] = Form.useForm()

  const openModal = (item?: Portfolio) => {
    if (item) { setEditingItem(item); form.setFieldsValue(item) }
    else { setEditingItem(null); form.resetFields(); form.setFieldsValue({ status: 'فعال' }) }
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingItem) {
        setPortfolios(prev => prev.map(p => p.id === editingItem.id ? { ...p, ...values } : p))
      } else {
        setPortfolios(prev => [...prev, {
          id: Date.now().toString(),
          code: `PF-${String(portfolios.length + 1).padStart(3, '0')}`,
          projectCount: 0, progress: 0, ...values
        }])
      }
      setModalOpen(false)
    })
  }

  const columns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 120, render: (c: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{c}</Tag> },
    { title: 'نام سبد', dataIndex: 'name', key: 'name', render: (n: string) => <Space><FolderOutlined style={{ color: '#8B1A6B' }} /><span style={{ fontWeight: 500 }}>{n}</span></Space> },
    { title: 'مدیر سبد', dataIndex: 'manager', key: 'manager', width: 130 },
    { title: 'تعداد پروژه', dataIndex: 'projectCount', key: 'projectCount', width: 110, render: (c: number) => <Tag color="blue">{c} پروژه</Tag> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Tag color={s === 'فعال' ? 'green' : s === 'آرشیو' ? 'default' : 'red'}>{s}</Tag> },
    { title: 'بودجه کل', dataIndex: 'budget', key: 'budget', width: 160, render: (b: number) => <span style={{ fontSize: 12 }}>{formatCurrency(b)}</span> },
    { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', width: 150, render: (p: number) => <Progress percent={p} size="small" strokeColor="#8B1A6B" /> },
    {
      title: 'عملیات', key: 'actions', width: 100,
      render: (_: unknown, r: Portfolio) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => setPortfolios(prev => prev.filter(p => p.id !== r.id))} />
        </Space>
      )
    },
  ]

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'کل سبدها', value: portfolios.length, color: '#8B1A6B' },
          { label: 'فعال', value: portfolios.filter(p => p.status === 'فعال').length, color: '#52c41a' },
          { label: 'کل پروژه‌ها', value: portfolios.reduce((s, p) => s + p.projectCount, 0), color: '#1677ff' },
        ].map((s, i) => (
          <Col xs={8} key={i}>
            <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>سبد جدید</Button>}>
        <Table columns={columns} dataSource={portfolios} rowKey="id" scroll={{ x: 900 }} />
      </Card>

      <Modal title={editingItem ? 'ویرایش سبد' : 'سبد جدید'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={600} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="name" label="نام سبد پروژه" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="وضعیت"><Select>{['فعال', 'غیرفعال', 'آرشیو'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="manager" label="مدیر سبد" rules={[{ required: true }]}><Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="budget" label="بودجه کل (ریال)"><Input type="number" /></Form.Item></Col>
            <Col span={12}><Form.Item name="startDate" label="تاریخ شروع"><Input placeholder="۱۴۰۳/۰۱/۰۱" /></Form.Item></Col>
            <Col span={12}><Form.Item name="endDate" label="تاریخ پایان"><Input placeholder="۱۴۰۳/۱۲/۲۹" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="توضیحات"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}