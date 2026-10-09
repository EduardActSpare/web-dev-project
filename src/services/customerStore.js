import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const dataDirectory = process.env.OFFSCRIPT_DATA_DIR
  ? resolve(process.env.OFFSCRIPT_DATA_DIR)
  : resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
if (!process.env.OFFSCRIPT_DATA_DIR) chmodSync(dataDirectory, 0o700);

const databasePath = resolve(dataDirectory, "offscript.sqlite");
const database = new DatabaseSync(databasePath);
chmodSync(databasePath, 0o600);
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    role TEXT NOT NULL CHECK (role IN ('professional', 'employer', 'owner')),
    password_hash TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    google_sub TEXT,
    picture TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_customer_id_idx ON sessions(customer_id);
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions(expires_at);
`);

const customerColumns = new Set(database.prepare("PRAGMA table_info(customers)").all().map((column) => column.name));
if (!customerColumns.has("google_sub")) {
  database.exec("ALTER TABLE customers ADD COLUMN google_sub TEXT");
}
if (!customerColumns.has("picture")) {
  database.exec("ALTER TABLE customers ADD COLUMN picture TEXT NOT NULL DEFAULT ''");
}
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS customers_google_sub_idx ON customers(google_sub)");

const publicCustomer = (row) => row && ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  bio: row.bio,
  location: row.location,
  picture: row.picture || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export function findCustomerByEmail(email) {
  const row = database.prepare("SELECT * FROM customers WHERE email = ?").get(email);
  return row || null;
}

export function createCustomer({ id, name, email, role, passwordHash, googleSub = null, picture = "", now }) {
  const result = database.prepare(`
    INSERT OR IGNORE INTO customers
      (id, name, email, role, password_hash, google_sub, picture, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email, role, passwordHash, googleSub, picture, now, now);
  if (result.changes === 0) return null;
  return findCustomerById(id);
}

export function findCustomerById(id) {
  return database.prepare("SELECT * FROM customers WHERE id = ?").get(id) || null;
}

export function findCustomerByGoogleSub(googleSub) {
  return database.prepare("SELECT * FROM customers WHERE google_sub = ?").get(googleSub) || null;
}

export function findAdminByUsername(username) {
  return database.prepare("SELECT * FROM admins WHERE username = ?").get(username) || null;
}

export function createAdmin({ id, username, passwordHash, now }) {
  const result = database.prepare(`
    INSERT OR IGNORE INTO admins (id, username, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, username, passwordHash, now);
  if (result.changes === 0) return null;
  return findAdminByUsername(username);
}

export function updateAdminPassword(id, passwordHash, currentSessionHash) {
  database.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  database.prepare("DELETE FROM admin_sessions WHERE admin_id = ? AND token_hash != ?").run(id, currentSessionHash);
}

export function findAdminSession(tokenHash, now) {
  return database.prepare(`
    SELECT admins.id, admins.username
    FROM admin_sessions
    JOIN admins ON admins.id = admin_sessions.admin_id
    WHERE admin_sessions.token_hash = ? AND admin_sessions.expires_at > ?
  `).get(tokenHash, now) || null;
}

export function createAdminSession({ tokenHash, adminId, expiresAt, now }) {
  database.prepare(`
    INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, adminId, expiresAt, new Date(now).toISOString());
}

export function deleteAdminSession(tokenHash) {
  database.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(tokenHash);
}

export function removeExpiredAdminSessions(now) {
  database.prepare("DELETE FROM admin_sessions WHERE expires_at <= ?").run(now);
}

export function listAdminCustomers() {
  return database.prepare(`
    SELECT id, name, email, role, location, created_at, updated_at
    FROM customers
    ORDER BY created_at DESC
    LIMIT 500
  `).all().map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export function getAdminOverview() {
  const totals = database.prepare(`
    SELECT
      COUNT(*) AS customers,
      SUM(CASE WHEN role = 'professional' THEN 1 ELSE 0 END) AS professionals,
      SUM(CASE WHEN role = 'employer' THEN 1 ELSE 0 END) AS employers,
      SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) AS owners
    FROM customers
  `).get();
  return {
    customers: totals.customers,
    professionals: totals.professionals || 0,
    employers: totals.employers || 0,
    owners: totals.owners || 0
  };
}

export function linkGoogleIdentity(id, googleSub, picture, now) {
  const result = database.prepare(`
    UPDATE customers
    SET google_sub = ?, picture = ?, updated_at = ?
    WHERE id = ? AND (google_sub IS NULL OR google_sub = ?)
  `).run(googleSub, picture, now, id, googleSub);
  if (result.changes === 0) return null;
  return findCustomerById(id);
}

export function findSessionCustomer(tokenHash, now) {
  const row = database.prepare(`
    SELECT customers.*
    FROM sessions
    JOIN customers ON customers.id = sessions.customer_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, now);
  return publicCustomer(row);
}

export function createSession({ tokenHash, customerId, expiresAt, now }) {
  database.prepare(`
    INSERT INTO sessions (token_hash, customer_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, customerId, expiresAt, new Date(now).toISOString());
}

export function deleteSession(tokenHash) {
  database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function removeExpiredSessions(now) {
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
}

export function updateCustomer(id, profile, now) {
  database.prepare(`
    UPDATE customers
    SET name = ?, bio = ?, location = ?, updated_at = ?
    WHERE id = ?
  `).run(profile.name, profile.bio, profile.location, now, id);
  return publicCustomer(findCustomerById(id));
}

export function updateCustomerPassword(id, passwordHash, currentSessionHash) {
  database.prepare("UPDATE customers SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(passwordHash, new Date().toISOString(), id);
  database.prepare("DELETE FROM sessions WHERE customer_id = ? AND token_hash != ?")
    .run(id, currentSessionHash);
}

export function toPublicCustomer(row) {
  return publicCustomer(row);
}

export function closeCustomerStore() {
  database.close();
}
