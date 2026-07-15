using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Tasks;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.API.Authorization;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/tasks"), Authorize]
[RequirePermission("tasks.view")]
public class TasksController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? scope, [FromQuery] TaskItemStatus? status, CancellationToken ct)
    {
        var q = db.Tasks.AsNoTracking().AsQueryable();
        q = scope == "assigned" ? q.Where(x => x.AssignedByUserId == UserId) : q.Where(x => x.AssignedToUserId == UserId || x.AssignedByUserId == UserId);
        if (status.HasValue) q = q.Where(x => x.Status == status);
        return Ok(await q.OrderBy(x => x.DueDate).ToListAsync(ct));
    }

    [HttpPost]
    [RequirePermission("tasks.create")]
    public async Task<IActionResult> Create(TaskRequest request, CancellationToken ct)
    {
        if (request.AssignedToUserId.HasValue && request.AssignedToUserId.Value != UserId &&
            !User.IsInRole("Admin") && !User.FindAll("permission").Any(x => x.Value == "tasks.assign"))
            return Forbid();
        var item = new TaskItem { Title = request.Title.Trim(), Description = request.Description, Priority = request.Priority,
            StartDate = request.StartDate, DueDate = request.DueDate, AssignedByUserId = UserId,
            AssignedToUserId = request.AssignedToUserId ?? UserId, ParentTaskId = request.ParentTaskId,
            EstimatedHours = request.EstimatedHours, TenantId = TenantId };
        db.Tasks.Add(item); await db.SaveChangesAsync(ct); return Ok(item);
    }

    [HttpPatch("{id:guid}")]
    [RequirePermission("tasks.edit")]
    public async Task<IActionResult> Update(Guid id, UpdateTaskRequest request, CancellationToken ct)
    {
        var item = await db.Tasks.FirstOrDefaultAsync(x => x.Id == id && (x.AssignedToUserId == UserId || x.AssignedByUserId == UserId), ct);
        if (item == null) return NotFound();
        if (request.Status.HasValue) item.Status = request.Status.Value;
        if (request.Progress.HasValue) item.Progress = Math.Clamp(request.Progress.Value, 0, 100);
        if (request.ActualHours.HasValue) item.ActualHours = request.ActualHours;
        if (request.DueDate.HasValue) item.DueDate = request.DueDate;
        await db.SaveChangesAsync(ct); return Ok(item);
    }
}

public record TaskRequest(string Title, string? Description, TaskPriority Priority, DateTime? StartDate,
    DateTime? DueDate, Guid? AssignedToUserId, Guid? ParentTaskId, int? EstimatedHours);
public record UpdateTaskRequest(TaskItemStatus? Status, int? Progress, int? ActualHours, DateTime? DueDate);
