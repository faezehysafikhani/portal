using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Forms;

public class OrganizationalForm : BaseEntity
{
    public string FormType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public Guid SubmitterUserId { get; set; }
    public string SubmitterName { get; set; } = string.Empty;
    public Guid ManagerUserId { get; set; }
    public string ManagerName { get; set; } = string.Empty;
    public Guid HrUserId { get; set; }
    public string HrName { get; set; } = string.Empty;
    public string Status { get; set; } = "manager_pending";
    public decimal RequestedHours { get; set; }
    public string DataJson { get; set; } = "{}";
    public ICollection<FormWorkflowHistory> History { get; set; } = new List<FormWorkflowHistory>();
}

public class FormWorkflowHistory : BaseEntity
{
    public Guid FormId { get; set; }
    public OrganizationalForm Form { get; set; } = null!;
    public Guid ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public class LeaveAccount : BaseEntity
{
    public Guid UserId { get; set; }
    public int AccruedThroughYearMonth { get; set; }
    public decimal AccruedHours { get; set; }
    public decimal UsedHours { get; set; }
}
