require("dotenv").config();
const express = require("express");
const cors = require("cors");
const getConnection = require("./db");
const { dedupeSeedData } = require("./migrations/dedupeSeedData");
const { bootstrapAdmin, ensurePasswordChangedColumn } = require("./config/bootstrapAdmin");
const { ensureTable: ensureResetTokenTable } = require("./services/passwordReset");
const pool = getConnection();

const app = express();
const PORT = process.env.PORT || 5000;
app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked request from ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.json({ message: "RUPPER Connect MySQL API is running" }));
app.get("/api/health", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", database: rows[0].ok === 1 });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/grades", require("./routes/gradeRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));
app.use("/api/schedules", require("./routes/scheduleRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/academic", require("./routes/academicRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: "Server error",
    detail: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

// Schema the auth layer depends on, applied before anything can sign in.
Promise.all([ensurePasswordChangedColumn(), ensureResetTokenTable()])
  .then(() => console.log("Auth schema ready (password_changed_at, password_reset_tokens)."))
  .catch((error) => console.error("Auth schema setup failed:", error.message));

dedupeSeedData()
  .then((results) => console.log("Seed data dedupe check:", results))
  .catch((error) => console.error("Seed data dedupe check failed:", error.message));

bootstrapAdmin()
  .then((result) => {
    if (result.skipped) return;
    if (result.alreadyAdmin) console.log(`Admin bootstrap: ${result.email} is already an admin.`);
    else if (result.promoted) console.log(`Admin bootstrap: promoted ${result.email} from ${result.from} to admin.`);
    else if (result.created) console.log(`Admin bootstrap: created admin account ${result.email}.`);
    else if (result.missing) {
      console.warn(
        `Admin bootstrap: no account for ADMIN_EMAIL=${result.email}. Sign up with that email first, ` +
          "or set ADMIN_PASSWORD (6+ characters) to have it created here."
      );
    }
  })
  .catch((error) => console.error("Admin bootstrap failed:", error.message));

app.listen(PORT, () => console.log(`RUPPER backend running on http://localhost:${PORT}`));
