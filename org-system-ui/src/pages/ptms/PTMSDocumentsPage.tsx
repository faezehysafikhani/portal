import { useState } from 'react'
import { Card, Table, Button, Tag, Space, Input, Select, Modal, Form, Row, Col, Upload, Typography, message } from 'antd'
import type { UploadFile } from 'antd'
import { PlusOutlined, SearchOutlined, DownloadOutlined, DeleteOutlined, UploadOutlined, FileTextOutlined, InboxOutlined } from '@ant-design/icons'
import { SAMPLE_DOCUMENTS, SAMPLE_PROJECTS } from './ptmsData'
import type { ProjectDoc } from './ptmsData'
import { currentJalali } from '../../utils/jalali'

export default function PTMSDocumentsPage() {
  const [documents, setDocuments] = useState<ProjectDoc[]>(SAMPLE_DOCUMENTS)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [form] = Form.useForm()

  const CATEGORIES = ['قرارداد', 'نقشه', 'مکاتبه', 'صورتجلسه', 'گزارش', 'سایر']

  const filtered = documents.filter(d => {
    const matchSearch = !search || d.title.includes(search)
    const matchCat = !filterCategory || d.category === filterCategory
    const matchProject = !filterProject || d.project === filterProject
    return matchSearch && matchCat && matchProject
  })

  const openNewDocument = () => {
    form.resetFields()
    setFileList([])
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    if (!fileList.length) { message.warning('فایل مستند را انتخاب کنید'); return }
    const today = currentJalali()
    const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })() as { fullName?: string }
    const bytes = Number(fileList[0].size || 0)
    setDocuments(prev => [...prev, {
      id: Date.now().toString(), version: values.version || '1.0', size: bytes ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : '—',
      uploader: currentUser.fullName || 'مدیر سیستم', uploadDate: `${today.year}/${String(today.month).padStart(2, '0')}/${String(today.day).padStart(2, '0')}`, tags: [], ...values,
    }])
    setModalOpen(false)
    setFileList([])
    form.resetFields()
    message.success('مستند با موفقیت ثبت شد')
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
            <Button type="primary" icon={<PlusOutlined />} onClick={openNewDocument} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>مستند جدید</Button>
          </Space>
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={<Space size={10}><span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: '#8b1a6b14', color: '#8B1A6B', fontSize: 18 }}><FileTextOutlined /></span><div><Typography.Text strong style={{ fontSize: 16 }}>ثبت مستند جدید</Typography.Text><div style={{ color: '#8c8c8c', fontSize: 11, marginTop: 2 }}>فایل را به پروژه مرتبط و در دسته مناسب ثبت کنید</div></div></Space>}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => { setModalOpen(false); setFileList([]) }}
        okText="ثبت مستند"
        cancelText="انصراف"
        width={660}
        centered
        maskClosable={false}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B', minWidth: 105 } }}
        styles={{ header: { paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }, body: { maxHeight: 'calc(100vh - 230px)', overflowY: 'auto', paddingInline: 2 }, footer: { paddingTop: 12, borderTop: '1px solid #f0f0f0' } }}
      >
        <Form form={form} layout="vertical" style={{ paddingTop: 10 }}>
          <div style={{ padding: '12px 14px 2px', borderRadius: 12, background: '#fffafd', border: '1px solid #f0e5ed', marginBottom: 14 }}>
            <Form.Item name="title" label="عنوان مستند" rules={[{ required: true, message: 'عنوان مستند را وارد کنید' }, { max: 180 }]}><Input maxLength={180} placeholder="عنوان روشن و قابل جستجوی مستند" prefix={<FileTextOutlined style={{ color: '#bfbfbf' }} />} /></Form.Item>
            <Row gutter={12}>
              <Col xs={24} md={10}><Form.Item name="category" label="دسته‌بندی" rules={[{ required: true, message: 'دسته‌بندی را انتخاب کنید' }]}><Select placeholder="انتخاب دسته">{CATEGORIES.map(c => <Select.Option key={c} value={c}>{getFileIcon(c)} {c}</Select.Option>)}</Select></Form.Item></Col>
              <Col xs={24} md={10}><Form.Item name="project" label="پروژه مرتبط" rules={[{ required: true, message: 'پروژه مرتبط را انتخاب کنید' }]}><Select showSearch optionFilterProp="label" placeholder="انتخاب پروژه" options={SAMPLE_PROJECTS.map(p => ({ value: p.name, label: `${p.code} — ${p.name}` }))} /></Form.Item></Col>
              <Col xs={24} md={4}><Form.Item name="version" label="نسخه" initialValue="1.0"><Input maxLength={12} placeholder="1.0" /></Form.Item></Col>
            </Row>
          </div>
          <Form.Item label="فایل مستند" required>
            <Upload.Dragger
              beforeUpload={() => false}
              maxCount={1}
              fileList={fileList}
              onChange={({ fileList: next }) => setFileList(next.slice(-1))}
              style={{ padding: '6px 0', borderRadius: 12, background: fileList.length ? '#f6ffed' : '#fafafa' }}
            >
              <p style={{ margin: '2px 0 6px', color: fileList.length ? '#52c41a' : '#8B1A6B', fontSize: 25 }}>{fileList.length ? <InboxOutlined /> : <UploadOutlined />}</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{fileList.length ? 'فایل انتخاب شد' : 'فایل را اینجا رها کنید یا برای انتخاب کلیک کنید'}</p>
              <p style={{ margin: '4px 0 0', color: '#8c8c8c', fontSize: 11 }}>یک فایل برای هر مستند؛ نام و حجم فایل پس از انتخاب نمایش داده می‌شود</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="description" label="توضیحات تکمیلی"><Input.TextArea rows={2} maxLength={600} showCount placeholder="توضیح کوتاه درباره محتوای فایل یا کاربرد آن" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
