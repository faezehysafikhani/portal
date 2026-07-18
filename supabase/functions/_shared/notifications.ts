import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AuthContext } from './auth.ts'
import { HttpError } from './http.ts'

export const notificationType = {
  letter: 0,
  task: 1,
  ticket: 2,
  form: 3,
  system: 4,
  sms: 5,
  chat: 6,
  calendar: 7,
  project: 8,
} as const

interface NotificationInput {
  userId: string | null | undefined
  title: string
  body?: string | null
  type: number
  actionUrl?: string | null
  entityId?: string | null
  entityType?: string | null
}

export async function createNotification(db: SupabaseClient, auth: AuthContext, input: NotificationInput): Promise<void> {
  if (!input.userId || input.userId === auth.userId) return
  const timestamp = new Date().toISOString()
  const result = await db.from('Notifications').insert({
    Id: crypto.randomUUID(), TenantId: auth.tenantId, CreatedAt: timestamp, UpdatedAt: null,
    CreatedByUserId: auth.userId, IsDeleted: false, DeletedAt: null,
    UserId: input.userId, Title: input.title, Body: input.body ?? '', Type: input.type,
    IsRead: false, ReadAt: null, ActionUrl: input.actionUrl ?? null,
    RelatedEntityId: input.entityId ?? null, RelatedEntityType: input.entityType ?? null,
  })
  if (result.error) {
    console.error(result.error.message)
    throw new HttpError(500, 'ثبت اعلان انجام نشد')
  }
}

export async function createNotifications(db: SupabaseClient, auth: AuthContext, userIds: Array<string | null | undefined>, input: Omit<NotificationInput, 'userId'>): Promise<void> {
  await Promise.all([...new Set(userIds.filter(Boolean) as string[])].map(userId => createNotification(db, auth, { ...input, userId })))
}
