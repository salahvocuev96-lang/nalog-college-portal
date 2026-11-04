// Подключение к SQLite (встроенный модуль Node.js, без сторонних зависимостей) и применение миграций.
import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export function openDatabase(file: string): DatabaseSync {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const sql = new DatabaseSync(file);
  sql.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(sql);
  return sql;
}

/** Применяет по порядку все ещё не применённые файлы db/migrations/NNN_*.sql */
export function migrate(sql: DatabaseSync): string[] {
  sql.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const done = new Set((sql.prepare("SELECT version FROM schema_migrations").all() as { version: string }[]).map((r) => r.version));
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    sql.exec("BEGIN");
    try {
      sql.exec(readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
      sql.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(f, Date.now());
      sql.exec("COMMIT");
      applied.push(f);
    } catch (e) {
      sql.exec("ROLLBACK");
      throw new Error(`Миграция ${f} не применена: ${(e as Error).message}`);
    }
  }
  return applied;
}

export function transaction<T>(sql: DatabaseSync, fn: () => T): T {
  sql.exec("BEGIN");
  try {
    const r = fn();
    sql.exec("COMMIT");
    return r;
  } catch (e) {
    sql.exec("ROLLBACK");
    throw e;
  }
}
