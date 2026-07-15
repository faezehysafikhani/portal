import { useEffect, useRef, useState } from 'react'
import { Alert, Avatar, Button, Card, Col, Empty, Input, List, message, Popconfirm, Row, Space, Spin, Tag } from 'antd'
import { BarChartOutlined, BulbOutlined, DeleteOutlined, FileTextOutlined, PlusOutlined, RobotOutlined, SendOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { apiFetch } from '../utils/api'

const API='http://localhost:5043/api/v1'
const codePattern=/<\s*(script|iframe|object)|javascript\s*:|;\s*(drop|delete|alter)\s+/i
interface ChatMessage { id:string; role:'user'|'assistant'; content:string; createdAt:string }
interface Conversation { id:string; title:string; createdAt:string; updatedAt?:string; messageCount:number }
interface AiStatus { configured:boolean; providerName?:string; model?:string }
const QUICK=[
  {icon:<BarChartOutlined/>,text:'وضعیت کلی سیستم و موارد نیازمند رسیدگی را تحلیل کن',color:'#1677ff'},
  {icon:<FileTextOutlined/>,text:'آخرین نامه‌های مجاز برای من را خلاصه کن',color:'#52c41a'},
  {icon:<TeamOutlined/>,text:'یک گزارش مدیریتی کوتاه از داده‌های فعلی ارائه بده',color:'#fa8c16'},
  {icon:<BulbOutlined/>,text:'بر اساس داده‌های موجود پیشنهاد بهبود فرآیندها را بده',color:'#722ed1'}
]

export default function AiPage(){
  const [status,setStatus]=useState<AiStatus>({configured:false})
  const [conversations,setConversations]=useState<Conversation[]>([])
  const [conversationId,setConversationId]=useState<string>()
  const [messages,setMessages]=useState<ChatMessage[]>([])
  const [input,setInput]=useState('')
  const [loading,setLoading]=useState(false)
  const [initializing,setInitializing]=useState(true)
  const endRef=useRef<HTMLDivElement>(null)
  const headers={'Content-Type':'application/json'}

  const loadConversations=async()=>{const r=await apiFetch(`${API}/ai/conversations`);if(r.ok)setConversations(await r.json())}
  const initialize=async()=>{const r=await apiFetch(`${API}/ai/status`);if(r.ok)setStatus(await r.json());await loadConversations();setInitializing(false)}
  useEffect(()=>{initialize()},[])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages,loading])
  const openConversation=async(id:string)=>{const r=await apiFetch(`${API}/ai/conversations/${id}`);const data=await r.json().catch(()=>({}));if(!r.ok){message.error(data.message||'گفتگو دریافت نشد');return}setConversationId(id);setMessages(data.messages||[])}
  const newConversation=()=>{setConversationId(undefined);setMessages([]);setInput('')}
  const removeConversation=async(id:string)=>{const r=await apiFetch(`${API}/ai/conversations/${id}`,{method:'DELETE'});if(!r.ok)return message.error('حذف گفتگو انجام نشد');if(conversationId===id)newConversation();await loadConversations()}
  const send=async(text?:string)=>{
    const content=(text??input).trim();if(!content||loading)return
    if(content.length>4000||codePattern.test(content)){message.error('متن سؤال معتبر نیست');return}
    const optimistic:ChatMessage={id:`temp-${Date.now()}`,role:'user',content,createdAt:new Date().toISOString()}
    setMessages(prev=>[...prev,optimistic]);setInput('');setLoading(true)
    const r=await apiFetch(`${API}/ai/chat`,{method:'POST',headers,body:JSON.stringify({conversationId,message:content})})
    const data=await r.json().catch(()=>({}));setLoading(false)
    if(!r.ok){message.error(data.message||'پاسخ سرویس هوش مصنوعی دریافت نشد');if(data.conversationId&&!conversationId)setConversationId(data.conversationId);return}
    setConversationId(data.conversationId);setMessages(prev=>[...prev,data.message]);await loadConversations()
  }
  if(initializing)return <div style={{height:420,display:'grid',placeItems:'center'}}><Spin size="large" tip="در حال آماده‌سازی دستیار"/></div>
  return <div style={{height:'calc(100vh - 125px)',display:'flex',gap:14,minHeight:560}}>
    <Card title="تاریخچه گفتگو" extra={<Button type="text" icon={<PlusOutlined/>} onClick={newConversation}/>} style={{width:285,flexShrink:0,borderRadius:14}} styles={{body:{padding:8,height:'calc(100% - 58px)',overflowY:'auto'}}}>
      {conversations.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="هنوز گفتگویی ندارید"/>:<List dataSource={conversations} renderItem={item=><List.Item onClick={()=>openConversation(item.id)} style={{cursor:'pointer',padding:'10px 8px',background:item.id===conversationId?'#f6eaf3':'transparent',borderRadius:8,marginBottom:4}} actions={[<Popconfirm key="delete" title="حذف گفتگو؟" onConfirm={()=>removeConversation(item.id)}><Button onClick={e=>e.stopPropagation()} type="text" danger size="small" icon={<DeleteOutlined/>}/></Popconfirm>]}><List.Item.Meta title={<span style={{fontSize:12}}>{item.title}</span>} description={<small>{item.messageCount} پیام · {new Date(item.updatedAt||item.createdAt).toLocaleDateString('fa-IR')}</small>}/></List.Item>}/>} 
    </Card>
    <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
      {!status.configured&&<Alert type="warning" showIcon style={{marginBottom:12}} message="سرویس هوش مصنوعی هنوز فعال نشده است" description="مدیر سیستم باید از تنظیمات، API Key و مدل را ذخیره و سرویس را فعال کند."/>}
      {status.configured&&<div style={{marginBottom:10}}><Tag color="purple"><RobotOutlined/> {status.providerName} · {status.model}</Tag><Tag color="green">داده زنده و کنترل‌شده</Tag></div>}
      {messages.length===0&&<Row gutter={[8,8]} style={{marginBottom:12}}>{QUICK.map((q,i)=><Col xs={12} xl={6} key={i}><Card hoverable size="small" onClick={()=>send(q.text)} style={{height:'100%',borderTop:`3px solid ${q.color}`,opacity:status.configured?1:.55}}><Space direction="vertical" size={4}><span style={{color:q.color,fontSize:18}}>{q.icon}</span><span style={{fontSize:11,lineHeight:1.7}}>{q.text}</span></Space></Card></Col>)}</Row>}
      <Card style={{flex:1,borderRadius:14,overflow:'hidden'}} styles={{body:{padding:0,height:'100%',display:'flex',flexDirection:'column'}}}>
        <div style={{flex:1,overflowY:'auto',padding:20,background:'linear-gradient(145deg,#fff,#faf5f9)'}}>
          {messages.length===0?<div style={{height:'100%',display:'grid',placeItems:'center'}}><div style={{textAlign:'center'}}><Avatar size={76} icon={<RobotOutlined/>} style={{background:'#722ed1',marginBottom:14}}/><h3>دستیار هوشمند سازمانی</h3><p style={{color:'#888'}}>سؤال خود را درباره نامه‌ها، وظایف، تیکت‌ها و فرم‌های مجاز بپرسید.</p></div></div>:messages.map(item=><div key={item.id} style={{display:'flex',justifyContent:item.role==='user'?'flex-start':'flex-end',gap:8,marginBottom:15,flexDirection:item.role==='user'?'row':'row-reverse'}}><Avatar icon={item.role==='user'?<UserOutlined/>:<RobotOutlined/>} style={{background:item.role==='user'?'#1677ff':'#722ed1'}}/><div style={{maxWidth:'76%'}}><div style={{padding:'11px 15px',borderRadius:item.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',background:item.role==='user'?'#e6f4ff':'#f5e8ff',border:`1px solid ${item.role==='user'?'#bae0ff':'#d3adf7'}`,whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.9}}>{item.content}</div><small style={{color:'#aaa'}}>{new Date(item.createdAt).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}</small></div></div>)}
          {loading&&<div style={{display:'flex',justifyContent:'flex-end',gap:8}}><Avatar icon={<RobotOutlined/>} style={{background:'#722ed1'}}/><div style={{padding:12,background:'#f5e8ff',borderRadius:12}}><Spin size="small"/> در حال تحلیل داده‌های مجاز...</div></div>}<div ref={endRef}/>
        </div>
        <div style={{padding:14,borderTop:'1px solid #eee',display:'flex',gap:10}}><Input.TextArea value={input} onChange={e=>setInput(e.target.value)} maxLength={4000} showCount autoSize={{minRows:1,maxRows:5}} disabled={!status.configured||loading} onPressEnter={e=>{if(!e.shiftKey){e.preventDefault();send()}}} placeholder="سؤال خود را بنویسید؛ Shift+Enter برای خط جدید"/><Button type="primary" icon={<SendOutlined/>} loading={loading} disabled={!status.configured||!input.trim()} onClick={()=>send()} style={{background:'#722ed1'}}>ارسال</Button></div>
      </Card>
    </div>
  </div>
}
