import { create } from 'zustand'
import { PERMISSION_GROUPS } from './permissionsConfig'

export interface Role {
  id: string
  name: string
  description: string
  color: string
  isSystem: boolean
  permissions: Record<string, string[]>
  userCount: number
}

interface RolesStore {
  roles: Role[]
  addRole: (role: Role) => void
  updateRole: (id: string, updated: Partial<Role>) => void
  deleteRole: (id: string) => void
}

const INITIAL_ROLES: Role[] = [
  {
    id: '1', name: 'مدیر سیستم', description: 'دسترسی کامل به همه بخش‌ها',
    color: '#8B1A6B', isSystem: true, userCount: 1,
    permissions: Object.fromEntries(
      PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => [p.key, p.actions.map(a => a.key)]))
    )
  },
  {
    id: '2', name: 'کارشناس نامه‌نگاری', description: 'دسترسی به بخش نامه‌نگاری',
    color: '#1677ff', isSystem: false, userCount: 3,
    permissions: {
      letters_inbox: ['view', 'view_own', 'search', 'print'],
      letters_internal: ['view', 'create', 'edit', 'sign', 'send'],
      letters_incoming: ['view', 'register', 'refer'],
      letters_outgoing: ['view', 'create', 'sign', 'send'],
      letters_body: ['view', 'add', 'edit'],
      letters_attachment: ['view', 'add', 'download'],
      letters_related: ['view', 'add'],
      letters_folder: ['view', 'access'],
    }
  },
  {
    id: '3', name: 'مدیر پروژه', description: 'مدیریت کامل پروژه‌ها و وظایف',
    color: '#52c41a', isSystem: false, userCount: 2,
    permissions: {
      ptms_dashboard: ['view', 'manage_events'],
      ptms_portfolio: ['view', 'create', 'edit'],
      ptms_projects: ['view_all', 'create', 'edit', 'change_status'],
      ptms_project_summary: ['view', 'view_financial', 'view_evm'],
      ptms_wbs: ['view', 'create', 'edit', 'delete'],
      ptms_team: ['view', 'add_member', 'edit_member', 'remove_member', 'view_raci'],
      ptms_tasks: ['view_all', 'create', 'edit', 'assign', 'change_status', 'add_comment', 'update_progress'],
      ptms_kanban: ['view', 'move_card', 'create'],
      ptms_calendar: ['view', 'view_all'],
      ptms_overdue: ['view', 'view_all'],
      ptms_financial: ['view', 'view_budget', 'register_cost', 'view_evm'],
      ptms_risks: ['view', 'create', 'edit', 'view_matrix', 'change_status'],
      ptms_issues: ['view', 'create', 'edit', 'resolve', 'assign'],
      ptms_changes: ['view', 'create', 'edit', 'approve', 'reject'],
      ptms_documents: ['view', 'upload', 'download'],
      ptms_charter: ['view', 'edit', 'print'],
      ptms_reports: ['view', 'export_excel', 'print', 'view_analytics'],
    }
  },
  {
    id: '4', name: 'کاربر عادی', description: 'دسترسی محدود به وظایف شخصی',
    color: '#fa8c16', isSystem: false, userCount: 5,
    permissions: {
      ptms_tasks: ['view_own', 'change_status', 'add_comment'],
      ptms_kanban: ['view', 'move_card'],
      ptms_calendar: ['view'],
      letters_inbox: ['view', 'view_own'],
      tickets_main: ['view_own', 'create', 'reply'],
      chat_main: ['view', 'send'],
    }
  },
]

export const useRolesStore = create<RolesStore>((set) => ({
  roles: INITIAL_ROLES,
  addRole: (role) => set(state => ({ roles: [...state.roles, role] })),
  updateRole: (id, updated) => set(state => ({ roles: state.roles.map(r => r.id === id ? { ...r, ...updated } : r) })),
  deleteRole: (id) => set(state => ({ roles: state.roles.filter(r => r.id !== id) })),
}))