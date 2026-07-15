import { useState } from 'react'
import { Card, Table, Button, Tag, Space, Select, Row, Col, Modal, Form, Input, Progress } from 'antd'
import { PlusOutlined, DollarOutlined } from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { SAMPLE_PROJECTS, formatCurrency, SAMPLE_COSTS } from './ptmsData'
import type { Cost } from './ptmsData'

const CATEGORIES = ['نیروی انسانی', 'مواد', 'تجهیزات', 'پیمانکاری', 'سربار', 'سایر']

const evmData = [
  { month: 'فروردین', PV: 500000000, EV: 400000000, AC: 450000000 },
  { month: 'اردیبهشت', PV: 900000000, EV: 750000000, AC: 820000000 },
  { month: 'خرداد', PV: 1300000000, EV: 1100000000, AC: 1200000000 },
  { month: 'تیر', PV: 1800000000, EV: 1500000000, AC: 1650000000 },
]

export default function FinancialPage() {
  const [costs, setCosts] = useState<Cost[]>(SAMPLE_COSTS)
  const [filterProject, setFilterProject] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const filtered = costs.filter(c => {
    const matchProject = !filterProject || c.projectId === filterProject
    const matchCat = !filterCategory || c.category === filterCategory
    return matchProject && matchCat
  })

  const totalBudget = SAMPLE_PROJECTS.reduce((s, p) => s + p.budget, 0)
  const totalCost = SAMPLE_PROJECTS.reduce((s, p) => s + p.actualCost, 0)


  const handleSave = () => {
    form.validateFields().then(values => {
      setCosts(prev => [...prev, { id: Date.now().toString(), date: '۱۴۰۳/۰۴/۱۵', ...values }])
      setModalOpen(false)
      form.resetFields()
    })
  }

  const costByCategory = CATEGORIES.map(cat => ({
    name: cat,
    estimated: costs.filter(c => c.category === cat).reduce((s, c) => s + c.estimated, 0),
    actual: costs.filter(c => c.category === cat).reduce((s, c) => s + c.actual, 0),
  })).filter(c => c.estimated > 0 || c.actual > 0)

  const columns = [
    { title: 'پروژه', dataIndex: 'projectId', key: 'projectId', render: (id: string) => SAMPLE_PROJECTS.find(p => p.id === id)?.name || id },
    { title: 'شرح', dataIndex: 'description', key: 'description' },
    { title: 'دسته‌بندی', dataIndex: 'category', key: 'category', width: 120, render: (c: string) => <Tag>{c}</Tag> },
    { title: 'برآوردی', dataIndex: 'estimated', key: 'estimated', width: 140, render: (e: number) => <span style={{ fontSize: 11 }}>{formatCurrency(e)}</span> },
    { title: 'واقعی', dataIndex: 'actual', key: 'actual', width: 140, render: (a: number) => <span style={{ fontSize: 11, color: '#fa8c16' }}>{formatCurrency(a)}</span> },
    { title: 'تاریخ', dataIndex: 'date', key: 'date', width: 110, render: (d: string) => <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d}</span> },
    {
      title: 'عملیات', key: 'actions', width: 80,
      render: (_: unknown, r: Cost) => (
        <Button size="small" danger onClick={() => setCosts(prev => prev.filter(c => c.id !== r.id))}>حذف</Button>
      )
    },
  ]

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'کل بودجه مصوب', value: formatCurrency(totalBudget), color: '#1677ff', icon: <DollarOutlined /> },
          { label: 'کل هزینه واقعی', value: formatCurrency(totalCost), color: '#fa8c16', icon: <DollarOutlined /> },
          { label: 'انحراف کل', value: formatCurrency(totalBudget - totalCost), color: totalBudget > totalCost ? '#52c41a' : '#f5222d', icon: <DollarOutlined /> },
          { label: 'درصد مصرف', value: `${Math.round(totalCost / totalBudget * 100)}%`, color: '#8B1A6B', icon: <DollarOutlined /> },
        ].map((s, i) => (
          <Col xs={12} md={6} key={i}>
            <Card size="small" style={{ borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title="وضعیت مالی پروژه‌ها" size="small">
            {SAMPLE_PROJECTS.map(p => {
              const percent = Math.round(p.actualCost / p.budget * 100)
              return (
                <div key={p.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span style={{ color: percent > 80 ? '#f5222d' : '#8c8c8c' }}>{percent}% مصرف</span>
                  </div>
                  <Progress percent={percent} size="small" strokeColor={percent > 80 ? '#f5222d' : percent > 60 ? '#fa8c16' : '#52c41a'} />
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                    بودجه: {formatCurrency(p.budget)} | واقعی: {formatCurrency(p.actualCost)}
                  </div>
                </div>
              )
            })}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="منحنی S (EVM)" size="small">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evmData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v/1000000000).toFixed(1)}B`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                <Legend />
                <Line type="monotone" dataKey="PV" stroke="#1677ff" name="برنامه" strokeWidth={2} />
                <Line type="monotone" dataKey="EV" stroke="#52c41a" name="کسب شده" strokeWidth={2} />
                <Line type="monotone" dataKey="AC" stroke="#f5222d" name="واقعی" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {costByCategory.length > 0 && (
        <Card title="هزینه بر اساس دسته‌بندی" size="small" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costByCategory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
              <Legend />
              <Bar dataKey="estimated" fill="#1677ff" name="برآوردی" />
              <Bar dataKey="actual" fill="#fa8c16" name="واقعی" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Select placeholder="پروژه" style={{ width: 180 }} value={filterProject || undefined} onChange={setFilterProject} allowClear>
              {SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
            <Select placeholder="دسته‌بندی" style={{ width: 140 }} value={filterCategory || undefined} onChange={setFilterCategory} allowClear>
              {CATEGORIES.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true) }} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>هزینه جدید</Button>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 40 }}>هزینه‌ای ثبت نشده</div>
        ) : (
          <Table columns={columns} dataSource={filtered} rowKey="id" scroll={{ x: 900 }} />
        )}
      </Card>

      <Modal title="ثبت هزینه جدید" open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={550} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}><Form.Item name="projectId" label="پروژه" rules={[{ required: true }]}><Select>{SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="category" label="دسته‌بندی" rules={[{ required: true }]}><Select>{CATEGORIES.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="شرح هزینه" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="estimated" label="مبلغ برآوردی (ریال)"><Input type="number" /></Form.Item></Col>
            <Col span={12}><Form.Item name="actual" label="مبلغ واقعی (ریال)"><Input type="number" /></Form.Item></Col>
            <Col span={12}><Form.Item name="invoiceNumber" label="شماره فاکتور"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="wbsItem" label="آیتم WBS"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}