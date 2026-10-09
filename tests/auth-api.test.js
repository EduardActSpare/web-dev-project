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

  const logout = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { ...origin, Cookie: cookie }
  });
  assert.equal(logout.status, 204);
  const unauthorized = await fetch(`${base}/api/customers/me`, { headers: { Cookie: cookie } });
  assert.equal(unauthorized.status, 401);

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
  assert.equal((await persistedProfile.json()).user.name, "Test Customer Updated");
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
