import { useEffect, useState } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, Space, Avatar, Rate, Divider, Badge, message, Card, Row, Col } from 'antd'
import { PlusOutlined, EyeOutlined, UserOutlined, SendOutlined, CheckCircleOutlined } from '@ant-design/icons'

interface Ticket {
  id: string
  number: string
  title: string
  customer: string
  category: string
  status: 'open' | 'inprogress' | 'waiting' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'critical'
  assignee?: string
  assigneeId?: string
  date: string
  satisfaction?: number
  description?: string
  messages: TicketMessage[]
}

interface TicketMessage {
  id: string
  sender: 'customer' | 'support'
  senderName: string
  content: string
  time: string
}

const STATUS_CONFIG = {
  open: { label: 'باز', color: 'blue' },
  inprogress: { label: 'در حال بررسی', color: 'orange' },
  waiting: { label: 'در انتظار', color: 'gold' },
  resolved: { label: 'حل شده', color: 'green' },
  closed: { label: 'بسته', color: 'default' },
}

const PRIORITY_CONFIG = {
  low: { label: 'کم', color: 'default' },
  normal: { label: 'معمولی', color: 'blue' },
  high: { label: 'زیاد', color: 'orange' },
  critical: { label: 'بحرانی', color: 'red' },
}
const codePattern=/<[^>]*>|javascript\s*:|--|\/\*|\*\/|;\s*(select|insert|update|delete|drop|alter|exec)|\bunion\s+select/i
const safeRule={validator:(_:unknown,value?:string)=>!value||!codePattern.test(value)?Promise.resolve():Promise.reject(new Error('ورود کد HTML، JavaScript یا SQL مجاز نیست'))}

const USERS = ['علی محمدی', 'مریم احمدی', 'رضا کریمی', 'مدیر سیستم']

const INITIAL_TICKETS: Ticket[] = [
  {
    id: '1', number: 'TKT-001', title: 'مشکل در ورود به سیستم',
    customer: 'شرکت آلفا', category: 'فنی', status: 'open',
    priority: 'critical', date: '۱۴۰۳/۰۴/۱۵',
    description: 'کاربر نمیتواند وارد سیستم شود و خطای ۴۰۳ دریافت می‌کند.',
    messages: [
      { id: '1', sender: 'customer', senderName: 'شرکت آلفا', content: 'سلام، نمیتونم وارد سیستم بشم. خطای ۴۰۳ میده.', time: '۱۴۰۳/۰۴/۱۵ ۱۰:۰۰' },
    ]
  },
  {
    id: '2', number: 'TKT-002', title: 'درخواست گزارش ماهانه',
    customer: 'شرکت بتا', category: 'گزارش', status: 'inprogress',
    priority: 'normal', assignee: 'مریم احمدی', date: '۱۴۰۳/۰۴/۱۴',
    description: 'نیاز به گزارش ماهانه فروش دارند.',
    messages: [
      { id: '1', sender: 'customer', senderName: 'شرکت بتا', content: 'لطفاً گزارش ماهانه فروش را ارسال کنید.', time: '۱۴۰۳/۰۴/۱۴ ۰۹:۰۰' },
      { id: '2', sender: 'support', senderName: 'مریم احمدی', content: 'در حال آماده‌سازی هستیم، تا فردا ارسال می‌شود.', time: '۱۴۰۳/۰۴/۱۴ ۱۰:۳۰' },
    ]
  },
  {
    id: '3', number: 'TKT-003', title: 'خطا در پرداخت فاکتور',
    customer: 'شرکت گاما', category: 'مالی', status: 'resolved',
    priority: 'high', date: '۱۴۰۳/۰۴/۱۳', satisfaction: 4,
    description: 'خطا در پرداخت فاکتور شماره ۱۲۳۴',
    messages: [
      { id: '1', sender: 'customer', senderName: 'شرکت گاما', content: 'خطا در پرداخت فاکتور داریم.', time: '۱۴۰۳/۰۴/۱۳ ۰۸:۰۰' },
      { id: '2', sender: 'support', senderName: 'علی محمدی', content: 'مشکل برطرف شد.', time: '۱۴۰۳/۰۴/۱۳ ۱۲:۰۰' },
    ]
  },
  {
    id: '4', number: 'TKT-004', title: 'آموزش نرم‌افزار',
    customer: 'شرکت دلتا', category: 'آموزش', status: 'waiting',
    priority: 'low', date: '۱۴۰۳/۰۴/۱۲',
    description: 'درخواست جلسه آموزشی برای کارکنان جدید',
    messages: [
      { id: '1', sender: 'customer', senderName: 'شرکت دلتا', content: 'آیا امکان برگزاری جلسه آموزشی وجود دارد؟', time: '۱۴۰۳/۰۴/۱۲ ۱۴:۰۰' },
    ]
  },
]

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [userOptions,setUserOptions]=useState<{id:string;fullName:string}[]>([])
  const [customerOptions,setCustomerOptions]=useState<{id:string;fullName:string;companyName?:string}[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [viewModal, setViewModal] = useState<Ticket | null>(null)
  const [assignModal, setAssignModal] = useState<Ticket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [assignee, setAssignee] = useState('')
  const [form] = Form.useForm()

  const headers=()=>({'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('token')||''}`})
  const mapTicket=(t:any):Ticket=>({id:t.id,number:t.code,title:t.title,customer:t.customerName,category:t.category,status:t.status,priority:t.priority,assigneeId:t.assignedToUserId,assignee:t.assignedToName||'',date:new Date(t.createdAt).toLocaleDateString('fa-IR'),description:t.description,messages:(t.comments||[]).map((c:any)=>({id:c.id,sender:c.isCustomer?'customer':'support',senderName:c.authorName,content:c.text,time:new Date(c.createdAt).toLocaleString('fa-IR')}))})
  const loadTickets=async()=>{const [tr,ur,cr]=await Promise.all([fetch('http://localhost:5043/api/v1/tickets',{headers:headers()}),fetch('http://localhost:5043/api/v1/users',{headers:headers()}),fetch('http://localhost:5043/api/v1/customers',{headers:headers()})]);if(tr.ok){const data=await tr.json();setTickets(data.map(mapTicket))}if(ur.ok)setUserOptions(await ur.json());if(cr.ok)setCustomerOptions(await cr.json())}
  const handleView=async(record:Ticket)=>{const res=await fetch(`http://localhost:5043/api/v1/tickets/${record.id}`,{headers:headers()});if(!res.ok){message.error('دریافت جزئیات تیکت انجام نشد');return}setViewModal(mapTicket(await res.json()));setReplyText('')}
  useEffect(()=>{void loadTickets()},[])

  const handleReply = async () => {
    if (!replyText.trim() || !viewModal) return
    if(replyText.length>2000||codePattern.test(replyText)){message.error('متن پاسخ معتبر نیست؛ ورود کد مجاز نیست');return}
    const res=await fetch(`http://localhost:5043/api/v1/tickets/${viewModal.id}/comments`,{method:'POST',headers:headers(),body:JSON.stringify({text:replyText.trim()})})
    if(!res.ok){const data=await res.json().catch(()=>({}));message.error(data.message||'ارسال پاسخ ناموفق بود');return}
    const newMsg: TicketMessage = {
      id: Date.now().toString(),
      sender: 'support',
      senderName: 'مدیر سیستم',
      content: replyText.trim(),
      time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    }
    const updated = { ...viewModal, messages: [...viewModal.messages, newMsg], status: 'inprogress' as const }
    setTickets(prev => prev.map(t => t.id === viewModal.id ? updated : t))
    setViewModal(updated)
    setReplyText('')
  }

  const handleAssign = async () => {
    if (!assignee || !assignModal) return
    const selected=userOptions.find(x=>x.id===assignee)
    const res=await fetch(`http://localhost:5043/api/v1/tickets/${assignModal.id}`,{method:'PATCH',headers:headers(),body:JSON.stringify({status:'inprogress',assignedToUserId:assignee})})
    if(!res.ok){message.error('واگذاری ناموفق بود');return}
    const updated = { ...assignModal, assignee:selected?.fullName||'',assigneeId:assignee, status: 'inprogress' as const }
    setTickets(prev => prev.map(t => t.id === assignModal.id ? updated : t))
    setAssignModal(null)
    setAssignee('')
  }

  const handleSave = async () => {
    const values=await form.validateFields()
    const res=await fetch('http://localhost:5043/api/v1/tickets',{method:'POST',headers:headers(),body:JSON.stringify({title:values.title,description:values.description||'',category:values.category,priority:values.priority,customerId:values.customer,assignedToUserId:values.assignee||null})})
    if(!res.ok){message.error((await res.json().catch(()=>({}))).message||'ثبت تیکت ناموفق بود');return}
    message.success('تیکت ثبت شد');setModalOpen(false);form.resetFields();await loadTickets()
  }

  const columns = [
    {
      title: 'شماره', dataIndex: 'number', key: 'number', width: 100,
      render: (n: string) => <Tag color="purple" style={{ fontFamily: 'monospace' }}>{n}</Tag>
    },
    { title: 'عنوان', dataIndex: 'title', key: 'title' },
    { title: 'مشتری', dataIndex: 'customer', key: 'customer', width: 130 },
    { title: 'دسته‌بندی', dataIndex: 'category', key: 'category', width: 100 },
    {
      title: 'اولویت', dataIndex: 'priority', key: 'priority', width: 100,
      render: (p: string) => <Tag color={PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].color}>{PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}</Tag>
    },
    {
      title: 'وضعیت', dataIndex: 'status', key: 'status', width: 130,
      render: (s: string) => <Tag color={STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].color}>{STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}</Tag>
    },
    {
      title: 'مسئول', dataIndex: 'assignee', key: 'assignee', width: 130,
      render: (a: string, record: Ticket) => a ? (
        <Space>
          <Avatar size={22} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
          <span style={{ fontSize: 12 }}>{a}</span>
        </Space>
      ) : (
        <Button size="small" type="dashed" onClick={() => { setAssignModal(record); setAssignee('') }}>
          assign
        </Button>
      )
    },
    { title: 'تاریخ', dataIndex: 'date', key: 'date', width: 120 },
    {
      title: 'عملیات', key: 'actions', width: 160,
      render: (_: unknown, record: Ticket) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>مشاهده</Button>
          <Button size="small" icon={<UserOutlined />} type="dashed" onClick={() => { setAssignModal(record); setAssignee(record.assignee || '') }}>
            واگذاری
          </Button>
          <Select size="small" value={record.status} style={{ width: 110 }}
            onChange={async val => { const res=await fetch(`http://localhost:5043/api/v1/tickets/${record.id}`,{method:'PATCH',headers:headers(),body:JSON.stringify({status:val})});if(res.ok)setTickets(prev => prev.map(t => t.id === record.id ? { ...t, status: val } : t)) }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v.label}</Select.Option>
            ))}
          </Select>
        </Space>
      )
    },
  ]

  return (
    <div>
      {/* آمار */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
          <div key={key} style={{
            flex: 1, minWidth: 80, padding: '8px 12px', borderRadius: 8, textAlign: 'center',
            border: `1px solid ${val.color === 'default' ? '#d9d9d9' : val.color}33`,
            borderTop: `3px solid ${val.color === 'default' ? '#d9d9d9' : val.color}`,
            background: 'white'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{tickets.filter(t => t.status === key).length}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{val.label}</div>
          </div>
        ))}
        <div style={{
          flex: 1, minWidth: 80, padding: '8px 12px', borderRadius: 8, textAlign: 'center',
          border: '1px solid #ff4d4f33', borderTop: '3px solid #ff4d4f', background: 'white'
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#ff4d4f' }}>
            {tickets.filter(t => !t.assignee).length}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>واگذار نشده</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>تیکت جدید</Button>
      </div>

      <Table columns={columns} dataSource={tickets} rowKey="id" scroll={{ x: 1100 }} />

      {/* Modal جزئیات و گفتگو */}
      <Modal
        title={viewModal && (
          <Space>
            <Tag color="purple">{viewModal.number}</Tag>
            <span>{viewModal.title}</span>
            <Tag color={STATUS_CONFIG[viewModal.status].color}>{STATUS_CONFIG[viewModal.status].label}</Tag>
          </Space>
        )}
        open={!!viewModal}
        maskClosable={false}
        onCancel={() => setViewModal(null)}
        footer={null}
        width={700}
      >
        {viewModal && (
          <div>
            {/* اطلاعات */}
            <div style={{ display: 'flex', gap: 16, padding: '10px 12px', background: '#f8f9fa', borderRadius: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <div><span style={{ color: '#8c8c8c', fontSize: 12 }}>مشتری: </span><strong>{viewModal.customer}</strong></div>
              <div><span style={{ color: '#8c8c8c', fontSize: 12 }}>دسته: </span><Tag>{viewModal.category}</Tag></div>
              <div><span style={{ color: '#8c8c8c', fontSize: 12 }}>اولویت: </span><Tag color={PRIORITY_CONFIG[viewModal.priority].color}>{PRIORITY_CONFIG[viewModal.priority].label}</Tag></div>
              <div><span style={{ color: '#8c8c8c', fontSize: 12 }}>مسئول: </span>
                {viewModal.assignee ? (
                  <Tag color="blue">{viewModal.assignee}</Tag>
                ) : (
                  <Button size="small" type="dashed" onClick={() => { setAssignModal(viewModal); setAssignee('') }}>
                    واگذار کنید
                  </Button>
                )}
              </div>
            </div>

            {/* گفتگو */}
            <div style={{ maxHeight: 350, overflowY: 'auto', padding: '8px 0', marginBottom: 16 }}>
              {viewModal.messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex',
                  flexDirection: msg.sender === 'customer' ? 'row' : 'row-reverse',
                  gap: 10, marginBottom: 12
                }}>
                  <Avatar icon={<UserOutlined />}
                    style={{ background: msg.sender === 'customer' ? '#1677ff' : '#52c41a', flexShrink: 0 }} />
                  <div style={{ maxWidth: '75%' }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, textAlign: msg.sender === 'customer' ? 'right' : 'left' }}>
                      {msg.senderName} — {msg.time}
                    </div>
                    <div style={{
                      background: msg.sender === 'customer' ? '#e6f4ff' : '#f6ffed',
                      color: '#333',
                      padding: '10px 14px',
                      borderRadius: msg.sender === 'customer' ? '0 12px 12px 12px' : '12px 0 12px 12px',
                      fontSize: 13, lineHeight: 1.7,
                      border: `1px solid ${msg.sender === 'customer' ? '#bae0ff' : '#b7eb8f'}`
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* پاسخ */}
            {viewModal.status !== 'closed' && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input.TextArea
                    rows={2}
                    placeholder="پاسخ خود را بنویسید..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    maxLength={2000}
                    showCount
                    style={{ flex: 1, resize: 'none' }}
                  />
                  <Button type="primary" icon={<SendOutlined />} onClick={handleReply} disabled={!replyText.trim()}>
                    ارسال
                  </Button>
                </div>
              </>
            )}

            {viewModal.satisfaction && (
              <div style={{ marginTop: 12 }}>
                <strong>رضایت مشتری: </strong><Rate disabled value={viewModal.satisfaction} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal واگذاری */}
      <Modal
        title={<Space><UserOutlined style={{ color: '#1677ff' }} /><span>واگذاری تیکت</span></Space>}
        open={!!assignModal}
        maskClosable={false}
        onOk={handleAssign}
        onCancel={() => setAssignModal(null)}
        okText="ذخیره"
        cancelText="انصراف"
        width={450}
      >
        {assignModal && (
          <div>
            <div style={{ padding: '10px 12px', background: '#f8f9fa', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontWeight: 500 }}>{assignModal.title}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{assignModal.customer}</div>
            </div>
            <Form layout="vertical">
              <Form.Item label="واگذاری به">
                <Select
                  value={assignee}
                  onChange={setAssignee}
                  placeholder="انتخاب کارمند"
                  style={{ width: '100%' }}
                >
                  {userOptions.map(u => (
                    <Select.Option key={u.id} value={u.id}>
                      <Space>
                        <Avatar size={22} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                        {u.fullName}
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="ارسال به وظایف">
                <div style={{ padding: '8px 12px', background: '#e6f4ff', borderRadius: 6, fontSize: 13 }}>
                  <CheckCircleOutlined style={{ color: '#1677ff', marginLeft: 6 }} />
                  پس از واگذاری، تیکت به کارتابل وظایف کارمند انتخاب شده اضافه می‌شود
                </div>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* Modal تیکت جدید */}
      <Modal
        title={<Space><span style={{width:34,height:34,borderRadius:10,display:'grid',placeItems:'center',background:'#f5e8f1',color:'#8b1a6b'}}><PlusOutlined /></span><span>ثبت تیکت جدید</span></Space>}
        open={modalOpen}
        maskClosable={false}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="ذخیره"
        cancelText="انصراف"
        width={760}
      >
        <Card bordered={false} style={{background:'linear-gradient(145deg,#fff,#faf6f9)',borderRadius:14}}>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="title" label="عنوان تیکت" rules={[{ required: true, message:'عنوان را وارد کنید' },{max:150},safeRule]}><Input maxLength={150} showCount placeholder="موضوع درخواست یا مشکل را کوتاه و روشن بنویسید" /></Form.Item>
          <Row gutter={16}>
          <Col xs={24} md={12}><Form.Item name="customer" label="مشتری" rules={[{ required: true, message:'مشتری را انتخاب کنید' }]}><Select showSearch optionFilterProp="label" placeholder="انتخاب مشتری" options={customerOptions.map(c=>({value:c.id,label:c.companyName||c.fullName}))}/></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="category" label="دسته‌بندی" rules={[{ required: true, message:'دسته‌بندی را انتخاب کنید' }]}>
            <Select placeholder="انتخاب دسته‌بندی">
              {['فنی', 'مالی', 'اداری', 'آموزش', 'گزارش', 'سایر'].map(c => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="priority" label="اولویت" initialValue="normal">
            <Select>
              <Select.Option value="low">کم</Select.Option>
              <Select.Option value="normal">معمولی</Select.Option>
              <Select.Option value="high">زیاد</Select.Option>
              <Select.Option value="critical">بحرانی</Select.Option>
            </Select>
          </Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="assignee" label="واگذاری به">
            <Select placeholder="انتخاب کارمند" allowClear>
              {userOptions.map(u => <Select.Option key={u.id} value={u.id}>{u.fullName}</Select.Option>)}
            </Select>
          </Form.Item></Col>
          </Row>
          <Form.Item name="description" label="شرح کامل" rules={[{required:true,message:'شرح تیکت را وارد کنید'},{max:4000},safeRule]}><Input.TextArea rows={5} maxLength={4000} showCount placeholder="جزئیات، خطا و نتیجه مورد انتظار را بنویسید" /></Form.Item>
        </Form>
        </Card>
      </Modal>
    </div>
  )
}
