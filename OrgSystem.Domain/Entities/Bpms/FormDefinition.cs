using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Bpms;

public class FormDefinition : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SchemaJson { get; set; } = string.Empty;
    public string? WorkflowJson { get; set; }
    public FormCategory Category { get; set; }
    public bool IsActive { get; set; } = true;
    public int Version { get; set; } = 1;

    public ICollection<FormInstance> Instances { get; set; } = new List<FormInstance>();
}

public class FormInstance : BaseEntity
{
    public Guid FormDefinitionId { get; set; }
    public string DataJson { get; set; } = string.Empty;
    public FormInstanceStatus Status { get; set; } = FormInstanceStatus.Draft;
    public int CurrentStep { get; set; } = 0;
    public string? RejectionReason { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid SubmittedByUserId { get; set; }

    public FormDefinition FormDefinition { get; set; } = null!;
    public ICollection<FormApprovalStep> ApprovalSteps { get; set; } = new List<FormApprovalStep>();
}

public class FormApprovalStep : BaseEntity
{
    public Guid FormInstanceId { get; set; }
    public Guid ApproverId { get; set; }
    public int StepOrder { get; set; }
    public string StepName { get; set; } = string.Empty;
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public string? Comment { get; set; }
    public DateTime? ActionAt { get; set; }
}

public enum FormCategory { Leave, Loan, Purchase, HR, IT, Other }
public enum FormInstanceStatus { Draft, Submitted, InReview, Approved, Rejected }
public enum ApprovalStatus { Pending, Approved, Rejected, Skipped }