using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Forms;
using OrgSystem.Domain.Entities.Notifications;
using OrgSystem.Domain.Entities.Identity;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/forms"), Authorize]
public class FormsController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private string UserName => User.FindFirst("full_name")?.Value ?? "کاربر";
    private static readonly Regex Dangerous = new(@"<[^>]+>|javascript\s*:|--|/\*|\*/|;\s*(select|insert|update|delete|drop|alter|exec)|\b(union\s+select|drop\s+table)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex JalaliPattern = new(@"^\d{4}/\d{2}/\d{2}$", RegexOptions.Compiled);
    private static readonly Regex TimePattern = new(@"^(?:[01]\d|2[0-3]):[0-5]\d$", RegexOptions.Compiled);
    private static readonly Dictionary<string, string> FormTitles = new()
    {
        ["leave_daily"] = "مرخصی روزانه", ["leave_hourly"] = "مرخصی ساعتی", ["mission"] = "ماموریت",
        ["loan"] = "وام", ["payslip"] = "فیش حقوقی", ["resignation"] = "استعفا",
        ["equipment"] = "تحویل تجهیزات", ["personnel"] = "مشخصات پرسنلی"
    };
    private static int CurrentYm { get { var pc = new PersianCalendar(); var now = DateTime.Now; return pc.GetYear(now) * 12 + pc.GetMonth(now); } }

    private async Task<LeaveAccount> Account(Guid userId)
    {
        var account = await db.LeaveAccounts.FirstOrDefaultAsync(x => x.UserId == userId);
        if (account == null) { account = new LeaveAccount { UserId = userId, AccruedThroughYearMonth = CurrentYm, AccruedHours = 20, TenantId = TenantId }; db.LeaveAccounts.Add(account); }
        else if (account.AccruedThroughYearMonth < CurrentYm) { account.AccruedHours += (CurrentYm - account.AccruedThroughYearMonth) * 20; account.AccruedThroughYearMonth = CurrentYm; }
        await db.SaveChangesAsync(); return account;
    }

    private static string NormalizeDigits(string value) => string.Concat(value.Select(c => c switch
    {
        >= '۰' and <= '۹' => (char)('0' + c - '۰'), >= '٠' and <= '٩' => (char)('0' + c - '٠'), _ => c
    }));
    private static string? Value(Dictionary<string, object?> data, string key)
    {
        if (!data.TryGetValue(key, out var raw) || raw == null) return null;
        var value = raw is JsonElement element ? element.ValueKind == JsonValueKind.String ? element.GetString() : element.ToString() : Convert.ToString(raw, CultureInfo.InvariantCulture);
        return value == null ? null : NormalizeDigits(value.Trim());
    }
    private static bool TryJalali(string? value, out DateTime date)
    {
        date = default; if (value == null || !JalaliPattern.IsMatch(value)) return false;
        try { var p = value.Split('/').Select(int.Parse).ToArray(); date = new PersianCalendar().ToDateTime(p[0], p[1], p[2], 0, 0, 0, 0); return true; } catch { return false; }
    }
    private static bool TryTime(string? value, out TimeSpan time) => TimeSpan.TryParseExact(value, @"hh\:mm", CultureInfo.InvariantCulture, out time) && value != null && TimePattern.IsMatch(value);
    private static string? ValidateData(Dictionary<string, object?> data)
    {
        if (data.Count > 60) return "تعداد فیلدهای فرم بیش از حد مجاز است";
        var json = JsonSerializer.Serialize(data);
        if (json.Length > 30_000) return "حجم اطلاعات فرم بیش از حد مجاز است";
        if (Dangerous.IsMatch(json)) return "ورود کد HTML، JavaScript یا SQL در فرم مجاز نیست";
        foreach (var (key, raw) in data)
        {
            if (!Regex.IsMatch(key, @"^[A-Za-z][A-Za-z0-9]{0,49}$")) return "نام یکی از فیلدهای فرم معتبر نیست";
            var text = raw is JsonElement e ? e.ToString() : Convert.ToString(raw, CultureInfo.InvariantCulture);
            if (text?.Length > 4_000) return $"مقدار فیلد {key} بیش از حد مجاز است";
        }
        foreach (var key in new[] { "nationalCode", "mobile", "accountNumber", "insuranceCode", "personnelCode" })
        {
            var value = Value(data, key); if (!string.IsNullOrEmpty(value) && !value.All(char.IsDigit)) return $"فیلد {key} باید فقط عدد باشد";
        }
        return null;
    }
    private static string? CalculateRequestedHours(string formType, Dictionary<string, object?> data, out decimal hours)
    {
        hours = 0;
        if (formType == "leave_daily")
        {
            if (!TryJalali(Value(data, "fromDate"), out var from) || !TryJalali(Value(data, "toDate"), out var to)) return "تاریخ شروع یا پایان مرخصی معتبر نیست";
            if (to < from) return "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد";
            var days = (to.Date - from.Date).Days + 1; if (days > 31) return "مرخصی روزانه نمی‌تواند بیشتر از ۳۱ روز باشد";
            hours = days * 8;
        }
        else if (formType == "leave_hourly")
        {
            if (!TryJalali(Value(data, "date"), out _)) return "تاریخ مرخصی معتبر نیست";
            if (!TryTime(Value(data, "fromTime"), out var from) || !TryTime(Value(data, "toTime"), out var to)) return "ساعت شروع یا پایان معتبر نیست";
            if (to <= from) return "ساعت پایان باید بعد از ساعت شروع باشد";
            hours = (decimal)(to - from).TotalHours; if (hours > 8) return "مرخصی ساعتی در یک روز نمی‌تواند بیشتر از ۸ ساعت باشد";
        }
        else if (formType == "mission")
        {
            if (!TryJalali(Value(data, "fromDate"), out var from) || !TryJalali(Value(data, "toDate"), out var to)) return "تاریخ ماموریت معتبر نیست";
            if (to < from) return "تاریخ پایان ماموریت نمی‌تواند قبل از شروع باشد";
        }
        foreach (var key in new[] { "lastWorkDate", "deliveryDate", "birthDate", "startDate" })
        {
            var value = Value(data, key); if (!string.IsNullOrWhiteSpace(value) && !TryJalali(value, out _)) return $"تاریخ فیلد {key} معتبر نیست";
        }
        return null;
    }

    private async Task<(User? Submitter, User? Manager, User? Hr)> ResolveWorkflowUsers()
    {
        var submitter = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == UserId && x.IsActive);
        if (submitter == null) return (null, null, null);
        User? manager = null, hr = null;
        if (!string.IsNullOrWhiteSpace(submitter.DirectManager))
        {
            var value = submitter.DirectManager.Trim();
            manager = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.IsActive && x.Id != UserId &&
                (x.FirstName + " " + x.LastName == value || x.Username == value || x.Position == value));
        }
        if (!string.IsNullOrWhiteSpace(submitter.HrManager))
        {
            var value = submitter.HrManager.Trim();
            hr = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.IsActive && x.Id != UserId &&
                (x.FirstName + " " + x.LastName == value || x.Username == value || x.Position == value));
        }
        hr ??= await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.IsActive && x.Id != UserId &&
            ((x.Position != null && (x.Position.Contains("منابع انسانی") || x.Position.Contains("HR"))) ||
             (x.Department != null && x.Department.Contains("منابع انسانی"))));
        return (submitter, manager, hr);
    }

    [HttpGet("balance"), RequirePermission("forms.view")]
    public async Task<IActionResult> Balance()
    {
        var a = await Account(UserId);
        var reserved = await db.OrganizationalForms.Where(x => x.SubmitterUserId == UserId && (x.FormType == "leave_daily" || x.FormType == "leave_hourly") && (x.Status == "manager_pending" || x.Status == "hr_pending")).SumAsync(x => (decimal?)x.RequestedHours) ?? 0;
        var available = Math.Max(0, a.AccruedHours - a.UsedHours - reserved);
        return Ok(new { accruedHours = a.AccruedHours, usedHours = a.UsedHours, reservedHours = reserved, availableHours = available, days = Math.Floor(available / 8), hoursPerDay = 8, monthlyAccrualHours = 20 });
    }

    [HttpGet, RequirePermission("forms.view")]
    public async Task<IActionResult> List([FromQuery] string scope = "mine")
    {
        var q = db.OrganizationalForms.Include(x => x.History).AsNoTracking();
        q = scope == "approvals" ? q.Where(x => (x.Status == "manager_pending" && x.ManagerUserId == UserId) || (x.Status == "hr_pending" && x.HrUserId == UserId)) : q.Where(x => x.SubmitterUserId == UserId);
        return Ok(await q.OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.FormType, x.Title, x.SubmitterName, x.ManagerName, x.HrName, x.Status, x.RequestedHours, x.DataJson, x.CreatedAt, History = x.History.OrderBy(h => h.CreatedAt).Select(h => new { h.Id, h.Action, h.ActorName, h.Note, h.CreatedAt }) }).ToListAsync());
    }

    [HttpGet("approvers"), RequirePermission("forms.create")]
    public async Task<IActionResult> Approvers()
    {
        var workflow = await ResolveWorkflowUsers();
        if (workflow.Submitter == null) return NotFound(new { message = "کاربر فعال یافت نشد" });
        object? Dto(User? x) => x == null ? null : new { x.Id, x.FullName, x.Position, x.Department };
        return Ok(new
        {
            submitter = Dto(workflow.Submitter), manager = Dto(workflow.Manager), hrManager = Dto(workflow.Hr),
            users = await db.Users.AsNoTracking().Where(x => x.IsActive && x.Id != UserId).OrderBy(x => x.FirstName)
                .Select(x => new { x.Id, x.FullName, x.Position, x.Department }).ToListAsync(),
            isConfigured = workflow.Manager != null && workflow.Hr != null,
            message = workflow.Manager == null ? "مدیر مستقیم این کاربر در مدیریت کاربران تعیین نشده است" : workflow.Hr == null ? "مسئول منابع انسانی در مدیریت کاربران تعیین نشده است" : null
        });
    }

    [HttpPost, RequirePermission("forms.create")]
    public async Task<IActionResult> Create(FormCreateRequest request)
    {
        if (!FormTitles.TryGetValue(request.FormType ?? "", out var title)) return BadRequest(new { message = "نوع فرم معتبر نیست" });
        if (request.Data == null) return BadRequest(new { message = "اطلاعات فرم ارسال نشده است" });
        var dataError = ValidateData(request.Data); if (dataError != null) return BadRequest(new { message = dataError });
        var amountError = CalculateRequestedHours(request.FormType!, request.Data, out var hours); if (amountError != null) return BadRequest(new { message = amountError });
        var workflow = await ResolveWorkflowUsers();
        var manager = workflow.Manager; var hr = workflow.Hr;
        if (workflow.Submitter == null) return BadRequest(new { message = "کاربر ثبت‌کننده معتبر نیست" });
        if (manager == null) return BadRequest(new { message = "مدیر مستقیم شما در مدیریت کاربران تعیین نشده است" });
        if (hr == null) return BadRequest(new { message = "مسئول منابع انسانی شما در مدیریت کاربران تعیین نشده است" });
        if (hours > 0)
        {
            var a = await Account(UserId);
            var reserved = await db.OrganizationalForms.Where(x => x.SubmitterUserId == UserId && (x.Status == "manager_pending" || x.Status == "hr_pending") && (x.FormType == "leave_daily" || x.FormType == "leave_hourly")).SumAsync(x => (decimal?)x.RequestedHours) ?? 0;
            if (hours > a.AccruedHours - a.UsedHours - reserved) return BadRequest(new { message = "مانده مرخصی کافی نیست" });
        }
        var item = new OrganizationalForm { FormType = request.FormType!, Title = title, SubmitterUserId = UserId, SubmitterName = workflow.Submitter.FullName, ManagerUserId = manager.Id, ManagerName = manager.FullName, HrUserId = hr.Id, HrName = hr.FullName, RequestedHours = hours, DataJson = JsonSerializer.Serialize(request.Data), TenantId = TenantId };
        db.OrganizationalForms.Add(item);
        db.FormWorkflowHistories.Add(new FormWorkflowHistory { FormId = item.Id, ActorUserId = UserId, ActorName = UserName, Action = "submitted", TenantId = TenantId });
        db.Notifications.Add(new Notification { UserId = manager.Id, Title = "فرم جدید در انتظار تأیید", Body = $"{item.Title} — {UserName}", Type = NotificationType.Form, ActionUrl = "/forms", RelatedEntityId = item.Id.ToString(), RelatedEntityType = "Form", TenantId = TenantId });
        await db.SaveChangesAsync(); return Ok(new { item.Id, requestedHours = hours, message = "فرم برای مدیر بالادست ارسال شد" });
    }

    [HttpPost("{id:guid}/action"), RequirePermission("forms.approve")]
    public async Task<IActionResult> Action(Guid id, FormActionRequest request)
    {
        if (request.Action is not ("approve" or "reject" or "return")) return BadRequest(new { message = "اقدام نامعتبر است" });
        var note = request.Note?.Trim(); if (note?.Length > 1000 || note != null && Dangerous.IsMatch(note)) return BadRequest(new { message = "متن توضیحات معتبر نیست" });
        var item = await db.OrganizationalForms.FirstOrDefaultAsync(x => x.Id == id); if (item == null) return NotFound();
        var isManager = item.Status == "manager_pending" && item.ManagerUserId == UserId; var isHr = item.Status == "hr_pending" && item.HrUserId == UserId; if (!isManager && !isHr) return Forbid();
        if (request.Action == "approve" && isManager) { item.Status = "hr_pending"; db.Notifications.Add(new Notification { UserId = item.HrUserId, Title = "فرم در انتظار تأیید منابع انسانی", Body = $"{item.Title} — {item.SubmitterName}", Type = NotificationType.Form, ActionUrl = "/forms", TenantId = TenantId }); }
        else if (request.Action == "approve" && isHr) { if (item.RequestedHours > 0) { var a = await Account(item.SubmitterUserId); if (item.RequestedHours > a.AccruedHours - a.UsedHours) return BadRequest(new { message = "مانده مرخصی کافی نیست" }); a.UsedHours += item.RequestedHours; } item.Status = "approved"; }
        else if (request.Action == "reject") item.Status = "rejected"; else if (request.Action == "return") item.Status = "returned";
        db.FormWorkflowHistories.Add(new FormWorkflowHistory { FormId = item.Id, ActorUserId = UserId, ActorName = UserName, Action = request.Action, Note = note, TenantId = TenantId });
        db.Notifications.Add(new Notification { UserId = item.SubmitterUserId, Title = item.Status == "approved" ? "فرم شما تأیید نهایی شد" : item.Status == "hr_pending" ? "فرم شما توسط مدیر تأیید شد" : item.Status == "returned" ? "فرم برای اصلاح برگشت داده شد" : "فرم شما رد شد", Body = item.Title, Type = NotificationType.Form, ActionUrl = "/forms", TenantId = TenantId });
        await db.SaveChangesAsync(); return Ok(new { item.Status });
    }
}

public record FormCreateRequest(string FormType, string? Title, Guid ManagerUserId, Guid HrUserId, decimal Amount, Dictionary<string, object?> Data);
public record FormActionRequest(string Action, string? Note);
