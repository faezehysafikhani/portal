const div=(a:number,b:number)=>Math.trunc(a/b)
const mod=(a:number,b:number)=>a-Math.trunc(a/b)*b
const breaks=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178]
function jalCal(jy:number){const gy=jy+621;let leapJ=-14,jp=breaks[0],jump=0;for(let i=1;i<breaks.length;i++){const jm=breaks[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm}let n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ++;const leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;const march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;let leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return{leap,gy,march}}
function g2d(gy:number,gm:number,gd:number){let d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;d=d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752;return d}
function d2g(jdn:number){let j=4*jdn+139361631;j+=div(div(4*jdn+183187720,146097)*3,4)*4-3908;const i=div(mod(j,1461),4)*5+308;const gd=div(mod(i,153),5)+1,gm=mod(div(i,153),12)+1,gy=div(j,1461)-100100+div(8-gm,6);return{gy,gm,gd}}
function d2j(jdn:number){const gy=d2g(jdn).gy;let jy=gy-621;const r=jalCal(jy),jdn1f=g2d(gy,3,r.march);let k=jdn-jdn1f;if(k>=0){if(k<=185)return{jy,jm:1+div(k,31),jd:mod(k,31)+1};k-=186}else{jy--;k+=179;if(r.leap===1)k++}return{jy,jm:7+div(k,30),jd:mod(k,30)+1}}
export function dateToJalali(date:Date){return d2j(g2d(date.getFullYear(),date.getMonth()+1,date.getDate()))}
export function jalaliDateString(value:string|Date){const d=value instanceof Date?value:new Date(value);const j=dateToJalali(d);return`${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')}`}
export function jalaliYearMonth(value: string | Date = new Date()) { const d=value instanceof Date?value:new Date(value); const j=dateToJalali(d); return `${j.jy}/${String(j.jm).padStart(2,'0')}` }
export function jalaliYearMonth(date=new Date()){const j=dateToJalali(date);return j.jy*100+j.jm}
