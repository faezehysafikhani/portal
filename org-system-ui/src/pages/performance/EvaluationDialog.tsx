import { useEffect, useState } from 'react'
import { Alert, Button, Card, Checkbox, Descriptions, Form, Input, InputNumber, List, Modal, Progress, Select, Space, Spin, Tabs, Tag, message } from 'antd'
import PersianDatePicker from '../../components/PersianDatePicker'
import { displayDate, download, encodeFiles, err, fa, faScore, feedbackFields, iso, jalali, labels, metrics, request } from './periodic-model'
import type { Attachment, Detail, Indicator, Plan, PlanInput, Score, SelectedFile } from './periodic-model'

const historyLabels:Record<string,string>={create:'ایجاد ارزیابی',save:'ذخیره پیش‌نویس',send:'ارسال برای نهایی‌سازی',approve:'تأیید نهایی',return:'برگشت برای اصلاح',publish:'انتشار نتیجه',
  reopen:'بازگشایی',close:'بستن ارزیابی',comment:'ثبت نظر کارمند',appeal:'ثبت درخواست بازبینی',resolve:'رسیدگی به بازبینی',plan:'تعریف هدف بهبود',
  plan_progress:'به‌روزرسانی پیشرفت',plan_review:'بررسی نتیجه برنامه'}
const reasons:Record<string,string>={return:'دلیل برگشت',reopen:'دلیل بازگشایی',comment:'نظر شما',appeal:'دلیل بازبینی',resolve:'نتیجه و دلیل تصمیم',
  plan_progress:'گزارش پیشرفت',plan_review:'بازخورد مدیر'}
type Operation={action:string;label:string;appealId?:string;decision?:string;planId?:string;progress?:number;state?:string}
type FormValues={note?:string;indicator?:string;explanation?:string;progress?:number;plan?:PlanInput}

export function DateField({value,onChange}:{value?:string;onChange?:(value:string)=>void}){
  return <PersianDatePicker value={jalali(value)} onChange={v=>onChange?.(v?iso(v):'')}/>
}
function FilesField({value,onChange,indicator}:{value:SelectedFile[];onChange:(files:SelectedFile[])=>void;indicator?:string}){
  return <Space direction="vertical">
    <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt" aria-label="انتخاب مستندات" onChange={e=>{
      onChange([...value,...Array.from(e.currentTarget.files??[]).map(file=>({file,indicator}))]);e.currentTarget.value=''
    }}/>
    {value.map(({file},i)=><Tag key={i} closable onClose={()=>onChange(value.filter((_,j)=>j!==i))}>{file.name}</Tag>)}
  </Space>
}
function Evidence({id,files}:{id:string;files:Attachment[]}){
  return <Space wrap>{files.map(file=><Button key={file.id} type="link" size="small" onClick={()=>void download('/'+id+'/files/'+file.id,file.name).catch(e=>message.error(err(e)))}>{file.name}</Button>)}</Space>
}
function ScoreCard({item,value,edit,canAdjust,allowNA,change}:{item:Indicator;value:Score;edit:boolean;canAdjust:boolean;allowNA:boolean;change:(value:Score)=>void}){
  return <Card size="small" title={<Space wrap>{item.label}<Tag>وزن {fa(item.weight)}٪</Tag><Tag>{item.kind==='quantitative'?'کمی':'کیفی'}</Tag></Space>}>
    <Space direction="vertical" style={{width:'100%'}}>
      {item.description&&<span>{item.description}</span>}
      <span>{item.method}{item.goal!=null?' · هدف '+fa(item.goal)+' '+item.unit:''}</span>
      {item.metric&&<span>{metrics[item.metric]} · امتیاز خودکار {fa(value.source)}</span>}
      {edit?<Space wrap>
        <InputNumber aria-label={'امتیاز '+item.label} min={0} max={100} precision={2} value={value.value} disabled={value.na||!!item.metric&&!value.adjust}
          onChange={v=>change({...value,value:v})} placeholder="امتیاز"/>
        {canAdjust&&item.metric&&<Checkbox checked={value.adjust} onChange={e=>change({...value,adjust:e.target.checked,value:e.target.checked?value.value:value.source})}>تعدیل دستی با دلیل</Checkbox>}
        {allowNA&&item.allowNA&&<Checkbox checked={value.na} onChange={e=>change({...value,na:e.target.checked})}>غیرقابل‌اعمال</Checkbox>}
      </Space>:<strong>{value.na?'غیرقابل‌اعمال':fa(value.value)}{value.adjusted?' · تعدیل‌شده':''}</strong>}
      {edit?<><Input.TextArea aria-label={'دلیل '+item.label} placeholder="دلیل امتیاز یا عدم شمول" value={value.note} maxLength={3000} onChange={e=>change({...value,note:e.target.value})}/>
        <Input.TextArea aria-label={'نمونه '+item.label} placeholder="نمونه خروجی یا رفتار" value={value.sample} maxLength={4000} onChange={e=>change({...value,sample:e.target.value})}/></>:
        <>{value.note&&<span style={{whiteSpace:'pre-wrap'}}>{value.note}</span>}{value.sample&&<span style={{whiteSpace:'pre-wrap'}}>{value.sample}</span>}</>}
    </Space>
  </Card>
}
export function PlanCard({plan,children}:{plan:Plan;children?:React.ReactNode}){
  const data=plan.plan
  return <Card size="small" title={data.title} extra={<Tag>{labels[plan.state]}</Tag>}>
    <Descriptions size="small" column={{xs:1,sm:2}} items={[
      {key:'period',label:'بازه',children:displayDate(data.from)+' تا '+displayDate(data.to)},
      {key:'owner',label:'مسئول',children:data.responsible},{key:'initial',label:'وضعیت اولیه',children:data.initial||'—'},
      {key:'action',label:'اقدام',children:data.description},{key:'outcome',label:'نتیجه مورد انتظار',children:data.outcome},
      {key:'criterion',label:'معیار موفقیت',children:data.criterion},
      {key:'employee',label:'گزارش کارمند',children:plan.employee_note||'—'},{key:'review',label:'نتیجه بررسی',children:plan.manager_note||'—'},
    ]}/>
    <Progress percent={plan.progress}/>{children}
  </Card>
}
export default function EvaluationDialog({id,close,updated,initialTab}:{id?:string;close:()=>void;updated?:()=>void;initialTab?:string}){
  const [detail,setDetail]=useState<Detail>(),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false)
  const [scores,setScores]=useState<Record<string,Score>>({}),[feedback,setFeedback]=useState<Record<string,string>>({})
  const [files,setFiles]=useState<SelectedFile[]>([]),[operationFiles,setOperationFiles]=useState<SelectedFile[]>([])
  const [operation,setOperation]=useState<Operation>(),[operationError,setOperationError]=useState(''),[tab,setTab]=useState('result')
  const [form]=Form.useForm<FormValues>()
  function receive(data:Detail){
    setDetail(data);setScores(Object.fromEntries(Object.entries(data.data.scores??{}).map(([key,value])=>[key,{...value,adjust:value.adjusted}])))
    setFeedback(data.data.feedback??{});setFiles([])
  }
  useEffect(()=>{
    if(!id)return
    let live=true
    setDetail(undefined);setLoading(true);setError('');setOperation(undefined);setTab(initialTab??'result')
    request<Detail>('/'+id).then(data=>{
      if(!live)return
      receive(data)
      if(data.own&&!data.seen)void request('/'+id,'PATCH',{action:'seen'}).catch(e=>message.error(err(e)))
    }).catch(e=>{if(live)setError(err(e))}).finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[id,initialTab])
  function open(action:Operation){
    setOperation(action);setOperationFiles([]);setOperationError('');form.resetFields()
    form.setFieldsValue({note:action.action==='comment'?detail?.employeeNote:undefined,progress:action.progress,plan:action.action==='plan'?{responsible:detail?.name??''} as PlanInput:undefined})
  }
  async function execute(action:Operation,values:FormValues={}){
    if(!id||!detail)return
    setBusy(true);setError('');setOperationError('')
    try{
      const scoring=['save','send'].includes(action.action)
      const data=scoring?{scores,feedback,version:detail.version,files:await encodeFiles(files)}:{...values,files:await encodeFiles(operationFiles)}
      await request('/'+id,'PATCH',{...action,...data})
      setOperation(undefined);updated?.()
      const dataAfter=await request<Detail>('/'+id)
      if(!scoring&&detail.actions.write&&dataAfter.actions.write){
        setDetail({...dataAfter,version:detail.version===dataAfter.version-1?dataAfter.version:detail.version})
      }else receive(dataAfter)
      message.success('عملیات ثبت شد')
    }catch(e){if(operation)setOperationError(err(e));else setError(err(e))}
    finally{setBusy(false)}
  }
  const actions=detail?.actions??{},result=detail?.data
  const indicators=result?.template.items??[]
  const options=indicators.map(i=>({value:i.id,label:i.label}))
  const enableFiles=operation&&['appeal','plan','plan_progress','plan_review'].includes(operation.action)
  return <>
    <Modal open={!!id} onCancel={close} width={980} footer={null} title={detail?'ارزیابی '+(detail.name??'من')+' · '+detail.period.label:'ارزیابی دوره‌ای'}>
      <div dir="rtl">
        {error&&<Alert type="error" showIcon message={error}/>}
        {loading&&<Spin/>}
        {detail&&result&&<>
          <Space wrap style={{marginBlock:12}}>
            <Tag color={['published','closed'].includes(detail.state)?'green':'blue'}>{labels[detail.state]}</Tag>
            <strong>{detail.score==null?'امتیاز ذخیره‌نشده':faScore(detail.score)+' از ۱۰۰'}</strong>{detail.band&&<Tag color="purple">{detail.band}</Tag>}
            {actions.write&&<><Button loading={busy} onClick={()=>void execute({action:'save',label:'ذخیره پیش‌نویس'})}>ذخیره پیش‌نویس</Button><Button type="primary" onClick={()=>open({action:'send',label:'ارسال ارزیابی'})}>ارسال ارزیابی</Button></>}
            {actions.approve&&<><Button type="primary" onClick={()=>open({action:'approve',label:'تأیید نهایی'})}>تأیید نهایی</Button><Button onClick={()=>open({action:'return',label:'برگشت برای اصلاح'})}>برگشت برای اصلاح</Button></>}
            {actions.publish&&<Button type="primary" onClick={()=>open({action:'publish',label:'انتشار برای کارمند'})}>انتشار برای کارمند</Button>}
            {actions.reopen&&<Button onClick={()=>open({action:'reopen',label:'بازگشایی ارزیابی'})}>بازگشایی</Button>}
            {actions.close&&<Button onClick={()=>open({action:'close',label:'بستن ارزیابی'})}>بستن ارزیابی</Button>}
          </Space>
          <Tabs activeKey={tab} onChange={setTab} items={[
            {key:'result',label:actions.write?'فرم ارزیابی':'نتیجه و امتیازها',children:<Space direction="vertical" size="middle" style={{width:'100%'}}>
              <Descriptions size="small" column={{xs:1,sm:2,lg:3}} items={[
                {key:'period',label:'بازه',children:displayDate(detail.period.from)+' تا '+displayDate(detail.period.to)},
                {key:'name',label:'ارزیاب',children:detail.reviewer??'—'},{key:'org',label:'واحد و سمت',children:[detail.department,detail.position].filter(Boolean).join(' · ')||'—'},
                {key:'template',label:'الگوی ثبت‌شده',children:detail.template},{key:'published',label:'تاریخ انتشار',children:displayDate(detail.published)},
                {key:'seen',label:'مشاهده کارمند',children:displayDate(detail.seen)},
              ]}/>
              {indicators.map(item=><div key={item.id}>
                <ScoreCard item={item} value={scores[item.id]??{}} edit={actions.write} canAdjust={detail.canAdjust} allowNA={result.rules.missingMode==='redistribute'}
                  change={value=>setScores(current=>({...current,[item.id]:value}))}/>
                <Evidence id={detail.id} files={detail.files.filter(f=>f.indicator_key===item.id&&!f.appeal_id&&!f.plan_id)}/>
                {actions.write&&<FilesField indicator={item.id} value={files.filter(f=>f.indicator===item.id)}
                  onChange={next=>setFiles(current=>[...current.filter(f=>f.indicator!==item.id),...next])}/>}
              </div>)}
            </Space>},
            {key:'metrics',label:'داده‌های پشتیبان',children:<>
              <Descriptions bordered size="small" column={{xs:1,sm:2,lg:3}} items={Object.entries(metrics).map(([key,label])=>({
                key,label,children:fa(result.metrics?.[key])+(key.endsWith('Rate')&&result.metrics?.[key]!=null?'٪':''),
              }))}/>
              <List dataSource={result.metrics?.sources??[]} locale={{emptyText:'خروجی فعالیتی برای این دوره ثبت نشده است'}} renderItem={entry=><List.Item>
                <List.Item.Meta title={entry.title+' · '+displayDate(entry.date)} description={[entry.project,entry.task,entry.outcome].filter(Boolean).join(' · ')}/>
              </List.Item>}/>
            </>},
            {key:'feedback',label:'بازخورد مدیر',children:<Space direction="vertical" style={{width:'100%'}}>
              {Object.entries(feedbackFields).map(([key,label])=><label key={key} style={{display:'block',whiteSpace:'pre-wrap'}}><strong>{label}</strong>
                {actions.write?<Input.TextArea value={feedback[key]} maxLength={4000} onChange={e=>setFeedback(current=>({...current,[key]:e.target.value}))}/>:<div>{feedback[key]||'—'}</div>}
              </label>)}
              {detail.employeeNote&&<p>نظر کارمند · {detail.employeeNote}</p>}
              {actions.comment&&<Button onClick={()=>open({action:'comment',label:'ثبت نظر کارمند'})}>ثبت یا ویرایش نظر</Button>}
            </Space>},
            {key:'appeals',label:'درخواست‌های بازبینی',children:<>
              {actions.appeal&&<Button onClick={()=>open({action:'appeal',label:'درخواست بازبینی'})}>درخواست بازبینی جدید</Button>}
              <List dataSource={detail.appeals} locale={{emptyText:'درخواستی ثبت نشده است'}} renderItem={appeal=><List.Item>
                <Space direction="vertical">
                  <strong>{appeal.Reason} · {displayDate(appeal.CreatedAt)}</strong><span>{appeal.PeriodicExplanation}</span>
                  {appeal.PeriodicIndicatorKey&&<Tag>{indicators.find(i=>i.id===appeal.PeriodicIndicatorKey)?.label}</Tag>}
                  <Tag color={appeal.Status<2?'gold':'default'}>{appeal.Status<2?'در انتظار رسیدگی':appeal.PeriodicDecision==='accepted'?'پذیرفته شد':'رد شد'}</Tag>
                  {appeal.ReviewerResponse&&<span>{appeal.ReviewerResponse}</span>}
                  <Evidence id={detail.id} files={detail.files.filter(f=>f.appeal_id===appeal.Id)}/>
                  {actions.resolve&&appeal.Status<2&&<Space><Button onClick={()=>open({action:'resolve',label:'پذیرش بازبینی',decision:'accepted',appealId:appeal.Id})}>پذیرش</Button>
                    <Button onClick={()=>open({action:'resolve',label:'رد درخواست',decision:'rejected',appealId:appeal.Id})}>رد درخواست</Button></Space>}
                </Space>
              </List.Item>}/>
            </>},
            {key:'improvement',label:'برنامه بهبود',children:<Space direction="vertical" style={{width:'100%'}}>
              {actions.plan&&<Button onClick={()=>open({action:'plan',label:'تعریف هدف بهبود'})}>تعریف هدف بهبود</Button>}
              {!detail.plans.length&&<span>هنوز هدف بهبودی ثبت نشده است.</span>}
              {detail.plans.map(p=><PlanCard key={p.id} plan={p}><Space wrap>
                <Evidence id={detail.id} files={detail.files.filter(f=>f.plan_id===p.id)}/>
                {actions.planProgress&&['planned','active','followup'].includes(p.state)&&<>
                  <Button onClick={()=>open({action:'plan_progress',label:'ثبت پیشرفت',state:'active',planId:p.id,progress:p.progress})}>ثبت پیشرفت</Button>
                  <Button onClick={()=>open({action:'plan_progress',label:'ارسال نتیجه برای مدیر',state:'review',planId:p.id,progress:100})}>ارسال نتیجه</Button>
                </>}
                {actions.plan&&p.state==='review'&&<>
                  <Button onClick={()=>open({action:'plan_review',label:'تأیید تحقق هدف',state:'achieved',planId:p.id})}>تأیید تحقق</Button>
                  <Button onClick={()=>open({action:'plan_review',label:'ارجاع برای پیگیری',state:'followup',planId:p.id})}>ارجاع برای پیگیری</Button>
                </>}
                {actions.plan&&!['achieved','cancelled'].includes(p.state)&&<Button onClick={()=>open({action:'plan_review',label:'لغو هدف',state:'cancelled',planId:p.id})}>لغو هدف</Button>}
              </Space></PlanCard>)}
              {detail.priorPlans.length>0&&<><strong>اهداف دوره‌های پیشین</strong>{detail.priorPlans.map(p=><PlanCard key={p.id} plan={p}/>)}</>}
            </Space>},
            {key:'history',label:'تاریخچه',children:<List dataSource={detail.history} renderItem={h=><List.Item><Space direction="vertical">
              <strong>{historyLabels[h.action]??h.action} · {displayDate(h.date)}{h.actor?' · '+h.actor:''}</strong>
              {h.details.note&&<span>{h.details.note}</span>}
              {(h.details.previousScore??h.details.publication?.score)!=null&&<span>امتیاز نسخه قبلی {fa(h.details.previousScore??h.details.publication?.score)}</span>}
              {h.details.score!=null&&<span>امتیاز ثبت‌شده {fa(h.details.score)}</span>}
              {h.details.before&&h.details.after&&indicators.filter(i=>JSON.stringify(h.details.before?.[i.id])!==JSON.stringify(h.details.after?.[i.id])).map(i=><span key={i.id}>
                {i.label} · {fa(h.details.before?.[i.id]?.value)} ← {fa(h.details.after?.[i.id]?.value)}
              </span>)}
            </Space></List.Item>}/>},
          ]}/>
        </>}
      </div>
    </Modal>
    <Modal title={operation?.label} open={!!operation} onCancel={()=>setOperation(undefined)} onOk={()=>form.submit()} okText="ثبت" cancelText="انصراف" confirmLoading={busy} forceRender>
      {operationError&&<Alert type="error" showIcon message={operationError}/>}
      <Form form={form} dir="rtl" layout="vertical" onFinish={values=>{if(operation)void execute(operation,values)}}>
        {operation&&!reasons[operation.action]&&operation.action!=='plan'&&<p>برای انجام عملیات «{operation.label}» روی ثبت بزنید.</p>}
        {operation&&reasons[operation.action]&&<Form.Item name="note" label={reasons[operation.action]} rules={[{required:operation.action!=='plan_progress',whitespace:true}]}><Input.TextArea maxLength={4000}/></Form.Item>}
        {operation?.action==='appeal'&&<>
          <Form.Item name="indicator" label="شاخص مورد اعتراض"><Select allowClear options={options}/></Form.Item>
          <Form.Item name="explanation" label="توضیح و مستندات" rules={[{required:true,whitespace:true}]}><Input.TextArea maxLength={4000}/></Form.Item>
        </>}
        {operation?.action==='plan'&&<>
          {Object.entries({title:'عنوان هدف',description:'اقدام اصلاحی یا آموزشی',initial:'وضعیت اولیه',outcome:'نتیجه مورد انتظار',criterion:'معیار موفقیت',responsible:'مسئول اجرا'}).map(([key,label])=>
            <Form.Item key={key} name={['plan',key]} label={label} rules={[{required:key!=='initial',whitespace:true}]}><Input maxLength={key==='title'?200:key==='responsible'?160:2000}/></Form.Item>)}
          <Form.Item name={['plan','indicator']} label="شاخص مرتبط"><Select allowClear options={options}/></Form.Item>
          <Space wrap><Form.Item name={['plan','from']} label="تاریخ شروع" rules={[{required:true}]}><DateField/></Form.Item>
            <Form.Item name={['plan','to']} label="مهلت" rules={[{required:true}]}><DateField/></Form.Item></Space>
        </>}
        {operation?.action==='plan_progress'&&<Form.Item name="progress" label="درصد پیشرفت" rules={[{required:true}]}><InputNumber min={0} max={100} disabled={operation.state==='review'}/></Form.Item>}
        {enableFiles&&<FilesField value={operationFiles} onChange={setOperationFiles}/>}
      </Form>
    </Modal>
  </>
}
