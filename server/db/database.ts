import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// SQLite persistence using Node's built-in module. The schema is versioned with PRAGMA
// user_version; add a migration by appending to MIGRATIONS (never edit an applied one).

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        scenario_title TEXT NOT NULL,
        scenario_version INTEGER NOT NULL,
        scenario_snapshot TEXT NOT NULL,
        mode TEXT NOT NULL,
        provider_kind TEXT NOT NULL,
        provider_label TEXT NOT NULL,
        prompt_versions TEXT NOT NULL,
        is_sample INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        evaluation_phase TEXT,
        evaluation_error TEXT,
        runtime TEXT NOT NULL,
        client_request_id TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        completion TEXT,
        overall_score REAL,
        dimension_scores TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (profile_id, client_request_id)
      );
      CREATE INDEX idx_sessions_profile_started ON sessions (profile_id, started_at DESC);

      CREATE TABLE turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        idx INTEGER NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        source TEXT NOT NULL,
        client_message_id TEXT,
        classification TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (session_id, idx),
        UNIQUE (session_id, client_message_id)
      );

      CREATE TABLE state_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        turn_index INTEGER NOT NULL,
        key TEXT NOT NULL,
        previous REAL NOT NULL,
        next REAL NOT NULL,
        delta REAL NOT NULL,
        category TEXT NOT NULL,
        reason TEXT NOT NULL,
        evidence TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_state_events_session ON state_events (session_id, turn_index);

      CREATE TABLE discovery_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        fact_id TEXT NOT NULL,
        status TEXT NOT NULL,
        turn_index INTEGER NOT NULL,
        question TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (session_id, fact_id, status)
      );

      CREATE TABLE evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE REFERENCES sessions (id) ON DELETE CASCADE,
        evaluator_kind TEXT NOT NULL,
        evaluator_name TEXT NOT NULL,
        evaluator_version TEXT NOT NULL,
        rubric_version TEXT NOT NULL,
        report TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE mentor_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
        reviewer TEXT NOT NULL,
        scores TEXT NOT NULL,
        notes TEXT,
        rubric_version TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'mentor',
        created_at TEXT NOT NULL,
        UNIQUE (session_id, reviewer)
      );
    `,
  },
  {
    // How a trainee turn arrived (typed or recognised from speech). Turns stored before this
    // existed were all typed.
    version: 2,
    sql: `ALTER TABLE turns ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'text';`,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  let current = row.user_version;
  if (current > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `The database was created by a newer version of Firefly (schema ${current}, this build supports ${LATEST_SCHEMA_VERSION}).`,
    );
  }
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
      current = migration.version;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** Runs `fn` in a transaction; rolls back if it throws. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // The transaction was already closed by an earlier failure.
    }
    throw error;
  }
}
