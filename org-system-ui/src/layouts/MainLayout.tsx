import { useEffect, useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, notification } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined, MailOutlined, CheckSquareOutlined,
  CustomerServiceOutlined, FormOutlined, BarChartOutlined, MessageOutlined,
  UserOutlined, LogoutOutlined, RobotOutlined, SettingOutlined,
  ContactsOutlined, UnorderedListOutlined,
  InboxOutlined, EditOutlined, BookOutlined,
  SwapOutlined,
  FileTextOutlined, SendOutlined, LeftOutlined, RightOutlined, WarningOutlined, TrophyOutlined, CalendarOutlined,
  FieldTimeOutlined, AuditOutlined,
} from '@ant-design/icons'
import NotificationDropdown from '../components/NotificationDropdown'

const { Header, Sider, Content } = Layout

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [user,setUser]=useState<{ roles?: string[]; avatarUrl?: string; fullName?: string }>(()=>JSON.parse(localStorage.getItem('user') || '{}'))
  useEffect(()=>{const sync=()=>setUser(JSON.parse(localStorage.getItem('user')||'{}'));window.addEventListener('profile-updated',sync);return()=>window.removeEventListener('profile-updated',sync)},[])
  useEffect(()=>{const name=sessionStorage.getItem('welcome-user');if(name){sessionStorage.removeItem('welcome-user');notification.success({message:`کاربر ${name}، خوش آمدید`,description:'ورود شما به سامانه با موفقیت انجام شد.',placement:'topLeft'})}},[])
  const serverPermissions: string[] = JSON.parse(localStorage.getItem('permissions') || '[]')
  const isAdmin = Array.isArray(user.roles) && user.roles.includes('Admin')
  const allowed = (code: string) => isAdmin || serverPermissions.includes(code)
  const routeMenuGroup=location.pathname.startsWith('/ptms')?'tasks-group':location.pathname.startsWith('/performance')?'performance-group':location.pathname.startsWith('/letters')?'letters-group':location.pathname.startsWith('/forms')?'forms-group':null
  const [menuOpenState,setMenuOpenState]=useState<{ pathname: string; keys: string[] }>(()=>({ pathname: location.pathname, keys: routeMenuGroup?[routeMenuGroup]:[] }))
  const openMenuKeys = menuOpenState.pathname === location.pathname ? menuOpenState.keys : routeMenuGroup ? [routeMenuGroup] : []
  const settingsLanding=allowed('company.view')?'/settings/company':allowed('users.view')?'/settings/users':'/settings'

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'داشبورد' },
    ...((allowed('letters.inbox.view') || allowed('letters.registry.view') || allowed('letters.registry.internal.view') || allowed('letters.registry.incoming.view') || allowed('letters.registry.outgoing.view')) ? [{
      key: 'letters-group',
      icon: <MailOutlined />,
      label: 'نامه‌نگاری',
      children: [
        ...(allowed('letters.inbox.view') ? [{ key: '/letters', icon: <InboxOutlined />, label: 'کارتابل نامه' }] : []),
        ...(allowed('letters.inbox.view') ? [{ key: '/letters/referrals', icon: <SwapOutlined />, label: 'ارجاعات من' }] : []),
        ...((allowed('letters.type.internal') || allowed('letters.type.outgoing')) ? [{ key: '/letters/drafts', icon: <FileTextOutlined />, label: 'پیش‌نویس‌های من' }] : []),
        ...((allowed('letters.type.internal') || allowed('letters.type.outgoing')) ? [{ key: '/letters/new', icon: <EditOutlined />, label: 'نامه جدید' }] : []),
        ...((allowed('letters.registry.internal.view') || allowed('letters.registry.incoming.view') || allowed('letters.registry.outgoing.view')) ? [{ key: '/letters/registry', icon: <BookOutlined />, label: 'دبیرخانه' }] : []),
      ]
    }] : []),
    ...(allowed('tasks.view') ? [{
      key: 'tasks-group',
      icon: <CheckSquareOutlined />,
      label: 'مدیریت وظایف و پروژه',
      children: [
        { key: '/ptms/dashboard', icon: <DashboardOutlined />, label: 'مدیریت پروژه‌ها' },
        { key: '/ptms/tasks', icon: <UnorderedListOutlined />, label: 'مدیریت وظایف' },
        { key: '/ptms/risks', icon: <WarningOutlined />, label: 'مدیریت ریسک' },
        { key: '/ptms/documents', icon: <FileTextOutlined />, label: 'مستندات' },
      ]
    }] : []),
    ...(allowed('performance.view') ? [{
      key: 'performance-group',
      icon: <TrophyOutlined />,
      label: 'ارزیابی عملکرد',
      children: [
        { key: '/performance/dashboard', icon: <DashboardOutlined />, label: 'داشبورد' },
        { key: '/performance/tasks', icon: <UnorderedListOutlined />, label: 'Task Sheet من' },
        { key: '/performance/weekly', icon: <CalendarOutlined />, label: 'گزارش هفتگی' },
        { key: '/performance/evaluations', icon: <CheckSquareOutlined />, label: 'ارزیابی ماهانه' },
        { key: '/performance/timesheet', icon: <FieldTimeOutlined />, label: 'تایم‌شیت روزانه' },
        { key: '/performance/quarterly', icon: <AuditOutlined />, label: 'ارزیابی فصلی HR' },
        ...(allowed('performance.admin') ? [{ key: '/performance/settings', icon: <SettingOutlined />, label: 'معیارها و تنظیمات' }] : []),
      ]
    }] : []),
    ...(allowed('tickets.view') ? [{ key: '/tickets', icon: <CustomerServiceOutlined />, label: 'تیکت‌ها' }] : []),
    ...(allowed('contacts.view') ? [{ key: '/contacts', icon: <ContactsOutlined />, label: 'مخاطبین' }] : []),
    ...(allowed('sms.view') ? [{ key: '/sms', icon: <MessageOutlined />, label: 'پیامک' }] : []),
    ...(allowed('forms.view') ? [{
      key: 'forms-group', icon: <FormOutlined />, label: 'فرم‌های سازمانی', children: [
        { key: '/forms/inbox', icon: <InboxOutlined />, label: 'کارتابل فرم' },
        { key: '/forms/sent', icon: <SendOutlined />, label: 'ارسالی‌ها' },
        ...(allowed('forms.approve') ? [{ key: '/forms/approvals', icon: <CheckSquareOutlined />, label: 'تأییدات من' }] : []),
      ]
    }] : []),
    ...(allowed('reports.view') ? [{ key: '/reports', icon: <BarChartOutlined />, label: 'گزارشات' }] : []),
    ...(allowed('ai.view') ? [{ key: '/ai', icon: <RobotOutlined />, label: 'دستیار هوشمند' }] : []),
    ...(allowed('chat.view') ? [{ key: '/chat', icon: <MessageOutlined />, label: 'چت داخلی' }] : []),
   // { key: '/org-chart', icon: <ApartmentOutlined />, label: 'چارت سازمانی' },
    ...((allowed('settings.view')||allowed('company.view')||allowed('users.view')) ? [{ key: settingsLanding, icon: <SettingOutlined />, label: 'تنظیمات' }] : []),
  ]

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      '/dashboard': 'داشبورد',
      '/letters': 'کارتابل نامه',
      '/letters/new': 'نامه جدید',
      '/letters/registry': 'دبیرخانه',
      '/letters/referrals': 'ارجاعات من',
      '/letters/drafts': 'پیش‌نویس‌های من',
      '/tickets': 'تیکت‌ها',
      '/contacts': 'مخاطبین',
      '/sms': 'پیامک',
      '/forms': 'فرم‌های سازمانی',
      '/forms/inbox': 'کارتابل فرم',
      '/forms/sent': 'فرم‌های ارسالی',
      '/forms/approvals': 'تأییدات فرم',
      '/reports': 'گزارشات',
      '/ai': 'دستیار هوشمند',
      '/company': 'اطلاعات شرکت',
      '/chat': 'چت داخلی',
      '/users': 'مدیریت کاربران',
      '/settings': 'تنظیمات',
      '/settings/company': 'تنظیمات — اطلاعات شرکت',
      '/settings/users': 'تنظیمات — مدیریت کاربران',
      '/profile': 'پروفایل کاربری',
      '/ptms/dashboard': 'مدیریت پروژه‌ها',
      '/ptms/portfolio': 'سبد پروژه‌ها',
      '/ptms/projects': 'لیست پروژه‌ها',
      '/ptms/tasks/mine': 'وظایف من',
      '/ptms/tasks': 'مدیریت وظایف',
      '/ptms/risks': 'مدیریت ریسک',
      '/ptms/financial': 'مدیریت مالی',
      '/ptms/issues': 'مسائل و مشکلات',
      '/ptms/changes': 'درخواست تغییر',
      '/ptms/documents': 'مستندات پروژه',
      '/performance/dashboard': 'داشبورد ارزیابی عملکرد',
      '/performance/tasks': 'Task Sheet من',
      '/performance/weekly': 'گزارش هفتگی',
      '/performance/evaluations': 'ارزیابی ماهانه',
      '/performance/timesheet': 'تایم‌شیت روزانه',
      '/performance/quarterly': 'ارزیابی فصلی HR',
      '/performance/settings': 'معیارها و تنظیمات ارزیابی',
    }
    return titles[location.pathname] || 'سامانه سازمانی'
  }

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={<div style={{height:48,display:'flex',alignItems:'center',justifyContent:'center',gap:collapsed?0:14}}><img src="/portal-mark.jpg" alt="نشان پرتال" style={{width:collapsed?31:38,height:31,objectFit:'contain',borderRadius:6}}/>{collapsed?<LeftOutlined/>:<RightOutlined/>}</div>}
        style={{ background: '#001529', height: '100vh', overflow: 'hidden', position: 'relative' }}
        width={230}
      >
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'white',
          fontSize: collapsed ? 14 : 15, fontWeight: 700,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '0 8px', textAlign: 'center'
        }}>
          <span style={{fontSize:collapsed?11:13,fontWeight:800,lineHeight:1.6}}>{collapsed?'پرتال':'پرتال مدیریت پروژه پارس'}</span>
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname.startsWith('/settings')?settingsLanding:location.pathname]}
          openKeys={openMenuKeys}
          onOpenChange={keys=>setMenuOpenState({ pathname: location.pathname, keys: keys.length?[String(keys[keys.length-1])]:[] })}
          mode="inline"
          style={{ maxHeight: 'calc(100vh - 112px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}
          items={menuItems}
          onClick={({ key }) => {
            if (!key.includes('group')) navigate(key)
          }}
        />
      </Sider>

      <Layout style={{ height: '100vh', minWidth: 0, overflow: 'hidden' }}>
        <Header style={{
          background: '#fff', padding: '0 24px',
          height: 54, lineHeight: '54px',
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

        <Content style={{ margin: '14px 16px 16px', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
