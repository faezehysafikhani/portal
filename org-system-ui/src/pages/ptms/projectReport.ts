import {
  SAMPLE_CHANGES,
  SAMPLE_COSTS,
  SAMPLE_DOCUMENTS,
  SAMPLE_ISSUES,
  SAMPLE_PROJECTS,
  SAMPLE_RISKS,
  SAMPLE_TASKS,
  formatCurrency,
} from './ptmsData'

export interface ProjectReportEvent {
  id: string
  title: string
  date: string
  time?: string
  type: string
}

interface ReportOptions {
  events?: ProjectReportEvent[]
  controls?: unknown[]
}

const esc = (value: unknown) => String(value ?? '—')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

function readJson<T>(key: string, fallback: T): T {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function table(title: string, headers: string[], rows: unknown[][]) {
  return `<section><h2>${esc(title)} <span class="count">${rows.length.toLocaleString('fa-IR')}</span></h2>${rows.length ? `<div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="empty">داده‌ای برای این پروژه ثبت نشده است.</p>'}</section>`
}

function progressChart(progress: number) {
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress / 100)
  return `<svg viewBox="0 0 160 160" role="img" aria-label="پیشرفت پروژه"><circle cx="80" cy="80" r="${radius}" fill="none" stroke="#eee" stroke-width="18"/><circle cx="80" cy="80" r="${radius}" fill="none" stroke="#8B1A6B" stroke-width="18" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 80 80)"/><text x="80" y="86" text-anchor="middle" font-size="26" font-weight="700">${progress.toLocaleString('fa-IR')}٪</text></svg>`
}

function budgetChart(budget: number, actual: number) {
  const maximum = Math.max(budget, actual, 1)
  const budgetWidth = Math.round((budget / maximum) * 250)
  const actualWidth = Math.round((actual / maximum) * 250)
  return `<svg viewBox="0 0 360 140" role="img" aria-label="بودجه و هزینه"><text x="350" y="35" text-anchor="end">بودجه</text><rect x="80" y="18" width="${budgetWidth}" height="24" rx="5" fill="#1677ff"/><text x="350" y="90" text-anchor="end">هزینه واقعی</text><rect x="80" y="73" width="${actualWidth}" height="24" rx="5" fill="#fa8c16"/><text x="80" y="125" font-size="11">مقیاس نسبی بودجه و هزینه</text></svg>`
}

function taskChart(tasks: Array<{ status?: string }>) {
  const statuses = ['جدید', 'در حال انجام', 'در انتظار بازبینی', 'تکمیل شده']
  const colors = ['#8c8c8c', '#1677ff', '#fa8c16', '#52c41a']
  const values = statuses.map(status => tasks.filter(task => task.status === status).length)
  const max = Math.max(...values, 1)
  return `<svg viewBox="0 0 440 190" role="img" aria-label="توزیع وضعیت وظایف">${values.map((value, index) => {
    const height = Math.round((value / max) * 110)
    const x = 35 + index * 100
    return `<rect x="${x}" y="${140 - height}" width="55" height="${height}" rx="5" fill="${colors[index]}"/><text x="${x + 27}" y="${132 - height}" text-anchor="middle" font-weight="700">${value.toLocaleString('fa-IR')}</text><text x="${x + 27}" y="162" text-anchor="middle" font-size="10">${esc(statuses[index])}</text>`
  }).join('')}</svg>`
}

function riskChart(risks: Array<{ score?: number; residualScore?: number }>) {
  const groups = [
    { label: 'پایین', min: 0, max: 4, color: '#52c41a' },
    { label: 'متوسط', min: 5, max: 9, color: '#fadb14' },
    { label: 'بالا', min: 10, max: 15, color: '#fa8c16' },
    { label: 'بحرانی', min: 16, max: 25, color: '#ff4d4f' },
  ]
  return `<div class="risk-chart">${groups.map(group => {
    const count = risks.filter(risk => Number(risk.residualScore ?? risk.score ?? 0) >= group.min && Number(risk.residualScore ?? risk.score ?? 0) <= group.max).length
    return `<div style="border-top-color:${group.color}"><b>${count.toLocaleString('fa-IR')}</b><span>${group.label}</span></div>`
  }).join('')}</div>`
}

export function downloadProjectReport(projectId: string, options: ReportOptions = {}) {
  const project = SAMPLE_PROJECTS.find(item => item.id === projectId)
  if (!project) throw new Error('پروژه انتخاب‌شده پیدا نشد')

  const sampleTasks = SAMPLE_TASKS.filter(item => item.projectId === projectId)
  const executionTasks = readJson<Array<Record<string, unknown>>>(`ptms-execution-${projectId}`, sampleTasks as unknown as Array<Record<string, unknown>>)
  const storedRisks = readJson<Array<Record<string, unknown>>>('portal:managed-risks:v2', [])
  const risks = storedRisks.length
    ? storedRisks.filter(item => item.projectId === projectId)
    : SAMPLE_RISKS.filter(item => item.projectId === projectId) as unknown as Array<Record<string, unknown>>
  const issues = SAMPLE_ISSUES.filter(item => item.projectId === projectId)
  const changes = SAMPLE_CHANGES.filter(item => item.projectId === projectId)
  const documents = SAMPLE_DOCUMENTS.filter(item => item.projectId === projectId)
  const costs = SAMPLE_COSTS.filter(item => item.projectId === projectId)
  const events = options.events || []
  const controls = options.controls || []

  const kanbanStatuses = ['جدید', 'در حال انجام', 'در انتظار بازبینی', 'تکمیل شده']
  const board = `<section><h2>برد کانبان پروژه</h2><div class="board">${kanbanStatuses.map(status => {
    const items = executionTasks.filter(item => item.status === status)
    return `<div class="lane"><h3>${esc(status)} <span>${items.length.toLocaleString('fa-IR')}</span></h3>${items.map(item => `<article><b>${esc(item.code)}</b><strong>${esc(item.title)}</strong><small>${esc(item.assignee || item.assignedToUserId || 'بدون مسئول')}</small><div class="progress"><i style="width:${Number(item.progress || 0)}%"></i></div></article>`).join('') || '<p class="empty">بدون کارت</p>'}</div>`
  }).join('')}</div></section>`

  const reportData = { generatedAt: new Date().toISOString(), project, tasks: executionTasks, risks, issues, changes, documents, costs, events, controls }
  const safeJson = JSON.stringify(reportData, null, 2).replaceAll('<', '\\u003c')
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>گزارش جامع ${esc(project.name)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#222;font-family:Tahoma,Arial,sans-serif;font-size:13px}.toolbar{position:sticky;top:0;z-index:5;display:flex;gap:8px;padding:12px 4%;background:#fff;border-bottom:1px solid #ddd}.toolbar button{border:0;border-radius:7px;padding:9px 16px;cursor:pointer;background:#8B1A6B;color:#fff}.page{max-width:1180px;margin:20px auto;background:#fff;padding:32px;box-shadow:0 8px 28px #0001}.cover{border-right:6px solid #8B1A6B;padding:20px 24px;background:linear-gradient(90deg,#fff,#f8eaf4)}h1{margin:0;color:#5e124b;font-size:28px}h2{font-size:17px;margin:0 0 14px;border-bottom:2px solid #8B1A6B;padding-bottom:9px}.sub{color:#666;margin-top:8px}.count{font-size:11px;border-radius:20px;background:#f5e5f1;color:#8B1A6B;padding:3px 9px}section{margin-top:28px;break-inside:avoid}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.summary div{border:1px solid #eee;border-top:3px solid #8B1A6B;border-radius:9px;padding:13px}.summary b{display:block;font-size:20px;color:#8B1A6B;margin-top:5px}.charts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.chart{border:1px solid #eee;border-radius:10px;padding:12px;text-align:center}.chart svg{width:100%;height:180px}.risk-chart{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding-top:38px}.risk-chart div{border:1px solid #eee;border-top:5px solid;border-radius:8px;padding:18px 5px}.risk-chart b{font-size:24px;display:block}.risk-chart span{font-size:11px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#6f1458;color:#fff}th,td{padding:8px;border:1px solid #ddd;text-align:right}.board{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:start}.lane{background:#f7f7f9;border-radius:9px;padding:9px;min-height:160px}.lane h3{font-size:13px;margin:0 0 10px}.lane h3 span{float:left;background:#fff;border-radius:20px;padding:2px 7px}.lane article{display:flex;flex-direction:column;gap:5px;background:#fff;border-right:3px solid #8B1A6B;border-radius:7px;padding:9px;margin-bottom:8px;box-shadow:0 2px 8px #0001}.lane small,.empty{color:#888}.progress{height:5px;background:#eee;border-radius:5px;overflow:hidden}.progress i{display:block;height:100%;background:#8B1A6B}.members{display:flex;gap:8px;flex-wrap:wrap}.member{border:1px solid #ddd;border-radius:20px;padding:7px 12px}details{margin-top:28px}pre{direction:ltr;text-align:left;white-space:pre-wrap;background:#111;color:#e7e7e7;padding:18px;border-radius:8px;font:11px Consolas,monospace}@media(max-width:800px){.summary,.charts,.board{grid-template-columns:1fr 1fr}.page{padding:16px;margin:0}}@media print{body{background:#fff}.toolbar{display:none}.page{box-shadow:none;margin:0;max-width:none;padding:12mm}section{break-inside:auto}.board{grid-template-columns:repeat(4,1fr)}@page{size:A4 landscape;margin:8mm}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">چاپ / ذخیره PDF</button><button onclick="downloadJson()">دانلود داده خام JSON</button></div><main class="page"><header class="cover"><h1>گزارش جامع پروژه</h1><h2 style="border:0;margin-top:10px">${esc(project.name)}</h2><div class="sub">${esc(project.code)} — تاریخ استخراج: ${new Date().toLocaleString('fa-IR')}</div></header>
  <div class="summary"><div>وضعیت<b>${esc(project.status)}</b></div><div>پیشرفت<b>${project.progress.toLocaleString('fa-IR')}٪</b></div><div>بودجه<b>${esc(formatCurrency(project.budget))}</b></div><div>هزینه واقعی<b>${esc(formatCurrency(project.actualCost))}</b></div><div>وظایف<b>${executionTasks.length.toLocaleString('fa-IR')}</b></div><div>ریسک‌ها<b>${risks.length.toLocaleString('fa-IR')}</b></div><div>مسائل<b>${issues.length.toLocaleString('fa-IR')}</b></div><div>مستندات<b>${documents.length.toLocaleString('fa-IR')}</b></div></div>
  <section><h2>اطلاعات پایه و منشور پروژه</h2><div class="summary"><div>مدیر پروژه<b>${esc(project.manager)}</b></div><div>حامی پروژه<b>${esc(project.sponsor)}</b></div><div>روش اجرا<b>${esc(project.method)}</b></div><div>نوع پروژه<b>${esc(project.type)}</b></div><div>تاریخ شروع<b>${esc(project.startDate)}</b></div><div>تاریخ پایان<b>${esc(project.endDate)}</b></div><div>اولویت<b>${esc(project.priority)}</b></div><div>سبد پروژه<b>${esc(project.portfolio)}</b></div></div><p>${esc(project.description || 'شرحی ثبت نشده است.')}</p></section>
  <section><h2>اعضا و نقش‌های پروژه</h2><div class="members">${project.team.map(member => `<div class="member"><b>${esc(member.name)}</b> — ${esc(member.role)} (${member.allocation.toLocaleString('fa-IR')}٪)</div>`).join('')}</div></section>
  <section><h2>چارت‌های وضعیت پروژه</h2><div class="charts"><div class="chart"><b>پیشرفت پروژه</b>${progressChart(project.progress)}</div><div class="chart"><b>بودجه و هزینه</b>${budgetChart(project.budget, project.actualCost)}</div><div class="chart"><b>وضعیت وظایف</b>${taskChart(executionTasks)}</div><div class="chart"><b>ریسک باقیمانده</b>${riskChart(risks)}</div></div></section>
  ${board}
  ${table('فهرست کامل وظایف', ['کد', 'عنوان', 'وضعیت', 'اولویت', 'مسئول', 'شروع', 'سررسید', 'پیشرفت'], executionTasks.map(item => [item.code, item.title, item.status, item.priority, item.assignee || item.assignedToUserId, item.startDate, item.deadline || item.dueDate, `${Number(item.progress || 0)}٪`]))}
  ${table('دفتر ریسک پروژه', ['کد', 'عنوان', 'دسته', 'مالک', 'امتیاز ذاتی', 'امتیاز باقیمانده', 'راهبرد', 'وضعیت', 'پیشرفت پاسخ'], risks.map(item => [item.code, item.title, item.category, item.owner, item.score, item.residualScore ?? item.score, item.strategy, item.status, `${Number(item.actionProgress || 0)}٪`]))}
  ${table('مسائل و موانع', ['کد', 'عنوان', 'شدت', 'اولویت', 'مسئول', 'وضعیت', 'مهلت'], issues.map(item => [item.code, item.title, item.severity, item.priority, item.assignee, item.status, item.deadline]))}
  ${table('درخواست‌های تغییر', ['کد', 'عنوان', 'درخواست‌کننده', 'وضعیت', 'اثر زمانی', 'اثر هزینه'], changes.map(item => [item.code, item.title, item.requester, item.status, item.timeImpact, formatCurrency(item.costImpact)]))}
  ${table('مستندات پروژه', ['عنوان', 'دسته', 'نسخه', 'حجم', 'بارگذاری‌کننده', 'تاریخ', 'برچسب‌ها'], documents.map(item => [item.title, item.category, item.version, item.size, item.uploader, item.uploadDate, item.tags.join('، ')]))}
  ${table('رویدادها و جلسات', ['عنوان', 'نوع', 'تاریخ', 'ساعت'], events.map(item => [item.title, item.type, item.date, item.time]))}
  ${table('هزینه‌های ثبت‌شده', ['شرح', 'دسته', 'برآورد', 'واقعی', 'تاریخ', 'شماره فاکتور'], costs.map(item => [item.description, item.category, formatCurrency(item.estimated), formatCurrency(item.actual), item.date, item.invoiceNumber]))}
  ${table('موارد کنترلی و تصمیمات', ['نوع', 'عنوان', 'مسئول', 'وضعیت'], controls.map(item => { const value = item as Record<string, unknown>; return [value.type, value.title, value.owner, value.status] }))}
  <details><summary>داده خام کامل گزارش</summary><pre id="raw"></pre></details></main><script>const reportData=${safeJson};document.getElementById('raw').textContent=JSON.stringify(reportData,null,2);function downloadJson(){const blob=new Blob([JSON.stringify(reportData,null,2)],{type:'application/json;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='project-${esc(project.code)}-data.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)}</script></body></html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `گزارش-جامع-${project.code}-${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1_000)
}
