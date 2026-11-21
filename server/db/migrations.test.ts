import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LATEST_SCHEMA_VERSION, MIGRATIONS, migrate, openDatabase } from './database.ts';
import { createRepository } from './repository.ts';

const userVersion = (db: DatabaseSync) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

const turnColumns = (db: DatabaseSync) =>
  db.prepare('PRAGMA table_info(turns)').all() as {
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
  }[];

/** A database exactly as an earlier version of Firefly left it: migration 1 only, with a call in it. */
function oldDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(MIGRATIONS[0]?.sql ?? '');
  db.exec('PRAGMA user_version = 1');
  db.prepare(
    `INSERT INTO sessions (id, profile_id, scenario_id, scenario_title, scenario_version, scenario_snapshot,
       mode, provider_kind, provider_label, prompt_versions, status, runtime, started_at, updated_at)
     VALUES ('s1', 'p1', 'sc', 'Scenario', 1, '{}', 'guided', 'mock', 'Demo mode', '{}', 'active', '{}', 't0', 't0')`,
  ).run();
  const turn = db.prepare(
    `INSERT INTO turns (session_id, idx, role, text, source, client_message_id, created_at) VALUES ('s1', ?, ?, ?, ?, ?, 't0')`,
  );
  turn.run(1, 'customer', 'Hello, I need help.', 'opening', null);
  turn.run(2, 'trainee', 'Hi, what is wrong?', 'trainee', 'abcdefgh');
  turn.run(3, 'customer', 'I cannot sign in.', 'demo', null);
  return db;
}

describe('database migrations', () => {
  it('number every migration in order, and the first one is exactly as it was released', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual([1, 2]);
    expect(LATEST_SCHEMA_VERSION).toBe(2);
    // An applied migration is never edited: add a new one instead.
    const hash = createHash('sha256')
      .update(MIGRATIONS[0]?.sql ?? '')
      .digest('hex');
    expect(hash).toBe('4079ef568d1da8136f5613c94da936732b0b1ef2423a03537bef5255e0c40263');
  });

  it('give a new database the input mode column, typed text by default', () => {
    const db = openDatabase(':memory:');
    expect(userVersion(db)).toBe(2);
    const column = turnColumns(db).find((c) => c.name === 'input_mode');
    expect(column).toMatchObject({ type: 'TEXT', notnull: 1, dflt_value: "'text'" });
    db.close();
  });

  it('upgrade a database that only has migration 1, and keep every turn it already had as typed', () => {
    const db = oldDatabase();
    expect(turnColumns(db).some((c) => c.name === 'input_mode')).toBe(false);

    migrate(db);

    expect(userVersion(db)).toBe(2);
    const repo = createRepository(db);
    expect(repo.getTurns('s1').map((t) => [t.idx, t.role, t.text, t.inputMode])).toEqual([
      [1, 'customer', 'Hello, I need help.', 'text'],
      [2, 'trainee', 'Hi, what is wrong?', 'text'],
      [3, 'customer', 'I cannot sign in.', 'text'],
    ]);
    // The old turn is still found by its client id, which is what keeps a retried send from duplicating.
    expect(repo.findTurnByClientId('s1', 'abcdefgh')?.inputMode).toBe('text');
    db.close();
  });

  it('let the upgraded database store spoken turns, and read them back', () => {
    const db = oldDatabase();
    migrate(db);
    const repo = createRepository(db);
    repo.insertTurn('s1', {
      idx: 4,
      role: 'trainee',
      text: 'I understand.',
      source: 'trainee',
      inputMode: 'voice',
      clientMessageId: 'voice-one',
      classification: null,
    });
    expect(repo.getTurns('s1').map((t) => t.inputMode)).toEqual(['text', 'text', 'text', 'voice']);
    expect(repo.findTurnByClientId('s1', 'voice-one')?.inputMode).toBe('voice');
    db.close();
  });

  it('can be run again without changing anything', () => {
    const db = oldDatabase();
    migrate(db);
    migrate(db);
    expect(userVersion(db)).toBe(2);
    expect(turnColumns(db).filter((c) => c.name === 'input_mode')).toHaveLength(1);
    expect(createRepository(db).getTurns('s1')).toHaveLength(3);
    db.close();
  });

  it('refuse a database from a newer version of Firefly', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    expect(() => migrate(db)).toThrowError(/newer version of Firefly/);
    db.close();
  });
});
