using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Communications;
using OrgSystem.Domain.Entities.Notifications;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/chat"), Authorize, RequirePermission("chat.view")]
public class ChatController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private string UserName => User.FindFirst("full_name")?.Value ?? "کاربر";
    private static readonly Regex Dangerous = new(@"<[^>]+>|javascript\s*:|--|/\*|\*/|;\s*(select|insert|update|delete|drop|alter|exec)|\b(union\s+select|drop\s+table)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking().Where(x => x.IsActive && x.Id != UserId)
            .OrderBy(x => x.FirstName).Select(x => new { x.Id, x.FullName, x.Position, x.Department, x.AvatarUrl, x.LastLoginAt }).ToListAsync(ct);
        var messages = await db.InternalChatMessages.AsNoTracking()
            .Where(x => x.SenderUserId == UserId || x.RecipientUserId == UserId)
            .OrderByDescending(x => x.CreatedAt).Select(x => new { x.SenderUserId, x.RecipientUserId, x.Content, x.CreatedAt, x.IsRead }).ToListAsync(ct);
        return Ok(users.Select(user =>
        {
            var last = messages.FirstOrDefault(x => x.SenderUserId == user.Id || x.RecipientUserId == user.Id);
            var unread = messages.Count(x => x.SenderUserId == user.Id && x.RecipientUserId == UserId && !x.IsRead);
            return new { user.Id, user.FullName, user.Position, user.Department, user.AvatarUrl, IsOnline = user.LastLoginAt >= DateTime.UtcNow.AddMinutes(-15), LastMessage = last?.Content, LastMessageAt = last?.CreatedAt, Unread = unread };
        }));
    }

    [HttpGet("messages/{otherUserId:guid}")]
    public async Task<IActionResult> Messages(Guid otherUserId, CancellationToken ct)
    {
        if (!await db.Users.AnyAsync(x => x.Id == otherUserId && x.IsActive, ct)) return NotFound(new { message = "کاربر یافت نشد" });
        var incoming = await db.InternalChatMessages.Where(x => x.SenderUserId == otherUserId && x.RecipientUserId == UserId && !x.IsRead).ToListAsync(ct);
        foreach (var item in incoming) { item.IsRead = true; item.ReadAt = DateTime.UtcNow; }
        var chatNotifications = await db.Notifications.Where(x => x.UserId == UserId && x.Type == NotificationType.Chat && x.RelatedEntityId == otherUserId.ToString() && !x.IsRead).ToListAsync(ct);
        foreach (var item in chatNotifications) { item.IsRead = true; item.ReadAt = DateTime.UtcNow; }
        if (incoming.Count > 0 || chatNotifications.Count > 0) await db.SaveChangesAsync(ct);
        return Ok(await db.InternalChatMessages.AsNoTracking()
            .Where(x => (x.SenderUserId == UserId && x.RecipientUserId == otherUserId) || (x.SenderUserId == otherUserId && x.RecipientUserId == UserId))
            .OrderBy(x => x.CreatedAt).Take(500)
            .Select(x => new { x.Id, x.SenderUserId, x.RecipientUserId, x.Content, x.IsRead, x.ReadAt, x.CreatedAt, IsMe = x.SenderUserId == UserId }).ToListAsync(ct));
    }

    [HttpPost("messages")]
    public async Task<IActionResult> Send(ChatSendRequest request, CancellationToken ct)
    {
        var content = request.Content?.Trim() ?? "";
        if (request.RecipientUserId == UserId) return BadRequest(new { message = "ارسال پیام به خودتان مجاز نیست" });
        if (content.Length is < 1 or > 2000) return BadRequest(new { message = "متن پیام باید بین ۱ تا ۲۰۰۰ کاراکتر باشد" });
        if (Dangerous.IsMatch(content)) return BadRequest(new { message = "ورود کد HTML، JavaScript یا SQL در پیام مجاز نیست" });
        var recipient = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.RecipientUserId && x.IsActive, ct);
        if (recipient == null) return BadRequest(new { message = "گیرنده معتبر نیست" });
        var item = new InternalChatMessage { SenderUserId = UserId, RecipientUserId = recipient.Id, Content = content, TenantId = TenantId, CreatedByUserId = UserId };
        db.InternalChatMessages.Add(item);
        db.Notifications.Add(new Notification
        {
            UserId = recipient.Id, Title = $"پیام جدید از {UserName}", Body = content.Length > 120 ? content[..120] + "…" : content,
            Type = NotificationType.Chat, ActionUrl = $"/chat?user={UserId}", RelatedEntityId = UserId.ToString(), RelatedEntityType = "Chat", TenantId = TenantId
        });
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.SenderUserId, item.RecipientUserId, item.Content, item.IsRead, item.CreatedAt, IsMe = true });
    }
}

public record ChatSendRequest(Guid RecipientUserId, string? Content);
