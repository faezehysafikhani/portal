using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OrgSystem.Domain.Interfaces;
using OrgSystem.Infrastructure.Auth;
using OrgSystem.Infrastructure.Persistence;
using OrgSystem.Infrastructure.Persistence.Repositories;
using OrgSystem.Infrastructure.Services;
using OrgSystem.API.Security;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.EnableRetryOnFailure(maxRetryCount: 3)
    )
);

// JWT Settings
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>()!;
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));

// JWT Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(
                builder.Configuration["AllowedOrigins"]?.Split(",")
                ?? ["http://localhost:5173"])
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddDataProtection();
builder.Services.AddHttpClient("sms", client => client.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddScoped<ISmsGateway, SmsGateway>();
builder.Services.AddHttpClient("ai", client => client.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddScoped<IAiGateway, AiGateway>();
builder.Services.AddScoped<SafeInputFilter>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

builder.Services.AddControllers(options => options.Filters.AddService<SafeInputFilter>())
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Auto Migration + Seed
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();

    if (!db.Tenants.Any())
    {
        var tenant = new OrgSystem.Domain.Entities.Tenants.Tenant
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            Name = "سازمان اصلی",
            Slug = "main",
            IsActive = true
        };
        db.Tenants.Add(tenant);

        var adminRole = new OrgSystem.Domain.Entities.Identity.Role
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            Name = "Admin",
            IsSystemRole = true,
            TenantId = tenant.Id
        };
        db.Roles.Add(adminRole);

        var adminUser = new OrgSystem.Domain.Entities.Identity.User
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            Username = "admin",
            Email = "admin@orgsystem.ir",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            FirstName = "مدیر",
            LastName = "سیستم",
            IsActive = true,
            TenantId = tenant.Id
        };
        db.Users.Add(adminUser);

        db.UserRoles.Add(new OrgSystem.Domain.Entities.Identity.UserRole
        {
            UserId = adminUser.Id,
            RoleId = adminRole.Id,
            TenantId = tenant.Id
        });

        await db.SaveChangesAsync();
    }

    // Idempotent baseline permissions. Existing installations receive them too.
    var tenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    var permissionSeeds = new (string Code, string Name, string Module)[]
    {
        ("users.view","مشاهده کاربران","users"),("users.create","ایجاد کاربر","users"),("users.edit","ویرایش کاربر","users"),("users.delete","حذف کاربر","users"),("users.permissions.assign","تنظیم دسترسی مستقیم کاربر","users"),("users.password.reset","بازنشانی رمز عبور","users"),
        ("letters.inbox.view","مشاهده کارتابل نامه","letters"),("letters.registry.view","مشاهده دبیرخانه","letters"),("letters.create","ایجاد نامه و پیش‌نویس","letters"),("letters.edit","ویرایش نامه","letters"),("letters.sign","امضای نامه","letters"),("letters.send","ذخیره و ارسال نامه","letters"),("letters.refer","ارجاع نامه","letters"),("letters.archive","بایگانی نامه","letters"),("letters.delete","حذف نامه","letters"),("letters.print","چاپ نامه","letters"),
        ("tickets.view","مشاهده تیکت‌ها","tickets"),("tickets.create","ایجاد تیکت","tickets"),("tickets.edit","ویرایش و تخصیص تیکت","tickets"),("tickets.comment","ثبت پاسخ تیکت","tickets"),("tickets.delete","حذف تیکت","tickets"),
        ("contacts.view","مشاهده مخاطبین","contacts"),("contacts.create","ایجاد مخاطب","contacts"),("contacts.edit","ویرایش مخاطب","contacts"),("contacts.delete","حذف مخاطب","contacts"),
        ("calendar.view","مشاهده تقویم","calendar"),("calendar.create","افزودن جلسه و رویداد","calendar"),("calendar.edit","ویرایش رویداد","calendar"),("calendar.delete","حذف رویداد","calendar"),("calendar.respond","پاسخ به دعوت جلسه","calendar"),
        ("tasks.view","مشاهده وظایف","tasks"),("tasks.create","ایجاد وظیفه","tasks"),("tasks.edit","ویرایش وظیفه","tasks"),("tasks.assign","تخصیص وظیفه","tasks"),
        ("forms.view","مشاهده فرم‌ها","forms"),("forms.create","ثبت فرم","forms"),("forms.approve","تأیید یا رد فرم","forms"),("forms.access","تنظیم دسترسی فرم‌ها","forms"),
        ("sms.view","مشاهده پیامک‌ها","sms"),("sms.settings","تنظیم پنل پیامکی","sms"),("settings.view","مشاهده تنظیمات","settings"),("settings.edit","ویرایش تنظیمات","settings"),("positions.view","مشاهده سمت‌های سازمانی","settings"),("positions.create","ایجاد سمت سازمانی","settings"),("positions.edit","ویرایش سمت سازمانی","settings"),("positions.delete","حذف سمت سازمانی","settings"),("reports.view","مشاهده گزارش‌ها","reports"),("reports.export","خروجی گزارش‌ها","reports"),("company.view","مشاهده اطلاعات شرکت","company"),("company.edit","ویرایش اطلاعات شرکت","company"),("chat.view","استفاده از چت داخلی","chat"),("ai.view","مشاهده دستیار هوشمند","ai"),("ai.use","ارسال درخواست به هوش مصنوعی","ai"),("ai.settings","تنظیم سرویس هوش مصنوعی","ai")
    };
    foreach (var seed in permissionSeeds)
    {
        if (!await db.Permissions.IgnoreQueryFilters().AnyAsync(x => x.TenantId == tenantId && x.Code == seed.Code))
            db.Permissions.Add(new OrgSystem.Domain.Entities.Identity.Permission
                { Code = seed.Code, Name = seed.Name, Module = seed.Module, TenantId = tenantId });
    }
    await db.SaveChangesAsync();
    var obsoleteCodes = new[] { "users.manage","users.roles.assign","roles.manage","roles.view","roles.create","roles.edit","roles.delete","roles.permissions.assign","letters.read","letters.manage","tickets.manage","contacts.manage","calendar.manage","tasks.manage","sms.manage" };
    var obsolete = await db.Permissions.IgnoreQueryFilters().Where(x=>x.TenantId==tenantId && obsoleteCodes.Contains(x.Code)).ToListAsync();
    if (obsolete.Count>0) { var obsoleteIds=obsolete.Select(x=>x.Id).ToList(); db.RolePermissions.RemoveRange(await db.RolePermissions.IgnoreQueryFilters().Where(x=>obsoleteIds.Contains(x.PermissionId)).ToListAsync()); db.UserPermissions.RemoveRange(await db.UserPermissions.IgnoreQueryFilters().Where(x=>obsoleteIds.Contains(x.PermissionId)).ToListAsync()); foreach(var p in obsolete){p.IsDeleted=true;p.DeletedAt=DateTime.UtcNow;} await db.SaveChangesAsync(); }
    var adminRoleId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    var permissionIds = await db.Permissions.IgnoreQueryFilters().Where(x => x.TenantId == tenantId && !x.IsDeleted).Select(x => x.Id).ToListAsync();
    var assignedIds = await db.RolePermissions.IgnoreQueryFilters().Where(x => x.RoleId == adminRoleId).Select(x => x.PermissionId).ToListAsync();
    foreach (var permissionId in permissionIds.Except(assignedIds))
        db.RolePermissions.Add(new OrgSystem.Domain.Entities.Identity.RolePermission
            { RoleId = adminRoleId, PermissionId = permissionId, TenantId = tenantId });
    var adminUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    var directIds = await db.UserPermissions.IgnoreQueryFilters().Where(x => x.UserId == adminUserId).Select(x => x.PermissionId).ToListAsync();
    foreach (var permissionId in permissionIds.Except(directIds))
        db.UserPermissions.Add(new OrgSystem.Domain.Entities.Identity.UserPermission
            { UserId = adminUserId, PermissionId = permissionId, TenantId = tenantId });

    // Repair older direct assignments that contain an action but not the
    // corresponding view/menu permission.
    var permissionIdByCode = await db.Permissions.IgnoreQueryFilters()
        .Where(x => x.TenantId == tenantId && !x.IsDeleted)
        .ToDictionaryAsync(x => x.Code, x => x.Id, StringComparer.OrdinalIgnoreCase);
    var existingDirectPermissions = await db.UserPermissions.IgnoreQueryFilters()
        .Where(x => x.TenantId == tenantId && x.UserId != adminUserId && !x.IsDeleted && !x.Permission.IsDeleted)
        .Select(x => new { x.UserId, x.Permission.Code })
        .ToListAsync();
    var startupDependencies = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["users.view"] = ["users.create", "users.edit", "users.delete", "users.permissions.assign", "users.password.reset"],
        ["letters.inbox.view"] = ["letters.create", "letters.edit", "letters.sign", "letters.send", "letters.refer", "letters.archive", "letters.delete", "letters.print"],
        ["tickets.view"] = ["tickets.create", "tickets.edit", "tickets.comment", "tickets.delete"],
        ["contacts.view"] = ["contacts.create", "contacts.edit", "contacts.delete"],
        ["calendar.view"] = ["calendar.create", "calendar.edit", "calendar.delete", "calendar.respond"],
        ["tasks.view"] = ["tasks.create", "tasks.edit", "tasks.assign"],
        ["forms.view"] = ["forms.create", "forms.approve", "forms.access"],
        ["sms.view"] = ["sms.settings"],
        ["settings.view"] = ["settings.edit", "positions.view", "positions.create", "positions.edit", "positions.delete"],
        ["positions.view"] = ["positions.create", "positions.edit", "positions.delete"],
        ["reports.view"] = ["reports.export"],
        ["ai.view"] = ["ai.use", "ai.settings"],
        ["company.view"] = ["company.edit"]
    };
    foreach (var userPermissions in existingDirectPermissions.GroupBy(x => x.UserId))
    {
        var codes = userPermissions.Select(x => x.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var dependency in startupDependencies)
        {
            if (codes.Contains(dependency.Key) || !dependency.Value.Any(codes.Contains) ||
                !permissionIdByCode.TryGetValue(dependency.Key, out var viewPermissionId)) continue;
            db.UserPermissions.Add(new OrgSystem.Domain.Entities.Identity.UserPermission
                { UserId = userPermissions.Key, PermissionId = viewPermissionId, TenantId = tenantId });
            codes.Add(dependency.Key);
        }
    }
    await db.SaveChangesAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("FrontendPolicy");
app.UseRateLimiter();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    await next();
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
