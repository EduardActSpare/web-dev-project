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

export function validateJobListing(input, existing = null) {
  const candidate = (key, current, fallback = "") => input[key] === undefined ? current ?? fallback : input[key];
  const values = {
    title: candidate("title", existing?.title),
    company: candidate("company", existing?.company),
    category: candidate("category", existing?.category),
    description: candidate("description", existing?.description),
    location: candidate("location", existing?.location),
    type: candidate("type", existing?.type),
    salary: candidate("salary", existing?.salary),
    salaryMin: candidate("salaryMin", existing?.salaryMin, null),
    experience: candidate("experience", existing?.experience),
    tags: candidate("tags", existing?.tags, []),
    status: candidate("status", existing?.status, "open")
  };
  const textLimits = {
    title: 120,
    company: 120,
    category: 60,
    description: 5000,
    location: 160,
    type: 32,
    salary: 100,
    experience: 80
  };

  for (const [field, maxLength] of Object.entries(textLimits)) {
    if (typeof values[field] !== "string" || values[field].trim().length > maxLength) {
      return { error: `Enter a valid ${field} of no more than ${maxLength} characters.` };
    }
    values[field] = values[field].trim();
  }
  for (const field of ["title", "company", "category", "description", "location", "type"]) {
    if (!values[field]) return { error: `The ${field} field is required.` };
  }
  if (!["Full-time", "Part-time", "Contract", "Freelance", "Temporary", "Internship"].includes(values.type)) {
    return { error: "Choose a valid employment type." };
  }
  if (values.salaryMin !== null && (!Number.isSafeInteger(values.salaryMin) || values.salaryMin < 0 || values.salaryMin > 100000000)) {
    return { error: "Enter a valid minimum salary." };
  }
  if (!Array.isArray(values.tags) || values.tags.length > 12
    || values.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.trim().length > 40)) {
    return { error: "Add up to 12 valid skills or tags, each no more than 40 characters." };
  }
  values.tags = [...new Set(values.tags.map((tag) => tag.trim()))];
  if (!["open", "closed"].includes(values.status)) {
    return { error: "Choose an open or closed job status." };
  }
  return { value: values };
}
