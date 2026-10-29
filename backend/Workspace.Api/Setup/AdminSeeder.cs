
using Microsoft.AspNetCore.Identity;
using Workspace.Api.Models;

namespace Workspace.Api.Setup;

public static class AdminSeeder
{
    public static async Task CreateAdminAsync(
        IServiceProvider services,
        string email,
        string password,
        string fullName)
    {
        using var scope = services.CreateScope();

        var userManager = scope.ServiceProvider
            .GetRequiredService<UserManager<ApplicationUser>>();

        var roleManager = scope.ServiceProvider
            .GetRequiredService<RoleManager<IdentityRole>>();

        if (!await roleManager.RoleExistsAsync("HRAdmin"))
        {
            throw new InvalidOperationException(
                "HRAdmin role does not exist. Start the application first to seed roles.");
        }

        var existingUser = await userManager.FindByEmailAsync(email);

        if (existingUser is not null)
        {
            throw new InvalidOperationException(
                "An account with this email already exists.");
        }

        var admin = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FullName = fullName,
            EmailConfirmed = true
        };

        var result = await userManager.CreateAsync(admin, password);

        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        var roleResult = await userManager.AddToRoleAsync(admin, "HRAdmin");

        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(admin);

            throw new InvalidOperationException(
                string.Join("; ", roleResult.Errors.Select(e => e.Description)));
        }
    }
}
