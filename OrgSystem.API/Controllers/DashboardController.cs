using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/dashboard"), Authorize]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        var now = DateTime.UtcNow;
        var startOfDay = now.Date;
        return Ok(new
        {
            newLetters = await db.Letters.CountAsync(x => x.Recipients.Any(r => r.UserId == userId && !r.IsRead), ct),
            activeTasks = await db.Tasks.CountAsync(x => x.AssignedToUserId == userId && x.Status != OrgSystem.Domain.Entities.Tasks.TaskItemStatus.Done && x.Status != OrgSystem.Domain.Entities.Tasks.TaskItemStatus.Cancelled, ct),
            openTickets = await db.Tickets.CountAsync(x => x.AssignedToUserId == userId && x.Status != "closed" && x.Status != "resolved", ct),
            todayEvents = await db.CalendarEvents.CountAsync(x => x.StartAt >= startOfDay && x.StartAt < startOfDay.AddDays(1) &&
                (x.OrganizerUserId == userId || x.Attendees.Any(a => a.UserId == userId)), ct),
            users = await db.Users.CountAsync(x => x.IsActive, ct), contacts = await db.Contacts.CountAsync(ct),
            recentLetters = await db.Letters.Where(x => x.FromUserId == userId || x.Recipients.Any(r => r.UserId == userId))
                .OrderByDescending(x => x.CreatedAt).Take(5).Select(x => new { x.Id, x.Subject, x.FromUserName, x.LetterNumber, x.CreatedAt, Status = x.Status.ToString() }).ToListAsync(ct),
            recentTasks = await db.Tasks.Where(x => x.AssignedToUserId == userId || x.AssignedByUserId == userId)
                .OrderByDescending(x => x.CreatedAt).Take(5).Select(x => new { x.Id, x.Title, Status = x.Status.ToString(), Priority = x.Priority.ToString(), x.Progress, x.DueDate }).ToListAsync(ct)
        });
    }
}
