import { evaluationDefaults, pickTemplate, validateEvaluationRules, type Period } from './performance-evaluation-config.ts'
import { HttpError } from '../_shared/http.ts'

function equal(actual:unknown,expected:unknown){
  if(!Object.is(actual,expected))throw new Error('Expected '+JSON.stringify(expected)+', got '+JSON.stringify(actual))
}

Deno.test('periodic metrics count mixed activity time once and leave task rates absent',async()=>{
  const {periodMetrics}=await import('./performance-insights.ts')
  const employee={id:'person',active:true},day='2026-11-04'
  const entered={employee:'person',date:day,submitted:true,reportStatus:'approved',outcome:'Outcome'}
  const reports=[{employee:'person',date:day,status:'approved',returns:[]}]
  const work=[{employee_id:'person',work_date:day,required:true,deadline:day+'T19:00:00Z'}]
  const administrative={...entered,title:'Administration',minutes:35}
  const project={...entered,title:'Project',minutes:85,projectId:'project'}
  const office=periodMetrics(employee,reports,work,[administrative],[],day,day)
  equal(office.projectCount,0);equal(office.nonProjectCount,1);equal(office.minutes,35)
  equal(office.onTimeRate,null);equal(office.completionRate,null)
  const mixed=periodMetrics(employee,reports,work,[administrative,project],[],day,day)
  equal(mixed.projectCount,1);equal(mixed.nonProjectCount,1);equal(mixed.minutes,120)
  equal(mixed.reportRate,100);equal(mixed.approvalRate,100);equal(mixed.sources.length,2)
})

Deno.test('delivery rate uses first valid submission and deadline at submission',async()=>{
  const {periodMetrics}=await import('./performance-insights.ts')
  const employee={id:'person',active:true},from='2026-11-01',to='2026-11-30'
  const tasks=[
    {employee:'person',first:'2026-11-05T08:00:00Z',firstDeadline:'2026-11-06T08:00:00Z',
      due:'2026-12-10T08:00:00Z',approved:true,approvedAt:'2026-11-05T09:30:00Z'},
    {employee:'person',first:'2026-11-05T08:00:00Z',firstDeadline:'2026-11-04T08:00:00Z',due:'2026-11-04T08:00:00Z'},
    {employee:'person',first:'2026-11-05T08:00:00Z',firstDeadline:'2026-11-06T08:00:00Z',due:'2026-11-06T08:00:00Z',cancelled:true},
  ]
  const result=periodMetrics(employee,[],[],[],tasks,from,to)
  equal(result.onTimeRate,50);equal(result.waitingMinutes,90);equal(result.completionRate,0)
})

Deno.test('template resolution is Persian-normalized and does not require projects',()=>{
  const period:Period={id:'period',label:'Period',kind:'month',from:'2026-10-01',to:'2026-10-31',status:'open',finalization:''}
  equal(pickTemplate(evaluationDefaults,{id:'office',position:'كارشناس اداری'},period).id,'office')
  equal(pickTemplate(evaluationDefaults,{id:'staff',position:'Other'},period).id,'general')
  const changed=structuredClone(evaluationDefaults)
  changed.templates[0].items[0].weight=1
  try{validateEvaluationRules(changed);throw new Error('Invalid template weight accepted')}
  catch(e){if(!(e instanceof HttpError))throw e;equal(e.status,400)}
})
