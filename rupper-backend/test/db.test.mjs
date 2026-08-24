import { describe, it, expect } from "vitest";
import db from "../db.js";

const { toPositionalParams, withReturningId } = db;

/**
 * Every query in this app is still written with mysql2's `?` placeholders and relies on
 * db.js rewriting them for Postgres, so a bug here breaks the whole backend at once.
 */
describe("placeholder rewriting", () => {
  it("numbers placeholders in order", () => {
    expect(toPositionalParams("SELECT * FROM users WHERE email = ? AND id <> ?")).toBe(
      "SELECT * FROM users WHERE email = $1 AND id <> $2"
    );
  });

  it("leaves SQL without placeholders alone", () => {
    expect(toPositionalParams("SELECT COUNT(*) AS total FROM users")).toBe("SELECT COUNT(*) AS total FROM users");
  });

  it("ignores question marks inside string literals", () => {
    expect(toPositionalParams("SELECT ? AS a, 'why? because' AS b, ? AS c")).toBe(
      "SELECT $1 AS a, 'why? because' AS b, $2 AS c"
    );
  });

  it("ignores question marks inside quoted identifiers", () => {
    expect(toPositionalParams('SELECT x AS "who?", ? FROM t')).toBe('SELECT x AS "who?", $1 FROM t');
  });

  it("handles doubled quotes inside a literal", () => {
    expect(toPositionalParams("SELECT 'it''s ? fine', ? FROM t")).toBe("SELECT 'it''s ? fine', $1 FROM t");
  });

  it("ignores question marks inside comments", () => {
    expect(toPositionalParams("SELECT ?\n-- really? yes\nFROM t")).toBe("SELECT $1\n-- really? yes\nFROM t");
    expect(toPositionalParams("SELECT /* ? */ ? FROM t")).toBe("SELECT /* ? */ $1 FROM t");
  });

  it("preserves quoted camelCase aliases, which Postgres would otherwise fold to lowercase", () => {
    expect(toPositionalParams('SELECT student_id AS "studentId" FROM t WHERE id = ?')).toBe(
      'SELECT student_id AS "studentId" FROM t WHERE id = $1'
    );
  });
});

describe("insertId support", () => {
  it("appends RETURNING id to inserts", () => {
    expect(withReturningId("INSERT INTO users (name) VALUES ($1)")).toBe(
      "INSERT INTO users (name) VALUES ($1) RETURNING id"
    );
  });

  it("appends RETURNING id after an ON CONFLICT clause", () => {
    expect(withReturningId("INSERT INTO a (b) VALUES ($1) ON CONFLICT (b) DO NOTHING")).toBe(
      "INSERT INTO a (b) VALUES ($1) ON CONFLICT (b) DO NOTHING RETURNING id"
    );
  });

  it("leaves an existing RETURNING clause alone", () => {
    const sql = "INSERT INTO users (name) VALUES ($1) RETURNING id, email";
    expect(withReturningId(sql)).toBe(sql);
  });

  it("does not touch non-inserts", () => {
    expect(withReturningId("UPDATE users SET name = $1 WHERE id = $2")).toBe(
      "UPDATE users SET name = $1 WHERE id = $2"
    );
    expect(withReturningId("SELECT * FROM users")).toBe("SELECT * FROM users");
    expect(withReturningId("DELETE FROM users WHERE id = $1")).toBe("DELETE FROM users WHERE id = $1");
  });
});

describe("error classification", () => {
  it("recognises a unique violation", () => {
    expect(db.isDuplicateKeyError({ code: "23505" })).toBe(true);
    expect(db.isDuplicateKeyError({ code: "42P01" })).toBe(false);
    expect(db.isDuplicateKeyError(null)).toBe(false);
  });

  it("recognises a missing table or column", () => {
    expect(db.isMissingTableError({ code: "42P01" })).toBe(true);
    expect(db.isMissingTableError({ code: "42703" })).toBe(true);
    expect(db.isMissingTableError({ code: "23505" })).toBe(false);
    expect(db.isMissingTableError(undefined)).toBe(false);
  });
});
