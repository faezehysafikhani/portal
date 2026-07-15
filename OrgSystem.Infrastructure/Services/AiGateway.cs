using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using OrgSystem.Domain.Entities.AI;

namespace OrgSystem.Infrastructure.Services;

public interface IAiGateway
{
    string Protect(string secret);
    Task<AiGatewayResult> CompleteAsync(AiProviderSetting setting, string systemPrompt, IEnumerable<AiGatewayMessage> messages, CancellationToken ct = default);
}

public record AiGatewayMessage(string Role, string Content);
public record AiGatewayResult(bool Success, string? Content, string? Error, int? PromptTokens = null, int? CompletionTokens = null);

public class AiGateway(IHttpClientFactory clients, IDataProtectionProvider protection) : IAiGateway
{
    private readonly IDataProtector _protector = protection.CreateProtector("OrgSystem.AI.ApiKey.v1");
    public string Protect(string secret) => _protector.Protect(secret);
    private string? Unprotect(string secret) { try { return _protector.Unprotect(secret); } catch { return null; } }

    public async Task<AiGatewayResult> CompleteAsync(AiProviderSetting setting, string systemPrompt, IEnumerable<AiGatewayMessage> messages, CancellationToken ct = default)
    {
        var apiKey = Unprotect(setting.EncryptedApiKey);
        if (string.IsNullOrWhiteSpace(apiKey)) return new(false, null, "کلید API تنظیم نشده یا قابل بازیابی نیست");
        if (!Uri.TryCreate(setting.BaseUrl.TrimEnd('/') + "/chat/completions", UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || uri.IsLoopback)
            return new(false, null, "آدرس سرویس هوش مصنوعی معتبر نیست");
        if (uri.Host is not ("api.groq.com" or "openrouter.ai")) return new(false, null, "فعلاً فقط Groq و OpenRouter مجاز هستند");
        try
        {
            var client = clients.CreateClient("ai");
            using var request = new HttpRequestMessage(HttpMethod.Post, uri);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            if (uri.Host == "openrouter.ai") { request.Headers.TryAddWithoutValidation("HTTP-Referer", "https://orgsystem.local"); request.Headers.TryAddWithoutValidation("X-Title", "OrgSystem"); }
            request.Content = JsonContent.Create(new
            {
                model = setting.Model, temperature = setting.Temperature, max_tokens = setting.MaxTokens,
                messages = new[] { new AiGatewayMessage("system", systemPrompt) }.Concat(messages)
            });
            using var response = await client.SendAsync(request, ct);
            var raw = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                var safeError = response.StatusCode == System.Net.HttpStatusCode.TooManyRequests ? "سقف استفاده سرویس تکمیل شده؛ کمی بعد دوباره تلاش کنید" : $"سرویس AI خطای {(int)response.StatusCode} برگرداند";
                return new(false, null, safeError);
            }
            using var json = JsonDocument.Parse(raw);
            var content = json.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            int? prompt = null, completion = null;
            if (json.RootElement.TryGetProperty("usage", out var usage))
            {
                if (usage.TryGetProperty("prompt_tokens", out var p)) prompt = p.GetInt32();
                if (usage.TryGetProperty("completion_tokens", out var c)) completion = c.GetInt32();
            }
            return string.IsNullOrWhiteSpace(content) ? new(false, null, "پاسخ سرویس خالی بود") : new(true, content.Trim(), null, prompt, completion);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested) { return new(false, null, "زمان پاسخ سرویس هوش مصنوعی تمام شد"); }
        catch { return new(false, null, "ارتباط امن با سرویس هوش مصنوعی برقرار نشد"); }
    }
}
