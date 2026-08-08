import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, Divider, Empty, Form, Input, message, Modal, Popover, Select, Space, Spin, Tag, Tooltip } from 'antd'
import { AudioOutlined, CloseOutlined, DownloadOutlined, FileOutlined, PaperClipOutlined, PlusOutlined, SearchOutlined, SendOutlined, SmileOutlined, StopOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { apiFetch } from '../utils/api'

const API='http://localhost:5043/api/v1'
const MAX_FILE_SIZE=200*1024
const codePattern=/<[^>]*>|javascript\s*:|--|\/\*|\*\/|;\s*(select|insert|update|delete|drop|alter|exec)|\bunion\s+select/i
const allowedExtensions=['pdf','png','jpg','jpeg','txt','docx','xlsx']
const CHAT_EMOJIS=[...new Set(['👍','😂','😭','👏','🤞','🙏','🙂','🥰','😳','🙌','🙃','😊','🥳','🤪','💀','😱','🎉','😎','😴','✌️','😁','👌','🤭','😐','🤷','😋','💰','🥴','🥺','😢','🙋','💩','😜','🤗','💯','🤢','😉','🌹','🤫','🤐','🤥','🎂','🎈','😵‍💫','🤒','😷','🤔','😡','🤬','🤧','🤕','🥱','🤮','🤯','🥵','🥶','🤠','🧐','👻','🙈','🙉','🙊','🫰🏻','☝🏻','🤝🏼','🤦🏻‍♀️','🧑‍💻','🏃'])]
interface ChatUser { id:string; personId:string; personType:'user'|'contact'; fullName:string; position?:string; department?:string; avatarUrl?:string; isOnline:boolean; lastMessage?:string; lastMessageAt?:string; unread:number }
interface ChatMessage { id:string; senderUserId:string; recipientUserId:string; content:string; kind:'Text'|'File'|'Voice'|string; attachmentName?:string; attachmentContentType?:string; attachmentSize?:number; voiceDurationSeconds?:number; hasAttachment?:boolean; isRead:boolean; createdAt:string; isMe:boolean }
interface ChatGroupMember { userId:string; fullName:string; position?:string; isAdmin:boolean }
interface ChatGroup { groupId:string; name:string; ownerUserId:string; isAdmin:boolean; memberCount:number; lastMessage?:string; lastMessageAt?:string; unread:number; members:ChatGroupMember[] }
interface GroupMessage { id:string; groupId:string; senderUserId:string; senderName:string; content:string; createdAt:string; isMe:boolean }

const bytesLabel=(size?:number)=>size?`${Math.ceil(size/1024).toLocaleString('fa-IR')} KB`:''
const fileToBase64=(file:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('read'));reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.readAsDataURL(file)})
const emojiToken=/((?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu
const emojiOnly=/^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\uFE0F|\p{Emoji_Modifier})?)*$/u
const emojiMotion=(emoji:string)=>/[😂🤣😁😄😆😊]/u.test(emoji)?'chat-emoji--laugh':/[😭😢🥺]/u.test(emoji)?'chat-emoji--cry':'chat-emoji--bounce'
const chatText=(value:string)=>value.split(emojiToken).map((part,index)=>emojiOnly.test(part)?<span key={`${part}-${index}`} className={`chat-emoji ${emojiMotion(part)}`}>{part}</span>:part)
const sameMessages=<T extends {id:string}>(current:T[],next:T[],extra?:(a:T,b:T)=>boolean)=>current.length===next.length&&current.every((item,index)=>item.id===next[index]?.id&&(!extra||extra(item,next[index])))

function VoicePlayer({id}:{id:string}){
  const [src,setSrc]=useState(''),[failed,setFailed]=useState(false)
  useEffect(()=>{let url='';let cancelled=false;apiFetch(`${API}/chat/messages/${id}/attachment`).then(async r=>{if(!r.ok)throw new Error();url=URL.createObjectURL(await r.blob());if(!cancelled)setSrc(url)}).catch(()=>!cancelled&&setFailed(true));return()=>{cancelled=true;if(url)URL.revokeObjectURL(url)}},[id])
  if(failed)return <span style={{fontSize:12}}>فایل صوتی دریافت نشد</span>
  if(!src)return <Spin size="small"/>
  return <audio controls preload="metadata" src={src} style={{width:260,maxWidth:'100%',height:36}}/>
}

function GroupConversation({group,users,onChanged,canAddMember,canRemoveMember}:{group:ChatGroup;users:ChatUser[];onChanged:()=>Promise<void>|void;canAddMember:boolean;canRemoveMember:boolean}){
  const [items,setItems]=useState<GroupMessage[]>([]),[text,setText]=useState(''),[sending,setSending]=useState(false)
  const [newMemberIds,setNewMemberIds]=useState<string[]>([]),[addingMembers,setAddingMembers]=useState(false)
  const [membersOpen,setMembersOpen]=useState(false),[removingMemberId,setRemovingMemberId]=useState<string>()
  const [emojiOpen,setEmojiOpen]=useState(false)
  const end=useRef<HTMLDivElement>(null)
  const sendLockRef=useRef(false)
  const load=async(silent=false)=>{const response=await apiFetch(`${API}/chat/groups/${group.groupId}/messages`);if(!response.ok){if(!silent)message.error('پیام‌های گروه دریافت نشد');return}const data:GroupMessage[]=await response.json();setItems(current=>sameMessages(current,data)?current:data)}
  useEffect(()=>{load();const timer=window.setInterval(()=>load(true),10000);return()=>window.clearInterval(timer)},[group.groupId])
  useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'})},[items])
  const send=async()=>{const content=text.trim();if(!content||sending||sendLockRef.current)return;if(content.length>2000||codePattern.test(content)){message.error('متن پیام معتبر نیست');return}sendLockRef.current=true;setSending(true);try{const response=await apiFetch(`${API}/chat/groups/${group.groupId}/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content})});const result=await response.json().catch(()=>({}));if(!response.ok){message.error(result.message||'ارسال پیام گروه انجام نشد');return}setItems(current=>current.some(item=>item.id===result.id)?current:[...current,result]);setText('');onChanged()}finally{sendLockRef.current=false;setSending(false)}}
  const addMembers=async()=>{if(!newMemberIds.length)return;setAddingMembers(true);const response=await apiFetch(`${API}/chat/groups/${group.groupId}/members`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberUserIds:newMemberIds})});const result=await response.json().catch(()=>({}));setAddingMembers(false);if(!response.ok){message.error(result.message||'افزودن عضو انجام نشد');return}message.success(result.message);setNewMemberIds([]);await onChanged()}
  const removeMember=async(member:ChatGroupMember)=>{if(member.userId===group.ownerUserId||removingMemberId)return;setRemovingMemberId(member.userId);try{const response=await apiFetch(`${API}/chat/groups/${group.groupId}/members/${member.userId}`,{method:'DELETE'});const result=await response.json().catch(()=>({}));if(!response.ok){message.error(result.message||'حذف عضو انجام نشد');return}message.success(result.message||'عضو از گروه حذف شد');await onChanged()}finally{setRemovingMemberId(undefined)}}
  const addEmoji=(emoji:string)=>{setText(current=>`${current}${emoji}`.slice(0,2000));setEmojiOpen(false)}
  const emojiPicker=<div style={{width:340,maxWidth:'calc(100vw - 64px)',maxHeight:240,overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(10,minmax(28px,1fr))',gap:3,direction:'ltr',padding:'2px 4px 2px 0'}}>{CHAT_EMOJIS.map(emoji=><Button key={emoji} type="text" onClick={()=>addEmoji(emoji)} aria-label={`ایموجی ${emoji}`} style={{fontSize:25,padding:0,height:36,minWidth:0,lineHeight:'36px',borderRadius:7}}>{emoji}</Button>)}</div>
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <div style={{padding:'12px 18px',borderBottom:'1px solid #eee',display:'flex',alignItems:'center',gap:10}}>
      <Avatar icon={<TeamOutlined/>} style={{background:'#722ed1'}}/>
      <Button type="text" onClick={()=>setMembersOpen(true)} style={{height:'auto',padding:'2px 4px',textAlign:'right'}}><b>{group.name}</b><div style={{fontSize:11,color:'#888'}}>{group.memberCount.toLocaleString('fa-IR')} عضو</div></Button>
    </div>
    <div style={{flex:1,minHeight:0,overflowY:'auto',padding:20,background:'linear-gradient(145deg,#fafafa,#f7f0f5)'}}>{items.length===0?<Empty description="هنوز پیامی در گروه ثبت نشده"/>:items.map(item=><div key={item.id} style={{display:'flex',justifyContent:item.isMe?'flex-start':'flex-end',marginBottom:12}}><div style={{maxWidth:'72%'}}><div style={{fontSize:10,color:'#8b1a6b',marginBottom:2,textAlign:'right'}}>{item.senderName}</div><div style={{background:item.isMe?'#8b1a6b':'#fff',color:item.isMe?'#fff':'#333',padding:'9px 14px',borderRadius:item.isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',boxShadow:'0 2px 8px #0000000c',whiteSpace:'pre-wrap',overflowWrap:'anywhere',direction:'rtl',textAlign:'right'}}>{chatText(item.content)}</div><div style={{fontSize:10,color:'#999',marginTop:3,textAlign:'right'}}>{new Date(item.createdAt).toLocaleString('fa-IR')}</div></div></div>)}<div ref={end}/></div>
    <div style={{padding:'10px 14px',borderTop:'1px solid #eee',display:'flex',gap:8,alignItems:'center'}}><Popover content={emojiPicker} title="انتخاب ایموجی" trigger="click" open={emojiOpen} onOpenChange={setEmojiOpen} placement="top"><Tooltip title="ایموجی"><Button icon={<SmileOutlined/>} disabled={sending}/></Tooltip></Popover><Input.TextArea style={{direction:'rtl',textAlign:'right'}} value={text} maxLength={2000} autoSize={{minRows:1,maxRows:4}} onChange={e=>setText(e.target.value)} onPressEnter={e=>{if(!e.shiftKey){e.preventDefault();send()}}} placeholder={`پیام در گروه ${group.name}...`}/><Button type="primary" icon={<SendOutlined/>} loading={sending} disabled={!text.trim()} onClick={send} style={{background:'#8b1a6b'}}>ارسال</Button></div>
    <Modal open={membersOpen} onCancel={()=>setMembersOpen(false)} footer={null} centered width={520} title={<Space><TeamOutlined/><span>اعضای {group.name}</span><Tag>{group.memberCount.toLocaleString('fa-IR')} عضو</Tag></Space>}>
      <div style={{maxHeight:330,overflowY:'auto',display:'grid',gap:8,marginBottom:group.isAdmin&&canAddMember?16:0}}>{group.members.map(member=><div key={member.userId} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',border:'1px solid #f0e8ee',borderRadius:10}}><Avatar size={32} icon={<UserOutlined/>}/><div style={{flex:1,minWidth:0}}><b>{member.fullName}</b><div style={{fontSize:11,color:'#888'}}>{member.position||'همکار'}{member.isAdmin?' • مدیر گروه':''}</div></div>{group.isAdmin&&canRemoveMember&&member.userId!==group.ownerUserId&&<Tooltip title="حذف از گروه"><Button type="text" danger icon={<CloseOutlined/>} loading={removingMemberId===member.userId} disabled={Boolean(removingMemberId)} onClick={()=>removeMember(member)} aria-label={`حذف ${member.fullName} از گروه`}/></Tooltip>}</div>)}</div>
      {group.isAdmin&&canAddMember&&<div style={{display:'flex',gap:8,paddingTop:14,borderTop:'1px solid #f0f0f0'}}><Select mode="multiple" value={newMemberIds} onChange={setNewMemberIds} showSearch optionFilterProp="label" maxTagCount="responsive" style={{flex:1}} placeholder="افزودن همکار جدید به گروه" options={users.filter(user=>user.personType==='user'&&!group.members.some(member=>member.userId===user.personId)).map(user=>({value:user.personId,label:user.fullName}))}/><Button icon={<PlusOutlined/>} loading={addingMembers} disabled={!newMemberIds.length} onClick={addMembers}>افزودن</Button></div>}
    </Modal>
  </div>
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
  const [groups,setGroups]=useState<ChatGroup[]>([])
  const [activeGroup,setActiveGroup]=useState<ChatGroup>()
  const [createGroupOpen,setCreateGroupOpen]=useState(false)
  const [creatingGroup,setCreatingGroup]=useState(false)
  const [groupForm]=Form.useForm()
  const endRef=useRef<HTMLDivElement>(null)
  const fileInputRef=useRef<HTMLInputElement>(null)
  const recorderRef=useRef<MediaRecorder|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const chunksRef=useRef<Blob[]>([])
  const recordTimerRef=useRef<number|null>(null)
  const recordSecondsRef=useRef(0)
  const draftsRef=useRef<Record<string,string>>({})
  const sendLockRef=useRef(false)
  const currentUser=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})()
  const grantedPermissions:string[]=(()=>{try{return JSON.parse(localStorage.getItem('permissions')||'[]')}catch{return []}})()
  const isAdmin=Array.isArray(currentUser.roles)&&currentUser.roles.includes('Admin')
  const allowed=(code:string)=>isAdmin||grantedPermissions.includes(code)
  const selected=users.find(x=>x.id===selectedId)

  const loadUsers=async(silent=false)=>{
    const response=await apiFetch(`${API}/chat/users`)
    if(!response.ok){if(!silent)message.error('دریافت کارتابل پیام‌ها انجام نشد');setLoading(false);return}
    const data:ChatUser[]=await response.json();setUsers(current=>sameMessages(current,data,(a,b)=>a.unread===b.unread&&a.isOnline===b.isOnline&&a.lastMessage===b.lastMessage&&a.lastMessageAt===b.lastMessageAt)?current:data)
    const params=new URLSearchParams(location.search),fromUrl=params.get('user')||undefined,groupFromUrl=params.get('group')
    if(!groupFromUrl)setSelectedId(current=>current||(fromUrl&&data.some(x=>x.id===fromUrl)?fromUrl:data[0]?.id));setLoading(false)
  }
  const loadGroups=async()=>{const response=await apiFetch(`${API}/chat/groups`);if(!response.ok)return;const data:ChatGroup[]=await response.json();setGroups(current=>sameMessages(current.map(x=>({...x,id:x.groupId})),data.map(x=>({...x,id:x.groupId})),(a,b)=>a.unread===b.unread&&a.lastMessage===b.lastMessage&&a.lastMessageAt===b.lastMessageAt&&a.memberCount===b.memberCount)?current:data);const fromUrl=new URLSearchParams(location.search).get('group');if(fromUrl){const found=data.find(x=>x.groupId===fromUrl);if(found)setActiveGroup(current=>current?.groupId===found.groupId&&current.unread===found.unread&&current.lastMessage===found.lastMessage&&current.memberCount===found.memberCount?current:found)}}
  const loadMessages=async(userId:string,silent=false)=>{
    const response=await apiFetch(`${API}/chat/messages/${userId}`)
    if(!response.ok){if(!silent)message.error('دریافت پیام‌ها انجام نشد');return}
    const data:ChatMessage[]=await response.json();setMessages(current=>sameMessages(current,data,(a,b)=>a.isRead===b.isRead)?current:data);setUsers(prev=>{let changed=false;const next=prev.map(x=>{if(x.id===userId&&x.unread){changed=true;return{...x,unread:0}}return x});return changed?next:prev})
  }
  useEffect(()=>{loadUsers();loadGroups();const timer=setInterval(()=>{loadUsers(true);loadGroups()},10000);return()=>clearInterval(timer)},[])
  useEffect(()=>{if(!selectedId)return;loadMessages(selectedId);const timer=setInterval(()=>loadMessages(selectedId,true),6000);return()=>clearInterval(timer)},[selectedId])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages])
  useEffect(()=>()=>stopRecordingResources(),[])

  const postMessage=async(payload:Record<string,unknown>)=>{
    if(!selectedId||sending||sendLockRef.current)return false
    sendLockRef.current=true;setSending(true)
    try{
      const response=await apiFetch(`${API}/chat/messages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        // Keep both contracts: ASP.NET expects recipientUserId while the
        // Supabase Edge Function expects recipientId + recipientType.
        recipientUserId:selected?.personId,
        recipientId:selected?.personId,
        recipientType:selected?.personType,
        ...payload,
      })})
      const result=await response.json().catch(()=>({}))
      if(!response.ok){message.error(result.message||'ارسال پیام انجام نشد');return false}
      setMessages(prev=>prev.some(item=>item.id===result.id)?prev:[...prev,result]);
      const last=result.kind==='Voice'?'🎤 پیام صوتی':result.kind==='File'?`📎 ${result.attachmentName}`:result.content
      setUsers(prev=>prev.map(x=>x.id===selectedId?{...x,lastMessage:last,lastMessageAt:result.createdAt}:x));return true
    }catch{
      message.error('ارتباط با سرور برای ارسال فایل برقرار نشد')
      return false
    }finally{sendLockRef.current=false;setSending(false)}
  }
  const send=async()=>{
    const content=text.trim();if(!selectedId||(!content&&!selectedFile))return
    if(content.length>2000||codePattern.test(content)){message.error('متن پیام معتبر نیست؛ ورود کد مجاز نیست');return}
    if(selectedFile){
      if(selectedFile.size>MAX_FILE_SIZE){message.error('حداکثر حجم فایل ۲۰۰ کیلوبایت است');return}
      const attachmentData=await fileToBase64(selectedFile).catch(()=>null);if(!attachmentData){message.error('خواندن فایل انجام نشد');return}
      if(await postMessage({content,kind:'file',attachmentName:selectedFile.name,attachmentData,attachmentContentType:selectedFile.type||'application/octet-stream',attachmentSize:selectedFile.size})){if(selectedId)draftsRef.current[selectedId]='';setText('');setSelectedFile(undefined)}
    }else if(await postMessage({content,kind:'text'})){if(selectedId)draftsRef.current[selectedId]='';setText('')}
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
  const choose=(id:string)=>{if(id===selectedId&&!activeGroup)return;if(recording)stopRecording();if(selectedId)draftsRef.current[selectedId]=text;setText(draftsRef.current[id]||'');setEmojiOpen(false);setSelectedFile(undefined);setActiveGroup(undefined);setSelectedId(id);history.replaceState(null,'',`/chat?user=${id}`)}
  const chooseGroup=(group:ChatGroup)=>{if(activeGroup?.groupId===group.groupId)return;if(recording)stopRecording();if(selectedId)draftsRef.current[selectedId]=text;setText('');setEmojiOpen(false);setSelectedFile(undefined);setActiveGroup(group);history.replaceState(null,'',`/chat?group=${group.groupId}`)}
  const faTime=(value?:string)=>value?new Date(value).toLocaleString('fa-IR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''
  const addEmoji=(emoji:string)=>{setText(current=>`${current}${emoji}`.slice(0,2000));setEmojiOpen(false)}
  const emojiPicker=<div style={{width:340,maxWidth:'calc(100vw - 64px)',maxHeight:240,overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(10,minmax(28px,1fr))',gap:3,direction:'ltr',padding:'2px 4px 2px 0'}}>{CHAT_EMOJIS.map(emoji=><Button key={emoji} type="text" onClick={()=>addEmoji(emoji)} aria-label={`ایموجی ${emoji}`} style={{fontSize:25,padding:0,height:36,minWidth:0,lineHeight:'36px',borderRadius:7}}>{emoji}</Button>)}</div>
  const createGroup=async()=>{const values=await groupForm.validateFields();setCreatingGroup(true);const response=await apiFetch(`${API}/chat/groups`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:values.name,memberUserIds:values.memberUserIds})});const result=await response.json().catch(()=>({}));setCreatingGroup(false);if(!response.ok){message.error(result.message||'ایجاد گروه انجام نشد');return}message.success(result.message);setCreateGroupOpen(false);groupForm.resetFields();await loadGroups()}

  if(loading)return <Card style={{minHeight:420,borderRadius:14}} styles={{body:{minHeight:420,display:'grid',placeItems:'center'}}}><Space direction="vertical" align="center" size={14}><Spin size="large"/><b>در حال دریافت گفتگوها...</b><span style={{color:'#888',fontSize:12}}>اولین بارگذاری ممکن است چند ثانیه زمان ببرد.</span></Space></Card>
  return <div style={{height:'calc(100vh - 125px)',display:'flex',gap:14,minHeight:520}}>
    <Card title={<Space>💬 <span>ایجاد گروه</span><Badge count={users.reduce((s,x)=>s+x.unread,0)+groups.reduce((s,x)=>s+x.unread,0)}/></Space>} extra={allowed('chat.create_group')?<Tooltip title="ایجاد گروه"><Button size="small" type="primary" icon={<PlusOutlined/>} onClick={()=>setCreateGroupOpen(true)} style={{background:'#8b1a6b'}}/></Tooltip>:null} style={{width:280,flexShrink:0,borderRadius:14,overflow:'hidden'}} styles={{body:{padding:0,height:'calc(100% - 58px)',display:'flex',flexDirection:'column'}}}>
      <div style={{padding:'8px 10px',borderBottom:'1px solid #f0f0f0'}}><Input size="small" allowClear prefix={<SearchOutlined/>} value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجوی همکار..."/></div>
      <div style={{overflowY:'auto',flex:1}}>{groups.length>0&&<><Divider titlePlacement="right" plain style={{fontSize:10,margin:'5px 0'}}>گروه‌ها</Divider>{groups.filter(group=>group.name.includes(search.trim())).map(group=><div key={group.groupId} onClick={()=>chooseGroup(group)} style={{padding:'5px 12px',cursor:'pointer',borderBottom:'1px solid #f5f5f5',background:activeGroup?.groupId===group.groupId?'#f1e7ff':'#fffafc',borderRight:activeGroup?.groupId===group.groupId?'4px solid #722ed1':'4px solid transparent'}}><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar size={30} icon={<TeamOutlined/>} style={{background:'#722ed1'}}/><div style={{flex:1,minWidth:0}}><b style={{fontSize:12}}>{group.name}</b><div style={{fontSize:9,color:'#888',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{group.memberCount.toLocaleString('fa-IR')} عضو • {group.lastMessage||'بدون پیام'}</div></div>{group.unread>0&&<Badge count={group.unread} style={{background:'#722ed1'}}/>}</div></div>)}</>}{groups.length>0&&<Divider titlePlacement="right" plain style={{fontSize:10,margin:'5px 0'}}>گفتگوهای مستقیم</Divider>}{filtered.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="کاربری یافت نشد"/>:filtered.map(user=><div key={user.id} onClick={()=>choose(user.id)} style={{padding:'4px 12px',cursor:'pointer',borderBottom:'1px solid #f5f5f5',background:!activeGroup&&selectedId===user.id?'#f7eaf3':'#fff',borderRight:!activeGroup&&selectedId===user.id?'4px solid #8b1a6b':'4px solid transparent'}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}><Badge dot color={user.isOnline?'#52c41a':'#bfbfbf'} offset={[-3,26]}><Avatar size={30} src={user.avatarUrl} icon={<UserOutlined/>} style={{background:'#8b1a6b'}}/></Badge>
          <div style={{flex:1,minWidth:0}}><div style={{display:'flex',justifyContent:'space-between'}}><b style={{fontSize:13}}>{user.fullName}</b><small style={{color:'#999'}}>{faTime(user.lastMessageAt)}</small></div>
            <div style={{fontSize:10,color:'#888',lineHeight:1.25}}>{user.position||user.department||(user.personType==='contact'?'مخاطب خارجی':'کاربر داخلی')}</div><div style={{display:'flex',justifyContent:'space-between',marginTop:1}}><span style={{fontSize:10,color:'#777',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:155}}>{user.lastMessage||'هنوز پیامی ردوبدل نشده'}</span>{user.unread>0&&<Badge count={user.unread} style={{background:'#8b1a6b'}}/>}</div></div>
        </div></div>)}</div>
    </Card>
    <Card style={{flex:1,borderRadius:14,overflow:'hidden'}} styles={{body:{height:'100%',padding:0,display:'flex',flexDirection:'column'}}}>
      {activeGroup?<GroupConversation group={activeGroup} users={users} onChanged={loadGroups} canAddMember={allowed('chat.add_member')} canRemoveMember={allowed('chat.remove_member')}/>:!selected?<Empty style={{margin:'auto'}} description="یک همکار یا گروه را انتخاب کنید"/>:<>
        <div style={{padding:'12px 18px',borderBottom:'1px solid #eee',display:'flex',alignItems:'center',gap:10}}><Badge dot={selected.personType==='user'} color={selected.isOnline?'#52c41a':'#bfbfbf'}><Avatar src={selected.avatarUrl} icon={<UserOutlined/>}/></Badge><div><b>{selected.fullName}</b><div style={{fontSize:11,color:'#888'}}>{selected.position||selected.department}</div></div><Tag color={selected.personType==='contact'?'purple':selected.isOnline?'green':'default'} style={{marginRight:'auto'}}>{selected.personType==='contact'?'مخاطب':selected.isOnline?'آنلاین':'آفلاین'}</Tag></div>
        <div style={{flex:1,overflowY:'auto',padding:20,background:'linear-gradient(145deg,#fafafa,#f7f0f5)'}}>{messages.length===0?<Empty description="هنوز پیامی ندارید"/>:messages.map(item=>{const kind=String(item.kind||'Text').toLowerCase();return <div key={item.id} style={{display:'flex',justifyContent:item.isMe?'flex-start':'flex-end',marginBottom:12}}><div style={{maxWidth:'72%'}}><div style={{background:item.isMe?'#8b1a6b':'white',color:item.isMe?'white':'#333',padding:'9px 14px',borderRadius:item.isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',boxShadow:'0 2px 8px #0000000c',whiteSpace:'pre-wrap',overflowWrap:'anywhere',direction:'rtl',textAlign:'right'}}>
          {kind==='voice'?<div><div style={{display:'flex',gap:6,alignItems:'center',marginBottom:5}}><AudioOutlined/><span style={{fontSize:12}}>پیام صوتی {item.voiceDurationSeconds?`• ${item.voiceDurationSeconds.toLocaleString('fa-IR')} ثانیه`:''}</span></div><VoicePlayer id={item.id}/></div>:kind==='file'?<div><Button type="text" onClick={()=>downloadFile(item)} style={{color:item.isMe?'white':'#8b1a6b',height:'auto',padding:0}} icon={<FileOutlined/>}><span style={{maxWidth:280,display:'inline-block',overflow:'hidden',textOverflow:'ellipsis'}}>{item.attachmentName}</span></Button><div style={{fontSize:10,opacity:.75}}>{bytesLabel(item.attachmentSize)} <DownloadOutlined/></div>{item.content&&<div style={{marginTop:7,lineHeight:1.8}}>{chatText(item.content)}</div>}</div>:<span style={{lineHeight:1.8}}>{chatText(item.content)}</span>}
          </div><div style={{fontSize:10,color:'#999',marginTop:3}}>{faTime(item.createdAt)} {item.isMe&&(item.isRead?'✓✓':'✓')}</div></div></div>})}<div ref={endRef}/></div>
        {selectedFile&&<div style={{padding:'7px 14px',background:'#fff7fb',borderTop:'1px solid #f1d8e8',display:'flex',gap:8,alignItems:'center'}}><FileOutlined style={{color:'#8b1a6b'}}/><b style={{fontSize:12}}>{selectedFile.name}</b><span style={{fontSize:11,color:'#888'}}>{bytesLabel(selectedFile.size)}</span><Button size="small" type="text" icon={<CloseOutlined/>} onClick={()=>setSelectedFile(undefined)} style={{marginRight:'auto'}}/></div>}
        <div style={{padding:'10px 14px',borderTop:'1px solid #eee',display:'flex',gap:8,alignItems:'center'}}>
          <input ref={fileInputRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx" onChange={e=>{chooseFile(e.target.files?.[0]);e.currentTarget.value=''}}/>
          <Tooltip title="پیوست فایل تا ۲۰۰KB"><Button icon={<PaperClipOutlined/>} onClick={()=>fileInputRef.current?.click()} disabled={recording||sending}/></Tooltip>
          <Tooltip title={recording?'توقف و ارسال ویس':'ضبط پیام صوتی تا ۶۰ ثانیه'}><Button danger={recording} type={recording?'primary':'default'} icon={recording?<StopOutlined/>:<AudioOutlined/>} onClick={recording?stopRecording:startRecording} disabled={sending}>{recording?`${recordSeconds.toLocaleString('fa-IR')} ثانیه`:''}</Button></Tooltip>
          <Popover content={emojiPicker} title="انتخاب ایموجی" trigger="click" open={emojiOpen} onOpenChange={setEmojiOpen} placement="top" overlayStyle={{maxWidth:'calc(100vw - 24px)'}}><Tooltip title="ایموجی"><Button icon={<SmileOutlined/>} disabled={recording||sending}/></Tooltip></Popover>
          <div style={{position:'relative',flex:1,minWidth:0}}>
            <Input.TextArea style={{fontSize:14,paddingBottom:20,direction:'rtl',textAlign:'right'}} autoSize={{minRows:1,maxRows:4}} value={text} maxLength={2000} disabled={recording} onChange={e=>{const value=e.target.value;setText(value);if(selectedId)draftsRef.current[selectedId]=value}} onPressEnter={e=>{if(!e.shiftKey){e.preventDefault();send()}}} placeholder={recording?'در حال ضبط پیام صوتی...':`پیام به ${selected.fullName}...`}/>
            <span style={{position:'absolute',left:9,bottom:3,fontSize:10,color:text.length>1900?'#f5222d':'#aaa',direction:'ltr',pointerEvents:'none'}}>{text.length.toLocaleString('fa-IR')} / ۲۰۰۰</span>
          </div>
          <Button type="primary" loading={sending} icon={<SendOutlined/>} onClick={send} disabled={recording||(!text.trim()&&!selectedFile)} style={{background:'#8b1a6b'}}>ارسال</Button>
        </div>
      </>}
    </Card>
    <Modal open={createGroupOpen} title={<Space><TeamOutlined/><span>ایجاد گروه جدید</span></Space>} onCancel={()=>{setCreateGroupOpen(false);groupForm.resetFields()}} onOk={createGroup} confirmLoading={creatingGroup} okText="ایجاد گروه" cancelText="انصراف" centered maskClosable={false}>
      <Form form={groupForm} layout="vertical"><Form.Item name="name" label="نام گروه" rules={[{required:true,message:'نام گروه را وارد کنید'},{min:3,max:60},{pattern:/^[\p{L}\p{M}\p{N}\s\u200c_-]+$/u,message:'نام گروه فقط شامل حروف، عدد، فاصله، خط تیره یا زیرخط باشد'}]}><Input maxLength={60} showCount placeholder="مثلاً تیم پروژه پارس"/></Form.Item><Form.Item name="memberUserIds" label="اعضای گروه" rules={[{required:true,message:'حداقل یک عضو انتخاب کنید'}]}><Select mode="multiple" showSearch optionFilterProp="label" maxTagCount="responsive" placeholder="همکاران را انتخاب کنید" options={users.filter(x=>x.personType==='user').map(x=>({value:x.personId,label:`${x.fullName}${x.position?' — '+x.position:''}`}))}/></Form.Item></Form>
    </Modal>
  </div>
}
