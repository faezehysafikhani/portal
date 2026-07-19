import { create } from 'zustand'

export type NotificationType = 'letter' | 'task' | 'ticket' | 'form' | 'calendar' | 'project' | 'risk' | 'sms' | 'chat' | 'warning'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  description: string
  date: string
  time: string
  isRead: boolean
  link?: string
  actorUserId?: string
  actorName?: string
  entityType?: string
}

interface NotificationStore {
  notifications: Notification[]
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  deleteNotification: (id: string) => void
  clearAll: () => void
  addNotification: (n: Omit<Notification, 'id' | 'isRead'>) => void
  setNotifications: (items: Notification[]) => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  markAsRead: (id) => set(state => ({ notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n) })),
  markAllAsRead: () => set(state => ({ notifications: state.notifications.map(n => ({ ...n, isRead: true })) })),
  deleteNotification: (id) => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })),
  clearAll: () => set({ notifications: [] }),
  addNotification: (n) => set(state => ({ notifications: [{ ...n, id: Date.now().toString(), isRead: false }, ...state.notifications] })),
  setNotifications: (items) => set({ notifications: items }),
}))
