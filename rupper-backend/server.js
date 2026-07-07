require("dotenv").config();
const express = require("express");
const cors = require("cors");
const getConnection = require("./db");
const pool = getConnection();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:8080", credentials: true }));
app.use(express.json({ limit: "10mb" }));

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: "Server error",
    detail: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

app.listen(PORT, () => console.log(`RUPPER backend running on http://localhost:${PORT}`));
