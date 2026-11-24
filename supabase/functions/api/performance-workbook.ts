type Cell=string|number|null|undefined
const encoder=new TextEncoder()
const xml=(value:unknown)=>String(value??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]??c))
const crcTable=Array.from({length:256},(_,value)=>{for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0})
const checksum=(bytes:Uint8Array)=>{let c=0xffffffff;for(const b of bytes)c=(c>>>8)^crcTable[(c^b)&255];return (c^0xffffffff)>>>0}
// Store-only ZIP writer for a small, formula-free Office Open XML workbook.
function zip(files:[string,string][]) {
  const local:Uint8Array[]=[],central:Uint8Array[]=[]
  let offset=0,centralSize=0
  for(const [path,content] of files){
    const name=encoder.encode(path),data=encoder.encode(content),crc=checksum(data)
    const h=new Uint8Array(30+name.length),v=new DataView(h.buffer)
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true)
    v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30)
    const d=new Uint8Array(46+name.length),w=new DataView(d.buffer)
    w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint32(16,crc,true)
    w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);d.set(name,46)
    local.push(h,data);central.push(d);offset+=h.length+data.length;centralSize+=d.length
  }
  const tail=new Uint8Array(22),v=new DataView(tail.buffer)
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true)
  v.setUint32(12,centralSize,true);v.setUint32(16,offset,true)
  const result=new Uint8Array(offset+centralSize+tail.length)
  let cursor=0;for(const part of [...local,...central,tail]){result.set(part,cursor);cursor+=part.length}
  return result
}
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const packageRel='http://schemas.openxmlformats.org/package/2006/relationships'
export function workbook(sheets:{name:string;rows:Cell[][]}[]){
  const files:[string,string][]=[
    ['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels',`<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<Relationships xmlns="${packageRel}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`],
  ]
  sheets.forEach((sheet,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,`<worksheet xmlns="${ns}"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${sheet.rows.map(row=>`<row>${row.map(value=>typeof value==='number'&&Number.isFinite(value)?`<c><v>${value}</v></c>`:`<c t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`]))
  return zip(files)
}
