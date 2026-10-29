
using Microsoft.EntityFrameworkCore;
using Workspace.Api.Models;

namespace Workspace.Api.Data;

public class WorkspaceDbContext : DbContext
{
    public WorkspaceDbContext(
        DbContextOptions<WorkspaceDbContext> options)
        : base(options)
    {
    }

    public DbSet<Employee> Employees => Set<Employee>();
}
