using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Letters;

public class Letter : BaseEntity
{
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public LetterType Type { get; set; }
    public LetterStatus Status { get; set; } = LetterStatus.Draft;
    public LetterPriority Priority { get; set; } = LetterPriority.Normal;
    public string Classification { get; set; } = "normal";
    public string? LetterNumber { get; set; }
    public int? LetterCounter { get; set; }
    public string? RegistryId { get; set; }
    public DateTime? LetterDate { get; set; }
    public DateTime? SentAt { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? ReferenceDate { get; set; }
    public string? ReferenceType { get; set; }
    public string? FolderName { get; set; }
    public bool HasAttachment { get; set; } = false;
    public Guid? LetterTemplateId { get; set; }
    public string? TemplateKey { get; set; }
    public string PaperSize { get; set; } = "A4";
    public bool TemplateHasHeader { get; set; } = true;
    public bool TemplateHasFooter { get; set; } = true;

    // فرستنده
    public Guid FromUserId { get; set; }
    public string? FromUserName { get; set; }

    // گیرنده خارجی
    public string? ToExternalName { get; set; }
    public string? ToExternalOrg { get; set; }

    // نامه وارده
    public string? IncomingNumber { get; set; }
    public string? IncomingDate { get; set; }
    public string? IncomingFromOrg { get; set; }

    public ICollection<LetterRecipient> Recipients { get; set; } = new List<LetterRecipient>();
    public ICollection<LetterAttachment> Attachments { get; set; } = new List<LetterAttachment>();
    public ICollection<LetterWorkflowStep> WorkflowSteps { get; set; } = new List<LetterWorkflowStep>();
}

public class LetterRecipient : BaseEntity
{
    public Guid LetterId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? ContactId { get; set; }
    public string? UserName { get; set; }
    public string? ExternalName { get; set; }
    public string? ExternalOrg { get; set; }
    public RecipientType RecipientType { get; set; }
    public string ReferralType { get; set; } = "اصل";
    public string? ReferralText { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime? ReadAt { get; set; }
    public string? PhoneNumber { get; set; }
    public bool SmsRequested { get; set; }
    public string? SmsStatus { get; set; }
    public Guid? ReferredByUserId { get; set; }
    public string? ReferredByName { get; set; }
    public string? ReferredByPosition { get; set; }
    public string? RecipientPosition { get; set; }
    public Letter Letter { get; set; } = null!;
}

public class LetterTemplate : BaseEntity
{
    public string TemplateKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PaperSize { get; set; } = "A4";
    public bool HasHeader { get; set; }
    public bool HasFooter { get; set; }
    public string ImageData { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public bool IsActive { get; set; } = true;
}

public class LetterAttachment : BaseEntity
{
    public Guid LetterId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public Letter Letter { get; set; } = null!;
}

public class LetterWorkflowStep : BaseEntity
{
    public Guid LetterId { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public WorkflowAction Action { get; set; }
    public string? Comment { get; set; }
    public int StepOrder { get; set; }
    public Letter Letter { get; set; } = null!;
}

public enum LetterType { Internal, Incoming, Outgoing }
public enum LetterStatus { Draft, Sent, Received, InReview, Signed, Referred, Archived, Cancelled }
public enum LetterPriority { Low, Normal, High, Urgent }
public enum RecipientType { To, CC, Referral }
public enum WorkflowAction { Created, Sent, Received, Signed, Referred, Archived, Cancelled }
