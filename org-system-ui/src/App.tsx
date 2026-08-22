import { Component, lazy, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const lazyWithRecovery = <T extends { default: ComponentType }>(name: string, loader: () => Promise<T>) => lazy(async () => {
  const recoveryKey = `portal:lazy-recovery:${name}`
  try {
    const module = await loader()
    sessionStorage.removeItem(recoveryKey)
    return module
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isChunkFailure = /dynamically imported module|loading chunk|module script|failed to fetch/i.test(message)
    if (isChunkFailure && sessionStorage.getItem(recoveryKey) !== '1') {
      sessionStorage.setItem(recoveryKey, '1')
      const freshUrl = new URL(window.location.href)
      freshUrl.searchParams.set('__chunk', Date.now().toString())
      window.location.replace(freshUrl.toString())
      return new Promise<T>(() => undefined)
    }
    sessionStorage.removeItem(recoveryKey)
    throw error
  }
})

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMessage: string }> {
  state = { hasError: false, errorMessage: '' }
  static getDerivedStateFromError(error: unknown) { return { hasError: true, errorMessage: error instanceof Error ? error.message : String(error) } }
  private recoveryKey = () => `portal:page-recovery:${location.pathname}`
  private reloadFresh = () => {
    const url = new URL(location.href)
    url.searchParams.set('__recover', Date.now().toString())
    location.replace(url.toString())
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Portal UI error', error, info.componentStack)
    const key=this.recoveryKey(),lastAttempt=Number(sessionStorage.getItem(key)||0)
    if(Date.now()-lastAttempt>60_000){sessionStorage.setItem(key,String(Date.now()));window.setTimeout(this.reloadFresh,100)}
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return <div dir="rtl" style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f7f7f8',fontFamily:'Tahoma,sans-serif',padding:24}}><div style={{background:'#fff',border:'1px solid #eee',borderRadius:16,padding:'30px 34px',maxWidth:480,textAlign:'center',boxShadow:'0 12px 35px #00000012'}}><h2 style={{marginTop:0,color:'#721052'}}>در حال بازیابی صفحه</h2><p style={{color:'#666',lineHeight:2}}>سامانه در حال دریافت نسخه سالم صفحه است. اگر انتقال خودکار انجام نشد، تلاش مجدد را بزنید.</p><small data-testid="portal-error-code" style={{display:'block',color:'#999',direction:'ltr',marginBottom:14}}>{this.state.errorMessage.slice(0,160)}</small><button onClick={()=>{sessionStorage.removeItem(this.recoveryKey());this.reloadFresh()}} style={{border:0,borderRadius:8,padding:'10px 22px',background:'#8b1a6b',color:'#fff',cursor:'pointer',fontSize:14}}>تلاش مجدد</button></div></div>
  }
}

const LoginPage = lazyWithRecovery('login', () => import('./pages/LoginPage'))
const DashboardPage = lazyWithRecovery('dashboard', () => import('./pages/DashboardPage'))
const TasksPage = lazyWithRecovery('tasks', () => import('./pages/TasksPage'))
const LettersPage = lazyWithRecovery('letters', () => import('./pages/LettersPage'))
const TicketsPage = lazyWithRecovery('tickets', () => import('./pages/TicketsPage'))
const SmsPage = lazyWithRecovery('sms', () => import('./pages/SmsPage'))
const FormsPage = lazyWithRecovery('forms', () => import('./pages/FormsPage'))
const ReportsPage = lazyWithRecovery('reports', () => import('./pages/ReportsPage'))
const SettingsPage = lazyWithRecovery('settings', () => import('./pages/SettingsPage'))
const ContactsPage = lazyWithRecovery('contacts', () => import('./pages/ContactsPage'))
const AiPage = lazyWithRecovery('ai', () => import('./pages/AiPage'))
const ProjectsPage = lazyWithRecovery('projects', () => import('./pages/ProjectsPage'))
const ProfilePage = lazyWithRecovery('profile', () => import('./pages/ProfilePage'))
const ChatPage = lazyWithRecovery('chat', () => import('./pages/ChatPage'))
const CalendarPage = lazyWithRecovery('calendar', () => import('./pages/CalendarPage'))
const MainLayout = lazyWithRecovery('layout', () => import('./layouts/MainLayout'))
const ForcePasswordChangePage = lazyWithRecovery('force-password', () => import('./pages/ForcePasswordChangePage'))
const CustomerLoginPage = lazyWithRecovery('customer-login', () => import('./pages/CustomerLoginPage'))
const CustomerPortalPage = lazyWithRecovery('customer-portal', () => import('./pages/CustomerPortalPage'))
const PTMSDashboardPage = lazyWithRecovery('ptms-dashboard', () => import('./pages/ptms/PTMSDashboardPage'))
const PortfolioPage = lazyWithRecovery('portfolio', () => import('./pages/ptms/PortfolioPage'))
const PTMSProjectsPage = lazyWithRecovery('ptms-projects', () => import('./pages/ptms/PTMSProjectsPage'))
const ProjectDetailPage = lazyWithRecovery('project-detail', () => import('./pages/ptms/ProjectDetailPage'))
const MyTasksPage = lazyWithRecovery('my-tasks', () => import('./pages/ptms/MyTasksPage'))
const TasksMainPage = lazyWithRecovery('tasks-main', () => import('./pages/ptms/TasksMainPage'))
const RisksPage = lazyWithRecovery('ptms-risks', () => import('./pages/ptms/RisksPage'))
const FinancialPage = lazyWithRecovery('financial', () => import('./pages/ptms/FinancialPage'))
const IssuesPage = lazyWithRecovery('issues', () => import('./pages/ptms/IssuesPage'))
const ChangesPage = lazyWithRecovery('changes', () => import('./pages/ptms/ChangesPage'))
const PTMSDocumentsPage = lazyWithRecovery('ptms-documents', () => import('./pages/ptms/PTMSDocumentsPage'))
const PerformanceDashboardPage = lazyWithRecovery('performance-dashboard', () => import('./pages/performance/PerformanceDashboardPage'))
const TaskSheetPage = lazyWithRecovery('performance-tasks', () => import('./pages/performance/TaskSheetPage'))
const WeeklyReportPage = lazyWithRecovery('performance-weekly', () => import('./pages/performance/WeeklyReportPage'))
const MonthlyEvaluationPage = lazyWithRecovery('performance-evaluations', () => import('./pages/performance/MonthlyEvaluationPage'))
const PerformanceSettingsPage = lazyWithRecovery('performance-settings', () => import('./pages/performance/PerformanceSettingsPage'))
const QuarterlyReviewPage = lazyWithRecovery('performance-quarterly', () => import('./pages/performance/QuarterlyReviewPage'))
const TimesheetPage = lazyWithRecovery('performance-timesheet', () => import('./pages/performance/TimesheetPage'))

function App() {
  const token = localStorage.getItem('token')
  const mustChangePassword = !!token && localStorage.getItem('force-password-change') === '1'

  return (
    <AppErrorBoundary>
    <Suspense fallback={<div dir="rtl" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'Tahoma,sans-serif', color:'#721052' }}>در حال بارگذاری سامانه...</div>}>
      <Routes>
      {/* مسیرهای مشتری */}
      <Route path="/customer-login" element={<CustomerLoginPage />} />
      <Route path="/customer-portal" element={<CustomerPortalPage />} />

      {/* مسیرهای سیستم داخلی */}
      <Route path="/login" element={<LoginPage />} />

      {token && mustChangePassword ? (
        <>
          <Route path="/change-password" element={<ForcePasswordChangePage />} />
          <Route path="*" element={<Navigate to="/change-password" replace />} />
        </>
      ) : token ? (
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/approvals" element={<TasksPage />} />
          <Route path="/tasks/calendar" element={<CalendarPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks/assigned" element={<TasksPage />} />
          <Route path="/tasks/done" element={<TasksPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/ptms/dashboard" element={<PTMSDashboardPage />} />
          <Route path="/ptms/portfolio" element={<PortfolioPage />} />
          <Route path="/ptms/projects" element={<PTMSProjectsPage />} />
          <Route path="/ptms/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/ptms/tasks/mine" element={<MyTasksPage />} />
          <Route path="/ptms/tasks" element={<TasksMainPage />} />
          <Route path="/ptms/risks" element={<RisksPage />} />
          <Route path="/ptms/financial" element={<FinancialPage />} />
          <Route path="/ptms/issues" element={<IssuesPage />} />
          <Route path="/ptms/changes" element={<ChangesPage />} />
          <Route path="/ptms/documents" element={<PTMSDocumentsPage />} />
          <Route path="/performance/dashboard" element={<PerformanceDashboardPage />} />
          <Route path="/performance/tasks" element={<TaskSheetPage />} />
          <Route path="/performance/weekly" element={<WeeklyReportPage />} />
          <Route path="/performance/evaluations" element={<MonthlyEvaluationPage />} />
          <Route path="/performance/settings" element={<PerformanceSettingsPage />} />
          <Route path="/performance/quarterly" element={<QuarterlyReviewPage />} />
          <Route path="/performance/timesheet" element={<TimesheetPage />} />
          <Route path="/letters" element={<LettersPage />} />
          <Route path="/letters/new" element={<LettersPage />} />
          <Route path="/letters/registry" element={<LettersPage />} />
          <Route path="/letters/registry/incoming" element={<Navigate to="/letters/registry" replace />} />
          <Route path="/letters/registry/outgoing" element={<Navigate to="/letters/registry" replace />} />
          <Route path="/letters/registry/internal" element={<Navigate to="/letters/registry" replace />} />
          <Route path="/letters/referrals" element={<LettersPage />} />
          <Route path="/letters/drafts" element={<LettersPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/users" element={<Navigate to="/settings/users" replace />} />
          <Route path="/sms" element={<SmsPage />} />
          <Route path="/forms" element={<Navigate to="/forms/sent" replace />} />
          <Route path="/forms/inbox" element={<FormsPage />} />
          <Route path="/forms/sent" element={<FormsPage />} />
          <Route path="/forms/approvals" element={<FormsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/company" element={<SettingsPage />} />
          <Route path="/settings/users" element={<SettingsPage />} />
          <Route path="/company" element={<Navigate to="/settings/company" replace />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
      </Routes>
    </Suspense>
    </AppErrorBoundary>
  )
}

export default App
