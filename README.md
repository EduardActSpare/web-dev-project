# Offscript

Offscript is a responsive creative talent marketplace with a Node.js backend and a local SQLite customer database.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm start
```

Open `http://127.0.0.1:3000`. Sign-up creates a customer record in `data/offscript.sqlite`. Passwords are stored as scrypt hashes, not plaintext. Login sessions use random, HTTP-only cookies, with only a hash of each session token stored in SQLite. The database folder is excluded from Git.

Set `PORT` to use another port. Set `HOST=0.0.0.0` only when you intentionally want to make the local server reachable to other devices on your network. Set `OFFSCRIPT_DATA_DIR` to store the SQLite database in a different private folder.

## Administrator access

When running outside production on localhost, the server creates a starter administrator account if the admin table is empty:

- Username: `acttest`
- Temporary password: `actact`

Sign in at `http://127.0.0.1:3000/#/admin`. Change the temporary password from the administrator dashboard before exposing the app to anyone else. The password change requires at least 12 characters and signs out other admin sessions. Admin passwords are scrypt-hashed, and admin sessions use a separate HTTP-only cookie from customer sessions.

The weak starter password is never created automatically in production or when the server is configured to listen on a non-localhost host. For production provisioning, set `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` of at least 12 characters before first startup. Keep these values in your deployment's secret manager, not in source control. Admin customer listing and account totals are protected by server-side admin session checks.

## Google sign-in

Google sign-in is optional. In Google Cloud Console, create an OAuth client ID for a web application and add the callback URL to its authorized redirect URIs. For the default local server, use:

```text
http://127.0.0.1:3000/api/auth/google/callback
```

Set these environment variables before starting the server:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (the exact callback URL registered in Google Cloud)

For example, in a local shell:

```sh
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GOOGLE_REDIRECT_URI="http://127.0.0.1:3000/api/auth/google/callback"
npm start
```

Keep the client secret on the server and out of source control. In production, use an HTTPS callback URL and configure `GOOGLE_REDIRECT_URI` explicitly. Google sign-in requests the user's basic profile and verified email. A matching existing account is connected by verified email; new Google accounts are created as Professionals.

## Customer profile data

Registration stores a name, normalized email address, account type, password hash, and timestamps. Signed-in customers can update their name, location, and short bio on the Profile page. The account endpoints are:

The Profile page is the signed-in account dashboard. Settings lets customers update their name, location, and bio, and change their password. Password changes require the current password, retain the current session, and invalidate the account's other sessions. Email address changes are not currently supported.

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/customers/me`
- `PATCH /api/customers/me`
- `POST /api/customers/me/password`
- `GET /api/admin/session`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/overview`
- `GET /api/admin/customers`
- `POST /api/admin/password`

Back up the SQLite database securely if you need to preserve customer data. It contains personal information and should not be shared publicly.

## Checks

```sh
npm run check
npm test
```

This is a local prototype backend, not a production deployment. Before accepting real customers, deploy behind HTTPS, configure secure database backups and monitoring, and add operational protections such as persistent distributed rate limiting, email verification, password reset, and a documented privacy policy.
