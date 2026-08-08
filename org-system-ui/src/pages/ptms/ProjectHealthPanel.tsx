import { Card, Col, Progress, Row, Select, Space, Statistic, Table, Tag, Timeline } from 'antd'
import { AlertOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SAMPLE_PROJECTS } from './ptmsData'

interface Props { projectId: string; onProjectChange: (value: string) => void }

const factors = [
  { key: '1', title: 'درصد وظایف عقب‌افتاده', value: '۱۸٪', score: 72, reason: '۳ وظیفه از موعد گذشته' },
  { key: '2', title: 'تأخیر نقاط عطف', value: '۷ روز', score: 64, reason: 'تحویل نسخه آزمایشی' },
  { key: '3', title: 'موانع حل‌نشده', value: '۲ مورد', score: 58, reason: 'یک مانع بحرانی' },
  { key: '4', title: 'وابستگی‌های در معرض خطر', value: '۳ مورد', score: 61, reason: 'وابستگی میان‌پروژه‌ای' },
  { key: '5', title: 'اضافه‌بار اعضای تیم', value: '۱ نفر', score: 48, reason: '۱۱۷٪ تخصیص' },
  { key: '6', title: 'نبود فعالیت در پروژه', value: '۰ روز', score: 12, reason: 'فعالیت عادی' },
  { key: '7', title: 'نقض تعهد زمانی خدمت', value: '۱ مورد', score: 55, reason: 'SLA بحرانی' },
  { key: '8', title: 'تغییر مکرر موعدها', value: '۴ بار', score: 67, reason: 'در ۳۰ روز اخیر' },
  { key: '9', title: 'تأخیر در تأییدها', value: '۲ روز', score: 38, reason: 'یک تأیید باز' },
  { key: '10', title: 'اختلاف پیشرفت واقعی با برنامه', value: '۵٪', score: 50, reason: '۴۵٪ واقعی / ۵۰٪ برنامه' },
]

const trend = [{ n: 'هفته ۱', v: 82 }, { n: 'هفته ۲', v: 78 }, { n: 'هفته ۳', v: 74 }, { n: 'هفته ۴', v: 68 }, { n: 'اکنون', v: 64 }]

export default function ProjectHealthPanel({ projectId, onProjectChange }: Props) {
  const project = SAMPLE_PROJECTS.find(p => p.id === projectId) || SAMPLE_PROJECTS[0]
  const health = project.id === '2' ? 82 : project.id === '3' ? 39 : 64
  const status = health >= 75 ? 'سبز' : health >= 50 ? 'نیازمند توجه' : 'پرریسک'
  const color = health >= 75 ? '#52c41a' : health >= 50 ? '#fa8c16' : '#f5222d'
  return (
    <Card style={{ borderRadius: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>مدیریت ریسک و سلامت پروژه</h2>
        <Space><span style={{ color: '#8c8c8c', fontSize: 12 }}>پروژه فعال:</span><Select value={projectId} onChange={onProjectChange} style={{ width: 260 }} options={SAMPLE_PROJECTS.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))} /></Space>
      </div>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={6}><Card size="small"><Statistic title="شاخص سلامت پروژه" value={health} suffix="از ۱۰۰" prefix={status === 'سبز' ? <CheckCircleOutlined /> : status === 'پرریسک' ? <AlertOutlined /> : <WarningOutlined />} valueStyle={{ color }} /><Tag color={status === 'سبز' ? 'green' : status === 'پرریسک' ? 'red' : 'orange'}>{status}</Tag></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="پایان پیش‌بینی‌شده" value="۱۴۰۴/۰۱/۱۲" prefix={<ClockCircleOutlined />} /><div style={{ fontSize: 11, color: '#8c8c8c' }}>محدوده اطمینان: ۱۴۰۴/۰۱/۰۵ تا ۱۴۰۴/۰۱/۲۲</div></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="پیشرفت برنامه‌ریزی‌شده" value={50} suffix="٪" /><Progress percent={50} showInfo={false} size="small" /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="پیشرفت واقعی" value={project.progress} suffix="٪" /><Progress percent={project.progress} showInfo={false} size="small" strokeColor={color} /></Card></Col>
      </Row>
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={10}><Card size="small" title="روند تغییر سلامت"><ResponsiveContainer width="100%" height={180}><LineChart data={trend}><XAxis dataKey="n" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="v" stroke="#8B1A6B" strokeWidth={3} /></LineChart></ResponsiveContainer></Card></Col>
        <Col xs={24} lg={14}><Card size="small" title="دلایل وضعیت و اقدام اصلاحی"><Timeline items={[
          { color: 'orange', children: 'وظایف عقب‌افتاده — بازتخصیص دو وظیفه به عضو آزاد پیشنهاد می‌شود.' },
          { color: 'red', children: 'نقطه عطف ازدست‌رفته — خط مبنا و تاریخ تحویل بازبینی شود.' },
          { color: 'blue', children: 'تأخیر تأیید — تشدید خودکار به مدیر پروژه فعال شود.' },
          { color: 'green', children: 'پروژه در ۲۴ ساعت گذشته فعالیت داشته است.' },
        ]} /></Card></Col>
      </Row>
      <Card size="small" title="عوامل امتیاز سلامت (قابل تنظیم)" style={{ marginTop: 12 }}>
        <Table size="small" rowKey="key" pagination={false} dataSource={factors} columns={[
          { title: 'شاخص', dataIndex: 'title' }, { title: 'مقدار', dataIndex: 'value', width: 110 }, { title: 'دلیل', dataIndex: 'reason' },
          { title: 'اثر ریسک', dataIndex: 'score', width: 180, render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 65 ? '#f5222d' : v >= 45 ? '#fa8c16' : '#52c41a'} /> },
        ]} scroll={{ x: 720 }} />
      </Card>
      <Card size="small" title="سلامت سبد پروژه‌ها" style={{ marginTop: 12 }}>
        <Space wrap>{SAMPLE_PROJECTS.map((p, i) => { const value = [64, 82, 39][i]; return <Tag key={p.id} color={value >= 75 ? 'green' : value >= 50 ? 'orange' : 'red'}>{p.name}: {value}</Tag> })}<Tag color="red">فیلتر: پروژه‌های پرریسک</Tag></Space>
      </Card>
    </Card>
  )
}
