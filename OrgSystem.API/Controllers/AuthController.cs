using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrgSystem.Infrastructure.Auth;

namespace OrgSystem.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService) => _authService = authService;

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var ipAddress = GetIpAddress();
        var result = await _authService.LoginAsync(request, ipAddress);

        if (!result.Succeeded)
        {
            if (result.IsTwoFactorRequired)
                return Ok(new { requiresTwoFactor = true });
            return Unauthorized(new { message = result.ErrorMessage });
        }

        SetRefreshTokenCookie(result.RefreshToken!);

        return Ok(new
        {
            accessToken = result.AccessToken,
            user = result.User,
            permissions = result.Permissions,
            expiresIn = 900
        });
    }

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    public async Task<IActionResult> RefreshToken()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(new { message = "توکن یافت نشد" });

        var result = await _authService.RefreshTokenAsync(refreshToken, GetIpAddress());
        if (!result.Succeeded)
            return Unauthorized(new { message = result.ErrorMessage });

        SetRefreshTokenCookie(result.RefreshToken!);
        return Ok(new
        {
            accessToken = result.AccessToken,
            user = result.User,
            permissions = result.Permissions,
            expiresIn = 900
        });
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies["refreshToken"];
        if (!string.IsNullOrEmpty(refreshToken))
            await _authService.RevokeTokenAsync(refreshToken, GetIpAddress());

        Response.Cookies.Delete("refreshToken");
        return Ok(new { message = "خروج موفق" });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = Guid.Parse(User.FindFirst("user_id")!.Value);
        var success = await _authService.ChangePasswordAsync(
            userId, request.CurrentPassword, request.NewPassword);

        return success
            ? Ok(new { message = "رمز عبور با موفقیت تغییر کرد" })
            : BadRequest(new { message = "رمز عبور فعلی اشتباه است" });
    }

    private void SetRefreshTokenCookie(string token)
    {
        Response.Cookies.Append("refreshToken", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });
    }

    private string GetIpAddress()
    {
        if (Request.Headers.TryGetValue("X-Forwarded-For", out var ip))
            return ip.ToString();
        return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
