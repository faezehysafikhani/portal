import { useState } from 'react'
import { Card, Row, Col, Select, Button, Table, Tag, Progress, Space, Tabs } from 'antd'
import { DownloadOutlined, PrinterOutlined, BarChartOutlined, FileTextOutlined } from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { SAMPLE_PROJECTS, SAMPLE_TASKS, SAMPLE_RISKS, getStatusColor, getPriorityColor, formatCurrency } from './ptmsData'

const COLORS = ['#8B1A6B', '#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1']

export default function PTMSReportsPage() {
  const [filterProject, setFilterProject] = useState('')

  const projectStatusData = [
    { name: 'در حال اجرا', value: SAMPLE_PROJECTS.filter(p => p.status === 'در حال اجرا').length },
    { name: 'تعریف شده', value: SAMPLE_PROJECTS.filter(p => p.status === 'تعریف شده').length },
    { name: 'تکمیل شده', value: SAMPLE_PROJECTS.filter(p => p.status === 'تکمیل شده').length },
    { name: 'تعلیق', value: SAMPLE_PROJECTS.filter(p => p.status === 'تعلیق').length },
  ].filter(d => d.value > 0)

  const taskStatusData = [
    { name: 'جدید', value: SAMPLE_TASKS.filter(t => t.status === 'جدید').length },
    { name: 'در حال انجام', value: SAMPLE_TASKS.filter(t => t.status === 'در حال انجام').length },
    { name: 'بازبینی', value: SAMPLE_TASKS.filter(t => t.status === 'در انتظار بازبینی').length },
    { name: 'تکمیل', value: SAMPLE_TASKS.filter(t => t.status === 'تکمیل شده').length },
  ]

  const progressData = SAMPLE_PROJECTS.map(p => ({ name: p.code, برنامه: 100, واقعی: p.progress }))

  const budgetData = SAMPLE_PROJECTS.map(p => ({
    name: p.code,
    بودجه: Math.round(p.budget / 1000000),
    هزینه: Math.round(p.actualCost / 1000000),
  }))

  const riskData = [
    { subject: 'فنی', A: SAMPLE_RISKS.filter(r => r.category === 'فنی').length },
    { subject: 'مالی', A: SAMPLE_RISKS.filter(r => r.category === 'مالی').length },
    { subject: 'سازمانی', A: SAMPLE_RISKS.filter(r => r.category === 'سازمانی').length },
    { subject: 'خارجی', A: SAMPLE_RISKS.filter(r => r.category === 'خارجی').length },
    { subject: 'زمانبندی', A: SAMPLE_RISKS.filter(r => r.category === 'زمانبندی').length },
  ]

  const performanceData = SAMPLE_PROJECTS.map(p => ({
    month: p.code, پیشرفت: p.progress, بودجه: Math.round(p.actualCost / p.budget * 100)
  }))

  const projectColumns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{c}</Tag> },
    { title: 'نام پروژه', dataIndex: 'name', key: 'name', render: (n: string) => <span style={{ fontWeight: 500 }}>{n}</span> },
    { title: 'مدیر', dataIndex: 'manager', key: 'manager', width: 120 },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 120, render: (s: string) => <Tag color={getStatusColor(s as any) as string}>{s}</Tag> },
    { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', width: 150, render: (p: number) => <Progress percent={p} size="small" strokeColor="#8B1A6B" /> },
    { title: 'بودجه', dataIndex: 'budget', key: 'budget', width: 150, render: (b: number) => <span style={{ fontSize: 11 }}>{formatCurrency(b)}</span> },
    { title: 'هزینه واقعی', dataIndex: 'actualCost', key: 'actualCost', width: 150, render: (a: number) => <span style={{ fontSize: 11, color: '#fa8c16' }}>{formatCurrency(a)}</span> },
  ]

  const taskColumns = [
    { title: 'کد', dataIndex: 'code', key: 'code', width: 100, render: (c: string) => <Tag color="blue" style={{ fontFamily: 'monospace' }}>{c}</Tag> },
    { title: 'عنوان', dataIndex: 'title', key: 'title' },
    { title: 'پروژه', dataIndex: 'project', key: 'project', width: 180 },
    { title: 'مسئول', dataIndex: 'assignee', key: 'assignee', width: 120 },
    { title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 90, render: (p: string) => <Tag color={getPriorityColor(p as any) as string}>{p}</Tag> },
    { title: 'وضعیت', dataIndex: 'status', key: 'status', width: 150, render: (s: string) => <Tag color={getStatusColor(s as any) as string}>{s}</Tag> },
    { title: 'پیشرفت', dataIndex: 'progress', key: 'progress', width: 120, render: (p: number) => <Progress percent={p} size="small" strokeColor="#8B1A6B" /> },
  ]

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Select placeholder="فیلتر پروژه" style={{ width: 200 }} value={filterProject || undefined} onChange={setFilterProject} allowClear>
              {SAMPLE_PROJECTS.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Space>
          <Space>
            <Button icon={<PrinterOutlined />}>چاپ</Button>
            <Button icon={<DownloadOutlined />} type="primary" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>خروجی Excel</Button>
          </Space>
        </div>
      </Card>

      <Tabs items={[
        {
          key: '1',
          label: <span><BarChartOutlined /> داشبورد تحلیلی</span>,
          children: (
            <div>
              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                {[
                  { label: 'کل پروژه‌ها', value: SAMPLE_PROJECTS.length, color: '#8B1A6B' },
                  { label: 'پروژه‌های فعال', value: SAMPLE_PROJECTS.filter(p => p.status === 'در حال اجرا').length, color: '#1677ff' },
                  { label: 'کل وظایف', value: SAMPLE_TASKS.length, color: '#52c41a' },
                  { label: 'ریسک‌های بحرانی', value: SAMPLE_RISKS.filter(r => r.level === 'بحرانی').length, color: '#f5222d' },
                ].map((s, i) => (
                  <Col xs={12} md={6} key={i}>
                    <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{s.label}</div>
                    </Card>
                  </Col>
                ))}
              </Row>

              <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                <Col xs={24} md={8}>
                  <Card title="وضعیت پروژه‌ها" size="small">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={projectStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {projectStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card title="وضعیت وظایف" size="small">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={taskStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {taskStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card title="توزیع ریسک‌ها" size="small">
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={riskData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                        <Radar dataKey="A" stroke="#8B1A6B" fill="#8B1A6B" fillOpacity={0.3} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Card title="پیشرفت پروژه‌ها (برنامه vs واقعی)" size="small">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="برنامه" fill="#1677ff" />
                        <Bar dataKey="واقعی" fill="#8B1A6B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="بودجه vs هزینه (میلیون ریال)" size="small">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={budgetData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="بودجه" fill="#1677ff" />
                        <Bar dataKey="هزینه" fill="#fa8c16" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>
            </div>
          )
        },
        {
          key: '2',
          label: <span><FileTextOutlined /> گزارش پروژه‌ها</span>,
          children: (
            <Card>
              <Table columns={projectColumns} dataSource={SAMPLE_PROJECTS} rowKey="id" scroll={{ x: 1000 }} />
            </Card>
          )
        },
        {
          key: '3',
          label: <span><FileTextOutlined /> گزارش وظایف</span>,
          children: (
            <Card>
              <Table columns={taskColumns} dataSource={SAMPLE_TASKS} rowKey="id" scroll={{ x: 1000 }} />
            </Card>
          )
        },
        {
          key: '4',
          label: <span><FileTextOutlined /> گزارش عملکرد</span>,
          children: (
            <Card title="روند عملکرد پروژه‌ها">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="پیشرفت" stroke="#8B1A6B" strokeWidth={2} />
                  <Line type="monotone" dataKey="بودجه" stroke="#fa8c16" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )
        },
      ]} />
    </div>
  )
}