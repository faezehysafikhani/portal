import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TasksPage from './pages/TasksPage'
import LettersPage from './pages/LettersPage'
import TicketsPage from './pages/TicketsPage'
import UsersPage from './pages/UsersPage'
import SmsPage from './pages/SmsPage'
import FormsPage from './pages/FormsPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import CompanyPage from './pages/CompanyPage'
import ContactsPage from './pages/ContactsPage'
import AiPage from './pages/AiPage'
import ProjectsPage from './pages/ProjectsPage'
import ProfilePage from './pages/ProfilePage'
import ChatPage from './pages/ChatPage'
import CalendarPage from './pages/CalendarPage'
import MainLayout from './layouts/MainLayout'
import CustomerLoginPage from './pages/CustomerLoginPage'
import CustomerPortalPage from './pages/CustomerPortalPage'
import PTMSDashboardPage from './pages/ptms/PTMSDashboardPage'
import PortfolioPage from './pages/ptms/PortfolioPage'
import PTMSProjectsPage from './pages/ptms/PTMSProjectsPage'
import ProjectDetailPage from './pages/ptms/ProjectDetailPage'
import MyTasksPage from './pages/ptms/MyTasksPage'
import TasksMainPage from './pages/ptms/TasksMainPage'
import FinancialPage from './pages/ptms/FinancialPage'
import RisksPage from './pages/ptms/RisksPage'
import IssuesPage from './pages/ptms/IssuesPage'
import ChangesPage from './pages/ptms/ChangesPage'
import PTMSReportsPage from './pages/ptms/PTMSReportsPage'
import PTMSDocumentsPage from './pages/ptms/PTMSDocumentsPage'

function App() {
  const token = localStorage.getItem('token')

  return (
    <Routes>
      {/* مسیرهای مشتری */}
      <Route path="/customer-login" element={<CustomerLoginPage />} />
      <Route path="/customer-portal" element={<CustomerPortalPage />} />

      {/* مسیرهای سیستم داخلی */}
      <Route path="/login" element={<LoginPage />} />

      {token ? (
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
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/sms" element={<SmsPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/company" element={<CompanyPage />} />
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
  )
}

export default App
