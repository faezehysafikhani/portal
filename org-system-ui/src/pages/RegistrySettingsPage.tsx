import { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Switch, Row, Col, Divider, InputNumber, Tabs, Checkbox } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, FolderOutlined } from '@ant-design/icons'

interface LetterTypeAccess {
  view: 'همه نامه‌های سازمان' | 'پیش‌نویس‌های خود' | 'ندارد'
  register: boolean
  edit: boolean
  bodyRequired: boolean
  bodyAdd: boolean
  bodyEdit: boolean
  bodyDelete: boolean
  attachAdd: boolean
  attachDelete: boolean
  relatedAdd: boolean
  relatedDelete: boolean
}

interface Registry {
  id: string
  name: string
  prefix: string
  separator: string
  includeYear: boolean
  includeMonth: boolean
  currentNumber: number
  padLength: number
  example: string
  isActive: boolean
  description?: string
  unitAccess?: string[]
  userAccess?: string[]
  internalAccess: LetterTypeAccess
  outgoingAccess: LetterTypeAccess
  incomingAccess: LetterTypeAccess
}

interface Folder {
  id: string
  code: string
  title: string
  description?: string
  access: string[]
  userAccess: string[]
  status: 'فعال' | 'غیرفعال'
}

const UNITS = ['دبیرخانه مرکزی', 'دبیرخانه واردات', 'دبیرخانه صادرات', 'واحد مالی', 'واحد فنی', 'واحد اداری']
const USERS = ['مدیر سیستم', 'علی محمدی', 'مریم احمدی', 'رضا کریمی', 'سارا نوری', 'امیر حسینی']
const FOLDER_ACCESS = ['افزودن پرونده', 'ویرایش پرونده', 'انتقال پرونده', 'دسترسی پرونده']

const DEFAULT_ACCESS: LetterTypeAccess = {
  view: 'همه نامه‌های سازمان',
  register: true, edit: true, bodyRequired: true,
  bodyAdd: true, bodyEdit: true, bodyDelete: true,
  attachAdd: true, attachDelete: true,
  relatedAdd: true, relatedDelete: true,
}

const INITIAL_REGISTRIES: Registry[] = [
  {
    id: '1', name: 'دبیرخانه مرکزی',
    prefix: 'د', separator: '/', includeYear: true, includeMonth: false,
    currentNumber: 152, padLength: 4, example: 'د/۱۴۰۳/۰۱۵۲', isActive: true,
    description: 'دبیرخانه اصلی سازمان',
    unitAccess: ['دبیرخانه مرکزی'], userAccess: ['مدیر سیستم', 'علی محمدی'],
    internalAccess: { ...DEFAULT_ACCESS },
    outgoingAccess: { ...DEFAULT_ACCESS },
    incomingAccess: { ...DEFAULT_ACCESS },
  },
  {
    id: '2', name: 'دبیرخانه واردات',
    prefix: 'و', separator: '/', includeYear: true, includeMonth: false,
    currentNumber: 48, padLength: 4, example: 'و/۱۴۰۳/۰۰۴۸', isActive: true,
    description: 'نامه‌های ورودی از خارج سازمان',
    unitAccess: ['دبیرخانه مرکزی'], userAccess: ['مدیر سیستم'],
    internalAccess: { ...DEFAULT_ACCESS },
    outgoingAccess: { ...DEFAULT_ACCESS },
    incomingAccess: { ...DEFAULT_ACCESS },
  },
  {
    id: '3', name: 'دبیرخانه صادرات',
    prefix: 'ص', separator: '/', includeYear: true, includeMonth: false,
    currentNumber: 95, padLength: 4, example: 'ص/۱۴۰۳/۰۰۹۵', isActive: true,
    description: 'نامه‌های خروجی به خارج سازمان',
    unitAccess: ['دبیرخانه مرکزی'], userAccess: ['مدیر سیستم'],
    internalAccess: { ...DEFAULT_ACCESS },
    outgoingAccess: { ...DEFAULT_ACCESS },
    incomingAccess: { ...DEFAULT_ACCESS },
  },
]

const INITIAL_FOLDERS: Folder[] = [
  { id: '1', code: 'PRJ-001', title: 'پرونده سامانه یکپارچه', description: 'مکاتبات پروژه سامانه', access: ['افزودن پرونده', 'ویرایش پرونده'], userAccess: ['مدیر سیستم', 'علی محمدی'], status: 'فعال' },
  { id: '2', code: 'PRJ-002', title: 'پرونده قراردادها', description: 'مکاتبات قراردادی', access: ['افزودن پرونده', 'دسترسی پرونده'], userAccess: ['مدیر سیستم'], status: 'فعال' },
]

const generateExample = (values: Partial<Registry>) => {
  const year = '۱۴۰۳'
  const month = '۰۴'
  const num = String(values.currentNumber || 1).padStart(values.padLength || 4, '0')
  const sep = values.separator || '/'
  const prefix = values.prefix || ''
  let parts = [prefix]
  if (values.includeYear) parts.push(year)
  if (values.includeMonth) parts.push(month)
  parts.push(num)
  return parts.filter(Boolean).join(sep)
}

// کامپوننت ستون دسترسی
function AccessColumn({ title, color, value, onChange }: {
  title: string
  color: string
  value: LetterTypeAccess
  onChange: (v: LetterTypeAccess) => void
}) {
  const all = value.register && value.edit && value.bodyRequired && value.bodyAdd && value.bodyEdit && value.bodyDelete && value.attachAdd && value.attachDelete && value.relatedAdd && value.relatedDelete

  const toggleAll = (checked: boolean) => {
    onChange({
      ...value,
      register: checked, edit: checked, bodyRequired: checked,
      bodyAdd: checked, bodyEdit: checked, bodyDelete: checked,
      attachAdd: checked, attachDelete: checked,
      relatedAdd: checked, relatedDelete: checked,
    })
  }

  const set = (key: keyof LetterTypeAccess, val: boolean) => onChange({ ...value, [key]: val })

  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 10, overflow: 'hidden', flex: 1 }}>
      <div style={{ background: color, padding: '10px 16px', textAlign: 'center', color: 'white', fontWeight: 700, fontSize: 15 }}>{title}</div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>مشاهده نامه</div>
          <Select size="small" value={value.view} style={{ width: '100%' }}
            onChange={v => onChange({ ...value, view: v as any })}>
            <Select.Option value="همه نامه‌های سازمان">همه نامه‌های سازمان</Select.Option>
            <Select.Option value="پیش‌نویس‌های خود">پیش‌نویس‌های خود</Select.Option>
            <Select.Option value="ندارد">ندارد</Select.Option>
          </Select>
        </div>

        <Checkbox checked={value.register} onChange={e => set('register', e.target.checked)}>ثبت نامه</Checkbox><br />
        <Checkbox checked={value.edit} onChange={e => set('edit', e.target.checked)}>ویرایش مشخصات نامه</Checkbox><br />
        <Checkbox checked={value.bodyRequired} onChange={e => set('bodyRequired', e.target.checked)}>درج بدنه الزامیست</Checkbox>

        <Divider style={{ margin: '8px 0', fontSize: 11 }}>بدنه نامه</Divider>
        <Space>
          <Checkbox checked={value.bodyAdd} onChange={e => set('bodyAdd', e.target.checked)}>اضافه</Checkbox>
          <Checkbox checked={value.bodyEdit} onChange={e => set('bodyEdit', e.target.checked)}>ویرایش</Checkbox>
          <Checkbox checked={value.bodyDelete} onChange={e => set('bodyDelete', e.target.checked)}>حذف</Checkbox>
        </Space>

        <Divider style={{ margin: '8px 0', fontSize: 11 }}>پیوست</Divider>
        <Space>
          <Checkbox checked={value.attachAdd} onChange={e => set('attachAdd', e.target.checked)}>اضافه</Checkbox>
          <Checkbox checked={value.attachDelete} onChange={e => set('attachDelete', e.target.checked)}>حذف</Checkbox>
        </Space>

        <Divider style={{ margin: '8px 0', fontSize: 11 }}>نامه مرتبط</Divider>
        <Space>
          <Checkbox checked={value.relatedAdd} onChange={e => set('relatedAdd', e.target.checked)}>اضافه</Checkbox>
          <Checkbox checked={value.relatedDelete} onChange={e => set('relatedDelete', e.target.checked)}>حذف</Checkbox>
        </Space>

        <Divider style={{ margin: '8px 0' }} />
        <Checkbox checked={all} onChange={e => toggleAll(e.target.checked)} style={{ fontSize: 11, color: '#8c8c8c' }}>
          انتخاب/عدم انتخاب همه
        </Checkbox>
      </div>
    </div>
  )
}

export default function RegistrySettingsPage() {
  const [registries, setRegistries] = useState<Registry[]>(INITIAL_REGISTRIES)
  const [folders, setFolders] = useState<Folder[]>(INITIAL_FOLDERS)
  const [registryModal, setRegistryModal] = useState(false)
  const [accessModal, setAccessModal] = useState(false)
  const [folderModal, setFolderModal] = useState(false)
  const [editingRegistry, setEditingRegistry] = useState<Registry | null>(null)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [previewExample, setPreviewExample] = useState('')
  const [registryForm] = Form.useForm()
  const [folderForm] = Form.useForm()

  const [internalAccess, setInternalAccess] = useState<LetterTypeAccess>({ ...DEFAULT_ACCESS })
  const [outgoingAccess, setOutgoingAccess] = useState<LetterTypeAccess>({ ...DEFAULT_ACCESS })
  const [incomingAccess, setIncomingAccess] = useState<LetterTypeAccess>({ ...DEFAULT_ACCESS })

  const openRegistryModal = (registry?: Registry) => {
    if (registry) {
      setEditingRegistry(registry)
      registryForm.setFieldsValue(registry)
      setPreviewExample(registry.example)
    } else {
      setEditingRegistry(null)
      registryForm.resetFields()
      registryForm.setFieldsValue({ includeYear: true, includeMonth: false, padLength: 4, separator: '/', currentNumber: 1, isActive: true })
      setPreviewExample('')
    }
    setRegistryModal(true)
  }

  const openAccessModal = (registry: Registry) => {
    setEditingRegistry(registry)
    setInternalAccess({ ...registry.internalAccess })
    setOutgoingAccess({ ...registry.outgoingAccess })
    setIncomingAccess({ ...registry.incomingAccess })
    setAccessModal(true)
  }

  const handleSaveAccess = () => {
    if (!editingRegistry) return
    setRegistries(prev => prev.map(r => r.id === editingRegistry.id ? {
      ...r, internalAccess, outgoingAccess, incomingAccess
    } : r))
    setAccessModal(false)
  }

  const handleFormChange = () => {
    const values = registryForm.getFieldsValue()
    setPreviewExample(generateExample(values))
  }

  const handleSaveRegistry = () => {
    registryForm.validateFields().then(values => {
      const example = generateExample(values)
      if (editingRegistry) {
        setRegistries(prev => prev.map(r => r.id === editingRegistry.id ? { ...r, ...values, example } : r))
      } else {
        setRegistries(prev => [...prev, {
          id: Date.now().toString(), example,
          internalAccess: { ...DEFAULT_ACCESS },
          outgoingAccess: { ...DEFAULT_ACCESS },
          incomingAccess: { ...DEFAULT_ACCESS },
          ...values
        }])
      }
      setRegistryModal(false)
    })
  }

  const openFolderModal = (folder?: Folder) => {
    if (folder) { setEditingFolder(folder); folderForm.setFieldsValue(folder) }
    else { setEditingFolder(null); folderForm.resetFields(); folderForm.setFieldsValue({ status: 'فعال', access: ['افزودن پرونده'] }) }
    setFolderModal(true)
  }

  const handleSaveFolder = () => {
    folderForm.validateFields().then(values => {
      if (editingFolder) {
        setFolders(prev => prev.map(f => f.id === editingFolder.id ? { ...f, ...values } : f))
      } else {
        setFolders(prev => [...prev, { id: Date.now().toString(), code: `PRJ-${String(folders.length + 1).padStart(3, '0')}`, ...values }])
      }
      setFolderModal(false)
    })
  }

  const registryColumns = [
    { title: 'عنوان', dataIndex: 'name', key: 'name', render: (n: string) => <strong>{n}</strong> },
    { title: 'درگاه دبیرخانه دارد', key: 'gateway', width: 130, render: () => <Tag color="default">تعریف نشده</Tag> },
    {
      title: 'دسترسی برای واحد سازمانی', dataIndex: 'unitAccess', key: 'unitAccess',
      render: (u: string[]) => u?.length ? <Space wrap>{u.map(x => <Tag key={x} color="blue" style={{ fontSize: 10 }}>{x}</Tag>)}</Space> : <Tag>تعریف نشده</Tag>
    },
    {
      title: 'دسترسی برای کاربر', dataIndex: 'userAccess', key: 'userAccess',
      render: (u: string[]) => u?.length ? <Space wrap>{u.map(x => <Tag key={x} color="green" style={{ fontSize: 10 }}>{x}</Tag>)}</Space> : <Tag>تعریف نشده</Tag>
    },
    {
      title: 'وضعیت', dataIndex: 'isActive', key: 'isActive', width: 80,
      render: (a: boolean, r: Registry) => <Switch checked={a} size="small" onChange={v => setRegistries(prev => prev.map(x => x.id === r.id ? { ...x, isActive: v } : x))} />
    },
    {
      title: 'عملیات', key: 'actions', width: 200,
      render: (_: unknown, r: Registry) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openRegistryModal(r)}>ویرایش</Button>
          <Button size="small" icon={<LockOutlined />} onClick={() => openAccessModal(r)}>دسترسی‌ها</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setRegistries(prev => prev.filter(x => x.id !== r.id))}>حذف</Button>
        </Space>
      )
    },
  ]

  const formatColumns = [
    { title: 'دبیرخانه', dataIndex: 'name', key: 'name' },
    { title: 'عنوان فرمت', key: 'formatTitle', render: (_: unknown, r: Registry) => `${r.padLength} واحدی` },
    { title: 'فرمت مربوطه', dataIndex: 'example', key: 'example', render: (e: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{e}</Tag> },
    { title: 'عنوان شمارنده', key: 'counterTitle', render: (_: unknown, r: Registry) => `${r.padLength} واحدی` },
    { title: 'شمارنده مربوطه', dataIndex: 'currentNumber', key: 'currentNumber', render: (n: number) => <Tag>{n}</Tag> },
    { title: 'نوع نامه', key: 'types', render: () => <Space><Tag color="blue">داخلی</Tag><Tag color="green">وارده</Tag><Tag color="orange">صادره</Tag></Space> },
  ]

  const folderColumns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{c}</Tag> },
    { title: 'عنوان پرونده', dataIndex: 'title', key: 'title', render: (t: string) => <Space><FolderOutlined style={{ color: '#8B1A6B' }} /><span style={{ fontWeight: 500 }}>{t}</span></Space> },
    { title: 'توضیحات', dataIndex: 'description', key: 'description', render: (d: string) => d || '—' },
    { title: 'دسترسی‌ها', dataIndex: 'access', key: 'access', render: (a: string[]) => <Space wrap>{a?.map(x => <Tag key={x} color="blue" style={{ fontSize: 10 }}>{x}</Tag>)}</Space> },
    { title: 'کاربران مجاز', dataIndex: 'userAccess', key: 'userAccess', render: (u: string[]) => <Space wrap>{u?.map(x => <Tag key={x} color="green" style={{ fontSize: 10 }}>{x}</Tag>)}</Space> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => <Tag color={s === 'فعال' ? 'green' : 'red'}>{s}</Tag> },
    {
      title: 'عملیات', key: 'actions', width: 120,
      render: (_: unknown, r: Folder) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openFolderModal(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setFolders(prev => prev.filter(x => x.id !== r.id))} />
        </Space>
      )
    },
  ]

  return (
    <div>
      <Tabs items={[
        {
          key: '1', label: 'دبیرخانه',
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openRegistryModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>اضافه +</Button>}>
              <Table columns={registryColumns} dataSource={registries} rowKey="id" scroll={{ x: 900 }} />
            </Card>
          )
        },
        {
          key: '2', label: 'فرمت',
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openRegistryModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>اضافه +</Button>}>
              <Table columns={formatColumns} dataSource={registries} rowKey="id" />
            </Card>
          )
        },
        {
          key: '3', label: 'شمارنده',
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openRegistryModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>اضافه +</Button>}>
              <Table
                columns={[
                  { title: 'دبیرخانه', dataIndex: 'name', key: 'name' },
                  { title: 'شماره شروع', dataIndex: 'currentNumber', key: 'currentNumber' },
                  { title: 'طول شماره', dataIndex: 'padLength', key: 'padLength', render: (p: number) => `${p} رقم` },
                  { title: 'نمونه', dataIndex: 'example', key: 'example', render: (e: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{e}</Tag> },
                  {
                    title: 'عملیات', key: 'actions', width: 100,
                    render: (_: unknown, r: Registry) => <Button size="small" icon={<EditOutlined />} onClick={() => openRegistryModal(r)} />
                  },
                ]}
                dataSource={registries} rowKey="id"
              />
            </Card>
          )
        },
        {
          key: '4', label: 'پرونده‌ها',
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openFolderModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>پرونده جدید</Button>}>
              <Table columns={folderColumns} dataSource={folders} rowKey="id" scroll={{ x: 900 }} />
            </Card>
          )
        },
      ]} />

      {/* Modal دبیرخانه */}
      <Modal
        title={editingRegistry ? 'ویرایش دبیرخانه' : 'دبیرخانه جدید'}
        open={registryModal} onOk={handleSaveRegistry} onCancel={() => setRegistryModal(false)}
        okText="ذخیره" cancelText="انصراف" width={620}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={registryForm} layout="vertical" onValuesChange={handleFormChange}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="name" label="نام دبیرخانه" rules={[{ required: true }]}>
                <Input placeholder="مثلاً: دبیرخانه مرکزی" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="prefix" label="پیشوند شماره">
                <Input placeholder="مثلاً: د، و، ص" maxLength={5} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="separator" label="جداکننده">
                <Select>
                  {['/', '-', '.', '_'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="padLength" label="طول شماره">
                <InputNumber min={1} max={8} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="currentNumber" label="شماره شروع">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item name="includeYear" label="سال" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item name="includeMonth" label="ماه" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="unitAccess" label="دسترسی واحد سازمانی">
                <Select mode="multiple" allowClear>{UNITS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="userAccess" label="دسترسی کاربران">
                <Select mode="multiple" allowClear>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="isActive" label="فعال" valuePropName="checked">
                <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="توضیحات">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            {previewExample && (
              <Col span={24}>
                <div style={{ textAlign: 'center', padding: 12, background: '#f0f7ff', borderRadius: 8 }}>
                  <span style={{ color: '#8c8c8c', marginLeft: 8 }}>نمونه شماره نامه:</span>
                  <Tag color="purple" style={{ fontSize: 16, padding: '4px 12px', fontFamily: 'monospace' }}>{previewExample}</Tag>
                </div>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>

      {/* Modal دسترسی‌ها */}
      <Modal
        title={<span><LockOutlined style={{ color: '#8B1A6B', marginLeft: 8 }} />دسترسی‌های دبیرخانه: {editingRegistry?.name}</span>}
        open={accessModal} onOk={handleSaveAccess} onCancel={() => setAccessModal(false)}
        okText="ذخیره" cancelText="بازگشت" width={780}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>دسترسی به پیش‌نویس‌های ایجاد شده در کارتابل‌ها</div>
          <Select defaultValue="پیش‌نویس همه کاربران" style={{ width: 250 }}>
            <Select.Option value="پیش‌نویس همه کاربران">پیش‌نویس همه کاربران</Select.Option>
            <Select.Option value="ندارد">ندارد</Select.Option>
            <Select.Option value="پیش‌نویس‌های انتخاب شده">پیش‌نویس‌های انتخاب شده</Select.Option>
          </Select>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <AccessColumn title="داخلی" color="#faad14" value={internalAccess} onChange={setInternalAccess} />
          <AccessColumn title="صادره" color="#52c41a" value={outgoingAccess} onChange={setOutgoingAccess} />
          <AccessColumn title="وارده" color="#f5222d" value={incomingAccess} onChange={setIncomingAccess} />
        </div>
      </Modal>

      {/* Modal پرونده */}
      <Modal
        title={editingFolder ? 'ویرایش پرونده' : 'پرونده جدید'}
        open={folderModal} onOk={handleSaveFolder} onCancel={() => setFolderModal(false)}
        okText="ذخیره" cancelText="انصراف" width={520}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={folderForm} layout="vertical">
          <Form.Item name="title" label="عنوان پرونده" rules={[{ required: true }]}>
            <Input prefix={<FolderOutlined style={{ color: '#8B1A6B' }} />} placeholder="عنوان پرونده را وارد کنید" />
          </Form.Item>
          <Form.Item name="description" label="توضیحات">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="وضعیت">
            <Select>
              <Select.Option value="فعال">فعال</Select.Option>
              <Select.Option value="غیرفعال">غیرفعال</Select.Option>
            </Select>
          </Form.Item>
          <Divider>دسترسی‌ها</Divider>
          <Form.Item name="access" label="عملیات مجاز روی پرونده">
            <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FOLDER_ACCESS.map(a => <Checkbox key={a} value={a}>{a}</Checkbox>)}
            </Checkbox.Group>
          </Form.Item>
          <Form.Item name="userAccess" label="کاربران مجاز">
            <Select mode="multiple" allowClear placeholder="کاربران مجاز را انتخاب کنید">
              {USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
