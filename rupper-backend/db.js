const { Pool, types } = require("pg");
require("dotenv").config();

/**
 * Postgres (Supabase) connection layer.
 *
 * This app was written against mysql2, whose `query()` resolves to `[rows, fields]` and whose
 * result object carries `insertId` / `affectedRows`. Rather than rewrite ~200 call sites, the
 * pool returned here keeps that calling convention on top of node-postgres:
 *
 *   const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
 *   const [result] = await pool.query("INSERT INTO users (...) VALUES (?, ?)", [...]);
 *   result.insertId       // from an auto-appended RETURNING id
 *   result.affectedRows   // rowCount
 *
 * SQL that was genuinely MySQL-only (ON DUPLICATE KEY UPDATE, INSERT IGNORE, GET_LOCK,
 * DATE_ADD, GROUP_CONCAT, FIELD(), ...) has been rewritten to Postgres in the callers - the
 * shim only handles placeholders and result shape, it does not translate dialects.
 */

// mysql2 was configured with `dateStrings: true` so DATE/DATETIME came back as raw
// 'YYYY-MM-DD[ HH:MM:SS]' strings. node-postgres builds JS Date objects instead, which
// reinterprets a plain DATE in the server's local timezone and can shift it by a day.
// Parsing these types straight through as text keeps the previous behaviour exactly.
const asText = (value) => value;
types.setTypeParser(1082, asText); // date
types.setTypeParser(1083, asText); // time
types.setTypeParser(1114, asText); // timestamp
types.setTypeParser(1184, asText); // timestamptz

// COUNT(*) is int8 and AVG()/DECIMAL are numeric; both arrive as strings by default, while
// mysql2 handed back numbers. Callers wrap most of these in Number() already, but not all.
const asNumber = (value) => (value === null ? null : Number(value));
types.setTypeParser(20, asNumber); // int8 / bigint
types.setTypeParser(1700, asNumber); // numeric / decimal

/**
 * Rewrites mysql2's `?` placeholders into Postgres' `$1, $2, ...`, skipping anything inside
 * string literals, quoted identifiers, or comments so a literal question mark in text is
 * left alone.
 */
function toPositionalParams(sql) {
  let out = "";
  let index = 0;
  let count = 0;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "'" || char === '"') {
      const quote = char;
      let end = index + 1;
      while (end < sql.length) {
        if (sql[end] === quote) {
          if (sql[end + 1] === quote) end += 2; // escaped quote ('' or "")
          else {
            end += 1;
            break;
          }
        } else {
          end += 1;
        }
      }
      out += sql.slice(index, end);
      index = end;
      continue;
    }

    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", index);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "?") {
      count += 1;
      out += `$${count}`;
      index += 1;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}

/**
 * MySQL hands back the generated key on every INSERT; Postgres only does so when asked.
 * Every table in this schema has an `id` primary key, so adding RETURNING id to inserts that
 * don't already have a RETURNING clause keeps `result.insertId` working.
 */
function withReturningId(sql) {
  if (!/^\s*insert\s/i.test(sql)) return sql;
  if (/\breturning\b/i.test(sql)) return sql;
  return `${sql.replace(/;\s*$/, "")} RETURNING id`;
}

let pool;
let rawPool;

function buildPoolConfig() {
  const connectionString = (process.env.DATABASE_URL || "").trim();

  // Supabase always terminates TLS. Its pooler presents a certificate that Node's default
  // trust store doesn't chain to, so verification is turned off rather than shipping the CA -
  // the connection is still encrypted. Set DB_SSL=false only for a plain local Postgres.
  const ssl = process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false };

  const shared = {
    ssl,
    // Supabase's free tier has a modest connection budget and withAdvisoryLock checks out a
    // second client while it holds a lock, so keep this well under the limit.
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  };

  if (connectionString) return { connectionString, ...shared };

  const required = ["DB_HOST", "DB_USER", "DB_NAME"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing database configuration. Set DATABASE_URL, or all of: ${missing.join(", ")}`);
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...shared,
  };
}

function getConnection() {
  if (pool) return pool;

  console.log("Creating new Postgres connection pool...");
  rawPool = new Pool(buildPoolConfig());

  // An idle client dropped by the server (Supabase recycles them) emits an error on the pool.
  // Without a listener that is an unhandled 'error' event and takes the process down.
  rawPool.on("error", (error) => {
    console.error("Idle Postgres client error:", error.message);
  });

  pool = {
    async query(text, params = []) {
      const sql = withReturningId(toPositionalParams(text));
      const result = await rawPool.query(sql, params);

      // mysql2 resolves to [rows, fields]; SELECTs destructure element 0 as the row array and
      // writes destructure it as the result object, so element 0 has to serve as both. The
      // metadata is non-enumerable so `rows.map(...)`/JSON output are unaffected.
      const rows = result.rows;
      const isInsert = /^\s*insert\s/i.test(text);
      Object.defineProperties(rows, {
        insertId: { value: isInsert && rows.length ? rows[0].id : undefined },
        affectedRows: { value: result.rowCount },
        rowCount: { value: result.rowCount },
      });
      return [rows, result.fields];
    },
    end: () => rawPool.end(),
    get pool() {
      return rawPool;
    },
  };

  console.log("Postgres connection pool created successfully.");
  return pool;
}

/**
 * Postgres equivalent of MySQL's GET_LOCK/RELEASE_LOCK, used to serialise the lazy schema
 * setup and seed-data insertion that several endpoints trigger in parallel on first load.
 *
 * The lock is taken as a transaction-scoped advisory lock on a dedicated client: a session
 * lock would leak when the pool hands the next query to a different connection, and would
 * break outright behind Supabase's transaction pooler. `pg_advisory_xact_lock` is released
 * by COMMIT, so a thrown error can never strand it.
 */
async function withAdvisoryLock(key, fn) {
  getConnection();
  const client = await rawPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [key]);
    return await fn();
  } finally {
    try {
      await client.query("COMMIT");
    } catch {
      /* the lock is released with the transaction either way */
    }
    client.release();
  }
}

// Postgres SQLSTATEs, in place of the mysql2 error codes the callers used to check.
const isDuplicateKeyError = (error) => Boolean(error) && error.code === "23505";
const isMissingTableError = (error) => Boolean(error) && (error.code === "42P01" || error.code === "42703");

module.exports = getConnection;
module.exports.withAdvisoryLock = withAdvisoryLock;
module.exports.isDuplicateKeyError = isDuplicateKeyError;
module.exports.isMissingTableError = isMissingTableError;
// Exported for test/db.test.mjs - this rewriting is the one piece of the MySQL-to-Postgres
// move that every single query depends on, so it is worth covering directly.
module.exports.toPositionalParams = toPositionalParams;
module.exports.withReturningId = withReturningId;
