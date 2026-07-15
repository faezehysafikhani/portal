import { useState } from 'react'
import { Card, Table, Button, Tag, Space, Input, Select, Modal, Form, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { SAMPLE_RISKS, getRiskLevelColor, USERS, SAMPLE_PROJECTS } from './ptmsData'
import type { Risk } from './ptmsData'

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>(SAMPLE_RISKS)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Risk | null>(null)
  const [form] = Form.useForm()

  const filtered = risks.filter(r => {
    const matchSearch = !search || r.title.includes(search)
    const matchProject = !filterProject || r.project === filterProject
    const matchLevel = !filterLevel || r.level === filterLevel
    return matchSearch && matchProject && matchLevel
  })

  const openModal = (item?: Risk) => {
    if (item) { setEditingItem(item); form.setFieldsValue(item) }
    else { setEditingItem(null); form.resetFields(); form.setFieldsValue({ probability: 3, impact: 3, status: 'شناسایی شده', strategy: 'کاهش' }) }
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(values => {
      const score = values.probability * values.impact
      const level = score >= 16 ? 'بحرانی' : score >= 10 ? 'بالا' : score >= 5 ? 'متوسط' : 'پایین'
      if (editingItem) {
        setRisks(prev => prev.map(r => r.id === editingItem.id ? { ...r, ...values, score, level } : r))
      } else {
        setRisks(prev => [...prev, { id: Date.now().toString(), code: `RSK-${String(risks.length + 1).padStart(3, '0')}`, identifiedDate: '۱۴۰۳/۰۴/۱۵', score, level, ...values }])
      }
      setModalOpen(false)
    })
  }

  const columns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="orange" style={{ fontFamily: 'monospace', fontSize: 11 }}>{c}</Tag> },
    { title: 'عنوان ریسک', dataIndex: 'title', key: 'title', render: (t: string, r: Risk) => <div><div style={{ fontWeight: 500 }}>{t}</div><div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.project}</div></div> },
    { title: 'دسته‌بندی', dataIndex: 'category', key: 'category', width: 100, render: (c: string) => <Tag>{c}</Tag> },
    {
      title: 'امتیاز', dataIndex: 'score', key: 'score', width: 90,
      render: (s: number, r: Risk) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: getRiskLevelColor(r.level) }}>{s}</div>
          <Tag style={{ fontSize: 9, color: getRiskLevelColor(r.level), borderColor: getRiskLevelColor(r.level), background: `${getRiskLevelColor(r.level)}11` }}>{r.level}</Tag>
        </div>
      )
    },
    { title: 'احتمال', dataIndex: 'probability', key: 'probability', width: 80, render: (p: number) => <Tag>{p}/5</Tag> },
    { title: 'شدت', dataIndex: 'impact', key: 'impact', width: 70, render: (i: number) => <Tag>{i}/5</Tag> },
    { title: 'استراتژی', dataIndex: 'strategy', key: 'strategy', width: 90, render: (s: string) => <Tag color="blue">{s}</Tag> },
    { title: 'مسئول', dataIndex: 'owner', key: 'owner', width: 110 },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 120, render: (s: string) => <Tag color={s === 'فعال' ? 'orange' : s === 'بسته شده' ? 'green' : s === 'رخ داده' ? 'red' : 'blue'}>{s}</Tag> },
    {
      title: 'عملیات', key: 'actions', width: 90,
      render: (_: unknown, r: Risk) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => setRisks(prev => prev.filter(x => x.id !== r.id))} />
        </Space>
      )
    },
  ]

  return (
    <div>
      {/* ماتریس ریسک */}
      <Card title="ماتریس ریسک (Heat Map)" style={{ marginBottom: 16 }} size="small">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', fontSize: 11, color: '#8c8c8c', paddingBottom: 20 }}>
            {[5, 4, 3, 2, 1].map(n => <div key={n} style={{ textAlign: 'center', width: 20 }}>{n}</div>)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginBottom: 4 }}>
              {[5, 4, 3, 2, 1].map(prob => (
                [1, 2, 3, 4, 5].map(impact => {
                  const score = prob * impact
                  const bg = score >= 16 ? '#ff4d4f33' : score >= 10 ? '#fa8c1633' : score >= 5 ? '#fadb1433' : '#52c41a33'
                  const border = score >= 16 ? '#ff4d4f' : score >= 10 ? '#fa8c16' : score >= 5 ? '#fadb14' : '#52c41a'
                  const cellRisks = risks.filter(r => r.probability === prob && r.impact === impact)
                  return (
                    <div key={`${prob}-${impact}`} style={{ background: bg, border: `1px solid ${border}55`, borderRadius: 4, padding: 4, minHeight: 44, textAlign: 'center' }}>
                      {cellRisks.map(r => <div key={r.id} style={{ background: border, color: 'white', borderRadius: 2, padding: '1px 3px', fontSize: 9, marginBottom: 1 }} title={r.title}>{r.code}</div>)}
                      <div style={{ fontSize: 9, color: '#8c8c8c' }}>{score}</div>
                    </div>
                  )
                })
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
              {[1, 2, 3, 4, 5].map(n => <div key={n} style={{ textAlign: 'center', fontSize: 11, color: '#8c8c8c' }}>{n}</div>)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, justifyContent: 'center' }}>
          <span><span style={{ color: '#52c41a' }}>●</span> پایین</span>
          <span><span style={{ color: '#fadb14' }}>●</span> متوسط</span>
          <span><span style={{ color: '#fa8c16' }}>●</span> بالا</span>
          <span><span style={{ color: '#ff4d4f' }}>●</span> بحرانی</span>
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input prefix={<SearchOutlined />} placeholder="جستجو..." style={{ width: 180 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
            <Select placeholder="پروژه" style={{ width: 180 }} value={filterProject || undefined} onChange={setFilterProject} allowClear>
              {SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}
            </Select>
            <Select placeholder="سطح ریسک" style={{ width: 130 }} value={filterLevel || undefined} onChange={setFilterLevel} allowClear>
              {['بحرانی', 'بالا', 'متوسط', 'پایین'].map(l => <Select.Option key={l} value={l}>{l}</Select.Option>)}
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>ریسک جدید</Button>
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" scroll={{ x: 1100 }} />
      </Card>

      <Modal title={editingItem ? 'ویرایش ریسک' : 'ریسک جدید'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={650} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="title" label="عنوان ریسک" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="دسته‌بندی" rules={[{ required: true }]}><Select>{['فنی', 'مالی', 'سازمانی', 'خارجی', 'زمانبندی', 'کیفیت'].map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="project" label="پروژه" rules={[{ required: true }]}><Select>{SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="owner" label="مسئول پاسخ" rules={[{ required: true }]}><Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={8}><Form.Item name="probability" label="احتمال (1-5)" rules={[{ required: true }]}><Select>{[1,2,3,4,5].map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={8}><Form.Item name="impact" label="شدت اثر (1-5)" rules={[{ required: true }]}><Select>{[1,2,3,4,5].map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={8}><Form.Item name="strategy" label="استراتژی پاسخ"><Select>{['اجتناب', 'کاهش', 'انتقال', 'پذیرش'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="وضعیت"><Select>{['شناسایی شده', 'فعال', 'بسته شده', 'رخ داده'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="actionDeadline" label="مهلت اقدام"><Input placeholder="۱۴۰۳/۰۵/۳۱" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="شرح ریسک"><Input.TextArea rows={2} /></Form.Item></Col>
            <Col span={24}><Form.Item name="response" label="شرح پاسخ"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}