
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Workspace.Api.Data;
using Workspace.Api.Models;

namespace Workspace.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController : ControllerBase
{
    private readonly WorkspaceDbContext _context;

    public EmployeesController(WorkspaceDbContext context)
    {
        _context = context;
    }

    // Authenticated users can view the employee directory.
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Employee>>> GetEmployees()
    {
        var employees = await _context.Employees
            .AsNoTracking()
            .OrderBy(e => e.LastName)
            .ToListAsync();

        return Ok(employees);
    }

    // Only HR administrators and managers can add employees.
    [Authorize(Roles = "HRAdmin,Manager")]
    [HttpPost]
    public async Task<ActionResult<Employee>> CreateEmployee(
        Employee employee)
    {
        if (string.IsNullOrWhiteSpace(employee.FirstName) ||
            string.IsNullOrWhiteSpace(employee.LastName) ||
            string.IsNullOrWhiteSpace(employee.Email))
        {
            return BadRequest(
                "First name, last name, and email are required.");
        }

        employee.Id = 0;
        employee.CreatedAt = DateTime.UtcNow;

        _context.Employees.Add(employee);
        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetEmployees),
            new { id = employee.Id },
            employee);
    }

    // Only HR administrators and managers can edit employees.
    [Authorize(Roles = "HRAdmin,Manager")]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<Employee>> UpdateEmployee(
        int id,
        Employee updatedEmployee)
    {
        var employee = await _context.Employees.FindAsync(id);

        if (employee is null)
        {
            return NotFound("Employee not found.");
        }

        if (string.IsNullOrWhiteSpace(updatedEmployee.FirstName) ||
            string.IsNullOrWhiteSpace(updatedEmployee.LastName) ||
            string.IsNullOrWhiteSpace(updatedEmployee.Email))
        {
            return BadRequest(
                "First name, last name, and email are required.");
        }

        employee.FirstName = updatedEmployee.FirstName.Trim();
        employee.LastName = updatedEmployee.LastName.Trim();
        employee.Email = updatedEmployee.Email.Trim();
        employee.JobTitle = updatedEmployee.JobTitle.Trim();
        employee.Department = updatedEmployee.Department.Trim();
        employee.Status = updatedEmployee.Status;

        await _context.SaveChangesAsync();

        return Ok(employee);
    }

    // Only HR administrators and managers can delete employees.
    [Authorize(Roles = "HRAdmin,Manager")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteEmployee(int id)
    {
        var employee = await _context.Employees.FindAsync(id);

        if (employee is null)
        {
            return NotFound(new
            {
                message = "Employee not found."
            });
        }

        _context.Employees.Remove(employee);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
