import { Empty } from 'antd'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const DEFAULT_COLORS = ['#8b1a6b', '#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1']
const faNumber = new Intl.NumberFormat('fa-IR')

export interface ManagerDonutItem {
  name: string
  value: number
  color?: string
}

interface Props {
  items?: ManagerDonutItem[]
  formatLabel?: (name: string) => string
  centerValue?: string | number
  centerLabel?: string
  height?: number
}

export default function ManagerDonutChart({
  items = [],
  formatLabel = value => value,
  centerValue,
  centerLabel = 'مجموع',
  height = 190,
}: Props) {
  const normalized = items
    .map((item, index) => ({ ...item, value: Number(item.value) || 0, color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length] }))
    .filter(item => item.value > 0)
  const total = normalized.reduce((sum, item) => sum + item.value, 0)

  if (!normalized.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="داده‌ای برای نمایش وجود ندارد" />

  return (
    <div dir="rtl">
      <div style={{ height, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={normalized}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="#fff"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {normalized.map(item => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip
              formatter={(value, name) => [faNumber.format(Number(value) || 0), formatLabel(String(name))]}
              contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #eee', boxShadow: '0 8px 24px #00000012' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <strong style={{ fontSize: 25, lineHeight: 1.15, color: '#262626' }}>{centerValue ?? faNumber.format(total)}</strong>
          <span style={{ marginTop: 4, fontSize: 11, color: '#8c8c8c' }}>{centerLabel}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px', marginTop: 2 }}>
        {normalized.map(item => {
          const percent = total ? Math.round((item.value / total) * 100) : 0
          return (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, padding: '6px 8px', borderRadius: 8, background: '#fafafa' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flex: '0 0 auto' }} />
              <span title={formatLabel(item.name)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: '#595959' }}>{formatLabel(item.name)}</span>
              <b style={{ fontSize: 11, color: '#262626', whiteSpace: 'nowrap' }}>{faNumber.format(item.value)} <small style={{ color: '#999', fontWeight: 400 }}>({faNumber.format(percent)}٪)</small></b>
            </div>
          )
        })}
      </div>
    </div>
  )
}
