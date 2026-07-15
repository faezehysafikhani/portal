using System.Collections;
using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace OrgSystem.API.Security;

public sealed partial class SafeInputFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        foreach (var value in context.ActionArguments.Values)
        {
            var error = Validate(value, new HashSet<object>(ReferenceEqualityComparer.Instance));
            if (error == null) continue;
            context.Result = new BadRequestObjectResult(new { message = error });
            return;
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }

    private static string? Validate(object? value, HashSet<object> visited)
    {
        if (value == null) return null;
        if (value is string text)
        {
            if (text.Length > 10_000) return "طول ورودی بیش از حد مجاز است";
            if (Dangerous().IsMatch(text) || text.Any(c => char.IsControl(c) && c is not '\r' and not '\n' and not '\t'))
                return "ورودی شامل کد یا نویسه غیرمجاز است";
            return null;
        }
        var type = value.GetType();
        if (type.IsPrimitive || type.IsEnum || value is DateTime or DateTimeOffset or Guid or decimal) return null;
        if (!visited.Add(value)) return null;
        if (value is IEnumerable items)
        {
            foreach (var item in items) { var error = Validate(item, visited); if (error != null) return error; }
            return null;
        }
        foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Where(p => p.CanRead))
        {
            var propertyValue = property.GetValue(value);
            if (property.Name == "Body" && propertyValue is string richText)
            {
                if (richText.Length > 100_000 || RichTextDangerous().IsMatch(richText)) return "متن نامه شامل کد یا اسکریپت غیرمجاز است";
                continue;
            }
            var error = Validate(propertyValue, visited); if (error != null) return error;
        }
        return null;
    }

    [GeneratedRegex(@"<\s*/?\s*(script|iframe|object|embed|style|link|meta)|javascript\s*:|on(error|load|click|mouse\w*)\s*=|<|>", RegexOptions.IgnoreCase)]
    private static partial Regex Dangerous();
    [GeneratedRegex(@"<\s*/?\s*(script|iframe|object|embed|style|link|meta)|javascript\s*:|on(error|load|click|mouse\w*)\s*=", RegexOptions.IgnoreCase)]
    private static partial Regex RichTextDangerous();
}
