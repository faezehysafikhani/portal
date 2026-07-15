using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Letters;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController]
[Route("api/v1/letter-templates")]
[Authorize]
public class LetterTemplatesController : ControllerBase
{
    private readonly AppDbContext _db;
    public LetterTemplatesController(AppDbContext db) => _db = db;
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _db.LetterTemplates.AsNoTracking()
        .Where(x => x.IsActive)
        .OrderBy(x => x.PaperSize).ThenBy(x => x.Name)
        .Select(x => new { x.Id, x.TemplateKey, x.Name, x.PaperSize, x.HasHeader, x.HasFooter, x.ImageData, x.FileName, x.UpdatedAt })
        .ToListAsync());

    [HttpPut("{templateKey}")]
    [RequirePermission("settings.edit")]
    [RequestSizeLimit(1_500_000)]
    public async Task<IActionResult> Save(string templateKey, [FromBody] SaveLetterTemplateRequest request)
    {
        var allowedKeys = new[] { "official-a4", "official-a5", "plain-a4", "plain-a5" };
        if (!allowedKeys.Contains(templateKey, StringComparer.OrdinalIgnoreCase))
            return BadRequest(new { message = "شناسه قالب معتبر نیست" });
        if (request.PaperSize is not ("A4" or "A5"))
            return BadRequest(new { message = "اندازه کاغذ باید A4 یا A5 باشد" });
        if (string.IsNullOrWhiteSpace(request.ImageData) ||
            !(request.ImageData.StartsWith("data:image/png;base64,", StringComparison.OrdinalIgnoreCase) ||
              request.ImageData.StartsWith("data:image/jpeg;base64,", StringComparison.OrdinalIgnoreCase)))
            return BadRequest(new { message = "قالب باید تصویر PNG یا JPEG باشد" });
        byte[] imageBytes;
        try
        {
            imageBytes = Convert.FromBase64String(request.ImageData[(request.ImageData.IndexOf(',') + 1)..]);
        }
        catch (FormatException)
        {
            return BadRequest(new { message = "محتوای تصویر قالب معتبر نیست" });
        }
        if (imageBytes.Length > 500 * 1024)
            return BadRequest(new { message = "حجم واقعی تصویر قالب باید حداکثر ۵۰۰ کیلوبایت باشد" });
        var isPng = imageBytes.Length >= 8 && imageBytes[0] == 0x89 && imageBytes[1] == 0x50 && imageBytes[2] == 0x4E && imageBytes[3] == 0x47;
        var isJpeg = imageBytes.Length >= 3 && imageBytes[0] == 0xFF && imageBytes[1] == 0xD8 && imageBytes[2] == 0xFF;
        if (!isPng && !isJpeg)
            return BadRequest(new { message = "محتوای فایل با تصویر PNG یا JPEG مطابقت ندارد" });
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 100)
            return BadRequest(new { message = "نام قالب معتبر نیست" });

        var entity = await _db.LetterTemplates.FirstOrDefaultAsync(x => x.TemplateKey == templateKey);
        if (entity == null)
        {
            entity = new LetterTemplate { TemplateKey = templateKey, TenantId = TenantId };
            _db.LetterTemplates.Add(entity);
        }
        entity.Name = request.Name.Trim();
        entity.PaperSize = request.PaperSize;
        entity.HasHeader = request.HasHeader;
        entity.HasFooter = request.HasFooter;
        entity.ImageData = request.ImageData;
        entity.FileName = request.FileName;
        entity.IsActive = true;
        await _db.SaveChangesAsync();
        return Ok(new { message = "قالب نامه در دیتابیس ذخیره شد", entity.Id, entity.TemplateKey });
    }
}

public record SaveLetterTemplateRequest(string Name, string PaperSize, bool HasHeader, bool HasFooter, string ImageData, string? FileName);
