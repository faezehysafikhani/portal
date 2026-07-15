import { useEffect, useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Space, Avatar, Tag, Popconfirm, Row, Col, Tabs, Divider, Switch, Tooltip, message } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined,
  UserOutlined, PhoneOutlined, MailOutlined, SearchOutlined, EyeOutlined,
  LockOutlined, CopyOutlined, KeyOutlined
} from '@ant-design/icons'

interface Contact {
  id: string
  firstName: string
  lastName: string
  position?: string
  department?: string
  directPhone?: string
  extension?: string
  mobile?: string
  email?: string
  notes?: string
}

interface PortalAccess {
  username: string
  password: string
  isActive: boolean
}

interface Company {
  id: string
  name: string
  industry?: string
  phone?: string
  fax?: string
  email?: string
  website?: string
  address?: string
  postalCode?: string
  nationalId?: string
  economicCode?: string
  notes?: string
  contacts: Contact[]
  portalAccess?: PortalAccess
}

const INITIAL_COMPANIES: Company[] = [
  {
    id: '1', name: 'شرکت آلفا', industry: 'فناوری', phone: '021-11111111',
    email: 'info@alpha.ir', address: 'تهران، خیابان ولیعصر', nationalId: '10100011111',
    portalAccess: { username: 'customer1', password: '1234', isActive: true },
    contacts: [
      { id: '1', firstName: 'علی', lastName: 'محمدی', position: 'مدیرعامل', mobile: '09121111111', email: 'ali@alpha.ir', directPhone: '021-11111112', extension: '101' },
      { id: '2', firstName: 'مریم', lastName: 'احمدی', position: 'مدیر مالی', mobile: '09122222222', email: 'maryam@alpha.ir', directPhone: '021-11111113', extension: '102' },
    ]
  },
  {
    id: '2', name: 'شرکت بتا', industry: 'ساختمان', phone: '021-22222222',
    email: 'info@beta.ir', address: 'تهران، خیابان کریمخان', nationalId: '10100022222',
    contacts: [
      { id: '3', firstName: 'رضا', lastName: 'کریمی', position: 'مدیر فروش', mobile: '09123333333', email: 'reza@beta.ir', directPhone: '021-22222223', extension: '201' },
    ]
  },
]

const normalizeDigits=(value:string)=>value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
const numbersOnly=(value:string,max=15)=>normalizeDigits(value).replace(/\D/g,'').slice(0,max)
const lettersOnly=(value:string,max=150)=>value.replace(/[^\p{L}\p{M}\s\u200C\-\.\(\)&،]/gu,'').slice(0,max)
const suspiciousCode=/<[^>]+>|javascript\s*:|--|\/\*|\*\/|;\s*(select|insert|update|delete|drop|alter|exec)|\b(union\s+select|drop\s+table|exec\s*\()/i
const noCodeRule={validator:(_:unknown,value?:string)=>!value||!suspiciousCode.test(value)?Promise.resolve():Promise.reject(new Error('ورود کد HTML، JavaScript یا SQL مجاز نیست'))}

export default function ContactsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [searchText, setSearchText] = useState('')
  const [companyModal, setCompanyModal] = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [contactModal, setContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [portalForm] = Form.useForm()
  const [companyForm] = Form.useForm()
  const [contactForm] = Form.useForm()
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const api='http://localhost:5043/api/v1',headers=()=>({'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')||''}`})
  const loadContacts=async()=>{
    const r=await fetch(`${api}/contacts`,{headers:headers()})
    if(!r.ok){message.error((await r.json().catch(()=>({}))).message||`خطا در دریافت مخاطبین (${r.status})`);return}
    const data=await r.json(),groups=new Map<string,Company>()
    for(const x of data){
      const companyName=(x.companyName||x.fullName).trim()
      if(!groups.has(companyName))groups.set(companyName,{id:`group-${companyName}`,name:companyName,contacts:[]})
      const group=groups.get(companyName)!
      const isCompanyRecord=x.fullName.trim()===companyName
      if(isCompanyRecord){Object.assign(group,{id:x.id,name:companyName,industry:x.industry||x.jobTitle,phone:x.phone,fax:x.fax,email:x.email,website:x.website,address:x.address,postalCode:x.postalCode,nationalId:x.nationalId,economicCode:x.economicCode,notes:x.notes})}
      else {const parts=x.fullName.trim().split(/\s+/);group.contacts.push({id:x.id,firstName:parts[0]||x.fullName,lastName:parts.slice(1).join(' '),position:x.jobTitle,department:x.department,directPhone:x.phone,extension:x.extension,mobile:x.mobile,email:x.email,notes:x.notes})}
    }
    const next=[...groups.values()]
    setCompanies(next)
    setSelectedCompany(previous=>previous?next.find(x=>x.name===previous.name)||previous:null)
  }
  useEffect(()=>{void loadContacts()},[])

  const openCompanyModal = (company?: Company) => {
    if (company) { setEditingCompany(company); companyForm.setFieldsValue(company) }
    else { setEditingCompany(null); companyForm.resetFields() }
    setCompanyModal(true)
  }

  const handleSaveCompany = async () => {
    const values=await companyForm.validateFields();const body={fullName:values.name,companyName:values.name,jobTitle:null,mobile:null,phone:values.phone,email:values.email,address:values.address,notes:values.notes,isInternal:false,linkedUserId:null,industry:values.industry,fax:values.fax,website:values.website,postalCode:values.postalCode,nationalId:values.nationalId,economicCode:values.economicCode};const persisted=editingCompany&&!editingCompany.id.startsWith('group-');const url=persisted?`${api}/contacts/${editingCompany.id}`:`${api}/contacts`;const r=await fetch(url,{method:persisted?'PUT':'POST',headers:headers(),body:JSON.stringify(body)});const result=await r.json().catch(()=>({}));if(!r.ok){message.error(result.message||'ثبت مخاطب ناموفق بود');return}message.success('اطلاعات شرکت در دیتابیس ذخیره شد');setCompanyModal(false);await loadContacts()
  }

  const openContactModal = (contact?: Contact) => {
    if (contact) { setEditingContact(contact); contactForm.setFieldsValue(contact) }
    else { setEditingContact(null); contactForm.resetFields() }
    setContactModal(true)
  }

  const handleSaveContact = async () => {
    const values=await contactForm.validateFields();if(!selectedCompany)return;const body={fullName:`${values.firstName} ${values.lastName}`.trim(),companyName:selectedCompany.name,jobTitle:values.position,mobile:values.mobile,phone:values.directPhone,email:values.email,address:null,notes:values.notes,isInternal:false,linkedUserId:null,department:values.department,extension:values.extension};const r=await fetch(editingContact?`${api}/contacts/${editingContact.id}`:`${api}/contacts`,{method:editingContact?'PUT':'POST',headers:headers(),body:JSON.stringify(body)});const result=await r.json().catch(()=>({}));if(!r.ok){message.error(result.message||'ثبت فرد ناموفق بود');return}message.success('فرد مرتبط در دیتابیس ذخیره شد');setContactModal(false);await loadContacts()
  }

  const updateCompanyContacts = (companyId: string, contacts: Contact[]) => {
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, contacts } : c))
    setSelectedCompany(prev => prev?.id === companyId ? { ...prev, contacts } : prev)
  }

  const deleteContact = async (contactId: string) => {
    const r=await fetch(`${api}/contacts/${contactId}`,{method:'DELETE',headers:headers()});if(r.ok){message.success('حذف شد');await loadContacts()}
  }
  const deleteCompany=async(company:Company)=>{const ids=[...(company.id.startsWith('group-')?[]:[company.id]),...company.contacts.map(x=>x.id)];const results=await Promise.all(ids.map(id=>fetch(`${api}/contacts/${id}`,{method:'DELETE',headers:headers()})));if(results.some(x=>!x.ok)){message.error('حذف کامل شرکت انجام نشد');return}message.success('شرکت و افراد مرتبط حذف شدند');await loadContacts()}

  const openDetail = (company: Company) => {
    setSelectedCompany(company)
    if (company.portalAccess) {
      portalForm.setFieldsValue(company.portalAccess)
    } else {
      portalForm.resetFields()
    }
    setDetailModal(true)
  }

  const handleSavePortal = () => {
  portalForm.validateFields().then(async values => {
    if (!selectedCompany) return
    try {
      const res = await fetch('http://localhost:5043/api/v1/customers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: selectedCompany.name,
          email: values.username,
          phone: selectedCompany.phone || null,
          companyName: selectedCompany.name,
          password: values.password
        })
      })
      const data = await res.json()
      if (!res.ok && data.message !== 'این ایمیل قبلاً ثبت شده است') {
        alert('خطا: ' + data.message)
        return
      }
      const updatedCompany = { ...selectedCompany, portalAccess: { ...values, isActive: values.isActive ?? true } }
      setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? updatedCompany : c))
      setSelectedCompany(updatedCompany)
      alert('دسترسی پورتال با موفقیت ذخیره شد!')
    } catch {
      alert('خطا در اتصال به سرور')
    }
  })
}

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const password = Array(8).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
    portalForm.setFieldValue('password', password)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredCompanies = companies.filter(c =>
    c.name.includes(searchText) || c.phone?.includes(searchText) || c.email?.includes(searchText)
  )

  const companyColumns = [
    {
      title: 'نام شرکت', dataIndex: 'name', key: 'name',
      render: (name: string) => (
        <Space>
          <Avatar icon={<BankOutlined />} style={{ background: '#1677ff' }} />
          <strong>{name}</strong>
        </Space>
      )
    },
    { title: 'صنعت', dataIndex: 'industry', key: 'industry', render: (i: string) => i ? <Tag color="blue">{i}</Tag> : '-' },
    { title: 'تلفن', dataIndex: 'phone', key: 'phone', render: (p: string) => p ? <Space><PhoneOutlined />{p}</Space> : '-' },
    { title: 'ایمیل', dataIndex: 'email', key: 'email', render: (e: string) => e ? <Space><MailOutlined />{e}</Space> : '-' },
    {
      title: 'افراد', key: 'contacts',
      render: (_: unknown, r: Company) => <Tag color="green">{r.contacts.length} نفر</Tag>
    },
    {
      title: 'پورتال', key: 'portal',
      render: (_: unknown, r: Company) => r.portalAccess
        ? <Tag color={r.portalAccess.isActive ? 'green' : 'red'}>{r.portalAccess.isActive ? '✅ فعال' : '❌ غیرفعال'}</Tag>
        : <Tag color="default">بدون دسترسی</Tag>
    },
    {
      title: 'عملیات', key: 'actions',
      render: (_: unknown, record: Company) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>جزئیات</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openCompanyModal(record)} />
          <Popconfirm title="شرکت و تمام افراد مرتبط حذف شوند؟" onConfirm={() => deleteCompany(record)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ]

  const contactColumns = [
    {
      title: 'نام', key: 'name',
      render: (_: unknown, r: Contact) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ background: '#52c41a' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{r.firstName} {r.lastName}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.position}</div>
          </div>
        </Space>
      )
    },
    { title: 'موبایل', dataIndex: 'mobile', key: 'mobile', render: (m: string) => m || '-' },
    {
      title: 'تلفن مستقیم', key: 'phone',
      render: (_: unknown, r: Contact) => r.directPhone ? `${r.directPhone}${r.extension ? ` داخلی ${r.extension}` : ''}` : '-'
    },
    { title: 'ایمیل', dataIndex: 'email', key: 'email', render: (e: string) => e || '-' },
    {
      title: 'عملیات', key: 'actions',
      render: (_: unknown, record: Contact) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openContactModal(record)} />
          <Popconfirm title="حذف شود؟" onConfirm={() => deleteContact(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="جستجو در شرکت‌ها..."
            style={{ width: 280 }}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCompanyModal()}>
            شرکت جدید
          </Button>
        </div>
        <Table columns={companyColumns} dataSource={filteredCompanies} rowKey="id" />
      </Card>

      {/* Modal ثبت/ویرایش شرکت */}
      <Modal
        title={<Space><Avatar icon={<BankOutlined/>} style={{background:'#1677ff'}}/><div><div>{editingCompany?'ویرایش شرکت':'ثبت شرکت جدید'}</div><div style={{fontSize:11,color:'#888',fontWeight:400}}>اطلاعات حقوقی و راه‌های ارتباطی</div></div></Space>}
        open={companyModal}
        maskClosable={false}
        onOk={handleSaveCompany}
        onCancel={() => setCompanyModal(false)}
        okText="ذخیره"
        cancelText="انصراف"
        width={780}
      >
        <Form form={companyForm} layout="vertical">
          <Card size="small" title="مشخصات شرکت" style={{marginBottom:12,borderColor:'#d6e4ff'}}>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item name="name" label="نام شرکت" rules={[{required:true,message:'نام شرکت الزامی است'},{max:150},noCodeRule]}><Input prefix={<BankOutlined/>} placeholder="نام کامل شرکت" onChange={e=>companyForm.setFieldValue('name',lettersOnly(e.target.value))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="industry" label="حوزه فعالیت" rules={[{max:100},noCodeRule]}><Input placeholder="مثلاً فناوری اطلاعات" onChange={e=>companyForm.setFieldValue('industry',lettersOnly(e.target.value,100))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="nationalId" label="شناسه ملی ۱۱ رقمی" rules={[{pattern:/^\d{11}$/,message:'شناسه ملی باید دقیقاً ۱۱ رقم باشد'}]}><Input maxLength={11} inputMode="numeric" onChange={e=>companyForm.setFieldValue('nationalId',numbersOnly(e.target.value,11))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="economicCode" label="کد اقتصادی" rules={[{pattern:/^\d{10,14}$/,message:'کد اقتصادی باید ۱۰ تا ۱۴ رقم باشد'}]}><Input maxLength={14} inputMode="numeric" onChange={e=>companyForm.setFieldValue('economicCode',numbersOnly(e.target.value,14))}/></Form.Item></Col>
            </Row>
          </Card>
          <Card size="small" title="اطلاعات تماس" style={{marginBottom:12,borderColor:'#d9f7be'}}>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item name="phone" label="تلفن" rules={[{pattern:/^\d{7,15}$/,message:'تلفن باید ۷ تا ۱۵ رقم باشد'}]}><Input prefix={<PhoneOutlined/>} inputMode="tel" maxLength={15} onChange={e=>companyForm.setFieldValue('phone',numbersOnly(e.target.value))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="fax" label="فاکس" rules={[{pattern:/^\d{7,15}$/,message:'فاکس باید فقط عدد باشد'}]}><Input inputMode="tel" maxLength={15} onChange={e=>companyForm.setFieldValue('fax',numbersOnly(e.target.value))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="email" label="ایمیل" rules={[{type:'email',message:'ایمیل معتبر وارد کنید'},{max:254},noCodeRule]}><Input prefix={<MailOutlined/>} dir="ltr"/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="website" label="وب‌سایت" rules={[{type:'url',message:'آدرس کامل مانند https://example.com وارد کنید'},noCodeRule]}><Input dir="ltr" placeholder="https://example.com"/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="postalCode" label="کد پستی ۱۰ رقمی" rules={[{pattern:/^\d{10}$/,message:'کد پستی باید دقیقاً ۱۰ رقم باشد'}]}><Input maxLength={10} inputMode="numeric" onChange={e=>companyForm.setFieldValue('postalCode',numbersOnly(e.target.value,10))}/></Form.Item></Col>
              <Col xs={24}><Form.Item name="address" label="آدرس" rules={[{max:500},noCodeRule]}><Input.TextArea rows={2} showCount maxLength={500}/></Form.Item></Col>
            </Row>
          </Card>
          <Form.Item name="notes" label="توضیحات" rules={[{max:1000},noCodeRule]}><Input.TextArea rows={2} showCount maxLength={1000}/></Form.Item>
        </Form>
      </Modal>

      {/* Modal جزئیات شرکت */}
      <Modal
        title={
          <Space>
            <Avatar icon={<BankOutlined />} style={{ background: '#1677ff' }} />
            <span>{selectedCompany?.name}</span>
            {selectedCompany?.portalAccess?.isActive && <Tag color="green">پورتال فعال</Tag>}
          </Space>
        }
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={null}
        width={800}
      >
        {selectedCompany && (
          <Tabs items={[
            {
              key: '1',
              label: <span><BankOutlined /> اطلاعات شرکت</span>,
              children: (
                <div>
                  <Row gutter={[16, 8]}>
                    <Col xs={24} md={12}><strong>نام:</strong> {selectedCompany.name}</Col>
                    <Col xs={24} md={12}><strong>صنعت:</strong> {selectedCompany.industry || '-'}</Col>
                    <Col xs={24} md={12}><strong>تلفن:</strong> {selectedCompany.phone || '-'}</Col>
                    <Col xs={24} md={12}><strong>فاکس:</strong> {selectedCompany.fax || '-'}</Col>
                    <Col xs={24} md={12}><strong>ایمیل:</strong> {selectedCompany.email || '-'}</Col>
                    <Col xs={24} md={12}><strong>وب‌سایت:</strong> {selectedCompany.website || '-'}</Col>
                    <Col xs={24} md={12}><strong>شناسه ملی:</strong> {selectedCompany.nationalId || '-'}</Col>
                    <Col xs={24} md={12}><strong>کد اقتصادی:</strong> {selectedCompany.economicCode || '-'}</Col>
                    <Col xs={24}><strong>آدرس:</strong> {selectedCompany.address || '-'}</Col>
                    {selectedCompany.notes && <Col xs={24}><strong>توضیحات:</strong> {selectedCompany.notes}</Col>}
                  </Row>
                  <Divider />
                  <Button icon={<EditOutlined />} onClick={() => { setDetailModal(false); openCompanyModal(selectedCompany) }}>
                    ویرایش اطلاعات شرکت
                  </Button>
                </div>
              )
            },
            {
              key: '2',
              label: <span><UserOutlined /> افراد ({selectedCompany.contacts.length})</span>,
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openContactModal()}>افزودن شخص</Button>
                  </div>
                  <Table columns={contactColumns} dataSource={selectedCompany.contacts} rowKey="id" size="small" />
                </div>
              )
            },
            {
              key: '3',
              label: (
                <span>
                  <LockOutlined /> دسترسی پورتال
                  {selectedCompany.portalAccess?.isActive && <Tag color="green" style={{ marginRight: 6, fontSize: 10 }}>فعال</Tag>}
                </span>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 16, padding: '12px 16px', background: '#e6f4ff', borderRadius: 8, fontSize: 13 }}>
                    <span style={{ color: '#1677ff' }}>🔗 آدرس پورتال:</span>
                    <span style={{ margin: '0 8px', fontFamily: 'monospace' }}>
                      http://localhost:5173/customer-login
                    </span>
                    <Tooltip title={copied ? 'کپی شد!' : 'کپی'}>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard('http://localhost:5173/customer-login')}
                      />
                    </Tooltip>
                  </div>

                  <Form form={portalForm} layout="vertical">
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="username" label="ایمیل مشتری" rules={[{ required: true }, { type: 'email', message: 'ایمیل معتبر وارد کنید' }]}>
                            <Input prefix={<MailOutlined />} placeholder="example@email.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="password" label="رمز عبور" rules={[{ required: true }]}>
                          <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="رمز عبور"
                            visibilityToggle={{ visible: showPassword, onVisibleChange: setShowPassword }}
                            addonAfter={
                              <Tooltip title="تولید رمز تصادفی">
                                <KeyOutlined style={{ cursor: 'pointer' }} onClick={generatePassword} />
                              </Tooltip>
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24}>
                        <Form.Item name="isActive" label="وضعیت دسترسی" valuePropName="checked" initialValue={true}>
                          <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Form>

                  {selectedCompany.portalAccess && (
                    <div style={{ padding: '12px 16px', background: '#f6ffed', borderRadius: 8, marginBottom: 16, border: '1px solid #b7eb8f' }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>
                        <strong>نام کاربری:</strong>
                        <span style={{ marginRight: 8, fontFamily: 'monospace' }}>{selectedCompany.portalAccess.username}</span>
                        <Tooltip title={copied ? 'کپی شد!' : 'کپی'}>
                          <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(selectedCompany.portalAccess!.username)} />
                        </Tooltip>
                      </div>
                      <div style={{ fontSize: 13 }}>
                        <strong>رمز عبور:</strong>
                        <span style={{ marginRight: 8, fontFamily: 'monospace' }}>
                          {showPassword ? selectedCompany.portalAccess.password : '••••••••'}
                        </span>
                        <Tooltip title={copied ? 'کپی شد!' : 'کپی'}>
                          <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(selectedCompany.portalAccess!.password)} />
                        </Tooltip>
                      </div>
                    </div>
                  )}

                  <Button type="primary" icon={<LockOutlined />} onClick={handleSavePortal}>
                    ذخیره دسترسی پورتال
                  </Button>
                </div>
              )
            }
          ]} />
        )}
      </Modal>

      {/* Modal ثبت/ویرایش شخص */}
      <Modal
        title={<Space><Avatar icon={<UserOutlined/>} style={{background:'#52c41a'}}/><div><div>{editingContact?'ویرایش شخص':'افزودن فرد مرتبط'}</div><div style={{fontSize:11,color:'#888',fontWeight:400}}>{selectedCompany?.name}</div></div></Space>}
        open={contactModal}
        maskClosable={false}
        onOk={handleSaveContact}
        onCancel={() => setContactModal(false)}
        okText="ذخیره"
        cancelText="انصراف"
        width={720}
      >
        <Form form={contactForm} layout="vertical">
          <Card size="small" style={{background:'#fbfffb',borderColor:'#d9f7be'}}>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item name="firstName" label="نام" rules={[{required:true,message:'نام الزامی است'},{max:75},noCodeRule]}><Input prefix={<UserOutlined/>} onChange={e=>contactForm.setFieldValue('firstName',lettersOnly(e.target.value,75))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="lastName" label="نام خانوادگی" rules={[{required:true,message:'نام خانوادگی الزامی است'},{max:75},noCodeRule]}><Input onChange={e=>contactForm.setFieldValue('lastName',lettersOnly(e.target.value,75))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="position" label="سمت" rules={[{max:100},noCodeRule]}><Input placeholder="مثلاً مدیر مالی" onChange={e=>contactForm.setFieldValue('position',lettersOnly(e.target.value,100))}/></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="department" label="دپارتمان" rules={[{max:100},noCodeRule]}><Input onChange={e=>contactForm.setFieldValue('department',lettersOnly(e.target.value,100))}/></Form.Item></Col>
            </Row>
          </Card>
          <Divider titlePlacement="end" plain>راه‌های ارتباطی</Divider>
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="mobile" label="موبایل" rules={[{pattern:/^\d{10,15}$/,message:'موبایل باید ۱۰ تا ۱۵ رقم باشد'}]}><Input prefix={<PhoneOutlined/>} inputMode="tel" maxLength={15} onChange={e=>contactForm.setFieldValue('mobile',numbersOnly(e.target.value))}/></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="directPhone" label="تلفن مستقیم" rules={[{pattern:/^\d{7,15}$/,message:'تلفن باید ۷ تا ۱۵ رقم باشد'}]}><Input inputMode="tel" maxLength={15} onChange={e=>contactForm.setFieldValue('directPhone',numbersOnly(e.target.value))}/></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="extension" label="داخلی" rules={[{pattern:/^\d{1,8}$/,message:'داخلی باید فقط عدد باشد'}]}><Input inputMode="numeric" maxLength={8} onChange={e=>contactForm.setFieldValue('extension',numbersOnly(e.target.value,8))}/></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="email" label="ایمیل" rules={[{type:'email',message:'ایمیل معتبر وارد کنید'},{max:254},noCodeRule]}><Input prefix={<MailOutlined/>} dir="ltr"/></Form.Item></Col>
            <Col xs={24}><Form.Item name="notes" label="توضیحات" rules={[{max:1000},noCodeRule]}><Input.TextArea rows={3} showCount maxLength={1000}/></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
