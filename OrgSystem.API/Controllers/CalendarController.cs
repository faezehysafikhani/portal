using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Entities.Scheduling;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.API.Authorization;
using OrgSystem.Infrastructure.Services;

namespace OrgSystem.API.Controllers;

[ApiController, Route("api/v1/calendar"), Authorize]
[RequirePermission("calendar.view")]
public class CalendarController(AppDbContext db, ISmsGateway sms) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirst("user_id")!.Value);
    private Guid TenantId => Guid.Parse(User.FindFirst("tenant_id")!.Value);

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        var start = from ?? DateTime.UtcNow.AddMonths(-1);
        var end = to ?? DateTime.UtcNow.AddMonths(3);
        var items = await db.CalendarEvents.AsNoTracking().Include(x => x.Attendees).Include(x => x.Participants)
            .Include(x => x.LetterLinks).Include(x => x.TaskLinks)
            .Where(x => x.StartAt < end && x.EndAt > start &&
                (x.OrganizerUserId == UserId || x.Attendees.Any(a => a.UserId == UserId)))
            .OrderBy(x => x.StartAt).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var item = await db.CalendarEvents.AsNoTracking().Include(x => x.Attendees).Include(x => x.Participants)
            .Include(x => x.LetterLinks).Include(x => x.TaskLinks).FirstOrDefaultAsync(x => x.Id == id, ct);
        return item == null ? NotFound(new { message = "رویداد یافت نشد" }) : Ok(ToDto(item));
    }

    [HttpPost]
    [RequirePermission("calendar.create")]
    public async Task<IActionResult> Create(CalendarEventRequest request, CancellationToken ct)
    {
        if (request.EndAt <= request.StartAt) return BadRequest(new { message = "زمان پایان باید بعد از شروع باشد" });
        var attendeeIds = request.Participants.Where(x => x.PersonType == "user").Select(x => x.PersonId).Distinct().ToList();
        var validUsers = await db.Users.Where(x => attendeeIds.Contains(x.Id) && x.IsActive).Select(x => x.Id).ToListAsync(ct);
        var validContacts = await db.Contacts.Where(x => request.Participants.Where(p => p.PersonType == "contact").Select(p => p.PersonId).Contains(x.Id))
            .Select(x => x.Id).ToListAsync(ct);
        var accessibleLetterIds = await db.Letters.Where(x => request.RelatedLetterIds.Contains(x.Id) &&
            (x.FromUserId == UserId || x.Recipients.Any(r => r.UserId == UserId))).Select(x => x.Id).ToListAsync(ct);
        var accessibleTaskIds = await db.Tasks.Where(x => request.RelatedTaskIds.Contains(x.Id) &&
            (x.AssignedByUserId == UserId || x.AssignedToUserId == UserId)).Select(x => x.Id).ToListAsync(ct);
        var organizer = request.Organizer;
        if (organizer != null && organizer.PersonType == "user" && !validUsers.Contains(organizer.PersonId) && organizer.PersonId != UserId)
            return BadRequest(new { message = "برگزارکننده انتخاب‌شده معتبر نیست" });
        if (organizer != null && organizer.PersonType == "contact" && !validContacts.Contains(organizer.PersonId))
            return BadRequest(new { message = "مخاطب برگزارکننده معتبر نیست" });
        var item = new CalendarEvent { Title = request.Title.Trim(), Description = request.Description,
            StartAt = request.StartAt.ToUniversalTime(), EndAt = request.EndAt.ToUniversalTime(), IsAllDay = request.IsAllDay,
            TimeZone = request.TimeZone ?? "Asia/Tehran", EventType = request.EventType ?? "meeting", Location = request.Location,
            OnlineMeetingUrl = request.OnlineMeetingUrl, OrganizerUserId = UserId,
            OrganizerType = organizer?.PersonType ?? "user", OrganizerContactId = organizer?.PersonType == "contact" ? organizer.PersonId : null,
            OrganizerDisplayName = organizer?.DisplayName ?? User.FindFirst("full_name")?.Value, TenantId = TenantId };
        item.Attendees = validUsers.Select(id => new EventAttendee { UserId = id, TenantId = TenantId }).ToList();
        item.Participants = request.Participants.Where(x =>
                (x.PersonType == "user" && validUsers.Contains(x.PersonId)) || (x.PersonType == "contact" && validContacts.Contains(x.PersonId)))
            .GroupBy(x => new { x.PersonType, x.PersonId }).Select(g => g.First())
            .Select(x => new EventParticipant { PersonType = x.PersonType, PersonId = x.PersonId,
                DisplayName = x.DisplayName, Role = x.Role ?? "attendee", TenantId = TenantId }).ToList();
        item.LetterLinks = accessibleLetterIds.Select(id => new EventLetterLink { LetterId = id, TenantId = TenantId }).ToList();
        item.TaskLinks = accessibleTaskIds.Select(id => new EventTaskLink { TaskId = id, TenantId = TenantId }).ToList();
        db.CalendarEvents.Add(item); await db.SaveChangesAsync(ct);
        if (request.SendSms)
        {
            var smsSetting = await db.SmsProviderSettings.FirstOrDefaultAsync(x => x.IsActive, ct);
            var userPhones = await db.Users.Where(x => validUsers.Contains(x.Id) && x.PhoneNumber != null).Select(x => x.PhoneNumber!).ToListAsync(ct);
            var contactPhones = await db.Contacts.Where(x => validContacts.Contains(x.Id)).Select(x => x.Mobile ?? x.Phone).Where(x => x != null).Select(x => x!).ToListAsync(ct);
            foreach (var phone in userPhones.Concat(contactPhones).Distinct())
            {
                var local = item.StartAt.ToLocalTime();
                var smsText = (smsSetting?.MeetingTemplate ?? "دعوت جلسه: {title} - {date} {time}")
                    .Replace("{title}", item.Title).Replace("{date}", local.ToString("yyyy/MM/dd")).Replace("{time}", local.ToString("HH:mm"));
                await sms.SendAsync(phone, smsText, UserId, ct);
            }
        }
        return CreatedAtAction(nameof(Get), new { id = item.Id }, ToDto(item));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("calendar.edit")]
    public async Task<IActionResult> Update(Guid id, CalendarEventRequest request, CancellationToken ct)
    {
        var item = await db.CalendarEvents.Include(x => x.Attendees).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound();
        if (item.OrganizerUserId != UserId) return Forbid();
        if (request.EndAt <= request.StartAt) return BadRequest(new { message = "زمان پایان باید بعد از شروع باشد" });
        item.Title = request.Title.Trim(); item.Description = request.Description; item.StartAt = request.StartAt.ToUniversalTime();
        item.EndAt = request.EndAt.ToUniversalTime(); item.IsAllDay = request.IsAllDay; item.TimeZone = request.TimeZone ?? "Asia/Tehran";
        item.EventType = request.EventType ?? "meeting"; item.Location = request.Location; item.OnlineMeetingUrl = request.OnlineMeetingUrl;
        db.EventAttendees.RemoveRange(item.Attendees);
        item.Attendees = request.Participants.Where(x => x.PersonType == "user").Select(x => x.PersonId).Distinct()
            .Select(uid => new EventAttendee { UserId = uid, TenantId = TenantId }).ToList();
        await db.SaveChangesAsync(ct); return Ok(ToDto(item));
    }

    [HttpPatch("{id:guid}/response")]
    [RequirePermission("calendar.respond")]
    public async Task<IActionResult> Respond(Guid id, EventResponseRequest request, CancellationToken ct)
    {
        if (request.Status is not ("accepted" or "declined" or "tentative")) return BadRequest(new { message = "پاسخ نامعتبر است" });
        var attendee = await db.EventAttendees.FirstOrDefaultAsync(x => x.EventId == id && x.UserId == UserId, ct);
        if (attendee == null) return NotFound(); attendee.ResponseStatus = request.Status; await db.SaveChangesAsync(ct); return Ok();
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("calendar.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await db.CalendarEvents.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (item == null) return NotFound(); if (item.OrganizerUserId != UserId) return Forbid();
        item.IsDeleted = true; item.DeletedAt = DateTime.UtcNow; await db.SaveChangesAsync(ct); return NoContent();
    }

    private static object ToDto(CalendarEvent x)
    {
        var pc = new PersianCalendar();
        string Persian(DateTime d) { var local = d.ToLocalTime(); return $"{pc.GetYear(local):0000}/{pc.GetMonth(local):00}/{pc.GetDayOfMonth(local):00}"; }
        return new { x.Id, x.Title, x.Description, x.StartAt, x.EndAt, PersianStartDate = Persian(x.StartAt),
            PersianEndDate = Persian(x.EndAt), GregorianStartDate = x.StartAt.ToString("yyyy-MM-dd"), x.IsAllDay, x.TimeZone,
            x.EventType, x.Location, x.OnlineMeetingUrl, x.Status, x.OrganizerUserId, x.OrganizerType,
            x.OrganizerContactId, x.OrganizerDisplayName,
            Attendees = x.Attendees.Select(a => new { a.UserId, a.ResponseStatus, a.IsRequired }),
            Participants = x.Participants.Select(p => new { p.PersonType, p.PersonId, p.DisplayName, p.Role, p.ResponseStatus }),
            RelatedLetterIds = x.LetterLinks.Select(l => l.LetterId), RelatedTaskIds = x.TaskLinks.Select(t => t.TaskId) };
    }
}

public record CalendarEventRequest(string Title, string? Description, DateTime StartAt, DateTime EndAt, bool IsAllDay,
    string? TimeZone, string? EventType, string? Location, string? OnlineMeetingUrl, PersonReference? Organizer,
    List<PersonReference> Participants, List<Guid> RelatedLetterIds, List<Guid> RelatedTaskIds, bool SendSms = false);
public record PersonReference(string PersonType, Guid PersonId, string DisplayName, string? Role);
public record EventResponseRequest(string Status);
