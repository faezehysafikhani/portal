using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Infrastructure.Persistence;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/notifications"), Authorize]
public class NotificationsController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await db.Notifications.Where(x => x.UserId == UserId)
        .OrderByDescending(x => x.CreatedAt).Take(100)
        .Select(x => new { x.Id, Type=x.Type.ToString(), x.Title, x.Body, x.IsRead, x.ActionUrl, x.CreatedAt }).ToListAsync());

    [HttpPatch("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id) { var n=await db.Notifications.FirstOrDefaultAsync(x=>x.Id==id&&x.UserId==UserId); if(n==null)return NotFound(); n.IsRead=true;n.ReadAt=DateTime.UtcNow;await db.SaveChangesAsync();return NoContent(); }

    [HttpPatch("read-all")]
    public async Task<IActionResult> ReadAll() { var rows=await db.Notifications.Where(x=>x.UserId==UserId&&!x.IsRead).ToListAsync();foreach(var n in rows){n.IsRead=true;n.ReadAt=DateTime.UtcNow;}await db.SaveChangesAsync();return NoContent(); }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id) { var n=await db.Notifications.FirstOrDefaultAsync(x=>x.Id==id&&x.UserId==UserId);if(n==null)return NotFound();db.Notifications.Remove(n);await db.SaveChangesAsync();return NoContent(); }

    [HttpDelete]
    public async Task<IActionResult> Clear() { var rows=await db.Notifications.Where(x=>x.UserId==UserId).ToListAsync();db.Notifications.RemoveRange(rows);await db.SaveChangesAsync();return NoContent(); }
}
