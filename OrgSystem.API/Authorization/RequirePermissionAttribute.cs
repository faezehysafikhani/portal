using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace OrgSystem.API.Authorization;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequirePermissionAttribute(string permission) : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (context.HttpContext.User.Identity?.IsAuthenticated != true) return;
        var permissions = context.HttpContext.User.FindAll("permission").Select(x => x.Value);
        var isSystemAdmin = context.HttpContext.User.IsInRole("Admin") ||
            string.Equals(context.HttpContext.User.FindFirst("username")?.Value, "admin", StringComparison.OrdinalIgnoreCase);
        if (!isSystemAdmin && !permissions.Contains(permission, StringComparer.OrdinalIgnoreCase))
            context.Result = new ObjectResult(new { message = "شما مجوز انجام این عملیات را ندارید" }) { StatusCode = 403 };
    }
}
