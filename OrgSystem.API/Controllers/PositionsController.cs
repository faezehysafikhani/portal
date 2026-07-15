using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Identity;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.API.Authorization;

namespace OrgSystem.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class PositionsController : ControllerBase
{
    private readonly AppDbContext _db;
    public PositionsController(AppDbContext db) => _db = db;
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);

    [HttpGet]
    [RequirePermission("positions.view")]
    public async Task<IActionResult> GetAll()
    {
        var positions = await _db.OrgPositions
            .OrderBy(p => p.CreatedAt)
            .Select(p => new { p.Id, p.Title, p.ParentId, p.Color, p.OrgId, p.IsSystem })
            .ToListAsync();
        return Ok(positions);
    }

    [HttpPost]
    [RequirePermission("positions.create")]
    public async Task<IActionResult> Create([FromBody] CreatePositionRequest request)
    {
        var position = new OrgPosition
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            ParentId = request.ParentId,
            Color = request.Color ?? "#1677ff",
            OrgId = "1",
            IsSystem = false,
            TenantId = TenantId
        };
        _db.OrgPositions.Add(position);
        await _db.SaveChangesAsync();
        return Ok(new { message = "سمت با موفقیت ایجاد شد", id = position.Id, title = position.Title, parentId = position.ParentId, color = position.Color, orgId = position.OrgId, isSystem = position.IsSystem });
    }

    [HttpPut("{id}")]
    [RequirePermission("positions.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePositionRequest request)
    {
        var position = await _db.OrgPositions.FirstOrDefaultAsync(p => p.Id == id);
        if (position == null) return NotFound(new { message = "سمت یافت نشد" });
        if (position.IsSystem) return BadRequest(new { message = "سمت سیستمی قابل ویرایش نیست" });

        position.Title = request.Title;
        position.ParentId = request.ParentId;
        position.Color = request.Color ?? position.Color;
        await _db.SaveChangesAsync();
        return Ok(new { message = "سمت با موفقیت ویرایش شد" });
    }

    [HttpDelete("{id}")]
    [RequirePermission("positions.delete")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var position = await _db.OrgPositions.FirstOrDefaultAsync(p => p.Id == id);
        if (position == null) return NotFound(new { message = "سمت یافت نشد" });
        if (position.IsSystem) return BadRequest(new { message = "سمت سیستمی قابل حذف نیست" });

        _db.OrgPositions.Remove(position);
        await _db.SaveChangesAsync();
        return Ok(new { message = "سمت با موفقیت حذف شد" });
    }
}

public record CreatePositionRequest(string Title, string? ParentId, string? Color);
public record UpdatePositionRequest(string Title, string? ParentId, string? Color);
