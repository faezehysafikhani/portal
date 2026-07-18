import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, Empty, Input, message, Popover, Space, Spin, Tag, Tooltip } from 'antd'
import { AudioOutlined, CloseOutlined, DownloadOutlined, FileOutlined, PaperClipOutlined, SearchOutlined, SendOutlined, SmileOutlined, StopOutlined, UserOutlined } from '@ant-design/icons'
import { apiFetch } from '../utils/api'

const API='http://localhost:5043/api/v1'
const MAX_FILE_SIZE=200*1024
const codePattern=/<[^>]*>|javascript\s*:|--|\/\*|\*\/|;\s*(select|insert|update|delete|drop|alter|exec)|\bunion\s+select/i
const allowedExtensions=['pdf','png','jpg','jpeg','txt','docx','xlsx']
const CHAT_EMOJIS=[...new Set(['👍','😂','😭','👏','🤞','🙏','🙂','🥰','😳','🙌','🙃','😊','🥳','🤪','💀','😱','🎉','😎','😴','✌️','😁','👌','🤭','😐','🤷','😋','💰','🥴','🥺','😢','🙋','💩','😜','🤗','💯','🤢','😉','🌹','🤫','🤐','🤥','🎂','🎈','😵‍💫','🤒','😷','🤔','😡','🤬','🤧','🤕','🥱','🤮','🤯','🥵','🥶','🤠','🧐','👻','🙈','🙉','🙊','🫰🏻','☝🏻','🤝🏼','🤦🏻‍♀️','🧑‍💻','🏃'])]
interface ChatUser { id:string; personId:string; personType:'user'|'contact'; fullName:string; position?:string; department?:string; avatarUrl?:string; isOnline:boolean; lastMessage?:string; lastMessageAt?:string; unread:number }
interface ChatMessage { id:string; senderUserId:string; recipientUserId:string; content:string; kind:'Text'|'File'|'Voice'|string; attachmentName?:string; attachmentContentType?:string; attachmentSize?:number; voiceDurationSeconds?:number; hasAttachment?:boolean; isRead:boolean; createdAt:string; isMe:boolean }

const bytesLabel=(size?:number)=>size?`${Math.ceil(size/1024).toLocaleString('fa-IR')} KB`:''
const fileToBase64=(file:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('read'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(file)})

function VoicePlayer({id}:{id:string}){
  const [src,setSrc]=useState(''),[failed,setFailed]=useState(false)
  useEffect(()=>{let url='';let cancelled=false;apiFetch(`${API}/chat/messages/${id}/attachment`).then(async r=>{if(!r.ok)throw new Error();url=URL.createObjectURL(await r.blob());if(!cancelled)setSrc(url)}).catch(()=>!cancelled&&setFailed(true));return()=>{cancelled=true;if(url)URL.revokeObjectURL(url)}},[id])
  if(failed)return <span style={{fontSize:12}}>فایل صوتی دریافت نشد</span>
  if(!src)return <Spin size="small"/>
  return <audio controls preload="metadata" src={src} style={{width:260,maxWidth:'100%',height:36}}/>
}

export default function ChatPage(){
  const [users,setUsers]=useState<ChatUser[]>([])
  const [selectedId,setSelectedId]=useState<string>()
  const [messages,setMessages]=useState<ChatMessage[]>([])
  const [search,setSearch]=useState('')
  const [text,setText]=useState('')
  const [loading,setLoading]=useState(true)
  const [sending,setSending]=useState(false)
  const [selectedFile,setSelectedFile]=useState<File>()
  const [recording,setRecording]=useState(false)
  const [recordSeconds,setRecordSeconds]=useState(0)
  const [emojiOpen,setEmojiOpen]=useState(false)
  const endRef=useRef<HTMLDivElement>(null)
  const fileInputRef=useRef<HTMLInputElement>(null)
  const recorderRef=useRef<MediaRecorder|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const chunksRef=useRef<Blob[]>([])
  const recordTimerRef=useRef<number|null>(null)
  const recordSecondsRef=useRef(0)
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
  useEffect(()=>()=>stopRecordingResources(),[])

  const postMessage=async(payload:Record<string,unknown>)=>{
    if(!selectedId||sending)return false
    setSending(true)
    const response=await apiFetch(`${API}/chat/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipientType:selected?.personType,recipientId:selected?.personId,...payload})})
    const result=await response.json().catch(()=>({}));setSending(false)
    if(!response.ok){message.error(result.message||'ارسال پیام انجام نشد');return false}
    setMessages(prev=>[...prev,result]);
    const last=result.kind==='Voice'?'🎤 پیام صوتی':result.kind==='File'?`📎 ${result.attachmentName}`:result.content
    setUsers(prev=>prev.map(x=>x.id===selectedId?{...x,lastMessage:last,lastMessageAt:result.createdAt}:x));return true
  }
  const send=async()=>{
    const content=text.trim();if(!selectedId||(!content&&!selectedFile))return
    if(content.length>2000||codePattern.test(content)){message.error('متن پیام معتبر نیست؛ ورود کد مجاز نیست');return}
    if(selectedFile){
      if(selectedFile.size>MAX_FILE_SIZE){message.error('حداکثر حجم فایل ۲۰۰ کیلوبایت است');return}
      const attachmentData=await fileToBase64(selectedFile).catch(()=>null);if(!attachmentData){message.error('خواندن فایل انجام نشد');return}
      if(await postMessage({content,kind:'file',attachmentName:selectedFile.name,attachmentData,attachmentContentType:selectedFile.type||'application/octet-stream',attachmentSize:selectedFile.size})){setText('');setSelectedFile(undefined)}
    }else if(await postMessage({content,kind:'text'}))setText('')
  }
  const chooseFile=(file?:File)=>{
    if(!file)return
    const extension=file.name.split('.').pop()?.toLowerCase()||''
    if(!allowedExtensions.includes(extension)){message.error('فقط PDF، تصویر، TXT، Word و Excel مجاز است');return}
    if(file.size>MAX_FILE_SIZE){message.error(`حجم فایل ${Math.ceil(file.size/1024)}KB است؛ حداکثر ۲۰۰KB مجاز است`);return}
    setSelectedFile(file)
  }
  const stopRecordingResources=()=>{
    if(recordTimerRef.current)window.clearInterval(recordTimerRef.current)
    recordTimerRef.current=null;streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null
  }
  const stopRecording=()=>{if(recorderRef.current?.state==='recording')recorderRef.current.stop()}
  const startRecording=async()=>{
    if(!selectedId||recording)return
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){message.error('مرورگر شما ضبط صدا را پشتیبانی نمی‌کند');return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});streamRef.current=stream
      const candidates=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];const mimeType=candidates.find(x=>MediaRecorder.isTypeSupported(x))||''
      const recorder=new MediaRecorder(stream,mimeType?{mimeType,audioBitsPerSecond:24000}:{audioBitsPerSecond:24000});recorderRef.current=recorder;chunksRef.current=[];recordSecondsRef.current=0;setRecordSeconds(0)
      recorder.ondataavailable=e=>{if(e.data.size)chunksRef.current.push(e.data)}
      recorder.onstop=async()=>{
        const duration=Math.max(1,recordSecondsRef.current);const type=recorder.mimeType||mimeType||'audio/webm';const blob=new Blob(chunksRef.current,{type});stopRecordingResources();setRecording(false)
        if(blob.size>MAX_FILE_SIZE){message.error('حجم ویس بیشتر از ۲۰۰ کیلوبایت شد؛ ویس کوتاه‌تری ضبط کنید');return}
        const extension=type.includes('ogg')?'ogg':type.includes('mp4')?'m4a':'webm';const attachmentData=await fileToBase64(blob).catch(()=>null)
        if(!attachmentData){message.error('آماده‌سازی پیام صوتی انجام نشد');return}
        await postMessage({content:'',kind:'voice',attachmentName:`voice-${Date.now()}.${extension}`,attachmentData,attachmentContentType:type,attachmentSize:blob.size,voiceDurationSeconds:duration})
      }
      recorder.start(1000);setRecording(true);const started=Date.now()
      recordTimerRef.current=window.setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);recordSecondsRef.current=seconds;setRecordSeconds(seconds);if(seconds>=60)stopRecording()},500)
    }catch{stopRecordingResources();setRecording(false);message.error('اجازه دسترسی به میکروفن داده نشد')}
  }
  const downloadFile=async(item:ChatMessage)=>{
    const response=await apiFetch(`${API}/chat/messages/${item.id}/attachment`);if(!response.ok){message.error('دریافت فایل انجام نشد');return}
    const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=item.attachmentName||'attachment';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const filtered=useMemo(()=>users.filter(x=>`${x.fullName} ${x.position||''} ${x.department||''}`.includes(search.trim())),[users,search])
  const choose=(id:string)=>{if(recording)stopRecording();setSelectedFile(undefined);setSelectedId(id);history.replaceState(null,'',`/chat?user=${id}`)}
  const faTime=(value?:string)=>value?new Date(value).toLocaleString('fa-IR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''
  const addEmoji=(emoji:string)=>{setText(current=>`${current}${emoji}`.slice(0,2000));setEmojiOpen(false)}
  const emojiPicker=<div style={{width:280,display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:4,direction:'ltr'}}>{CHAT_EMOJIS.map(emoji=><Button key={emoji} type="text" onClick={()=>addEmoji(emoji)} style={{fontSize:21,padding:2,height:34}}>{emoji}</Button>)}</div>

  if(loading)return <div style={{display:'grid',placeItems:'center',height:400}}><Spin size="large"/></div>
  return <div style={{height:'calc(100vh - 125px)',display:'flex',gap:14,minHeight:520}}>
    <Card title={<Space>💬 <span>کارتابل پیام‌ها</span><Badge count={users.reduce((s,x)=>s+x.unread,0)}/></Space>} style={{width:320,flexShrink:0,borderRadius:14,overflow:'hidden'}} styles={{body:{padding:0,height:'calc(100% - 58px)',display:'flex',flexDirection:'column'}}}>
      <div style={{padding:12,borderBottom:'1px solid #f0f0f0'}}><Input allowClear prefix={<SearchOutlined/>} value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجوی همکار..."/></div>
      <div style={{overflowY:'auto',flex:1}}>{filtered.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="کاربری یافت نشد"/>:filtered.map(user=><div key={user.id} onClick={()=>choose(user.id)} style={{padding:'12px 14px',cursor:'pointer',borderBottom:'1px solid #f5f5f5',background:selectedId===user.id?'#f7eaf3':'#fff',borderRight:selectedId===user.id?'4px solid #8b1a6b':'4px solid transparent'}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}><Badge dot color={user.isOnline?'#52c41a':'#bfbfbf'} offset={[-4,35]}><Avatar size={42} src={user.avatarUrl} icon={<UserOutlined/>} style={{background:'#8b1a6b'}}/></Badge>
          <div style={{flex:1,minWidth:0}}><div style={{display:'flex',justifyContent:'space-between'}}><b style={{fontSize:13}}>{user.fullName}</b><small style={{color:'#999'}}>{faTime(user.lastMessageAt)}</small></div>
            <div style={{fontSize:11,color:'#888'}}>{user.position||user.department||(user.personType==='contact'?'مخاطب خارجی':'کاربر داخلی')}</div><div style={{display:'flex',justifyContent:'space-between',marginTop:3}}><span style={{fontSize:11,color:'#777',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:195}}>{user.lastMessage||'هنوز پیامی ردوبدل نشده'}</span>{user.unread>0&&<Badge count={user.unread} style={{background:'#8b1a6b'}}/>}</div></div>
        </div></div>)}</div>
    </Card>
    <Card style={{flex:1,borderRadius:14,overflow:'hidden'}} styles={{body:{height:'100%',padding:0,display:'flex',flexDirection:'column'}}}>
      {!selected?<Empty style={{margin:'auto'}} description="یک همکار را انتخاب کنید"/>:<>
        <div style={{padding:'12px 18px',borderBottom:'1px solid #eee',display:'flex',alignItems:'center',gap:10}}><Badge dot={selected.personType==='user'} color={selected.isOnline?'#52c41a':'#bfbfbf'}><Avatar src={selected.avatarUrl} icon={<UserOutlined/>}/></Badge><div><b>{selected.fullName}</b><div style={{fontSize:11,color:'#888'}}>{selected.position||selected.department}</div></div><Tag color={selected.personType==='contact'?'purple':selected.isOnline?'green':'default'} style={{marginRight:'auto'}}>{selected.personType==='contact'?'مخاطب':selected.isOnline?'آنلاین':'آفلاین'}</Tag></div>
        <div style={{flex:1,overflowY:'auto',padding:20,background:'linear-gradient(145deg,#fafafa,#f7f0f5)'}}>{messages.length===0?<Empty description="هنوز پیامی ندارید"/>:messages.map(item=>{const kind=String(item.kind||'Text').toLowerCase();return <div key={item.id} style={{display:'flex',justifyContent:item.isMe?'flex-start':'flex-end',marginBottom:12}}><div style={{maxWidth:'72%'}}><div style={{background:item.isMe?'#8b1a6b':'white',color:item.isMe?'white':'#333',padding:'9px 14px',borderRadius:item.isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',boxShadow:'0 2px 8px #0000000c',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>
          {kind==='voice'?<div><div style={{display:'flex',gap:6,alignItems:'center',marginBottom:5}}><AudioOutlined/><span style={{fontSize:12}}>پیام صوتی {item.voiceDurationSeconds?`• ${item.voiceDurationSeconds.toLocaleString('fa-IR')} ثانیه`:''}</span></div><VoicePlayer id={item.id}/></div>:kind==='file'?<div><Button type="text" onClick={()=>downloadFile(item)} style={{color:item.isMe?'white':'#8b1a6b',height:'auto',padding:0}} icon={<FileOutlined/>}><span style={{maxWidth:280,display:'inline-block',overflow:'hidden',textOverflow:'ellipsis'}}>{item.attachmentName}</span></Button><div style={{fontSize:10,opacity:.75}}>{bytesLabel(item.attachmentSize)} <DownloadOutlined/></div>{item.content&&<div style={{marginTop:7}}>{item.content}</div>}</div>:item.content}
          </div><div style={{fontSize:10,color:'#999',marginTop:3}}>{faTime(item.createdAt)} {item.isMe&&(item.isRead?'✓✓':'✓')}</div></div></div>})}<div ref={endRef}/></div>
        {selectedFile&&<div style={{padding:'7px 14px',background:'#fff7fb',borderTop:'1px solid #f1d8e8',display:'flex',gap:8,alignItems:'center'}}><FileOutlined style={{color:'#8b1a6b'}}/><b style={{fontSize:12}}>{selectedFile.name}</b><span style={{fontSize:11,color:'#888'}}>{bytesLabel(selectedFile.size)}</span><Button size="small" type="text" icon={<CloseOutlined/>} onClick={()=>setSelectedFile(undefined)} style={{marginRight:'auto'}}/></div>}
        <div style={{padding:14,borderTop:'1px solid #eee',display:'flex',gap:8,alignItems:'flex-end'}}>
          <input ref={fileInputRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx" onChange={e=>{chooseFile(e.target.files?.[0]);e.currentTarget.value=''}}/>
          <Tooltip title="پیوست فایل تا ۲۰۰KB"><Button icon={<PaperClipOutlined/>} onClick={()=>fileInputRef.current?.click()} disabled={recording||sending}/></Tooltip>
          <Tooltip title={recording?'توقف و ارسال ویس':'ضبط پیام صوتی تا ۶۰ ثانیه'}><Button danger={recording} type={recording?'primary':'default'} icon={recording?<StopOutlined/>:<AudioOutlined/>} onClick={recording?stopRecording:startRecording} disabled={sending}>{recording?`${recordSeconds.toLocaleString('fa-IR')} ثانیه`:''}</Button></Tooltip>
          <Popover content={emojiPicker} title="انتخاب ایموجی" trigger="click" open={emojiOpen} onOpenChange={setEmojiOpen} placement="top"><Tooltip title="ایموجی"><Button icon={<SmileOutlined/>} disabled={recording||sending}/></Tooltip></Popover>
          <Input.TextArea autoSize={{minRows:1,maxRows:4}} value={text} maxLength={2000} showCount disabled={recording} onChange={e=>setText(e.target.value)} onPressEnter={e=>{if(!e.shiftKey){e.preventDefault();send()}}} placeholder={recording?'در حال ضبط پیام صوتی...':`پیام به ${selected.fullName}...`}/>
          <Button type="primary" loading={sending} icon={<SendOutlined/>} onClick={send} disabled={recording||(!text.trim()&&!selectedFile)} style={{background:'#8b1a6b'}}>ارسال</Button>
        </div>
      </>}
    </Card>
  </div>
}
