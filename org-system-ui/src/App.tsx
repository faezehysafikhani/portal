import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const LettersPage = lazy(() => import('./pages/LettersPage'))
const TicketsPage = lazy(() => import('./pages/TicketsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SmsPage = lazy(() => import('./pages/SmsPage'))
const FormsPage = lazy(() => import('./pages/FormsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CompanyPage = lazy(() => import('./pages/CompanyPage'))
const ContactsPage = lazy(() => import('./pages/ContactsPage'))
const AiPage = lazy(() => import('./pages/AiPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const MainLayout = lazy(() => import('./layouts/MainLayout'))
const ForcePasswordChangePage = lazy(() => import('./pages/ForcePasswordChangePage'))
const CustomerLoginPage = lazy(() => import('./pages/CustomerLoginPage'))
const CustomerPortalPage = lazy(() => import('./pages/CustomerPortalPage'))
const PTMSDashboardPage = lazy(() => import('./pages/ptms/PTMSDashboardPage'))
const PortfolioPage = lazy(() => import('./pages/ptms/PortfolioPage'))
const PTMSProjectsPage = lazy(() => import('./pages/ptms/PTMSProjectsPage'))
const ProjectDetailPage = lazy(() => import('./pages/ptms/ProjectDetailPage'))
const MyTasksPage = lazy(() => import('./pages/ptms/MyTasksPage'))
const TasksMainPage = lazy(() => import('./pages/ptms/TasksMainPage'))
const FinancialPage = lazy(() => import('./pages/ptms/FinancialPage'))
const RisksPage = lazy(() => import('./pages/ptms/RisksPage'))
const IssuesPage = lazy(() => import('./pages/ptms/IssuesPage'))
const ChangesPage = lazy(() => import('./pages/ptms/ChangesPage'))
const PTMSReportsPage = lazy(() => import('./pages/ptms/PTMSReportsPage'))
const PTMSDocumentsPage = lazy(() => import('./pages/ptms/PTMSDocumentsPage'))

function App() {
  const token = localStorage.getItem('token')
  const mustChangePassword = !!token && localStorage.getItem('force-password-change') === '1'

  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'sans-serif' }}>در حال بارگذاری...</div>}>
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
          <Route path="/ptms/financial" element={<FinancialPage />} />
          <Route path="/ptms/risks" element={<RisksPage />} />
          <Route path="/ptms/issues" element={<IssuesPage />} />
          <Route path="/ptms/changes" element={<ChangesPage />} />
          <Route path="/ptms/documents" element={<PTMSDocumentsPage />} />
          <Route path="/ptms/reports" element={<PTMSReportsPage />} />
          <Route path="/letters" element={<LettersPage />} />
          <Route path="/letters/new" element={<LettersPage />} />
          <Route path="/letters/registry" element={<LettersPage />} />
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
  )
}

export default App
