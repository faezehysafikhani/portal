using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Sms;

public class SmsMessage : BaseEntity
{
    public string To { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public SmsStatus Status { get; set; } = SmsStatus.Pending;
    public string? Provider { get; set; }
    public string? MessageId { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public decimal? Cost { get; set; }
    public Guid? TemplateId { get; set; }
    public Guid? SentByUserId { get; set; }
}

public class SmsTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? Category { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SmsProviderSetting : BaseEntity
{
    public string ProviderName { get; set; } = "generic";
    public string ApiUrl { get; set; } = string.Empty;
    public string? SenderNumber { get; set; }
    public string EncryptedApiKey { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string EncryptedPassword { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string LetterTemplate { get; set; } = "نامه شماره {number} مورخ {date} با موضوع «{subject}»";
    public string ReferralTemplate { get; set; } = "نامه با موضوع «{subject}» مورخ {date} با ارجاع «{referralType}»";
    public string MeetingTemplate { get; set; } = "دعوت جلسه: {title} - {date} {time}";
}

public enum SmsStatus { Pending, Sent, Delivered, Failed, Cancelled }
