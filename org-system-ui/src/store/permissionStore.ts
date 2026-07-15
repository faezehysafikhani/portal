import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Permission {
  module: string
  actions: string[]
}

export interface Role {
  id: string
  name: string
  description?: string
  permissions: Permission[]
  isSystem?: boolean
}

export interface UserPermission {
  userId: string
  roleId?: string
  customPermissions?: Permission[]
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: '1', name: 'مدیر سیستم', isSystem: true,
    description: 'دسترسی کامل به همه بخش‌ها',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'letters', actions: ['view', 'create', 'approve', 'delete', 'print'] },
      { module: 'tasks', actions: ['view', 'create', 'assign', 'delete'] },
      { module: 'tickets', actions: ['view', 'create', 'assign', 'delete'] },
      { module: 'users', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'sms', actions: ['view', 'send'] },
      { module: 'forms', actions: ['view', 'submit', 'approve', 'design'] },
      { module: 'reports', actions: ['view', 'export'] },
      { module: 'settings', actions: ['view', 'edit'] },
      { module: 'contacts', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'company', actions: ['view', 'edit'] },
      { module: 'ai', actions: ['view'] },
    ]
  },
  {
    id: '2', name: 'مدیر', isSystem: false,
    description: 'دسترسی به اکثر بخش‌ها',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'letters', actions: ['view', 'create', 'approve', 'print'] },
      { module: 'tasks', actions: ['view', 'create', 'assign'] },
      { module: 'tickets', actions: ['view', 'create', 'assign'] },
      { module: 'users', actions: ['view'] },
      { module: 'sms', actions: ['view', 'send'] },
      { module: 'forms', actions: ['view', 'submit', 'approve'] },
      { module: 'reports', actions: ['view', 'export'] },
      { module: 'contacts', actions: ['view', 'create', 'edit'] },
      { module: 'ai', actions: ['view'] },
    ]
  },
  {
    id: '3', name: 'کاربر عادی', isSystem: false,
    description: 'دسترسی محدود',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'letters', actions: ['view', 'create'] },
      { module: 'tasks', actions: ['view', 'create'] },
      { module: 'tickets', actions: ['view', 'create'] },
      { module: 'forms', actions: ['view', 'submit'] },
      { module: 'reports', actions: ['view'] },
      { module: 'contacts', actions: ['view'] },
    ]
  },
]

export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'داشبورد',
  letters: 'نامه‌نگاری',
  tasks: 'وظایف',
  tickets: 'تیکت‌ها',
  users: 'مدیریت کاربران',
  sms: 'پیامک',
  forms: 'فرم‌های سازمانی',
  reports: 'گزارشات',
  settings: 'تنظیمات',
  contacts: 'مخاطبین',
  company: 'اطلاعات شرکت',
  ai: 'دستیار هوشمند',
}

export const ACTION_LABELS: Record<string, string> = {
  view: 'مشاهده',
  create: 'ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
  approve: 'تأیید',
  assign: 'انتساب',
  send: 'ارسال',
  export: 'خروجی',
  submit: 'ثبت',
  design: 'طراحی',
  print: 'چاپ',
}

interface PermissionStore {
  roles: Role[]
  userPermissions: UserPermission[]
  currentUserId: string
  companyMode: 'single' | 'multi'

  setCurrentUser: (userId: string) => void
  addRole: (role: Role) => void
  updateRole: (id: string, role: Partial<Role>) => void
  deleteRole: (id: string) => void
  setUserRole: (userId: string, roleId: string) => void
  setUserCustomPermissions: (userId: string, permissions: Permission[]) => void
  hasPermission: (module: string, action: string) => boolean
  getUserPermissions: (userId: string) => Permission[]
  setCompanyMode: (mode: 'single' | 'multi') => void
}

export const usePermissionStore = create<PermissionStore>()(
  persist(
    (set, get) => ({
      roles: DEFAULT_ROLES,
      userPermissions: [
        { userId: '1', roleId: '1' } // admin
      ],
      currentUserId: '1',
      companyMode: 'single',

      setCurrentUser: (userId) => set({ currentUserId: userId }),

      addRole: (role) => set(state => ({ roles: [...state.roles, role] })),

      updateRole: (id, updatedRole) => set(state => ({
        roles: state.roles.map(r => r.id === id ? { ...r, ...updatedRole } : r)
      })),

      deleteRole: (id) => set(state => ({
        roles: state.roles.filter(r => r.id !== id || r.isSystem)
      })),

      setUserRole: (userId, roleId) => set(state => {
        const existing = state.userPermissions.find(u => u.userId === userId)
        if (existing) {
          return { userPermissions: state.userPermissions.map(u => u.userId === userId ? { ...u, roleId } : u) }
        }
        return { userPermissions: [...state.userPermissions, { userId, roleId }] }
      }),

      setUserCustomPermissions: (userId, permissions) => set(state => {
        const existing = state.userPermissions.find(u => u.userId === userId)
        if (existing) {
          return { userPermissions: state.userPermissions.map(u => u.userId === userId ? { ...u, customPermissions: permissions } : u) }
        }
        return { userPermissions: [...state.userPermissions, { userId, customPermissions: permissions }] }
      }),

      hasPermission: (module, action) => {
        const { roles, userPermissions, currentUserId } = get()
        const userPerm = userPermissions.find(u => u.userId === currentUserId)
        if (!userPerm) return false

        // اگه دسترسی سفارشی داره
        if (userPerm.customPermissions) {
          const mp = userPerm.customPermissions.find(p => p.module === module)
          return mp?.actions.includes(action) || false
        }

        // براساس نقش
        const role = roles.find(r => r.id === userPerm.roleId)
        if (!role) return false
        const mp = role.permissions.find(p => p.module === module)
        return mp?.actions.includes(action) || false
      },

      getUserPermissions: (userId) => {
        const { roles, userPermissions } = get()
        const userPerm = userPermissions.find(u => u.userId === userId)
        if (!userPerm) return []
        if (userPerm.customPermissions) return userPerm.customPermissions
        const role = roles.find(r => r.id === userPerm.roleId)
        return role?.permissions || []
      },

      setCompanyMode: (mode) => set({ companyMode: mode }),
    }),
    { name: 'permission-storage' }
  )
)