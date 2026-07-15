import { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Tabs, Checkbox, Row, Col, Badge, Collapse, Switch, Select, Divider, Avatar, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, UserOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import { PERMISSION_GROUPS } from '../store/permissionsConfig'
import { useRolesStore } from '../store/rolesStore'
import type { Role } from '../store/rolesStore'

interface UserItem {
  id: string
  name: string
  username: string
  roleIds: string[]
}

const ROLE_COLORS = ['#8B1A6B', '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#f5222d', '#13c2c2']

export default function RolesPage() {
  const roleStore = useRolesStore()
  const [roles,setRoles]=useState<Role[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [availablePermissions,setAvailablePermissions]=useState<{id:string;code:string;name:string;module:string}[]>([])
  const [selectedPermissionIds,setSelectedPermissionIds]=useState<string[]>([])
  const [roleModal, setRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [permissionsModal, setPermissionsModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [tempPermissions, setTempPermissions] = useState<Record<string, string[]>>({})
  const [userRoleModal, setUserRoleModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [roleForm] = Form.useForm()
  const [search, setSearch] = useState('')
  const api='http://localhost:5043/api/v1',headers=()=>({'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')||''}`})
  const load=async()=>{const [rr,ur,pr]=await Promise.all([fetch(`${api}/users/roles`,{headers:headers()}),fetch(`${api}/users`,{headers:headers()}),fetch(`${api}/users/permissions`,{headers:headers()})]);if(rr.ok){const data=await rr.json();setRoles(data.map((r:any,i:number)=>({id:r.id,name:r.name,description:r.description||'',color:ROLE_COLORS[i%ROLE_COLORS.length],isSystem:r.isSystemRole,userCount:r.userCount,permissionCount:r.permissionCount,permissions:{}})))}if(ur.ok){const data=await ur.json();setUsers(data.map((u:any)=>({id:u.id,name:u.fullName,username:u.username,roleIds:(u.roles||[]).map((r:any)=>r.id)})))}if(pr.ok)setAvailablePermissions(await pr.json())}
  useEffect(()=>{
    void load()
    const refresh=()=>void load()
    window.addEventListener('focus',refresh)
    return()=>window.removeEventListener('focus',refresh)
  },[])

  const openPermissionsModal = async (role: Role) => {
    setSelectedRole(role)
    setTempPermissions({ ...role.permissions })
    setPermissionsModal(true)
    const r=await fetch(`${api}/users/roles/${role.id}/permissions`,{headers:headers()});if(r.ok)setSelectedPermissionIds(await r.json())
  }

  const handlePermissionChange = (permKey: string, actionKey: string, checked: boolean) => {
    setTempPermissions(prev => ({
      ...prev,
      [permKey]: checked
        ? [...(prev[permKey] || []), actionKey]
        : (prev[permKey] || []).filter(a => a !== actionKey)
    }))
  }

  const handleSelectAll = (permKey: string, actions: { key: string }[], checked: boolean) => {
    setTempPermissions(prev => ({ ...prev, [permKey]: checked ? actions.map(a => a.key) : [] }))
  }

  const handleGroupSelectAll = (group: typeof PERMISSION_GROUPS[0], checked: boolean) => {
    const updates: Record<string, string[]> = {}
    group.permissions.forEach(p => { updates[p.key] = checked ? p.actions.map(a => a.key) : [] })
    setTempPermissions(prev => ({ ...prev, ...updates }))
  }

  const handleSavePermissions = async () => {
    if (!selectedRole) return
    const r=await fetch(`${api}/users/roles/${selectedRole.id}/permissions`,{method:'PUT',headers:headers(),body:JSON.stringify({permissionIds:selectedPermissionIds})});if(!r.ok){message.error('ذخیره دسترسی‌ها ناموفق بود');return}message.success('دسترسی‌ها ذخیره شد')
    setPermissionsModal(false)
  }

  const openRoleModal = (role?: Role) => {
    if (role) { setEditingRole(role); roleForm.setFieldsValue(role) }
    else { setEditingRole(null); roleForm.resetFields(); roleForm.setFieldsValue({ color: ROLE_COLORS[0] }) }
    setRoleModal(true)
  }

  const handleSaveRole = async () => {
    const values=await roleForm.validateFields();if(editingRole){message.info('ویرایش نقش سیستمی در این مرحله غیرفعال است');return}const r=await fetch(`${api}/users/roles`,{method:'POST',headers:headers(),body:JSON.stringify({name:values.name,description:values.description})});if(!r.ok){message.error('ایجاد نقش ناموفق بود');return}message.success('نقش ایجاد شد');setRoleModal(false);await load()
  }

  const handleCopyRole = (role: Role) => {
    void fetch(`${api}/users/roles`,{method:'POST',headers:headers(),body:JSON.stringify({name:`کپی ${role.name}`,description:role.description})}).then(()=>load())
  }

  const getTotalPermissions = (role: Role) => Number((role as Role & { permissionCount?: number }).permissionCount || 0)

  const filteredGroups: typeof PERMISSION_GROUPS = []
  const deleteRole=async(id:string)=>{const r=await fetch(`${api}/users/roles/${id}`,{method:'DELETE',headers:headers()});if(r.ok){message.success('نقش حذف شد');await load()}else message.error('حذف نقش ناموفق بود')}
  const saveUserRoles=async()=>{if(!selectedUser)return;const r=await fetch(`${api}/users/${selectedUser.id}/roles`,{method:'PUT',headers:headers(),body:JSON.stringify({roleIds:selectedUser.roleIds})});if(!r.ok){message.error('ذخیره نقش‌های کاربر ناموفق بود');return}message.success('نقش‌های کاربر ذخیره شد');setUserRoleModal(false);await load()}

  const roleColumns = [
    {
      title: 'نقش', dataIndex: 'name', key: 'name',
      render: (n: string, r: Role) => (
        <Space>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: r.color }} />
          <div>
            <div style={{ fontWeight: 600 }}>{n}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.description}</div>
          </div>
          {r.isSystem && <Tag color="red" style={{ fontSize: 10 }}>سیستمی</Tag>}
        </Space>
      )
    },
    {
      title: 'تعداد دسترسی‌ها', key: 'perms', width: 140,
      render: (_: unknown, r: Role) => (
        <Badge count={getTotalPermissions(r)} style={{ background: r.color }}>
          <Tag>دسترسی</Tag>
        </Badge>
      )
    },
    { title: 'کاربران', dataIndex: 'userCount', key: 'userCount', width: 90, render: (c: number, r: Role) => <Tag color={r.color}>{c} نفر</Tag> },
    {
      title: 'عملیات', key: 'actions', width: 220,
      render: (_: unknown, r: Role) => (
        <Space>
          <Button size="small" icon={<LockOutlined />} onClick={() => openPermissionsModal(r)}>دسترسی‌ها</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openRoleModal(r)} disabled={r.isSystem} />
          <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopyRole(r)} />
          <Button size="small" icon={<DeleteOutlined />} danger disabled={r.isSystem} onClick={() => deleteRole(r.id)} />
        </Space>
      )
    },
  ]

  const userColumns = [
    {
      title: 'کاربر', dataIndex: 'name', key: 'name',
      render: (n: string, r: UserItem) => (
        <Space>
          <Avatar size={36} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{n}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.username}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'نقش‌های تخصیص یافته', dataIndex: 'roleIds', key: 'roleIds',
      render: (ids: string[]) => (
        <Space wrap>
          {ids.map(id => {
            const role = roles.find(r => r.id === id)
            return role ? <Tag key={id} color={role.color}>{role.name}</Tag> : null
          })}
        </Space>
      )
    },
    {
      title: 'عملیات', key: 'actions', width: 120,
      render: (_: unknown, r: UserItem) => (
        <Button size="small" icon={<LockOutlined />} onClick={() => { setSelectedUser(r); setUserRoleModal(true) }}>تخصیص نقش</Button>
      )
    },
  ]

  return (
    <div>
      <Tabs items={[
        {
          key: '1',
          label: <span><LockOutlined /> نقش‌ها</span>,
          children: (
            <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openRoleModal()} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>نقش جدید</Button>}>
              <Table columns={roleColumns} dataSource={roles} rowKey="id" />
            </Card>
          )
        },
        {
          key: '2',
          label: <span><UserOutlined /> تخصیص نقش به کاربران</span>,
          children: (
            <Card>
              <Table columns={userColumns} dataSource={users} rowKey="id" />
            </Card>
          )
        },
      ]} />

      {/* Modal ایجاد/ویرایش نقش */}
      <Modal
        title={editingRole ? 'ویرایش نقش' : 'نقش جدید'}
        open={roleModal} onOk={handleSaveRole} onCancel={() => setRoleModal(false)}
        okText="ذخیره" cancelText="انصراف"
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="name" label="نام نقش" rules={[{ required: true }]}>
            <Input placeholder="مثلاً: مدیر پروژه، کارشناس نامه‌نگاری" />
          </Form.Item>
          <Form.Item name="description" label="توضیحات">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="color" label="رنگ نقش">
            <Select>
              {ROLE_COLORS.map(c => (
                <Select.Option key={c} value={c}>
                  <Space>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: c, display: 'inline-block' }} />
                    {c}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal دسترسی‌ها */}
      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: '#8B1A6B' }} />
            <span>دسترسی‌های نقش:</span>
            {selectedRole && <Tag color={selectedRole.color}>{selectedRole.name}</Tag>}
          </Space>
        }
        open={permissionsModal} onOk={handleSavePermissions} onCancel={() => setPermissionsModal(false)}
        okText="ذخیره" cancelText="انصراف" width={900}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <div style={{ marginBottom: 12 }}>
          <Input.Search placeholder="جستجو در دسترسی‌ها..." value={search} onChange={e => setSearch(e.target.value)} allowClear style={{ width: 300 }} />
        </div>
        <Checkbox.Group value={selectedPermissionIds} onChange={v=>setSelectedPermissionIds(v as string[])} style={{width:'100%'}}>
          <Row gutter={[12,12]}>{availablePermissions.filter(p=>!search||p.name.includes(search)||p.module.includes(search)).map(p=><Col xs={24} md={12} key={p.id}><Card size="small"><Checkbox value={p.id}><strong>{p.name}</strong><div style={{fontSize:11,color:'#888'}}>{p.module} — {p.code}</div></Checkbox></Card></Col>)}</Row>
        </Checkbox.Group>
        <Collapse>
          {filteredGroups.map(group => {
            const totalActions = group.permissions.reduce((s, p) => s + p.actions.length, 0)
            const selectedActions = group.permissions.reduce((s, p) => s + (tempPermissions[p.key]?.length || 0), 0)
            const allSelected = selectedActions === totalActions
            return (
              <Collapse.Panel
                key={group.key}
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Space>
                      <span style={{ fontSize: 16 }}>{group.icon}</span>
                      <span style={{ fontWeight: 600 }}>{group.label}</span>
                      <Badge
                        count={`${selectedActions}/${totalActions}`}
                        style={{ background: allSelected ? '#52c41a' : selectedActions > 0 ? '#fa8c16' : '#d9d9d9', fontSize: 10 }}
                      />
                    </Space>
                    <div onClick={e => e.stopPropagation()}>
                      <Switch size="small" checked={allSelected} onChange={checked => handleGroupSelectAll(group, checked)} checkedChildren="همه" unCheckedChildren="هیچ" />
                    </div>
                  </div>
                }
              >
                {group.permissions.map(perm => {
                  const selected = tempPermissions[perm.key] || []
                  const allPermsSelected = selected.length === perm.actions.length
                  return (
                    <div key={perm.key} style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{perm.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#8c8c8c' }}>{selected.length}/{perm.actions.length}</span>
                          <Button
                            size="small"
                            type={allPermsSelected ? 'primary' : 'default'}
                            icon={allPermsSelected ? <CheckOutlined /> : undefined}
                            onClick={() => handleSelectAll(perm.key, perm.actions, !allPermsSelected)}
                            style={allPermsSelected ? { background: '#8B1A6B', borderColor: '#8B1A6B' } : {}}
                          >
                            {allPermsSelected ? 'همه انتخاب شد' : 'انتخاب همه'}
                          </Button>
                        </div>
                      </div>
                      <Row gutter={[8, 8]}>
                        {perm.actions.map(action => (
                          <Col xs={12} md={8} lg={6} key={action.key}>
                            <Checkbox
                              checked={selected.includes(action.key)}
                              onChange={e => handlePermissionChange(perm.key, action.key, e.target.checked)}
                            >
                              <span style={{ fontSize: 12 }}>{action.label}</span>
                            </Checkbox>
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
      </Modal>

      {/* Modal تخصیص نقش به کاربر */}
      <Modal
        title={<Space><UserOutlined /><span>تخصیص نقش به: {selectedUser?.name}</span></Space>}
        open={userRoleModal} onOk={saveUserRoles} onCancel={() => setUserRoleModal(false)}
        okText="ذخیره" cancelText="انصراف"
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        {selectedUser && (
          <div>
              <Divider>نقش‌های موجود</Divider>
            {roles.map(role => {
              const hasRole = selectedUser.roleIds.includes(role.id)
              return (
                <div key={role.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <Space>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: role.color }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{role.name}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{role.description}</div>
                    </div>
                  </Space>
                  <Switch
                    checked={hasRole}
                    onChange={checked => {
                      const updated = checked
                        ? { ...selectedUser, roleIds: [...selectedUser.roleIds, role.id] }
                        : { ...selectedUser, roleIds: selectedUser.roleIds.filter(id => id !== role.id) }
                      setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u))
                      setSelectedUser(updated)
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
