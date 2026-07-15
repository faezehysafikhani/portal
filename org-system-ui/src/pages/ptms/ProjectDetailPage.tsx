import { useState } from 'react'
import { Card, Row, Col, Tag, Progress, Button, Avatar, Tabs, Table, Modal, Form, Input, Select, Slider, Space, Badge, Steps, Empty, Upload, List, Divider } from 'antd'
import {
  ArrowRightOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  UserOutlined, WarningOutlined, BugOutlined, CheckSquareOutlined,
  FileTextOutlined, DollarOutlined, TeamOutlined, SwapOutlined,
  UploadOutlined, EyeOutlined, PrinterOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ProjectOutlined
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  SAMPLE_PROJECTS, SAMPLE_TASKS, SAMPLE_RISKS, SAMPLE_ISSUES,
  SAMPLE_CHANGES, SAMPLE_DOCUMENTS, getPriorityColor, getStatusColor,
  formatCurrency, USERS
} from './ptmsData'
import type { Task, Risk, Issue, ChangeRequest, TeamMember } from './ptmsData'

const wbsItems = [
  { id: '1', code: '1', title: 'فاز ۱: تحلیل و طراحی', level: 0, type: 'فاز', progress: 100 },
  { id: '2', code: '1.1', title: 'تحلیل نیازمندی‌ها', level: 1, type: 'بسته کاری', progress: 100 },
  { id: '3', code: '1.2', title: 'طراحی معماری', level: 1, type: 'بسته کاری', progress: 100 },
  { id: '4', code: '2', title: 'فاز ۲: پیاده‌سازی', level: 0, type: 'فاز', progress: 45 },
  { id: '5', code: '2.1', title: 'توسعه Backend', level: 1, type: 'بسته کاری', progress: 60 },
  { id: '6', code: '2.2', title: 'توسعه Frontend', level: 1, type: 'بسته کاری', progress: 40 },
  { id: '7', code: '3', title: 'فاز ۳: استقرار', level: 0, type: 'فاز', progress: 0 },
]

const evmData = [
  { month: 'فروردین', PV: 10, EV: 8, AC: 9 },
  { month: 'اردیبهشت', PV: 20, EV: 17, AC: 19 },
  { month: 'خرداد', PV: 35, EV: 28, AC: 32 },
  { month: 'تیر', PV: 50, EV: 42, AC: 48 },
]

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = SAMPLE_PROJECTS.find(p => p.id === id) || SAMPLE_PROJECTS[0]

  const projectTasks = SAMPLE_TASKS.filter(t => t.projectId === project.id)
  const projectRisks = SAMPLE_RISKS.filter(r => r.projectId === project.id)
  const projectIssues = SAMPLE_ISSUES.filter(i => i.projectId === project.id)
  const projectChanges = SAMPLE_CHANGES.filter(c => c.projectId === project.id)
  const projectDocs = SAMPLE_DOCUMENTS.filter(d => d.projectId === project.id)

  const [taskModal, setTaskModal] = useState(false)
  const [riskModal, setRiskModal] = useState(false)
  const [issueModal, setIssueModal] = useState(false)
  const [changeModal, setChangeModal] = useState(false)
  const [memberModal, setMemberModal] = useState(false)
  const [taskForm] = Form.useForm()
  const [riskForm] = Form.useForm()
  const [issueForm] = Form.useForm()
  const [changeForm] = Form.useForm()
  const [memberForm] = Form.useForm()

  const SummaryTab = (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'وضعیت', value: <Tag color={getStatusColor(project.status) as string}>{project.status}</Tag> },
          { label: 'پیشرفت', value: <Progress percent={project.progress} strokeColor="#8B1A6B" style={{ width: 150 }} /> },
          { label: 'بودجه', value: <span style={{ color: '#8B1A6B', fontWeight: 600 }}>{formatCurrency(project.budget)}</span> },
          { label: 'هزینه واقعی', value: <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatCurrency(project.actualCost)}</span> },
        ].map((item, i) => (
          <Col xs={12} md={6} key={i}>
            <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>{item.label}</div>
              {item.value}
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card title="اطلاعات کلی" size="small">
            {[
              { label: 'کد پروژه', value: project.code },
              { label: 'مدیر پروژه', value: project.manager },
              { label: 'حامی پروژه', value: project.sponsor || '—' },
              { label: 'نوع پروژه', value: project.type },
              { label: 'روش اجرا', value: project.method },
              { label: 'تاریخ شروع', value: project.startDate },
              { label: 'تاریخ پایان', value: project.endDate },
              { label: 'اولویت', value: <Tag color={getPriorityColor(project.priority) as string}>{project.priority}</Tag> },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: '#8c8c8c' }}>{item.label}:</span>
                <span style={{ fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="نمودار EVM" size="small">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evmData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis />
                <RTooltip />
                <Legend />
                <Line type="monotone" dataKey="PV" stroke="#1677ff" name="برنامه" strokeWidth={2} />
                <Line type="monotone" dataKey="EV" stroke="#52c41a" name="کسب شده" strokeWidth={2} />
                <Line type="monotone" dataKey="AC" stroke="#f5222d" name="واقعی" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  )

  const WBSTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} size="small" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>افزودن آیتم</Button>
      </div>
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 150px 60px', padding: '8px 12px', background: '#fafafa', fontSize: 12, fontWeight: 600, color: '#8c8c8c' }}>
          <div>کد WBS</div><div>عنوان</div><div>نوع</div><div>پیشرفت</div><div></div>
        </div>
        {wbsItems.map(item => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 150px 60px', padding: '10px 12px', borderTop: '1px solid #f0f0f0', alignItems: 'center', background: item.level === 0 ? '#fafafa' : 'white' }}>
            <Tag color="purple" style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.code}</Tag>
            <div style={{ paddingRight: item.level * 20, fontWeight: item.level === 0 ? 600 : 400, fontSize: 13 }}>
              {item.level === 0 ? '📁' : '📄'} {item.title}
            </div>
            <Tag color={item.type === 'فاز' ? 'blue' : 'green'} style={{ fontSize: 10 }}>{item.type}</Tag>
            <Progress percent={item.progress} size="small" strokeColor="#8B1A6B" />
            <Space>
              <Button size="small" icon={<EditOutlined />} type="text" />
              <Button size="small" icon={<DeleteOutlined />} type="text" danger />
            </Space>
          </div>
        ))}
      </div>
    </div>
  )

  const TasksTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space>
          {['همه', 'جدید', 'در حال انجام', 'تکمیل شده'].map(s => (
            <Tag key={s} style={{ cursor: 'pointer', padding: '3px 10px' }}>{s} ({s === 'همه' ? projectTasks.length : projectTasks.filter(t => t.status === s).length})</Tag>
          ))}
        </Space>
        <Button type="primary" icon={<PlusOutlined />} size="small" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setTaskModal(true)}>وظیفه جدید</Button>
      </div>
      {projectTasks.length === 0 ? <Empty description="وظیفه‌ای ثبت نشده" /> : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 100px 100px 120px 80px', padding: '8px 12px', background: '#fafafa', fontSize: 12, fontWeight: 600, color: '#8c8c8c' }}>
            <div>کد</div><div>عنوان</div><div>مسئول</div><div>اولویت</div><div>وضعیت</div><div>مهلت</div><div>پیشرفت</div>
          </div>
          {projectTasks.map(t => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px 100px 100px 120px 80px', padding: '10px 12px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
              <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 10 }}>{t.code}</Tag>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
              <Space><Avatar size={22} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} /><span style={{ fontSize: 11 }}>{t.assignee}</span></Space>
              <Tag color={getPriorityColor(t.priority) as string} style={{ fontSize: 10 }}>{t.priority}</Tag>
              <Tag color={getStatusColor(t.status) as string} style={{ fontSize: 10 }}>{t.status}</Tag>
              <span style={{ fontSize: 11, color: '#8c8c8c' }}>{t.deadline || '—'}</span>
              <Progress percent={t.progress} size="small" strokeColor="#8B1A6B" />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const TeamTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ color: '#8c8c8c', fontSize: 13 }}>اعضای تیم پروژه</span>
        <Button type="primary" icon={<PlusOutlined />} size="small" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setMemberModal(true)}>افزودن عضو</Button>
      </div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {project.team.map(m => (
          <Col key={m.id} xs={24} md={8}>
            <Card size="small" style={{ borderRadius: 10, borderTop: '3px solid #8B1A6B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Avatar size={40} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                  <Tag color="blue" style={{ fontSize: 10 }}>{m.role}</Tag>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>تخصیص: <strong style={{ color: '#8B1A6B' }}>{m.allocation}%</strong></div>
              <Progress percent={m.allocation} size="small" strokeColor="#8B1A6B" showInfo={false} />
            </Card>
          </Col>
        ))}
      </Row>

      <Divider>ماتریس RACI</Divider>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #f0f0f0' }}>فعالیت</th>
              {project.team.map(m => <th key={m.id} style={{ padding: '8px 12px', border: '1px solid #f0f0f0', minWidth: 80 }}>{m.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {wbsItems.filter(w => w.level > 0).map(w => (
              <tr key={w.id}>
                <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0', fontWeight: 500 }}>{w.title}</td>
                {project.team.map((m, i) => (
                  <td key={m.id} style={{ padding: '8px 12px', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                    <Tag color={i === 0 ? 'red' : i === 1 ? 'blue' : 'green'} style={{ margin: 0, cursor: 'pointer' }}>
                      {i === 0 ? 'R' : i === 1 ? 'A' : 'C'}
                    </Tag>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const FinancialTab = (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'بودجه کل (BAC)', value: formatCurrency(project.budget), color: '#1677ff' },
          { label: 'هزینه واقعی (AC)', value: formatCurrency(project.actualCost), color: '#fa8c16' },
          { label: 'ارزش کسب شده (EV)', value: formatCurrency(project.budget * project.progress / 100), color: '#52c41a' },
          { label: 'انحراف هزینه (CV)', value: formatCurrency(project.budget * project.progress / 100 - project.actualCost), color: project.actualCost > project.budget * project.progress / 100 ? '#f5222d' : '#52c41a' },
        ].map((item, i) => (
          <Col xs={12} md={6} key={i}>
            <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${item.color}` }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</div>
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={16}>
        {[
          { label: 'CPI (شاخص عملکرد هزینه)', value: (project.budget * project.progress / 100 / (project.actualCost || 1)).toFixed(2) },
          { label: 'SPI (شاخص عملکرد زمان)', value: '0.92' },
        ].map((item, i) => {
          const good = parseFloat(item.value) >= 1
          return (
            <Col key={i} span={12}>
              <div style={{ padding: 12, background: good ? '#f6ffed' : '#fff1f0', borderRadius: 8, border: `1px solid ${good ? '#b7eb8f' : '#ffa39e'}` }}>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: good ? '#52c41a' : '#f5222d' }}>{item.value}</div>
                <div style={{ fontSize: 11, color: good ? '#52c41a' : '#f5222d' }}>{good ? '✅ مطلوب' : '⚠️ نیاز به توجه'}</div>
              </div>
            </Col>
          )
        })}
      </Row>
    </div>
  )

  const RisksTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#8c8c8c' }}>{projectRisks.length} ریسک</span>
        <Button type="primary" icon={<PlusOutlined />} size="small" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setRiskModal(true)}>ریسک جدید</Button>
      </div>
      {projectRisks.length === 0 ? <Empty description="ریسکی ثبت نشده" /> : (
        projectRisks.map((r, i) => (
          <div key={r.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa', borderRight: `4px solid ${r.level === 'بحرانی' ? '#f5222d' : r.level === 'بالا' ? '#fa8c16' : '#fadb14'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Tag color="orange" style={{ fontSize: 10 }}>{r.code}</Tag>
                <span style={{ fontWeight: 500 }}>{r.title}</span>
                <Tag color={r.level === 'بحرانی' ? 'red' : r.level === 'بالا' ? 'orange' : 'gold'}>{r.level}</Tag>
              </Space>
              <div style={{ fontSize: 18, fontWeight: 700, color: r.score >= 16 ? '#f5222d' : '#fa8c16' }}>{r.score}</div>
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 6 }}>{r.description}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
              <span>احتمال: {r.probability}/5</span>
              <span>شدت: {r.impact}/5</span>
              <span>استراتژی: {r.strategy}</span>
              <span>مسئول: {r.owner}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const IssuesTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#8c8c8c' }}>{projectIssues.length} مسئله</span>
        <Button type="primary" icon={<PlusOutlined />} size="small" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setIssueModal(true)}>مسئله جدید</Button>
      </div>
      {projectIssues.length === 0 ? <Empty description="مسئله‌ای ثبت نشده" /> : (
        projectIssues.map(issue => (
          <Card key={issue.id} size="small" style={{ marginBottom: 8, borderRight: `4px solid ${issue.priority === 'بحرانی' ? '#f5222d' : '#fa8c16'}` }}>
            <Space>
              <Tag color="blue" style={{ fontSize: 10 }}>{issue.code}</Tag>
              <span style={{ fontWeight: 500 }}>{issue.title}</span>
              <Tag color={getPriorityColor(issue.priority) as string}>{issue.priority}</Tag>
              <Tag color={issue.status === 'باز' ? 'red' : issue.status === 'حل شده' ? 'green' : 'orange'}>{issue.status}</Tag>
            </Space>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 6 }}>{issue.description}</div>
          </Card>
        ))
      )}
    </div>
  )

  const ChangesTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#8c8c8c' }}>{projectChanges.length} درخواست تغییر</span>
        <Button type="primary" icon={<PlusOutlined />} size="small" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }} onClick={() => setChangeModal(true)}>درخواست تغییر</Button>
      </div>
      {projectChanges.length === 0 ? <Empty description="درخواست تغییری ثبت نشده" /> : (
        projectChanges.map(c => (
          <Card key={c.id} size="small" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Tag color="purple" style={{ fontSize: 10 }}>{c.code}</Tag>
                <span style={{ fontWeight: 500 }}>{c.title}</span>
                <Tag color={getPriorityColor(c.priority) as string}>{c.priority}</Tag>
              </Space>
              <Tag color={c.status === 'تأیید شده' ? 'green' : c.status === 'رد شده' ? 'red' : 'orange'}>{c.status}</Tag>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
              <span>تأثیر زمانی: {c.timeImpact} روز</span>
              <span>تأثیر مالی: {formatCurrency(c.costImpact)}</span>
            </div>
          </Card>
        ))
      )}
    </div>
  )

  const DocumentsTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#8c8c8c' }}>{projectDocs.length} مستند</span>
        <Upload beforeUpload={() => false} showUploadList={false}>
          <Button type="primary" icon={<UploadOutlined />} size="small" style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>آپلود</Button>
        </Upload>
      </div>
      {projectDocs.length === 0 ? <Empty description="مستندی آپلود نشده" /> : (
        <List dataSource={projectDocs} renderItem={doc => (
          <List.Item actions={[<Button size="small" icon={<EyeOutlined />} />, <Button size="small" icon={<DeleteOutlined />} danger />]}>
            <List.Item.Meta
              avatar={<Avatar icon={<FileTextOutlined />} style={{ background: '#8B1A6B' }} />}
              title={<Space>{doc.title}<Tag style={{ fontSize: 10 }}>{doc.category}</Tag><Tag color="blue" style={{ fontSize: 10 }}>v{doc.version}</Tag></Space>}
              description={`${doc.uploader} — ${doc.uploadDate} — ${doc.size}`}
            />
          </List.Item>
        )} />
      )}
    </div>
  )

  const CharterTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#8c8c8c' }}>منشور پروژه</span>
        <Space>
          <Button size="small" icon={<PrinterOutlined />}>چاپ</Button>
          <Button type="primary" size="small" icon={<EditOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>ویرایش</Button>
        </Space>
      </div>
      <Card size="small">
        {[
          { label: 'نام پروژه', value: project.name },
          { label: 'مدیر پروژه', value: project.manager },
          { label: 'حامی پروژه', value: project.sponsor || '—' },
          { label: 'بیان مسئله', value: 'نیاز به یکپارچه‌سازی فرآیندهای سازمانی' },
          { label: 'اهداف پروژه', value: 'طراحی و پیاده‌سازی سامانه یکپارچه سازمانی' },
          { label: 'بودجه تقریبی', value: formatCurrency(project.budget) },
        ].map((item, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 13 }}>{item.value}</div>
          </div>
        ))}
      </Card>
    </div>
  )

  return (
    <div>
      <Card style={{ marginBottom: 12, borderRadius: 12 }} styles={{ body: { padding: '12px 20px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/ptms/projects')}>بازگشت</Button>
            <div>
              <Space>
                <Tag color="purple" style={{ fontFamily: 'monospace' }}>{project.code}</Tag>
                <h3 style={{ margin: 0, fontSize: 16 }}>{project.name}</h3>
                <Tag color={getStatusColor(project.status) as string}>{project.status}</Tag>
                <Tag color={getPriorityColor(project.priority) as string}>{project.priority}</Tag>
              </Space>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                👤 {project.manager} | 📅 {project.startDate} تا {project.endDate}
              </div>
            </div>
          </div>
          <Progress type="circle" percent={project.progress} size={60} strokeColor="#8B1A6B" />
        </div>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Tabs items={[
          { key: '1', label: <span><ProjectOutlined /> خلاصه</span>, children: SummaryTab },
          { key: '2', label: <span><FileTextOutlined /> WBS</span>, children: WBSTab },
          { key: '3', label: <span><CheckSquareOutlined /> وظایف <Badge count={projectTasks.length} style={{ background: '#8B1A6B' }} /></span>, children: TasksTab },
          { key: '4', label: <span><TeamOutlined /> تیم</span>, children: TeamTab },
          { key: '5', label: <span><DollarOutlined /> مالی</span>, children: FinancialTab },
          { key: '6', label: <span><WarningOutlined /> ریسک‌ها <Badge count={projectRisks.length} style={{ background: '#fa8c16' }} /></span>, children: RisksTab },
          { key: '7', label: <span><BugOutlined /> مسائل <Badge count={projectIssues.length} style={{ background: '#f5222d' }} /></span>, children: IssuesTab },
          { key: '8', label: <span><SwapOutlined /> تغییرات</span>, children: ChangesTab },
          { key: '9', label: <span><FileTextOutlined /> مستندات</span>, children: DocumentsTab },
          { key: '10', label: <span><FileTextOutlined /> منشور</span>, children: CharterTab },
        ]} />
      </Card>

      {/* Modal وظیفه */}
      <Modal title="وظیفه جدید" open={taskModal} onOk={() => setTaskModal(false)} onCancel={() => setTaskModal(false)} okText="ذخیره" cancelText="انصراف" width={600} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={taskForm} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="title" label="عنوان" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="type" label="نوع" initialValue="وظیفه"><Select>{['وظیفه', 'باگ', 'بهبود', 'بازبینی'].map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="assignee" label="مسئول" rules={[{ required: true }]}><Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="priority" label="اولویت" initialValue="متوسط"><Select>{['بحرانی', 'بالا', 'متوسط', 'پایین'].map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="deadline" label="مهلت"><Input placeholder="۱۴۰۳/۰۵/۳۱" /></Form.Item></Col>
            <Col span={12}><Form.Item name="estimatedHours" label="زمان برآوردی (ساعت)"><Input type="number" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="توضیحات"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal ریسک */}
      <Modal title="ریسک جدید" open={riskModal} onOk={() => setRiskModal(false)} onCancel={() => setRiskModal(false)} okText="ذخیره" cancelText="انصراف" width={600} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={riskForm} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="title" label="عنوان ریسک" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="دسته‌بندی"><Select>{['فنی', 'مالی', 'سازمانی', 'خارجی'].map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={8}><Form.Item name="probability" label="احتمال (1-5)"><Select>{[1,2,3,4,5].map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={8}><Form.Item name="impact" label="شدت اثر (1-5)"><Select>{[1,2,3,4,5].map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={8}><Form.Item name="strategy" label="استراتژی"><Select>{['اجتناب', 'کاهش', 'انتقال', 'پذیرش'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="owner" label="مسئول"><Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="شرح ریسک"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal مسئله */}
      <Modal title="مسئله جدید" open={issueModal} onOk={() => setIssueModal(false)} onCancel={() => setIssueModal(false)} okText="ذخیره" cancelText="انصراف" width={500} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={issueForm} layout="vertical">
          <Row gutter={12}>
            <Col span={24}><Form.Item name="title" label="عنوان مسئله" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="priority" label="اولویت" initialValue="متوسط"><Select>{['بحرانی', 'بالا', 'متوسط', 'پایین'].map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="severity" label="شدت" initialValue="جزئی"><Select>{['مسدودکننده', 'عمده', 'جزئی'].map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="assignee" label="مسئول"><Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="deadline" label="مهلت"><Input placeholder="۱۴۰۳/۰۵/۳۱" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="شرح مسئله"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal تغییر */}
      <Modal title="درخواست تغییر" open={changeModal} onOk={() => setChangeModal(false)} onCancel={() => setChangeModal(false)} okText="ذخیره" cancelText="انصراف" width={600} okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={changeForm} layout="vertical">
          <Row gutter={12}>
            <Col span={16}><Form.Item name="title" label="عنوان تغییر" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="priority" label="اولویت" initialValue="متوسط"><Select>{['بحرانی', 'بالا', 'متوسط', 'پایین'].map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="timeImpact" label="تأثیر زمانی (روز)"><Input type="number" /></Form.Item></Col>
            <Col span={12}><Form.Item name="costImpact" label="تأثیر مالی (ریال)"><Input type="number" /></Form.Item></Col>
            <Col span={24}><Form.Item name="description" label="شرح تغییر"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal عضو تیم */}
      <Modal title="افزودن عضو تیم" open={memberModal} onOk={() => setMemberModal(false)} onCancel={() => setMemberModal(false)} okText="افزودن" cancelText="انصراف" okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' } }}>
        <Form form={memberForm} layout="vertical">
          <Form.Item name="name" label="نام عضو" rules={[{ required: true }]}><Select>{USERS.map(u => <Select.Option key={u} value={u}>{u}</Select.Option>)}</Select></Form.Item>
          <Form.Item name="role" label="نقش" rules={[{ required: true }]}><Select>{['مدیر پروژه', 'کارشناس فنی', 'تحلیلگر', 'طراح', 'برنامه‌نویس', 'تستر'].map(r => <Select.Option key={r} value={r}>{r}</Select.Option>)}</Select></Form.Item>
          <Form.Item name="allocation" label="درصد تخصیص"><Slider marks={{ 0: '0%', 50: '50%', 100: '100%' }} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="startDate" label="تاریخ شروع"><Input placeholder="۱۴۰۳/۰۱/۰۱" /></Form.Item></Col>
            <Col span={12}><Form.Item name="endDate" label="تاریخ پایان"><Input placeholder="اختیاری" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}