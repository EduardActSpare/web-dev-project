export const accountRoles = new Set(["professional", "employer", "owner"]);

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function validateRegistration(input) {
  const name = String(input.name ?? "").trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? "");
  const role = String(input.role ?? "");

  if (name.length < 2 || name.length > 80) {
    return { error: "Enter a name between 2 and 80 characters." };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: "Your password must be between 8 and 128 characters." };
  }
  if (!accountRoles.has(role)) {
    return { error: "Choose a valid account type." };
  }
  return { value: { name, email, password, role } };
}

export function validateProfile(input) {
  const name = String(input.name ?? "").trim();
  const bio = String(input.bio ?? "").trim();
  const location = String(input.location ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { error: "Enter a name between 2 and 80 characters." };
  }
  if (bio.length > 1000) {
    return { error: "Your bio must be 1,000 characters or fewer." };
  }
  if (location.length > 120) {
    return { error: "Your location must be 120 characters or fewer." };
  }
  return { value: { name, bio, location } };
}
