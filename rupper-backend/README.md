# RUPPER Connect Backend (Node.js + Express + MySQL)

## 1. Create MySQL database
Open MySQL Workbench and run:

```sql
source database/schema.sql;
```

Or copy all SQL from `database/schema.sql` and run it.

## 2. Configure environment
Copy `.env.example` to `.env`, then change your MySQL password:

```env
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=rupper_connect
JWT_SECRET=change_this_to_any_long_random_text
BACKEND_URL=http://localhost:5000
FRONTEND_URLS=http://localhost:5173,http://localhost:8080
```

## 3. Install packages
```bash
npm install
```

## 4. Run backend
```bash
npm run dev
```

API runs at:

```text
http://localhost:5000
```

For production hosts such as Render or Railway, use:

```bash
npm install
npm start
```

Set these environment variables on the backend host:

```env
BACKEND_URL=https://class-connect-pro-rupp-production.up.railway.app
FRONTEND_URLS=https://class-connect-pro-rupp.vercel.app,http://localhost:5173,http://localhost:8080
DB_HOST=your_hosted_mysql_host
DB_PORT=3306
DB_USER=your_hosted_mysql_user
DB_PASSWORD=your_hosted_mysql_password
DB_NAME=rupper_connect
DB_SSL=false
JWT_SECRET=change_this_to_a_long_random_secret
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret
FACEBOOK_OAUTH_CLIENT_ID=your_facebook_client_id
FACEBOOK_OAUTH_CLIENT_SECRET=your_facebook_client_secret
APPLE_OAUTH_CLIENT_ID=your_apple_services_id
APPLE_OAUTH_CLIENT_SECRET=your_generated_apple_client_secret
MICROSOFT_OAUTH_CLIENT_ID=your_microsoft_client_id
MICROSOFT_OAUTH_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_TENANT_ID=common
```

If your hosted MySQL provider requires SSL, set `DB_SSL=true`.

After the backend is deployed, copy its public URL and add this environment variable in Vercel for the frontend:

```env
VITE_API_URL=https://your-backend-url/api
VITE_GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
VITE_FACEBOOK_OAUTH_CLIENT_ID=your_facebook_client_id
VITE_APPLE_OAUTH_CLIENT_ID=your_apple_client_id
VITE_MICROSOFT_OAUTH_CLIENT_ID=your_microsoft_client_id
```

## OAuth callback URLs
Register these callback URLs in each provider dashboard:

```text
https://class-connect-pro-rupp-production.up.railway.app/api/auth/oauth/google/callback
https://class-connect-pro-rupp-production.up.railway.app/api/auth/oauth/facebook/callback
https://class-connect-pro-rupp-production.up.railway.app/api/auth/oauth/apple/callback
https://class-connect-pro-rupp-production.up.railway.app/api/auth/oauth/microsoft/callback
```

For local development, also register:

```text
http://localhost:5000/api/auth/oauth/google/callback
http://localhost:5000/api/auth/oauth/facebook/callback
http://localhost:5000/api/auth/oauth/apple/callback
http://localhost:5000/api/auth/oauth/microsoft/callback
```

## 5. Run frontend
In the React project folder:

```bash
npm install
npm run dev
```

Frontend default URL is usually:

```text
http://localhost:8080
```

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
