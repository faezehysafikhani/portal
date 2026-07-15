import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Input, message, Space, Spin, Tag } from 'antd'
import { SearchOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import { apiFetch } from '../utils/api'

const API='http://localhost:5043/api/v1'
const codePattern=/<[^>]*>|javascript\s*:|--|\/\*|\*\/|;\s*(select|insert|update|delete|drop|alter|exec)|\bunion\s+select/i
interface ChatUser { id:string; fullName:string; position?:string; department?:string; avatarUrl?:string; isOnline:boolean; lastMessage?:string; lastMessageAt?:string; unread:number }
interface ChatMessage { id:string; senderUserId:string; recipientUserId:string; content:string; isRead:boolean; createdAt:string; isMe:boolean }

export default function ChatPage(){
  const [users,setUsers]=useState<ChatUser[]>([])
  const [selectedId,setSelectedId]=useState<string>()
  const [messages,setMessages]=useState<ChatMessage[]>([])
  const [search,setSearch]=useState('')
  const [text,setText]=useState('')
  const [loading,setLoading]=useState(true)
  const endRef=useRef<HTMLDivElement>(null)
  const selected=users.find(x=>x.id===selectedId)

  const loadUsers=async(silent=false)=>{
    const response=await apiFetch(`${API}/chat/users`)
    if(!response.ok){if(!silent)message.error('دریافت کارتابل پیام‌ها انجام نشد');setLoading(false);return}
    const data:ChatUser[]=await response.json();setUsers(data)
    const fromUrl=new URLSearchParams(location.search).get('user')||undefined
    setSelectedId(current=>current||(fromUrl&&data.some(x=>x.id===fromUrl)?fromUrl:data[0]?.id));setLoading(false)
  }
  const loadMessages=async(userId:string,silent=false)=>{
    const response=await apiFetch(`${API}/chat/messages/${userId}`)
    if(!response.ok){if(!silent)message.error('دریافت پیام‌ها انجام نشد');return}
    setMessages(await response.json());setUsers(prev=>prev.map(x=>x.id===userId?{...x,unread:0}:x))
  }
  useEffect(()=>{loadUsers();const timer=setInterval(()=>loadUsers(true),10000);return()=>clearInterval(timer)},[])
  useEffect(()=>{if(!selectedId)return;loadMessages(selectedId);const timer=setInterval(()=>loadMessages(selectedId,true),6000);return()=>clearInterval(timer)},[selectedId])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages])

  const send=async()=>{
    const content=text.trim();if(!selectedId||!content)return
    if(content.length>2000||codePattern.test(content)){message.error('متن پیام معتبر نیست؛ ورود کد مجاز نیست');return}
    const response=await apiFetch(`${API}/chat/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipientUserId:selectedId,content})})
    const result=await response.json().catch(()=>({}));if(!response.ok){message.error(result.message||'ارسال پیام انجام نشد');return}
    setMessages(prev=>[...prev,result]);setText('');setUsers(prev=>prev.map(x=>x.id===selectedId?{...x,lastMessage:content,lastMessageAt:result.createdAt}:x))
  }
  const filtered=useMemo(()=>users.filter(x=>`${x.fullName} ${x.position||''} ${x.department||''}`.includes(search.trim())),[users,search])
  const choose=(id:string)=>{setSelectedId(id);history.replaceState(null,'',`/chat?user=${id}`)}
  const faTime=(value?:string)=>value?new Date(value).toLocaleString('fa-IR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''

  if(loading)return <div style={{display:'grid',placeItems:'center',height:400}}><Spin size="large"/></div>
  return <div style={{height:'calc(100vh - 125px)',display:'flex',gap:14,minHeight:520}}>
    <Card title={<Space>💬 <span>کارتابل پیام‌ها</span><Badge count={users.reduce((s,x)=>s+x.unread,0)}/></Space>} style={{width:320,flexShrink:0,borderRadius:14,overflow:'hidden'}} styles={{body:{padding:0,height:'calc(100% - 58px)',display:'flex',flexDirection:'column'}}}>
      <div style={{padding:12,borderBottom:'1px solid #f0f0f0'}}><Input allowClear prefix={<SearchOutlined/>} value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجوی همکار..."/></div>
      <div style={{overflowY:'auto',flex:1}}>{filtered.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="کاربری یافت نشد"/>:filtered.map(user=><div key={user.id} onClick={()=>choose(user.id)} style={{padding:'12px 14px',cursor:'pointer',borderBottom:'1px solid #f5f5f5',background:selectedId===user.id?'#f7eaf3':'#fff',borderRight:selectedId===user.id?'4px solid #8b1a6b':'4px solid transparent'}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}><Badge dot color={user.isOnline?'#52c41a':'#bfbfbf'} offset={[-4,35]}><Avatar size={42} src={user.avatarUrl} icon={<UserOutlined/>} style={{background:'#8b1a6b'}}/></Badge>
          <div style={{flex:1,minWidth:0}}><div style={{display:'flex',justifyContent:'space-between'}}><b style={{fontSize:13}}>{user.fullName}</b><small style={{color:'#999'}}>{faTime(user.lastMessageAt)}</small></div>
            <div style={{fontSize:11,color:'#888'}}>{user.position||user.department||'کاربر داخلی'}</div><div style={{display:'flex',justifyContent:'space-between',marginTop:3}}><span style={{fontSize:11,color:'#777',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:195}}>{user.lastMessage||'هنوز پیامی ردوبدل نشده'}</span>{user.unread>0&&<Badge count={user.unread} style={{background:'#8b1a6b'}}/>}</div></div>
        </div></div>)}</div>
    </Card>
    <Card style={{flex:1,borderRadius:14,overflow:'hidden'}} styles={{body:{height:'100%',padding:0,display:'flex',flexDirection:'column'}}}>
      {!selected?<Empty style={{margin:'auto'}} description="یک همکار را انتخاب کنید"/>:<>
        <div style={{padding:'12px 18px',borderBottom:'1px solid #eee',display:'flex',alignItems:'center',gap:10}}><Badge dot color={selected.isOnline?'#52c41a':'#bfbfbf'}><Avatar src={selected.avatarUrl} icon={<UserOutlined/>}/></Badge><div><b>{selected.fullName}</b><div style={{fontSize:11,color:'#888'}}>{selected.position||selected.department}</div></div><Tag color={selected.isOnline?'green':'default'} style={{marginRight:'auto'}}>{selected.isOnline?'آنلاین':'آفلاین'}</Tag></div>
        <div style={{flex:1,overflowY:'auto',padding:20,background:'linear-gradient(145deg,#fafafa,#f7f0f5)'}}>{messages.length===0?<Empty description="هنوز پیامی ندارید"/>:messages.map(item=><div key={item.id} style={{display:'flex',justifyContent:item.isMe?'flex-start':'flex-end',marginBottom:12}}><div style={{maxWidth:'70%'}}><div style={{background:item.isMe?'#8b1a6b':'white',color:item.isMe?'white':'#333',padding:'9px 14px',borderRadius:item.isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',boxShadow:'0 2px 8px #0000000c',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.content}</div><div style={{fontSize:10,color:'#999',marginTop:3}}>{faTime(item.createdAt)} {item.isMe&&(item.isRead?'✓✓':'✓')}</div></div></div>)}<div ref={endRef}/></div>
        <div style={{padding:14,borderTop:'1px solid #eee',display:'flex',gap:10}}><Input.TextArea autoSize={{minRows:1,maxRows:4}} value={text} maxLength={2000} showCount onChange={e=>setText(e.target.value)} onPressEnter={e=>{if(!e.shiftKey){e.preventDefault();send()}}} placeholder={`پیام به ${selected.fullName}...`}/><Button type="primary" icon={<SendOutlined/>} onClick={send} disabled={!text.trim()} style={{background:'#8b1a6b'}}>ارسال</Button></div>
      </>}
    </Card>
  </div>
}
