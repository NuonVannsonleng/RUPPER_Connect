# RUPPER Connect Backend (Node.js + Express + PostgreSQL / Supabase)

The database is Supabase (managed PostgreSQL). Supabase's free tier has no trial clock on it,
which is why this moved off Railway MySQL.

## 1. Create the Supabase project

1. Sign up at <https://supabase.com> with GitHub (free, no card).
2. **New project** → give it a name, pick a **strong database password** and *write it down*,
   choose the region closest to you (Singapore / `ap-southeast-1` for Cambodia), then **Create**.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Create the tables

In the Supabase dashboard open **SQL Editor → New query**, paste the entire contents of
[`database/schema.sql`](database/schema.sql), and press **Run**. It should say *Success*.

Re-running it later is safe - every statement is `IF NOT EXISTS`.

## 3. Get the connection string

**Connect** (top of the dashboard) → **Session pooler** → copy the URI. It looks like:

```text
postgresql://postgres.abcdefghijklm:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Replace `[YOUR-PASSWORD]` with the password from step 1.

Two things that trip people up:

- **Use the Session pooler, not the Direct connection.** The direct connection is IPv6-only,
  and hosts like Render and most home ISPs can't reach it.
- **URL-encode special characters in the password** - `@` → `%40`, `#` → `%23`, `?` → `%3F`,
  `/` → `%2F`. Otherwise the URL won't parse. The simplest fix is a password with only
  letters and digits.

## 4. Configure environment

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://postgres.xxxx:YourPassword@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
JWT_SECRET=change_this_to_any_long_random_text
BACKEND_URL=http://localhost:5000
FRONTEND_URLS=http://localhost:5173,http://localhost:8080
```

Generate a real `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 5. Install and run

```bash
npm install
npm run dev
```

API runs at <http://localhost:5000>. Check <http://localhost:5000/api/health> - it should
return `{"status":"ok","database":true}`.

## Deploying (Render)

```bash
npm install
npm start
```

Environment variables to set on the backend host:

```env
DATABASE_URL=postgresql://postgres.xxxx:YourPassword@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
BACKEND_URL=https://rupper-connect.onrender.com
FRONTEND_URLS=https://class-connect-pro-rupp.vercel.app,http://localhost:5173,http://localhost:8080
JWT_SECRET=change_this_to_a_long_random_secret
ADMIN_EMAIL=you@example.com
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret
```

`DB_SSL` no longer needs setting - SSL is on by default because Supabase requires it. Set
`DB_SSL=false` only when pointing at a plain local Postgres with no TLS.

After the backend is deployed, set this in Vercel for the frontend:

```env
VITE_API_URL=https://rupper-connect.onrender.com/api
```

## Why the first request of the day used to be slow

Render suspends a free web service after 15 minutes without an inbound request. Waking it was
measured at 22 seconds on a good day and 235 seconds on a bad one, and because `apiRequest`
has no timeout, signing in during that window looked frozen rather than slow.

In production the server now pings its own `/api/health` every 10 minutes, which arrives back
through Render's edge as a normal inbound request and resets the idle timer. It only does so
between 06:00 and 23:00 Phnom Penh time - the free plan allows 750 instance-hours a month, and
staying up around the clock would use roughly 730 of them with nothing to spare, where a
17-hour window uses about 520.

Render sets `RENDER_EXTERNAL_URL` itself, so this needs no configuration. `KEEP_WARM=false`
turns it off; `KEEP_WARM_TIMEZONE`, `KEEP_WARM_START_HOUR` and `KEEP_WARM_END_HOUR` move the
window. Outside production it does nothing.

It still sleeps overnight, so the first sign-in of the morning can take a moment. The login
screen pings the API as soon as it loads, so that wake overlaps with typing.

## Making yourself an admin

Signup deliberately never grants the admin role. Either set `ADMIN_EMAIL` (and optionally
`ADMIN_PASSWORD`) in the host's environment and restart - the account is promoted on boot -
or run locally:

```bash
node scripts/makeAdmin.js you@example.com
```

## Google OAuth callback URL

Register these in Google Cloud Console:

```text
https://rupper-connect.onrender.com/api/auth/oauth/google/callback
http://localhost:5000/api/auth/oauth/google/callback
```

## Notes on the Postgres port

- Queries throughout the app still use `?` placeholders. `db.js` rewrites them to `$1, $2, ...`
  and reshapes results so `[rows] = await pool.query(...)`, `result.insertId`, and
  `result.affectedRows` keep working. See `test/db.test.mjs`.
- Uploaded files (course materials, assignment submissions) are stored in the database as
  `BYTEA`. Supabase's free tier gives 500 MB of database storage, so keep an eye on it - if
  it fills up, move uploads to Supabase Storage instead.

## Main API routes

- POST `/api/auth/signup`
- POST `/api/auth/login`
- GET `/api/auth/oauth/:provider`
- GET/POST `/api/auth/oauth/:provider/callback`
- GET `/api/auth/me`
- PUT `/api/auth/profile`
- PUT `/api/auth/change-password`
- POST `/api/auth/reset-password`
- GET/POST `/api/attendance`
- GET/POST `/api/grades`
- GET/POST `/api/announcements`
- GET/POST `/api/schedules`
