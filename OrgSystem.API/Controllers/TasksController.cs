using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Tasks;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/tasks"), Authorize]
[RequirePermission("tasks.view")]
public class TasksController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private bool CanManage => User.IsInRole("Admin") || User.FindAll("permission").Any(x => x.Value == "tasks.assign");

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? scope, [FromQuery] TaskItemStatus? status,
        [FromQuery] string? projectId, [FromQuery] DateTime? startFrom, [FromQuery] DateTime? startTo,
        [FromQuery] DateTime? dueFrom, [FromQuery] DateTime? dueTo, CancellationToken ct)
    {
        var userToken = UserId.ToString();
        var q = db.Tasks.AsNoTracking().AsQueryable();
        if (!CanManage)
            q = scope == "assigned"
                ? q.Where(x => x.AssignedByUserId == UserId)
                : q.Where(x => x.AssignedToUserId == UserId || x.AssignedByUserId == UserId || x.AssigneeUserIdsJson.Contains(userToken));
        if (status.HasValue) q = q.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(projectId)) q = q.Where(x => x.ProjectId == projectId || x.ProjectIdsJson.Contains($"\"{projectId}\""));
        if (startFrom.HasValue) q = q.Where(x => x.StartDate >= startFrom);
        if (startTo.HasValue) q = q.Where(x => x.StartDate <= startTo);
        if (dueFrom.HasValue) q = q.Where(x => x.DueDate >= dueFrom);
        if (dueTo.HasValue) q = q.Where(x => x.DueDate <= dueTo);
        var items = await q.OrderBy(x => x.DueDate).ToListAsync(ct);
        if (!CanManage)
            items = items.Where(x => !(x.IsCompletionApproved && x.AssignedByUserId != UserId && ParseGuids(x.AssigneeUserIdsJson).Contains(UserId))).ToList();
        return Ok(items.Select(ToDto));
    }

    [HttpGet("views")]
    public async Task<IActionResult> Views(CancellationToken ct) => Ok((await db.TaskSavedViews.AsNoTracking()
        .Where(x => x.OwnerUserId == UserId).OrderBy(x => x.CreatedAt).ToListAsync(ct)).Select(ToViewDto));

    [HttpPost("views")]
    public async Task<IActionResult> SaveView(SaveTaskViewRequest request, CancellationToken ct)
    {
        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length is < 1 or > 80) return BadRequest(new { message = "نام نما باید بین ۱ تا ۸۰ نویسه باشد" });
        var existing = await db.TaskSavedViews.FirstOrDefaultAsync(x => x.OwnerUserId == UserId && x.Name == name, ct);
        if (existing == null)
        {
            existing = new TaskSavedView { TenantId = TenantId, OwnerUserId = UserId, Name = name, FiltersJson = JsonSerializer.Serialize(request.Filters) };
            db.TaskSavedViews.Add(existing);
        }
        else
        {
            existing.FiltersJson = JsonSerializer.Serialize(request.Filters);
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);
        return Ok(ToViewDto(existing));
    }

    [HttpDelete("views/{id:guid}")]
    public async Task<IActionResult> DeleteView(Guid id, CancellationToken ct)
    {
        var view = await db.TaskSavedViews.FirstOrDefaultAsync(x => x.Id == id && x.OwnerUserId == UserId, ct);
        if (view == null) return NotFound();
        view.IsDeleted = true; view.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/logs")]
    public async Task<IActionResult> Logs(Guid id, CancellationToken ct)
    {
        var task = await db.Tasks.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (task == null || (!CanManage && !IncludesUser(task, UserId))) return NotFound();
        var logs = await db.TaskActivityLogs.AsNoTracking().Where(x => x.TaskId == id).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Ok(logs.Select(x => new { x.Id, x.TaskId, x.ActorUserId, x.Action, Details = ParseObject(x.DetailsJson), x.CreatedAt }));
    }

    [HttpPost]
    [RequirePermission("tasks.create")]
    public async Task<IActionResult> Create(TaskRequest request, CancellationToken ct)
    {
        var title = (request.Title ?? string.Empty).Trim();
        if (title.Length is < 1 or > 200) return BadRequest(new { message = "عنوان وظیفه باید بین ۱ تا ۲۰۰ نویسه باشد" });
        var assignees = Distinct(request.AssigneeUserIds?.Count > 0 ? request.AssigneeUserIds : request.AssignedToUserId.HasValue ? [request.AssignedToUserId.Value] : [UserId]);
        if (assignees.Any(x => x != UserId) && !CanManage) return Forbid();
        var projects = DistinctStrings(request.ProjectIds?.Count > 0 ? request.ProjectIds : string.IsNullOrWhiteSpace(request.ProjectId) ? [] : [request.ProjectId]);
        if (request.IsRecurring && (string.IsNullOrWhiteSpace(request.RecurrenceType) || (!request.RecurrenceEndDate.HasValue && !request.RecurrenceCount.HasValue)))
            return BadRequest(new { message = "نوع تکرار و تاریخ پایان یا تعداد تکرار الزامی است" });

        Guid? seriesId = request.IsRecurring ? Guid.NewGuid() : null;
        var item = new TaskItem
        {
            Title = title, Description = request.Description, ProjectId = projects.FirstOrDefault(), ProjectIdsJson = JsonSerializer.Serialize(projects),
            Status = request.Status, Priority = request.Priority, StartDate = request.StartDate, DueDate = request.DueDate,
            AssignedByUserId = UserId, AssignedToUserId = assignees.First(), AssigneeUserIdsJson = JsonSerializer.Serialize(assignees),
            ParentTaskId = request.ParentTaskId, EstimatedHours = request.EstimatedHours, TagsJson = JsonSerializer.Serialize(DistinctStrings(request.Tags ?? [])),
            IsRecurring = request.IsRecurring, RecurrenceType = request.IsRecurring ? request.RecurrenceType : null,
            RecurrenceInterval = Math.Clamp(request.RecurrenceInterval ?? 1, 1, 365), RecurrenceWeekday = request.RecurrenceWeekday,
            RecurrenceEndDate = request.RecurrenceEndDate, RecurrenceCount = request.RecurrenceCount is { } count ? Math.Clamp(count, 1, 100) : null,
            RecurrenceSeriesId = seriesId, RecurrenceSequence = 1, RequiresCompletionApproval = request.RequiresCompletionApproval,
            TenantId = TenantId,
        };
        db.Tasks.Add(item);
        db.TaskActivityLogs.Add(Log(item.Id, "Created", new { assigneeUserIds = assignees, projectIds = projects, tags = request.Tags }));

        if (item.IsRecurring)
        {
            var start = item.StartDate ?? item.DueDate ?? DateTime.UtcNow;
            var duration = item.DueDate.HasValue ? item.DueDate.Value - start : TimeSpan.Zero;
            var cursor = start;
            var max = Math.Min(100, item.RecurrenceCount ?? 100);
            for (var sequence = 2; sequence <= max; sequence++)
            {
                cursor = NextOccurrence(cursor, item.RecurrenceType!, item.RecurrenceInterval, item.RecurrenceWeekday);
                if (item.RecurrenceEndDate.HasValue && cursor > item.RecurrenceEndDate) break;
                db.Tasks.Add(CloneOccurrence(item, cursor, duration, sequence));
            }
        }
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(item));
    }

    [HttpPatch("{id:guid}")]
    [RequirePermission("tasks.edit")]
    public async Task<IActionResult> Update(Guid id, UpdateTaskRequest request, CancellationToken ct)
    {
        var item = await db.Tasks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null || (!CanManage && !IncludesUser(item, UserId))) return NotFound();
        var isCreator = item.AssignedByUserId == UserId;
        var isAssignee = ParseGuids(item.AssigneeUserIdsJson).Contains(UserId) || item.AssignedToUserId == UserId;
        var action = "Updated";

        if (request.RequestCompletion || (request.Status == TaskItemStatus.Done && item.RequiresCompletionApproval && !isCreator))
        {
            if (!isAssignee && !CanManage) return Forbid();
            item.Status = TaskItemStatus.InReview; item.Progress = 100; item.CompletionRequestedAt = DateTime.UtcNow;
            item.CompletionRequestedByUserId = UserId; item.IsCompletionApproved = false; action = "CompletionRequested";
        }
        else if (request.ApproveCompletion)
        {
            if (!isCreator && !CanManage) return Forbid();
            item.Status = TaskItemStatus.Done; item.Progress = 100; item.IsCompletionApproved = true;
            item.CompletionApprovedAt = DateTime.UtcNow; item.CompletionApprovedByUserId = UserId; action = "CompletionApproved";
        }
        else if (request.RejectCompletion)
        {
            if (!isCreator && !CanManage) return Forbid();
            item.Status = TaskItemStatus.InProgress; item.Progress = Math.Min(99, item.Progress); item.CompletionRequestedAt = null;
            item.CompletionRequestedByUserId = null; item.IsCompletionApproved = false; item.CompletionApprovedAt = null;
            item.CompletionApprovedByUserId = null; action = "CompletionRejected";
        }
        else if (request.Status.HasValue) item.Status = request.Status.Value;

        if (request.Progress.HasValue) item.Progress = Math.Clamp(request.Progress.Value, 0, 100);
        if (request.ActualHours.HasValue) item.ActualHours = request.ActualHours;
        if (request.Title != null) item.Title = request.Title.Trim()[..Math.Min(200, request.Title.Trim().Length)];
        if (request.Description != null) item.Description = request.Description;
        if (request.Priority.HasValue) item.Priority = request.Priority.Value;
        if (request.StartDate.HasValue) item.StartDate = request.StartDate;
        if (request.DueDate.HasValue) item.DueDate = request.DueDate;
        if (request.ParentTaskId.HasValue) item.ParentTaskId = request.ParentTaskId;
        if (request.Tags != null) item.TagsJson = JsonSerializer.Serialize(DistinctStrings(request.Tags));
        if (request.ProjectIds != null)
        {
            var projects = DistinctStrings(request.ProjectIds); item.ProjectIdsJson = JsonSerializer.Serialize(projects); item.ProjectId = projects.FirstOrDefault();
        }
        if (request.AssigneeUserIds != null)
        {
            if (!CanManage) return Forbid();
            var assignees = Distinct(request.AssigneeUserIds); if (assignees.Count == 0) return BadRequest(new { message = "حداقل یک انجام‌دهنده انتخاب کنید" });
            item.AssigneeUserIdsJson = JsonSerializer.Serialize(assignees); item.AssignedToUserId = assignees[0]; action = "Reassigned";
        }
        item.UpdatedAt = DateTime.UtcNow;
        db.TaskActivityLogs.Add(Log(item.Id, action, request));
        await db.SaveChangesAsync(ct);
        return Ok(ToDto(item));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await db.Tasks.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound();
        if (!CanManage && item.AssignedByUserId != UserId) return Forbid();
        db.TaskActivityLogs.Add(Log(item.Id, "Deleted", new { item.Title }));
        item.IsDeleted = true; item.DeletedAt = DateTime.UtcNow; item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private TaskActivityLog Log(Guid taskId, string action, object details) => new()
    {
        TenantId = TenantId, TaskId = taskId, ActorUserId = UserId, Action = action,
        DetailsJson = JsonSerializer.Serialize(details), CreatedByUserId = UserId,
    };

    private static object ToDto(TaskItem x) => new
    {
        x.Id, x.Title, x.Description, x.ProjectId, ProjectIds = ParseStrings(x.ProjectIdsJson), x.Status, x.Priority,
        x.StartDate, x.DueDate, x.EstimatedHours, x.ActualHours, x.Progress, x.AssignedByUserId, x.AssignedToUserId,
        AssigneeUserIds = ParseGuids(x.AssigneeUserIdsJson), Tags = ParseStrings(x.TagsJson), x.ParentTaskId, x.BoardColumn,
        x.IsRecurring, x.RecurrenceType, x.RecurrenceInterval, x.RecurrenceWeekday, x.RecurrenceEndDate, x.RecurrenceCount,
        x.RecurrenceSeriesId, x.RecurrenceSequence, x.RequiresCompletionApproval, x.CompletionRequestedAt,
        x.CompletionRequestedByUserId, x.IsCompletionApproved, x.CompletionApprovedAt, x.CompletionApprovedByUserId,
        x.CreatedAt, x.UpdatedAt,
    };

    private static object ToViewDto(TaskSavedView x) => new { x.Id, x.Name, Filters = ParseObject(x.FiltersJson), x.CreatedAt, x.UpdatedAt };
    private static object ParseObject(string? json) { try { return JsonSerializer.Deserialize<JsonElement>(json ?? "{}"); } catch { return new { }; } }
    private static List<string> ParseStrings(string? json) { try { return JsonSerializer.Deserialize<List<string>>(json ?? "[]") ?? []; } catch { return []; } }
    private static List<Guid> ParseGuids(string? json) => ParseStrings(json).Select(x => Guid.TryParse(x, out var id) ? id : Guid.Empty).Where(x => x != Guid.Empty).ToList();
    private static List<Guid> Distinct(IEnumerable<Guid> values) => values.Where(x => x != Guid.Empty).Distinct().Take(25).ToList();
    private static List<string> DistinctStrings(IEnumerable<string> values) => values.Select(x => x.Trim()).Where(x => x.Length > 0).Distinct().Take(30).ToList();
    private static bool IncludesUser(TaskItem item, Guid userId) => item.AssignedByUserId == userId || item.AssignedToUserId == userId || ParseGuids(item.AssigneeUserIdsJson).Contains(userId);

    private static DateTime NextOccurrence(DateTime current, string type, int interval, int? weekday)
    {
        if (type == "Daily") return current.AddDays(1);
        if (type == "EveryNDays") return current.AddDays(interval);
        if (type == "Yearly") return current.AddYears(interval);
        var next = current.AddMonths(interval);
        if (type != "LastWeekdayOfMonth") return next;
        var last = new DateTime(next.Year, next.Month, DateTime.DaysInMonth(next.Year, next.Month), next.Hour, next.Minute, next.Second, next.Kind);
        var target = (DayOfWeek)Math.Clamp(weekday ?? 1, 0, 6);
        while (last.DayOfWeek != target) last = last.AddDays(-1);
        return last;
    }

    private static TaskItem CloneOccurrence(TaskItem source, DateTime start, TimeSpan duration, int sequence) => new()
    {
        TenantId = source.TenantId, Title = source.Title, Description = source.Description, ProjectId = source.ProjectId,
        ProjectIdsJson = source.ProjectIdsJson, Status = TaskItemStatus.Todo, Priority = source.Priority, StartDate = start,
        DueDate = source.DueDate.HasValue ? start + duration : null, EstimatedHours = source.EstimatedHours, Progress = 0,
        AssignedByUserId = source.AssignedByUserId, AssignedToUserId = source.AssignedToUserId, AssigneeUserIdsJson = source.AssigneeUserIdsJson,
        ParentTaskId = source.ParentTaskId, TagsJson = source.TagsJson, IsRecurring = true, RecurrenceType = source.RecurrenceType,
        RecurrenceInterval = source.RecurrenceInterval, RecurrenceWeekday = source.RecurrenceWeekday, RecurrenceEndDate = source.RecurrenceEndDate,
        RecurrenceCount = source.RecurrenceCount, RecurrenceSeriesId = source.RecurrenceSeriesId, RecurrenceSequence = sequence,
        RequiresCompletionApproval = source.RequiresCompletionApproval, CreatedByUserId = source.CreatedByUserId,
    };
}

public class TaskRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? ProjectId { get; set; }
    public List<string>? ProjectIds { get; set; }
    public TaskItemStatus Status { get; set; } = TaskItemStatus.Todo;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public List<Guid>? AssigneeUserIds { get; set; }
    public Guid? ParentTaskId { get; set; }
    public int? EstimatedHours { get; set; }
    public List<string>? Tags { get; set; }
    public bool IsRecurring { get; set; }
    public string? RecurrenceType { get; set; }
    public int? RecurrenceInterval { get; set; }
    public int? RecurrenceWeekday { get; set; }
    public DateTime? RecurrenceEndDate { get; set; }
    public int? RecurrenceCount { get; set; }
    public bool RequiresCompletionApproval { get; set; } = true;
}

public class UpdateTaskRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public TaskItemStatus? Status { get; set; }
    public TaskPriority? Priority { get; set; }
    public int? Progress { get; set; }
    public int? ActualHours { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? DueDate { get; set; }
    public Guid? ParentTaskId { get; set; }
    public List<Guid>? AssigneeUserIds { get; set; }
    public List<string>? ProjectIds { get; set; }
    public List<string>? Tags { get; set; }
    public bool RequestCompletion { get; set; }
    public bool ApproveCompletion { get; set; }
    public bool RejectCompletion { get; set; }
}

public record SaveTaskViewRequest(string? Name, object? Filters);
