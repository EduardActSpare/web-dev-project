async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error("The account service is unavailable. Start the app server and try again.");
  }

  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || "The account request could not be completed.");
  }
  return result;
}

export async function currentUser() {
  const result = await request("/api/auth/session");
  return result.user;
}

export async function currentAdmin() {
  const result = await request("/api/admin/session");
  return result.admin;
}

export async function loginAdmin(credentials) {
  const result = await request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
  return result.admin;
}

export function logoutAdmin() {
  return request("/api/admin/logout", { method: "POST" });
}

export async function getAdminOverview() {
  const result = await request("/api/admin/overview");
  return result.overview;
}

export async function getAdminCustomers() {
  const result = await request("/api/admin/customers");
  return result.customers;
}

export async function updateAdminPassword(credentials) {
  const result = await request("/api/admin/password", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
  return result.message;
}

export async function register(customer) {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(customer)
  });
  return result.user;
}

export async function login(credentials) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
  return result.user;
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export async function updateCustomerProfile(profile) {
  const result = await request("/api/customers/me", {
    method: "PATCH",
    body: JSON.stringify(profile)
  });
  return result.user;
}

export async function updateCustomerPreferences(preferences) {
  const result = await request("/api/customers/me/preferences", {
    method: "PATCH",
    body: JSON.stringify(preferences)
  });
  return result.user;
}

export async function updateCustomerPassword(credentials) {
  const result = await request("/api/customers/me/password", {
    method: "POST",
    body: JSON.stringify(credentials)
  });
  return result.message;
}

export async function submitJobApplication(application) {
  const result = await request("/api/customers/me/applications", {
    method: "POST",
    body: JSON.stringify(application)
  });
  return result.application;
}

export async function getCustomerApplications() {
  const result = await request("/api/customers/me/applications");
  return result.applications;
}
