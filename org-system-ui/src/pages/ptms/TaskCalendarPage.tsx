import { useState } from 'react'
import { Card, Button, Tag, Modal, Space, Select } from 'antd'
import { LeftOutlined, RightOutlined, PlusOutlined } from '@ant-design/icons'
import { SAMPLE_TASKS, getPriorityColor } from './ptmsData'
import type { Task } from './ptmsData'

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const PERSIAN_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

function getDaysInMonth(month: number): number {
  return month <= 6 ? 31 : month <= 11 ? 30 : 29
}

function getFirstDayOfMonth(month: number, year: number): number {
  const totalDays = (year - 1400) * 365 + Math.floor((year - 1400) / 4) +
    [0, 31, 62, 93, 124, 155, 186, 216, 246, 276, 306, 336][month - 1]
  return ((totalDays + 6) % 7)
}

export default function TaskCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(4)
  const [currentYear] = useState(1403)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dayModalOpen, setDayModalOpen] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear)
  const assignees = [...new Set(SAMPLE_TASKS.map(t => t.assignee))]

  const getTasksForDay = (day: number) => {
    const dateStr = `۱۴۰۳/۰${currentMonth}/${String(day).padStart(2, '0')}`
    return SAMPLE_TASKS.filter(t => {
      const matchDate = t.deadline === dateStr || t.startDate === dateStr
      const matchAssignee = !filterAssignee || t.assignee === filterAssignee
      return matchDate && matchAssignee
    })
  }

  const selectedDayTasks = selectedDay ? getTasksForDay(selectedDay) : []

  const getPriorityBorderColor = (priority: string) => {
    const color = getPriorityColor(priority as any)
    switch(color) {
      case 'red': return '#f5222d'
      case 'orange': return '#fa8c16'
      case 'gold': return '#fadb14'
      default: return '#8B1A6B'
    }
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space>
          <Select placeholder="مسئول" style={{ width: 150 }} value={filterAssignee || undefined} onChange={setFilterAssignee} allowClear>
            {assignees.map(a => <Select.Option key={a} value={a}>{a}</Select.Option>)}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>وظیفه جدید</Button>
        </Space>
      </Card>

      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button type="text" icon={<LeftOutlined />} onClick={() => setCurrentMonth(m => m < 12 ? m + 1 : 1)} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>{PERSIAN_MONTHS[currentMonth - 1]} {currentYear}</span>
            <Button type="text" icon={<RightOutlined />} onClick={() => setCurrentMonth(m => m > 1 ? m - 1 : 12)} />
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {PERSIAN_DAYS.map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '6px 0', color: i === 6 ? '#f5222d' : '#8c8c8c', background: '#fafafa', borderRadius: 6 }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {Array(firstDay).fill(null).map((_, i) => <div key={`e-${i}`} />)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1
            const dayTasks = getTasksForDay(day)
            const isFriday = ((firstDay + i) % 7) === 6
            const isToday = day === 15 && currentMonth === 4

            return (
              <div key={day} onClick={() => { setSelectedDay(day); setDayModalOpen(true) }}
                style={{ minHeight: 80, border: `1px solid ${isToday ? '#8B1A6B' : '#f0f0f0'}`, borderRadius: 8, padding: '4px 6px', cursor: 'pointer', background: isToday ? '#8B1A6B11' : isFriday ? '#fff1f0' : 'white', boxShadow: isToday ? '0 0 0 2px #8B1A6B44' : 'none', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (!isToday) (e.currentTarget as HTMLDivElement).style.background = '#f9f0ff' }}
                onMouseLeave={e => { if (!isToday) (e.currentTarget as HTMLDivElement).style.background = isFriday ? '#fff1f0' : 'white' }}
              >
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isFriday ? '#f5222d' : isToday ? '#8B1A6B' : '#333', marginBottom: 2 }}>{day}</div>
                {dayTasks.slice(0, 2).map(t => (
                  <div key={t.id} style={{ background: getPriorityBorderColor(t.priority), color: 'white', borderRadius: 3, padding: '1px 4px', fontSize: 9, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 2 && <div style={{ fontSize: 9, color: '#8B1A6B' }}>+{dayTasks.length - 2}</div>}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#8c8c8c', justifyContent: 'center' }}>
          <span><span style={{ color: '#f5222d' }}>●</span> بحرانی</span>
          <span><span style={{ color: '#fa8c16' }}>●</span> بالا</span>
          <span><span style={{ color: '#8B1A6B' }}>●</span> متوسط/پایین</span>
        </div>
      </Card>

      <Modal
        title={<span>وظایف {selectedDay} {PERSIAN_MONTHS[currentMonth - 1]}</span>}
        open={dayModalOpen} onCancel={() => setDayModalOpen(false)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>وظیفه جدید</Button>,
          <Button key="close" onClick={() => setDayModalOpen(false)}>بستن</Button>
        ]}
        width={480}
      >
        {selectedDayTasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 20 }}>وظیفه‌ای برای این روز وجود ندارد</div>
        ) : (
          selectedDayTasks.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #f5f5f5', alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: getPriorityBorderColor(t.priority), marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{t.project} | مسئول: {t.assignee}</div>
              </div>
              <Tag color={getPriorityColor(t.priority) as string} style={{ fontSize: 10 }}>{t.priority}</Tag>
            </div>
          ))
        )}
      </Modal>
    </div>
  )
}