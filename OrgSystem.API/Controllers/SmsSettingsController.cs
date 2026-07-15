using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Sms;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.Infrastructure.Services;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/sms-settings"), Authorize, RequirePermission("sms.settings")]
public class SmsSettingsController(AppDbContext db, ISmsGateway sms) : ControllerBase
{
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await db.SmsProviderSettings.Select(x => new { x.Id, x.ProviderName, x.ApiUrl,
        x.SenderNumber, x.Username, HasPassword = x.EncryptedPassword != "", HasApiKey = x.EncryptedApiKey != "", x.IsActive, x.LetterTemplate, x.ReferralTemplate, x.MeetingTemplate }).FirstOrDefaultAsync());

    [HttpPut]
    public async Task<IActionResult> Save(SmsSettingRequest request)
    {
        if (!Uri.TryCreate(request.ApiUrl, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.IsLoopback)
            return BadRequest(new { message = "آدرس API باید HTTPS عمومی باشد" });
        var item = await db.SmsProviderSettings.FirstOrDefaultAsync() ?? new SmsProviderSetting { TenantId = TenantId };
        if (item.Id == Guid.Empty || db.Entry(item).State == EntityState.Detached) db.SmsProviderSettings.Add(item);
        item.ProviderName=request.ProviderName.Trim(); item.ApiUrl=request.ApiUrl.Trim(); item.SenderNumber=request.SenderNumber; item.Username=request.Username?.Trim();
        item.IsActive=request.IsActive; item.LetterTemplate=request.LetterTemplate; item.ReferralTemplate=request.ReferralTemplate; item.MeetingTemplate=request.MeetingTemplate;
        if (!string.IsNullOrWhiteSpace(request.ApiKey)) item.EncryptedApiKey=sms.Protect(request.ApiKey);
        if (!string.IsNullOrWhiteSpace(request.Password)) item.EncryptedPassword=sms.Protect(request.Password);
        await db.SaveChangesAsync(); return Ok(new { message="تنظیمات پیامک ذخیره شد" });
    }

    [HttpPost("test")]
    public async Task<IActionResult> Test(TestSmsRequest request, CancellationToken ct) =>
        await sms.SendAsync(request.Phone, request.Message, UserId, ct) ? Ok(new { message="پیامک آزمایشی ارسال شد" }) : BadRequest(new { message="ارسال ناموفق بود؛ لاگ پیامک را بررسی کنید" });
}
public record SmsSettingRequest(string ProviderName,string ApiUrl,string? SenderNumber,string? Username,string? Password,string? ApiKey,bool IsActive,string LetterTemplate,string ReferralTemplate,string MeetingTemplate);
public record TestSmsRequest(string Phone,string Message);
