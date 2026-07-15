import { useEffect, useState } from 'react'
import { Badge, Popover, Button, List, Tag, Space, Tabs, Switch, Divider, Empty, Avatar } from 'antd'
import { BellOutlined, MailOutlined, CheckSquareOutlined, CustomerServiceOutlined, FormOutlined, CalendarOutlined, WarningOutlined, MessageOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'
import type { Notification, NotificationType } from '../store/notificationStore'

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; label: string }> = {
  letter: { icon: <MailOutlined />, color: '#8B1A6B', label: 'نامه' },
  task: { icon: <CheckSquareOutlined />, color: '#1677ff', label: 'وظیفه' },
  ticket: { icon: <CustomerServiceOutlined />, color: '#fa8c16', label: 'تیکت' },
  form: { icon: <FormOutlined />, color: '#52c41a', label: 'فرم' },
  calendar: { icon: <CalendarOutlined />, color: '#722ed1', label: 'تقویم' },
  risk: { icon: <WarningOutlined />, color: '#f5222d', label: 'ریسک' },
  chat: { icon: <MessageOutlined />, color: '#13c2c2', label: 'چت' },
  warning: { icon: <WarningOutlined />, color: '#fa8c16', label: 'هشدار' },
}

// تنظیمات اعلان
const NOTIFICATION_SETTINGS = [
  { key: 'letter', label: 'نامه‌های جدید', icon: '📧' },
  { key: 'task', label: 'وظایف جدید و مهلت‌ها', icon: '✅' },
  { key: 'ticket', label: 'تیکت‌های جدید و پاسخ‌ها', icon: '🎫' },
  { key: 'form', label: 'فرم‌های در انتظار تأیید', icon: '📋' },
  { key: 'calendar', label: 'یادآوری رویدادها', icon: '📅' },
  { key: 'risk', label: 'ریسک‌های بحرانی', icon: '⚠️' },
  { key: 'chat', label: 'پیام‌های چت', icon: '💬' },
  { key: 'warning', label: 'هشدارهای سیستم', icon: '🔔' },
]

function NotificationItem({ notification, onRead, onDelete }: {
  notification: Notification
  onRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const config = TYPE_CONFIG[notification.type]

  return (
    <div
      style={{
        display: 'flex', gap: 10, padding: '10px 12px',
        background: notification.isRead ? 'white' : '#f0f7ff',
        borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
        transition: 'background 0.2s',
        borderRight: notification.isRead ? 'none' : `3px solid ${config.color}`,
      }}
      onClick={() => { onRead(notification.id); if (notification.link) navigate(notification.link) }}
    >
      <Avatar
        size={36}
        icon={config.icon}
        style={{ background: `${config.color}22`, color: config.color, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontWeight: notification.isRead ? 400 : 600, fontSize: 13, lineHeight: 1.4 }}>{notification.title}</div>
          {!notification.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: config.color, flexShrink: 0, marginTop: 4 }} />}
        </div>
        <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notification.description}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <Tag color={config.color} style={{ fontSize: 9, margin: 0 }}>{config.label}</Tag>
          <span style={{ fontSize: 10, color: '#bbb' }}>{notification.date} {notification.time}</span>
        </div>
      </div>
      <Button
        size="small" type="text" danger icon={<DeleteOutlined />}
        style={{ flexShrink: 0, opacity: 0.5 }}
        onClick={e => { e.stopPropagation(); onDelete(notification.id) }}
      />
    </div>
  )
}

export default function NotificationDropdown() {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, clearAll, setNotifications } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_SETTINGS.map(s => [s.key, true]))
  )

  const unreadCount = notifications.filter(n => !n.isRead).length
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
  const loadNotifications = async () => { const r=await fetch('http://localhost:5043/api/v1/notifications',{headers}); if(r.ok){const rows=await r.json();setNotifications(rows.map((n:any)=>({id:n.id,type:String(n.type).toLowerCase()==='system'?'warning':String(n.type).toLowerCase(),title:n.title,description:n.body,date:new Intl.DateTimeFormat('fa-IR').format(new Date(n.createdAt)),time:new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit'}).format(new Date(n.createdAt)),isRead:n.isRead,link:n.actionUrl})))} }
  useEffect(()=>{loadNotifications();const timer=setInterval(loadNotifications,30000);return()=>clearInterval(timer)},[])
  const readOne=(id:string)=>{markAsRead(id);fetch(`http://localhost:5043/api/v1/notifications/${id}/read`,{method:'PATCH',headers})}
  const readAll=()=>{markAllAsRead();fetch('http://localhost:5043/api/v1/notifications/read-all',{method:'PATCH',headers})}
  const removeOne=(id:string)=>{deleteNotification(id);fetch(`http://localhost:5043/api/v1/notifications/${id}`,{method:'DELETE',headers})}
  const removeAll=()=>{clearAll();fetch('http://localhost:5043/api/v1/notifications',{method:'DELETE',headers})}
  const unreadNotifications = notifications.filter(n => !n.isRead)
  const readNotifications = notifications.filter(n => n.isRead)

  const content = (
    <div style={{ width: 380, maxHeight: 520, display: 'flex', flexDirection: 'column' }}>
      {/* هدر */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Space>
          <span style={{ fontWeight: 700, fontSize: 15 }}>اعلان‌ها</span>
          {unreadCount > 0 && <Tag color="#8B1A6B">{unreadCount} جدید</Tag>}
        </Space>
        <Space>
          {unreadCount > 0 && (
            <Button size="small" icon={<CheckOutlined />} onClick={readAll}>
              همه خوانده شد
            </Button>
          )}
          {notifications.length > 0 && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={removeAll}>
              پاک کردن
            </Button>
          )}
        </Space>
      </div>

      {/* محتوا */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Tabs
          size="small"
          style={{ padding: '0 8px' }}
          items={[
            {
              key: '1',
              label: <span>همه <Badge count={notifications.length} size="small" /></span>,
              children: (
                <div>
                  {notifications.length === 0 ? (
                    <Empty description="اعلانی وجود ندارد" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 30 }} />
                  ) : (
                    notifications.map(n => (
                      <NotificationItem key={n.id} notification={n} onRead={readOne} onDelete={removeOne} />
                    ))
                  )}
                </div>
              )
            },
            {
              key: '2',
              label: <span>خوانده نشده <Badge count={unreadCount} size="small" style={{ background: '#8B1A6B' }} /></span>,
              children: (
                <div>
                  {unreadNotifications.length === 0 ? (
                    <Empty description="همه اعلان‌ها خوانده شده‌اند" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 30 }} />
                  ) : (
                    unreadNotifications.map(n => (
                      <NotificationItem key={n.id} notification={n} onRead={readOne} onDelete={removeOne} />
                    ))
                  )}
                </div>
              )
            },
            {
              key: '3',
              label: '⚙️ تنظیمات',
              children: (
                <div style={{ padding: '8px 4px' }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12, padding: '0 8px' }}>
                    انتخاب کنید کدام اعلان‌ها را دریافت کنید:
                  </div>
                  {NOTIFICATION_SETTINGS.map(s => (
                    <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 8px', borderBottom: '1px solid #f5f5f5' }}>
                      <Space>
                        <span style={{ fontSize: 16 }}>{s.icon}</span>
                        <span style={{ fontSize: 13 }}>{s.label}</span>
                      </Space>
                      <Switch
                        size="small"
                        checked={settings[s.key]}
                        onChange={v => setSettings(prev => ({ ...prev, [s.key]: v }))}
                        style={{ background: settings[s.key] ? '#8B1A6B' : undefined }}
                      />
                    </div>
                  ))}
                </div>
              )
            },
          ]}
        />
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      arrow={false}
      styles={{ root: { padding: 0, borderRadius: 12, overflow: 'hidden' } }}
    >
      <Badge count={unreadCount} size="small" style={{ background: '#8B1A6B' }}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: 20, color: unreadCount > 0 ? '#8B1A6B' : '#555' }} />}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Badge>
    </Popover>
  )
}
