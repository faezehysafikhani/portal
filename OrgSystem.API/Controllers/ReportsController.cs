using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Forms;
using OrgSystem.Domain.Entities.Letters;
using OrgSystem.Domain.Entities.Sms;
using OrgSystem.Domain.Entities.Tasks;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/reports"), Authorize, RequirePermission("reports.view")]
public class ReportsController(AppDbContext db) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var letterCount = await db.Letters.CountAsync(ct);
        var activeTasks = await db.Tasks.CountAsync(x => x.Status != TaskItemStatus.Done && x.Status != TaskItemStatus.Cancelled, ct);
        var openTickets = await db.Tickets.CountAsync(x => x.Status != "resolved" && x.Status != "closed", ct);
        var sentSms = await db.SmsMessages.CountAsync(x => x.Status == SmsStatus.Sent || x.Status == SmsStatus.Delivered, ct);
        var pendingForms = await db.OrganizationalForms.CountAsync(x => x.Status == "manager_pending" || x.Status == "hr_pending", ct);
        var activeUsers = await db.Users.CountAsync(x => x.IsActive, ct);

        var start = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(-5);
        var letterDates = await db.Letters.Where(x => x.CreatedAt >= start).Select(x => new { x.CreatedAt, x.Type }).ToListAsync(ct);
        var taskDates = await db.Tasks.Where(x => x.CreatedAt >= start).Select(x => x.CreatedAt).ToListAsync(ct);
        var ticketDates = await db.Tickets.Where(x => x.CreatedAt >= start).Select(x => x.CreatedAt).ToListAsync(ct);
        var formDates = await db.OrganizationalForms.Where(x => x.CreatedAt >= start).Select(x => x.CreatedAt).ToListAsync(ct);
        var fa = CultureInfo.GetCultureInfo("fa-IR");
        var monthly = Enumerable.Range(0, 6).Select(offset => start.AddMonths(offset)).Select(month => new
        {
            month = month.ToString("MMM yyyy", fa),
            internalLetters = letterDates.Count(x => x.CreatedAt.Year == month.Year && x.CreatedAt.Month == month.Month && x.Type == LetterType.Internal),
            incomingLetters = letterDates.Count(x => x.CreatedAt.Year == month.Year && x.CreatedAt.Month == month.Month && x.Type == LetterType.Incoming),
            outgoingLetters = letterDates.Count(x => x.CreatedAt.Year == month.Year && x.CreatedAt.Month == month.Month && x.Type == LetterType.Outgoing),
            tasks = taskDates.Count(x => x.Year == month.Year && x.Month == month.Month),
            tickets = ticketDates.Count(x => x.Year == month.Year && x.Month == month.Month),
            forms = formDates.Count(x => x.Year == month.Year && x.Month == month.Month)
        }).ToList();

        var letterRows = await db.Letters.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new { x.Id, number = x.LetterNumber ?? x.IncomingNumber ?? "—", x.Type, subject = x.Subject, from = x.FromUserName ?? x.IncomingFromOrg ?? "—", date = x.LetterDate ?? x.CreatedAt, x.Status }).ToListAsync(ct);
        var letters = letterRows.Select(x => new { x.Id, x.number, type = x.Type.ToString(), x.subject, x.from, x.date, status = x.Status.ToString() }).ToList();
        var taskRows = await db.Tasks.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new { x.Id, x.Title, x.Status, x.Priority, assignee = db.Users.Where(u => u.Id == x.AssignedToUserId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefault(), x.Progress, x.DueDate, x.CreatedAt }).ToListAsync(ct);
        var tasks = taskRows.Select(x => new { x.Id, x.Title, status = x.Status.ToString(), priority = x.Priority.ToString(), x.assignee, x.Progress, x.DueDate, x.CreatedAt }).ToList();
        var tickets = await db.Tickets.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new { x.Id, x.Code, x.Title, x.Category, x.Priority, x.Status, customer = x.Customer.FullName, assignee = db.Users.Where(u => u.Id == x.AssignedToUserId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefault(), x.CreatedAt, x.ResolvedAt }).ToListAsync(ct);
        var forms = await db.OrganizationalForms.AsNoTracking().OrderByDescending(x => x.CreatedAt).Take(100)
            .Select(x => new { x.Id, x.Title, x.SubmitterName, x.ManagerName, x.HrName, x.Status, x.RequestedHours, x.CreatedAt }).ToListAsync(ct);

        return Ok(new
        {
            summary = new { letterCount, activeTasks, openTickets, sentSms, pendingForms, activeUsers }, monthly,
            letterTypes = new[]
            {
                new { name = "داخلی", value = await db.Letters.CountAsync(x => x.Type == LetterType.Internal, ct) },
                new { name = "وارده", value = await db.Letters.CountAsync(x => x.Type == LetterType.Incoming, ct) },
                new { name = "صادره", value = await db.Letters.CountAsync(x => x.Type == LetterType.Outgoing, ct) }
            },
            taskStatuses = (await db.Tasks.GroupBy(x => x.Status).Select(x => new { status = x.Key, value = x.Count() }).ToListAsync(ct)).Select(x => new { name = x.status.ToString(), x.value }),
            ticketStatuses = await db.Tickets.GroupBy(x => x.Status).Select(x => new { name = x.Key, value = x.Count() }).ToListAsync(ct),
            formStatuses = await db.OrganizationalForms.GroupBy(x => x.Status).Select(x => new { name = x.Key, value = x.Count() }).ToListAsync(ct),
            letters, tasks, tickets, forms
        });
    }
}
