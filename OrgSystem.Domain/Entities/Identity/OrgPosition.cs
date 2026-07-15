using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Identity;

public class OrgPosition : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? ParentId { get; set; }
    public string Color { get; set; } = "#8B1A6B";
    public string OrgId { get; set; } = "1";
    public bool IsSystem { get; set; } = false;
}