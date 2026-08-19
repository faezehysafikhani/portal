import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, message, Modal, Rate, Select, Slider, Space, Table, Tag } from 'antd'
import { AlignLeftOutlined, AppstoreOutlined, CalendarOutlined, CloseOutlined, FlagOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { apiFetch } from '../../utils/api'
import PersianDatePicker from '../../components/PersianDatePicker'
import { jalaliToDate } from '../../utils/jalali'
import {
  API, categoryLabel, creationApprovalColor, creationApprovalLabel, currentUser,
  permissionState, priorityColor, priorityLabel, statusLabel,
} from './common'
import type { DirectoryUser, PerformanceTask } from './common'

const PRIMARY = '#8B1A6B'
const SECONDARY = '#B33F9E'
const faDate = (v?: string) => v ? new Date(v).toLocaleDateString('fa-IR') : '—'

function GlassSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      border: '1px solid rgba(139,26,107,0.10)', borderRadius: 14, padding: '16px 18px', marginBottom: 14,
      boxShadow: '0 4px 16px rgba(94,20,68,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(139,26,107,0.10)', color: PRIMARY, display: 'grid', placeItems: 'center', fontSize: 13 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#3d1030' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

export default function TaskSheetPage() {
  const { canManage } = permissionState()
  const me = currentUser()
  const [tasks, setTasks] = useState<PerformanceTask[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [qualityTarget, setQualityTarget] = useState<PerformanceTask>()
  const [qualityValue, setQualityValue] = useState(3)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskRes, dirRes] = await Promise.all([apiFetch(`${API}/tasks`), apiFetch(`${API}/directory`)])
      const taskResult = await taskRes.json().catch(() => [])
      if (!taskRes.ok) throw new Error(taskResult.message || 'دریافت وظایف انجام نشد')
      setTasks(taskResult)
      const dirResult = await dirRes.json().catch(() => ({ users: [] }))
      if (dirRes.ok) setUsers(dirResult.users || [])
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'دریافت وظایف انجام نشد')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const submitCreate = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title, description: values.description, category: values.category,
          priority: values.priority, complexity: values.complexity, impactScore: values.impactScore,
          dueDate: values.dueDate ? jalaliToDate(values.dueDate).toISOString() : null,
          estimatedHours: values.estimatedHours,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت وظیفه انجام نشد')
      message.success(result.isSelfAdded ? 'وظیفه ثبت شد و منتظر تأیید ارزیاب شماست' : 'وظیفه ثبت شد')
      setCreateOpen(false); form.resetFields(); await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'ثبت وظیفه انجام نشد')
    } finally { setSaving(false) }
  }

  const patchTask = async (id: string, payload: Record<string, unknown>, successMsg: string) => {
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'به‌روزرسانی انجام نشد')
      message.success(successMsg); await load()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'به‌روزرسانی انجام نشد')
    } finally { setSaving(false) }
  }

  const submitQuality = async () => {
    if (!qualityTarget) return
    await patchTask(qualityTarget.id, { rateQuality: qualityValue }, 'کیفیت وظیفه ثبت شد')
    setQualityTarget(undefined)
  }

  const userName = (id?: string) => users.find(u => u.id === id)?.fullName || '—'

  const columns = [
    { title: 'عنوان', dataIndex: 'title' },
    { title: 'انجام‌دهنده', dataIndex: 'assignedToUserId', render: userName },
    { title: 'دسته', dataIndex: 'category', render: (v?: string) => v ? <Tag>{categoryLabel[v] || v}</Tag> : '—' },
    { title: 'اولویت', dataIndex: 'priority', render: (v: string) => <Tag color={priorityColor[v]}>{priorityLabel[v] || v}</Tag> },
    { title: 'پیچیدگی', dataIndex: 'complexity', render: (v?: number) => v ?? '—' },
    { title: 'اثرگذاری', dataIndex: 'impactScore', render: (v?: number) => v ?? '—' },
    { title: 'امتیاز وظیفه', dataIndex: 'taskPoint', render: (v?: number | null) => v ?? '—' },
    { title: 'وضعیت', dataIndex: 'status', render: (v: string) => <Tag>{statusLabel[v] || v}</Tag> },
    {
      title: 'تأیید ثبت', dataIndex: 'creationApprovalStatus',
      render: (v: string, row: PerformanceTask) => row.isSelfAdded ? <Tag color={creationApprovalColor[v]}>{creationApprovalLabel[v] || v}</Tag> : '—',
    },
    { title: 'کیفیت', dataIndex: 'qualityRating', render: (v?: number) => v ? <Rate disabled value={v} style={{ fontSize: 13 }} /> : '—' },
    { title: 'مهلت', dataIndex: 'dueDate', render: faDate },
    {
      title: 'عملیات', key: 'actions', render: (_: unknown, row: PerformanceTask) => (
        <Space size="small" wrap>
          {row.assignedByUserId === me.id && row.status !== 'Done' && row.status !== 'InReview' && (
            <Button size="small" onClick={() => patchTask(row.id, { requestCompletion: true }, 'اعلام پایان ثبت شد')}>اعلام پایان</Button>
          )}
          {row.isSelfAdded && row.creationApprovalStatus === 'Pending' && canManage && (
            <>
              <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => patchTask(row.id, { approveCreation: true }, 'تأیید شد')}>تأیید</Button>
              <Button size="small" danger onClick={() => patchTask(row.id, { rejectCreation: true }, 'رد شد')}>رد</Button>
            </>
          )}
          {row.isCompletionApproved && !row.qualityRating && canManage && (
            <Button size="small" onClick={() => { setQualityTarget(row); setQualityValue(3) }}>ثبت کیفیت</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        size="small" title="Task Sheet من"
        extra={<Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY }} onClick={() => setCreateOpen(true)}>ثبت Task جدید</Button>}
      >
        <Table rowKey="id" loading={loading || saving} columns={columns as any} dataSource={tasks} scroll={{ x: 1100 }} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} closable={false}
        width={520} centered destroyOnHidden
        styles={{
          mask: { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', background: 'rgba(40,8,30,0.45)' },
          root: {
            padding: 0, borderRadius: 20, overflow: 'hidden',
            background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)',
            border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 24px 70px rgba(94,20,68,0.35)',
          },
        }}
      >
        <div style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <PlusOutlined style={{ color: '#fff', fontSize: 17 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>ثبت وظیفه جدید</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>برای Task Sheet شما</div>
          </div>
          <Button type="text" icon={<CloseOutlined style={{ color: '#fff' }} />} onClick={() => setCreateOpen(false)} />
        </div>

        <div style={{ padding: 18, maxHeight: '65vh', overflowY: 'auto' }}>
          <Form form={form} layout="vertical" initialValues={{ priority: 'Medium', category: 'Extra', complexity: 3, impactScore: 3 }}>
            <GlassSection icon={<AlignLeftOutlined />} title="اطلاعات وظیفه">
              <Form.Item name="title" label="عنوان" rules={[{ required: true, message: 'عنوان الزامی است' }]} style={{ marginBottom: 12 }}>
                <Input maxLength={200} placeholder="مثلاً: تهیه گزارش هفتگی فروش" />
              </Form.Item>
              <Form.Item name="description" label="توضیحات" style={{ marginBottom: 0 }}>
                <Input.TextArea rows={3} placeholder="توضیح کوتاهی از وظیفه بنویسید" />
              </Form.Item>
            </GlassSection>

            <GlassSection icon={<AppstoreOutlined />} title="دسته‌بندی و اولویت">
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="category" label="دسته" style={{ flex: 1, marginBottom: 0 }}>
                  <Select options={Object.entries(categoryLabel).map(([value, label]) => ({ value, label }))} />
                </Form.Item>
                <Form.Item name="priority" label="اولویت" style={{ flex: 1, marginBottom: 0 }}>
                  <Select options={Object.entries(priorityLabel).map(([value, label]) => ({ value, label }))} />
                </Form.Item>
              </div>
            </GlassSection>

            <GlassSection icon={<ThunderboltOutlined />} title="امتیازدهی (پس از ثبت قابل تغییر نیست)">
              <Form.Item name="complexity" label="پیچیدگی" style={{ marginBottom: 16 }}>
                <Slider min={1} max={5} step={1} marks={{ 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵' }} styles={{ track: { background: PRIMARY }, handle: { borderColor: PRIMARY } }} />
              </Form.Item>
              <Form.Item name="impactScore" label="میزان اثرگذاری" style={{ marginBottom: 0 }}>
                <Slider min={1} max={5} step={1} marks={{ 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵' }} styles={{ track: { background: PRIMARY }, handle: { borderColor: PRIMARY } }} />
              </Form.Item>
            </GlassSection>

            <GlassSection icon={<CalendarOutlined />} title="زمان‌بندی">
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="dueDate" label="مهلت انجام (تقویم شمسی)" style={{ flex: 1, marginBottom: 0 }}>
                  <PersianDatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="estimatedHours" label="برآورد زمان (ساعت)" style={{ flex: 1, marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} prefix={<FlagOutlined style={{ color: '#bbb', fontSize: 11 }} />} />
                </Form.Item>
              </div>
            </GlassSection>
          </Form>
        </div>

        <div style={{ padding: 14, borderTop: '1px solid rgba(139,26,107,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'rgba(255,255,255,0.5)' }}>
          <Button onClick={() => setCreateOpen(false)}>انصراف</Button>
          <Button type="primary" loading={saving} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={submitCreate}>ثبت وظیفه</Button>
        </div>
      </Modal>

      <Modal title="ثبت رتبه کیفیت" open={!!qualityTarget} onCancel={() => setQualityTarget(undefined)} onOk={submitQuality} confirmLoading={saving}>
        <p>{qualityTarget?.title}</p>
        <Rate value={qualityValue} onChange={setQualityValue} />
      </Modal>
    </div>
  )
}
