// Подключение к Turso (облачный SQLite) и применение миграций.
import "server-only";
import { createClient, type Client, type InValue } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type { Client, InValue };
export type Statement = { sql: string; args?: InValue[] };

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const CHUNK = 250; // макс. операций в одном batch-вызове

export function getTursoClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL не задан");
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

/** Выполнить набор SQL-операций порциями (Turso ограничивает размер batch) */
export async function batchExec(client: Client, stmts: Statement[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await client.batch(stmts.slice(i, i + CHUNK), "write");
  }
}

/** Применить все ещё не применённые миграции */
export async function migrate(client: Client): Promise<string[]> {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const done = new Set(
    (await client.execute("SELECT version FROM schema_migrations")).rows.map((r) => String(r.version)),
  );
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    const stmts = splitSql(sql);
    await batchExec(client, [
      ...stmts.map((s) => ({ sql: s })),
      { sql: "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", args: [f, Date.now()] },
    ]);
    applied.push(f);
  }
  return applied;
}

/** Разбить SQL-файл на отдельные операторы (учитывает BEGIN...END в триггерах) */
function splitSql(sql: string): string[] {
  const cleaned = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const parts = cleaned.split(";");
  const stmts: string[] = [];
  let pending = "";
  let depth = 0;
  for (const part of parts) {
    pending += (pending ? ";" : "") + part;
    const upper = part.toUpperCase();
    depth += (upper.match(/\bBEGIN\b/g) ?? []).length - (upper.match(/\bEND\b/g) ?? []).length;
    if (depth <= 0) {
      const s = pending.trim();
      if (s) stmts.push(s);
      pending = "";
      depth = 0;
    }
  }
  if (pending.trim()) stmts.push(pending.trim());
  return stmts;
}
