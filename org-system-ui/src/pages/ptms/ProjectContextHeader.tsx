import type { ReactNode } from 'react'
import { Button, Select, Space, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { SAMPLE_PROJECTS, USERS } from './ptmsData'

interface Props {
  title: string
  projectId: string
  onProjectChange: (value: string) => void
  member?: string
  onMemberChange?: (value: string) => void
  onAdd?: () => void
  addLabel?: string
  extraActions?: ReactNode
}

export default function ProjectContextHeader({ title, projectId, onProjectChange, member, onMemberChange, onAdd, addLabel, extraActions }: Props) {
  return (
    <div dir="rtl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Typography.Title level={3} style={{ margin: 0, color: '#1f1f1f', fontSize: 24 }}>{title}</Typography.Title>
      <Space wrap size={8}>
        <span style={{ color: '#8c8c8c', fontSize: 12 }}>پروژه فعال:</span>
        <Select value={projectId} onChange={onProjectChange} style={{ width: 245 }} options={SAMPLE_PROJECTS.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))} />
        {onMemberChange && (
          <Select allowClear placeholder="همه اعضای پروژه" value={member || undefined} onChange={v => onMemberChange(v || '')} style={{ width: 180 }} options={USERS.map(u => ({ value: u, label: u }))} />
        )}
        {onAdd && <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} style={{ background: '#8B1A6B' }}>{addLabel}</Button>}
        {extraActions}
      </Space>
    </div>
  )
}
