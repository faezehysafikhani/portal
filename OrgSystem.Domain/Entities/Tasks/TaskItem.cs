using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Tasks;

public class TaskItem : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ProjectId { get; set; }
    public TaskItemStatus Status { get; set; } = TaskItemStatus.Todo;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public DateTime? DueDate { get; set; }
    public DateTime? StartDate { get; set; }
    public int? EstimatedHours { get; set; }
    public int? ActualHours { get; set; }
    public int Progress { get; set; } = 0;
    public Guid AssignedByUserId { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public Guid? ParentTaskId { get; set; }
    public string? BoardColumn { get; set; }
    public string AssigneeUserIdsJson { get; set; } = "[]";
    public string ProjectIdsJson { get; set; } = "[]";
    public string TagsJson { get; set; } = "[]";
    public bool IsRecurring { get; set; }
    public string? RecurrenceType { get; set; }
    public int RecurrenceInterval { get; set; } = 1;
    public int? RecurrenceWeekday { get; set; }
    public DateTime? RecurrenceEndDate { get; set; }
    public int? RecurrenceCount { get; set; }
    public Guid? RecurrenceSeriesId { get; set; }
    public int RecurrenceSequence { get; set; } = 1;
    public bool RequiresCompletionApproval { get; set; } = true;
    public DateTime? CompletionRequestedAt { get; set; }
    public Guid? CompletionRequestedByUserId { get; set; }
    public bool IsCompletionApproved { get; set; }
    public DateTime? CompletionApprovedAt { get; set; }
    public Guid? CompletionApprovedByUserId { get; set; }

    public TaskItem? ParentTask { get; set; }
    public ICollection<TaskItem> SubTasks { get; set; } = new List<TaskItem>();
    public ICollection<TaskComment> Comments { get; set; } = new List<TaskComment>();
    public ICollection<TaskActivityLog> ActivityLogs { get; set; } = new List<TaskActivityLog>();
}

public class TaskComment : BaseEntity
{
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
}

public class TaskActivityLog : BaseEntity
{
    public Guid TaskId { get; set; }
    public Guid ActorUserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? DetailsJson { get; set; }
    public TaskItem? Task { get; set; }
}

public class TaskSavedView : BaseEntity
{
    public Guid OwnerUserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string FiltersJson { get; set; } = "{}";
}

public enum TaskItemStatus { Todo, InProgress, InReview, Done, Cancelled }
public enum TaskPriority { Low, Medium, High, Critical }
