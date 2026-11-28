import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApartmentOutlined, AimOutlined, ArrowsAltOutlined, MinusOutlined, PlusOutlined, ReloadOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Avatar, Button, Descriptions, Drawer, Empty, Form, Input, List, Modal, Segmented, Select, Space, Spin, Switch, Tag, message } from 'antd'
import { useLocation } from 'react-router-dom'
import { ancestors, buildGraph, chartLayout, fitChart, nodeHeight, nodeWidth, orgKey, orgRequest, searchKey } from './org-chart-model'
import type { ChartData, Department, GraphNode, Person, Position } from './org-chart-model'
import './org-chart.css'

type Mode='people'|'departments'
type Editor={kind:'people'|'departments'|'positions';id?:string}
type Change={id:string;actor_id?:string;before_data?:Record<string,unknown>;after_data:Record<string,unknown>;changed_at:string}
type Values={name?:string;title?:string;manager?:string;department?:string;position?:string;parent_id?:string;lead_id?:string;active?:boolean}
const errorText=(e:unknown)=>e instanceof Error?e.message:'عملیات انجام نشد.'
const option=(value:string,label:string)=>({value,label})
const fa=(n:number)=>n.toLocaleString('fa-IR')
const selectProps={allowClear:true,showSearch:true,optionFilterProp:'label'}
const status=(active:boolean)=><Tag color={active?'green':'default'}>{active?'فعال':'غیرفعال'}</Tag>
const initial={x:24,y:28,k:1}

export default function OrgChartPage(){
  const location=useLocation()
  const [mode,setMode]=useState<Mode>(()=>new URLSearchParams(location.search).get('org')==='departments'?'departments':'people')
  const [data,setData]=useState<ChartData>(),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [selected,setSelected]=useState<string>(),[expanded,setExpanded]=useState(new Set<string>())
  const [focused,setFocused]=useState<string>()
  const [view,setView]=useState(initial),[height,setHeight]=useState(440),[moving,setMoving]=useState(false)
  const [editor,setEditor]=useState<Editor>(),[saving,setSaving]=useState(false),[editorError,setEditorError]=useState('')
  const [catalog,setCatalog]=useState(()=>new URLSearchParams(location.search).get('org')==='positions')
  const [history,setHistory]=useState<Change[]>(),[historyError,setHistoryError]=useState('')
  const [form]=Form.useForm<Values>(),[dialog,confirmLayer]=Modal.useModal()
  const viewport=useRef<HTMLDivElement>(null)
  const fitted=useRef<Mode>(undefined)
  const requestVersion=useRef(0)
  const drag=useRef<{id:number;x:number;y:number;start:typeof initial}>(null)
  const reload=useCallback(async(signal?:AbortSignal)=>{
    const version=++requestVersion.current
    setLoading(true);setError('')
    const current=()=>!signal?.aborted&&version===requestVersion.current
    try{const result=await orgRequest<ChartData>('/organization/chart','GET',undefined,signal);if(current())setData(result)}
    catch(e){if(current())setError(errorText(e))}
    finally{if(current())setLoading(false)}
  },[])
  useEffect(()=>{
    const controller=new AbortController()
    void reload(controller.signal)
    const refresh=(event:Event)=>{
      const input=(event as CustomEvent).detail?.input
      if(typeof input==='string'&&/\/(?:users|positions|organization\/departments)(?:\/|$)/.test(input)&&!viewport.current?.dataset.saving)void reload()
    }
    window.addEventListener('portal:data-changed',refresh)
    let channel:BroadcastChannel|undefined
    try{channel=new BroadcastChannel('portal-data-updates');channel.onmessage=e=>refresh(new CustomEvent('portal:data-changed',{detail:e.data}))}catch{}
    return()=>{controller.abort();channel?.close();window.removeEventListener('portal:data-changed',refresh)}
  },[reload])
  useEffect(()=>{
    const target=new URLSearchParams(location.search).get('org')
    if(target==='departments'){setMode('departments');setSelected(undefined);setExpanded(new Set())}
    if(target==='positions')setCatalog(true)
  },[location.search])
  const people=data?.people,departments=data?.departments
  const nodes=useMemo<GraphNode[]>(()=>mode==='people'?(people??[]).map(p=>({id:p.id,parent:p.managerId,name:p.name,caption:[p.position,p.department].filter(Boolean).join(' · '),active:p.active,avatar:p.avatar})):
    (departments??[]).map(d=>({id:d.id,parent:d.parent_id,name:d.name,caption:people?.find(p=>p.id===d.lead_id)?.name,active:d.active})),[mode,people,departments])
  const graph=useMemo(()=>buildGraph(nodes),[nodes])
  const layout=useMemo(()=>chartLayout(graph,expanded),[graph,expanded])
  const selectedPerson=mode==='people'?people?.find(p=>p.id===selected):undefined
  const selectedUnit=mode==='departments'?departments?.find(d=>d.id===selected):undefined
  const managerOptions=(people??[]).filter(p=>p.active).map(p=>option(p.id,[p.name,p.position].filter(Boolean).join(' · ')))
  const reference=(id?:string|null)=>people?.find(p=>p.id===id)?.name??'—'
  const unit=(id?:string|null)=>departments?.find(d=>d.id===id)?.name??'—'
  const canEdit=mode==='people'?data?.access.employee:data?.access.edit

  function fit(next=layout){
    const element=viewport.current
    if(!element)return
    setView(fitChart(element.clientWidth,element.clientHeight,next.width,next.height))
  }
  useEffect(()=>{
    const element=viewport.current
    if(!element)return
    const measure=()=>setHeight(Math.max(170,Math.floor(window.innerHeight-element.getBoundingClientRect().top-27)))
    measure()
    const observer=new ResizeObserver(measure)
    if(element.parentElement)observer.observe(element.parentElement)
    window.addEventListener('resize',measure)
    return()=>{observer.disconnect();window.removeEventListener('resize',measure)}
  },[])
  useEffect(()=>{
    if(!nodes.length||fitted.current===mode)return
    const element=viewport.current
    if(!element)return
    const next=chartLayout(graph,new Set())
    fitted.current=mode
    const view=fitChart(element.clientWidth,element.clientHeight,next.width,next.height)
    setView({...view,y:Math.min(52,view.y)})
  },[mode,graph])
  function scale(factor:number,x?:number,y?:number){
    const el=viewport.current
    if(!el)return
    const cx=x??el.clientWidth/2,cy=y??el.clientHeight/2
    setView(v=>{
      const k=Math.min(2,Math.max(.000001,v.k*factor)),ratio=k/v.k
      return {x:cx-(cx-v.x)*ratio,y:cy-(cy-v.y)*ratio,k}
    })
  }
  useEffect(()=>{
    const element=viewport.current
    if(!element)return
    function wheel(e:WheelEvent){
      e.preventDefault()
      const rect=element!.getBoundingClientRect()
      if(e.ctrlKey||e.metaKey){scale(Math.exp(-e.deltaY*.003),e.clientX-rect.left,e.clientY-rect.top);return}
      setView(v=>({...v,x:v.x-e.deltaX,y:v.y-e.deltaY}))
    }
    element.addEventListener('wheel',wheel,{passive:false})
    return()=>element.removeEventListener('wheel',wheel)
  },[])
  function changeMode(value:Mode){
    fitted.current=undefined
    setMode(value);setSelected(undefined);setFocused(undefined);setExpanded(new Set());setHistory(undefined)
  }
  function select(id:string){setSelected(id);setHistory(undefined);setHistoryError('')}
  function focus(id:string){
    const current=new Set([...expanded,...ancestors(graph,id)])
    const point=chartLayout(graph,current).coordinates.get(id)
    if(!point||!viewport.current)return
    const element=viewport.current
    setExpanded(current)
    setView({x:element.clientWidth/2-point.x-nodeWidth/2,y:element.clientHeight/2-point.y-nodeHeight/2,k:1})
    setFocused(id)
  }
  function openEditor(kind:Editor['kind'],person?:Person,department?:Department,position?:Position){
    setEditor({kind,id:person?.id??department?.id??position?.id})
    setEditorError('')
    form.setFieldsValue({name:department?.name,title:position?.title,active:department?.active??position?.isActive??true,
      manager:person?.managerId??undefined,department:person?.department??undefined,position:person?.position??undefined,
      parent_id:department?.parent_id??undefined,lead_id:department?.lead_id??undefined})
  }
  async function save(values:Values){
    if(!editor)return
    const current=editor
    const run=async()=>{
      setSaving(true);setEditorError('')
      if(viewport.current)viewport.current.dataset.saving='1'
      try{
        if(current.kind==='people')await orgRequest('/users/'+current.id,'PUT',{
          department:values.department??null,position:values.position??null,
          ...(values.manager||!selectedPerson?.unresolved?{directManager:values.manager??null}:{}),
        })
        else if(current.kind==='departments')await orgRequest('/organization/departments'+(current.id?'/'+current.id:''),current.id?'PUT':'POST',
          {name:values.name,active:values.active,parent_id:values.parent_id??null,lead_id:values.lead_id??null})
        else await orgRequest('/positions'+(current.id?'/'+current.id:''),current.id?'PUT':'POST',{title:values.title,isActive:values.active})
        setEditor(undefined);message.success('تغییرات ثبت شد.');await reload()
      }catch(e){setEditorError(errorText(e))}
      finally{setSaving(false);if(viewport.current)delete viewport.current.dataset.saving}
    }
    if(current.kind==='people'&&(values.manager??null)!==(selectedPerson?.managerId??null)){
      dialog.confirm({title:'تغییر مدیر مستقیم',content:(selectedPerson?.name??'')+' · '+(values.manager?reference(values.manager):'بدون مدیر مستقیم'),
        okText:'ثبت تغییر',cancelText:'انصراف',onOk:run})
    }else await run()
  }
  async function loadHistory(id:string){
    setHistoryError('')
    try{setHistory(await orgRequest<Change[]>('/organization/history/'+id))}
    catch(e){setHistoryError(errorText(e))}
  }
  function togglePerson(person:Person){
    dialog.confirm({
      title:person.active?'غیرفعال‌کردن حساب کاربر':'فعال‌کردن حساب کاربر',
      content:person.active?person.name+' از پرتال خارج می‌شود و ورود دوباره تا فعال‌سازی حساب ممکن نیست.':person.name+' دوباره می‌تواند وارد پرتال شود.',
      okText:'ثبت تغییر',cancelText:'انصراف',
      onOk:async()=>{
        try{await orgRequest('/users/'+person.id+'/toggle-active','PATCH',{isActive:!person.active})}
        catch(e){message.error(errorText(e));throw e}
      },
    })
  }
  const departmentPeople=selectedUnit?people?.filter(p=>orgKey(p.department)===orgKey(selectedUnit.name))??[]:[]
  const employeeOptions=(data?.positions??[]).filter(p=>p.isActive||p.title===selectedPerson?.position).map(p=>option(p.title,p.title))
  const departmentOptions=(departments??[]).filter(d=>d.active||d.name===selectedPerson?.department).map(d=>option(d.name,d.name))
  if(selectedPerson?.position&&!employeeOptions.some(p=>p.value===selectedPerson.position))employeeOptions.push(option(selectedPerson.position,selectedPerson.position))
  if(selectedPerson?.department&&!departmentOptions.some(d=>d.value===selectedPerson.department))departmentOptions.push(option(selectedPerson.department,selectedPerson.department))
  const currentManager=selectedPerson?.managerId
  const visibleManagers=managerOptions.filter(p=>p.value!==selectedPerson?.id&&!ancestors(graph,p.value).includes(selectedPerson?.id??''))
  if(currentManager&&!visibleManagers.some(p=>p.value===currentManager))visibleManagers.push(option(currentManager,reference(currentManager)))
  return <section className="org-chart" dir="rtl">
    {confirmLayer}
    <header className="org-chart-tools">
      <Segmented value={mode} onChange={changeMode} options={[{value:'people',label:'افراد',icon:<TeamOutlined/>},{value:'departments',label:'واحدها',icon:<ApartmentOutlined/>}]}/>
      <Select<string,{value:string;label:string}> showSearch filterOption={(input,item)=>searchKey(item?.label).includes(searchKey(input))} aria-label="جست‌وجوی چارت" placeholder="کارمند، سمت یا واحد"
        value={undefined} onSelect={focus} style={{minWidth:0,flex:'1 1 185px',maxWidth:315}}
        options={nodes.map(n=>option(n.id,[n.name,n.caption].filter(Boolean).join(' · ')))}/>
      <Space wrap size={4}>
        <Button aria-label="بزرگ‌نمایی" title="بزرگ‌نمایی" icon={<PlusOutlined/>} onClick={()=>scale(1.2)}/>
        <Button aria-label="کوچک‌نمایی" title="کوچک‌نمایی" icon={<MinusOutlined/>} onClick={()=>scale(1/1.2)}/>
        <Button aria-label="جا دادن در صفحه" title="جا دادن در صفحه" icon={<ArrowsAltOutlined/>} onClick={()=>fit()}/>
        <Button aria-label="نمای کلی" title="نمای کلی" icon={<AimOutlined/>} onClick={()=>{setExpanded(new Set());setSelected(undefined);setFocused(undefined);fit(chartLayout(graph,new Set()))}}/>
        <Button aria-label="بارگذاری مجدد" title="بارگذاری مجدد" icon={<ReloadOutlined/>} loading={loading} onClick={()=>void reload()}/>
      </Space>
      {data?.access.create&&<Button onClick={()=>{changeMode('departments');openEditor('departments')}}>واحد جدید</Button>}
      {(data?.access.create||data?.access.edit)&&<Button onClick={()=>setCatalog(true)}>مدیریت سمت‌ها</Button>}
    </header>
    {error&&<Alert type="error" showIcon message={error}/>}
    <div ref={viewport} className={'org-chart-viewport'+(moving?' is-dragging':'')} style={{height}} tabIndex={0}
      aria-label="بوم چارت سازمانی"
      onKeyDown={e=>{
        if(e.target!==e.currentTarget)return
        const offsets:Record<string,[number,number]>={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}
        if(e.key==='+'||e.key==='='){e.preventDefault();scale(1.2)}
        if(e.key==='-'){e.preventDefault();scale(1/1.2)}
        if(offsets[e.key]){e.preventDefault();const [x,y]=offsets[e.key];setView(v=>({...v,x:v.x+x,y:v.y+y}))}
      }}
      onPointerDown={e=>{
        if(e.button!==0||(e.target as HTMLElement).closest('button'))return
        drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,start:view};e.currentTarget.setPointerCapture(e.pointerId);setMoving(true)
      }}
      onPointerMove={e=>{const d=drag.current;if(d?.id===e.pointerId)setView({...d.start,x:d.start.x+e.clientX-d.x,y:d.start.y+e.clientY-d.y})}}
      onLostPointerCapture={()=>{drag.current=null;setMoving(false)}}
    >
      {loading&&!data&&<div className="org-chart-empty"><Spin/></div>}
      {!loading&&!nodes.length&&!error&&<div className="org-chart-empty"><Empty description="گره سازمانی ثبت نشده است."/></div>}
      <div className="org-chart-diagram" style={{width:layout.width,height:layout.height,transform:'translate('+view.x+'px,'+view.y+'px) scale('+view.k+')'}}>
        {[...layout.coordinates].map(([id,point])=>{
          const n=graph.items.get(id)!,children=graph.children.get(id)??[],parent=layout.coordinates.get(graph.parents.get(id)??'')
          const x=point.x+nodeWidth/2,top=parent?parent.y+nodeHeight:0,end=parent?parent.x+nodeWidth/2:0
          const middle=(top+point.y)/2
          return <div key={id}>
            {parent&&<><span className="org-chart-line" style={{left:end,top,height:middle-top,width:1}}/>
              <span className="org-chart-line" style={{left:Math.min(x,end),top:middle,height:1,width:Math.abs(x-end)+1}}/>
              <span className="org-chart-line" style={{left:x,top:middle,height:point.y-middle,width:1}}/></>}
            <div className={'org-chart-node'+((selected??focused)===id?' is-selected':'')+(!n.active?' is-inactive':'')} style={{left:point.x,top:point.y,width:nodeWidth,height:nodeHeight}}>
              <button type="button" className="org-chart-node-body" onClick={()=>select(id)}>
                <Avatar src={n.avatar} icon={mode==='people'?<UserOutlined/>:<ApartmentOutlined/>} size={34}/>
                <span className="org-chart-node-content"><strong title={n.name}>{n.name}</strong>
                  <span title={n.caption}>{n.caption??'—'}</span>
                  {!n.active&&<small>غیرفعال</small>}
                </span>
              </button>
              {children.length>0&&<button className="org-chart-toggle" type="button" aria-expanded={expanded.has(id)} onClick={()=>setExpanded(current=>{
                const next=new Set(current);if(!next.delete(id))next.add(id);return next
              })}>{expanded.has(id)?'−':'+'} {fa(children.length)} {mode==='people'?'زیرمجموعه':'زیرواحد'}</button>}
            </div>
          </div>
        })}
      </div>
      <span className="org-chart-zoom" aria-hidden>{(view.k*100).toLocaleString('fa-IR',{maximumFractionDigits:1})}٪</span>
    </div>
    <Drawer open={Boolean(selectedPerson||selectedUnit)} onClose={()=>setSelected(undefined)} title={selectedPerson?.name??selectedUnit?.name}
      size="default" extra={canEdit&&<Button onClick={()=>openEditor(mode,selectedPerson,selectedUnit)}>ویرایش</Button>}>
      {selectedPerson&&<>
        <Descriptions size="small" column={1} items={[
          {key:'position',label:'سمت',children:selectedPerson.position||'—'},
          {key:'unit',label:'واحد',children:selectedPerson.department||'—'},
          {key:'manager',label:'مدیر مستقیم',children:selectedPerson.unresolved?'ارجاع قدیمی نیازمند بررسی':reference(selectedPerson.managerId)},
          {key:'reports',label:'زیرمجموعه مستقیم',children:fa((graph.children.get(selectedPerson.id)??[]).length)},
          {key:'active',label:'وضعیت',children:status(selectedPerson.active)},
        ]}/>
        {canEdit&&selectedPerson.canToggle&&<Button danger={selectedPerson.active} onClick={()=>togglePerson(selectedPerson)}>
          {selectedPerson.active?'غیرفعال‌کردن حساب':'فعال‌کردن حساب'}
        </Button>}
      </>}
      {selectedUnit&&<>
        <Descriptions size="small" column={1} items={[
          {key:'parent',label:'واحد بالادستی',children:unit(selectedUnit.parent_id)},
          {key:'lead',label:'مسئول واحد',children:reference(selectedUnit.lead_id)},
          {key:'staff',label:'تعداد کارکنان',children:fa(departmentPeople.length)},
          {key:'children',label:'تعداد زیرواحد',children:fa((graph.children.get(selectedUnit.id)??[]).length)},
          {key:'active',label:'وضعیت',children:status(selectedUnit.active)},
        ]}/>
        <List size="small" dataSource={departmentPeople} locale={{emptyText:'کارمندی در این واحد ثبت نشده است.'}} renderItem={p=><List.Item>{p.name} {p.position&&<Tag>{p.position}</Tag>}</List.Item>}/>
      </>}
      {canEdit&&selected&&<Button style={{marginBlock:16}} onClick={()=>void loadHistory(selected)}>تاریخچه تغییرات</Button>}
      {historyError&&<Alert type="error" message={historyError}/>}
      {history&&<List size="small" dataSource={history} locale={{emptyText:'تغییری ثبت نشده است.'}} renderItem={item=><List.Item>
        <Space orientation="vertical">
          <strong>{new Date(item.changed_at).toLocaleString('fa-IR',{timeZone:'Asia/Tehran'})} · {reference(item.actor_id)}</strong>
          {Object.entries(item.after_data).filter(([key,value])=>item.before_data?.[key]!==value&&['manager','department','position','name','active','parent_id','lead_id'].includes(key)).map(([key,value])=>{
            const titles:Record<string,string>={manager:'مدیر مستقیم',department:'واحد',position:'سمت',name:'نام',active:'وضعیت',parent_id:'واحد بالادست',lead_id:'مسئول واحد'}
            const format=(value:unknown)=>typeof value==='boolean'?(value?'فعال':'غیرفعال'):typeof value==='string'?(key==='manager'||key==='lead_id'?reference(value):key==='parent_id'?unit(value):value):'—'
            return <span key={key}>{titles[key]} · {format(item.before_data?.[key])} ← {format(value)}</span>
          })}
        </Space>
      </List.Item>}/>}
    </Drawer>
    <Modal open={catalog&&Boolean(data)} title="سمت‌های سازمانی" onCancel={()=>setCatalog(false)} footer={null}>
      {data?.access.create&&<Button onClick={()=>{setCatalog(false);openEditor('positions')}}>سمت جدید</Button>}
      <List size="small" dataSource={data?.positions??[]} renderItem={p=><List.Item actions={data?.access.edit&&!p.isSystem?[
        <Button key="edit" size="small" onClick={()=>{setCatalog(false);openEditor('positions',undefined,undefined,p)}}>ویرایش</Button>,
      ]:[]}>{p.title} {status(p.isActive)}</List.Item>}/>
    </Modal>
    <Modal forceRender open={!!editor} title={editor?.kind==='people'?'اطلاعات سازمانی کارمند':editor?.kind==='departments'?'واحد سازمانی':'سمت سازمانی'}
      onCancel={()=>{if(!saving)setEditor(undefined)}} onOk={()=>form.submit()} okText="ذخیره" cancelText="انصراف" confirmLoading={saving}>
      {editorError&&<Alert type="error" message={editorError} showIcon/>}
      <Form form={form} layout="vertical" onFinish={values=>void save(values)}>
        {editor?.kind==='people'&&<>
          <Form.Item name="department" label="واحد سازمانی"><Select {...selectProps} options={departmentOptions}/></Form.Item>
          <Form.Item name="position" label="سمت سازمانی"><Select {...selectProps} options={employeeOptions}/></Form.Item>
          <Form.Item name="manager" label="مدیر مستقیم"><Select {...selectProps} options={visibleManagers}/></Form.Item>
        </>}
        {editor?.kind==='departments'&&<>
          <Form.Item name="name" label="نام واحد" rules={[{required:true,whitespace:true}]}><Input maxLength={160}/></Form.Item>
          <Form.Item name="parent_id" label="واحد بالادست"><Select {...selectProps} options={(departments??[]).filter(d=>d.id!==editor.id&&d.active&&!ancestors(graph,d.id).includes(editor.id??'')).map(d=>option(d.id,d.name))}/></Form.Item>
          <Form.Item name="lead_id" label="مسئول واحد"><Select {...selectProps} options={managerOptions}/></Form.Item>
        </>}
        {editor?.kind==='positions'&&<Form.Item name="title" label="عنوان سمت" rules={[{required:true,whitespace:true}]}><Input maxLength={160}/></Form.Item>}
        {editor&&editor.kind!=='people'&&<Form.Item name="active" label="فعال" valuePropName="checked"><Switch/></Form.Item>}
      </Form>
    </Modal>
  </section>
}
