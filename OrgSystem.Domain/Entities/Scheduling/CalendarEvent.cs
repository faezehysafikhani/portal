using OrgSystem.Domain.Common;

namespace OrgSystem.Domain.Entities.Scheduling;

public class Contact : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string? CompanyName { get; set; }
    public string? JobTitle { get; set; }
    public string? Mobile { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public string? Industry { get; set; }
    public string? Fax { get; set; }
    public string? Website { get; set; }
    public string? PostalCode { get; set; }
    public string? NationalId { get; set; }
    public string? EconomicCode { get; set; }
    public string? Department { get; set; }
    public string? Extension { get; set; }
    public bool IsInternal { get; set; }
    public Guid? LinkedUserId { get; set; }
}

public class CalendarEvent : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public bool IsAllDay { get; set; }
    public string TimeZone { get; set; } = "Asia/Tehran";
    public string EventType { get; set; } = "meeting";
    public string? Location { get; set; }
    public string? OnlineMeetingUrl { get; set; }
    public string Status { get; set; } = "scheduled";
    public Guid OrganizerUserId { get; set; }
    public string OrganizerType { get; set; } = "user";
    public Guid? OrganizerContactId { get; set; }
    public string? OrganizerDisplayName { get; set; }
    public ICollection<EventAttendee> Attendees { get; set; } = new List<EventAttendee>();
    public ICollection<EventParticipant> Participants { get; set; } = new List<EventParticipant>();
    public ICollection<EventLetterLink> LetterLinks { get; set; } = new List<EventLetterLink>();
    public ICollection<EventTaskLink> TaskLinks { get; set; } = new List<EventTaskLink>();
}

public class EventParticipant : BaseEntity
{
    public Guid EventId { get; set; }
    public string PersonType { get; set; } = "user";
    public Guid PersonId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = "attendee";
    public string ResponseStatus { get; set; } = "pending";
    public CalendarEvent Event { get; set; } = null!;
}

public class EventLetterLink : BaseEntity
{
    public Guid EventId { get; set; }
    public Guid LetterId { get; set; }
    public CalendarEvent Event { get; set; } = null!;
}

public class EventTaskLink : BaseEntity
{
    public Guid EventId { get; set; }
    public Guid TaskId { get; set; }
    public CalendarEvent Event { get; set; } = null!;
}

public class EventAttendee : BaseEntity
{
    public Guid EventId { get; set; }
    public Guid UserId { get; set; }
    public string ResponseStatus { get; set; } = "pending";
    public bool IsRequired { get; set; } = true;
    public CalendarEvent Event { get; set; } = null!;
}
