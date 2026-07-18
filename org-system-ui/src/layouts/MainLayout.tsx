import { useEffect, useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined, MailOutlined, TeamOutlined, CheckSquareOutlined,
  CustomerServiceOutlined, FormOutlined, BarChartOutlined, MessageOutlined,
  UserOutlined, LogoutOutlined, BellOutlined, RobotOutlined, SettingOutlined,
  BankOutlined, ContactsOutlined, ProjectOutlined, UnorderedListOutlined,
  FolderOutlined, InboxOutlined, EditOutlined, BookOutlined,
  DollarOutlined, WarningOutlined, BugOutlined, SwapOutlined, 
  FileTextOutlined
} from '@ant-design/icons'
import { usePermissionStore } from '../store/permissionStore'
import NotificationDropdown from '../components/NotificationDropdown'

const { Header, Sider, Content } = Layout

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [user,setUser]=useState<any>(()=>JSON.parse(localStorage.getItem('user') || '{}'))
  const [company,setCompany]=useState<{name?:string;logoUrl?:string|null}>(()=>{try{return JSON.parse(localStorage.getItem('company')||'{}')}catch{return {}}})
  useEffect(()=>{const sync=()=>setUser(JSON.parse(localStorage.getItem('user')||'{}'));window.addEventListener('profile-updated',sync);return()=>window.removeEventListener('profile-updated',sync)},[])
  useEffect(()=>{const sync=(event:Event)=>setCompany((event as CustomEvent).detail||{});window.addEventListener('company-updated',sync);return()=>window.removeEventListener('company-updated',sync)},[])
  const { hasPermission } = usePermissionStore()
  const serverPermissions: string[] = JSON.parse(localStorage.getItem('permissions') || '[]')
  const isAdmin = Array.isArray(user.roles) && user.roles.includes('Admin')
  const allowed = (code: string) => isAdmin || serverPermissions.includes(code)

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'داشبورد' },
    ...((allowed('letters.inbox.view') || allowed('letters.registry.view')) ? [{
      key: 'letters-group',
      icon: <MailOutlined />,
      label: 'نامه‌نگاری',
      children: [
        ...(allowed('letters.inbox.view') ? [{ key: '/letters', icon: <InboxOutlined />, label: 'کارتابل نامه' }] : []),
        ...(allowed('letters.create') ? [{ key: '/letters/new', icon: <EditOutlined />, label: 'نامه جدید' }] : []),
        ...(allowed('letters.registry.view') ? [{ key: '/letters/registry', icon: <BookOutlined />, label: 'دبیرخانه' }] : []),
      ]
    }] : []),
    ...(allowed('tasks.view') ? [{
      key: 'tasks-group',
      icon: <CheckSquareOutlined />,
      label: 'مدیریت وظایف و پروژه',
      children: [
        { key: '/ptms/dashboard', icon: <DashboardOutlined />, label: 'داشبورد پروژه‌ها' },
        { key: '/ptms/portfolio', icon: <FolderOutlined />, label: 'سبد پروژه‌ها' },
        { key: '/ptms/projects', icon: <ProjectOutlined />, label: 'لیست پروژه‌ها' },
        { key: '/ptms/tasks/mine', icon: <UserOutlined />, label: 'وظایف من' },
        { key: '/ptms/tasks', icon: <UnorderedListOutlined />, label: 'وظایف' },
        { key: '/ptms/financial', icon: <DollarOutlined />, label: 'مدیریت مالی' },
        { key: '/ptms/risks', icon: <WarningOutlined />, label: 'مدیریت ریسک' },
        { key: '/ptms/issues', icon: <BugOutlined />, label: 'مسائل و مشکلات' },
        { key: '/ptms/changes', icon: <SwapOutlined />, label: 'درخواست تغییر' },
        { key: '/ptms/documents', icon: <FileTextOutlined />, label: 'مستندات' },
        { key: '/ptms/reports', icon: <BarChartOutlined />, label: 'گزارشات پروژه' },
      ]
    }] : []),
    ...(allowed('tickets.view') ? [{ key: '/tickets', icon: <CustomerServiceOutlined />, label: 'تیکت‌ها' }] : []),
    ...(allowed('contacts.view') ? [{ key: '/contacts', icon: <ContactsOutlined />, label: 'مخاطبین' }] : []),
    ...(allowed('sms.view') ? [{ key: '/sms', icon: <MessageOutlined />, label: 'پیامک' }] : []),
    ...(allowed('forms.view') ? [{ key: '/forms', icon: <FormOutlined />, label: 'فرم‌های سازمانی' }] : []),
    ...(allowed('reports.view') ? [{ key: '/reports', icon: <BarChartOutlined />, label: 'گزارشات' }] : []),
    ...(allowed('ai.view') ? [{ key: '/ai', icon: <RobotOutlined />, label: 'دستیار هوشمند' }] : []),
    ...(allowed('chat.view') ? [{ key: '/chat', icon: <MessageOutlined />, label: 'چت داخلی' }] : []),
    ...(allowed('company.view') ? [{ key: '/company', icon: <BankOutlined />, label: 'اطلاعات شرکت' }] : []),
    ...(allowed('users.view') ? [{ key: '/users', icon: <TeamOutlined />, label: 'مدیریت کاربران' }] : []),
   // { key: '/org-chart', icon: <ApartmentOutlined />, label: 'چارت سازمانی' },
    ...(allowed('settings.view') ? [{ key: '/settings', icon: <SettingOutlined />, label: 'تنظیمات' }] : []),
  ]

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      '/dashboard': 'داشبورد',
      '/letters': 'کارتابل نامه',
      '/letters/new': 'نامه جدید',
      '/letters/registry': 'دبیرخانه',
      '/tickets': 'تیکت‌ها',
      '/contacts': 'مخاطبین',
      '/sms': 'پیامک',
      '/forms': 'فرم‌های سازمانی',
      '/reports': 'گزارشات',
      '/ai': 'دستیار هوشمند',
      '/company': 'اطلاعات شرکت',
      '/chat': 'چت داخلی',
      '/users': 'مدیریت کاربران',
      '/settings': 'تنظیمات',
      '/profile': 'پروفایل کاربری',
      '/ptms/dashboard': 'داشبورد پروژه‌ها',
      '/ptms/portfolio': 'سبد پروژه‌ها',
      '/ptms/projects': 'لیست پروژه‌ها',
      '/ptms/tasks/mine': 'وظایف من',
      '/ptms/tasks': 'وظایف',
      '/ptms/financial': 'مدیریت مالی',
      '/ptms/risks': 'مدیریت ریسک',
      '/ptms/issues': 'مسائل و مشکلات',
      '/ptms/changes': 'درخواست تغییر',
      '/ptms/documents': 'مستندات پروژه',
      '/ptms/reports': 'گزارشات پروژه',
    }
    return titles[location.pathname] || 'سامانه سازمانی'
  }

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const defaultOpenKeys =
    location.pathname.startsWith('/ptms')
      ? ['tasks-group']
      : location.pathname.startsWith('/letters')
      ? ['letters-group']
      : []

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#001529' }}
        width={230}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white',
          fontSize: collapsed ? 14 : 15, fontWeight: 700,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '0 8px', textAlign: 'center'
        }}>
          {collapsed ? (
            company.logoUrl ? <img src={company.logoUrl} alt="لوگوی شرکت" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : <span>🏢</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {company.logoUrl ? <img src={company.logoUrl} alt="لوگوی شرکت" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : <span style={{ fontSize: 24 }}>🏢</span>}
              <span style={{ fontSize: 13, fontWeight: 700 }}>{company.name || 'مدیریت پروژه پارس'}</span>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={defaultOpenKeys}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => {
            if (!key.includes('group')) navigate(key)
          }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          position: 'sticky', top: 0, zIndex: 100
        }}>
          {location.pathname !== '/dashboard' && (
                <h3 style={{ margin: 0, color: '#1677ff' }}>{getPageTitle()}</h3>
              )}
              {location.pathname === '/dashboard' && <div />}   
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NotificationDropdown />
            <Dropdown menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: 'پروفایل', onClick: () => navigate('/profile') },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'خروج', danger: true, onClick: logout },
              ]
            }}>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar src={user.avatarUrl} icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                <span>{user.fullName || 'کاربر'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
