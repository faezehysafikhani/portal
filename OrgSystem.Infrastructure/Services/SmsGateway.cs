using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Sms;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.Infrastructure.Services;

public interface ISmsGateway
{
    Task<bool> SendAsync(string phone, string message, Guid userId, CancellationToken ct = default);
    string Protect(string secret);
    string? Unprotect(string secret);
}

public class SmsGateway(AppDbContext db, IHttpClientFactory clients, IDataProtectionProvider protection) : ISmsGateway
{
    private readonly IDataProtector _protector = protection.CreateProtector("OrgSystem.Sms.ApiKey.v1");
    public string Protect(string secret) => _protector.Protect(secret);
    public string? Unprotect(string secret) { try { return _protector.Unprotect(secret); } catch { return null; } }

    public async Task<bool> SendAsync(string phone, string message, Guid userId, CancellationToken ct = default)
    {
        var log = new SmsMessage { To = phone, Body = message, SentByUserId = userId };
        db.SmsMessages.Add(log);
        var setting = await db.SmsProviderSettings.FirstOrDefaultAsync(x => x.IsActive, ct);
        if (setting == null) { log.Status = SmsStatus.Failed; log.ErrorMessage = "پنل پیامکی فعال تنظیم نشده است"; await db.SaveChangesAsync(ct); return false; }
        if (!Uri.TryCreate(setting.ApiUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || uri.IsLoopback)
        { log.Status = SmsStatus.Failed; log.ErrorMessage = "آدرس پنل پیامکی نامعتبر است"; await db.SaveChangesAsync(ct); return false; }
        try
        {
            var client = clients.CreateClient("sms");
            var password = Unprotect(setting.EncryptedPassword);
            if (!string.IsNullOrWhiteSpace(setting.Username) && !string.IsNullOrWhiteSpace(password))
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{setting.Username}:{password}")));
            else
            {
                var apiKey = Unprotect(setting.EncryptedApiKey);
                if (!string.IsNullOrWhiteSpace(apiKey)) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            }
            var response = await client.PostAsJsonAsync(uri, new { receptor = phone, message, sender = setting.SenderNumber }, ct);
            log.Status = response.IsSuccessStatusCode ? SmsStatus.Sent : SmsStatus.Failed;
            log.ErrorMessage = response.IsSuccessStatusCode ? null : $"HTTP {(int)response.StatusCode}";
            log.SentAt = response.IsSuccessStatusCode ? DateTime.UtcNow : null;
        }
        catch (Exception ex) { log.Status = SmsStatus.Failed; log.ErrorMessage = ex.Message[..Math.Min(ex.Message.Length, 500)]; }
        await db.SaveChangesAsync(ct); return log.Status == SmsStatus.Sent;
    }
}
