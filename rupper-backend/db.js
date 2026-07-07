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
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
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
