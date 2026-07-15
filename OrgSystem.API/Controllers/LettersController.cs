using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Letters;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.API.Authorization;
using OrgSystem.Infrastructure.Services;
using System.Globalization;
using OrgSystem.Domain.Entities.Notifications;

namespace OrgSystem.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class LettersController : ControllerBase
{
    private readonly AppDbContext _db; private readonly ISmsGateway _sms;
    public LettersController(AppDbContext db, ISmsGateway sms) { _db = db; _sms = sms; }
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private static string PersianDate(DateTime value) { var p = new PersianCalendar(); return $"{p.GetYear(value):0000}/{p.GetMonth(value):00}/{p.GetDayOfMonth(value):00}"; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? type, [FromQuery] string? status, [FromQuery] string? scope)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        var permissionSet=User.FindAll("permission").Select(x=>x.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var canInbox=User.IsInRole("Admin")||permissionSet.Contains("letters.inbox.view");
        var canRegistry=User.IsInRole("Admin")||permissionSet.Contains("letters.registry.view");
        if(scope=="registry"&&!canRegistry)return Forbid();
        if(scope!="registry"&&!canInbox)return Forbid();

        var query = _db.Letters
            .Include(l => l.Recipients)
            .Include(l => l.Attachments)
            .Include(l => l.WorkflowSteps)
            .AsQueryable();

        // Registry staff can inspect every letter state, including drafts and cancelled letters.
        if (scope != "registry")
            query = query.Where(l => l.FromUserId == userId || l.Recipients.Any(r => r.UserId == userId));

        if (!string.IsNullOrEmpty(type))
        {
            if (type == "Internal") query = query.Where(l => l.Type == LetterType.Internal);
            else if (type == "Incoming") query = query.Where(l => l.Type == LetterType.Incoming);
            else if (type == "Outgoing") query = query.Where(l => l.Type == LetterType.Outgoing);
        }

        if (!string.IsNullOrEmpty(status))
        {
            if (status == "Draft") query = query.Where(l => l.Status == LetterStatus.Draft);
            else if (status == "Sent") query = query.Where(l => l.Status == LetterStatus.Sent);
            else if (status == "Archived") query = query.Where(l => l.Status == LetterStatus.Archived);
        }

        var letters = await query
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new
            {
                l.Id,
                l.Subject,
                l.LetterNumber,
                l.LetterDate,
                Type = l.Type.ToString(),
                Status = l.Status.ToString(),
                Priority = l.Priority.ToString(),
                l.Classification,
                l.FromUserName,
                l.HasAttachment,
                l.ToExternalName,
                l.ToExternalOrg,
                l.IncomingFromOrg,
                l.CreatedAt,
                l.SentAt,
                RecipientCount = l.Recipients.Count,
                IsRead = l.Recipients.Any(r => r.UserId == userId && r.IsRead),
                IsSender = l.FromUserId == userId
            })
            .ToListAsync();

        return Ok(letters);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        if(!User.IsInRole("Admin")&&!User.FindAll("permission").Any(x=>x.Value is "letters.inbox.view" or "letters.registry.view"))return Forbid();

        var letter = await _db.Letters
            .Include(l => l.Recipients)
            .Include(l => l.Attachments)
            .Include(l => l.WorkflowSteps)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (letter == null) return NotFound(new { message = "نامه یافت نشد" });
        var canViewAll = User.IsInRole("Admin") || User.FindAll("permission").Any(x => x.Value == "letters.registry.view");
        if (!canViewAll && letter.FromUserId != userId && !letter.Recipients.Any(r => r.UserId == userId)) return Forbid();

        var recipient = letter.Recipients.FirstOrDefault(r => r.UserId == userId);
        if (recipient != null && !recipient.IsRead)
        {
            recipient.IsRead = true;
            recipient.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        var fallbackTemplateKey = !string.IsNullOrWhiteSpace(letter.TemplateKey)
            ? letter.TemplateKey
            : letter.PaperSize == "A5" ? "official-a5" : "official-a4";
        var template = await _db.LetterTemplates.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == TenantId && !x.IsDeleted &&
                (letter.LetterTemplateId.HasValue ? x.Id == letter.LetterTemplateId : x.TemplateKey == fallbackTemplateKey));
        var sender = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == letter.FromUserId);

        return Ok(new
        {
            letter.Id,
            letter.Subject,
            letter.Body,
            letter.LetterNumber,
            letter.LetterDate,
            Type = letter.Type.ToString(),
            Status = letter.Status.ToString(),
            Priority = letter.Priority.ToString(),
            letter.Classification,
            letter.FromUserId,
            letter.FromUserName,
            SenderPosition = sender?.Position,
            SenderSignatureDataUrl = sender?.SignatureDataUrl,
            letter.ToExternalName,
            letter.ToExternalOrg,
            letter.IncomingNumber,
            letter.IncomingDate,
            letter.IncomingFromOrg,
            letter.ReferenceNumber,
            letter.ReferenceDate,
            letter.ReferenceType,
            letter.FolderName,
            letter.HasAttachment,
            letter.LetterTemplateId,
            letter.TemplateKey,
            letter.PaperSize,
            letter.TemplateHasHeader,
            letter.TemplateHasFooter,
            letter.SentAt,
            letter.CreatedAt,
            Recipients = letter.Recipients.Select(r => new
            {
                r.Id,
                r.UserId,
                r.UserName,
                r.ExternalName,
                r.ExternalOrg,
                RecipientType = r.RecipientType.ToString(),
                ReferralType = r.ReferralType,
                r.ReferralText,
                r.ReferredByUserId,
                r.ReferredByName,
                r.ReferredByPosition,
                r.RecipientPosition,
                r.IsRead,
                r.ReadAt
            }),
            Referrals = letter.Recipients.Where(r => r.RecipientType == RecipientType.Referral)
                .OrderBy(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    r.UserId,
                    r.ContactId,
                    RecipientName = r.UserName ?? r.ExternalName,
                    r.RecipientPosition,
                    r.ReferralType,
                    r.ReferralText,
                    r.ReferredByUserId,
                    r.ReferredByName,
                    r.ReferredByPosition,
                    r.CreatedAt,
                    r.IsRead,
                    r.ReadAt
                }),
            Template = template == null ? null : new
            {
                template.Id,
                template.TemplateKey,
                template.Name,
                template.PaperSize,
                template.HasHeader,
                template.HasFooter,
                template.ImageData,
                template.FileName
            },
            Attachments = letter.Attachments.Select(a => new
            {
                a.Id,
                a.FileName,
                a.FileSize,
                a.ContentType
            }),
            WorkflowSteps = letter.WorkflowSteps.OrderBy(w => w.StepOrder).Select(w => new
            {
                w.Id,
                w.UserId,
                w.UserName,
                Action = w.Action.ToString(),
                w.Comment,
                w.StepOrder,
                w.CreatedAt
            })
        });
    }

    [HttpPost]
    [RequirePermission("letters.create")]
    public async Task<IActionResult> Create([FromBody] CreateLetterRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        var userName = User.FindFirst("full_name")?.Value ?? "کاربر";
        var tenantId = TenantId;
        var permissions = User.FindAll("permission").Select(x => x.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!User.IsInRole("Admin") && request.Status == LetterStatus.Signed && !permissions.Contains("letters.sign")) return Forbid();
        if (!User.IsInRole("Admin") && request.Status == LetterStatus.Sent && !permissions.Contains("letters.send")) return Forbid();

        var count = await _db.Letters
            .CountAsync(l => l.Type == request.Type && l.TenantId == tenantId);

        var prefix = request.Type == LetterType.Internal ? "د" :
                     request.Type == LetterType.Incoming ? "و" : "ص";
        var persianYear = new PersianCalendar().GetYear(DateTime.Now);
        // شماره و تاریخ از اولین ذخیره (حتی پیش‌نویس) تثبیت می‌شوند تا روی قالب و چاپ قابل اتکا باشند.
        var letterNumber = $"{prefix}/{persianYear}/{(count + 1):D4}";

        var letter = new Letter
        {
            Id = Guid.NewGuid(),
            Subject = request.Subject,
            Body = request.Body ?? string.Empty,
            Type = request.Type,
            Status = request.Status,
            Priority = request.Priority,
            Classification = request.Classification ?? "normal",
            LetterNumber = letterNumber,
            LetterCounter = count + 1,
            LetterDate = request.LetterDate ?? DateTime.Now,
            FromUserId = userId,
            FromUserName = userName,
            ToExternalName = request.ToExternalName,
            ToExternalOrg = request.ToExternalOrg,
            IncomingNumber = request.IncomingNumber,
            IncomingDate = request.IncomingDate,
            IncomingFromOrg = request.IncomingFromOrg,
            ReferenceNumber = request.ReferenceNumber,
            ReferenceDate = request.ReferenceDate,
            ReferenceType = request.ReferenceType,
            FolderName = request.FolderName,
            HasAttachment = false,
            LetterTemplateId = request.LetterTemplateId,
            TemplateKey = request.TemplateKey,
            PaperSize = request.PaperSize is "A5" ? "A5" : "A4",
            TemplateHasHeader = request.TemplateHasHeader,
            TemplateHasFooter = request.TemplateHasFooter,
            SentAt = request.Status == LetterStatus.Sent ? DateTime.UtcNow : null,
            TenantId = tenantId
        };

        _db.Letters.Add(letter);

        if (request.Recipients != null)
        {
            foreach (var r in request.Recipients)
            {
                _db.LetterRecipients.Add(new LetterRecipient
                {
                    Id = Guid.NewGuid(),
                    LetterId = letter.Id,
                    UserId = r.UserId,
                    ContactId = r.ContactId,
                    UserName = r.UserName,
                    ExternalName = r.ExternalName,
                    ExternalOrg = r.ExternalOrg,
                    RecipientType = r.RecipientType,
                    ReferralType = r.ReferralType ?? "اصل",
                    ReferralText = r.ReferralText,
                    IsRead = false,
                    PhoneNumber = r.PhoneNumber,
                    SmsRequested = r.SendSms,
                    SmsStatus = r.SendSms ? "pending" : null,
                    TenantId = tenantId
                });
                if (r.UserId.HasValue && r.UserId.Value != userId)
                    _db.Notifications.Add(new Notification { Id=Guid.NewGuid(), UserId=r.UserId.Value, Title=request.Status==LetterStatus.Draft?"پیش‌نویس نامه برای شما ثبت شد":"نامه جدید دریافت شد", Body=$"{letterNumber} — {request.Subject}", Type=NotificationType.Letter, ActionUrl="/letters", RelatedEntityId=letter.Id.ToString(), RelatedEntityType="Letter", TenantId=tenantId });
            }
        }

        _db.LetterWorkflowSteps.Add(new LetterWorkflowStep
        {
            Id = Guid.NewGuid(),
            LetterId = letter.Id,
            UserId = userId,
            UserName = userName,
            Action = WorkflowAction.Created,
            Comment = "ایجاد نامه",
            StepOrder = 1,
            TenantId = tenantId
        });

        if (request.Status == LetterStatus.Sent)
        {
            _db.LetterWorkflowSteps.Add(new LetterWorkflowStep
            {
                Id = Guid.NewGuid(),
                LetterId = letter.Id,
                UserId = userId,
                UserName = userName,
                Action = WorkflowAction.Sent,
                Comment = "ارسال نامه",
                StepOrder = 2,
                TenantId = tenantId
            });
        }

        await _db.SaveChangesAsync();
        var smsSetting = await _db.SmsProviderSettings.FirstOrDefaultAsync(x => x.IsActive);
        foreach (var recipient in request.Recipients?.Where(x => x.SendSms && !string.IsNullOrWhiteSpace(x.PhoneNumber)) ?? [])
        {
            var smsText = (smsSetting?.LetterTemplate ?? "نامه شماره {number} مورخ {date} با موضوع «{subject}»")
                .Replace("{subject}", letter.Subject).Replace("{number}", letter.LetterNumber ?? "بدون شماره")
                .Replace("{date}", PersianDate(letter.LetterDate ?? DateTime.Now));
            var sent = await _sms.SendAsync(recipient.PhoneNumber!, smsText, userId);
            var entity = await _db.LetterRecipients.FirstOrDefaultAsync(x => x.LetterId == letter.Id && x.PhoneNumber == recipient.PhoneNumber);
            if (entity != null) entity.SmsStatus = sent ? "sent" : "failed";
        }
        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = "نامه با موفقیت ثبت شد",
            id = letter.Id,
            letterNumber = letter.LetterNumber
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLetterRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        var userName = User.FindFirst("full_name")?.Value ?? "کاربر";
        var letter = await _db.Letters.Include(l => l.Recipients).Include(l => l.WorkflowSteps).FirstOrDefaultAsync(l => l.Id == id);
        if (letter == null) return NotFound(new { message = "نامه یافت نشد" });
        if (letter.FromUserId != userId && !User.IsInRole("Admin")) return Forbid();
        var previousStatus = letter.Status;
        var permissions=User.FindAll("permission").Select(x=>x.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!User.IsInRole("Admin"))
        {
            var requiredPermission = request.Status switch
            {
                LetterStatus.Signed => "letters.sign",
                LetterStatus.Sent => "letters.send",
                _ => "letters.edit"
            };
            if (!permissions.Contains(requiredPermission)) return Forbid();
        }

        letter.Subject = request.Subject;
        letter.Body = request.Body ?? letter.Body;
        letter.Priority = request.Priority;
        letter.Classification = request.Classification ?? letter.Classification;
        if (request.LetterTemplateId.HasValue) letter.LetterTemplateId = request.LetterTemplateId;
        if (!string.IsNullOrWhiteSpace(request.TemplateKey)) letter.TemplateKey = request.TemplateKey;
        if (request.PaperSize is "A4" or "A5") letter.PaperSize = request.PaperSize;
        if (request.TemplateHasHeader.HasValue) letter.TemplateHasHeader = request.TemplateHasHeader.Value;
        if (request.TemplateHasFooter.HasValue) letter.TemplateHasFooter = request.TemplateHasFooter.Value;
        letter.Status = request.Status;
        if (request.Status == LetterStatus.Sent && letter.SentAt == null)
            letter.SentAt = DateTime.UtcNow;

        if (previousStatus == LetterStatus.Draft && request.Status is LetterStatus.Sent or LetterStatus.Signed)
        {
            var action = request.Status == LetterStatus.Signed ? WorkflowAction.Signed : WorkflowAction.Sent;
            _db.LetterWorkflowSteps.Add(new LetterWorkflowStep { Id=Guid.NewGuid(), LetterId=letter.Id, UserId=userId, UserName=userName, Action=action, Comment=request.Status==LetterStatus.Signed?"پیش‌نویس تأیید و امضا شد":"پیش‌نویس ذخیره و ارسال شد", StepOrder=letter.WorkflowSteps.Count+1, TenantId=TenantId });
            foreach (var recipient in letter.Recipients.Where(x => x.UserId.HasValue && x.UserId != userId))
                _db.Notifications.Add(new Notification { Id=Guid.NewGuid(), UserId=recipient.UserId!.Value, Title=request.Status==LetterStatus.Signed?"نامه امضا شد":"نامه جدید دریافت شد", Body=$"{letter.LetterNumber} — {letter.Subject}", Type=NotificationType.Letter, ActionUrl="/letters", RelatedEntityId=letter.Id.ToString(), RelatedEntityType="Letter", TenantId=TenantId });
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = request.Status==LetterStatus.Signed?"نامه امضا شد":request.Status==LetterStatus.Sent?"نامه ارسال شد":"پیش‌نویس ذخیره شد", letterNumber=letter.LetterNumber, status=letter.Status.ToString() });
    }

    [HttpPost("{id}/refer")]
    [RequirePermission("letters.refer")]
    public async Task<IActionResult> Refer(Guid id, [FromBody] ReferLetterRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        var userName = User.FindFirst("full_name")?.Value ?? "کاربر";
        var tenantId = TenantId;

        var letter = await _db.Letters
            .Include(l => l.Recipients)
            .Include(l => l.WorkflowSteps)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (letter == null) return NotFound(new { message = "نامه یافت نشد" });

        if (!request.ToUserId.HasValue && !request.ToContactId.HasValue)
            return BadRequest(new { message = "گیرنده ارجاع الزامی است" });
        if (string.IsNullOrWhiteSpace(request.ReferralText))
            return BadRequest(new { message = "متن ارجاع الزامی است" });
        if (request.ReferralText.Length > 2000)
            return BadRequest(new { message = "متن ارجاع حداکثر ۲۰۰۰ کاراکتر باشد" });

        var referringUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);
        var targetUser = request.ToUserId.HasValue
            ? await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ToUserId.Value)
            : null;
        var targetContact = request.ToContactId.HasValue
            ? await _db.Contacts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ToContactId.Value)
            : null;
        var recipientName = targetUser?.FullName ?? targetContact?.FullName ?? request.ToUserName;
        if (string.IsNullOrWhiteSpace(recipientName))
            return BadRequest(new { message = "گیرنده ارجاع یافت نشد" });

        _db.LetterRecipients.Add(new LetterRecipient
        {
            Id = Guid.NewGuid(),
            LetterId = letter.Id,
            UserId = request.ToUserId,
            ContactId = request.ToContactId,
            UserName = targetUser != null ? recipientName : null,
            ExternalName = targetContact != null ? recipientName : null,
            ExternalOrg = targetContact?.CompanyName,
            RecipientType = RecipientType.Referral,
            ReferralType = request.ReferralType ?? "جهت اقدام",
            ReferralText = request.ReferralText,
            IsRead = false,
            PhoneNumber = request.PhoneNumber,
            SmsRequested = request.SendSms,
            SmsStatus = request.SendSms ? "pending" : null,
            ReferredByUserId = userId,
            ReferredByName = userName,
            ReferredByPosition = referringUser?.Position,
            RecipientPosition = targetUser?.Position ?? targetContact?.JobTitle,
            TenantId = tenantId
        });
        if (request.ToUserId.HasValue && request.ToUserId.Value != userId)
            _db.Notifications.Add(new Notification { Id=Guid.NewGuid(), UserId=request.ToUserId.Value, Title="نامه به شما ارجاع شد", Body=$"{letter.LetterNumber} — {letter.Subject} — {request.ReferralType ?? "جهت اقدام"}", Type=NotificationType.Letter, ActionUrl="/letters", RelatedEntityId=letter.Id.ToString(), RelatedEntityType="Letter", TenantId=tenantId });

        _db.LetterWorkflowSteps.Add(new LetterWorkflowStep
        {
            Id = Guid.NewGuid(),
            LetterId = letter.Id,
            UserId = userId,
            UserName = userName,
            Action = WorkflowAction.Referred,
            Comment = $"ارجاع به {recipientName}: {request.ReferralText}",
            StepOrder = letter.WorkflowSteps.Count + 1,
            TenantId = tenantId
        });

        letter.Status = LetterStatus.Referred;
        await _db.SaveChangesAsync();
        if (request.SendSms && !string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var smsSetting = await _db.SmsProviderSettings.FirstOrDefaultAsync(x => x.IsActive);
            var smsText = (smsSetting?.ReferralTemplate ?? "نامه با موضوع «{subject}» مورخ {date} با ارجاع «{referralType}»")
                .Replace("{subject}", letter.Subject).Replace("{date}", PersianDate(letter.LetterDate ?? DateTime.Now))
                .Replace("{referralType}", request.ReferralType ?? "جهت اقدام");
            await _sms.SendAsync(request.PhoneNumber, smsText, userId);
        }

        return Ok(new
        {
            message = "نامه با موفقیت ارجاع داده شد",
            referral = new
            {
                recipientName,
                recipientPosition = targetUser?.Position ?? targetContact?.JobTitle,
                referredByName = userName,
                referredByPosition = referringUser?.Position,
                referralType = request.ReferralType ?? "جهت اقدام",
                request.ReferralText
            }
        });
    }

    [HttpPatch("{id}/archive")]
    [RequirePermission("letters.archive")]
    public async Task<IActionResult> Archive(Guid id)
    {
        var letter = await _db.Letters.FirstOrDefaultAsync(l => l.Id == id);
        if (letter == null) return NotFound(new { message = "نامه یافت نشد" });
        letter.Status = LetterStatus.Archived;
        await _db.SaveChangesAsync();
        return Ok(new { message = "نامه بایگانی شد" });
    }

    [HttpPatch("{id}/sign")]
    [RequirePermission("letters.sign")]
    public async Task<IActionResult> Sign(Guid id)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        var userName = User.FindFirst("full_name")?.Value ?? "کاربر";
        var tenantId = TenantId;

        var letter = await _db.Letters
            .Include(l => l.WorkflowSteps)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (letter == null) return NotFound(new { message = "نامه یافت نشد" });

        letter.Status = LetterStatus.Signed;

        _db.LetterWorkflowSteps.Add(new LetterWorkflowStep
        {
            Id = Guid.NewGuid(),
            LetterId = letter.Id,
            UserId = userId,
            UserName = userName,
            Action = WorkflowAction.Signed,
            Comment = "امضا شد",
            StepOrder = letter.WorkflowSteps.Count + 1,
            TenantId = tenantId
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "نامه امضا شد" });
    }

    [HttpDelete("{id}")]
    [RequirePermission("letters.delete")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var letter = await _db.Letters.FirstOrDefaultAsync(l => l.Id == id);
        if (letter == null) return NotFound(new { message = "نامه یافت نشد" });
        _db.Letters.Remove(letter);
        await _db.SaveChangesAsync();
        return Ok(new { message = "نامه حذف شد" });
    }
}

public record CreateLetterRequest(
    string Subject,
    string? Body,
    LetterType Type,
    LetterStatus Status,
    LetterPriority Priority,
    string? Classification,
    DateTime? LetterDate,
    string? ToExternalName,
    string? ToExternalOrg,
    string? IncomingNumber,
    string? IncomingDate,
    string? IncomingFromOrg,
    string? ReferenceNumber,
    string? ReferenceDate,
    string? ReferenceType,
    string? FolderName,
    List<RecipientRequest>? Recipients,
    Guid? LetterTemplateId = null,
    string? TemplateKey = null,
    string? PaperSize = "A4",
    bool TemplateHasHeader = true,
    bool TemplateHasFooter = true
);

public record UpdateLetterRequest(
    string Subject,
    string? Body,
    LetterPriority Priority,
    string? Classification,
    LetterStatus Status,
    Guid? LetterTemplateId = null,
    string? TemplateKey = null,
    string? PaperSize = null,
    bool? TemplateHasHeader = null,
    bool? TemplateHasFooter = null
);

public record RecipientRequest(
    Guid? UserId,
    string? UserName,
    string? ExternalName,
    string? ExternalOrg,
    RecipientType RecipientType,
    string? ReferralType,
    string? ReferralText
    ,Guid? ContactId
    ,string? PhoneNumber
    ,bool SendSms
);

public record ReferLetterRequest(
    Guid? ToUserId,
    string? ToUserName,
    string? ReferralType,
    string? ReferralText,
    Guid? ToContactId,
    string? PhoneNumber,
    bool SendSms
);
