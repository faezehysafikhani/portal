import { useState, useEffect } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, Space, Avatar, Switch, Tabs, Row, Col, Upload, Collapse, Badge, Checkbox, Card, notification } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, LockOutlined, UploadOutlined, CheckOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../store/settingsStore'
import { PERMISSION_GROUPS } from '../store/permissionsConfig'
import PersianDatePicker from '../components/PersianDatePicker'

const API = 'http://localhost:5043/api/v1'
const getToken = () => localStorage.getItem('token') || ''
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
})
const normalizeDigits = (value:string) => value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g,'').slice(0,10)

interface User {
  id: string
  firstName: string
  lastName: string
  fullName: string
  phoneNumber?: string
  birthDate?: string
  email?: string
  username: string
  isActive: boolean
  department?: string
  position?: string
  permissionCount?: number
  directManager?: string
  hrManager?: string
  customPermissions?: Record<string, string[]>
  roles?: { id: string; name: string }[]
  signatureDataUrl?: string
  signatureText?: string
}

export default function UsersPage() {
  const [roles,setRoles] = useState<any[]>([])
  const [availablePermissions,setAvailablePermissions] = useState<{id:string;code:string;name:string;module:string}[]>([])
  const [selectedPermissionIds,setSelectedPermissionIds] = useState<string[]>([])
  const { departments } = useSettingsStore()
  const [orgPositions,setOrgPositions] = useState<{id:string;title:string}[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [permModalOpen, setPermModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [customPerms, setCustomPerms] = useState<Record<string, string[]>>({})
  const [permType, setPermType] = useState<'role' | 'custom'>('role')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [form] = Form.useForm()
  const currentUser=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})()
  const isAdmin=Array.isArray(currentUser.roles)&&currentUser.roles.includes('Admin')
  const grantedPermissions:string[]=(()=>{try{return JSON.parse(localStorage.getItem('permissions')||'[]')}catch{return []}})()
  const allowed=(code:string)=>isAdmin||grantedPermissions.includes(code)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const [res,permissionRes,positionRes] = await Promise.all([fetch(`${API}/users`, { headers: authHeaders() }),isAdmin?fetch(`${API}/users/permissions`,{headers:authHeaders()}):Promise.resolve(null),fetch(`${API}/positions`,{headers:authHeaders()})])
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsers(data)
      if(permissionRes?.ok)setAvailablePermissions(await permissionRes.json())
      else if(isAdmin) notification.error({message:'لیست دسترسی‌ها دریافت نشد',description:`خطای ${permissionRes?.status ?? 'شبکه'} — یک‌بار خارج و دوباره وارد شوید`})
      if(positionRes.ok)setOrgPositions(await positionRes.json())
      else notification.error({message:'لیست سمت‌های سازمانی دریافت نشد',description:`خطای ${positionRes.status}`})
    } catch {
      notification.error({ message: 'خطا در دریافت کاربران' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      if (user.username === 'admin') {
        form.resetFields()
      } else {
        form.setFieldsValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobile: user.phoneNumber,
          birthDate: user.birthDate,
          department: user.department,
          position: user.position,
          directManager: user.directManager,
          hrManager: user.hrManager,
          signatureDataUrl:user.signatureDataUrl,
          signatureText:user.signatureText,
        })
      }
    } else {
      setEditingUser(null)
      form.resetFields()
    }
    setModalOpen(true)
  }

  const openPermModal = async (user: User) => {
    setSelectedUser(user)
    setSelectedPermissionIds([])
    setPermModalOpen(true)
    try {
      const response=await fetch(`${API}/users/${user.id}/permissions`,{headers:authHeaders()})
      if(!response.ok)throw new Error()
      setSelectedPermissionIds(await response.json())
    } catch { notification.error({message:'خطا در دریافت دسترسی‌های کاربر'}) }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaveLoading(true)

      // فقط تغییر رمز برای admin
      if (editingUser?.username === 'admin') {
        const res = await fetch(`${API}/users/${editingUser.id}/reset-password`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ newPassword: values.password })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) { notification.error({ message: data.message || `خطا در تغییر رمز (${res.status})` }); return }
        notification.success({ message: 'رمز عبور مدیر سیستم تغییر کرد' })
        setModalOpen(false)
        setSaveLoading(false)
        return
      }

      if (editingUser) {
        const res = await fetch(`${API}/users/${editingUser.id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            phoneNumber: values.mobile,
            birthDate: values.birthDate,
            department: values.department,
            position: values.position,
            directManager: values.directManager,
            hrManager: values.hrManager,
            signatureDataUrl: values.signatureDataUrl,
            signatureText: values.signatureText,
          })
        })
        const updateData = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(updateData.message || `خطای ${res.status} در ویرایش کاربر`)

        // اگه رمز عبور جدید داده شده
        if (values.password) {
          const passwordRes = await fetch(`${API}/users/${editingUser.id}/reset-password`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ newPassword: values.password })
          })
          const passwordData = await passwordRes.json().catch(() => ({}))
          if (!passwordRes.ok) throw new Error(passwordData.message || `خطای ${passwordRes.status} در تغییر رمز`)
        }

        notification.success({ message: 'کاربر با موفقیت ویرایش شد' })
      } else {
        const res = await fetch(`${API}/users`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            username: values.username,
            email: values.email,
            password: values.password,
            firstName: values.firstName,
            lastName: values.lastName,
            phoneNumber: values.mobile,
            birthDate: values.birthDate,
            department: values.department,
            position: values.position,
            directManager: values.directManager,
            hrManager: values.hrManager,
            signatureDataUrl: values.signatureDataUrl || null
            ,signatureText: values.signatureText || null
          })
        })
        const data = await res.json()
        if (!res.ok) { notification.error({ message: data.message || 'خطا در ایجاد کاربر' }); return }
        notification.success({ message: 'کاربر با موفقیت ایجاد شد' })
      }

      setModalOpen(false)
      fetchUsers()
    } catch (error) {
      notification.error({ message: error instanceof Error && error.message ? error.message : 'لطفاً فیلدهای الزامی را بررسی کنید' })
    } finally {
      setSaveLoading(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    if (user.username === 'admin') return
    try {
      await fetch(`${API}/users/${user.id}/toggle-active`, {
        method: 'PATCH',
        headers: authHeaders()
      })
      fetchUsers()
    } catch {
      notification.error({ message: 'خطا در تغییر وضعیت' })
    }
  }

  const handleDeleteUser = (user: User) => Modal.confirm({
    title:`حذف کاربر ${user.firstName} ${user.lastName}`,
    content:'کاربر از فهرست فعال حذف می‌شود و می‌توانی دوباره با کد ملی صحیح تعریفش کنی.',
    okText:'حذف کاربر',cancelText:'انصراف',okButtonProps:{danger:true},
    onOk:async()=>{
      const response=await fetch(`${API}/users/${user.id}`,{method:'DELETE',headers:authHeaders()})
      const data=await response.json().catch(()=>({}))
      if(!response.ok){notification.error({message:data.message||'حذف کاربر ناموفق بود'});return}
      notification.success({message:'کاربر حذف شد و اکنون می‌توانی دوباره تعریفش کنی'})
      await fetchUsers()
    }
  })

  const handleSavePermissions = async () => {
    if (!selectedUser) return
    try {
      const response = await fetch(`${API}/users/${selectedUser.id}/permissions`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ permissionIds: selectedPermissionIds })
      })
      if (!response.ok) throw new Error()
      notification.success({ message: 'دسترسی‌های جزئی کاربر ذخیره شد؛ کاربر باید دوباره وارد شود' })
      setPermModalOpen(false)
      fetchUsers()
    } catch {
      notification.error({ message: 'خطا در ذخیره دسترسی' })
    }
  }

  const columns = [
    {
      title: 'کاربر', key: 'user',
      render: (_: unknown, r: User) => {
        return (
          <Space>
            <Avatar icon={<UserOutlined />} style={{ background: r.username === 'admin' ? '#8B1A6B' : '#1677ff' }} />
            <div>
              <div style={{ fontWeight: 500 }}>
                {r.firstName} {r.lastName}
                {r.username === 'admin' && <Tag color="red" style={{ fontSize: 10, marginRight: 6 }}>🔒 سیستمی</Tag>}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.username}</div>
            </div>
          </Space>
        )
      }
    },
    { title: 'موبایل', dataIndex: 'phoneNumber', key: 'mobile' },
    { title: 'ایمیل', dataIndex: 'email', key: 'email' },
    { title: 'دپارتمان', dataIndex: 'department', key: 'department' },
    { title: 'سمت', dataIndex: 'position', key: 'position' },
    { title: 'مدیر مستقیم', dataIndex: 'directManager', key: 'directManager', render: (m: string) => m || <Tag color="default">ندارد</Tag> },
    {
      title: 'دسترسی‌ها', key: 'permissions',
      render: (_: unknown, r: User) => {
        if (r.username === 'admin') return <Tag color="red">دسترسی کامل سیستمی</Tag>
        return <Tag color={r.permissionCount ? 'purple' : 'default'}>{r.permissionCount || 0} مجوز جزئی</Tag>
      }
    },
    {
      title: 'وضعیت', dataIndex: 'isActive', key: 'isActive', width: 90,
      render: (active: boolean, record: User) => (
        <Switch checked={active} size="small" disabled={record.username === 'admin' || !allowed('users.edit')} onChange={() => handleToggleActive(record)} />
      )
    },
    {
      title: 'عملیات', key: 'actions', width: 150,
      render: (_: unknown, record: User) => (
        <Space>
          {allowed('users.edit') && <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            {record.username === 'admin' ? 'تغییر رمز' : 'ویرایش'}
          </Button>}
          {isAdmin && record.username !== 'admin' && (
            <Button size="small" icon={<LockOutlined />} onClick={() => openPermModal(record)}>دسترسی</Button>
          )}
          {allowed('users.delete') && record.username !== 'admin' && <Button size="small" danger icon={<DeleteOutlined />} onClick={()=>handleDeleteUser(record)}>حذف</Button>}
        </Space>
      )
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Tag color="green">فعال: {users.filter(u => u.isActive).length}</Tag>
          <Tag color="red">غیرفعال: {users.filter(u => !u.isActive).length}</Tag>
        </Space>
        {allowed('users.create') && <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}
          style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>کاربر جدید</Button>}
      </div>

      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} scroll={{ x: 1000 }} />

      {/* Modal کاربر */}
      <Modal
        title={
          editingUser?.username === 'admin'
            ? '🔒 تغییر رمز عبور مدیر سیستم'
            : editingUser
              ? `ویرایش: ${editingUser.firstName} ${editingUser.lastName}`
              : 'کاربر جدید'
        }
        open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} maskClosable={false}
        okText="ذخیره" cancelText="انصراف" width={700} confirmLoading={saveLoading}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={form} layout="vertical">
          {editingUser?.username === 'admin' ? (
            <div>
              <div style={{ padding: '12px 16px', background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f', marginBottom: 20 }}>
                <div style={{ fontWeight: 600, color: '#52c41a' }}>🔒 کاربر مدیر سیستم</div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>فقط رمز عبور قابل تغییر است.</div>
              </div>
              <Form.Item name="password" label="رمز عبور جدید" rules={[{ required: true, min: 6, message: 'حداقل ۶ کاراکتر' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="رمز عبور جدید" size="large" />
              </Form.Item>
            </div>
          ) : (
            <Tabs items={[
              {
                key: '1', label: <span><UserOutlined /> اطلاعات شخصی</span>,
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={12}><Form.Item name="firstName" label="نام" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="lastName" label="نام خانوادگی" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="mobile" label="موبایل" rules={[{pattern:/^09\d{9}$/,message:'شماره موبایل باید ۱۱ رقم و با 09 شروع شود'}]}><Input dir="ltr" maxLength={11} placeholder="09121234567" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="birthDate" label="تاریخ تولد"><PersianDatePicker placeholder="مثلاً 1370/05/12" /></Form.Item></Col>
                    <Col xs={24} md={12}><Form.Item name="email" label="ایمیل"><Input /></Form.Item></Col>
                  </Row>
                )
              },
              {
                key: '2', label: <span><LockOutlined /> حساب کاربری</span>,
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="username" label="نام کاربری (کد ملی ۱۰ رقمی)" rules={[{ required: !editingUser, message:'کد ملی الزامی است' },{pattern:/^\d{10}$/,message:'کد ملی باید دقیقاً ۱۰ رقم باشد'}]}>
                        <Input disabled={!!editingUser} inputMode="numeric" maxLength={10} onChange={e=>form.setFieldValue('username',normalizeDigits(e.target.value))} placeholder={editingUser ? editingUser.username : 'مثلاً ۰۰۱۲۳۴۵۶۷۸'} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="password"
                        label={editingUser ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'}
                        rules={[{ required: !editingUser, message: 'رمز عبور الزامی است' },{min:8,message:'رمز عبور حداقل ۸ کاراکتر باشد'}]}
                      >
                        <Input.Password placeholder={editingUser ? 'خالی بگذار تغییر نکند' : 'رمز عبور'} />
                      </Form.Item>
                    </Col>
                  </Row>
                )
              },
              {
                key: '3', label: '🏢 سمت سازمانی',
                children: (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="department" label="دپارتمان">
                        <Select placeholder="انتخاب دپارتمان" allowClear>
                          {departments.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="position" label="سمت">
                        <Select placeholder="انتخاب سمت" allowClear>
                          {orgPositions.map(p => (
                            <Select.Option key={p.id} value={p.title}>{p.title}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="directManager" label="مدیر مستقیم">
                        <Select allowClear placeholder="انتخاب مدیر مستقیم">
                          {users.map(u => (
                            <Select.Option key={u.id} value={u.fullName}>{u.fullName}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="hrManager" label="مسئول منابع انسانی">
                        <Select allowClear placeholder="انتخاب مسئول HR">
                          {users.map(u => (
                            <Select.Option key={u.id} value={u.fullName}>{u.fullName}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                )
              },
              {
                key: '4', label: '✍️ امضا',
                children: (
                  <div>
                    <Upload accept="image/png,image/jpeg" maxCount={1} listType="picture-card" showUploadList={false} beforeUpload={file=>{if(file.size>1024*1024){notification.error({message:'حجم امضا حداکثر یک مگابایت باشد'});return false}const reader=new FileReader();reader.onload=()=>form.setFieldValue('signatureDataUrl',reader.result);reader.readAsDataURL(file);return false}}>
                      <div><UploadOutlined /><div>آپلود امضا</div></div>
                    </Upload>
                    <Form.Item noStyle shouldUpdate>{()=>form.getFieldValue('signatureDataUrl')?<img src={form.getFieldValue('signatureDataUrl')} alt="امضا" style={{maxWidth:220,maxHeight:100,objectFit:'contain',display:'block',marginTop:8}}/>:null}</Form.Item>
                    <Form.Item name="signatureDataUrl" hidden><Input /></Form.Item>
                    <Form.Item name="signatureText" label="متن امضا" style={{ marginTop: 12 }}>
                      <Input.TextArea rows={2} placeholder="با احترام..." />
                    </Form.Item>
                  </div>
                )
              },
            ]} />
          )}
        </Form>
      </Modal>

      {/* Modal دسترسی */}
      <Modal
        title={<Space><LockOutlined style={{ color: '#8B1A6B' }} /><span>دسترسی‌های {selectedUser?.firstName} {selectedUser?.lastName}</span></Space>}
        open={permModalOpen} onOk={handleSavePermissions} onCancel={() => setPermModalOpen(false)} maskClosable={false}
        okText="ذخیره" cancelText="انصراف" width={900}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <div style={{marginBottom:12,padding:'10px 12px',background:'#f6ffed',border:'1px solid #b7eb8f',borderRadius:8}}>
          هر گزینه مستقیماً روی همین کاربر اعمال می‌شود و هیچ نقش یا دسترسی کلی وجود ندارد.
        </div>
        <Checkbox.Group value={selectedPermissionIds} onChange={values=>setSelectedPermissionIds(values as string[])} style={{width:'100%'}}>
          <Collapse defaultActiveKey={['letters','calendar','forms']} items={Object.entries(
            availablePermissions.reduce<Record<string,typeof availablePermissions>>((groups,permission)=>{
              ;(groups[permission.module] ||= []).push(permission)
              return groups
            },{})
          ).map(([module,permissions])=>{
            const selectedCount=permissions.filter(permission=>selectedPermissionIds.includes(permission.id)).length
            const allSelected=selectedCount===permissions.length
            const moduleLabels:Record<string,string>={letters:'نامه‌نگاری و دبیرخانه',calendar:'تقویم و جلسات',users:'مدیریت کاربران',tickets:'تیکت‌ها',contacts:'مخاطبین',tasks:'وظایف و پروژه',forms:'فرم‌های سازمانی',sms:'پیامک',settings:'تنظیمات',reports:'گزارش‌ها',company:'اطلاعات شرکت',chat:'چت داخلی',ai:'هوش مصنوعی'}
            return {
              key:module,
              label:<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong>{moduleLabels[module]||module}</strong><Badge count={`${selectedCount}/${permissions.length}`} style={{background:selectedCount?'#8B1A6B':'#bfbfbf'}}/></div>,
              children:<div><Button size="small" style={{marginBottom:10}} onClick={()=>setSelectedPermissionIds(current=>allSelected?current.filter(id=>!permissions.some(p=>p.id===id)):[...new Set([...current,...permissions.map(p=>p.id)])])}>{allSelected?'برداشتن همه این منو':'انتخاب همه این منو'}</Button><Row gutter={[10,10]}>{permissions.map(permission=><Col xs={24} md={12} key={permission.id}><Card size="small" style={{borderColor:selectedPermissionIds.includes(permission.id)?'#8B1A6B':'#e8e8e8'}}><Checkbox value={permission.id}><strong>{permission.name}</strong><div style={{fontSize:10,color:'#999',direction:'ltr',textAlign:'left'}}>{permission.code}</div></Checkbox></Card></Col>)}</Row></div>
            }
          })}/>
        </Checkbox.Group>
        <Tabs style={{display:'none'}} activeKey="role" items={[
          {
            key: 'role',
            label: '🎭 براساس نقش',
            children: (
              <Row gutter={[12, 12]} style={{ padding: '8px 0' }}>
                {roles.map(role => {
                  const totalPerms = Number(role.permissionCount || 0)
                  return (
                    <Col xs={24} md={12} key={role.id}>
                      <div onClick={() => setSelectedRoleId(role.id)} style={{
                        cursor: 'pointer', padding: 14, borderRadius: 10,
                        border: selectedRoleId === role.id ? `2px solid ${role.color}` : '1px solid #d9d9d9',
                        background: selectedRoleId === role.id ? `${role.color}11` : 'white',
                        borderRight: `4px solid ${role.color}`, transition: 'all 0.2s'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Space>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: role.color }} />
                            <span style={{ fontWeight: 600 }}>{role.name}</span>
                            {role.isSystem && <Tag color="red" style={{ fontSize: 10 }}>سیستمی</Tag>}
                          </Space>
                          {selectedRoleId === role.id && <CheckOutlined style={{ color: role.color, fontSize: 18 }} />}
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{role.description}</div>
                        <Badge count={totalPerms} style={{ background: role.color, marginTop: 8 }}>
                          <Tag>دسترسی</Tag>
                        </Badge>
                      </div>
                    </Col>
                  )
                })}
              </Row>
            )
          },
          {
            key: 'custom',
            label: '⚙️ دسترسی سفارشی',
            children: (
              <div>
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, fontSize: 12, color: '#8c8c8c', border: '1px solid #ffd591' }}>
                  ⚠️ دسترسی سفارشی اولویت بیشتری از نقش دارد
                </div>
                <Collapse>
                  {PERMISSION_GROUPS.map(group => {
                    const totalActions = group.permissions.reduce((s, p) => s + p.actions.length, 0)
                    const selectedActions = group.permissions.reduce((s, p) => s + (customPerms[p.key]?.length || 0), 0)
                    return (
                      <Collapse.Panel key={group.key} header={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <Space>
                            <span>{group.icon}</span>
                            <span style={{ fontWeight: 600 }}>{group.label}</span>
                            <Badge count={`${selectedActions}/${totalActions}`}
                              style={{ background: selectedActions === totalActions ? '#52c41a' : selectedActions > 0 ? '#fa8c16' : '#d9d9d9', fontSize: 10 }} />
                          </Space>
                          <div onClick={e => e.stopPropagation()}>
                            <Switch size="small" checked={selectedActions === totalActions}
                              onChange={checked => {
                                const updates: Record<string, string[]> = {}
                                group.permissions.forEach(p => { updates[p.key] = checked ? p.actions.map(a => a.key) : [] })
                                setCustomPerms(prev => ({ ...prev, ...updates }))
                              }}
                              checkedChildren="همه" unCheckedChildren="هیچ" />
                          </div>
                        </div>
                      }>
                        {group.permissions.map(perm => {
                          const selected = customPerms[perm.key] || []
                          const allSelected = selected.length === perm.actions.length
                          return (
                            <div key={perm.key} style={{ marginBottom: 12, padding: '10px 14px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{perm.label}</span>
                                <Button size="small" type={allSelected ? 'primary' : 'default'}
                                  onClick={() => setCustomPerms(prev => ({ ...prev, [perm.key]: allSelected ? [] : perm.actions.map(a => a.key) }))}
                                  style={allSelected ? { background: '#8B1A6B', borderColor: '#8B1A6B' } : {}}>
                                  {allSelected ? '✓ همه' : 'انتخاب همه'}
                                </Button>
                              </div>
                              <Row gutter={[8, 8]}>
                                {perm.actions.map(action => (
                                  <Col xs={12} md={8} key={action.key}>
                                    <input type="checkbox" checked={selected.includes(action.key)}
                                      onChange={e => setCustomPerms(prev => ({
                                        ...prev,
                                        [perm.key]: e.target.checked
                                          ? [...(prev[perm.key] || []), action.key]
                                          : (prev[perm.key] || []).filter(a => a !== action.key)
                                      }))} style={{ marginLeft: 6 }} />
                                    <span style={{ fontSize: 12 }}>{action.label}</span>
                                  </Col>
                                ))}
                              </Row>
                            </div>
                          )
                        })}
                      </Collapse.Panel>
                    )
                  })}
                </Collapse>
              </div>
            )
          }
        ].filter(item => item.key === 'role')} />
      </Modal>
    </div>
  )
}
