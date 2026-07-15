using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Crm;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.API.Authorization;
using OrgSystem.Domain.Entities.Notifications;
using System.Text.RegularExpressions;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/tickets"), Authorize]
[RequirePermission("tickets.view")]
public class TicketsController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);
    private static readonly Regex Dangerous = new(@"<[^>]+>|javascript\s*:|--|/\*|\*/|;\s*(select|insert|update|delete|drop|alter|exec)|\b(union\s+select|drop\s+table)",RegexOptions.IgnoreCase|RegexOptions.Compiled);
    private static readonly string[] Statuses=["open","inprogress","waiting","resolved","closed"];
    private static readonly string[] Priorities=["low","normal","high","critical"];
    private static readonly string[] Categories=["فنی","مالی","اداری","آموزش","گزارش","سایر"];
    private static string? ValidateText(string? value,int max,string label,bool required=false)
    {
        if(required&&string.IsNullOrWhiteSpace(value))return $"{label} الزامی است";
        if(value?.Length>max)return $"{label} حداکثر {max} کاراکتر باشد";
        if(value!=null&&Dangerous.IsMatch(value))return "ورود کد HTML، JavaScript یا SQL مجاز نیست";
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] Guid? assignedTo, CancellationToken ct)
    {
        var q = db.Tickets.AsNoTracking().Include(x => x.Customer).Include(x => x.Comments).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(x => x.Status == status);
        if (assignedTo.HasValue) q = q.Where(x => x.AssignedToUserId == assignedTo);
        return Ok(await q.OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.Code, x.Title, x.Description,
            x.Status, x.Priority, x.Category, x.CustomerId, CustomerName = x.Customer.FullName, x.AssignedToUserId,
            AssignedToName=db.Users.Where(u=>u.Id==x.AssignedToUserId).Select(u=>u.FullName).FirstOrDefault(),
            x.ResolvedAt, x.Resolution, x.CreatedAt, CommentCount = x.Comments.Count,
            Comments=x.Comments.OrderBy(c=>c.CreatedAt).Select(c=>new{c.Id,c.Text,c.AuthorName,c.IsCustomer,c.CreatedAt}) }).ToListAsync(ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var item = await db.Tickets.AsNoTracking().Where(x=>x.Id==id).Select(x=>new{x.Id,x.Code,x.Title,x.Description,x.Status,x.Priority,x.Category,x.CustomerId,CustomerName=x.Customer.FullName,x.AssignedToUserId,AssignedToName=db.Users.Where(u=>u.Id==x.AssignedToUserId).Select(u=>u.FullName).FirstOrDefault(),x.ResolvedAt,x.Resolution,x.CreatedAt,Comments=x.Comments.OrderBy(c=>c.CreatedAt).Select(c=>new{c.Id,c.Text,c.AuthorName,c.IsCustomer,c.CreatedAt})}).FirstOrDefaultAsync(ct);
        return item == null ? NotFound(new { message = "تیکت یافت نشد" }) : Ok(item);
    }

    [HttpPost]
    [RequirePermission("tickets.create")]
    public async Task<IActionResult> Create(InternalTicketRequest request, CancellationToken ct)
    {
        if(ValidateText(request.Title,150,"عنوان",true)is{} titleError)return BadRequest(new{message=titleError});
        if(ValidateText(request.Description,4000,"توضیحات",true)is{} descriptionError)return BadRequest(new{message=descriptionError});
        if(!Categories.Contains(request.Category))return BadRequest(new{message="دسته‌بندی معتبر نیست"});
        if(!Priorities.Contains(request.Priority))return BadRequest(new{message="اولویت معتبر نیست"});
        if (!await db.Customers.AnyAsync(x => x.Id == request.CustomerId, ct)) return BadRequest(new { message = "مشتری نامعتبر است" });
        if(request.AssignedToUserId.HasValue&&!await db.Users.AnyAsync(x=>x.Id==request.AssignedToUserId&&x.IsActive,ct))return BadRequest(new{message="کاربر مسئول معتبر نیست"});
        var sequence = await db.Tickets.CountAsync(ct) + 1;
        var item = new Ticket { Code = $"TKT-{DateTime.UtcNow:yy}-{sequence:D5}", Title = request.Title.Trim(),
            Description = request.Description.Trim(), Category = request.Category, Priority = request.Priority, Status = "open",
            CustomerId = request.CustomerId, AssignedToUserId = request.AssignedToUserId, TenantId = TenantId };
        db.Tickets.Add(item);
        if(request.AssignedToUserId.HasValue) db.Notifications.Add(new Notification{UserId=request.AssignedToUserId.Value,Title="تیکت جدید به شما تخصیص یافت",Body=$"{item.Code} — {item.Title}",Type=NotificationType.Ticket,ActionUrl="/tickets",RelatedEntityId=item.Id.ToString(),RelatedEntityType="Ticket",TenantId=TenantId});
        await db.SaveChangesAsync(ct); return CreatedAtAction(nameof(Get), new { id = item.Id }, item);
    }

    [HttpPatch("{id:guid}")]
    [RequirePermission("tickets.edit")]
    public async Task<IActionResult> Update(Guid id, UpdateTicketRequest request, CancellationToken ct)
    {
        var item = await db.Tickets.FirstOrDefaultAsync(x => x.Id == id, ct); if (item == null) return NotFound();
        if(request.Status!=null&&!Statuses.Contains(request.Status))return BadRequest(new{message="وضعیت معتبر نیست"});
        if(request.Priority!=null&&!Priorities.Contains(request.Priority))return BadRequest(new{message="اولویت معتبر نیست"});
        if(request.AssignedToUserId.HasValue&&!await db.Users.AnyAsync(x=>x.Id==request.AssignedToUserId&&x.IsActive,ct))return BadRequest(new{message="کاربر مسئول معتبر نیست"});
        if(ValidateText(request.Resolution,4000,"نتیجه رسیدگی")is{} resolutionError)return BadRequest(new{message=resolutionError});
        item.Status = request.Status ?? item.Status; item.Priority = request.Priority ?? item.Priority;
        item.AssignedToUserId = request.AssignedToUserId ?? item.AssignedToUserId; item.Resolution = request.Resolution ?? item.Resolution;
        if (item.Status is "resolved" or "closed") item.ResolvedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return Ok(item);
    }

    [HttpPost("{id:guid}/comments")]
    [RequirePermission("tickets.comment")]
    public async Task<IActionResult> Comment(Guid id, TicketCommentRequest request, CancellationToken ct)
    {
        var item = await db.Tickets.FirstOrDefaultAsync(x => x.Id == id, ct); if (item == null) return NotFound();
        if(ValidateText(request.Text,2000,"متن پاسخ",true)is{} textError)return BadRequest(new{message=textError});
        var author = User.FindFirst("full_name")?.Value ?? User.Identity?.Name ?? "کاربر";
        var comment = new TicketComment { TicketId = id, Text = request.Text.Trim(), AuthorName = author,
            IsCustomer = false, CreatedByUserId = UserId, TenantId = TenantId };
        db.TicketComments.Add(comment); await db.SaveChangesAsync(ct); return Ok(comment);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("tickets.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item=await db.Tickets.FirstOrDefaultAsync(x=>x.Id==id,ct);if(item==null)return NotFound();
        item.IsDeleted=true;item.DeletedAt=DateTime.UtcNow;await db.SaveChangesAsync(ct);return NoContent();
    }
}

public record InternalTicketRequest(string Title, string Description, string Category, string Priority, Guid CustomerId, Guid? AssignedToUserId);
public record UpdateTicketRequest(string? Status, string? Priority, Guid? AssignedToUserId, string? Resolution);
public record TicketCommentRequest(string Text);
