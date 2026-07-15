import { useState } from 'react'
import { Card, Table, Button, Tag, Space, Input, Select, Modal, Form, Row, Col, Upload } from 'antd'
import { PlusOutlined, SearchOutlined, DownloadOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { SAMPLE_DOCUMENTS, SAMPLE_PROJECTS } from './ptmsData'
import type { ProjectDoc } from './ptmsData'

export default function PTMSDocumentsPage() {
  const [documents, setDocuments] = useState<ProjectDoc[]>(SAMPLE_DOCUMENTS)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const CATEGORIES = ['قرارداد', 'نقشه', 'مکاتبه', 'صورتجلسه', 'گزارش', 'سایر']

  const filtered = documents.filter(d => {
    const matchSearch = !search || d.title.includes(search)
    const matchCat = !filterCategory || d.category === filterCategory
    const matchProject = !filterProject || d.project === filterProject
    return matchSearch && matchCat && matchProject
  })

  const handleSave = () => {
    form.validateFields().then(values => {
      setDocuments(prev => [...prev, {
        id: Date.now().toString(), version: '1.0', size: '—',
        uploader: 'مدیر سیستم', uploadDate: '۱۴۰۳/۰۴/۱۵', tags: [], ...values
      }])
      setModalOpen(false)
      form.resetFields()
    })
  }

  const getCategoryColor = (c: string) => {
    switch(c) {
      case 'قرارداد': return 'red'
      case 'نقشه': return 'blue'
      case 'گزارش': return 'green'
      case 'صورتجلسه': return 'orange'
      case 'مکاتبه': return 'purple'
      default: return 'default'
    }
  }

  const getFileIcon = (cat: string) => {
    switch(cat) {
      case 'نقشه': return '🗺️'
      case 'قرارداد': return '📋'
      case 'گزارش': return '📊'
      case 'صورتجلسه': return '📝'
      default: return '📄'
    }
  }

  const columns = [
    {
      title: 'نام مستند', dataIndex: 'title', key: 'title',
      render: (t: string, r: ProjectDoc) => (
        <Space>
          <span style={{ fontSize: 18 }}>{getFileIcon(r.category)}</span>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{t}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.project || '—'}</div>
          </div>
        </Space>
      )
    },
    { title: 'دسته‌بندی', dataIndex: 'category', key: 'category', width: 100, render: (c: string) => <Tag color={getCategoryColor(c)}>{c}</Tag> },
    { title: 'نسخه', dataIndex: 'version', key: 'version', width: 80, render: (v: string) => <Tag color="blue">v{v}</Tag> },
    { title: 'حجم', dataIndex: 'size', key: 'size', width: 90, render: (s: string) => <span style={{ fontSize: 12, color: '#8c8c8c' }}>{s}</span> },
    { title: 'آپلودکننده', dataIndex: 'uploader', key: 'uploader', width: 120 },
    { title: 'تاریخ آپلود', dataIndex: 'uploadDate', key: 'uploadDate', width: 120, render: (d: string) => <span style={{ fontSize: 12, color: '#8c8c8c' }}>{d}</span> },
    {
      title: 'عملیات', key: 'actions', width: 100,
      render: (_: unknown, r: ProjectDoc) => (
        <Space>
          <Button size="small" icon={<DownloadOutlined />} type="primary" ghost />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => setDocuments(prev => prev.filter(d => d.id !== r.id))} />
        </Space>
      )
    },
  ]

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {CATEGORIES.map(cat => (
          <Col key={cat} xs={8} md={4}>
            <Card size="small" style={{ textAlign: 'center', cursor: 'pointer', borderTop: `3px solid ${getCategoryColor(cat) === 'default' ? '#d9d9d9' : getCategoryColor(cat)}` }} onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}>
              <div style={{ fontSize: 18 }}>{getFileIcon(cat)}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{documents.filter(d => d.category === cat).length}</div>
              <div style={{ fontSize: 10, color: '#8c8c8c' }}>{cat}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input prefix={<SearchOutlined />} placeholder="جستجو..." style={{ width: 180 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
            <Select placeholder="دسته‌بندی" style={{ width: 130 }} value={filterCategory || undefined} onChange={setFilterCategory} allowClear>
              {CATEGORIES.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
            </Select>
            <Select placeholder="پروژه" style={{ width: 180 }} value={filterProject || undefined} onChange={setFilterProject} allowClear>
              {SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}
            </Select>
          </Space>
          <Space>
            <Upload beforeUpload={() => false} showUploadList={false}>
              <Button icon={<UploadOutlined />}>آپلود سریع</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true) }} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>مستند جدید</Button>
          </Space>
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="مستند جدید" open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} okText="ذخیره" cancelText="انصراف" width={550} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="عنوان مستند" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="category" label="دسته‌بندی" rules={[{ required: true }]}><Select>{CATEGORIES.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="project" label="پروژه مرتبط"><Select allowClear>{SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
          </Row>
          <Form.Item label="فایل">
            <Upload.Dragger beforeUpload={() => false} showUploadList={false}>
              <p><UploadOutlined /></p>
              <p>فایل را اینجا رها کنید یا کلیک کنید</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="description" label="توضیحات"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}