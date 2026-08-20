import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, message, Modal, Rate, Segmented, Select, Slider, Space, Table, Tag } from 'antd'
import { AlignLeftOutlined, AppstoreOutlined, CalendarOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { apiFetch } from '../../utils/api'
import PersianDatePicker from '../../components/PersianDatePicker'
import { jalaliToDate } from '../../utils/jalali'
import {
  API, categoryLabel, creationApprovalColor, creationApprovalLabel, currentUser,
  permissionState, priorityColor, priorityLabel, statusLabel,
} from './common'
import type { DirectoryUser, PerformanceTask } from './common'

const PRIMARY = '#8B1A6B'
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
  const { canManage, canAdmin } = permissionState()
  const me = currentUser()
  const [visibility, setVisibility] = useState<'mine' | 'team' | 'all'>('mine')
  const [searchText, setSearchText] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState<string>()
  const [tasks, setTasks] = useState<PerformanceTask[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [qualityTarget, setQualityTarget] = useState<PerformanceTask>()
  const [qualityValue, setQualityValue] = useState(3)
  const [approveTarget, setApproveTarget] = useState<PerformanceTask>()
  const [approveComplexity, setApproveComplexity] = useState(3)
  const [approveImpact, setApproveImpact] = useState(3)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskRes, dirRes] = await Promise.all([apiFetch(`${API}/tasks?visibility=${visibility}`), apiFetch(`${API}/directory`)])
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
  }, [visibility])
  useEffect(() => { void load() }, [load])

  const filteredTasks = useMemo(() => tasks.filter((t) =>
    (!searchText || t.title.toLowerCase().includes(searchText.toLowerCase())) &&
    (!employeeFilter || t.assignedToUserId === employeeFilter || t.assigneeUserIds?.includes(employeeFilter))
  ), [tasks, searchText, employeeFilter])

  const submitCreate = async (keepOpen: boolean) => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await apiFetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title, description: values.description, category: values.category,
          priority: values.priority,
          dueDate: values.dueDate ? jalaliToDate(values.dueDate).toISOString() : null,
          estimatedHours: values.estimatedHours,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'ثبت وظیفه انجام نشد')
      message.success(result.isSelfAdded ? 'وظیفه ثبت شد و منتظر تأیید ارزیاب شماست' : 'وظیفه ثبت شد')
      form.resetFields()
      if (keepOpen) { await load() } else { setCreateOpen(false); await load() }
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
      return true
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'به‌روزرسانی انجام نشد')
      return false
    } finally { setSaving(false) }
  }

  const submitQuality = async () => {
    if (!qualityTarget) return
    await patchTask(qualityTarget.id, { rateQuality: qualityValue }, 'کیفیت وظیفه ثبت شد')
    setQualityTarget(undefined)
  }

  const submitApprove = async () => {
    if (!approveTarget) return
    const ok = await patchTask(approveTarget.id, { approveCreation: true, complexity: approveComplexity, impactScore: approveImpact }, 'وظیفه تأیید شد')
    if (ok) setApproveTarget(undefined)
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
              <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => { setApproveTarget(row); setApproveComplexity(3); setApproveImpact(3) }}>تأیید</Button>
              <Button size="small" danger onClick={() => patchTask(row.id, { rejectCreation: true }, 'رد شد')}>رد</Button>
            </>
          )}
          {row.isSelfAdded && row.status === 'InReview' && canManage && (
            <>
              <Button size="small" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => patchTask(row.id, { approveCompletion: true }, 'پایان کار تأیید شد')}>تأیید پایان</Button>
              <Button size="small" danger onClick={() => patchTask(row.id, { rejectCompletion: true }, 'به کار برگشت داده شد')}>رد پایان</Button>
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
        size="small" title="Task Sheet"
        extra={<Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY }} onClick={() => setCreateOpen(true)}>ثبت Task جدید</Button>}
      >
        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }} size={12}>
          {(canManage || canAdmin) && (
            <Segmented
              value={visibility}
              onChange={(v) => setVisibility(v as 'mine' | 'team' | 'all')}
              options={[
                { label: 'تسک‌های من', value: 'mine' },
                ...(canManage ? [{ label: 'تیم من', value: 'team' }] : []),
                ...(canAdmin ? [{ label: 'همه', value: 'all' }] : []),
              ]}
            />
          )}
          {visibility !== 'mine' && (
            <Space wrap>
              <Input allowClear prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="جستجوی عنوان" style={{ width: 220 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              <Select allowClear showSearch optionFilterProp="label" placeholder="فیلتر بر اساس کارمند" style={{ width: 220 }} value={employeeFilter} onChange={setEmployeeFilter}
                options={users.map(u => ({ value: u.id, label: u.fullName }))} />
            </Space>
          )}
        </Space>
        <Table rowKey="id" loading={loading || saving} columns={columns as any} dataSource={filteredTasks} scroll={{ x: 1100 }} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="ثبت وظیفه جدید"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        width={520}
        centered
        footer={[
          <Button key="cancel" onClick={() => setCreateOpen(false)}>انصراف</Button>,
          <Button key="continue" loading={saving} onClick={() => submitCreate(true)}>ثبت و ادامه</Button>,
          <Button key="submit" type="primary" loading={saving} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => submitCreate(false)}>ثبت و بستن</Button>,
        ]}
      >
        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingTop: 4 }}>
          <Form form={form} layout="vertical" initialValues={{ priority: 'Medium', category: 'Extra' }}>
            <GlassSection icon={<AlignLeftOutlined />} title="اطلاعات وظیفه">
              <Form.Item name="title" label="عنوان" rules={[{ required: true, message: 'عنوان الزامی است' }]} style={{ marginBottom: 12 }}>
                <Input maxLength={200} placeholder="مثلاً: تهیه گزارش هفتگی فروش" autoFocus />
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

            <GlassSection icon={<CalendarOutlined />} title="زمان‌بندی">
              <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item name="dueDate" label="مهلت انجام (تقویم شمسی)" style={{ flex: 1, marginBottom: 0 }}>
                  <PersianDatePicker style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="estimatedHours" label="برآورد زمان (ساعت)" style={{ flex: 1, marginBottom: 0 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </GlassSection>
          </Form>
          <div style={{ color: '#999', fontSize: 11, padding: '0 4px' }}>
            میزان پیچیدگی و اثرگذاری این وظیفه را ارزیاب شما هنگام تأیید مشخص می‌کند.
          </div>
        </div>
      </Modal>

      <Modal title="ثبت رتبه کیفیت" open={!!qualityTarget} onCancel={() => setQualityTarget(undefined)} onOk={submitQuality} confirmLoading={saving}>
        <p>{qualityTarget?.title}</p>
        <Rate value={qualityValue} onChange={setQualityValue} />
      </Modal>

      <Modal title="تأیید وظیفه خودافزوده" open={!!approveTarget} onCancel={() => setApproveTarget(undefined)} onOk={submitApprove} confirmLoading={saving} okText="تأیید نهایی">
        <p style={{ marginBottom: 16 }}>{approveTarget?.title}</p>
        <Form layout="vertical">
          <Form.Item label="پیچیدگی">
            <Slider min={1} max={5} step={1} value={approveComplexity} onChange={setApproveComplexity} marks={{ 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵' }} />
          </Form.Item>
          <Form.Item label="میزان اثرگذاری">
            <Slider min={1} max={5} step={1} value={approveImpact} onChange={setApproveImpact} marks={{ 1: '۱', 2: '۲', 3: '۳', 4: '۴', 5: '۵' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
