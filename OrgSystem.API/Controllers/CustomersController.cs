using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Crm;
using OrgSystem.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using OrgSystem.Infrastructure.Auth;

namespace OrgSystem.API.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class CustomersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtSettings _jwt;
    public CustomersController(AppDbContext db, IOptions<JwtSettings> jwt) { _db = db; _jwt = jwt.Value; }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> List() => Ok(await _db.Customers.AsNoTracking().OrderBy(x => x.FullName)
        .Select(x => new { x.Id, x.FullName, x.CompanyName, x.Phone, x.Email, x.IsActive }).ToListAsync());

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] CustomerLoginRequest request)
    {
        var customer = await _db.Customers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Email == request.Email && c.IsActive);

        if (customer == null || string.IsNullOrEmpty(customer.PasswordHash) ||
            !BCrypt.Net.BCrypt.Verify(request.Password, customer.PasswordHash))
            return Unauthorized(new { message = "ایمیل یا رمز عبور اشتباه است" });

        return Ok(new { id = customer.Id, fullName = customer.FullName, email = customer.Email, phone = customer.Phone,
            companyName = customer.CompanyName, accessToken = CreateCustomerToken(customer) });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] CustomerRegisterRequest request)
    {
        if (await _db.Customers.IgnoreQueryFilters().AnyAsync(c => c.Email == request.Email))
            return BadRequest(new { message = "این ایمیل قبلاً ثبت شده است" });

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            Email = request.Email,
            Phone = request.Phone,
            CompanyName = request.CompanyName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive = true,
            TenantId = Guid.Parse("00000000-0000-0000-0000-000000000001")
        };

        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();
        return Ok(new { id = customer.Id, fullName = customer.FullName, email = customer.Email,
            phone = customer.Phone, companyName = customer.CompanyName, accessToken = CreateCustomerToken(customer) });
    }

    [HttpGet("{id}/tickets")]
    [Authorize]
    public async Task<IActionResult> GetTickets(Guid id)
    {
        if (!CanAccessCustomer(id)) return Forbid();
        var tickets = await _db.Tickets
            .IgnoreQueryFilters()
            .Include(t => t.Comments)
            .Where(t => t.CustomerId == id)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id, t.Code, t.Title, t.Category, t.Priority, t.Status, t.CreatedAt, t.UpdatedAt,
                MessageCount = t.Comments.Count
            })
            .ToListAsync();
        return Ok(tickets);
    }

    [HttpPost("{id}/tickets")]
    [Authorize]
    public async Task<IActionResult> CreateTicket(Guid id, [FromBody] CreateCustomerTicketRequest request)
    {
        if (!CanAccessCustomer(id)) return Forbid();
        var customer = await _db.Customers.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == id);
        if (customer == null) return NotFound(new { message = "مشتری یافت نشد" });

        var count = await _db.Tickets.IgnoreQueryFilters().CountAsync();
        var ticket = new Ticket
        {
            Id = Guid.NewGuid(),
            Code = $"TKT-{(count + 1):D3}",
            Title = request.Title,
            Category = request.Category,
            Priority = request.Priority,
            Status = "open",
            Description = request.Description,
            CustomerId = id,
            TenantId = Guid.Parse("00000000-0000-0000-0000-000000000001")
        };
        _db.Tickets.Add(ticket);

        _db.TicketComments.Add(new TicketComment
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            Text = request.Description,
            AuthorName = customer.FullName,
            IsCustomer = true,
            TenantId = ticket.TenantId
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "تیکت با موفقیت ثبت شد", id = ticket.Id, code = ticket.Code });
    }

    [HttpGet("tickets/{ticketId}/messages")]
    [Authorize]
    public async Task<IActionResult> GetMessages(Guid ticketId)
    {
        if (!await CanAccessTicket(ticketId)) return Forbid();
        var messages = await _db.TicketComments
            .IgnoreQueryFilters()
            .Where(c => c.TicketId == ticketId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new { c.Id, c.Text, c.AuthorName, c.IsCustomer, c.CreatedAt })
            .ToListAsync();
        return Ok(messages);
    }

    [HttpPost("tickets/{ticketId}/messages")]
    [Authorize]
    public async Task<IActionResult> AddMessage(Guid ticketId, [FromBody] AddMessageRequest request)
    {
        if (!await CanAccessTicket(ticketId)) return Forbid();
        var ticket = await _db.Tickets.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == ticketId);
        if (ticket == null) return NotFound(new { message = "تیکت یافت نشد" });

        _db.TicketComments.Add(new TicketComment
        {
            Id = Guid.NewGuid(),
            TicketId = ticketId,
            Text = request.Text,
            AuthorName = request.AuthorName,
            IsCustomer = request.IsCustomer,
            TenantId = ticket.TenantId
        });

        await _db.SaveChangesAsync();
        return Ok(new { message = "پیام ارسال شد" });
    }

    private bool CanAccessCustomer(Guid id)
    {
        if (Guid.TryParse(User.FindFirst("customer_id")?.Value, out var customerId)) return customerId == id;
        return User.FindFirst("user_id") != null;
    }

    private async Task<bool> CanAccessTicket(Guid ticketId)
    {
        if (User.FindFirst("user_id") != null) return true;
        if (!Guid.TryParse(User.FindFirst("customer_id")?.Value, out var customerId)) return false;
        return await _db.Tickets.IgnoreQueryFilters().AnyAsync(x => x.Id == ticketId && x.CustomerId == customerId);
    }

    private string CreateCustomerToken(Customer customer)
    {
        var claims = new[] { new Claim("customer_id", customer.Id.ToString()),
            new Claim("tenant_id", customer.TenantId.ToString()), new Claim(ClaimTypes.Name, customer.FullName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SecretKey));
        var token = new JwtSecurityToken(_jwt.Issuer, _jwt.Audience, claims,
            expires: DateTime.UtcNow.AddHours(8), signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record CustomerLoginRequest(string Email, string Password);
public record CustomerRegisterRequest(string FullName, string Email, string? Phone, string? CompanyName, string Password);
public record CreateCustomerTicketRequest(string Title, string Category, string Priority, string Description);
public record AddMessageRequest(string Text, string AuthorName, bool IsCustomer);
