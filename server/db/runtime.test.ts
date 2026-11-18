import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

// Firefly stores data with Node's built-in SQLite module. This guards the runtime
// assumption (and the transaction behaviour the persistence layer relies on).
describe('runtime: node:sqlite', () => {
  it('opens an in-memory database, enforces foreign keys and rolls back transactions', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('CREATE TABLE a (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    db.exec('CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER NOT NULL REFERENCES a(id))');

    db.exec('BEGIN');
    db.prepare('INSERT INTO a (name) VALUES (?)').run('one');
    db.exec('ROLLBACK');
    expect(db.prepare('SELECT COUNT(*) AS n FROM a').get()).toEqual({ n: 0 });

    db.prepare('INSERT INTO a (name) VALUES (@name)').run({ name: 'two' });
    expect(() => db.prepare('INSERT INTO b (a_id) VALUES (?)').run(999)).toThrow();
    db.close();
  });
});
