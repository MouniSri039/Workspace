import { useEffect, useState, type FormEvent } from "react";
import "./App.css";

const API_URL = "http://localhost:5233";

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
};

type Employee = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  status: "Active" | "On Leave";
  createdAt?: string;
};

type EmployeeForm = {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  department: string;
  status: "Active" | "On Leave";
};

const EMPTY_FORM: EmployeeForm = {
  firstName: "",
  lastName: "",
  email: "",
  jobTitle: "",
  department: "",
  status: "Active",
};

async function getErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) return `Request failed (${response.status}).`;

  try {
    const data = JSON.parse(text);
    return data.message ?? data.title ?? text;
  } catch {
    return text;
  }
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [activePage, setActivePage] = useState("Overview");

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(
    null,
  );
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>({
    ...EMPTY_FORM,
  });
  const [employeeFormError, setEmployeeFormError] = useState("");
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(
    null,
  );

  const canManageEmployees =
    user?.roles.some((role) => ["HRAdmin", "Manager"].includes(role)) ?? false;

  // Restore the current login session.
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });

        if (response.ok) {
          const currentUser: AuthUser = await response.json();
          if (!cancelled) setUser(currentUser);
        } else if (response.status !== 401 && !cancelled) {
          setLoginError("Unable to verify your session. Please sign in.");
        }
      } catch {
        if (!cancelled) {
          setLoginError(
            "Cannot connect to the Workspace API. Check that the backend is running.",
          );
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sign in.
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setLoginError(data.message ?? "Invalid email or password.");
        return;
      }

      setUser(data.user as AuthUser);
      setPassword("");
      setEmail("");
      setActivePage("Overview");
    } catch {
      setLoginError("Unable to connect to the server.");
    } finally {
      setLoginLoading(false);
    }
  }

  // Sign out.
  async function handleLogout() {
    setLogoutError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setLogoutError("Sign-out failed. Please try again.");
        return;
      }

      setUser(null);
      setEmployees([]);
      setPassword("");
      setSearch("");
      setError("");
      setActivePage("Overview");
      setShowEmployeeForm(false);
    } catch {
      setLogoutError("Unable to contact the server to sign out.");
    }
  }

  // Load employee records from the .NET API.
  useEffect(() => {
    if (!user) {
      setEmployees([]);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;

    async function loadEmployees() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/api/employees`, {
          credentials: "include",
        });

        if (response.status === 401) {
          if (!cancelled) {
            setUser(null);
            setError("Your session has expired. Please sign in again.");
          }
          return;
        }

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data: Employee[] = await response.json();

        if (!cancelled) {
          setEmployees(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load employees.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  function openAddEmployeeForm() {
    setEditingEmployeeId(null);
    setEmployeeForm({ ...EMPTY_FORM });
    setEmployeeFormError("");
    setShowEmployeeForm(true);
  }

  function openEditEmployeeForm(employee: Employee) {
    // Prefer the separate API fields. Repair legacy records that stored
    // the full name in firstName and left lastName empty.
    let firstName = employee.firstName?.trim() ?? "";
    let lastName = employee.lastName?.trim() ?? "";

    if (!lastName && firstName.includes(" ")) {
      const parts = firstName.split(/\s+/);
      lastName = parts.pop() ?? "";
      firstName = parts.join(" ");
    }

    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      firstName,
      lastName,
      email: employee.email ?? "",
      jobTitle: employee.jobTitle ?? "",
      department: employee.department ?? "",
      status: employee.status === "On Leave" ? "On Leave" : "Active",
    });
    setEmployeeFormError("");
    setShowEmployeeForm(true);
  }

  function handleFormChange(field: keyof EmployeeForm, value: string) {
    setEmployeeForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // Create or update an employee.
  async function handleSaveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmployeeFormError("");

    if (!canManageEmployees) {
      setEmployeeFormError("You do not have permission to manage employees.");
      return;
    }

    const payload: EmployeeForm = {
      firstName: employeeForm.firstName.trim(),
      lastName: employeeForm.lastName.trim(),
      email: employeeForm.email.trim(),
      jobTitle: employeeForm.jobTitle.trim(),
      department: employeeForm.department.trim(),
      status: employeeForm.status,
    };

    if (!payload.firstName || !payload.lastName || !payload.email) {
      setEmployeeFormError("First name, last name, and email are required.");
      return;
    }

    setSavingEmployee(true);

    try {
      const isEditing = editingEmployeeId !== null;
      const url = isEditing
        ? `${API_URL}/api/employees/${editingEmployeeId}`
        : `${API_URL}/api/employees`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setUser(null);
        setEmployeeFormError("Your session has expired. Please sign in again.");
        return;
      }

      if (response.status === 403) {
        setEmployeeFormError("You do not have permission to manage employees.");
        return;
      }

      if (!response.ok) {
        setEmployeeFormError(await getErrorMessage(response));
        return;
      }

      setShowEmployeeForm(false);
      setEditingEmployeeId(null);
      setEmployeeForm({ ...EMPTY_FORM });
      setRefreshKey((current) => current + 1);
    } catch {
      setEmployeeFormError(
        "Unable to connect to the server. Check that the backend is running.",
      );
    } finally {
      setSavingEmployee(false);
    }
  }

  // Delete an employee after confirmation.
  async function handleDeleteEmployee(employee: Employee) {
    if (!canManageEmployees) {
      setError("You do not have permission to delete employees.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${employee.firstName} ${employee.lastName}? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setDeletingEmployeeId(employee.id);

    try {
      const response = await fetch(`${API_URL}/api/employees/${employee.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.status === 401) {
        setUser(null);
        setError("Your session has expired. Please sign in again.");
        return;
      }

      if (response.status === 403) {
        setError("You do not have permission to delete employees.");
        return;
      }

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      if (editingEmployeeId === employee.id) {
        setShowEmployeeForm(false);
        setEditingEmployeeId(null);
        setEmployeeForm({ ...EMPTY_FORM });
      }

      setRefreshKey((current) => current + 1);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setDeletingEmployeeId(null);
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const searchable = [
      employee.firstName,
      employee.lastName,
      employee.email,
      employee.jobTitle,
      employee.department,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.trim().toLowerCase());
  });

  const activeEmployees = employees.filter(
    (employee) => employee.status === "Active",
  ).length;

  const departmentsCount = new Set(
    employees.map((employee) => employee.department?.trim()).filter(Boolean),
  ).size;

  const navItems = [
    { label: "Overview", icon: "⌂" },
    { label: "Employees", icon: "♙" },
    { label: "Departments", icon: "▦" },
    { label: "Leave requests", icon: "◷" },
    { label: "Settings", icon: "⚙" },
  ];

  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="brand-mark">W</div>
        <p>Loading Workspace...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="brand-mark">W</div>
          <p className="eyebrow">PEOPLE &amp; WORK</p>
          <h1>Welcome to Workspace</h1>
          <p className="login-description">Sign in to manage your workforce.</p>

          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {loginError && (
            <p className="login-error" role="alert">
              {loginError}
            </p>
          )}

          <button
            className="primary-button login-submit"
            type="submit"
            disabled={loginLoading}
          >
            {loginLoading ? "Signing in..." : "Sign in"}
          </button>

          <p className="login-footer">Secure workforce management</p>
        </form>
      </div>
    );
  }

  const fullName = (employee: Employee) =>
    `${employee.firstName} ${employee.lastName}`.trim();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <h1>Workspace</h1>
            <span>PEOPLE &amp; WORK</span>
          </div>
        </div>

        <p className="nav-caption">WORKSPACE</p>

        <nav>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`nav-item ${
                activePage === item.label ? "selected" : ""
              }`}
              onClick={() => setActivePage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.label === "Leave requests" && (
                <span className="nav-count">3</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <strong>Need a hand?</strong>
            <p>Your workspace, organized in one place.</p>
          </div>

          <div className="profile">
            <div className="avatar">{getInitials(user.fullName)}</div>
            <div className="profile-info">
              <strong>{user.fullName}</strong>
              <span>{user.roles.join(", ")}</span>
            </div>
            <button
              type="button"
              className="profile-menu"
              onClick={() => void handleLogout()}
              aria-label="Sign out"
              title="Sign out"
            >
              ↪
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / {activePage}</p>
            <h2>{activePage}</h2>
          </div>

          <div className="topbar-right">
            <span className="system-status">
              <span className="status-dot" />
              Workspace active
            </span>
            <div className="avatar">{getInitials(user.fullName)}</div>
            <button
              type="button"
              className="logout-button"
              onClick={() => void handleLogout()}
            >
              Sign out
            </button>
          </div>
        </header>

        {logoutError && (
          <p className="login-error" role="alert">
            {logoutError}
          </p>
        )}

        <section className="welcome-section">
          <div>
            <p className="eyebrow">YOUR PEOPLE, ONE WORKSPACE</p>
            <h2>Good to see you, {user.fullName.split(" ")[0]}.</h2>
            <p>Here’s what’s happening across your organization today.</p>
          </div>

          <div className="welcome-actions">
            {canManageEmployees && (
              <button
                type="button"
                className="primary-button"
                onClick={openAddEmployeeForm}
              >
                + Add employee
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setActivePage("Employees")}
            >
              Explore employees
            </button>
          </div>
        </section>

        {showEmployeeForm && (
          <section className="panel employee-form-panel">
            <div className="panel-header">
              <div>
                <h3>
                  {editingEmployeeId !== null
                    ? "Edit employee"
                    : "Add employee"}
                </h3>
                <p>
                  {editingEmployeeId !== null
                    ? "Update this employee's information."
                    : "Enter the new employee's details."}
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowEmployeeForm(false);
                  setEmployeeFormError("");
                }}
                disabled={savingEmployee}
              >
                Cancel
              </button>
            </div>

            <form className="employee-form" onSubmit={handleSaveEmployee}>
              <div className="employee-form-grid">
                <div className="form-field">
                  <label htmlFor="employee-first-name">First name *</label>
                  <input
                    id="employee-first-name"
                    value={employeeForm.firstName}
                    onChange={(event) =>
                      handleFormChange("firstName", event.target.value)
                    }
                    maxLength={100}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="employee-last-name">Last name *</label>
                  <input
                    id="employee-last-name"
                    value={employeeForm.lastName}
                    onChange={(event) =>
                      handleFormChange("lastName", event.target.value)
                    }
                    maxLength={100}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="employee-email">Email address *</label>
                  <input
                    id="employee-email"
                    type="email"
                    value={employeeForm.email}
                    onChange={(event) =>
                      handleFormChange("email", event.target.value)
                    }
                    maxLength={256}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="employee-job-title">Job title</label>
                  <input
                    id="employee-job-title"
                    value={employeeForm.jobTitle}
                    onChange={(event) =>
                      handleFormChange("jobTitle", event.target.value)
                    }
                    maxLength={120}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="employee-department">Department</label>
                  <input
                    id="employee-department"
                    value={employeeForm.department}
                    onChange={(event) =>
                      handleFormChange("department", event.target.value)
                    }
                    maxLength={120}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="employee-status">Status</label>
                  <select
                    id="employee-status"
                    value={employeeForm.status}
                    onChange={(event) =>
                      handleFormChange("status", event.target.value)
                    }
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>

              {employeeFormError && (
                <p className="login-error" role="alert">
                  {employeeFormError}
                </p>
              )}

              <div className="employee-form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={savingEmployee}
                >
                  {savingEmployee
                    ? "Saving..."
                    : editingEmployeeId !== null
                      ? "Save changes"
                      : "Save employee"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowEmployeeForm(false);
                    setEmployeeFormError("");
                  }}
                  disabled={savingEmployee}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="metrics-grid">
          <article className="metric-card">
            <div className="metric-top">
              <span>Total employees</span>
              <span className="metric-icon purple">♙</span>
            </div>
            <strong className="metric-number">
              {loading ? "—" : employees.length}
            </strong>
            <span className="metric-note">Across all departments</span>
          </article>

          <article className="metric-card">
            <div className="metric-top">
              <span>Active employees</span>
              <span className="metric-icon teal">✓</span>
            </div>
            <strong className="metric-number">
              {loading ? "—" : activeEmployees}
            </strong>
            <span className="metric-note">Currently marked active</span>
          </article>

          <article className="metric-card">
            <div className="metric-top">
              <span>Pending approvals</span>
              <span className="metric-icon orange">◷</span>
            </div>
            <strong className="metric-number">3</strong>
            <span className="metric-note">Demo data · Leave requests</span>
          </article>

          <article className="metric-card">
            <div className="metric-top">
              <span>Departments</span>
              <span className="metric-icon blue">▦</span>
            </div>
            <strong className="metric-number">
              {loading ? "—" : departmentsCount}
            </strong>
            <span className="metric-note">Represented in the directory</span>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel employee-panel">
            <div className="panel-header">
              <div>
                <h3>
                  {activePage === "Departments"
                    ? "Department directory"
                    : "Employee directory"}
                </h3>
                <p>Browse your organization's people and teams.</p>
              </div>
              <span className="record-count">
                {loading ? "Loading..." : `${filteredEmployees.length} records`}
              </span>
            </div>

            <label className="search-box">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search people or departments..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th>DEPARTMENT</th>
                    <th>STATUS</th>
                    {canManageEmployees && <th>ACTIONS</th>}
                  </tr>
                </thead>

                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={canManageEmployees ? 4 : 3}
                        className="empty-state"
                      >
                        Loading employees...
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !error &&
                    filteredEmployees.map((employee) => (
                      <tr key={employee.id}>
                        <td>
                          <div className="employee-cell">
                            <div
                              className={`employee-avatar avatar-${employee.id}`}
                            >
                              {getInitials(fullName(employee))}
                            </div>
                            <div>
                              <strong>{fullName(employee)}</strong>
                              <span>{employee.jobTitle}</span>
                              <span>{employee.email}</span>
                            </div>
                          </div>
                        </td>

                        <td>{employee.department || "—"}</td>

                        <td>
                          <span
                            className={`status-pill ${
                              employee.status === "Active" ? "active" : "leave"
                            }`}
                          >
                            {employee.status}
                          </span>
                        </td>

                        {canManageEmployees && (
                          <td>
                            <div className="employee-actions">
                              <button
                                type="button"
                                className="secondary-button employee-edit-button"
                                onClick={() => openEditEmployeeForm(employee)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="secondary-button employee-delete-button"
                                disabled={deletingEmployeeId === employee.id}
                                onClick={() =>
                                  void handleDeleteEmployee(employee)
                                }
                              >
                                {deletingEmployeeId === employee.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}

                  {!loading && !error && filteredEmployees.length === 0 && (
                    <tr>
                      <td
                        colSpan={canManageEmployees ? 4 : 3}
                        className="empty-state"
                      >
                        {search
                          ? "No matching employees found."
                          : "No employees yet. Add your first employee to get started."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel-footer">
              Employee records loaded from PostgreSQL via .NET API
            </div>
          </article>

          <aside className="right-column">
            <article className="panel activity-panel">
              <div className="panel-header">
                <div>
                  <h3>Quick overview</h3>
                  <p>Today's workspace snapshot</p>
                </div>
              </div>

              <div className="activity-item">
                <div className="activity-icon purple">↗</div>
                <div>
                  <strong>New team members</strong>
                  <p>Review onboarding progress</p>
                </div>
                <span className="activity-value">4</span>
              </div>

              <div className="activity-item">
                <div className="activity-icon orange">◷</div>
                <div>
                  <strong>Leave requests</strong>
                  <p>Waiting for approval</p>
                </div>
                <span className="activity-value">3</span>
              </div>

              <div className="activity-item">
                <div className="activity-icon teal">✓</div>
                <div>
                  <strong>Completed tasks</strong>
                  <p>Onboarding milestones</p>
                </div>
                <span className="activity-value">18</span>
              </div>
            </article>

            <article className="cloud-card">
              <div className="cloud-symbol">☁</div>
              <p className="eyebrow">BUILT FOR GROWTH</p>
              <h3>One connected workforce.</h3>
              <p>
                Workspace brings people, processes, and insights together.
                Additional integrations are coming next.
              </p>
              <span className="prototype-tag">Prototype · v0.2</span>
            </article>
          </aside>
        </section>

        <footer className="page-footer">
          <span>Workspace · Workforce management platform</span>
          <span>React + TypeScript · .NET · PostgreSQL</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
