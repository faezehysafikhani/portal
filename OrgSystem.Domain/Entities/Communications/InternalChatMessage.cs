using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Communications;

public class InternalChatMessage : BaseEntity
{
    public Guid SenderUserId { get; set; }
    public Guid RecipientUserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public ChatMessageKind Kind { get; set; } = ChatMessageKind.Text;
    public string? AttachmentName { get; set; }
    public string? AttachmentContentType { get; set; }
    public int? AttachmentSize { get; set; }
    public byte[]? AttachmentData { get; set; }
    public int? VoiceDurationSeconds { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}

public enum ChatMessageKind
{
    Text = 0,
    File = 1,
    Voice = 2
}

public class InternalChatGroup : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid OwnerUserId { get; set; }
    public ICollection<InternalChatGroupMember> Members { get; set; } = new List<InternalChatGroupMember>();
    public ICollection<InternalChatGroupMessage> Messages { get; set; } = new List<InternalChatGroupMessage>();
}

public class InternalChatGroupMember : BaseEntity
{
    public Guid GroupId { get; set; }
    public InternalChatGroup Group { get; set; } = null!;
    public Guid UserId { get; set; }
    public bool IsAdmin { get; set; }
    public DateTime? LastReadAt { get; set; }
}

public class InternalChatGroupMessage : BaseEntity
{
    public Guid GroupId { get; set; }
    public InternalChatGroup Group { get; set; } = null!;
    public Guid SenderUserId { get; set; }
    public string Content { get; set; } = string.Empty;
}
