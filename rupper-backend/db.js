const mysql = require("mysql2");
require("dotenv").config();

let pool;

function getConnection() {
  if (!pool) {
    const requiredEnv = ["DB_HOST", "DB_USER", "DB_NAME"];
    const missing = requiredEnv.filter((key) => !process.env[key]);

    if (missing.length) {
      throw new Error(`Missing required database env vars: ${missing.join(", ")}`);
    }

    console.log("Creating new MySQL connection pool...");
    try {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        // Without this, mysql2 converts DATE/DATETIME columns to JS Date objects using the
        // server's local timezone, then formatting helpers convert back to UTC - a plain DATE
        // like '2026-09-15' can silently shift to '2026-09-14' depending on the server's offset.
        // Returning raw strings avoids that conversion entirely.
        dateStrings: true,
      });

      console.log("MySQL connection pool created successfully.");
    } catch (error) {
      console.error("Failed to create MySQL connection pool:", error);
      throw error;
    }
  }
  return pool.promise();
}

module.exports = getConnection;
