
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Workspace.Api.Models;

namespace Workspace.Api.Data;

public class WorkspaceIdentityDbContext
    : IdentityDbContext<ApplicationUser>
{
    public WorkspaceIdentityDbContext(
        DbContextOptions<WorkspaceIdentityDbContext> options)
        : base(options)
    {
    }
}
