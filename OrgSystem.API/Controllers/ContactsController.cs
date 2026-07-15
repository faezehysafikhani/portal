using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Scheduling;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.API.Authorization;
using System.Net.Mail;
using System.Text.RegularExpressions;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/contacts"), Authorize]
[RequirePermission("contacts.view")]
public class ContactsController(AppDbContext db) : ControllerBase
{
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private static readonly Regex TextOnly = new(@"^[\p{L}\p{M}\s\u200C\-\.\(\)&،]+$", RegexOptions.Compiled);
    private static readonly Regex DangerousCode = new(@"<\s*/?\s*(script|iframe|object|embed|style|html|svg)|<[^>]+>|javascript\s*:|--|/\*|\*/|;\s*(select|insert|update|delete|drop|alter|exec)|\b(union\s+select|drop\s+table|exec\s*\()", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static string NormalizeDigits(string? value) => string.Concat((value ?? string.Empty).Trim().Select(c => c switch
    {
        >= '۰' and <= '۹' => (char)('0' + c - '۰'),
        >= '٠' and <= '٩' => (char)('0' + c - '٠'),
        _ => c
    }));
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static ContactRequest Normalize(ContactRequest request) => request with
    {
        FullName = request.FullName?.Trim() ?? string.Empty,
        CompanyName = Clean(request.CompanyName),
        JobTitle = Clean(request.JobTitle),
        Mobile = Clean(NormalizeDigits(request.Mobile)),
        Phone = Clean(NormalizeDigits(request.Phone)),
        Email = Clean(request.Email)?.ToLowerInvariant(),
        Address = Clean(request.Address),
        Notes = Clean(request.Notes),
        Industry = Clean(request.Industry),
        Fax = Clean(NormalizeDigits(request.Fax)),
        Website = Clean(request.Website),
        PostalCode = Clean(NormalizeDigits(request.PostalCode)),
        NationalId = Clean(NormalizeDigits(request.NationalId)),
        EconomicCode = Clean(NormalizeDigits(request.EconomicCode)),
        Department = Clean(request.Department),
        Extension = Clean(NormalizeDigits(request.Extension))
    };
    private static string? Validate(ContactRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName)) return "نام مخاطب الزامی است";
        if (request.FullName.Length > 150 || !TextOnly.IsMatch(request.FullName)) return "نام مخاطب فقط باید شامل حروف باشد";
        if (request.CompanyName is { Length: > 150 } || request.CompanyName != null && !TextOnly.IsMatch(request.CompanyName)) return "نام شرکت فقط باید شامل حروف باشد";
        if (request.JobTitle is { Length: > 100 } || request.JobTitle != null && !TextOnly.IsMatch(request.JobTitle)) return "سمت فقط باید شامل حروف باشد";
        if (request.Industry is { Length: > 100 } || request.Industry != null && !TextOnly.IsMatch(request.Industry)) return "حوزه فعالیت فقط باید شامل حروف باشد";
        if (request.Department is { Length: > 100 } || request.Department != null && !TextOnly.IsMatch(request.Department)) return "دپارتمان فقط باید شامل حروف باشد";
        if (request.Mobile != null && (!request.Mobile.All(char.IsDigit) || request.Mobile.Length is < 10 or > 15)) return "موبایل باید فقط عدد و بین ۱۰ تا ۱۵ رقم باشد";
        if (request.Phone != null && (!request.Phone.All(char.IsDigit) || request.Phone.Length is < 7 or > 15)) return "تلفن باید فقط عدد و بین ۷ تا ۱۵ رقم باشد";
        if (request.Fax != null && (!request.Fax.All(char.IsDigit) || request.Fax.Length is < 7 or > 15)) return "فاکس باید فقط عدد باشد";
        if (request.Extension != null && (!request.Extension.All(char.IsDigit) || request.Extension.Length > 8)) return "شماره داخلی باید فقط عدد و حداکثر ۸ رقم باشد";
        if (request.PostalCode != null && (!request.PostalCode.All(char.IsDigit) || request.PostalCode.Length != 10)) return "کد پستی باید دقیقاً ۱۰ رقم باشد";
        if (request.NationalId != null && (!request.NationalId.All(char.IsDigit) || request.NationalId.Length != 11)) return "شناسه ملی شرکت باید دقیقاً ۱۱ رقم باشد";
        if (request.EconomicCode != null && (!request.EconomicCode.All(char.IsDigit) || request.EconomicCode.Length is < 10 or > 14)) return "کد اقتصادی باید فقط عدد و بین ۱۰ تا ۱۴ رقم باشد";
        if (request.Email is { Length: > 254 }) return "ایمیل بیش از حد طولانی است";
        if (request.Email != null) { try { _ = new MailAddress(request.Email); } catch { return "فرمت ایمیل معتبر نیست"; } }
        if (request.Website != null && (!Uri.TryCreate(request.Website, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))) return "آدرس وب‌سایت معتبر نیست";
        if (request.Address is { Length: > 500 }) return "آدرس حداکثر ۵۰۰ کاراکتر باشد";
        if (request.Notes is { Length: > 1000 }) return "توضیحات حداکثر ۱۰۰۰ کاراکتر باشد";
        var values = new[] { request.FullName, request.CompanyName, request.JobTitle, request.Industry, request.Department, request.Email, request.Website, request.Address, request.Notes };
        if (values.Where(x => x != null).Any(x => DangerousCode.IsMatch(x!))) return "ورود کد HTML، JavaScript یا دستور SQL مجاز نیست";
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search, CancellationToken ct)
    {
        if (search is { Length: > 100 } || search != null && DangerousCode.IsMatch(search))
            return BadRequest(new { message = "عبارت جستجو معتبر نیست" });
        var query = db.Contacts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.FullName.Contains(search) ||
                (x.CompanyName != null && x.CompanyName.Contains(search)) ||
                (x.Mobile != null && x.Mobile.Contains(search)));
        return Ok(await query.OrderBy(x => x.FullName).ToListAsync(ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => await db.Contacts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct) is { } item
            ? Ok(item) : NotFound(new { message = "مخاطب یافت نشد" });

    [HttpPost]
    [RequirePermission("contacts.create")]
    public async Task<IActionResult> Create(ContactRequest request, CancellationToken ct)
    {
        request = Normalize(request);
        if (Validate(request) is { } error) return BadRequest(new { message = error });
        var duplicate = await db.Contacts.AnyAsync(x => x.FullName == request.FullName &&
            x.CompanyName == request.CompanyName && x.Mobile == request.Mobile, ct);
        if (duplicate) return Conflict(new { message = "این مخاطب قبلاً ثبت شده است" });
        var item = new Contact { FullName = request.FullName, CompanyName = request.CompanyName,
            JobTitle = request.JobTitle, Mobile = request.Mobile, Phone = request.Phone, Email = request.Email,
            Address = request.Address, Notes = request.Notes, IsInternal = request.IsInternal,
            LinkedUserId = request.LinkedUserId, TenantId = TenantId, Industry=request.Industry, Fax=request.Fax,
            Website=request.Website, PostalCode=request.PostalCode, NationalId=request.NationalId,
            EconomicCode=request.EconomicCode, Department=request.Department, Extension=request.Extension };
        db.Contacts.Add(item); await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Get), new { id = item.Id }, item);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("contacts.edit")]
    public async Task<IActionResult> Update(Guid id, ContactRequest request, CancellationToken ct)
    {
        request = Normalize(request);
        if (Validate(request) is { } error) return BadRequest(new { message = error });
        var item = await db.Contacts.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound(new { message = "مخاطب یافت نشد" });
        item.FullName = request.FullName; item.CompanyName = request.CompanyName; item.JobTitle = request.JobTitle;
        item.Mobile = request.Mobile; item.Phone = request.Phone; item.Email = request.Email; item.Address = request.Address;
        item.Notes = request.Notes; item.IsInternal = request.IsInternal; item.LinkedUserId = request.LinkedUserId;
        item.Industry=request.Industry; item.Fax=request.Fax; item.Website=request.Website; item.PostalCode=request.PostalCode;
        item.NationalId=request.NationalId; item.EconomicCode=request.EconomicCode; item.Department=request.Department; item.Extension=request.Extension;
        await db.SaveChangesAsync(ct); return Ok(item);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("contacts.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await db.Contacts.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound();
        item.IsDeleted = true; item.DeletedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record ContactRequest(string FullName, string? CompanyName, string? JobTitle, string? Mobile,
    string? Phone, string? Email, string? Address, string? Notes, bool IsInternal, Guid? LinkedUserId,
    string? Industry = null, string? Fax = null, string? Website = null, string? PostalCode = null,
    string? NationalId = null, string? EconomicCode = null, string? Department = null, string? Extension = null);
