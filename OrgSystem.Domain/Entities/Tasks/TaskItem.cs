using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Tasks;

public class TaskItem : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
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

    public TaskItem? ParentTask { get; set; }
    public ICollection<TaskItem> SubTasks { get; set; } = new List<TaskItem>();
    public ICollection<TaskComment> Comments { get; set; } = new List<TaskComment>();
}

public class TaskComment : BaseEntity
{
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
}

public enum TaskItemStatus { Todo, InProgress, InReview, Done, Cancelled }
public enum TaskPriority { Low, Medium, High, Critical }