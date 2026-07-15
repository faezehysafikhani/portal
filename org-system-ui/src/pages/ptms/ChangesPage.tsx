import { useState } from 'react'
import { Card, Table, Button, Tag, Space, Input, Select, Modal, Form, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { SAMPLE_CHANGES, getPriorityColor, USERS, SAMPLE_PROJECTS, formatCurrency } from './ptmsData'
import type { ChangeRequest } from './ptmsData'

export default function ChangesPage() {
  const [changes, setChanges] = useState<ChangeRequest[]>(SAMPLE_CHANGES)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ChangeRequest | null>(null)
  const [form] = Form.useForm()

  const filtered = changes.filter(c => {
    const matchSearch = !search || c.title.includes(search)
    const matchStatus = !filterStatus || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const openModal = (item?: ChangeRequest) => {
    if (item) { setEditingItem(item); form.setFieldsValue(item) }
    else { setEditingItem(null); form.resetFields(); form.setFieldsValue({ priority: 'متوسط', status: 'ثبت شده', requester: 'مدیر سیستم' }) }
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingItem) {
        setChanges(prev => prev.map(c => c.id === editingItem.id ? { ...c, ...values } : c))
      } else {
        setChanges(prev => [...prev, { id: Date.now().toString(), code: `CHG-${String(changes.length + 1).padStart(3, '0')}`, requestDate: '۱۴۰۳/۰۴/۱۵', ...values }])
      }
      setModalOpen(false)
    })
  }

  const columns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 11 }}>{c}</Tag> },
    { title: 'عنوان', dataIndex: 'title', key: 'title', render: (t: string, r: ChangeRequest) => <div><div style={{ fontWeight: 500 }}>{t}</div><div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.project}</div></div> },
    { title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 90, render: (p: string) => <Tag color={getPriorityColor(p as any) as string}>{p}</Tag> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 130, render: (s: string) => <Tag color={s === 'تأیید شده' ? 'green' : s === 'رد شده' ? 'red' : s === 'اجرا شده' ? 'blue' : 'orange'}>{s}</Tag> },
    { title: 'تأثیر زمانی', dataIndex: 'timeImpact', key: 'timeImpact', width: 110, render: (t: number) => <Tag color="orange">{t} روز</Tag> },
    { title: 'تأثیر مالی', dataIndex: 'costImpact', key: 'costImpact', width: 140, render: (c: number) => <span style={{ fontSize: 11 }}>{formatCurrency(c)}</span> },
    { title: 'درخواست‌دهنده', dataIndex: 'requester', key: 'requester', width: 120 },
    {
      title: 'عملیات', key: 'actions', width: 160,
      render: (_: unknown, r: ChangeRequest) => (
        <Space>
          {(r.status === 'ثبت شده' || r.status === 'در حال بررسی') && (
            <>
              <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }} onClick={() => setChanges(prev => prev.map(c => c.id === r.id ? { ...c, status: 'تأیید شده' as const } : c))} />
              <Button size="small" icon={<CloseCircleOutlined />} danger onClick={() => setChanges(prev => prev.map(c => c.id === r.id ? { ...c, status: 'رد شده' as const } : c))} />
            </>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => setChanges(prev => prev.filter(x => x.id !== r.id))} />
        </Space>
      )
    },
  ]

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'کل درخواست‌ها', value: changes.length, color: '#8B1A6B' },
          { label: 'در انتظار', value: changes.filter(c => c.status === 'ثبت شده' || c.status === 'در حال بررسی').length, color: '#fa8c16' },
          { label: 'تأیید شده', value: changes.filter(c => c.status === 'تأیید شده').length, color: '#52c41a' },
          { label: 'رد شده', value: changes.filter(c => c.status === 'رد شده').length, color: '#f5222d' },
        ].map((s, i) => (
          <Col xs={12} md={6} key={i}>
            <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Input prefix={<SearchOutlined />} placeholder="جستجو..." style={{ width: 180 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
            <Select placeholder="وضعیت" style={{ width: 150 }} value={filterStatus || undefined} onChange={setFilterStatus} allowClear>
              {['ثبت شده', 'در حال بررسی', 'تأیید شده', 'رد شده', 'اجرا شده'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>درخواست تغییر جدید</Button>
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" scroll={{ x: 1100 }} />
      </Card>

      <Modal title={editingItem ? 'ویرایش درخواست تغییر' : 'درخواست تغییر جدید'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={650} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="title" label="عنوان تغییر" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="priority" label="اولویت"><Select>{['بحرانی', 'بالا', 'متوسط', 'پایین'].map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="project" label="پروژه" rules={[{ required: true }]}><Select>{SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="approver" label="تأییدکننده"><Select allowClear>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="timeImpact" label="تأثیر زمانی (روز)"><Input type="number" /></Form.Item></Col>
            <Col span={12}><Form.Item name="costImpact" label="تأثیر مالی (ریال)"><Input type="number" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="شرح تغییر"><Input.TextArea rows={2} /></Form.Item></Col>
            <Col span={24}><Form.Item name="reason" label="دلیل تغییر"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}