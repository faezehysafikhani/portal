import { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from 'antd'
import { BellOutlined, CheckCircleOutlined, FormOutlined, MessageOutlined, RocketOutlined } from '@ant-design/icons'

const CURRENT_RELEASE = {
  id: '1405-07-06-user-status-fix',
  title: 'تازه‌های پرتال',
  date: '۶ مهر ۱۴۰۵',
  description: 'مدیریت وضعیت کاربران دقیق‌تر شده و چیدمان جدید فرم‌ها نیز در دسترس است.',
  items: [
    { icon: <FormOutlined />, color: '#8B1A6B', title: 'فعال و غیرفعال‌کردن کاربران', text: 'وضعیت انتخاب‌شده اکنون مستقیماً در پایگاه داده ذخیره می‌شود و نشست کاربر غیرفعال‌شده نیز بسته خواهد شد.' },
    { icon: <RocketOutlined />, color: '#1677ff', title: 'کارت‌های خواناتر', text: 'هر فرم اکنون توضیح کوتاه، نشانه مشخص و چیدمان شیشه‌ای هماهنگ با محیط پرتال دارد.' },
    { icon: <BellOutlined />, color: '#fa8c16', title: 'خلاصه مانده مرخصی', text: 'مانده، میزان مصرف، تخصیص ماهانه و درخواست‌های در انتظار به‌صورت کارت‌های خلاصه نمایش داده می‌شوند.' },
    { icon: <MessageOutlined />, color: '#13a8a8', title: 'نمایش بهتر در موبایل', text: 'چیدمان فرم‌ها در صفحه‌های کوچک به‌صورت تک‌ستونه و بدون فشردگی نمایش داده می‌شود.' },
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
