using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
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
    private static readonly Regex JalaliPattern = new(@"^\d{4}/\d{2}/\d{2}$", RegexOptions.Compiled);
    private static string NormalizeDigits(string value) => string.Concat(value.Select(c => c switch
    {
        >= '۰' and <= '۹' => (char)('0' + c - '۰'), >= '٠' and <= '٩' => (char)('0' + c - '٠'), _ => c
    }));
    private static bool TryJalali(string? value, out DateTime date)
    {
        date = default; value = value == null ? null : NormalizeDigits(value.Trim());
        if (value == null || !JalaliPattern.IsMatch(value)) return false;
        try { var p = value.Split('/').Select(int.Parse).ToArray(); date = new PersianCalendar().ToDateTime(p[0], p[1], p[2], 0, 0, 0, 0); return true; } catch { return false; }
    }
    private static string? JsonValue(string json, string key)
    {
        try { using var document = JsonDocument.Parse(json); return document.RootElement.TryGetProperty(key, out var value) ? value.ToString() : null; }
        catch (JsonException) { return null; }
    }
    private static string Decision(string? action) => action switch { "approve" => "تأیید شده", "reject" => "رد شده", "return" => "برگشت برای اصلاح", "complete" => "خاتمه یافته", _ => "در انتظار" };

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

    [HttpGet("forms/users")]
    public async Task<IActionResult> FormUsers(CancellationToken ct)
    {
        // FullName is a computed CLR property and is not mapped to a database column.
        // Build it after materializing the query so PostgreSQL never has to translate it.
        var users = await db.Users.AsNoTracking()
            .OrderBy(x => x.FirstName).ThenBy(x => x.LastName)
            .Select(x => new { x.Id, x.FirstName, x.LastName, x.Position, x.Department, x.IsActive })
            .ToListAsync(ct);

        // Keep employees with historical forms available even if their account was
        // later deactivated or soft-deleted.
        var formSubmitters = await db.OrganizationalForms.AsNoTracking()
            .Select(x => new { Id = x.SubmitterUserId, FullName = x.SubmitterName })
            .Distinct()
            .ToListAsync(ct);
        var knownIds = users.Select(x => x.Id).ToHashSet();

        var result = users.Select(x => new
        {
            x.Id,
            FullName = $"{x.FirstName} {x.LastName}".Trim(),
            x.Position,
            x.Department,
            x.IsActive
        }).Concat(formSubmitters.Where(x => !knownIds.Contains(x.Id)).Select(x => new
        {
            x.Id,
            x.FullName,
            Position = (string?)null,
            Department = (string?)null,
            IsActive = false
        })).OrderBy(x => x.FullName).ToList();

        return Ok(result);
    }

    [HttpGet("forms/leave")]
    public async Task<IActionResult> LeaveReport([FromQuery] Guid? userId, [FromQuery] string? fromDate, [FromQuery] string? toDate, CancellationToken ct)
    {
        DateTime? from = null, to = null;
        if (!string.IsNullOrWhiteSpace(fromDate)) { if (!TryJalali(fromDate, out var parsed)) return BadRequest(new { message = "تاریخ شروع فیلتر معتبر نیست" }); from = parsed.Date; }
        if (!string.IsNullOrWhiteSpace(toDate)) { if (!TryJalali(toDate, out var parsed)) return BadRequest(new { message = "تاریخ پایان فیلتر معتبر نیست" }); to = parsed.Date; }
        if (from.HasValue && to.HasValue && to < from) return BadRequest(new { message = "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد" });

        var query = db.OrganizationalForms.Include(x => x.History).AsNoTracking().Where(x => x.FormType == "leave_daily" || x.FormType == "leave_hourly");
        if (userId.HasValue) query = query.Where(x => x.SubmitterUserId == userId.Value);
        var forms = await query.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        var rows = new List<object>();
        foreach (var item in forms)
        {
            var daily = item.FormType == "leave_daily";
            var dateText = JsonValue(item.DataJson, daily ? "fromDate" : "date") ?? "";
            var endDateText = daily ? JsonValue(item.DataJson, "toDate") ?? dateText : dateText;
            if (!TryJalali(dateText, out var itemFrom) || !TryJalali(endDateText, out var itemTo)) continue;
            if (from.HasValue && itemTo.Date < from.Value || to.HasValue && itemFrom.Date > to.Value) continue;
            var histories = item.History.OrderBy(x => x.CreatedAt).ToList();
            var managerAction = histories.FirstOrDefault(x => x.ActorName == item.ManagerName && x.Action != "submitted")?.Action;
            var hrAction = histories.FirstOrDefault(x => x.ActorName == item.HrName && x.Action != "submitted")?.Action;
            rows.Add(new
            {
                item.Id,
                EmployeeName = item.SubmitterName,
                LeaveKind = daily ? "روزانه" : "ساعتی",
                Date = daily && dateText != endDateText ? $"{dateText} تا {endDateText}" : dateText,
                StartTime = daily ? "—" : JsonValue(item.DataJson, "fromTime") ?? "—",
                EndTime = daily ? "—" : JsonValue(item.DataJson, "toTime") ?? "—",
                item.RequestedHours,
                item.ManagerName,
                ManagerDecision = item.Status == "manager_pending" ? "در انتظار" : Decision(managerAction),
                HrManagerName = item.HrName,
                HrDecision = item.Status == "manager_pending" || item.Status == "hr_pending" ? "در انتظار" : Decision(hrAction),
                item.Status,
                item.CreatedAt
            });
        }
        return Ok(rows);
    }

    [HttpGet("forms/pending")]
    public async Task<IActionResult> PendingForms(CancellationToken ct)
    {
        var today = DateTime.UtcNow;
        var source = await db.OrganizationalForms.AsNoTracking().Where(x => x.Status == "manager_pending" || x.Status == "hr_pending")
            .OrderBy(x => x.CreatedAt).Select(x => new
            {
                x.Id, x.Title, x.FormType, x.SubmitterName, x.Status, x.RequestedHours, x.CreatedAt,
                CurrentStage = x.Status == "manager_pending" ? "تأیید مدیر مستقیم" : "تأیید منابع انسانی",
                CurrentApprover = x.Status == "manager_pending" ? x.ManagerName : x.HrName
            }).ToListAsync(ct);
        return Ok(source.Select(x => new { x.Id, x.Title, x.FormType, x.SubmitterName, x.Status, x.RequestedHours, x.CreatedAt, x.CurrentStage, x.CurrentApprover, WaitingDays = Math.Max(0, (int)Math.Floor((today - x.CreatedAt).TotalDays)) }));
    }
}
