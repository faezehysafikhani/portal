using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Crm;

public class Customer : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? NationalCode { get; set; }
    public string? EconomicCode { get; set; }
    public string? Address { get; set; }
    public CustomerType Type { get; set; } = CustomerType.Company;
    public string? Notes { get; set; }
    public string? PasswordHash { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
    public ICollection<Contract> Contracts { get; set; } = new List<Contract>();
}

public class Ticket : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "باز";
    public string Priority { get; set; } = "متوسط";
    public string Category { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? Resolution { get; set; }

    public Customer Customer { get; set; } = null!;
    public ICollection<TicketComment> Comments { get; set; } = new List<TicketComment>();
}

public class TicketComment : BaseEntity
{
    public Guid TicketId { get; set; }
    public string Text { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public bool IsCustomer { get; set; } = false;
    public Ticket Ticket { get; set; } = null!;
}

public class Contract : BaseEntity
{
    public Guid CustomerId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Amount { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = "فعال";
    public string? FileUrl { get; set; }
    public Customer Customer { get; set; } = null!;
}

public enum CustomerType { Individual, Company }