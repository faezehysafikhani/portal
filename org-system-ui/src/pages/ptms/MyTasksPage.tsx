import { useState } from 'react'
import { Card, Tag, Avatar, Progress, Badge, Button, Select, Space } from 'antd'
import { PlusOutlined, UserOutlined, ClockCircleOutlined, CheckSquareOutlined } from '@ant-design/icons'
import { SAMPLE_TASKS, getPriorityColor } from './ptmsData'
import type { Task } from './ptmsData'

const COLUMNS = [
  { key: 'جدید', label: 'جدید', color: '#8c8c8c', bg: '#f5f5f5' },
  { key: 'در حال انجام', label: 'در حال انجام', color: '#1677ff', bg: '#e6f4ff' },
  { key: 'در انتظار بازبینی', label: 'در انتظار بازبینی', color: '#fa8c16', bg: '#fff7e6' },
  { key: 'تکمیل شده', label: 'تکمیل شده', color: '#52c41a', bg: '#f6ffed' },
]

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS)
  const [filterProject, setFilterProject] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  const projects = [...new Set(SAMPLE_TASKS.map(t => t.project))]
  const assignees = [...new Set(SAMPLE_TASKS.map(t => t.assignee))]

  const filtered = tasks.filter(t => {
    const matchProject = !filterProject || t.project === filterProject
    const matchAssignee = !filterAssignee || t.assignee === filterAssignee
    return matchProject && matchAssignee
  })

  const handleDrop = (status: string) => {
    if (!dragId) return
    setTasks(prev => prev.map(t => t.id === dragId ? { ...t, status: status as any } : t))
    setDragId(null)
  }

  const getPriorityBorderColor = (priority: string) => {
    const color = getPriorityColor(priority as any)
    switch(color) {
      case 'red': return '#f5222d'
      case 'orange': return '#fa8c16'
      case 'gold': return '#fadb14'
      default: return '#52c41a'
    }
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select placeholder="پروژه" style={{ width: 200 }} value={filterProject || undefined} onChange={setFilterProject} allowClear>
            {projects.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
          </Select>
          <Select placeholder="مسئول" style={{ width: 150 }} value={filterAssignee || undefined} onChange={setFilterAssignee} allowClear>
            {assignees.map(a => <Select.Option key={a} value={a}>{a}</Select.Option>)}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>وظیفه جدید</Button>
        </Space>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, overflowX: 'auto' }}>
        {COLUMNS.map(col => {
          const colTasks = filtered.filter(t => t.status === col.key)
          return (
            <div key={col.key} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(col.key)} style={{ minHeight: 500 }}>
              <div style={{ background: col.bg, border: `1px solid ${col.color}33`, borderTop: `3px solid ${col.color}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: col.color }}>{col.label}</span>
                <Badge count={colTasks.length} style={{ background: col.color }} />
              </div>
              {colTasks.map(task => (
                <Card key={task.id} size="small" draggable onDragStart={() => setDragId(task.id)}
                  style={{ marginBottom: 8, cursor: 'grab', borderRight: `3px solid ${getPriorityBorderColor(task.priority)}`, borderRadius: 8 }}
                  styles={{ body: { padding: '10px 12px' } }}
                >
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>{task.project}</div>
                  <div style={{ marginBottom: 6 }}>
                    <Tag color={getPriorityColor(task.priority) as string} style={{ fontSize: 10 }}>{task.priority}</Tag>
                    <Tag style={{ fontSize: 10 }}>{task.type}</Tag>
                  </div>
                  {task.progress > 0 && <Progress percent={task.progress} size="small" strokeColor="#8B1A6B" style={{ marginBottom: 6 }} />}
                  {task.checklist.length > 0 && (
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>
                      <CheckSquareOutlined /> {task.checklist.filter(c => c.done).length}/{task.checklist.length}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <Avatar size={24} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} />
                    {task.deadline && <span style={{ fontSize: 10, color: '#f5222d' }}><ClockCircleOutlined /> {task.deadline}</span>}
                  </div>
                </Card>
              ))}
              <Button type="dashed" icon={<PlusOutlined />} style={{ width: '100%', marginTop: 4, borderColor: col.color, color: col.color }} size="small">افزودن</Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}