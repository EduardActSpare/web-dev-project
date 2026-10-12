import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function availablePort() {
  const probe = createNetServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolveClose, rejectClose) => {
    probe.close((error) => error ? rejectClose(error) : resolveClose());
  });
  return port;
}

async function startServer(port, dataDirectory, {
  googleClientId = "",
  googleClientSecret = "",
  host = "127.0.0.1",
  nodeEnv = "test"
} = {}) {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      OFFSCRIPT_DATA_DIR: dataDirectory,
      NODE_ENV: nodeEnv,
      ADMIN_USERNAME: "",
      ADMIN_PASSWORD: "",
      GOOGLE_CLIENT_ID: googleClientId,
      GOOGLE_CLIENT_SECRET: googleClientSecret,
      GOOGLE_REDIRECT_URI: `http://127.0.0.1:${port}/api/auth/google/callback`,
      NODE_NO_WARNINGS: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  await new Promise((resolveStart, rejectStart) => {
    const timeout = setTimeout(() => rejectStart(new Error(`Server did not start: ${output}`)), 8000);
    child.stdout.on("data", (chunk) => {
      if (!output.includes(`http://127.0.0.1:${port}`)) return;
      clearTimeout(timeout);
      resolveStart();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectStart(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      rejectStart(new Error(`Server exited with ${code}: ${output}`));
    });
  });
  return child;
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  let timeout;
  try {
    await Promise.race([
      once(child, "exit"),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Server did not stop.")), 5000);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

test("customer registration, login, profile persistence, and session security", { timeout: 30000 }, async (context) => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "offscript-auth-test-"));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const origin = { Origin: base };
  const password = randomBytes(24).toString("base64url");
  let child;
  context.after(async () => {
    if (child && child.exitCode === null) await stopServer(child);
    await rm(dataDirectory, { recursive: true, force: true });
  });
  child = await startServer(port, dataDirectory);

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);

  const googleNotConfigured = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
  assert.equal(googleNotConfigured.status, 302);
  assert.equal(new URL(googleNotConfigured.headers.get("location")).hash, "#/login?oauth_error=google_not_configured");

  const signup = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer",
      email: "Test-Customer@example.test",
      password,
      role: "professional",
      remember: true
    })
  });
  const signupBody = await signup.json();
  assert.equal(signup.status, 201);
  assert.equal(signupBody.user.email, "test-customer@example.test");
  assert.equal("password" in signupBody.user, false);
  assert.deepEqual(signupBody.user.preferences, { saveSearchHistory: true, reduceMotion: false });
  const setCookie = signup.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = setCookie.match(/offscript_session=[^;]+/)[0];

  const duplicate = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Duplicate Customer",
      email: "test-customer@example.test",
      password,
      role: "professional"
    })
  });
  assert.equal(duplicate.status, 409);

  const profile = await fetch(`${base}/api/customers/me`, { headers: { Cookie: cookie } });
  assert.equal(profile.status, 200);
  const emptyApplications = await fetch(`${base}/api/customers/me/applications`, { headers: { Cookie: cookie } });
  assert.deepEqual((await emptyApplications.json()).applications, []);
  const apply = await fetch(`${base}/api/customers/me/applications`, {
    method: "POST",
    headers: { ...origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: "demo:0",
      coverLetter: "I would love to bring my product design experience to your team."
    })
  });
  assert.equal(apply.status, 201);
  const applicationBody = await apply.json();
  assert.equal(applicationBody.application.jobTitle, "Senior Product Designer");
  assert.equal(applicationBody.application.company, "Airbnb");
  assert.equal(applicationBody.application.status, "submitted");
  const duplicateApplication = await fetch(`${base}/api/customers/me/applications`, {
    method: "POST",
    headers: { ...origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: "demo:0" })
  });
  assert.equal(duplicateApplication.status, 409);
  const invalidJobApplication = await fetch(`${base}/api/customers/me/applications`, {
    method: "POST",
    headers: { ...origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: "demo:900", coverLetter: "" })
  });
  assert.equal(invalidJobApplication.status, 400);
  const update = await fetch(`${base}/api/customers/me`, {
    method: "PATCH",
    headers: { ...origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer Updated",
      location: "Toronto",
      bio: "Saved to the customer database."
    })
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).user.location, "Toronto");

  const preferences = await fetch(`${base}/api/customers/me/preferences`, {
    method: "PATCH",
    headers: { ...origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ saveSearchHistory: false, reduceMotion: true })
  });
  assert.equal(preferences.status, 200);
  assert.deepEqual((await preferences.json()).user.preferences, { saveSearchHistory: false, reduceMotion: true });
  const invalidPreferences = await fetch(`${base}/api/customers/me/preferences`, {
    method: "PATCH",
    headers: { ...origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ saveSearchHistory: "false", reduceMotion: true })
  });
  assert.equal(invalidPreferences.status, 400);

  const logout = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { ...origin, Cookie: cookie }
  });
  assert.equal(logout.status, 204);
  const unauthorized = await fetch(`${base}/api/customers/me`, { headers: { Cookie: cookie } });
  assert.equal(unauthorized.status, 401);
  const applicationsUnauthorized = await fetch(`${base}/api/customers/me/applications`, { headers: { Cookie: cookie } });
  assert.equal(applicationsUnauthorized.status, 401);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "TEST-CUSTOMER@example.test",
      password
    })
  });
  assert.equal(login.status, 200);
  const loginCookie = login.headers.get("set-cookie").match(/offscript_session=[^;]+/)[0];

  const invalidLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test-customer@example.test",
      password: randomBytes(24).toString("base64url")
    })
  });
  assert.equal(invalidLogin.status, 401);

  const passwordChange = await fetch(`${base}/api/customers/me/password`, {
    method: "POST",
    headers: { ...origin, Cookie: loginCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: password, newPassword: "a-new-secure-password" })
  });
  assert.equal(passwordChange.status, 200);
  assert.equal((await fetch(`${base}/api/customers/me`, { headers: { Cookie: loginCookie } })).status, 200);
  const oldPasswordLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test-customer@example.test", password })
  });
  assert.equal(oldPasswordLogin.status, 401);
  const newPasswordLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test-customer@example.test", password: "a-new-secure-password" })
  });
  assert.equal(newPasswordLogin.status, 200);

  const database = new DatabaseSync(join(dataDirectory, "offscript.sqlite"));
  const savedCustomer = database.prepare("SELECT password_hash FROM customers WHERE email = ?")
    .get("test-customer@example.test");
  assert.ok(savedCustomer.password_hash);
  assert.equal(savedCustomer.password_hash.includes(password), false);
  database.close();

  await stopServer(child);
  child = await startServer(port, dataDirectory);
  const persistedProfile = await fetch(`${base}/api/customers/me`, { headers: { Cookie: loginCookie } });
  assert.equal(persistedProfile.status, 200);
  const persistedUser = (await persistedProfile.json()).user;
  assert.equal(persistedUser.name, "Test Customer Updated");
  assert.deepEqual(persistedUser.preferences, { saveSearchHistory: false, reduceMotion: true });
  const persistedApplications = await fetch(`${base}/api/customers/me/applications`, { headers: { Cookie: loginCookie } });
  const savedApplications = (await persistedApplications.json()).applications;
  assert.equal(persistedApplications.status, 200);
  assert.equal(savedApplications.length, 1);
  assert.equal(savedApplications[0].jobId, "demo:0");
});

test("admin bootstrap, protected customer data, password change, and logout", { timeout: 30000 }, async (context) => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "offscript-admin-test-"));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const origin = { Origin: base };
  let child;
  context.after(async () => {
    if (child && child.exitCode === null) await stopServer(child);
    await rm(dataDirectory, { recursive: true, force: true });
  });
  child = await startServer(port, dataDirectory);

  const protectedOverview = await fetch(`${base}/api/admin/overview`);
  assert.equal(protectedOverview.status, 401);
  const protectedCustomers = await fetch(`${base}/api/admin/customers`);
  assert.equal(protectedCustomers.status, 401);

  const wrongPassword = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "acttest", password: "not-the-password" })
  });
  assert.equal(wrongPassword.status, 401);

  const login = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ACTTEST", password: "actact" })
  });
  assert.equal(login.status, 200);
  const admin = await login.json();
  assert.deepEqual(admin.admin, { id: admin.admin.id, username: "acttest" });
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  const cookie = setCookie.match(/offscript_admin_session=[^;]+/)[0];
  const session = await fetch(`${base}/api/admin/session`, { headers: { Cookie: cookie } });
  assert.equal((await session.json()).admin.username, "acttest");

  const signup = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Admin View Customer",
      email: "admin-view@example.test",
      password: randomBytes(24).toString("base64url"),
      role: "employer"
    })
  });
  assert.equal(signup.status, 201);
  const employerCookie = signup.headers.get("set-cookie").match(/offscript_session=[^;]+/)[0];
  const employerApply = await fetch(`${base}/api/customers/me/applications`, {
    method: "POST",
    headers: { ...origin, Cookie: employerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: "demo:0" })
  });
  assert.equal(employerApply.status, 403);
  const overview = await fetch(`${base}/api/admin/overview`, { headers: { Cookie: cookie } });
  assert.deepEqual(await overview.json(), {
    overview: { customers: 1, professionals: 0, employers: 1, owners: 0 }
  });
  const customers = await fetch(`${base}/api/admin/customers`, { headers: { Cookie: cookie } });
  const listedCustomers = await customers.json();
  assert.equal(listedCustomers.customers[0].email, "admin-view@example.test");
  assert.equal("password_hash" in listedCustomers.customers[0], false);
  assert.equal("password" in listedCustomers.customers[0], false);

  const updatePassword = await fetch(`${base}/api/admin/password`, {
    method: "POST",
    headers: { ...origin, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "actact", newPassword: "a-stronger-test-password" })
  });
  assert.equal(updatePassword.status, 200);
  assert.match((await updatePassword.json()).message, /Other admin sessions/);
  const stillSignedIn = await fetch(`${base}/api/admin/overview`, { headers: { Cookie: cookie } });
  assert.equal(stillSignedIn.status, 200);

  const database = new DatabaseSync(join(dataDirectory, "offscript.sqlite"));
  const storedAdmin = database.prepare("SELECT password_hash FROM admins WHERE username = ?").get("acttest");
  assert.ok(storedAdmin.password_hash);
  assert.equal(storedAdmin.password_hash.includes("a-stronger-test-password"), false);
  database.close();

  const logout = await fetch(`${base}/api/admin/logout`, {
    method: "POST",
    headers: { ...origin, Cookie: cookie }
  });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(`${base}/api/admin/overview`, { headers: { Cookie: cookie } })).status, 401);
  const updatedLogin = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({ username: "acttest", password: "a-stronger-test-password" })
  });
  assert.equal(updatedLogin.status, 200);
});

test("employer job listings, access control, applications, and review workflow", { timeout: 30000 }, async (context) => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "offscript-jobs-test-"));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const origin = { Origin: base };
  let child;
  context.after(async () => {
    if (child && child.exitCode === null) await stopServer(child);
    await rm(dataDirectory, { recursive: true, force: true });
  });
  child = await startServer(port, dataDirectory);

  async function registerAccount(name, role) {
    const response = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { ...origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
        password: randomBytes(24).toString("base64url"),
        role
      })
    });
    assert.equal(response.status, 201);
    return response.headers.get("set-cookie").match(/offscript_session=[^;]+/)[0];
  }

  const employerCookie = await registerAccount("Studio Employer", "employer");
  const otherEmployerCookie = await registerAccount("Other Employer", "employer");
  const professionalCookie = await registerAccount("Creative Applicant", "professional");

  const unauthorizedListings = await fetch(`${base}/api/employer/jobs`);
  assert.equal(unauthorizedListings.status, 401);
  const forbiddenCreate = await fetch(`${base}/api/employer/jobs`, {
    method: "POST",
    headers: { ...origin, Cookie: professionalCookie, "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(forbiddenCreate.status, 403);

  const listing = await fetch(`${base}/api/employer/jobs`, {
    method: "POST",
    headers: { ...origin, Cookie: employerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Video Editor",
      company: "Northstar Studio",
      category: "Creative",
      description: "Edit brand and campaign films with our production team.",
      location: "Remote",
      type: "Contract",
      salary: "$70,000 - $90,000",
      salaryMin: 70000,
      experience: "Mid-level",
      tags: ["Premiere Pro", "Storytelling", "Premiere Pro"]
    })
  });
  assert.equal(listing.status, 201);
  const job = (await listing.json()).job;
  assert.equal(job.status, "open");
  assert.deepEqual(job.tags, ["Premiere Pro", "Storytelling"]);

  const invalidListing = await fetch(`${base}/api/employer/jobs`, {
    method: "POST",
    headers: { ...origin, Cookie: employerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Bad listing",
      company: "Northstar Studio",
      category: "Creative",
      description: "Description",
      location: "Remote",
      type: "Invented",
      tags: []
    })
  });
  assert.equal(invalidListing.status, 400);

  const publicJobs = await fetch(`${base}/api/jobs?search=Northstar&limit=1`);
  assert.equal(publicJobs.status, 200);
  const publicJobBody = await publicJobs.json();
  assert.equal(publicJobBody.jobs[0].id, job.id);
  assert.equal(publicJobBody.pagination.hasMore, false);
  const publicDetail = await fetch(`${base}/api/jobs/${job.id}`);
  assert.equal((await publicDetail.json()).job.title, "Video Editor");

  const apply = await fetch(`${base}/api/customers/me/applications`, {
    method: "POST",
    headers: { ...origin, Cookie: professionalCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: `listing:${job.id}`,
      company: "Client supplied company name",
      jobTitle: "Client supplied title",
      coverLetter: "I have several years of editing experience."
    })
  });
  assert.equal(apply.status, 201);
  const application = (await apply.json()).application;
  assert.equal(application.company, "Northstar Studio");
  assert.equal(application.jobTitle, "Video Editor");

  const employerApplications = await fetch(`${base}/api/employer/applications`, { headers: { Cookie: employerCookie } });
  const receivedApplications = (await employerApplications.json()).applications;
  assert.equal(receivedApplications.length, 1);
  assert.equal(receivedApplications[0].applicant.email, "creative.applicant@example.test");
  const otherEmployerApplications = await fetch(`${base}/api/employer/applications`, { headers: { Cookie: otherEmployerCookie } });
  assert.deepEqual((await otherEmployerApplications.json()).applications, []);

  const foreignStatusChange = await fetch(`${base}/api/employer/applications/${application.id}`, {
    method: "PATCH",
    headers: { ...origin, Cookie: otherEmployerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "accepted" })
  });
  assert.equal(foreignStatusChange.status, 404);
  const reviewed = await fetch(`${base}/api/employer/applications/${application.id}`, {
    method: "PATCH",
    headers: { ...origin, Cookie: employerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "reviewing" })
  });
  assert.equal((await reviewed.json()).application.status, "reviewing");

  const updatedJob = await fetch(`${base}/api/employer/jobs/${job.id}`, {
    method: "PATCH",
    headers: { ...origin, Cookie: employerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "closed" })
  });
  assert.equal((await updatedJob.json()).job.status, "closed");
  assert.equal((await fetch(`${base}/api/jobs/${job.id}`)).status, 404);
  const closedJobApplication = await fetch(`${base}/api/customers/me/applications`, {
    method: "POST",
    headers: { ...origin, Cookie: await registerAccount("Second Applicant", "professional"), "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: `listing:${job.id}` })
  });
  assert.equal(closedJobApplication.status, 400);

  const foreignUpdate = await fetch(`${base}/api/employer/jobs/${job.id}`, {
    method: "PATCH",
    headers: { ...origin, Cookie: otherEmployerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "open" })
  });
  assert.equal(foreignUpdate.status, 404);
  const remove = await fetch(`${base}/api/employer/jobs/${job.id}`, {
    method: "DELETE",
    headers: { ...origin, Cookie: employerCookie }
  });
  assert.equal(remove.status, 204);
  assert.deepEqual((await (await fetch(`${base}/api/customers/me/applications`, {
    headers: { Cookie: professionalCookie }
  })).json()).applications, []);
});

test("temporary starter admin cannot be exposed on a non-localhost host", { timeout: 20000 }, async (context) => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "offscript-admin-host-test-"));
  const port = await availablePort();
  let child;
  context.after(async () => {
    if (child && child.exitCode === null) await stopServer(child);
    await rm(dataDirectory, { recursive: true, force: true });
  });
  child = await startServer(port, dataDirectory);
  await stopServer(child);
  child = null;
  await assert.rejects(
    startServer(port, dataDirectory, { host: "0.0.0.0" }),
    /temporary acttest password cannot be used beyond localhost/i
  );
});

test("Google sign-in starts with a state cookie and rejects a mismatched callback state", { timeout: 15000 }, async (context) => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "offscript-google-test-"));
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  let child;
  context.after(async () => {
    if (child && child.exitCode === null) await stopServer(child);
    await rm(dataDirectory, { recursive: true, force: true });
  });
  child = await startServer(port, dataDirectory, {
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret"
  });

  const start = await fetch(`${base}/api/auth/google`, { redirect: "manual" });
  assert.equal(start.status, 302);
  const authorization = new URL(start.headers.get("location"));
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(authorization.searchParams.get("client_id"), "test-client-id");
  assert.equal(authorization.searchParams.get("redirect_uri"), `${base}/api/auth/google/callback`);
  assert.equal(authorization.searchParams.get("scope"), "openid email profile");
  const state = authorization.searchParams.get("state");
  assert.match(state, /^[a-f0-9]{64}$/);
  const setCookies = start.headers.getSetCookie();
  assert.ok(setCookies.some((cookie) => cookie.startsWith("offscript_google_state=") && /HttpOnly/.test(cookie)));

  const callback = await fetch(`${base}/api/auth/google/callback?code=unused&state=mismatch`, {
    headers: { Cookie: setCookies.map((cookie) => cookie.split(";")[0]).join("; ") },
    redirect: "manual"
  });
  assert.equal(callback.status, 302);
  assert.equal(new URL(callback.headers.get("location")).hash, "#/login?oauth_error=google_state");
  assert.ok(callback.headers.getSetCookie().some((cookie) => cookie.startsWith("offscript_google_state=") && /Max-Age=0/.test(cookie)));
});

test("Google customer fields migrate an existing customer database", { timeout: 15000 }, async (context) => {
  const dataDirectory = await mkdtemp(join(tmpdir(), "offscript-google-migration-test-"));
  const databasePath = join(dataDirectory, "offscript.sqlite");
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const legacyDatabase = new DatabaseSync(databasePath);
  legacyDatabase.exec(`
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO customers (id, name, email, role, password_hash, created_at, updated_at)
    VALUES ('legacy-id', 'Legacy Customer', 'legacy@example.test', 'professional', 'old-hash', '2024-01-01', '2024-01-01');
  `);
  legacyDatabase.close();

  let child;
  context.after(async () => {
    if (child && child.exitCode === null) await stopServer(child);
    await rm(dataDirectory, { recursive: true, force: true });
  });
  child = await startServer(port, dataDirectory);

  const migratedDatabase = new DatabaseSync(databasePath);
  const migratedCustomer = migratedDatabase.prepare("SELECT google_sub, picture FROM customers WHERE id = ?")
    .get("legacy-id");
  const googleIdentityIndex = migratedDatabase.prepare("PRAGMA index_list(customers)").all()
    .find((index) => index.name === "customers_google_sub_idx");
  assert.equal(migratedCustomer.google_sub, null);
  assert.equal(migratedCustomer.picture, "");
  assert.equal(googleIdentityIndex.unique, 1);
  migratedDatabase.close();

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
});
