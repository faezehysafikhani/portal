import { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, Tabs, Row, Col, Steps, Divider, Timeline, Avatar, Alert, InputNumber, Upload, Badge, notification, TimePicker } from 'antd'
import { EyeOutlined, SendOutlined, CheckOutlined, CloseOutlined, RollbackOutlined, UserOutlined, InboxOutlined, UploadOutlined, WarningOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import { apiFetch } from '../utils/api'
import PersianDatePicker from '../components/PersianDatePicker'
import { jalaliToDate, formatJalaliDate } from '../utils/jalali'

const API='http://localhost:5043/api/v1'
const headers=()=>({'Content-Type':'application/json'})
const codePattern=/<[^>]*>|javascript\s*:|--|\/\*|\*\/|;\s*(select|insert|update|delete|drop|alter|exec)|\bunion\s+select/i
const safeRule={validator:(_:unknown,value?:string)=>!value||!codePattern.test(value)?Promise.resolve():Promise.reject(new Error('ورود کد HTML، JavaScript یا SQL مجاز نیست'))}
const nameRule={pattern:/^[\p{L}\p{M}\s\u200c-]+$/u,message:'این فیلد فقط باید شامل حروف باشد'}
const onlyDigits=(value='')=>value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\D/g,'')
interface InternalUser { id:string; fullName:string; position?:string; department?:string }
interface LeaveBalance { availableHours:number; days:number; monthlyAccrualHours:number; reservedHours:number }
interface WorkflowConfig { submitter?:InternalUser; manager?:InternalUser; hrManager?:InternalUser; isConfigured:boolean; message?:string; users:InternalUser[] }

type FormStatus = 'پیش‌نویس' | 'ارسال شده' | 'در بررسی مدیر' | 'برگشت برای اصلاح' | 'تأیید مدیر' | 'در بررسی منابع انسانی' | 'تأیید نهایی' | 'رد شده'

interface FormSubmission {
  id: string
  formType: string
  title: string
  submitter: string
  submitDate: string
  status: FormStatus
  manager: string
  hrManager: string
  data: Record<string, any>
  history: { date: string; action: string; by: string; note?: string }[]
}

const STATUS_CONFIG: Record<FormStatus, { color: string; step: number }> = {
  'پیش‌نویس': { color: 'default', step: 0 },
  'ارسال شده': { color: 'blue', step: 1 },
  'در بررسی مدیر': { color: 'orange', step: 1 },
  'برگشت برای اصلاح': { color: 'volcano', step: 1 },
  'تأیید مدیر': { color: 'cyan', step: 2 },
  'در بررسی منابع انسانی': { color: 'purple', step: 2 },
  'رد شده': { color: 'red', step: 3 },
  'تأیید نهایی': { color: 'green', step: 3 },
}

export const FORM_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  leave_daily: { label: 'مرخصی روزانه', icon: '🗓️', color: '#1677ff' },
  leave_hourly: { label: 'مرخصی ساعتی', icon: '⏰', color: '#13c2c2' },
  mission: { label: 'ماموریت', icon: '🚀', color: '#722ed1' },
  loan: { label: 'وام', icon: '💰', color: '#52c41a' },
  payslip: { label: 'فیش حقوقی', icon: '📄', color: '#fa8c16' },
  resignation: { label: 'استعفا', icon: '📝', color: '#f5222d' },
  equipment: { label: 'تحویل تجهیزات', icon: '🖥️', color: '#8B1A6B' },
  personnel: { label: 'مشخصات پرسنلی', icon: '👤', color: '#8B1A6B' },
}

const INITIAL_FORMS: FormSubmission[] = [
  {
    id: '1', formType: 'leave_daily', title: 'مرخصی روزانه', submitter: 'علی محمدی',
    submitDate: '۱۴۰۳/۰۴/۱۰', status: 'در بررسی مدیر', manager: 'مدیر سیستم', hrManager: 'فاطمه رضایی',
    data: { days: 2, reason: 'امور شخصی' },
    history: [
      { date: '۱۴۰۳/۰۴/۱۰', action: 'ارسال فرم', by: 'علی محمدی' },
      { date: '۱۴۰۳/۰۴/۱۱', action: 'دریافت توسط مدیر', by: 'مدیر سیستم' },
    ]
  },
  {
    id: '2', formType: 'mission', title: 'ماموریت', submitter: 'مریم احمدی',
    submitDate: '۱۴۰۳/۰۴/۱۲', status: 'تأیید نهایی', manager: 'مدیر سیستم', hrManager: 'فاطمه رضایی',
    data: { destination: 'مشهد', days: 3 },
    history: [
      { date: '۱۴۰۳/۰۴/۱۲', action: 'ارسال فرم', by: 'مریم احمدی' },
      { date: '۱۴۰۳/۰۴/۱۳', action: 'تأیید مدیر', by: 'مدیر سیستم' },
      { date: '۱۴۰۳/۰۴/۱۴', action: 'تأیید منابع انسانی', by: 'فاطمه رضایی' },
    ]
  },
]

export default function FormsPage() {
  const location=useLocation()
  const currentUser=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})()
  const grantedPermissions:string[]=(()=>{try{return JSON.parse(localStorage.getItem('permissions')||'[]')}catch{return []}})()
  const isAdmin=Array.isArray(currentUser.roles)&&currentUser.roles.includes('Admin')
  const assignedFormTypes=grantedPermissions.filter(code=>code.startsWith('forms.type.'))
  const canUseFormType=(type:string)=>isAdmin||grantedPermissions.includes('forms.access')||assignedFormTypes.length===0||assignedFormTypes.includes(`forms.type.${type}`)
  const canCreate=isAdmin||grantedPermissions.includes('forms.create')
  const [forms, setForms] = useState<FormSubmission[]>([])
  const [inboxForms, setInboxForms] = useState<FormSubmission[]>([])
  const [approvalForms, setApprovalForms] = useState<FormSubmission[]>([])
  const [users, setUsers] = useState<InternalUser[]>([])
  const [workflow,setWorkflow]=useState<WorkflowConfig>({isConfigured:false,users:[]})
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance>({availableHours:0,days:0,monthlyAccrualHours:20,reservedHours:0})
  const [newFormModal, setNewFormModal] = useState(false)
  const [newFormType, setNewFormType] = useState<string>('leave_daily')
  const [viewModal, setViewModal] = useState(false)
  const [selectedForm, setSelectedForm] = useState<FormSubmission | null>(null)
  const [actionModal, setActionModal] = useState<'approve' | 'reject' | 'return' | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [form] = Form.useForm()

  const mapApiForm=(x:any):FormSubmission=>({id:x.id,formType:x.formType,title:x.title,submitter:x.submitterName,submitDate:formatJalaliDate(new Date(x.createdAt)),status:({manager_pending:'در بررسی مدیر',hr_pending:'در بررسی منابع انسانی',approved:'تأیید نهایی',rejected:'رد شده',returned:'برگشت برای اصلاح'} as any)[x.status]||x.status,manager:x.managerName,hrManager:x.hrName,data:JSON.parse(x.dataJson||'{}'),history:(x.history||[]).map((h:any)=>({date:formatJalaliDate(new Date(h.createdAt)),action:({submitted:'ارسال فرم',approve:'تأیید',reject:'رد فرم',return:'برگشت برای اصلاح'} as any)[h.action]||h.action,by:h.actorName,note:h.note}))})
  const load=async()=>{const [s,i,a,u,b]=await Promise.all([apiFetch(`${API}/forms?scope=sent`),apiFetch(`${API}/forms?scope=inbox`),apiFetch(`${API}/forms?scope=approvals`),apiFetch(`${API}/forms/approvers`),apiFetch(`${API}/forms/balance`)]);if(s.ok)setForms((await s.json()).map(mapApiForm));if(i.ok)setInboxForms((await i.json()).map(mapApiForm));if(a.ok)setApprovalForms((await a.json()).map(mapApiForm));if(u.ok){const w=await u.json();setWorkflow(w);setUsers(w.users||[])}if(b.ok)setLeaveBalance(await b.json())}
  useEffect(()=>{load()},[])
  const managerOptions=workflow.manager?[{value:workflow.manager.id,label:`${workflow.manager.fullName}${workflow.manager.position?' — '+workflow.manager.position:''}`}]:[]
  const hrOptions=workflow.hrManager?[{value:workflow.hrManager.id,label:`${workflow.hrManager.fullName}${workflow.hrManager.position?' — '+workflow.hrManager.position:''}`}]:[]
  const userOptions=users.map(u=>({value:u.id,label:u.fullName}))
  const openForm=(type:string)=>{form.resetFields();setNewFormType(type);form.setFieldsValue({manager:workflow.manager?.id,hrManager:workflow.hrManager?.id});setNewFormModal(true)}

  const checkLeaveBalance = (type: string, days?: number, hours?: number) => {
    if (type === 'leave_daily' && days && days * 8 > leaveBalance.availableHours) {
      notification.warning({
        message: '⚠️ مانده مرخصی کافی نیست',
        description: `مانده مرخصی شما ${leaveBalance.availableHours} ساعت است اما ${days * 8} ساعت درخواست داده‌اید.`,
        duration: 5,
      })
      return false
    }
    if (type === 'leave_hourly' && hours && hours > leaveBalance.availableHours) {
      notification.warning({
        message: '⚠️ مانده مرخصی ساعتی کافی نیست',
        description: `مانده مرخصی ساعتی شما ${leaveBalance.availableHours} ساعت است اما ${hours} ساعت درخواست داده‌اید.`,
        duration: 5,
      })
      return false
    }
    return true
  }

  const handleSubmitForm = () => {
    form.validateFields().then(async values => {
      const data={...values,fromTime:values.fromTime?.format?.('HH:mm')??values.fromTime,toTime:values.toTime?.format?.('HH:mm')??values.toTime}
      if(Object.values(data).some(v=>typeof v==='string'&&codePattern.test(v))){notification.error({message:'ورود کد HTML، JavaScript یا SQL مجاز نیست'});return}
      let requestedHours=0
      if(newFormType==='leave_daily'){
        const from=jalaliToDate(values.fromDate),to=jalaliToDate(values.toDate)
        const days=Math.floor((to.getTime()-from.getTime())/86400000)+1
        if(days<=0){notification.error({message:'تاریخ پایان باید بعد از تاریخ شروع باشد'});return}
        requestedHours=days*8
        if(!checkLeaveBalance(newFormType,days))return
      }
      if(newFormType==='leave_hourly'&&values.fromTime&&values.toTime){
        const hours=values.toTime.diff(values.fromTime,'minute')/60
        if(hours<=0){notification.error({message:'ساعت پایان باید بعد از ساعت شروع باشد'});return}
        if(!checkLeaveBalance(newFormType,undefined,hours))return
        requestedHours=hours
      }

      const res=await apiFetch(`${API}/forms`,{method:'POST',headers:headers(),body:JSON.stringify({formType:newFormType,title:FORM_TYPES[newFormType].label,amount:requestedHours,data})})
      const result=await res.json().catch(()=>({}));if(!res.ok){notification.error({message:result.message||'خطا در ارسال فرم'});return}
      setNewFormModal(false)
      form.resetFields()
      notification.success({ message: 'فرم با موفقیت ارسال شد', description: result.message })
      load()
    })
  }

  const handleAction = async () => {
    if (!selectedForm || !actionModal) return
    const res=await apiFetch(`${API}/forms/${selectedForm.id}/action`,{method:'POST',headers:headers(),body:JSON.stringify({action:actionModal,note:actionNote})});const result=await res.json().catch(()=>({}));if(!res.ok){notification.error({message:result.message||'خطا در ثبت گردش کار'});return}
    setActionModal(null)
    setActionNote('')
    setViewModal(false);load();notification.success({message:'اقدام با موفقیت ثبت شد'})
  }

  // ── فرم مرخصی روزانه ────────────────────────────────
  const LeaveDailyForm = () => (
    <div>
      <Alert message={`مانده قابل استفاده: ${leaveBalance.availableHours} ساعت (معادل ${leaveBalance.days} روز کامل)`} type={leaveBalance.availableHours<20?'warning':'info'} showIcon icon={<WarningOutlined />} style={{ marginBottom: 16 }} />
      <Row gutter={16}>
        <Col span={12}><Form.Item name="fromDate" label="از تاریخ" rules={[{ required: true }]}><PersianDatePicker /></Form.Item></Col>
        <Col span={12}><Form.Item name="toDate" label="تا تاریخ" rules={[{ required: true }]}><PersianDatePicker /></Form.Item></Col>
        <Col span={12}><Form.Item name="leaveType" label="نوع مرخصی"><Select><Select.Option value="استحقاقی">استحقاقی</Select.Option><Select.Option value="استعلاجی">استعلاجی</Select.Option><Select.Option value="بدون حقوق">بدون حقوق</Select.Option></Select></Form.Item></Col>
        <Col span={12}><Form.Item name="manager" label="مدیر مستقیم" rules={[{ required: true }]}><Select disabled options={managerOptions}/></Form.Item></Col>
        <Col span={12}><Form.Item name="replacement" label="جانشین در غیاب"><Select allowClear options={userOptions}/></Form.Item></Col>
        <Col span={24}><Form.Item name="reason" label="علت مرخصی" rules={[{ required: true },safeRule]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item></Col>
      </Row>
    </div>
  )

  // ── فرم مرخصی ساعتی ─────────────────────────────────
  const LeaveHourlyForm = () => (
    <div>
      <Alert message={`مانده مرخصی ساعتی شما: ${leaveBalance.availableHours} ساعت`} type={leaveBalance.availableHours<8?'warning':'info'} showIcon icon={<WarningOutlined />} style={{ marginBottom: 16 }} />
      <Row gutter={16}>
        <Col span={12}><Form.Item name="date" label="تاریخ" rules={[{ required: true }]}><PersianDatePicker /></Form.Item></Col>
        <Col span={6}><Form.Item name="fromTime" label="از ساعت" rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={5} style={{width:'100%'}} placeholder="انتخاب ساعت" /></Form.Item></Col>
        <Col span={6}><Form.Item name="toTime" label="تا ساعت" rules={[{ required: true }]}><TimePicker format="HH:mm" minuteStep={5} style={{width:'100%'}} placeholder="انتخاب ساعت" /></Form.Item></Col>
        <Col span={12}><Form.Item name="manager" label="مدیر مستقیم" rules={[{ required: true }]}><Select disabled options={managerOptions}/></Form.Item></Col>
        <Col span={24}><Form.Item name="reason" label="علت مرخصی" rules={[{ required: true },safeRule]}><Input.TextArea rows={2} maxLength={1000} showCount /></Form.Item></Col>
      </Row>
    </div>
  )

  // ── فرم ماموریت ─────────────────────────────────────
  const MissionForm = () => (
    <Row gutter={16}>
      <Col span={12}><Form.Item name="destination" label="مقصد ماموریت" rules={[{ required: true },nameRule]}><Input maxLength={100} /></Form.Item></Col>
      <Col span={12}><Form.Item name="missionType" label="نوع ماموریت"><Select><Select.Option value="داخلی">داخلی</Select.Option><Select.Option value="خارجی">خارجی</Select.Option></Select></Form.Item></Col>
      <Col span={12}><Form.Item name="fromDate" label="از تاریخ" rules={[{ required: true }]}><PersianDatePicker /></Form.Item></Col>
      <Col span={12}><Form.Item name="toDate" label="تا تاریخ" rules={[{ required: true }]}><PersianDatePicker /></Form.Item></Col>
      <Col span={12}><Form.Item name="days" label="تعداد روز"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
      <Col span={12}><Form.Item name="transport" label="وسیله نقلیه"><Select><Select.Option value="خودرو شخصی">خودرو شخصی</Select.Option><Select.Option value="خودرو سازمانی">خودرو سازمانی</Select.Option><Select.Option value="قطار">قطار</Select.Option><Select.Option value="هواپیما">هواپیما</Select.Option><Select.Option value="اتوبوس">اتوبوس</Select.Option></Select></Form.Item></Col>
      <Col span={12}><Form.Item name="manager" label="مدیر مستقیم" rules={[{ required: true }]}><Select disabled options={managerOptions}/></Form.Item></Col>
      <Col span={24}><Form.Item name="purpose" label="هدف ماموریت" rules={[{ required: true },safeRule]}><Input.TextArea rows={2} maxLength={1000} showCount /></Form.Item></Col>
      <Col span={24}>
        <Divider>گزارش کار (پس از بازگشت)</Divider>
        <Form.Item name="workReport" label="گزارش کار" rules={[safeRule]}><Input.TextArea rows={4} maxLength={3000} showCount placeholder="پس از بازگشت از ماموریت، گزارش کار خود را اینجا بنویسید..." /></Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item name="reportFile" label="فایل گزارش">
          <Upload beforeUpload={() => false} accept=".pdf,.docx,.xlsx" maxCount={3}>
            <Button icon={<UploadOutlined />}>آپلود فایل گزارش</Button>
          </Upload>
        </Form.Item>
      </Col>
    </Row>
  )

  // ── فرم وام ─────────────────────────────────────────
  const LoanForm = () => (
    <Row gutter={16}>
      <Col span={12}><Form.Item name="loanType" label="نوع وام" rules={[{ required: true }]}><Select><Select.Option value="ضروری">ضروری</Select.Option><Select.Option value="مسکن">مسکن</Select.Option><Select.Option value="ازدواج">ازدواج</Select.Option><Select.Option value="درمان">درمان</Select.Option><Select.Option value="سایر">سایر</Select.Option></Select></Form.Item></Col>
      <Col span={12}><Form.Item name="amount" label="مبلغ درخواستی (ریال)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
      <Col span={12}><Form.Item name="installments" label="تعداد اقساط" rules={[{ required: true }]}><Select><Select.Option value={6}>۶ ماه</Select.Option><Select.Option value={12}>۱۲ ماه</Select.Option><Select.Option value={24}>۲۴ ماه</Select.Option><Select.Option value={36}>۳۶ ماه</Select.Option></Select></Form.Item></Col>
      <Col span={12}><Form.Item name="accountNumber" label="شماره حساب"><Input inputMode="numeric" maxLength={30} onChange={e=>form.setFieldValue('accountNumber',onlyDigits(e.target.value))} /></Form.Item></Col>
      <Col span={12}><Form.Item name="manager" label="مدیر مستقیم" rules={[{ required: true }]}><Select disabled options={managerOptions}/></Form.Item></Col>
      <Col span={24}><Form.Item name="reason" label="دلیل درخواست وام" rules={[{ required: true },safeRule]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item></Col>
      <Col span={24}>
        <Form.Item name="documents" label="مدارک پیوست">
          <Upload beforeUpload={() => false} accept=".pdf,.jpg,.png" maxCount={5}>
            <Button icon={<UploadOutlined />}>آپلود مدارک</Button>
          </Upload>
        </Form.Item>
      </Col>
    </Row>
  )

  // ── فرم فیش حقوقی ───────────────────────────────────
  const PayslipForm = () => (
    <Row gutter={16}>
      <Col span={12}><Form.Item name="month" label="ماه" rules={[{ required: true }]}><Select>{['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map(m => <Select.Option key={m} value={m}>{m}</Select.Option>)}</Select></Form.Item></Col>
      <Col span={12}><Form.Item name="year" label="سال" rules={[{ required: true }]}><Select><Select.Option value="1403">۱۴۰۳</Select.Option><Select.Option value="1402">۱۴۰۲</Select.Option></Select></Form.Item></Col>
      <Col span={12}><Form.Item name="deliveryType" label="نحوه دریافت"><Select><Select.Option value="ایمیل">ارسال به ایمیل</Select.Option><Select.Option value="چاپ">چاپ فیزیکی</Select.Option></Select></Form.Item></Col>
      <Col span={24}><Form.Item name="reason" label="توضیحات (اختیاری)" rules={[safeRule]}><Input.TextArea rows={2} maxLength={1000} showCount /></Form.Item></Col>
    </Row>
  )

  // ── فرم استعفا ──────────────────────────────────────
  const ResignationForm = () => (
    <Row gutter={16}>
      <Col span={12}><Form.Item name="lastWorkDate" label="آخرین روز کاری" rules={[{ required: true }]}><PersianDatePicker /></Form.Item></Col>
      <Col span={12}><Form.Item name="reason" label="دلیل استعفا" rules={[{ required: true }]}><Select>{['دلایل شخصی','دلایل خانوادگی','پیشنهاد شغلی بهتر','ادامه تحصیل','بازنشستگی','سایر'].map(r => <Select.Option key={r} value={r}>{r}</Select.Option>)}</Select></Form.Item></Col>
      <Col span={12}><Form.Item name="manager" label="مدیر مستقیم" rules={[{ required: true }]}><Select disabled options={managerOptions}/></Form.Item></Col>
      <Col span={24}><Form.Item name="reasonDetail" label="شرح دلیل" rules={[safeRule]}><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item></Col>
      <Col span={24}><Alert message="با ارسال این فرم، درخواست استعفای شما برای مدیر مستقیم و منابع انسانی ارسال می‌شود." type="warning" showIcon style={{ marginTop: 8 }} /></Col>
    </Row>
  )

  // ── فرم تحویل تجهیزات ──────────────────────────────
  const EquipmentForm = () => (
    <Row gutter={16}>
      <Col span={12}><Form.Item name="employeeName" label="نام کارمند" rules={[{ required: true },nameRule]}><Input maxLength={150} /></Form.Item></Col>
      <Col span={12}><Form.Item name="department" label="واحد" rules={[nameRule]}><Input maxLength={100} /></Form.Item></Col>
      <Col span={12}><Form.Item name="deliveryDate" label="تاریخ تحویل"><PersianDatePicker /></Form.Item></Col>
      <Col span={12}><Form.Item name="manager" label="مدیر مستقیم" rules={[{ required: true }]}><Select disabled options={managerOptions}/></Form.Item></Col>
      <Col span={24}><Form.Item name="equipmentList" label="لیست تجهیزات" rules={[safeRule]}><Input.TextArea rows={4} maxLength={2000} showCount placeholder="هر تجهیز را در یک خط بنویسید&#10;مثال:&#10;لپ‌تاپ - LT001 - سالم&#10;ماوس - MS002 - سالم" /></Form.Item></Col>
      <Col span={24}><Form.Item name="notes" label="توضیحات" rules={[safeRule]}><Input.TextArea rows={2} maxLength={1000} showCount /></Form.Item></Col>
    </Row>
  )

  // ── فرم مشخصات پرسنلی ──────────────────────────────
  const PersonnelForm = () => (
    <Tabs items={[
      {
        key: '1', label: 'اطلاعات شخصی',
        children: (
          <Row gutter={16}>
            <Col span={12}><Form.Item name="firstName" label="نام" rules={[{ required: true },nameRule]}><Input maxLength={75} /></Form.Item></Col>
            <Col span={12}><Form.Item name="lastName" label="نام خانوادگی" rules={[{ required: true },nameRule]}><Input maxLength={75} /></Form.Item></Col>
            <Col span={12}><Form.Item name="nationalCode" label="کد ملی" rules={[{ required: true },{pattern:/^\d{10}$/,message:'کد ملی باید ۱۰ رقم باشد'}]}><Input inputMode="numeric" maxLength={10} onChange={e=>form.setFieldValue('nationalCode',onlyDigits(e.target.value))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="birthDate" label="تاریخ تولد"><PersianDatePicker /></Form.Item></Col>
            <Col span={12}><Form.Item name="gender" label="جنسیت"><Select><Select.Option value="مرد">مرد</Select.Option><Select.Option value="زن">زن</Select.Option></Select></Form.Item></Col>
            <Col span={12}><Form.Item name="maritalStatus" label="وضعیت تأهل"><Select><Select.Option value="مجرد">مجرد</Select.Option><Select.Option value="متأهل">متأهل</Select.Option></Select></Form.Item></Col>
            <Col span={12}><Form.Item name="mobile" label="موبایل" rules={[{pattern:/^\d{10,15}$/,message:'موبایل باید فقط ۱۰ تا ۱۵ رقم باشد'}]}><Input inputMode="numeric" maxLength={15} onChange={e=>form.setFieldValue('mobile',onlyDigits(e.target.value))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="ایمیل"><Input /></Form.Item></Col>
            <Col span={24}><Form.Item name="address" label="آدرس" rules={[safeRule]}><Input.TextArea rows={2} maxLength={500} showCount /></Form.Item></Col>
          </Row>
        )
      },
      {
        key: '2', label: 'اطلاعات شغلی',
        children: (
          <Row gutter={16}>
            <Col span={12}><Form.Item name="department" label="واحد سازمانی" rules={[nameRule]}><Input maxLength={100} /></Form.Item></Col>
            <Col span={12}><Form.Item name="position" label="سمت" rules={[nameRule]}><Input maxLength={100} /></Form.Item></Col>
            <Col span={12}><Form.Item name="startDate" label="تاریخ شروع"><PersianDatePicker /></Form.Item></Col>
            <Col span={12}><Form.Item name="contractType" label="نوع قرارداد"><Select>{['دائمی','موقت','پیمانی','پاره‌وقت'].map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="manager" label="مدیر مستقیم" rules={[{ required: true }]}><Select disabled options={managerOptions}/></Form.Item></Col>
          </Row>
        )
      },
      {
        key: '3', label: 'تحصیلات و بیمه',
        children: (
          <Row gutter={16}>
            <Col span={12}><Form.Item name="education" label="مدرک تحصیلی"><Select>{['دیپلم','فوق دیپلم','لیسانس','فوق لیسانس','دکتری'].map(e => <Select.Option key={e} value={e}>{e}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="fieldOfStudy" label="رشته تحصیلی" rules={[nameRule]}><Input maxLength={100} /></Form.Item></Col>
            <Col span={12}><Form.Item name="insuranceCode" label="شماره بیمه"><Input inputMode="numeric" maxLength={30} onChange={e=>form.setFieldValue('insuranceCode',onlyDigits(e.target.value))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="accountNumber" label="شماره حساب"><Input inputMode="numeric" maxLength={30} onChange={e=>form.setFieldValue('accountNumber',onlyDigits(e.target.value))} /></Form.Item></Col>
          </Row>
        )
      },
    ]} />
  )

  const renderForm = () => {
    switch (newFormType) {
      case 'leave_daily': return <LeaveDailyForm />
      case 'leave_hourly': return <LeaveHourlyForm />
      case 'mission': return <MissionForm />
      case 'loan': return <LoanForm />
      case 'payslip': return <PayslipForm />
      case 'resignation': return <ResignationForm />
      case 'equipment': return <EquipmentForm />
      case 'personnel': return <PersonnelForm />
      default: return null
    }
  }

  const columns = [
    {
      title: 'نوع فرم', key: 'formType',
      render: (_: unknown, r: FormSubmission) => (
        <Space>
          <span style={{ fontSize: 20 }}>{FORM_TYPES[r.formType]?.icon}</span>
          <div>
            <div style={{ fontWeight: 500 }}>{FORM_TYPES[r.formType]?.label}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.submitter}</div>
          </div>
        </Space>
      )
    },
    { title: 'تاریخ', dataIndex: 'submitDate', key: 'submitDate', width: 110 },
    { title: 'مدیر', dataIndex: 'manager', key: 'manager', width: 120 },
    {
      title: 'وضعیت', dataIndex: 'status', key: 'status', width: 180,
      render: (s: FormStatus) => <Tag color={STATUS_CONFIG[s]?.color}>{s}</Tag>
    },
    {
      title: 'عملیات', key: 'actions', width: 100,
      render: (_: unknown, r: FormSubmission) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedForm(r); setViewModal(true) }}>مشاهده</Button>
      )
    },
  ]

  const isApprovals=location.pathname.endsWith('/approvals')
  const isInbox=location.pathname.endsWith('/inbox')
  const pageTitle=isApprovals?'تأییدات من':isInbox?'کارتابل فرم':'فرم‌های ارسالی من'
  const pageDescription=isApprovals?'فرم‌هایی که اکنون نیازمند تصمیم شما هستند':isInbox?'نتیجه فرم‌های تأییدشده، ردشده یا برگشتی شما':'تمام فرم‌هایی که برای مدیر یا منابع انسانی ارسال کرده‌اید'
  const pageForms=isApprovals?approvalForms:isInbox?inboxForms:forms
  const tableColumns=isApprovals?[
    ...columns.slice(0,4),
    {
      title:'عملیات',key:'actions',width:250,
      render:(_:unknown,r:FormSubmission)=><Space>
        <Button size="small" icon={<EyeOutlined/>} onClick={()=>{setSelectedForm(r);setViewModal(true)}}>مشاهده</Button>
        <Button size="small" icon={<CheckOutlined/>} style={{color:'#52c41a',borderColor:'#52c41a'}} onClick={()=>{setSelectedForm(r);setActionModal('approve')}}>تأیید</Button>
        <Button size="small" icon={<RollbackOutlined/>} onClick={()=>{setSelectedForm(r);setActionModal('return')}}>اصلاح</Button>
        <Button size="small" danger icon={<CloseOutlined/>} onClick={()=>{setSelectedForm(r);setActionModal('reject')}}>رد</Button>
      </Space>
    }
  ]:columns

  return (
    <div>
      <Card style={{borderRadius:14}} title={<Space>{isApprovals?<CheckOutlined/>:isInbox?<InboxOutlined/>:<SendOutlined/>}<span>{pageTitle}</span>{isApprovals&&<Badge count={approvalForms.length} style={{background:'#fa8c16'}}/>}</Space>} extra={!isApprovals&&!isInbox&&canCreate?<Select placeholder="➕ فرم جدید" style={{width:200}} onChange={v=>{if(v)openForm(v)}} value={undefined}>{Object.entries(FORM_TYPES).filter(([key])=>canUseFormType(key)).map(([key,val])=><Select.Option key={key} value={key}>{val.icon} {val.label}</Select.Option>)}</Select>:null}>
        <Alert message={pageDescription} type={isApprovals?'warning':isInbox?'info':'success'} showIcon style={{marginBottom:16}}/>
        {!isApprovals&&!isInbox&&<Space wrap style={{marginBottom:16}}><Tag color="orange">مانده مرخصی: {leaveBalance.days} روز کامل</Tag><Tag color="cyan">مانده کل: {leaveBalance.availableHours} ساعت</Tag><Tag color="blue">افزایش ماهانه: {leaveBalance.monthlyAccrualHours} ساعت</Tag></Space>}
        <Table columns={tableColumns} dataSource={pageForms} rowKey="id" locale={{emptyText:isApprovals?'فرمی در انتظار تأیید شما نیست':isInbox?'نتیجه جدیدی در کارتابل شما نیست':'هنوز فرمی ارسال نکرده‌اید'}}/>
      </Card>

      {/* Modal فرم جدید */}
      <Modal
        title={<Space><span style={{ fontSize: 20 }}>{FORM_TYPES[newFormType]?.icon}</span><span>{FORM_TYPES[newFormType]?.label}</span></Space>}
        open={newFormModal} onOk={handleSubmitForm} onCancel={() => { setNewFormModal(false); form.resetFields() }}
        maskClosable={false} centered
        okText="ارسال فرم" cancelText="انصراف" width={860}
        okButtonProps={{ style: { background: '#8B1A6B', borderColor: '#8B1A6B' }, icon: <SendOutlined /> }}
      >
        <Card bordered={false} style={{background:`linear-gradient(145deg,#fff,${FORM_TYPES[newFormType]?.color}0d)`,borderRadius:16,borderTop:`4px solid ${FORM_TYPES[newFormType]?.color}`}}>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Alert type={workflow.isConfigured?'success':'warning'} showIcon style={{marginBottom:16}} message={workflow.isConfigured?`ثبت‌کننده: ${workflow.submitter?.fullName} | مدیر مستقیم: ${workflow.manager?.fullName} | منابع انسانی: ${workflow.hrManager?.fullName}`:workflow.message||'گردش کار این کاربر کامل تنظیم نشده است'} />
          {renderForm()}
            <Form.Item name="hrManager" label="مسئول منابع انسانی" rules={[{required:true,message:'مسئول منابع انسانی را انتخاب کنید'}]} style={{ marginTop: 8 }}>
              <Select disabled options={hrOptions}/>
            </Form.Item>
        </Form>
        </Card>
      </Modal>

      {/* Modal مشاهده فرم */}
      <Modal
        title={selectedForm && <Space><span style={{ fontSize: 20 }}>{FORM_TYPES[selectedForm.formType]?.icon}</span><span>{FORM_TYPES[selectedForm.formType]?.label}</span><Tag color={STATUS_CONFIG[selectedForm.status]?.color}>{selectedForm.status}</Tag></Space>}
        open={viewModal} onCancel={() => setViewModal(false)} footer={null} width={700}
      >
        {selectedForm && (
          <div>
            <Steps
              current={STATUS_CONFIG[selectedForm.status]?.step}
              style={{ marginBottom: 20 }}
              size="small"
              items={[
                { title: 'ارسال', description: selectedForm.submitter },
                { title: 'مدیر', description: selectedForm.manager },
                { title: 'منابع انسانی', description: selectedForm.hrManager },
                { title: selectedForm.status === 'رد شده' ? '❌ رد' : '✅ نهایی' },
              ]}
            />

            {selectedForm.status === 'برگشت برای اصلاح' && (
              <Alert message="این فرم برای اصلاح برگشت داده شده است." type="warning" showIcon
                action={<Button size="small" type="primary" icon={<SendOutlined />} style={{ background: '#8B1A6B', borderColor: '#8B1A6B' }}>ارسال مجدد</Button>}
                style={{ marginBottom: 16 }} />
            )}

            {approvalForms.some(x=>x.id===selectedForm.id) && (
              <Space style={{ marginBottom: 16 }}>
                <Button icon={<CheckOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }} onClick={() => setActionModal('approve')}>تأیید</Button>
                <Button icon={<RollbackOutlined />} onClick={() => setActionModal('return')}>برگشت برای اصلاح</Button>
                <Button danger icon={<CloseOutlined />} onClick={() => setActionModal('reject')}>رد فرم</Button>
              </Space>
            )}

            <Divider>تاریخچه</Divider>
            <Timeline items={selectedForm.history.map(h => ({
              dot: <Avatar size={22} icon={<UserOutlined />} style={{ background: '#8B1A6B' }} />,
              children: (
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{h.action}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>{h.by} — {h.date}</div>
                  {h.note && <div style={{ fontSize: 12, marginTop: 4, padding: '4px 8px', background: '#fff7e6', borderRadius: 4 }}>📝 {h.note}</div>}
                </div>
              )
            }))} />
          </div>
        )}
      </Modal>

      {/* Modal اقدام */}
      <Modal
        title={actionModal === 'approve' ? '✅ تأیید فرم' : actionModal === 'return' ? '↩️ برگشت برای اصلاح' : '❌ رد فرم'}
        open={!!actionModal} onOk={handleAction} onCancel={() => { setActionModal(null); setActionNote('') }}
        okText="ثبت" cancelText="انصراف"
        okButtonProps={{ style: { background: actionModal === 'approve' ? '#52c41a' : actionModal === 'return' ? '#fa8c16' : '#f5222d', borderColor: 'transparent' } }}
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: '#555' }}>
          {actionModal === 'approve' ? 'در صورت نیاز یادداشت تأیید بنویسید:' : actionModal === 'return' ? 'دلیل برگشت را برای کارمند بنویسید:' : 'دلیل رد فرم را بنویسید:'}
        </div>
        <Input.TextArea
          rows={4}
          placeholder={actionModal === 'return' ? 'مثلاً: لطفاً تاریخ پایان مرخصی را اصلاح کنید...' : actionModal === 'reject' ? 'مثلاً: مانده مرخصی کافی نیست...' : 'یادداشت اختیاری...'}
          value={actionNote}
          onChange={e => setActionNote(e.target.value)}
          style={{ borderColor: actionModal === 'reject' ? '#f5222d' : actionModal === 'return' ? '#fa8c16' : undefined }}
        />
        {actionModal === 'return' && <Alert message="کارمند پس از اصلاح می‌تواند مجدداً ارسال کند." type="info" showIcon style={{ marginTop: 8 }} />}
        {actionModal === 'reject' && <Alert message="رد فرم غیرقابل بازگشت است." type="error" showIcon style={{ marginTop: 8 }} />}
      </Modal>
    </div>
  )
}
