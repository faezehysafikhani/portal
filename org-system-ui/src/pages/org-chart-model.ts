import { apiFetch } from '../utils/api'

export interface Person {
  id:string;name:string;position?:string;department?:string;active:boolean;managerId?:string;unresolved:boolean;avatar?:string;canToggle:boolean
}
export interface Department {id:string;name:string;parent_id?:string;lead_id?:string;active:boolean}
export interface Position {id:string;title:string;isActive:boolean;isSystem?:boolean}
export interface GraphNode {id:string;parent?:string;name:string;caption?:string;active:boolean;avatar?:string}
export interface ChartData {
  people:Person[];departments:Department[];positions:Position[];
  access:{employee:boolean;create:boolean;edit:boolean}
}
export const orgKey=(value?:string|null)=>String(value??'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,'').toLowerCase()
export const searchKey=(value?:string)=>orgKey(value)
  .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776))
  .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632))
export async function orgRequest<T>(path:string,method='GET',values?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await apiFetch('http://localhost:5043/api/v1'+path,{method,signal,body:values?JSON.stringify(values):undefined,
    headers:values?{'Content-Type':'application/json'}:undefined})
  const data=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(data?.message??'دریافت یا ثبت ساختار سازمانی انجام نشد.')
  return data
}
export function buildGraph(nodes:GraphNode[]){
  const items=new Map(nodes.map(n=>[n.id,n]))
  const parents=new Map(nodes.filter(n=>n.parent&&items.has(n.parent)&&n.parent!==n.id).map(n=>[n.id,n.parent!]))
  const checked=new Set<string>()
  for(const node of nodes){
    const path=new Set<string>()
    let id:string|undefined=node.id
    while(id&&!checked.has(id)){
      if(path.has(id)){parents.delete(id);break}
      path.add(id);id=parents.get(id)
    }
    path.forEach(id=>checked.add(id))
  }
  const roots:string[]=[],children=new Map<string,string[]>()
  for(const node of nodes.slice().sort((a,b)=>a.name.localeCompare(b.name,'fa'))){
    const parent=parents.get(node.id)
    if(!parent){roots.push(node.id);continue}
    const group=children.get(parent)??[]
    group.push(node.id);children.set(parent,group)
  }
  return {items,parents,roots,children}
}
export const nodeWidth=214,nodeHeight=100,columnGap=28,levelGap=52
export function fitChart(viewportWidth:number,viewportHeight:number,width:number,height:number){
  const gap=Math.min(40,viewportWidth/5,viewportHeight/5)
  const k=Math.min(1,Math.max(1,viewportWidth-gap)/width,Math.max(1,viewportHeight-gap)/height)
  return {x:(viewportWidth-width*k)/2,y:(viewportHeight-height*k)/2,k}
}
export function chartLayout(graph:ReturnType<typeof buildGraph>,expanded:Set<string>){
  const ordered:{id:string;depth:number}[]=[]
  const stack=graph.roots.slice().reverse().map(id=>({id,depth:0}))
  while(stack.length){
    const current=stack.pop()!
    ordered.push(current)
    if(!expanded.has(current.id))continue
    const children=graph.children.get(current.id)??[]
    for(let i=children.length-1;i>=0;i--)stack.push({id:children[i],depth:current.depth+1})
  }
  let leaves=0,maxDepth=0
  const coordinates=new Map<string,{x:number;y:number}>()
  // Allocate leaves left to right, then center parents over their visible children.
  for(const row of ordered){
    maxDepth=Math.max(maxDepth,row.depth)
    if(!expanded.has(row.id)||!graph.children.get(row.id)?.length){
      coordinates.set(row.id,{x:leaves++*(nodeWidth+columnGap),y:row.depth*(nodeHeight+levelGap)})
    }
  }
  for(let i=ordered.length-1;i>=0;i--){
    const row=ordered[i]
    if(coordinates.has(row.id))continue
    const children=graph.children.get(row.id)!
    coordinates.set(row.id,{x:(coordinates.get(children[0])!.x+coordinates.get(children.at(-1)!)!.x)/2,y:row.depth*(nodeHeight+levelGap)})
  }
  return {coordinates,width:Math.max(1,leaves)*(nodeWidth+columnGap)-columnGap,height:maxDepth*(nodeHeight+levelGap)+nodeHeight}
}
export function ancestors(graph:ReturnType<typeof buildGraph>,id:string){
  const path:string[]=[]
  for(let parent=graph.parents.get(id);parent;parent=graph.parents.get(parent))path.push(parent)
  return path
}
