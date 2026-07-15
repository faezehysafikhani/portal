using Microsoft.AspNetCore.Http;
using OrgSystem.Domain.Interfaces;

namespace OrgSystem.Infrastructure.Services;

public class TenantService : ITenantService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TenantService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid GetCurrentTenantId()
    {
        var context = _httpContextAccessor.HttpContext;
        if (context == null) return Guid.Empty;

        var tenantClaim = context.User?.FindFirst("tenant_id");
        if (tenantClaim != null && Guid.TryParse(tenantClaim.Value, out var tenantId))
            return tenantId;

        if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerValue)
            && Guid.TryParse(headerValue, out var headerTenantId))
            return headerTenantId;

        return Guid.Empty;
    }

    public string GetCurrentTenantSlug()
    {
        var host = _httpContextAccessor.HttpContext?.Request.Host.Host ?? "";
        return host.Split('.').FirstOrDefault() ?? "";
    }
}