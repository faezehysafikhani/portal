import { useState } from 'react'
import { Card, Table, Tag, Progress, Space, Avatar, Alert } from 'antd'
import { ClockCircleOutlined, UserOutlined, WarningOutlined } from '@ant-design/icons'
import { SAMPLE_TASKS, getPriorityColor } from './ptmsData'
import type { Task } from './ptmsData'

export default function OverdueTasksPage() {
  const [tasks, setTasks] = useState<Task[]>(
    SAMPLE_TASKS.filter(t => t.status !== 'تکمیل شده' && t.status !== 'لغو شده' && t.deadline)
  )

  const columns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="red" style={{ fontFamily: 'monospace', fontSize: 11 }}>{c}</Tag> },
    {
      title: 'عنوان', dataIndex: 'title', key: 'title',
      render: (t: string, r: Task) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{t}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.project}</div>
        </div>
      )
    },
    { title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 90, render: (p: string) => <Tag color={getPriorityColor(p as any) as string}>{p}</Tag> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 150, render: (s: string) => <Tag color="orange">{s}</Tag> },
    {
      title: 'مسئول', dataIndex: 'assignee', key: 'assignee', width: 130,
      render: (a: string) => <Space><Avatar size={22} icon={<UserOutlined />} style={{ background: '#f5222d' }} /><span style={{ fontSize: 12 }}>{a}</span></Space>
    },
    {
      title: 'مهلت', dataIndex: 'deadline', key: 'deadline', width: 120,
      render: (d: string) => <span style={{ fontSize: 12, color: '#f5222d', fontWeight: 600 }}><ClockCircleOutlined /> {d}</span>
    },
    { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', width: 120, render: (p: number) => <Progress percent={p} size="small" strokeColor="#f5222d" /> },
  ]

  return (
    <div>
      <Alert
        message={`${tasks.length} وظیفه معوقه`}
        description="وظایف زیر از مهلت تعیین شده عبور کرده‌اند و نیاز به پیگیری فوری دارند."
        type="error"
        icon={<WarningOutlined />}
        showIcon
        style={{ marginBottom: 16, borderRadius: 10 }}
      />
      <Card>
        <Table columns={columns} dataSource={tasks} rowKey="id" scroll={{ x: 900 }} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}