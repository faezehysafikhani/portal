import { useState, useEffect } from 'react'
import { Card, Select, Button, Modal, Form, Input, Space, Tag, Avatar, Drawer, Table, Badge } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, TeamOutlined, ApartmentOutlined } from '@ant-design/icons'
import { useOrgChartStore } from '../store/orgChartStore'
import type { OrgPosition } from '../store/orgChartStore'

const API = 'http://localhost:5043/api/v1'
const getToken = () => localStorage.getItem('token') || ''
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` })

interface ApiUser { id: string; firstName: string; lastName: string; fullName: string; position?: string; username?: string }

const COLORS = ['#8B1A6B', '#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#f5222d']

function PositionCard({ position, members, onClick, isSelected }: { position: OrgPosition; members: ApiUser[]; onClick: () => void; isSelected: boolean }) {
  return (
    <div onClick={onClick} style={{
      border: `2px solid ${isSelected ? position.color : '#e8e8e8'}`,
      borderTop: `4px solid ${position.color}`, borderRadius: 12,
      padding: '12px 16px', background: isSelected ? `${position.color}11` : 'white',
      cursor: 'pointer', minWidth: 160, textAlign: 'center', transition: 'all 0.2s',
      boxShadow: isSelected ? `0 4px 16px ${position.color}33` : '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <Avatar.Group maxCount={3} size={32}>
          {members.length > 0
            ? members.map(m => <Avatar key={m.id} size={32} icon={<UserOutlined />} style={{ background: position.color }} />)
            : <Avatar size={32} icon={<UserOutlined />} style={{ background: '#d9d9d9' }} />
          }
        </Avatar.Group>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e', marginBottom: 4 }}>{position.title}</div>
      <Badge count={members.length} style={{ background: position.color }}>
        <span style={{ fontSize: 11, color: '#8c8c8c' }}>نفر</span>
      </Badge>
    </div>
  )
}

function ConnectorLine({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: 32 }}>
      <div style={{ width: 2, height: '100%', background: `${color}66` }} />
    </div>
  )
}

function ChartLevel({ positions, allPositions, allUsers, selectedId, onSelect }: {
  positions: OrgPosition[]
  allPositions: OrgPosition[]
  allUsers: ApiUser[]
  selectedId: string | null
  onSelect: (p: OrgPosition) => void
}) {
  if (positions.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
        {positions.map(pos => {
          const children = allPositions.filter(p => p.parentId === pos.id)
          const members = pos.id === 'admin-root'
            ? allUsers.filter(u => u.username === 'admin' || u.position === 'مدیر سیستم')
            : allUsers.filter(u => u.position === pos.title)
          return (
            <div key={pos.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <PositionCard position={pos} members={members} onClick={() => onSelect(pos)} isSelected={selectedId === pos.id} />
              {children.length > 0 && (
                <>
                  <ConnectorLine color={pos.color} />
                  <div style={{ display: 'flex', gap: 20 }}>
                    <ChartLevel positions={children} allPositions={allPositions} allUsers={allUsers} selectedId={selectedId} onSelect={onSelect} />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OrgChartPage() {
  const { positions: localPositions, addPosition, updatePosition, deletePosition } = useOrgChartStore()
  const [users, setUsers] = useState<ApiUser[]>([])
  const [positions, setPositions] = useState<OrgPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPosition, setSelectedPosition] = useState<OrgPosition | null>(null)
  const [memberDrawer, setMemberDrawer] = useState(false)
  const [positionModal, setPositionModal] = useState(false)
  const [editingPosition, setEditingPosition] = useState<OrgPosition | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [positionForm] = Form.useForm()

  const fetchPositions = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API}/positions`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      // اضافه کردن admin-root به لیست
      const adminRoot: OrgPosition = { id: 'admin-root', orgId: '1', title: 'مدیر سیستم', parentId: null, color: '#8B1A6B' }
      const mapped = data.map((p: any) => ({
        id: p.id,
        orgId: p.orgId || '1',
        title: p.title,
        parentId: p.parentId || null,
        color: p.color || '#1677ff'
      }))
      setPositions([adminRoot, ...mapped])
    } catch {
      // اگه API نبود از store بخون
      setPositions(localPositions)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/users`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      setUsers(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchPositions()
    fetchUsers()
  }, [])

  const isAdmin = (p: OrgPosition | null) => p?.id === 'admin-root'
  const rootPositions = positions.filter(p => p.parentId === null)

  const openPositionModal = (pos?: OrgPosition) => {
    if (isAdmin(pos || null)) return
    if (pos) {
      setEditingPosition(pos)
      positionForm.setFieldsValue({ title: pos.title, parentId: pos.parentId, color: pos.color })
    } else {
      setEditingPosition(null)
      positionForm.resetFields()
      positionForm.setFieldsValue({ color: COLORS[1], parentId: 'admin-root' })
    }
    setPositionModal(true)
  }

  const handleSavePosition = async () => {
    try {
      const values = await positionForm.validateFields()
      setSaveLoading(true)

      if (editingPosition) {
        const res = await fetch(`${API}/positions/${editingPosition.id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ title: values.title, parentId: values.parentId || null, color: values.color })
        })
        if (!res.ok) throw new Error()
        updatePosition(editingPosition.id, values)
      } else {
        const res = await fetch(`${API}/positions`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ title: values.title, parentId: values.parentId || null, color: values.color })
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        addPosition({ id: data.id, orgId: '1', title: data.title, parentId: data.parentId, color: data.color })
      }

      await fetchPositions()
      setPositionModal(false)
    } catch {
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDeletePosition = async (posId: string) => {
    if (posId === 'admin-root') return
    try {
      await fetch(`${API}/positions/${posId}`, { method: 'DELETE', headers: authHeaders() })
      deletePosition(posId)
      await fetchPositions()
      setSelectedPosition(null)
      setMemberDrawer(false)
    } catch {}
  }

  const selectedMembers = selectedPosition?.id === 'admin-root'
    ? users.filter(u => u.username === 'admin' || u.position === 'مدیر سیستم')
    : users.filter(u => u.position === selectedPosition?.title)

  const memberColumns = [
    {
      title: 'کاربر', key: 'user',
      render: (_: unknown, r: ApiUser) => (
        <Space>
          <Avatar size={36} icon={<UserOutlined />} style={{ background: selectedPosition?.color }} />
          <div>
            <div style={{ fontWeight: 500 }}>{r.fullName}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.position}</div>
          </div>
        </Space>
      )
    },
  ]

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <ApartmentOutlined style={{ fontSize: 18, color: '#8B1A6B' }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>چارت سازمانی</span>
          </Space>
          <Space>
            <Button icon={<TeamOutlined />} onClick={() => setMemberDrawer(true)} disabled={!selectedPosition}>
              افراد این سمت
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openPositionModal()}
              style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>
              سمت جدید
            </Button>
          </Space>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: '#8c8c8c', justifyContent: 'center' }}>
        <span>👆 روی هر سمت کلیک کنید تا افراد را ببینید</span>
        <span>🔒 سمت مدیر سیستم قابل تغییر نیست</span>
      </div>

      <Card style={{ overflowX: 'auto', borderRadius: 16 }}>
        <div style={{ minWidth: 800, padding: '20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {loading ? (
            <div style={{ padding: 60, color: '#8c8c8c' }}>در حال بارگذاری...</div>
          ) : (
            <ChartLevel
              positions={rootPositions}
              allPositions={positions}
              allUsers={users}
              selectedId={selectedPosition?.id || null}
              onSelect={p => { setSelectedPosition(p); setMemberDrawer(true) }}
            />
          )}
        </div>
      </Card>

      {/* Drawer افراد */}
      <Drawer
        open={memberDrawer} onClose={() => setMemberDrawer(false)} width={420}
        title={
          <Space>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedPosition?.color }} />
            <span>{selectedPosition?.title}</span>
            {isAdmin(selectedPosition) && <Tag color="red" style={{ fontSize: 10 }}>🔒 سیستمی</Tag>}
          </Space>
        }
        extra={
          !isAdmin(selectedPosition) && selectedPosition && (
            <Space>
              <Button size="small" icon={<EditOutlined />}
                onClick={() => { setMemberDrawer(false); openPositionModal(selectedPosition) }}>
                ویرایش
              </Button>
              <Button size="small" danger icon={<DeleteOutlined />}
                onClick={() => handleDeletePosition(selectedPosition.id)}>
                حذف
              </Button>
            </Space>
          )
        }
      >
        {selectedPosition ? (
          <div>
            <div style={{ padding: '10px 14px', background: `${selectedPosition.color}11`, borderRadius: 8, marginBottom: 16, borderRight: `4px solid ${selectedPosition.color}`, fontSize: 12, color: '#8c8c8c' }}>
              کاربران با این سمت از مدیریت کاربران بارگذاری می‌شوند
            </div>
            {selectedMembers.length > 0
              ? <Table columns={memberColumns} dataSource={selectedMembers} rowKey="id" size="small" pagination={false} />
              : <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 30 }}>هیچ کاربری با سمت «{selectedPosition.title}» تعریف نشده</div>
            }
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 40 }}>یک سمت از چارت انتخاب کنید</div>
        )}
      </Drawer>

      {/* Modal سمت */}
      <Modal
        title={editingPosition ? 'ویرایش سمت' : 'سمت جدید'}
        open={positionModal} onOk={handleSavePosition} onCancel={() => setPositionModal(false)}
        okText="ذخیره" cancelText="انصراف" confirmLoading={saveLoading}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}
      >
        <Form form={positionForm} layout="vertical">
          <Form.Item name="title" label="عنوان سمت" rules={[{ required: true, message: 'عنوان سمت الزامی است' }]}>
            <Input placeholder="مثلاً: مدیرعامل، معاون فنی" />
          </Form.Item>
          <Form.Item name="parentId" label="سمت بالادست">
            <Select allowClear placeholder="انتخاب سمت بالادست">
              {positions.filter(p => p.id !== editingPosition?.id).map(p => (
                <Select.Option key={p.id} value={p.id}>
                  <Space>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                    {p.title}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="color" label="رنگ سمت">
            <Select>
              {COLORS.map(c => (
                <Select.Option key={c} value={c}>
                  <Space>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: c, display: 'inline-block' }} />
                    <span>{c}</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}