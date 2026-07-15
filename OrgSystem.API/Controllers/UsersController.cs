using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Identity;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.API.Authorization;

namespace OrgSystem.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
[RequirePermission("users.view")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    public UsersController(AppDbContext db) => _db = db;
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private static bool IsValidSignature(string? value) => string.IsNullOrWhiteSpace(value) ||
        (value.Length <= 1_500_000 && (value.StartsWith("data:image/png;base64,", StringComparison.OrdinalIgnoreCase) ||
                                     value.StartsWith("data:image/jpeg;base64,", StringComparison.OrdinalIgnoreCase)));
    private static string NormalizeDigits(string value) => string.Concat(value.Trim().Select(c => c switch
    {
        >= '۰' and <= '۹' => (char)('0' + c - '۰'),
        >= '٠' and <= '٩' => (char)('0' + c - '٠'),
        _ => c
    }));

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.Users
            .Include(u => u.UserPermissions)
            .Where(u => !u.IsDeleted)
            .Select(u => new
            {
                u.Id, u.Username, u.Email, u.FirstName, u.LastName, u.FullName,
                u.PhoneNumber, u.Department, u.Position, u.DirectManager, u.HrManager,
                u.IsActive, u.AvatarUrl, u.SignatureDataUrl, u.SignatureText, u.LastLoginAt, u.CreatedAt,
                PermissionCount = u.UserPermissions.Count
            })
            .ToListAsync();
        return Ok(users);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var user = await _db.Users
            .Include(u => u.UserPermissions)
            .IgnoreQueryFilters()
            .Where(u => u.Id == id)
            .Select(u => new
            {
                u.Id, u.Username, u.Email, u.FirstName, u.LastName, u.FullName,
                u.PhoneNumber, u.Department, u.Position, u.DirectManager, u.HrManager,
                u.IsActive, u.AvatarUrl, u.SignatureDataUrl, u.SignatureText, u.LastLoginAt, u.CreatedAt,
                PermissionCount = u.UserPermissions.Count
            })
            .FirstOrDefaultAsync();
        if (user == null) return NotFound(new { message = "کاربر یافت نشد" });
        return Ok(user);
    }

    [HttpPost]
    [RequirePermission("users.create")]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        var normalizedUsername = NormalizeDigits(request.Username);
        if (!System.Text.RegularExpressions.Regex.IsMatch(normalizedUsername, @"^\d{10}$"))
            return BadRequest(new { message = "نام کاربری باید کد ملی ۱۰ رقمی و فقط شامل عدد باشد" });
        if (request.Password.Length < 8) return BadRequest(new { message = "رمز عبور باید حداقل ۸ کاراکتر باشد" });
        if (!IsValidSignature(request.SignatureDataUrl)) return BadRequest(new { message = "امضا باید تصویر PNG یا JPEG و حداکثر یک مگابایت باشد" });
        if (await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.TenantId == TenantId && u.Username == normalizedUsername && !u.IsDeleted))
            return BadRequest(new { message = "نام کاربری قبلاً استفاده شده" });
        if (!string.IsNullOrEmpty(request.Email) && await _db.Users.AnyAsync(u => u.Email == request.Email))
            return BadRequest(new { message = "ایمیل قبلاً استفاده شده" });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = normalizedUsername,
            Email = request.Email ?? string.Empty,
            FirstName = request.FirstName,
            LastName = request.LastName,
            PhoneNumber = request.PhoneNumber,
            Department = request.Department,
            Position = request.Position,
            DirectManager = request.DirectManager,
            HrManager = request.HrManager,
            SignatureDataUrl = request.SignatureDataUrl,
            SignatureText = request.SignatureText,
            IsActive = true,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            TenantId = TenantId
        };
        _db.Users.Add(user);

        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, new { message = "کاربر با موفقیت ایجاد شد", id = user.Id });
    }

    [HttpPut("{id}")]
    [RequirePermission("users.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "کاربر یافت نشد" });
        if (!IsValidSignature(request.SignatureDataUrl)) return BadRequest(new { message = "امضا باید تصویر PNG یا JPEG و حداکثر یک مگابایت باشد" });

        user.FirstName = request.FirstName;
        user.LastName = request.LastName;
        user.Email = request.Email ?? user.Email;
        user.PhoneNumber = request.PhoneNumber;
        user.Department = request.Department;
        user.Position = request.Position;
        user.DirectManager = request.DirectManager;
        user.HrManager = request.HrManager;
        if (request.SignatureDataUrl != null) user.SignatureDataUrl = request.SignatureDataUrl;
        user.SignatureText = request.SignatureText ?? user.SignatureText;

        await _db.SaveChangesAsync();
        return Ok(new { message = "کاربر با موفقیت ویرایش شد" });
    }

    [HttpPatch("{id}/toggle-active")]
    [RequirePermission("users.edit")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "کاربر یافت نشد" });
        user.IsActive = !user.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { message = user.IsActive ? "کاربر فعال شد" : "کاربر غیرفعال شد", isActive = user.IsActive });
    }

    [HttpDelete("{id}")]
    [RequirePermission("users.delete")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "کاربر یافت نشد" });
        var currentUserId = User.FindFirst("user_id")?.Value;
        if (currentUserId == id.ToString())
            return BadRequest(new { message = "نمی‌توانید حساب خود را حذف کنید" });
        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        user.IsActive = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "کاربر با موفقیت حذف شد" });
    }

    [HttpPost("{id}/reset-password")]
    [RequirePermission("users.password.reset")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            return BadRequest(new { message = "رمز عبور باید حداقل ۸ کاراکتر باشد" });
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "کاربر یافت نشد" });
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.FailedLoginCount = 0;
        user.LockoutEnd = null;
        await _db.SaveChangesAsync();
        return Ok(new { message = "رمز عبور با موفقیت تغییر کرد" });
    }

    [HttpGet("permissions")]
    [RequirePermission("users.permissions.assign")]
    public async Task<IActionResult> GetPermissions() => Ok(await _db.Permissions.AsNoTracking()
        .OrderBy(x => x.Module).ThenBy(x => x.Name).Select(x => new { x.Id, x.Code, x.Name, x.Module }).ToListAsync());

    [HttpGet("{id:guid}/permissions")]
    [RequirePermission("users.permissions.assign")]
    public async Task<IActionResult> GetUserPermissions(Guid id)
    {
        if (!await _db.Users.AnyAsync(x => x.Id == id)) return NotFound();
        return Ok(await _db.UserPermissions.Where(x => x.UserId == id).Select(x => x.PermissionId).ToListAsync());
    }

    [HttpPut("{id:guid}/permissions")]
    [RequirePermission("users.permissions.assign")]
    public async Task<IActionResult> UpdateUserPermissions(Guid id, [FromBody] UpdateUserPermissionsRequest request)
    {
        var user = await _db.Users.Include(x => x.UserPermissions).FirstOrDefaultAsync(x => x.Id == id);
        if (user == null) return NotFound();
        // An action permission is unusable without its menu/view permission.
        // Enforce the dependency in the API so every client gets the same result.
        var requestedIds = (request.PermissionIds ?? []).Distinct().ToList();
        var selectedPermissions = await _db.Permissions
            .Where(x => requestedIds.Contains(x.Id))
            .ToListAsync();
        var selectedCodes = selectedPermissions.Select(x => x.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var viewDependencies = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["users.view"] = ["users.create", "users.edit", "users.delete", "users.permissions.assign", "users.password.reset"],
            ["letters.inbox.view"] = ["letters.create", "letters.edit", "letters.sign", "letters.send", "letters.refer", "letters.archive", "letters.delete", "letters.print"],
            ["tickets.view"] = ["tickets.create", "tickets.edit", "tickets.comment", "tickets.delete"],
            ["contacts.view"] = ["contacts.create", "contacts.edit", "contacts.delete"],
            ["calendar.view"] = ["calendar.create", "calendar.edit", "calendar.delete", "calendar.respond"],
            ["tasks.view"] = ["tasks.create", "tasks.edit", "tasks.assign"],
            ["forms.view"] = ["forms.create", "forms.approve", "forms.access"],
            ["sms.view"] = ["sms.settings"],
            ["settings.view"] = ["settings.edit", "positions.view", "positions.create", "positions.edit", "positions.delete"],
            ["positions.view"] = ["positions.create", "positions.edit", "positions.delete"],
            ["reports.view"] = ["reports.export"],
            ["ai.view"] = ["ai.use", "ai.settings"],
            ["company.view"] = ["company.edit"]
        };
        var requiredViewCodes = viewDependencies
            .Where(x => x.Value.Any(selectedCodes.Contains))
            .Select(x => x.Key)
            .Where(x => !selectedCodes.Contains(x))
            .ToList();
        if (requiredViewCodes.Count > 0)
        {
            selectedPermissions.AddRange(await _db.Permissions
                .Where(x => requiredViewCodes.Contains(x.Code))
                .ToListAsync());
        }
        var validIds = selectedPermissions.Select(x => x.Id).Distinct().ToList();
        _db.UserPermissions.RemoveRange(user.UserPermissions);
        _db.UserPermissions.AddRange(validIds.Distinct().Select(permissionId => new UserPermission
            { UserId = id, PermissionId = permissionId, TenantId = TenantId }));
        await _db.SaveChangesAsync(); return Ok(new { message = "دسترسی‌های کاربر ذخیره شد؛ کاربر باید دوباره وارد سامانه شود" });
    }
}

public record CreateUserRequest(string Username, string? Email, string Password, string FirstName, string LastName, string? PhoneNumber, string? Department, string? Position, string? DirectManager, string? HrManager, string? SignatureDataUrl, string? SignatureText);
public record UpdateUserRequest(string FirstName, string LastName, string? Email, string? PhoneNumber, string? Department, string? Position, string? DirectManager, string? HrManager, string? SignatureDataUrl, string? SignatureText);
public record ResetPasswordRequest(string NewPassword);
public record UpdateUserPermissionsRequest(List<Guid>? PermissionIds);
