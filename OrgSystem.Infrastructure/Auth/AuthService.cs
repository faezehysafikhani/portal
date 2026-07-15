using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Identity;
using OrgSystem.Domain.Interfaces;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.Infrastructure.Auth;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(LoginRequest request, string ipAddress, CancellationToken ct = default);
    Task<AuthResult> RefreshTokenAsync(string refreshToken, string ipAddress, CancellationToken ct = default);
    Task RevokeTokenAsync(string refreshToken, string ipAddress, CancellationToken ct = default);
    Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IUnitOfWork _uow;

    public AuthService(AppDbContext context, ITokenService tokenService, IUnitOfWork uow)
    {
        _context = context;
        _tokenService = tokenService;
        _uow = uow;
    }

    private static string NormalizeUsername(string value) => string.Concat(value.Trim().Select(c => c switch
    {
        >= '۰' and <= '۹' => (char)('0' + c - '۰'),
        >= '٠' and <= '٩' => (char)('0' + c - '٠'),
        _ => char.ToLowerInvariant(c)
    }));

    public async Task<AuthResult> LoginAsync(LoginRequest request, string ipAddress, CancellationToken ct = default)
    {
        var normalizedUsername = NormalizeUsername(request.Username);
        var user = await _context.Users
            .IgnoreQueryFilters()
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .Include(u => u.UserPermissions)
                .ThenInclude(up => up.Permission)
            .FirstOrDefaultAsync(u =>
                u.Username == normalizedUsername &&
                u.TenantId == request.TenantId, ct);

        if (user == null || !user.IsActive || user.IsDeleted)
            return AuthResult.Fail("نام کاربری یا رمز عبور اشتباه است");

        if (user.LockoutEnd.HasValue && user.LockoutEnd > DateTime.UtcNow)
            return AuthResult.Fail($"اکانت تا {user.LockoutEnd.Value:HH:mm} قفل است");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            await _context.Users
                .IgnoreQueryFilters()
                .Where(u => u.Id == user.Id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(u => u.FailedLoginCount, user.FailedLoginCount + 1)
                    .SetProperty(u => u.LockoutEnd, user.FailedLoginCount >= 4
                        ? DateTime.UtcNow.AddMinutes(30)
                        : (DateTime?)null), ct);

            return AuthResult.Fail("نام کاربری یا رمز عبور اشتباه است");
        }

        var permissions = user.UserPermissions
            .Select(up => up.Permission.Code)
            .Distinct()
            .ToList();

        var accessToken = _tokenService.GenerateAccessToken(user, permissions);
        var refreshToken = _tokenService.GenerateRefreshToken(user.Id, ipAddress);
        refreshToken.TenantId = user.TenantId;
        refreshToken.UserId = user.Id;

        await _context.RefreshTokens.AddAsync(refreshToken, ct);

        await _context.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id == user.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.FailedLoginCount, 0)
                .SetProperty(u => u.LockoutEnd, (DateTime?)null)
                .SetProperty(u => u.LastLoginAt, DateTime.UtcNow)
                .SetProperty(u => u.LastLoginIp, ipAddress), ct);

        await _context.SaveChangesAsync(ct);

        return AuthResult.Success(accessToken, refreshToken.Token, user, permissions);
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken, string ipAddress, CancellationToken ct = default)
    {
        var token = await _context.RefreshTokens
            .IgnoreQueryFilters()
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserPermissions)
                    .ThenInclude(up => up.Permission)
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                        .ThenInclude(r => r.RolePermissions)
                            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken, ct);

        if (token == null || token.IsRevoked || token.ExpiresAt < DateTime.UtcNow)
            return AuthResult.Fail("توکن نامعتبر یا منقضی است");

        await _context.RefreshTokens
            .IgnoreQueryFilters()
            .Where(rt => rt.Id == token.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(rt => rt.IsRevoked, true)
                .SetProperty(rt => rt.RevokedByIp, ipAddress), ct);

        var user = token.User;
        var permissions = user.UserPermissions
            .Select(up => up.Permission.Code)
            .Distinct()
            .ToList();

        var newAccessToken = _tokenService.GenerateAccessToken(user, permissions);
        var newRefreshToken = _tokenService.GenerateRefreshToken(user.Id, ipAddress);
        newRefreshToken.TenantId = user.TenantId;
        newRefreshToken.UserId = user.Id;

        await _context.RefreshTokens.AddAsync(newRefreshToken, ct);
        await _context.SaveChangesAsync(ct);

        return AuthResult.Success(newAccessToken, newRefreshToken.Token, user, permissions);
    }

    public async Task RevokeTokenAsync(string refreshToken, string ipAddress, CancellationToken ct = default)
    {
        await _context.RefreshTokens
            .IgnoreQueryFilters()
            .Where(rt => rt.Token == refreshToken)
            .ExecuteUpdateAsync(s => s
                .SetProperty(rt => rt.IsRevoked, true)
                .SetProperty(rt => rt.RevokedByIp, ipAddress), ct);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword, CancellationToken ct = default)
    {
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user == null || newPassword.Length < 8) return false;
        if (!BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash)) return false;

        await _context.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.PasswordHash, BCrypt.Net.BCrypt.HashPassword(newPassword)), ct);

        return true;
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public Guid TenantId { get; set; }
}

public class AuthResult
{
    public bool Succeeded { get; private set; }
    public bool IsTwoFactorRequired { get; private set; }
    public string? ErrorMessage { get; private set; }
    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }
    public UserDto? User { get; private set; }
    public List<string> Permissions { get; private set; } = new();

    public static AuthResult Success(string accessToken, string refreshToken, User user, List<string> permissions) =>
        new()
        {
            Succeeded = true,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            Permissions = permissions,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                FullName = $"{user.FirstName} {user.LastName}",
                Email = user.Email,
                AvatarUrl = user.AvatarUrl,
                Department = user.Department,
                Position = user.Position
                ,Roles = user.Username.Equals("admin", StringComparison.OrdinalIgnoreCase) ? ["Admin"] : []
            }
        };

    public static AuthResult Fail(string message) =>
        new() { Succeeded = false, ErrorMessage = message };

    public static AuthResult TwoFactorRequired() =>
        new() { Succeeded = false, IsTwoFactorRequired = true };
}

public class UserDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? Department { get; set; }
    public string? Position { get; set; }
    public List<string> Roles { get; set; } = new();
}
