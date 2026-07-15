using Microsoft.EntityFrameworkCore;
using OrgSystem.Domain.Common;
using OrgSystem.Domain.Entities.Crm;
using OrgSystem.Domain.Entities.Identity;
using OrgSystem.Domain.Entities.Letters;
using OrgSystem.Domain.Entities.Notifications;
using OrgSystem.Domain.Entities.Sms;
using OrgSystem.Domain.Entities.Tasks;
using OrgSystem.Domain.Entities.Tenants;
using OrgSystem.Domain.Entities.Scheduling;
using OrgSystem.Domain.Interfaces;
using OrgSystem.Domain.Entities.Forms;
using OrgSystem.Domain.Entities.Communications;
using OrgSystem.Domain.Entities.AI;

namespace OrgSystem.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    private readonly ITenantService? _tenantService;
    private Guid CurrentTenantId => _tenantService?.GetCurrentTenantId() is { } id && id != Guid.Empty
        ? id
        : Guid.Parse("00000000-0000-0000-0000-000000000001");

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantService? tenantService = null) : base(options)
        => _tenantService = tenantService;

    // Identity
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserPermission> UserPermissions => Set<UserPermission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<OrgPosition> OrgPositions => Set<OrgPosition>();

    // Letters
    public DbSet<Letter> Letters => Set<Letter>();
    public DbSet<LetterRecipient> LetterRecipients => Set<LetterRecipient>();
    public DbSet<LetterAttachment> LetterAttachments => Set<LetterAttachment>();
    public DbSet<LetterWorkflowStep> LetterWorkflowSteps => Set<LetterWorkflowStep>();
    public DbSet<LetterTemplate> LetterTemplates => Set<LetterTemplate>();

    // Tasks
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<TaskComment> TaskComments => Set<TaskComment>();

    // CRM
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TicketComment> TicketComments => Set<TicketComment>();
    public DbSet<Contract> Contracts => Set<Contract>();

    // SMS
    public DbSet<SmsMessage> SmsMessages => Set<SmsMessage>();
    public DbSet<SmsProviderSetting> SmsProviderSettings => Set<SmsProviderSetting>();

    // Notifications
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<OrganizationalForm> OrganizationalForms => Set<OrganizationalForm>();
    public DbSet<FormWorkflowHistory> FormWorkflowHistories => Set<FormWorkflowHistory>();
    public DbSet<LeaveAccount> LeaveAccounts => Set<LeaveAccount>();
    public DbSet<InternalChatMessage> InternalChatMessages => Set<InternalChatMessage>();
    public DbSet<AiProviderSetting> AiProviderSettings => Set<AiProviderSetting>();
    public DbSet<AiConversation> AiConversations => Set<AiConversation>();
    public DbSet<AiChatMessage> AiChatMessages => Set<AiChatMessage>();

    // Contacts & calendar
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<CalendarEvent> CalendarEvents => Set<CalendarEvent>();
    public DbSet<EventAttendee> EventAttendees => Set<EventAttendee>();
    public DbSet<EventParticipant> EventParticipants => Set<EventParticipant>();
    public DbSet<EventLetterLink> EventLetterLinks => Set<EventLetterLink>();
    public DbSet<EventTaskLink> EventTaskLinks => Set<EventTaskLink>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        modelBuilder.Entity<EventAttendee>().HasIndex(x => new { x.EventId, x.UserId }).IsUnique();
        modelBuilder.Entity<Contract>().Property(x => x.Amount).HasPrecision(18, 2);
        modelBuilder.Entity<SmsMessage>().Property(x => x.Cost).HasPrecision(18, 2);
        modelBuilder.Entity<CalendarEvent>()
            .HasMany(x => x.Attendees).WithOne(x => x.Event).HasForeignKey(x => x.EventId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CalendarEvent>().HasMany(x => x.Participants).WithOne(x => x.Event).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CalendarEvent>().HasMany(x => x.LetterLinks).WithOne(x => x.Event).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CalendarEvent>().HasMany(x => x.TaskLinks).WithOne(x => x.Event).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<EventParticipant>().HasIndex(x => new { x.EventId, x.PersonType, x.PersonId }).IsUnique();
        modelBuilder.Entity<EventLetterLink>().HasIndex(x => new { x.EventId, x.LetterId }).IsUnique();
        modelBuilder.Entity<EventTaskLink>().HasIndex(x => new { x.EventId, x.TaskId }).IsUnique();
        modelBuilder.Entity<OrganizationalForm>().Property(x => x.RequestedHours).HasPrecision(10, 2);
        modelBuilder.Entity<LeaveAccount>().Property(x => x.AccruedHours).HasPrecision(10, 2);
        modelBuilder.Entity<LeaveAccount>().Property(x => x.UsedHours).HasPrecision(10, 2);
        modelBuilder.Entity<LeaveAccount>().HasIndex(x => x.UserId).IsUnique();
        modelBuilder.Entity<FormWorkflowHistory>().HasOne(x => x.Form).WithMany(x => x.History).HasForeignKey(x => x.FormId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<UserPermission>().HasIndex(x => new { x.UserId, x.PermissionId }).IsUnique();
        modelBuilder.Entity<LetterTemplate>().HasIndex(x => new { x.TenantId, x.TemplateKey }).IsUnique();
        modelBuilder.Entity<InternalChatMessage>().HasIndex(x => new { x.RecipientUserId, x.IsRead, x.CreatedAt });
        modelBuilder.Entity<InternalChatMessage>().HasIndex(x => new { x.SenderUserId, x.RecipientUserId, x.CreatedAt });
        modelBuilder.Entity<AiProviderSetting>().HasIndex(x => x.TenantId).IsUnique();
        modelBuilder.Entity<AiConversation>().HasIndex(x => new { x.UserId, x.CreatedAt });
        modelBuilder.Entity<AiChatMessage>().HasOne(x => x.Conversation).WithMany(x => x.Messages).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<AiChatMessage>().HasIndex(x => new { x.ConversationId, x.CreatedAt });

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType) && entityType.ClrType != typeof(Tenant))
            {
                var method = typeof(AppDbContext)
                    .GetMethod(nameof(SetTenantFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                    .MakeGenericMethod(entityType.ClrType);
                method.Invoke(this, new object[] { modelBuilder });
            }
        }
    }

    private void SetTenantFilter<T>(ModelBuilder modelBuilder) where T : BaseEntity
    {
        modelBuilder.Entity<T>().HasQueryFilter(e => e.TenantId == CurrentTenantId && !e.IsDeleted);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.TenantId == Guid.Empty)
                    entry.Entity.TenantId = CurrentTenantId;
                entry.Entity.CreatedAt = DateTime.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
