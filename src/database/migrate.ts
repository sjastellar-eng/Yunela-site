import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';

const migrations = [
  { version: '0001_initial', file: new URL('../../database/migrations/0001_initial.sql', import.meta.url) },
  { version: '0002_discovery_box', file: new URL('../../database/migrations/0002_discovery_box.sql', import.meta.url) },
  { version: '0003_commerce', file: new URL('../../database/migrations/0003_commerce.sql', import.meta.url) },
] as const;

export function applyMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const hasMigration = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1');
  for (const migration of migrations) {
    if (hasMigration.get(migration.version)) continue;
    const sql = readFileSync(migration.file, 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(migration.version, new Date().toISOString());
    });
    apply();
  }
}
