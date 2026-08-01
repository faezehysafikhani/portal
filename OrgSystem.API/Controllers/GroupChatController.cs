using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Communications;
using OrgSystem.Domain.Entities.Notifications;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/chat/groups"), Authorize, RequirePermission("chat.view")]
public class GroupChatController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private string UserName => User.FindFirst("full_name")?.Value ?? "کاربر";
    private static readonly Regex SafeGroupName = new(@"^[\p{L}\p{M}\p{N}\s\u200c_-]{3,60}$", RegexOptions.Compiled);
    private static readonly Regex Dangerous = new(@"<[^>]+>|javascript\s*:|--|/\*|\*/|;\s*(select|insert|update|delete|drop|alter|exec)|\b(union\s+select|drop\s+table)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var rows = await db.InternalChatGroupMembers.AsNoTracking().Where(x => x.UserId == UserId)
            .OrderByDescending(x => x.Group.Messages.Max(m => (DateTime?)m.CreatedAt) ?? x.Group.CreatedAt)
            .Select(x => new
            {
                x.GroupId,
                x.Group.Name,
                x.Group.OwnerUserId,
                x.IsAdmin,
                MemberCount = x.Group.Members.Count,
                LastMessage = x.Group.Messages.OrderByDescending(m => m.CreatedAt).Select(m => m.Content).FirstOrDefault(),
                LastMessageAt = x.Group.Messages.Max(m => (DateTime?)m.CreatedAt),
                Unread = x.Group.Messages.Count(m => m.SenderUserId != UserId && (x.LastReadAt == null || m.CreatedAt > x.LastReadAt)),
                Members = x.Group.Members.OrderByDescending(m => m.IsAdmin).ThenBy(m => m.CreatedAt).Select(m => new
                {
                    m.UserId,
                    m.IsAdmin,
                    FullName = db.Users.Where(u => u.Id == m.UserId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefault(),
                    Position = db.Users.Where(u => u.Id == m.UserId).Select(u => u.Position).FirstOrDefault()
                })
            }).ToListAsync(ct);
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateChatGroupRequest request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? "";
        if (!SafeGroupName.IsMatch(name) || Dangerous.IsMatch(name)) return BadRequest(new { message = "نام گروه باید بین ۳ تا ۶۰ کاراکتر و فقط شامل حروف، عدد، فاصله، خط تیره یا زیرخط باشد" });
        var requestedIds = (request.MemberUserIds ?? []).Where(x => x != UserId && x != Guid.Empty).Distinct().Take(49).ToList();
        if (requestedIds.Count == 0) return BadRequest(new { message = "حداقل یک همکار را به گروه اضافه کنید" });
        var activeIds = await db.Users.AsNoTracking().Where(x => x.IsActive && requestedIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(ct);
        if (activeIds.Count != requestedIds.Count) return BadRequest(new { message = "یک یا چند عضو انتخاب‌شده معتبر یا فعال نیستند" });

        var group = new InternalChatGroup { Name = name, OwnerUserId = UserId, TenantId = TenantId, CreatedByUserId = UserId };
        db.InternalChatGroups.Add(group);
        db.InternalChatGroupMembers.Add(new InternalChatGroupMember { GroupId = group.Id, UserId = UserId, IsAdmin = true, LastReadAt = DateTime.UtcNow, TenantId = TenantId, CreatedByUserId = UserId });
        foreach (var memberId in activeIds)
        {
            db.InternalChatGroupMembers.Add(new InternalChatGroupMember { GroupId = group.Id, UserId = memberId, TenantId = TenantId, CreatedByUserId = UserId });
            db.Notifications.Add(new Notification { UserId = memberId, Title = $"عضویت در گروه «{name}»", Body = $"{UserName} شما را به گروه چت اضافه کرد", Type = NotificationType.Chat, ActionUrl = $"/chat?group={group.Id}", RelatedEntityId = group.Id.ToString(), RelatedEntityType = "ChatGroup", TenantId = TenantId });
        }
        await db.SaveChangesAsync(ct);
        return Ok(new { group.Id, group.Name, MemberCount = activeIds.Count + 1, message = "گروه با موفقیت ایجاد شد" });
    }

    [HttpGet("{groupId:guid}/messages")]
    public async Task<IActionResult> Messages(Guid groupId, CancellationToken ct)
    {
        var membership = await db.InternalChatGroupMembers.FirstOrDefaultAsync(x => x.GroupId == groupId && x.UserId == UserId, ct);
        if (membership == null) return Forbid();
        membership.LastReadAt = DateTime.UtcNow;
        var notifications = await db.Notifications.Where(x => x.UserId == UserId && x.Type == NotificationType.Chat && x.RelatedEntityType == "ChatGroup" && x.RelatedEntityId == groupId.ToString() && !x.IsRead).ToListAsync(ct);
        foreach (var notification in notifications) { notification.IsRead = true; notification.ReadAt = DateTime.UtcNow; }
        await db.SaveChangesAsync(ct);
        return Ok(await db.InternalChatGroupMessages.AsNoTracking().Where(x => x.GroupId == groupId)
            .OrderByDescending(x => x.CreatedAt).Take(500).OrderBy(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id, x.GroupId, x.SenderUserId, x.Content, x.CreatedAt,
                SenderName = db.Users.Where(u => u.Id == x.SenderUserId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefault(),
                IsMe = x.SenderUserId == UserId
            }).ToListAsync(ct));
    }

    [HttpPost("{groupId:guid}/messages")]
    public async Task<IActionResult> Send(Guid groupId, SendGroupMessageRequest request, CancellationToken ct)
    {
        var content = request.Content?.Trim() ?? "";
        if (content.Length is < 1 or > 2000 || Dangerous.IsMatch(content)) return BadRequest(new { message = "متن پیام معتبر نیست؛ حداکثر ۲۰۰۰ کاراکتر و بدون کد HTML، JavaScript یا SQL مجاز است" });
        var membership = await db.InternalChatGroupMembers.Include(x => x.Group).FirstOrDefaultAsync(x => x.GroupId == groupId && x.UserId == UserId, ct);
        if (membership == null) return Forbid();
        var item = new InternalChatGroupMessage { GroupId = groupId, SenderUserId = UserId, Content = content, TenantId = TenantId, CreatedByUserId = UserId };
        db.InternalChatGroupMessages.Add(item);
        membership.LastReadAt = DateTime.UtcNow;
        var recipients = await db.InternalChatGroupMembers.AsNoTracking().Where(x => x.GroupId == groupId && x.UserId != UserId).Select(x => x.UserId).ToListAsync(ct);
        foreach (var recipientId in recipients)
            db.Notifications.Add(new Notification { UserId = recipientId, Title = $"پیام جدید در «{membership.Group.Name}»", Body = $"{UserName}: {(content.Length > 100 ? content[..100] + "…" : content)}", Type = NotificationType.Chat, ActionUrl = $"/chat?group={groupId}", RelatedEntityId = groupId.ToString(), RelatedEntityType = "ChatGroup", TenantId = TenantId });
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.GroupId, item.SenderUserId, SenderName = UserName, item.Content, item.CreatedAt, IsMe = true });
    }

    [HttpPost("{groupId:guid}/members")]
    public async Task<IActionResult> AddMembers(Guid groupId, AddChatGroupMembersRequest request, CancellationToken ct)
    {
        var group = await db.InternalChatGroups.Include(x => x.Members).FirstOrDefaultAsync(x => x.Id == groupId, ct);
        if (group == null) return NotFound();
        var actor = group.Members.FirstOrDefault(x => x.UserId == UserId);
        if (actor == null || (!actor.IsAdmin && group.OwnerUserId != UserId)) return Forbid();
        var existingIds = group.Members.Select(x => x.UserId).ToHashSet();
        var requestedIds = (request.MemberUserIds ?? []).Where(x => !existingIds.Contains(x)).Distinct().Take(Math.Max(0, 50 - existingIds.Count)).ToList();
        var active = await db.Users.AsNoTracking().Where(x => x.IsActive && requestedIds.Contains(x.Id)).Select(x => new { x.Id }).ToListAsync(ct);
        foreach (var user in active)
        {
            db.InternalChatGroupMembers.Add(new InternalChatGroupMember { GroupId = groupId, UserId = user.Id, TenantId = TenantId, CreatedByUserId = UserId });
            db.Notifications.Add(new Notification { UserId = user.Id, Title = $"عضویت در گروه «{group.Name}»", Body = $"{UserName} شما را به گروه چت اضافه کرد", Type = NotificationType.Chat, ActionUrl = $"/chat?group={group.Id}", RelatedEntityId = group.Id.ToString(), RelatedEntityType = "ChatGroup", TenantId = TenantId });
        }
        await db.SaveChangesAsync(ct);
        return Ok(new { added = active.Count, message = $"{active.Count} عضو اضافه شد" });
    }
}

public record CreateChatGroupRequest(string? Name, List<Guid>? MemberUserIds);
public record SendGroupMessageRequest(string? Content);
public record AddChatGroupMembersRequest(List<Guid>? MemberUserIds);
