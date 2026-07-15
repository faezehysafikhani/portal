using System.IO.Compression;
using System.Text;
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
    private const int MaxAttachmentBytes = 200 * 1024;
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
            .OrderByDescending(x => x.CreatedAt).Select(x => new { x.SenderUserId, x.RecipientUserId, x.Content, x.Kind, x.AttachmentName, x.CreatedAt, x.IsRead }).ToListAsync(ct);
        return Ok(users.Select(user =>
        {
            var last = messages.FirstOrDefault(x => x.SenderUserId == user.Id || x.RecipientUserId == user.Id);
            var unread = messages.Count(x => x.SenderUserId == user.Id && x.RecipientUserId == UserId && !x.IsRead);
            var lastText = last == null ? null : last.Kind == ChatMessageKind.Voice ? "🎤 پیام صوتی" : last.Kind == ChatMessageKind.File ? $"📎 {last.AttachmentName}" : last.Content;
            return new { user.Id, user.FullName, user.Position, user.Department, user.AvatarUrl, IsOnline = user.LastLoginAt >= DateTime.UtcNow.AddMinutes(-15), LastMessage = lastText, LastMessageAt = last?.CreatedAt, Unread = unread };
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
            .Select(x => new { x.Id, x.SenderUserId, x.RecipientUserId, x.Content, x.Kind, x.AttachmentName, x.AttachmentContentType, x.AttachmentSize, x.VoiceDurationSeconds, HasAttachment = x.AttachmentData != null, x.IsRead, x.ReadAt, x.CreatedAt, IsMe = x.SenderUserId == UserId }).ToListAsync(ct));
    }

    [HttpGet("messages/{messageId:guid}/attachment")]
    public async Task<IActionResult> Attachment(Guid messageId, CancellationToken ct)
    {
        var item = await db.InternalChatMessages.AsNoTracking().Where(x => x.Id == messageId && (x.SenderUserId == UserId || x.RecipientUserId == UserId))
            .Select(x => new { x.AttachmentData, x.AttachmentContentType, x.AttachmentName }).FirstOrDefaultAsync(ct);
        if (item?.AttachmentData == null) return NotFound(new { message = "فایل پیام یافت نشد" });
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers["Cache-Control"] = "private, no-store";
        return File(item.AttachmentData, item.AttachmentContentType ?? "application/octet-stream", item.AttachmentName ?? "attachment", enableRangeProcessing: true);
    }

    [HttpPost("messages"), RequestSizeLimit(400_000)]
    public async Task<IActionResult> Send(ChatSendRequest request, CancellationToken ct)
    {
        var content = request.Content?.Trim() ?? "";
        var requestedKind = request.Kind?.Trim().ToLowerInvariant() ?? "text";
        if (request.RecipientUserId == UserId) return BadRequest(new { message = "ارسال پیام به خودتان مجاز نیست" });
        if (content.Length > 2000 || (content.Length > 0 && Dangerous.IsMatch(content))) return BadRequest(new { message = "متن پیام معتبر نیست؛ ورود کد HTML، JavaScript یا SQL مجاز نیست" });
        if (requestedKind == "text" && content.Length < 1) return BadRequest(new { message = "متن پیام نمی‌تواند خالی باشد" });
        if (requestedKind is not ("text" or "file" or "voice")) return BadRequest(new { message = "نوع پیام معتبر نیست" });

        var recipient = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.RecipientUserId && x.IsActive, ct);
        if (recipient == null) return BadRequest(new { message = "گیرنده معتبر نیست" });

        byte[]? attachmentBytes = null;
        string? attachmentName = null;
        string? contentType = null;
        var kind = requestedKind == "voice" ? ChatMessageKind.Voice : requestedKind == "file" ? ChatMessageKind.File : ChatMessageKind.Text;
        if (kind != ChatMessageKind.Text)
        {
            if (string.IsNullOrWhiteSpace(request.AttachmentData)) return BadRequest(new { message = "فایل پیام ارسال نشده است" });
            try { attachmentBytes = Convert.FromBase64String(request.AttachmentData); }
            catch (FormatException) { return BadRequest(new { message = "محتوای فایل معتبر نیست" }); }
            if (attachmentBytes.Length is < 1 or > MaxAttachmentBytes) return BadRequest(new { message = "حجم فایل باید حداکثر ۲۰۰ کیلوبایت باشد" });
            attachmentName = SafeFileName(request.AttachmentName, kind);
            if (attachmentName == null) return BadRequest(new { message = kind == ChatMessageKind.Voice ? "فرمت پیام صوتی مجاز نیست" : "نام یا فرمت فایل مجاز نیست" });
            if (!TryValidateFile(attachmentBytes, attachmentName, kind, out contentType, out var validationError)) return BadRequest(new { message = validationError });
        }

        var item = new InternalChatMessage
        {
            SenderUserId = UserId, RecipientUserId = recipient.Id, Content = content, Kind = kind,
            AttachmentName = attachmentName, AttachmentContentType = contentType, AttachmentSize = attachmentBytes?.Length,
            AttachmentData = attachmentBytes, VoiceDurationSeconds = kind == ChatMessageKind.Voice ? Math.Clamp(request.VoiceDurationSeconds ?? 0, 0, 60) : null,
            TenantId = TenantId, CreatedByUserId = UserId
        };
        db.InternalChatMessages.Add(item);
        var notificationBody = kind == ChatMessageKind.Voice ? "یک پیام صوتی برای شما ارسال شد" : kind == ChatMessageKind.File ? $"فایل «{attachmentName}» برای شما ارسال شد" : content;
        db.Notifications.Add(new Notification
        {
            UserId = recipient.Id, Title = $"پیام جدید از {UserName}", Body = notificationBody.Length > 120 ? notificationBody[..120] + "…" : notificationBody,
            Type = NotificationType.Chat, ActionUrl = $"/chat?user={UserId}", RelatedEntityId = UserId.ToString(), RelatedEntityType = "Chat", TenantId = TenantId
        });
        await db.SaveChangesAsync(ct);
        return Ok(new { item.Id, item.SenderUserId, item.RecipientUserId, item.Content, item.Kind, item.AttachmentName, item.AttachmentContentType, item.AttachmentSize, item.VoiceDurationSeconds, HasAttachment = item.AttachmentData != null, item.IsRead, item.CreatedAt, IsMe = true });
    }

    private static string? SafeFileName(string? value, ChatMessageKind kind)
    {
        var name = Path.GetFileName(value ?? "").Trim();
        if (name.Length is < 1 or > 120 || name.Any(c => char.IsControl(c) || Path.GetInvalidFileNameChars().Contains(c))) return null;
        var extension = Path.GetExtension(name).ToLowerInvariant();
        var allowed = kind == ChatMessageKind.Voice ? new[] { ".webm", ".ogg", ".mp3", ".wav", ".m4a", ".mp4" } : new[] { ".pdf", ".png", ".jpg", ".jpeg", ".txt", ".docx", ".xlsx" };
        return allowed.Contains(extension) ? name : null;
    }

    private static bool TryValidateFile(byte[] data, string name, ChatMessageKind kind, out string contentType, out string error)
    {
        contentType = "application/octet-stream"; error = "محتوای فایل با پسوند آن مطابقت ندارد";
        var extension = Path.GetExtension(name).ToLowerInvariant();
        bool valid;
        if (kind == ChatMessageKind.Voice)
        {
            valid = extension switch
            {
                ".webm" => Starts(data, 0x1A, 0x45, 0xDF, 0xA3),
                ".ogg" => StartsText(data, "OggS"),
                ".wav" => StartsText(data, "RIFF") && data.Length > 11 && Encoding.ASCII.GetString(data, 8, 4) == "WAVE",
                ".mp3" => StartsText(data, "ID3") || (data.Length > 1 && data[0] == 0xFF && (data[1] & 0xE0) == 0xE0),
                ".m4a" or ".mp4" => data.Length > 11 && Encoding.ASCII.GetString(data, 4, 4) == "ftyp",
                _ => false
            };
            contentType = extension switch { ".webm" => "audio/webm", ".ogg" => "audio/ogg", ".wav" => "audio/wav", ".mp3" => "audio/mpeg", _ => "audio/mp4" };
            if (!valid) error = "محتوای پیام صوتی معتبر نیست";
            return valid;
        }

        valid = extension switch
        {
            ".pdf" => StartsText(data, "%PDF-") && !Encoding.ASCII.GetString(data).Contains("/JavaScript", StringComparison.OrdinalIgnoreCase) && !Encoding.ASCII.GetString(data).Contains("/Launch", StringComparison.OrdinalIgnoreCase),
            ".png" => Starts(data, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
            ".jpg" or ".jpeg" => Starts(data, 0xFF, 0xD8, 0xFF),
            ".txt" => ValidText(data),
            ".docx" => ValidOfficeZip(data, "word/"),
            ".xlsx" => ValidOfficeZip(data, "xl/"),
            _ => false
        };
        contentType = extension switch { ".pdf" => "application/pdf", ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".txt" => "text/plain; charset=utf-8", ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", _ => "application/octet-stream" };
        return valid;
    }

    private static bool ValidText(byte[] data)
    {
        try { var text = new UTF8Encoding(false, true).GetString(data); return !text.Contains('\0') && !Dangerous.IsMatch(text); }
        catch (DecoderFallbackException) { return false; }
    }
    private static bool ValidOfficeZip(byte[] data, string folder)
    {
        try
        {
            using var stream = new MemoryStream(data); using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
            if (!archive.Entries.Any(x => x.FullName == "[Content_Types].xml") || !archive.Entries.Any(x => x.FullName.StartsWith(folder, StringComparison.OrdinalIgnoreCase))) return false;
            return archive.Entries.Sum(x => x.Length) <= 5 * 1024 * 1024;
        }
        catch (InvalidDataException) { return false; }
    }
    private static bool Starts(byte[] data, params byte[] signature) => data.Length >= signature.Length && signature.Select((b, i) => data[i] == b).All(x => x);
    private static bool StartsText(byte[] data, string signature) => data.Length >= signature.Length && Encoding.ASCII.GetString(data, 0, signature.Length) == signature;
}

public record ChatSendRequest(Guid RecipientUserId, string? Content, string? Kind, string? AttachmentName, string? AttachmentData, int? VoiceDurationSeconds);
