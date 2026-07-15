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
