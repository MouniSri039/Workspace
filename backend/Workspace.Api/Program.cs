
using Workspace.Api.Setup;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Workspace.Api.Data;
using Workspace.Api.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var connectionString = builder.Configuration
    .GetConnectionString("WorkspaceDb")
    ?? throw new InvalidOperationException(
        "WorkspaceDb connection string is missing.");

// Existing employee database context
builder.Services.AddDbContext<WorkspaceDbContext>(options =>
    options.UseNpgsql(connectionString));

// Identity database context
builder.Services.AddDbContext<WorkspaceIdentityDbContext>(options =>
    options.UseNpgsql(connectionString));

// Configure user accounts and roles
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireNonAlphanumeric = true;

        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<WorkspaceIdentityDbContext>()
    .AddDefaultTokenProviders();

// Allow the React frontend to communicate with the API
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();


app.MapControllers();

await IdentitySeeder.SeedRolesAsync(app.Services);

// Temporary, local-only administrator setup.
if (args.Length > 0 && args[0] == "--create-admin")
{
    if (!app.Environment.IsDevelopment())
    {
        throw new InvalidOperationException(
            "Admin setup is only allowed in Development.");
    }

    var email = Environment.GetEnvironmentVariable("WORKSPACE_ADMIN_EMAIL");
    var password = Environment.GetEnvironmentVariable("WORKSPACE_ADMIN_PASSWORD");
    var fullName = Environment.GetEnvironmentVariable("WORKSPACE_ADMIN_NAME");

    if (string.IsNullOrWhiteSpace(email) ||
        string.IsNullOrWhiteSpace(password) ||
        string.IsNullOrWhiteSpace(fullName))
    {
        throw new InvalidOperationException(
            "Set WORKSPACE_ADMIN_EMAIL, WORKSPACE_ADMIN_PASSWORD, and WORKSPACE_ADMIN_NAME first.");
    }

    await AdminSeeder.CreateAdminAsync(
        app.Services, email, password, fullName);

    Console.WriteLine("HR administrator created successfully.");
    return;
}

app.Run();
