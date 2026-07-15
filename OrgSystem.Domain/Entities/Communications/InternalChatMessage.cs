using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Communications;

public class InternalChatMessage : BaseEntity
{
    public Guid SenderUserId { get; set; }
    public Guid RecipientUserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
}
