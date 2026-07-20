import { useState } from 'react'
import { Button, Popover, Select } from 'antd'
import { CalendarOutlined, RightOutlined, LeftOutlined } from '@ant-design/icons'
import { currentJalali, isLeapJalali, jalaliToDate } from '../utils/jalali'
import { getIranHoliday } from '../utils/iranHolidays'

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const PERSIAN_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

// تعطیلات ثابت تقویم خورشیدی؛ تعطیلات قمری متغیر از API قابل افزودن هستند.
function getDaysInMonth(month: number, year: number): number {
  if (month <= 6) return 31
  if (month <= 11) return 30
  // اسفند - سال کبیسه
  return isLeapJalali(year) ? 30 : 29
}

// روز اول ماه (0=شنبه، 6=جمعه)
function getFirstDayOfMonth(month: number, year: number): number {
  const weekday = jalaliToDate(`${year}/${month}/1`).getDay() // 0=یکشنبه
  return (weekday + 1) % 7 // 0=شنبه
}

interface PersianDatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export default function PersianDatePicker({ value, onChange, placeholder, style, disabled }: PersianDatePickerProps) {
  const today = currentJalali()
  const [year, setYear] = useState(today.year)
  const [month, setMonth] = useState(today.month)
  const [open, setOpen] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (disabled) { setOpen(false); return }
    if (next && value) {
      const parts = value.split('/').map(Number)
      if (parts.length === 3 && parts[0] > 1200 && parts[1] >= 1 && parts[1] <= 12) { setYear(parts[0]); setMonth(parts[1]) }
    }
    setOpen(next)
  }

  const YEARS = Array.from({ length: today.year + 10 - 1299 }, (_, i) => today.year + 10 - i)

  const daysInMonth = getDaysInMonth(month, year)
  const firstDay = getFirstDayOfMonth(month, year)

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const selectDay = (day: number) => {
    const dateStr = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
    onChange?.(dateStr)
    setOpen(false)
  }

  const isToday = (day: number) => day === today.day && month === today.month && year === today.year
  const isSelected = (day: number) => {
    const dateStr = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
    return value === dateStr
  }
  const isHoliday = (day: number) => {
    return !!getIranHoliday(year, month, day)
  }
  const isFriday = (day: number) => {
    const dayOfWeek = (firstDay + day - 1) % 7
    return dayOfWeek === 6 // جمعه
  }

  const calendar = (
    <div style={{ width: 294, userSelect: 'none', direction: 'rtl', padding: 2 }}>
      {/* هدر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 4 }}>
        <Button size="small" icon={<LeftOutlined />} onClick={nextMonth} type="text" />
        <div style={{ display: 'flex', gap: 4 }}>
          <Select
            size="small" value={month} onChange={setMonth} style={{ width: 104 }} popupMatchSelectWidth={false}
            options={PERSIAN_MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
          />
          <Select
            size="small" value={year} onChange={setYear} style={{ width: 84 }} popupMatchSelectWidth={false}
            showSearch optionFilterProp="label"
            options={YEARS.map(y => ({ value: y, label: String(y) }))}
          />
        </div>
        <Button size="small" icon={<RightOutlined />} onClick={prevMonth} type="text" />
      </div>

      {/* روزهای هفته */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {PERSIAN_DAYS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: i === 6 ? '#f5222d' : '#8c8c8c', padding: '4px 0'
          }}>{d}</div>
        ))}
      </div>

      {/* روزها */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: 38, gap: 3 }}>
        {/* خانه‌های خالی اول */}
        {Array(firstDay).fill(null).map((_, i) => <div key={`e-${i}`} style={{ width: '100%', height: 38 }} />)}

        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1
          const holiday = isHoliday(day)
          const friday = isFriday(day)
          const selected = isSelected(day)
          const today_ = isToday(day)

          return (
            <div
              key={day}
              onClick={() => selectDay(day)}
              title={getIranHoliday(year, month, day) || (friday ? 'جمعه' : '')}
              style={{
                width: '100%', height: 38, boxSizing: 'border-box', borderRadius: 6, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 0,
                fontSize: 12, fontWeight: selected || today_ ? 700 : 400,
                background: selected ? '#1677ff' : today_ ? '#e6f4ff' : holiday || friday ? '#fff1f0' : 'transparent',
                color: selected ? 'white' : holiday || friday ? '#f5222d' : '#333',
                border: today_ && !selected ? '1px solid #1677ff' : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#f0f0f0' }}
              onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = holiday || friday ? '#fff1f0' : 'transparent' }}
            >
              {day}
              {(holiday || friday) && <div style={{ width: 4, height: 4, borderRadius: '50%', background: selected ? 'white' : '#f5222d', marginTop: 2 }} />}
            </div>
          )
        })}
      </div>

      {/* راهنما */}
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, color: '#8c8c8c', justifyContent: 'center' }}>
        <span><span style={{ color: '#f5222d' }}>●</span> تعطیل</span>
        <span><span style={{ color: '#1677ff' }}>●</span> امروز</span>
      </div>
    </div>
  )

  return (
    <Popover content={calendar} trigger="click" open={open} onOpenChange={handleOpenChange} placement="bottomRight" overlayStyle={{ maxWidth: 330 }}>
      <div style={{
        border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 11px',
        cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: disabled ? '#f5f5f5' : 'white', minHeight: 32, ...style
      }}>
        <span style={{ color: disabled ? '#bfbfbf' : value ? '#333' : '#bfbfbf', fontSize: 14 }}>
          {value || placeholder || 'انتخاب تاریخ...'}
        </span>
        <CalendarOutlined style={{ color: '#8c8c8c', marginRight: 8 }} />
      </div>
    </Popover>
  )
}
