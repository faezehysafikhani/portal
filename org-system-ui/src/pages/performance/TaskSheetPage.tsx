import { useCallback, useEffect, useState } from 'react'
import { Button, Card, DatePicker, Drawer, Form, Input, InputNumber, message, Modal, Rate, Select, Space, Spin, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { apiFetch } from '../../utils/api'
import {
  API, categoryLabel, creationApprovalColor, creationApprovalLabel, currentUser,
  permissionState, priorityColor, priorityLabel, statusLabel,
} from './common'
import type { DirectoryUser, PerformanceTask } from './common'

const PRIMARY = '#8B1A6B'
const faDate = (v?: string) => v ? new Date(v).toLocaleDateString('fa-IR') : '—'

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
          dueDate: values.dueDate ? values.dueDate.toDate().toISOString() : null,
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

      <Drawer title="ثبت وظیفه جدید" open={createOpen} onClose={() => setCreateOpen(false)} width={420}
        extra={<Button type="primary" loading={saving} style={{ background: PRIMARY }} onClick={submitCreate}>ثبت</Button>}>
        <Form form={form} layout="vertical" initialValues={{ priority: 'Medium', category: 'Extra', complexity: 3, impactScore: 3 }}>
          <Form.Item name="title" label="عنوان" rules={[{ required: true, message: 'عنوان الزامی است' }]}><Input maxLength={200} /></Form.Item>
          <Form.Item name="description" label="توضیحات"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="category" label="دسته"><Select options={Object.entries(categoryLabel).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="priority" label="اولویت"><Select options={Object.entries(priorityLabel).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Form.Item name="complexity" label="پیچیدگی (۱ تا ۵)" tooltip="پس از ثبت قابل تغییر نیست"><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="impactScore" label="میزان اثرگذاری (۱ تا ۵)" tooltip="پس از ثبت قابل تغییر نیست"><InputNumber min={1} max={5} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="estimatedHours" label="برآورد زمان (ساعت)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="dueDate" label="مهلت انجام"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Drawer>

      <Modal title="ثبت رتبه کیفیت" open={!!qualityTarget} onCancel={() => setQualityTarget(undefined)} onOk={submitQuality} confirmLoading={saving}>
        <p>{qualityTarget?.title}</p>
        <Rate value={qualityValue} onChange={setQualityValue} />
      </Modal>
    </div>
  )
}
