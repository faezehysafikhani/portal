using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.AI;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.Infrastructure.Services;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/ai-settings"), Authorize, RequirePermission("ai.settings")]
public class AiSettingsController(AppDbContext db, IAiGateway gateway) : ControllerBase
{
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private static readonly Regex SafeModel = new(@"^[A-Za-z0-9._:/-]{2,150}$", RegexOptions.Compiled);

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await db.AiProviderSettings.AsNoTracking().Select(x => new
    { x.ProviderName, x.BaseUrl, x.Model, x.MaxTokens, x.Temperature, x.SystemPrompt, x.IsActive, HasApiKey = x.EncryptedApiKey != "" }).FirstOrDefaultAsync());

    [HttpPut]
    public async Task<IActionResult> Save(AiSettingRequest request)
    {
        if (!Uri.TryCreate(request.BaseUrl?.TrimEnd('/'), UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.IsLoopback || uri.Host is not ("api.groq.com" or "openrouter.ai"))
            return BadRequest(new { message = "آدرس API باید HTTPS و مربوط به Groq یا OpenRouter باشد" });
        if (!SafeModel.IsMatch(request.Model ?? "")) return BadRequest(new { message = "نام مدل معتبر نیست" });
        if (request.MaxTokens is < 100 or > 4000) return BadRequest(new { message = "حداکثر توکن باید بین ۱۰۰ تا ۴۰۰۰ باشد" });
        if (request.Temperature is < 0 or > 1.5) return BadRequest(new { message = "Temperature باید بین صفر تا ۱٫۵ باشد" });
        if (request.SystemPrompt?.Length > 3000) return BadRequest(new { message = "دستور سیستمی بیش از حد طولانی است" });
        var item = await db.AiProviderSettings.FirstOrDefaultAsync() ?? new AiProviderSetting { TenantId = TenantId };
        if (db.Entry(item).State == EntityState.Detached) db.AiProviderSettings.Add(item);
        item.ProviderName = request.ProviderName?.Trim() is { Length: > 0 } name ? name[..Math.Min(name.Length, 60)] : "Groq";
        item.BaseUrl = uri!.ToString().TrimEnd('/'); item.Model = request.Model!.Trim(); item.MaxTokens = request.MaxTokens;
        item.Temperature = request.Temperature; item.SystemPrompt = request.SystemPrompt?.Trim() ?? ""; item.IsActive = request.IsActive;
        if (!string.IsNullOrWhiteSpace(request.ApiKey)) item.EncryptedApiKey = gateway.Protect(request.ApiKey.Trim());
        if (item.IsActive && string.IsNullOrWhiteSpace(item.EncryptedApiKey)) return BadRequest(new { message = "برای فعال‌سازی، API Key را وارد کنید" });
        await db.SaveChangesAsync(); return Ok(new { message = "تنظیمات هوش مصنوعی با کلید رمزنگاری‌شده ذخیره شد" });
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test(CancellationToken ct)
    {
        var setting = await db.AiProviderSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (setting == null) return BadRequest(new { message = "ابتدا تنظیمات را ذخیره کنید" });
        var result = await gateway.CompleteAsync(setting, "فقط به فارسی پاسخ بده.", [new("user", "فقط بنویس: اتصال موفق است")], ct);
        return result.Success ? Ok(new { message = "اتصال موفق بود", response = result.Content }) : BadRequest(new { message = result.Error });
    }
}

public record AiSettingRequest(string? ProviderName, string BaseUrl, string? ApiKey, string Model, int MaxTokens, double Temperature, string? SystemPrompt, bool IsActive);
