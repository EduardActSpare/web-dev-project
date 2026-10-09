import { createServer } from "node:http";
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  closeCustomerStore,
  createCustomer,
  createAdmin,
  createAdminSession,
  createSession,
  deleteAdminSession,
  deleteSession,
  findCustomerByEmail,
  findAdminByUsername,
  findAdminSession,
  findCustomerByGoogleSub,
  findSessionCustomer,
  getAdminOverview,
  listAdminCustomers,
  linkGoogleIdentity,
  removeExpiredAdminSessions,
  removeExpiredSessions,
  toPublicCustomer,
  updateCustomerPassword,
  updateAdminPassword,
  updateCustomer
} from "./services/customerStore.js";
import { normalizeEmail, validateProfile, validateRegistration } from "./utils/validation.js";

const scrypt = promisify(scryptCallback);
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sessionCookie = "offscript_session";
const adminSessionCookie = "offscript_admin_session";
const googleStateCookie = "offscript_google_state";
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${port}/api/auth/google/callback`;
const sessionDuration = 24 * 60 * 60 * 1000;
const rememberedSessionDuration = 30 * sessionDuration;
const adminSessionDuration = 12 * 60 * 60 * 1000;
const requestBodyLimit = 16 * 1024;
const authAttempts = new Map();
const dummyPasswordHash = await hashPassword(randomBytes(32).toString("hex"));

function isLoopbackHost(value) {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(value);
}

async function ensureInitialAdmin() {
  const username = String(process.env.ADMIN_USERNAME || "acttest").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "actact");
  const existingAdmin = findAdminByUsername(username);
  if (existingAdmin) {
    const starterPasswordIsActive = username === "acttest"
      && await verifyPassword("actact", existingAdmin.password_hash);
    const serverIsExposed = process.env.NODE_ENV === "production" || !isLoopbackHost(host);
    if (starterPasswordIsActive && serverIsExposed) {
      if (password.length < 12) {
        throw new Error("The temporary acttest password cannot be used beyond localhost. Set ADMIN_PASSWORD to a unique password of at least 12 characters.");
      }
      updateAdminPassword(existingAdmin.id, await hashPassword(password), "");
      console.log("The temporary local admin password was replaced using ADMIN_PASSWORD.");
    }
    return;
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    if (process.env.ADMIN_USERNAME) throw new Error("ADMIN_USERNAME must be 3 to 32 lowercase letters, numbers, dots, underscores, or hyphens.");
    return;
  }
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Set ADMIN_USERNAME and a unique ADMIN_PASSWORD of at least 12 characters before the first production startup.");
    }
    return;
  }
  if (!isLoopbackHost(host) && password.length < 12) {
    if (process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters when the server is reachable beyond localhost.");
    }
    return;
  }
  if (process.env.NODE_ENV === "production" && password.length < 12) {
    throw new Error("Set ADMIN_PASSWORD to a unique password of at least 12 characters in production.");
  }
  const passwordHash = await hashPassword(password);
  const admin = createAdmin({
    id: randomUUID(),
    username,
    passwordHash,
    now: new Date().toISOString()
  });
  if (admin) {
    console.log(`Initial local admin account created: ${username}`);
  }
}

await ensureInitialAdmin();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return `${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [saltHex, hashHex] = storedHash.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = Buffer.from(await scrypt(password, salt, expected.length, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
  }));
  return timingSafeEqual(actual, expected);
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return [];
    const key = part.slice(0, separator).trim();
    try {
      return [[key, decodeURIComponent(part.slice(separator + 1).trim())]];
    } catch {
      return [];
    }
  }));
}

function setSessionCookie(response, token, maxAge) {
  const attributes = [
    `${sessionCookie}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  appendCookie(response, attributes.join("; "));
}

function clearSessionCookie(response) {
  const attributes = [`${sessionCookie}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  appendCookie(response, attributes.join("; "));
}

function setAdminSessionCookie(response, token) {
  const attributes = [
    `${adminSessionCookie}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(adminSessionDuration / 1000)}`
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  appendCookie(response, attributes.join("; "));
}

function clearAdminSessionCookie(response) {
  const attributes = [`${adminSessionCookie}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  appendCookie(response, attributes.join("; "));
}

function appendCookie(response, cookie) {
  const existing = response.getHeader("Set-Cookie");
  response.setHeader("Set-Cookie", [...(Array.isArray(existing) ? existing : existing ? [existing] : []), cookie]);
}

function setOAuthStateCookie(response, state) {
  const attributes = [
    `${googleStateCookie}=${encodeURIComponent(state)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600"
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  appendCookie(response, attributes.join("; "));
}

function clearOAuthStateCookie(response) {
  const attributes = [`${googleStateCookie}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  appendCookie(response, attributes.join("; "));
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  response.end();
}

function loginRedirect(query) {
  let origin = `http://127.0.0.1:${port}`;
  try {
    origin = new URL(googleRedirectUri).origin;
  } catch {
    // Keep setup errors on the local app instead of turning them into a server error.
  }
  return `${origin}/#/login?${new URLSearchParams(query)}`;
}

function oauthConfiguration() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(503, "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the server environment.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.GOOGLE_REDIRECT_URI) {
    throw new HttpError(503, "Google sign-in requires an explicit HTTPS GOOGLE_REDIRECT_URI in production.");
  }
  let callback;
  try {
    callback = new URL(googleRedirectUri);
  } catch {
    throw new HttpError(503, "Google sign-in has an invalid GOOGLE_REDIRECT_URI.");
  }
  if (callback.pathname !== "/api/auth/google/callback"
    || callback.search
    || callback.hash
    || callback.username
    || callback.password
    || !["http:", "https:"].includes(callback.protocol)
    || (process.env.NODE_ENV === "production" && callback.protocol !== "https:")) {
    throw new HttpError(503, "Google sign-in requires a valid callback URL, using HTTPS in production.");
  }
  return { clientId, clientSecret, redirectUri: callback.toString() };
}

function safeEqualText(first, second) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

async function beginGoogleSignIn(response) {
  const { clientId, redirectUri } = oauthConfiguration();
  const state = randomBytes(32).toString("hex");
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  }).toString();
  setOAuthStateCookie(response, state);
  redirect(response, authorization.toString());
}

async function exchangeGoogleCode(code, clientId, clientSecret, redirectUri) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }),
    signal: AbortSignal.timeout(10000)
  });
  const tokenResult = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || typeof tokenResult?.access_token !== "string") {
    throw new Error("Google authorization code exchange failed.");
  }

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenResult.access_token}` },
    signal: AbortSignal.timeout(10000)
  });
  const googleUser = await userResponse.json().catch(() => null);
  if (!userResponse.ok
    || typeof googleUser?.sub !== "string"
    || googleUser.sub.length > 255
    || typeof googleUser?.email !== "string"
    || googleUser.email_verified !== true) {
    throw new Error("Google did not return a verified account.");
  }
  const email = normalizeEmail(googleUser.email);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Google did not return a valid email address.");
  }
  return {
    sub: googleUser.sub,
    email,
    name: String(googleUser.name || email.split("@")[0]).trim().slice(0, 80),
    picture: typeof googleUser.picture === "string" && googleUser.picture.startsWith("https://")
      ? googleUser.picture.slice(0, 2048)
      : ""
  };
}

async function findOrCreateGoogleCustomer(googleUser) {
  const existingIdentity = findCustomerByGoogleSub(googleUser.sub);
  if (existingIdentity) {
    return linkGoogleIdentity(existingIdentity.id, googleUser.sub, googleUser.picture, new Date().toISOString())
      || existingIdentity;
  }

  const existingEmail = findCustomerByEmail(googleUser.email);
  if (existingEmail) {
    const linked = linkGoogleIdentity(existingEmail.id, googleUser.sub, googleUser.picture, new Date().toISOString());
    if (linked) return linked;
    const concurrentLink = findCustomerByGoogleSub(googleUser.sub);
    if (concurrentLink) return concurrentLink;
    throw new Error("That customer account is already connected to another Google account.");
  }

  const now = new Date().toISOString();
  const customer = createCustomer({
    id: randomUUID(),
    name: googleUser.name || "Creative professional",
    email: googleUser.email,
    role: "professional",
    passwordHash: await hashPassword(randomBytes(32).toString("hex")),
    googleSub: googleUser.sub,
    picture: googleUser.picture,
    now
  });
  if (customer) return customer;

  const concurrentlyCreated = findCustomerByGoogleSub(googleUser.sub)
    || findCustomerByEmail(googleUser.email);
  if (concurrentlyCreated?.google_sub === googleUser.sub) return concurrentlyCreated;
  if (concurrentlyCreated) {
    const linked = linkGoogleIdentity(concurrentlyCreated.id, googleUser.sub, googleUser.picture, now);
    if (linked) return linked;
  }
  throw new Error("We could not create a customer account for this Google profile.");
}

async function finishGoogleSignIn(request, response, url) {
  clearOAuthStateCookie(response);
  const queryState = url.searchParams.get("state") || "";
  const cookieState = parseCookies(request.headers.cookie)[googleStateCookie] || "";
  const code = url.searchParams.get("code") || "";
  if (url.searchParams.has("error")) {
    redirect(response, loginRedirect({ oauth_error: "google_cancelled" }));
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(cookieState) || !safeEqualText(queryState, cookieState) || !code || code.length > 4096) {
    redirect(response, loginRedirect({ oauth_error: "google_state" }));
    return;
  }

  try {
    const { clientId, clientSecret, redirectUri } = oauthConfiguration();
    const googleUser = await exchangeGoogleCode(code, clientId, clientSecret, redirectUri);
    const customer = await findOrCreateGoogleCustomer(googleUser);
    makeSession(request, response, customer.id, true);
    redirect(response, `${new URL(googleRedirectUri).origin}/#/home?oauth=google_success`);
  } catch (error) {
    console.error("Google sign-in failed:", error.message);
    redirect(response, loginRedirect({ oauth_error: "google_failed" }));
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  });
  response.end(JSON.stringify(data));
}

function sendEmpty(response, status = 204) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end();
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > requestBodyLimit) throw new HttpError(413, "The request is too large.");
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected an object.");
    return body;
  } catch {
    throw new HttpError(400, "Enter a valid JSON request.");
  }
}

function validateSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new HttpError(403, "This request origin is not allowed.");
  }
  if (parsed.host !== request.headers.host) {
    throw new HttpError(403, "This request origin is not allowed.");
  }
}

function enforceAuthLimit(request) {
  const now = Date.now();
  const key = request.socket.remoteAddress || "unknown";
  const previous = authAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (previous.resetAt <= now) {
    previous.count = 0;
    previous.resetAt = now + 15 * 60 * 1000;
  }
  previous.count += 1;
  authAttempts.set(key, previous);
  if (authAttempts.size > 1000) {
    for (const [address, record] of authAttempts) {
      if (record.resetAt <= now) authAttempts.delete(address);
    }
  }
  if (previous.count > 20) throw new HttpError(429, "Too many account attempts. Please wait and try again.");
}

function requestSessionCustomer(request) {
  const token = parseCookies(request.headers.cookie)[sessionCookie];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return findSessionCustomer(hashSessionToken(token), Date.now());
}

function requestSessionAdmin(request) {
  const token = parseCookies(request.headers.cookie)[adminSessionCookie];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return findAdminSession(hashSessionToken(token), Date.now());
}

function requireAdmin(request) {
  const admin = requestSessionAdmin(request);
  if (!admin) throw new HttpError(401, "Sign in with an admin account to continue.");
  return admin;
}

function makeAdminSession(request, response, adminId) {
  const now = Date.now();
  const token = randomBytes(32).toString("hex");
  const existingToken = parseCookies(request.headers.cookie)[adminSessionCookie];
  if (existingToken && /^[a-f0-9]{64}$/.test(existingToken)) {
    deleteAdminSession(hashSessionToken(existingToken));
  }
  removeExpiredAdminSessions(now);
  createAdminSession({
    tokenHash: hashSessionToken(token),
    adminId,
    expiresAt: now + adminSessionDuration,
    now
  });
  setAdminSessionCookie(response, token);
}

function makeSession(request, response, customerId, remember) {
  const now = Date.now();
  const duration = remember ? rememberedSessionDuration : sessionDuration;
  const token = randomBytes(32).toString("hex");
  const existingToken = parseCookies(request.headers.cookie)[sessionCookie];
  if (existingToken && /^[a-f0-9]{64}$/.test(existingToken)) {
    deleteSession(hashSessionToken(existingToken));
  }
  removeExpiredSessions(now);
  createSession({
    tokenHash: hashSessionToken(token),
    customerId,
    expiresAt: now + duration,
    now
  });
  setSessionCookie(response, token, Math.floor(duration / 1000));
}

async function handleApi(request, response, url) {
  const { pathname } = url;
  if (request.method === "GET" && pathname === "/api/health") {
    return sendJson(response, 200, { status: "ok" });
  }

  if (request.method === "GET" && pathname === "/api/auth/google") {
    try {
      await beginGoogleSignIn(response);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 503) throw error;
      redirect(response, loginRedirect({ oauth_error: "google_not_configured" }));
    }
    return;
  }

  if (request.method === "GET" && pathname === "/api/auth/google/callback") {
    await finishGoogleSignIn(request, response, url);
    return;
  }

  if (request.method === "GET" && pathname === "/api/auth/session") {
    return sendJson(response, 200, { user: requestSessionCustomer(request) });
  }

  if (request.method === "GET" && pathname === "/api/admin/session") {
    return sendJson(response, 200, { admin: requestSessionAdmin(request) });
  }

  if (request.method === "POST" && pathname === "/api/admin/login") {
    validateSameOrigin(request);
    enforceAuthLimit(request);
    const body = await readJson(request);
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || !password || password.length > 128) {
      await verifyPassword(password.slice(0, 128), dummyPasswordHash);
      throw new HttpError(401, "Admin username or password is incorrect.");
    }
    const admin = findAdminByUsername(username);
    const passwordMatches = await verifyPassword(password, admin?.password_hash || dummyPasswordHash);
    if (!admin || !passwordMatches) {
      throw new HttpError(401, "Admin username or password is incorrect.");
    }
    makeAdminSession(request, response, admin.id);
    return sendJson(response, 200, { admin: { id: admin.id, username: admin.username } });
  }

  if (request.method === "POST" && pathname === "/api/admin/logout") {
    validateSameOrigin(request);
    const token = parseCookies(request.headers.cookie)[adminSessionCookie];
    if (token && /^[a-f0-9]{64}$/.test(token)) deleteAdminSession(hashSessionToken(token));
    clearAdminSessionCookie(response);
    return sendEmpty(response);
  }

  if (request.method === "GET" && pathname === "/api/admin/overview") {
    requireAdmin(request);
    return sendJson(response, 200, { overview: getAdminOverview() });
  }

  if (request.method === "POST" && pathname === "/api/admin/password") {
    validateSameOrigin(request);
    const admin = requireAdmin(request);
    const token = parseCookies(request.headers.cookie)[adminSessionCookie];
    const body = await readJson(request);
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (currentPassword.length > 128 || newPassword.length < 12 || newPassword.length > 128) {
      throw new HttpError(400, "Enter your current password and a new password of at least 12 characters.");
    }
    const storedAdmin = findAdminByUsername(admin.username);
    if (!storedAdmin || !await verifyPassword(currentPassword, storedAdmin.password_hash)) {
      throw new HttpError(400, "Your current password is incorrect.");
    }
    updateAdminPassword(admin.id, await hashPassword(newPassword), hashSessionToken(token));
    return sendJson(response, 200, { message: "Admin password updated. Other admin sessions have been signed out." });
  }

  if (request.method === "POST" && pathname === "/api/customers/me/password") {
    validateSameOrigin(request);
    const customer = requestSessionCustomer(request);
    if (!customer) throw new HttpError(401, "Sign in to change your password.");
    const token = parseCookies(request.headers.cookie)[sessionCookie];
    const body = await readJson(request);
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (currentPassword.length > 128 || newPassword.length < 8 || newPassword.length > 128) {
      throw new HttpError(400, "Enter your current password and a new password of at least 8 characters.");
    }
    const storedCustomer = findCustomerByEmail(customer.email);
    if (!storedCustomer || !await verifyPassword(currentPassword, storedCustomer.password_hash)) {
      throw new HttpError(400, "Your current password is incorrect.");
    }
    updateCustomerPassword(customer.id, await hashPassword(newPassword), hashSessionToken(token));
    return sendJson(response, 200, { message: "Password updated. Other signed-in sessions have been signed out." });
  }

  if (request.method === "GET" && pathname === "/api/admin/customers") {
    requireAdmin(request);
    return sendJson(response, 200, { customers: listAdminCustomers() });
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    validateSameOrigin(request);
    enforceAuthLimit(request);
    const body = await readJson(request);
    const checked = validateRegistration(body);
    if (checked.error) throw new HttpError(400, checked.error);
    const { name, email, password, role } = checked.value;
    if (findCustomerByEmail(email)) throw new HttpError(409, "An account with that email already exists.");
    const passwordHash = await hashPassword(password);
    const customer = createCustomer({
      id: randomUUID(),
      name,
      email,
      role,
      passwordHash,
      now: new Date().toISOString()
    });
    if (!customer) throw new HttpError(409, "An account with that email already exists.");
    makeSession(request, response, customer.id, Boolean(body.remember));
    return sendJson(response, 201, { user: toPublicCustomer(customer) });
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    validateSameOrigin(request);
    enforceAuthLimit(request);
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 128) {
      throw new HttpError(400, "Enter your email address and password.");
    }
    const customer = findCustomerByEmail(email);
    const passwordMatches = await verifyPassword(password, customer?.password_hash || dummyPasswordHash);
    if (!customer || !passwordMatches) throw new HttpError(401, "Email or password is incorrect.");
    makeSession(request, response, customer.id, Boolean(body.remember));
    return sendJson(response, 200, { user: toPublicCustomer(customer) });
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    validateSameOrigin(request);
    const token = parseCookies(request.headers.cookie)[sessionCookie];
    if (token && /^[a-f0-9]{64}$/.test(token)) deleteSession(hashSessionToken(token));
    clearSessionCookie(response);
    return sendEmpty(response);
  }

  if (pathname === "/api/customers/me" && request.method === "GET") {
    const customer = requestSessionCustomer(request);
    if (!customer) throw new HttpError(401, "Sign in to view your account.");
    return sendJson(response, 200, { user: customer });
  }

  if (pathname === "/api/customers/me" && request.method === "PATCH") {
    validateSameOrigin(request);
    const customer = requestSessionCustomer(request);
    if (!customer) throw new HttpError(401, "Sign in to update your account.");
    const checked = validateProfile(await readJson(request));
    if (checked.error) throw new HttpError(400, checked.error);
    return sendJson(response, 200, {
      user: updateCustomer(customer.id, checked.value, new Date().toISOString())
    });
  }

  throw new HttpError(404, "API route not found.");
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"]
]);

async function serveStatic(pathname, response) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, "Invalid URL path.");
  }
  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = resolve(projectRoot, relativePath);
  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${sep}`)) {
    throw new HttpError(403, "File access is not allowed.");
  }
  let content;
  try {
    content = await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") throw new HttpError(404, "Page not found.");
    throw error;
  }
  response.writeHead(200, {
    "Content-Type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  });
  response.end(content);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    if (request.method !== "GET") {
      throw new HttpError(405, "Method not allowed.");
    }
    await serveStatic(url.pathname, response);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error("Request failed:", error);
    sendJson(response, status, {
      error: status === 500 ? "The server could not complete the request." : error.message
    });
  }
});

server.listen(port, host, () => {
  console.log(`Offscript server listening at http://${host}:${port}`);
  console.log(`Customer database: ${process.env.OFFSCRIPT_DATA_DIR || "data/"}`);
});

function shutDown() {
  server.close(() => {
    closeCustomerStore();
    process.exit(0);
  });
}

process.on("SIGINT", shutDown);
process.on("SIGTERM", shutDown);
