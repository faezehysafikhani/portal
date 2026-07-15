import { useState } from 'react'
import { Card, Table, Button, Tag, Progress, Space, Input, Select, Avatar, Row, Col } from 'antd'
import { PlusOutlined, EyeOutlined, SearchOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { SAMPLE_TASKS, getPriorityColor, getStatusColor } from './ptmsData'
import type { Task } from './ptmsData'

export default function AllTasksPage() {
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const navigate = useNavigate()

  const projects = [...new Set(SAMPLE_TASKS.map(t => t.project))]

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.includes(search) || t.assignee.includes(search)
    const matchStatus = !filterStatus || t.status === filterStatus
    const matchPriority = !filterPriority || t.priority === filterPriority
    const matchProject = !filterProject || t.project === filterProject
    return matchSearch && matchStatus && matchPriority && matchProject
  })

  const columns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11 }}>{c}</Tag> },
    {
      title: 'عنوان', dataIndex: 'title', key: 'title',
      render: (t: string, r: Task) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{t}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.project}</div>
        </div>
      )
    },
    { title: 'نوع', dataIndex: 'type', key: 'type', width: 90, render: (t: string) => <Tag>{t}</Tag> },
    { title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 90, render: (p: string) => <Tag color={getPriorityColor(p as any) as string}>{p}</Tag> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 140, render: (s: string) => <Tag color={getStatusColor(s as any) as string}>{s}</Tag> },
    {
      title: 'مسئول', dataIndex: 'assignee', key: 'assignee', width: 130,
      render: (a: string) => <Space><Avatar size={22} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} /><span style={{ fontSize: 12 }}>{a}</span></Space>
    },
    { title: 'مهلت', dataIndex: 'deadline', key: 'deadline', width: 110, render: (d: string) => d ? <span style={{ fontSize: 11, color: '#f5222d' }}><ClockCircleOutlined /> {d}</span> : '—' },
    { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', width: 120, render: (p: number) => <Progress percent={p} size="small" strokeColor="#8B1A6B" /> },
    {
      title: 'عملیات', key: 'actions', width: 80,
      render: (_: unknown, r: Task) => (
        <Select size="small" value={r.status} style={{ width: 130 }}
          onChange={val => setTasks(prev => prev.map(t => t.id === r.id ? { ...t, status: val as any } : t))}>
          {['جدید', 'در حال انجام', 'در انتظار بازبینی', 'تکمیل شده', 'لغو شده'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
        </Select>
      )
    },
  ]

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'کل وظایف', value: tasks.length, color: '#8B1A6B' },
          { label: 'جدید', value: tasks.filter(t => t.status === 'جدید').length, color: '#8c8c8c' },
          { label: 'در حال انجام', value: tasks.filter(t => t.status === 'در حال انجام').length, color: '#1677ff' },
          { label: 'بازبینی', value: tasks.filter(t => t.status === 'در انتظار بازبینی').length, color: '#fa8c16' },
          { label: 'تکمیل شده', value: tasks.filter(t => t.status === 'تکمیل شده').length, color: '#52c41a' },
        ].map((s, i) => (
          <Col xs={12} md={i === 0 ? 4 : 5} key={i}>
            <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input prefix={<SearchOutlined />} placeholder="جستجو..." style={{ width: 180 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
            <Select placeholder="پروژه" style={{ width: 180 }} value={filterProject || undefined} onChange={setFilterProject} allowClear>
              {projects.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
            </Select>
            <Select placeholder="وضعیت" style={{ width: 150 }} value={filterStatus || undefined} onChange={setFilterStatus} allowClear>
              {['جدید', 'در حال انجام', 'در انتظار بازبینی', 'تکمیل شده', 'لغو شده'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
            </Select>
            <Select placeholder="اولویت" style={{ width: 110 }} value={filterPriority || undefined} onChange={setFilterPriority} allowClear>
              {['بحرانی', 'بالا', 'متوسط', 'پایین'].map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
            </Select>
          </Space>
        </div>
        <Table columns={columns} dataSource={filtered} rowKey="id" scroll={{ x: 1000 }} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}