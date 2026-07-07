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
FRONTEND_URLS=https://class-connect-pro-rupp.vercel.app,http://localhost:8080
DB_HOST=your_hosted_mysql_host
DB_PORT=3306
DB_USER=your_hosted_mysql_user
DB_PASSWORD=your_hosted_mysql_password
DB_NAME=rupper_connect
DB_SSL=false
JWT_SECRET=change_this_to_a_long_random_secret
```

If your hosted MySQL provider requires SSL, set `DB_SSL=true`.

After the backend is deployed, copy its public URL and add this environment variable in Vercel for the frontend:

```env
VITE_API_URL=https://your-backend-url/api
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
- GET `/api/auth/me`
- PUT `/api/auth/profile`
- PUT `/api/auth/change-password`
- POST `/api/auth/reset-password`
- GET/POST `/api/attendance`
- GET/POST `/api/grades`
- GET/POST `/api/announcements`
- GET/POST `/api/schedules`
