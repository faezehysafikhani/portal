import { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from 'antd'
import { BellOutlined, CheckCircleOutlined, FormOutlined, MessageOutlined, RocketOutlined } from '@ant-design/icons'

const CURRENT_RELEASE = {
  id: '1405-07-06-portal-refresh',
  title: 'تازه‌های پرتال',
  date: '۶ مهر ۱۴۰۵',
  description: 'چند بخش پرکاربرد پرتال برای تجربه‌ای سریع‌تر و مرتب‌تر به‌روزرسانی شده است.',
  items: [
    { icon: <FormOutlined />, color: '#8B1A6B', title: 'ثبت فرم‌ها در کارتابل', text: 'فرم‌های مجاز هر کاربر حالا به‌صورت کارت‌های کوچک و مستقیم در کارتابل فرم در دسترس هستند.' },
    { icon: <RocketOutlined />, color: '#1677ff', title: 'ظاهر تازه فرم‌ها', text: 'کارت‌ها و پنجره ثبت فرم با چیدمان شیشه‌ای، عمق بصری و فاصله‌گذاری بهتر بازطراحی شدند.' },
    { icon: <BellOutlined />, color: '#fa8c16', title: 'اعلان‌های خوانده‌نشده', text: 'اعلان‌های صفحه اصلی و زنگوله به‌صورت خلاصه نمایش داده می‌شوند و پس از مشاهده از فهرست خارج می‌شوند.' },
    { icon: <MessageOutlined />, color: '#13a8a8', title: 'ارسال پیامک آسان‌تر', text: 'ارسال مجدد با امکان اصلاح متن و شماره و ارسال پیامک مستقیم از مخاطبین فراهم شده است.' },
  ],
}

type SignedInUser = { id?: string; username?: string; fullName?: string }

export default function ReleaseNotesModal({ user }: { user: SignedInUser }) {
  const [open, setOpen] = useState(false)
  const userKey = useMemo(() => user.id || user.username || user.fullName || 'unknown-user', [user.id, user.username, user.fullName])
  const storageKey = `portal-release-seen:${userKey}:${CURRENT_RELEASE.id}`

  useEffect(() => {
    if (userKey !== 'unknown-user' && localStorage.getItem(storageKey) !== '1') setOpen(true)
  }, [storageKey, userKey])

  const acknowledge = () => {
    localStorage.setItem(storageKey, '1')
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      onCancel={acknowledge}
      footer={null}
      centered
      width={650}
      maskClosable={false}
      rootClassName="release-notes-modal"
      title={null}
    >
      <div className="release-notes-hero">
        <div className="release-notes-orb"><RocketOutlined /></div>
        <div>
          <div className="release-notes-kicker">به‌روزرسانی جدید</div>
          <h2>{CURRENT_RELEASE.title}</h2>
          <div className="release-notes-date">{CURRENT_RELEASE.date}</div>
        </div>
      </div>
      <p className="release-notes-description">{CURRENT_RELEASE.description}</p>
      <div className="release-notes-list">
        {CURRENT_RELEASE.items.map(item => (
          <div className="release-note-item" key={item.title}>
            <span className="release-note-icon" style={{ color: item.color, background: `${item.color}16` }}>{item.icon}</span>
            <div><b>{item.title}</b><p>{item.text}</p></div>
          </div>
        ))}
      </div>
      <Button type="primary" size="large" block icon={<CheckCircleOutlined />} onClick={acknowledge}>متوجه شدم، شروع کنیم</Button>
    </Modal>
  )
}
