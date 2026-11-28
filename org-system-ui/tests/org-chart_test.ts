import { ancestors, buildGraph, chartLayout, fitChart, nodeHeight, nodeWidth, searchKey, type GraphNode } from '../src/pages/org-chart-model.ts'

const node=(id:string,parent?:string):GraphNode=>({id,parent,name:id,active:true})
const assert=(condition:unknown)=>{if(!condition)throw new Error('Chart assertion failed')}

Deno.test('collapsed chart and focused path honor actual reporting relationships',()=>{
  const graph=buildGraph([node('primary'),node('unconnected'),node('first-level','primary'),node('second-level','first-level')])
  const collapsed=chartLayout(graph,new Set())
  assert(collapsed.coordinates.size===2)
  assert(!collapsed.coordinates.has('first-level'))
  const path=ancestors(graph,'second-level')
  assert(path.join(',')==='first-level,primary')
  const expanded=chartLayout(graph,new Set(path))
  assert(expanded.coordinates.size===4)
  assert(expanded.coordinates.get('second-level')!.y>expanded.coordinates.get('first-level')!.y+nodeHeight)
})

Deno.test('wide and deep charts have no overlapping nodes and no recursion limit',()=>{
  const width=80,depth=3000
  const chain=Array.from({length:depth},(_,i)=>node('chain-'+i,i?'chain-'+(i-1):undefined))
  const team=Array.from({length:width},(_,i)=>node('member-'+i,'unconnected'))
  const graph=buildGraph([...chain,node('unconnected'),...team])
  const expanded=chartLayout(graph,new Set([...chain.map(n=>n.id),'unconnected']))
  assert(expanded.coordinates.size===depth+width+1)
  assert(expanded.height>nodeHeight*depth)
  const x=team.map(n=>expanded.coordinates.get(n.id)!.x).sort((a,b)=>a-b)
  assert(x.every((point,i)=>i===0||point>=x[i-1]+nodeWidth))
  const fit=fitChart(280,540,expanded.width,expanded.height)
  assert(fit.x>=0&&fit.y>=0&&fit.x+expanded.width*fit.k<=280&&fit.y+expanded.height*fit.k<=540)
})

Deno.test('missing parent and old cycles remain visible as roots',()=>{
  const graph=buildGraph([node('a','b'),node('b','a'),node('c','missing'),node('d','d')])
  assert(graph.roots.length===3)
  assert(chartLayout(graph,new Set(['a','b','c','d'])).coordinates.size===4)
})

Deno.test('search handles the Persian, Arabic and ASCII forms of digits',()=>{
  assert(searchKey('کارمند ۲۷')===searchKey('كارمند 27'))
  assert(searchKey('کارمند ٢٧')===searchKey('کارمند 27'))
})
