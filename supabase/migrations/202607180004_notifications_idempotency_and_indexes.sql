-- Idempotency keys prevent double-clicks and network retries from creating duplicates.
alter table if exists public."Letters"
  add column if not exists "ClientRequestId" uuid null;

alter table if exists public."LetterRecipients"
  add column if not exists "ClientRequestId" uuid null;

create unique index if not exists "UX_Letters_ClientRequestId"
  on public."Letters" ("TenantId", "FromUserId", "ClientRequestId")
  where "ClientRequestId" is not null and "IsDeleted" = false;

create unique index if not exists "UX_LetterReferrals_ClientRequestId"
  on public."LetterRecipients" ("TenantId", "LetterId", "ReferredByUserId", "ClientRequestId")
  where "ClientRequestId" is not null and "RecipientType" = 2 and "IsDeleted" = false;

-- Hot-path indexes for inboxes, badges and chat polling.
create index if not exists "IX_LetterRecipients_User_Inbox"
  on public."LetterRecipients" ("TenantId", "UserId", "IsRead", "CreatedAt" desc)
  where "IsDeleted" = false;

create index if not exists "IX_Notifications_User_Unread"
  on public."Notifications" ("TenantId", "UserId", "IsRead", "CreatedAt" desc)
  where "IsDeleted" = false;

create index if not exists "IX_InternalChatMessages_Sender_CreatedAt"
  on public."InternalChatMessages" ("TenantId", "SenderUserId", "CreatedAt" desc)
  where "IsDeleted" = false;

create index if not exists "IX_InternalChatMessages_Recipient_CreatedAt"
  on public."InternalChatMessages" ("TenantId", "RecipientUserId", "CreatedAt" desc)
  where "IsDeleted" = false;
