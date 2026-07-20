import { useEffect, useState } from 'react'
import { Alert, Card, Tabs, Form, Select, Switch, Tag, Space, Row, Col, Divider, Upload, Button, Modal, Input, InputNumber, Table, Checkbox, message } from 'antd'
import { PlusOutlined, EditOutlined, SettingOutlined, BankOutlined, TeamOutlined, UploadOutlined, DeleteOutlined, CalendarOutlined, RobotOutlined, ApiOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePermissionStore } from '../store/permissionStore'
import { useSettingsStore } from '../store/settingsStore'
import RegistrySettingsPage from './RegistrySettingsPage'
import OrgChartPage from './OrgChartPage'
import CompanyPage from './CompanyPage'
import UsersPage from './UsersPage'

interface CalendarItem {
  id: string
  name: string
  color: string
  description?: string
  accessUsers: string[]
  permissions: string[]
  isPublic: boolean
}

const ALL_USERS = ['مدیر سیستم', 'علی محمدی', 'مریم احمدی', 'رضا کریمی', 'سارا نوری', 'امیر حسینی', 'فاطمه رضایی', 'محمد کریمی']

const INITIAL_CALENDARS: CalendarItem[] = [
  { id: '1', name: 'تقویم عمومی سازمان', color: '#8B1A6B', description: 'رویدادهای عمومی سازمان', accessUsers: [], permissions: ['view', 'create', 'edit', 'delete'], isPublic: true },
  { id: '2', name: 'تقویم تیم فنی', color: '#1677ff', description: 'رویدادهای تیم فناوری', accessUsers: [], permissions: ['view', 'create', 'edit'], isPublic: false },
  { id: '3', name: 'تقویم مدیریت', color: '#52c41a', description: 'جلسات مدیریتی', accessUsers: ['مدیر سیستم', 'مریم احمدی'], permissions: ['view', 'create', 'edit', 'delete', 'manage'], isPublic: false },
]

const PERMISSION_LABELS: Record<string, string> = {
  view: '👁 مشاهده',
  create: '➕ ایجاد رویداد',
  edit: '✏️ ویرایش رویداد',
  delete: '🗑 حذف رویداد',
  manage: '⚙️ مدیریت تقویم',
}

export default function SettingsPage() {
  const location=useLocation()
  const navigate=useNavigate()
  const { companyMode, setCompanyMode } = usePermissionStore()
  const { departments, addDepartment, removeDepartment } = useSettingsStore()
  const signedInUser=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})()
  const grantedPermissions:string[]=(()=>{try{return JSON.parse(localStorage.getItem('permissions')||'[]')}catch{return []}})()
  const isAdmin=Array.isArray(signedInUser.roles)&&signedInUser.roles.includes('Admin')
  const allowed=(code:string)=>isAdmin||grantedPermissions.includes(code)
  const canManageAi=isAdmin||grantedPermissions.includes('ai.settings')
  const canViewSettings=allowed('settings.view')
  const resolveActiveTab=()=>location.pathname.endsWith('/company')?'company':location.pathname.endsWith('/users')?'users':new URLSearchParams(location.search).get('tab')||(canViewSettings?'1':allowed('company.view')?'company':'users')
  const initialTab=resolveActiveTab()
  const [activeTab,setActiveTab]=useState(initialTab)
  useEffect(()=>{setActiveTab(resolveActiveTab())},[location.pathname,location.search])
  const [positions,setPositions]=useState<{id:string;title:string;isSystem:boolean}[]>([])
  const [calendars, setCalendars] = useState<CalendarItem[]>(INITIAL_CALENDARS)
  const [calendarModal, setCalendarModal] = useState(false)
  const [editingCalendar, setEditingCalendar] = useState<CalendarItem | null>(null)
  const [calendarForm] = Form.useForm()
  const [newDept, setNewDept] = useState('')
  const [newPos, setNewPos] = useState('')
  const [smsForm]=Form.useForm(),[smsTestForm]=Form.useForm()
  const smsProvider=Form.useWatch('providerName',smsForm)||'Kavenegar'
  const [smsHasApiKey,setSmsHasApiKey]=useState(false)
  const [aiForm]=Form.useForm()
  const [aiHasKey,setAiHasKey]=useState(false)
  const [aiTesting,setAiTesting]=useState(false)
  const [letterTemplates, setLetterTemplates] = useState<any[]>([])
  const saveLetterTemplateFile = (file: File, index: number) => {
    if (!file.type.startsWith('image/')) { message.error('برای قالب قابل تایپ، فایل PNG یا JPG انتخاب کنید'); return false }
    if (file.size > 500 * 1024) { message.error(`حجم قالب ${Math.ceil(file.size/1024)} کیلوبایت است؛ حداکثر حجم مجاز ۵۰۰ کیلوبایت است`); return false }
    const reader = new FileReader()
    reader.onload = async () => {
      const defaults = [
        { id:'official-a4', name:'قالب رسمی A4', size:'A4', hasHeader:true, hasFooter:true },
        { id:'official-a5', name:'قالب رسمی A5', size:'A5', hasHeader:true, hasFooter:true },
        { id:'plain-a4', name:'قالب ساده A4', size:'A4', hasHeader:false, hasFooter:false },
        { id:'plain-a5', name:'قالب ساده A5', size:'A5', hasHeader:false, hasFooter:false }
      ]
      const template = { ...defaults[index], imageData: reader.result, fileName: file.name }
      const response = await fetch(`${api}/letter-templates/${template.id}`, {
        method:'PUT', headers:headers(), body:JSON.stringify({
          name:template.name, paperSize:template.size, hasHeader:template.hasHeader,
          hasFooter:template.hasFooter, imageData:template.imageData, fileName:template.fileName
        })
      })
      const data=await response.json().catch(()=>({}))
      if(!response.ok){message.error(data.message||`ثبت قالب ناموفق بود — خطای ${response.status}`);return}
      await loadLetterTemplates()
      localStorage.removeItem('letterTemplates')
      message.success('قالب نامه در دیتابیس ذخیره شد')
    }
    reader.readAsDataURL(file)
    return false
  }
  const api='http://localhost:5043/api/v1',headers=()=>({'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')||''}`})
  const loadLetterTemplates=async()=>{
    const r=await fetch(`${api}/letter-templates`,{headers:headers()})
    if(!r.ok){message.error(`قالب‌های نامه دریافت نشدند — خطای ${r.status}`);return}
    let data=await r.json()
    // انتقال یک‌باره قالب‌های نسخه قدیمی مرورگر به دیتابیس
    if(data.length===0){
      let legacy:any[]=[]
      try{legacy=JSON.parse(localStorage.getItem('letterTemplates')||'[]')}catch{}
      for(const template of legacy){
        if(!template?.id||!template?.imageData)continue
        await fetch(`${api}/letter-templates/${template.id}`,{method:'PUT',headers:headers(),body:JSON.stringify({name:template.name,paperSize:template.size,hasHeader:!!template.hasHeader,hasFooter:!!template.hasFooter,imageData:template.imageData,fileName:template.fileName})})
      }
      if(legacy.length){const refreshed=await fetch(`${api}/letter-templates`,{headers:headers()});if(refreshed.ok){data=await refreshed.json();if(data.length)localStorage.removeItem('letterTemplates')}}
    }
    setLetterTemplates(data)
  }
  const loadPositions=async()=>{const r=await fetch(`${api}/positions`,{headers:headers()});if(r.ok)setPositions(await r.json());else message.error(`سمت‌ها دریافت نشدند — خطای ${r.status}`)}
  useEffect(()=>{if(!canViewSettings)return;fetch(`${api}/sms-settings`,{headers:headers()}).then(r=>r.ok?r.json():null).then(x=>{if(x){smsForm.setFieldsValue(x);setSmsHasApiKey(!!x.hasApiKey)}}).catch(()=>{});fetch(`${api}/ai-settings`,{headers:headers()}).then(r=>r.ok?r.json():null).then(x=>{if(x){aiForm.setFieldsValue(x);setAiHasKey(!!x.hasApiKey)}}).catch(()=>{});void loadPositions();void loadLetterTemplates()},[canViewSettings])
  const createPosition=async()=>{const title=newPos.trim();if(!title)return;const r=await fetch(`${api}/positions`,{method:'POST',headers:headers(),body:JSON.stringify({title,parentId:null,color:'#1677ff'})});if(!r.ok){message.error((await r.json().catch(()=>({}))).message||'ثبت سمت ناموفق بود');return}setNewPos('');message.success('سمت در دیتابیس ذخیره شد');await loadPositions()}
  const deletePosition=async(id:string)=>{const r=await fetch(`${api}/positions/${id}`,{method:'DELETE',headers:headers()});if(!r.ok){message.error((await r.json().catch(()=>({}))).message||'حذف سمت ناموفق بود');return}await loadPositions()}
  const saveSms=async()=>{const v=await smsForm.validateFields();const r=await fetch(`${api}/sms-settings`,{method:'PUT',headers:headers(),body:JSON.stringify(v)});const result=await r.json().catch(()=>({}));if(!r.ok){message.error(result.message||'خطا در ذخیره تنظیمات');return}setSmsHasApiKey(previous=>previous||!!v.apiKey);smsForm.setFieldValue('apiKey','');message.success(result.message||'تنظیمات پیامک ذخیره شد')}
  const testSms=async()=>{const v=await smsTestForm.validateFields();const r=await fetch(`${api}/sms-settings/test`,{method:'POST',headers:headers(),body:JSON.stringify(v)});const result=await r.json().catch(()=>({}));r.ok?message.success(result.message||'پیامک آزمایشی ارسال شد'):message.error(result.message||'ارسال ناموفق')}
  const saveAi=async()=>{const v=await aiForm.validateFields();const r=await fetch(`${api}/ai-settings`,{method:'PUT',headers:headers(),body:JSON.stringify(v)});const result=await r.json().catch(()=>({}));if(!r.ok){message.error(result.message||'ذخیره تنظیمات AI انجام نشد');return}setAiHasKey(previous=>previous||!!v.apiKey);aiForm.setFieldValue('apiKey','');message.success(result.message)}
  const testAi=async()=>{setAiTesting(true);const r=await fetch(`${api}/ai-settings/test`,{method:'POST',headers:headers()});const result=await r.json().catch(()=>({}));setAiTesting(false);r.ok?message.success(result.response||result.message):message.error(result.message||'اتصال برقرار نشد')}

  const openCalendarModal = (cal?: CalendarItem) => {
    if (cal) {
      setEditingCalendar(cal)
      calendarForm.setFieldsValue(cal)
    } else {
      setEditingCalendar(null)
      calendarForm.resetFields()
      calendarForm.setFieldsValue({ color: '#8B1A6B', isPublic: false, permissions: ['view'] })
    }
    setCalendarModal(true)
  }

  const handleSaveCalendar = () => {
    calendarForm.validateFields().then(values => {
      if (editingCalendar) {
        setCalendars(prev => prev.map(c => c.id === editingCalendar.id ? { ...c, ...values } : c))
      } else {
        setCalendars(prev => [...prev, { id: Date.now().toString(), accessUsers: [], permissions: [], ...values }])
      }
      setCalendarModal(false)
    })
  }

  const calendarColumns = [
    {
      title: 'تقویم', dataIndex: 'name', key: 'name',
      render: (n: string, r: CalendarItem) => (
        <Space>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: r.color }} />
          <div>
            <div style={{ fontWeight: 500 }}>{n}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.description}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'دسترسی', key: 'access',
      render: (_: unknown, r: CalendarItem) => (
        <Space wrap>
          {r.accessUsers.map(u => <Tag key={u} color="blue" style={{ fontSize: 10 }}>{u}</Tag>)}
          {r.accessUsers.length === 0 && !r.isPublic && <Tag color="default">هیچ‌کس</Tag>}
          {r.isPublic && <Tag color="green">همه کاربران</Tag>}
        </Space>
      )
    },
    {
      title: 'دسترسی‌های مجاز', dataIndex: 'permissions', key: 'permissions',
      render: (perms: string[]) => (
        <Space wrap>
          {perms?.map(p => <Tag key={p} color="purple" style={{ fontSize: 10 }}>{PERMISSION_LABELS[p]}</Tag>)}
        </Space>
      )
    },
    {
      title: 'عمومی', dataIndex: 'isPublic', key: 'isPublic', width: 80,
      render: (v: boolean, r: CalendarItem) => (
        <Switch size="small" checked={v} onChange={val => setCalendars(prev => prev.map(c => c.id === r.id ? { ...c, isPublic: val } : c))} />
      )
    },
    {
      title: 'عملیات', key: 'actions', width: 100,
      render: (_: unknown, r: CalendarItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openCalendarModal(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setCalendars(prev => prev.filter(c => c.id !== r.id))} />
        </Space>
      )
    },
  ]

  const tabItems = [
    {
      key: '1',
      label: <span><BankOutlined /> حالت شرکت</span>,
      children: (
        <Card>
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <h3>تنظیمات Multi-tenant</h3>
              <p style={{ color: '#8c8c8c' }}>تعیین کنید سیستم برای یک شرکت است یا چند شرکت</p>
              <Divider />
            </Col>
            <Col xs={24} md={12}>
              <Card style={{ border: companyMode === 'single' ? '2px solid #8B1A6B' : '1px solid #d9d9d9', cursor: 'pointer', borderRadius: 12 }} onClick={() => setCompanyMode('single')}>
                <h4>🏢 تک شرکتی</h4>
                <p style={{ color: '#8c8c8c', fontSize: 13 }}>سیستم فقط برای یک سازمان استفاده می‌شود.</p>
                {companyMode === 'single' && <Tag color="purple">فعال</Tag>}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card style={{ border: companyMode === 'multi' ? '2px solid #8B1A6B' : '1px solid #d9d9d9', cursor: 'pointer', borderRadius: 12 }} onClick={() => setCompanyMode('multi')}>
                <h4>🏙️ چند شرکتی</h4>
                <p style={{ color: '#8c8c8c', fontSize: 13 }}>سیستم برای چند سازمان مختلف استفاده می‌شود.</p>
                {companyMode === 'multi' && <Tag color="purple">فعال</Tag>}
              </Card>
            </Col>
            {companyMode === 'multi' && (
              <Col span={24}>
                <Card style={{ background: '#fffbe6', border: '1px solid #ffe58f' }}>
                  <p>⚠️ در حالت چند شرکتی، فقط مدیر سیستم می‌تواند شرکت جدید تعریف کند.</p>
                </Card>
              </Col>
            )}
          </Row>
        </Card>
      )
    },
    {
      key: '2',
      label: <span><SettingOutlined /> تنظیمات عمومی</span>,
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="عناوین کاربری">
              <p style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 12 }}>عناوینی که قبل از نام کاربران نمایش داده می‌شود</p>
              {['آقای', 'خانم', 'دکتر', 'مهندس', 'استاد'].map(title => (
                <Tag key={title} closable style={{ marginBottom: 8 }}>{title}</Tag>
              ))}
              <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }}>افزودن</Button>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title="دپارتمان‌ها">
              <div style={{ marginBottom: 8 }}>
                {departments.map(dept => (
                  <Tag key={dept} closable onClose={() => removeDepartment(dept)} style={{ marginBottom: 8 }}>{dept}</Tag>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Input
                  size="small" placeholder="دپارتمان جدید" value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  onPressEnter={() => { if (newDept.trim()) { addDepartment(newDept.trim()); setNewDept('') } }}
                  style={{ width: 150 }}
                />
                <Button size="small" icon={<PlusOutlined />}
                  onClick={() => { if (newDept.trim()) { addDepartment(newDept.trim()); setNewDept('') } }}>
                  افزودن
                </Button>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title="سمت‌های سازمانی">
              <div style={{ marginBottom: 8 }}>
                {positions.map(pos => (
                  <Tag key={pos.id} closable={!pos.isSystem} onClose={() => void deletePosition(pos.id)} style={{ marginBottom: 8 }}>{pos.title}</Tag>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <Input
                  size="small" placeholder="سمت جدید" value={newPos}
                  onChange={e => setNewPos(e.target.value)}
                  onPressEnter={() => void createPosition()}
                  style={{ width: 150 }}
                />
                <Button size="small" icon={<PlusOutlined />}
                  onClick={() => void createPosition()}>
                  افزودن
                </Button>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title="دسته‌بندی تیکت‌ها">
              {['فنی', 'مالی', 'اداری', 'آموزش', 'گزارش'].map(cat => (
                <Tag key={cat} closable style={{ marginBottom: 8 }}>{cat}</Tag>
              ))}
              <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }}>افزودن</Button>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title="امنیت">
              <Form layout="vertical">
                <Form.Item label="حداقل طول رمز عبور">
                  <Select defaultValue="8">
                    <Select.Option value="6">۶ کاراکتر</Select.Option>
                    <Select.Option value="8">۸ کاراکتر</Select.Option>
                    <Select.Option value="12">۱۲ کاراکتر</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label="تعداد تلاش ناموفق">
                  <Select defaultValue="5">
                    <Select.Option value="3">۳ بار</Select.Option>
                    <Select.Option value="5">۵ بار</Select.Option>
                    <Select.Option value="10">۱۰ بار</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label="احراز هویت دو مرحله‌ای">
                  <Switch />
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      )
    },
    {
      key: '3',
      label: <span>📮 دبیرخانه</span>,
      children: <RegistrySettingsPage />
    },
    {
      key: '4',
      label: <span>📄 قالب نامه</span>,
      children: (
        <div>
          <Card title="قالب‌های نامه" extra={<Button type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>قالب جدید</Button>}>
            <Row gutter={[16, 16]}>
              {[
                { name: 'قالب رسمی A4', size: 'A4', hasHeader: true, hasFooter: true },
                { name: 'قالب رسمی A5', size: 'A5', hasHeader: true, hasFooter: true },
                { name: 'قالب ساده A4', size: 'A4', hasHeader: false, hasFooter: false },
                { name: 'قالب ساده A5', size: 'A5', hasHeader: false, hasFooter: false },
              ].map((t, i) => (
                <Col xs={24} md={12} key={i}>
                  <Card size="small">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                          <Tag>{t.size}</Tag>
                          {t.hasHeader && <Tag color="blue">سربرگ</Tag>}
                          {t.hasFooter && <Tag color="green">ته‌برگ</Tag>}
                        </div>
                      </div>
                      <Space>
                        <Button size="small" icon={<EditOutlined />} />
                        <Upload accept=".png,.jpg,.jpeg" maxCount={1} showUploadList={false} beforeUpload={file => saveLetterTemplateFile(file, i)}>
                          <Button size="small" icon={<UploadOutlined />}>آپلود</Button>
                        </Upload>
                      </Space>
                          {letterTemplates.find(x => x.templateKey === ['official-a4','official-a5','plain-a4','plain-a5'][i]) && <Tag color="success" style={{marginTop:6}}>ثبت شده در دیتابیس</Tag>}
                        </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
          <Card title="تنظیمات پیش‌فرض چاپ" style={{ marginTop: 16 }}>
            <Form layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="اندازه کاغذ پیش‌فرض">
                    <Select defaultValue="A4">
                      <Select.Option value="A4">A4</Select.Option>
                      <Select.Option value="A5">A5</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="سربرگ پیش‌فرض">
                    <Select defaultValue="yes">
                      <Select.Option value="yes">با سربرگ</Select.Option>
                      <Select.Option value="no">بدون سربرگ</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="امضا پیش‌فرض">
                    <Select defaultValue="yes">
                      <Select.Option value="yes">با امضا</Select.Option>
                      <Select.Option value="no">بدون امضا</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>ذخیره تنظیمات</Button>
            </Form>
          </Card>
        </div>
      )
    },
    {
      key: '5',
      label: <span><CalendarOutlined /> تقویم‌ها</span>,
      children: (
        <Card
          title={<Space><CalendarOutlined style={{ color: '#8B1A6B' }} /><span>مدیریت تقویم‌ها</span></Space>}
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openCalendarModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>تقویم جدید</Button>}
        >
          <p style={{ color: '#8c8c8c', marginBottom: 16, fontSize: 13 }}>برای هر تیم یا واحد یک تقویم مجزا تعریف کنید.</p>
          <Table columns={calendarColumns} dataSource={calendars} rowKey="id" scroll={{ x: 800 }} />
        </Card>
      )
    },
    {
      key: '6',
      label: <span>🏢 چارت سازمانی</span>,
      children: <OrgChartPage />
    },
    {
      key:'8',label:<span>📱 پنل پیامکی</span>,children:<Card title="تنظیمات پنل پیامکی">
        <Alert type="info" showIcon style={{marginBottom:16}} message="اتصال امن کاوه‌نگار" description="کاوه‌نگار نام کاربری و رمز عبور نمی‌خواهد. فقط API Key را وارد کنید؛ کلید در بک‌اند به‌صورت رمزنگاری‌شده نگهداری می‌شود و در Git یا مرورگر ذخیره نمی‌شود."/>
        <Form form={smsForm} layout="vertical" initialValues={{providerName:'Kavenegar',apiUrl:'https://api.kavenegar.com/v1/',isActive:false,letterTemplate:'نامه شماره {number} مورخ {date} با موضوع «{subject}»',referralTemplate:'نامه با موضوع «{subject}» مورخ {date} با ارجاع «{referralType}»',meetingTemplate:'دعوت جلسه: {title} - {date} {time}'}}>
          <Row gutter={16}><Col xs={24} md={8}><Form.Item name="providerName" label="سرویس‌دهنده" rules={[{required:true}]}><Select onChange={value=>{if(value==='Kavenegar')smsForm.setFieldsValue({apiUrl:'https://api.kavenegar.com/v1/',username:undefined,password:undefined})}} options={[{value:'Kavenegar',label:'کاوه‌نگار'},{value:'generic',label:'سرویس عمومی'}]}/></Form.Item></Col>
          <Col xs={24} md={16}><Form.Item name="apiUrl" label={smsProvider==='Kavenegar'?'آدرس پایه رسمی کاوه‌نگار':'آدرس HTTPS ارسال پیامک'} rules={[{required:true,type:'url'}]}><Input dir="ltr" disabled={smsProvider==='Kavenegar'} placeholder="https://api.kavenegar.com/v1/"/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="apiKey" label={`API Key ${smsHasApiKey?'(قبلاً ذخیره شده؛ برای تغییر کلید جدید وارد کنید)':''}`} rules={smsHasApiKey?[]:[{required:true,message:'API Key را وارد کنید'}]}><Input.Password dir="ltr" autoComplete="new-password" placeholder={smsHasApiKey?'••••••••••••••••':'API Key جدید کاوه‌نگار'}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="senderNumber" label="شماره خط فرستنده (اختیاری)"><Input dir="ltr" inputMode="numeric" placeholder="اگر خالی باشد خط پیش‌فرض کاوه‌نگار استفاده می‌شود"/></Form.Item></Col>
          {smsProvider!=='Kavenegar'&&<><Col span={12}><Form.Item name="username" label="نام کاربری وب‌سرویس"><Input autoComplete="off"/></Form.Item></Col><Col span={12}><Form.Item name="password" label="رمز عبور وب‌سرویس"><Input.Password autoComplete="new-password"/></Form.Item></Col></>}
          <Col span={24}><Form.Item name="isActive" valuePropName="checked"><Switch checkedChildren="فعال" unCheckedChildren="غیرفعال"/> فعال‌سازی ارسال پیامک</Form.Item></Col>
          <Col span={24}><Form.Item name="letterTemplate" label="متن پیامک نامه"><Input/></Form.Item></Col><Col span={24}><Form.Item name="referralTemplate" label="متن پیامک ارجاع"><Input/></Form.Item></Col><Col span={24}><Form.Item name="meetingTemplate" label="متن پیامک جلسه"><Input/></Form.Item></Col></Row>
          <Space><Button type="primary" onClick={()=>void saveSms()}>ذخیره تنظیمات</Button>{smsHasApiKey&&<Tag color="green">API Key رمزنگاری‌شده ذخیره شده</Tag>}</Space>
        </Form><Divider>ارسال آزمایشی</Divider><Form form={smsTestForm} layout="inline"><Form.Item name="phone" rules={[{required:true,pattern:/^09\d{9}$/}]}><Input placeholder="09123456789" inputMode="numeric"/></Form.Item><Form.Item name="message" rules={[{required:true,max:500}]}><Input placeholder="متن آزمایشی"/></Form.Item><Button onClick={()=>void testSms()}>ارسال تست</Button></Form>
      </Card>
    },
    ...(canManageAi ? [{
      key:'9',label:<span><RobotOutlined/> هوش مصنوعی</span>,children:<Card title={<Space><RobotOutlined style={{color:'#722ed1'}}/><span>تنظیمات سرویس هوش مصنوعی</span></Space>}>
        <Alert type="info" showIcon style={{marginBottom:18}} message="API Key فقط در بک‌اند و به‌صورت رمزنگاری‌شده ذخیره می‌شود" description="برای شروع Groq را انتخاب کنید. بعداً می‌توانید بدون تغییر نرم‌افزار، OpenRouter را جایگزین کنید."/>
        <Form form={aiForm} layout="vertical" initialValues={{providerName:'Groq',baseUrl:'https://api.groq.com/openai/v1',model:'qwen/qwen3-32b',maxTokens:1200,temperature:0.3,isActive:false,systemPrompt:'همیشه فارسی، دقیق، کوتاه و ساختارمند پاسخ بده.'}}>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="providerName" label="سرویس‌دهنده" rules={[{required:true}]}><Select onChange={v=>{if(v==='Groq')aiForm.setFieldsValue({baseUrl:'https://api.groq.com/openai/v1',model:'qwen/qwen3-32b'});else aiForm.setFieldsValue({baseUrl:'https://openrouter.ai/api/v1',model:'openrouter/free'})}} options={[{value:'Groq',label:'Groq'},{value:'OpenRouter',label:'OpenRouter'}]}/></Form.Item></Col>
            <Col xs={24} md={16}><Form.Item name="baseUrl" label="آدرس پایه API" rules={[{required:true,type:'url'}]}><Input prefix={<ApiOutlined/>} dir="ltr"/></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="model" label="نام مدل" rules={[{required:true},{pattern:/^[A-Za-z0-9._:/-]{2,150}$/,message:'نام مدل معتبر نیست'}]}><Input dir="ltr" placeholder="qwen/qwen3-32b"/></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="apiKey" label={`API Key ${aiHasKey?'(قبلاً ذخیره شده؛ برای تغییر مقدار جدید وارد کنید)':''}`} rules={aiHasKey?[]:[{required:true,message:'API Key را وارد کنید'}]}><Input.Password dir="ltr" autoComplete="new-password" placeholder={aiHasKey?'••••••••••••••••':'gsk_...'}/></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="maxTokens" label="حداکثر توکن خروجی" rules={[{required:true}]}><InputNumber min={100} max={4000} step={100} style={{width:'100%'}}/></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="temperature" label="خلاقیت پاسخ (Temperature)" rules={[{required:true}]}><InputNumber min={0} max={1.5} step={0.1} style={{width:'100%'}}/></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="isActive" label="وضعیت" valuePropName="checked"><Switch checkedChildren="فعال" unCheckedChildren="غیرفعال"/></Form.Item></Col>
            <Col span={24}><Form.Item name="systemPrompt" label="دستور تکمیلی سازمان" rules={[{max:3000}]}><Input.TextArea rows={4} maxLength={3000} showCount placeholder="مثلاً پاسخ‌ها رسمی و کوتاه باشند..."/></Form.Item></Col>
          </Row>
          <Space><Button type="primary" icon={<RobotOutlined/>} onClick={()=>void saveAi()} style={{background:'#722ed1'}}>ذخیره تنظیمات</Button><Button loading={aiTesting} disabled={!aiHasKey} onClick={()=>void testAi()}>تست اتصال</Button>{aiHasKey&&<Tag color="green">کلید API ذخیره شده</Tag>}</Space>
        </Form>
      </Card>
    }] : []),
  ]

  const visibleTabItems = [
    ...(allowed('company.view')?[{key:'company',label:<span><BankOutlined/> اطلاعات شرکت</span>,children:<CompanyPage/>}]:[]),
    ...(allowed('users.view')?[{key:'users',label:<span><TeamOutlined/> مدیریت کاربران</span>,children:<UsersPage/>}]:[]),
    ...(canViewSettings?tabItems:[]),
  ]

  const changeTab=(key:string)=>{
    setActiveTab(key)
    if(key==='company')navigate('/settings/company')
    else if(key==='users')navigate('/settings/users')
    else navigate(`/settings?tab=${key}`)
  }

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={changeTab} items={visibleTabItems} />

      {/* Modal تقویم */}
      <Modal
        title={editingCalendar ? 'ویرایش تقویم' : 'تقویم جدید'}
        open={calendarModal} onOk={handleSaveCalendar} onCancel={() => setCalendarModal(false)}
        okText="ذخیره" cancelText="انصراف" width={580}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={calendarForm} layout="vertical">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="نام تقویم" rules={[{ required: true }]}>
                <Input placeholder="مثلاً: تقویم تیم فنی" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="color" label="رنگ">
                <Select>
                  {['#8B1A6B', '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#f5222d', '#13c2c2'].map(c => (
                    <Select.Option key={c} value={c}>
                      <Space>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: c, display: 'inline-block' }} />
                        {c}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="توضیحات">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="isPublic" label="تقویم عمومی" valuePropName="checked">
                <Switch checkedChildren="عمومی — همه میبینند" unCheckedChildren="خصوصی" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="accessUsers" label="کاربران مجاز">
                <Select mode="multiple" allowClear placeholder="انتخاب کاربران">
                  {ALL_USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Divider style={{ fontSize: 13 }}>دسترسی‌های مجاز</Divider>
              <Form.Item name="permissions">
                <Checkbox.Group style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Checkbox value="view">👁 مشاهده تقویم</Checkbox>
                  <Checkbox value="create">➕ ایجاد رویداد</Checkbox>
                  <Checkbox value="edit">✏️ ویرایش رویداد</Checkbox>
                  <Checkbox value="delete">🗑 حذف رویداد</Checkbox>
                  <Checkbox value="manage">⚙️ مدیریت تقویم</Checkbox>
                </Checkbox.Group>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
