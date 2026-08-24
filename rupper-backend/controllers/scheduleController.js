const pool = require("../config/db");

const formatSchedule = (row) => ({
  id: row.id,
  title: row.title,
  teacher: row.teacher || "",
  room: row.room || "",
  dayOfWeek: row.day_of_week,
  startTime: String(row.start_time).slice(0, 5),
  endTime: String(row.end_time).slice(0, 5),
  roleVisibility: row.role_visibility || "both",
});

const selectScheduleById = async (id) => {
  const [rows] = await pool.query("SELECT * FROM schedules WHERE id = ?", [id]);
  return rows[0] ? formatSchedule(rows[0]) : null;
};

exports.getSchedules = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT * FROM schedules
     ORDER BY CASE day_of_week
       WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4
       WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 WHEN 'Sunday' THEN 7 ELSE 8 END, start_time`
  );
  res.json(rows.map(formatSchedule));
};

exports.createSchedule = async (req, res) => {
  const { title, teacher, room, dayOfWeek, startTime, endTime, roleVisibility } = req.body;
  if (!title || !dayOfWeek || !startTime || !endTime) return res.status(400).json({ message: "Missing required fields" });
  const [result] = await pool.query(
    "INSERT INTO schedules (title, teacher, room, day_of_week, start_time, end_time, role_visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title.trim(), teacher || null, room || null, dayOfWeek, startTime, endTime, roleVisibility || "both"]
  );
  res.status(201).json(await selectScheduleById(result.insertId));
};

exports.updateSchedule = async (req, res) => {
  const { title, teacher, room, dayOfWeek, startTime, endTime, roleVisibility } = req.body;
  if (!title || !dayOfWeek || !startTime || !endTime) return res.status(400).json({ message: "Missing required fields" });

  const [result] = await pool.query(
    `UPDATE schedules
     SET title = ?, teacher = ?, room = ?, day_of_week = ?, start_time = ?, end_time = ?, role_visibility = ?
     WHERE id = ?`,
    [title.trim(), teacher || null, room || null, dayOfWeek, startTime, endTime, roleVisibility || "both", req.params.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: "Schedule not found" });

  res.json(await selectScheduleById(req.params.id));
};

exports.deleteSchedule = async (req, res) => {
  const [result] = await pool.query("DELETE FROM schedules WHERE id = ?", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ message: "Schedule not found" });

  res.json({ message: "Schedule deleted" });
};
