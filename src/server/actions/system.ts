// Техническое обслуживание: состояние системы, резервные копии.
// Технический администратор не получает права менять учебные данные.
import "server-only";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { SessionUser } from "@/lib/types";
import { audit, type Ctx } from "../repo";
import { dbPath } from "../context";
import { ok, requireRole, type Result } from "./common";

const startedAt = Date.now();
const backupDir = () => process.env.BACKUP_DIR ?? path.join(path.dirname(dbPath()), "backups");

export function listBackups() {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({ file: f, size: statSync(path.join(dir, f)).size, at: statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
}

export function systemHealth(c: Ctx) {
  const count = (t: string) => Number((c.sql.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n);
  const file = dbPath();
  const integrity = String((c.sql.prepare("PRAGMA quick_check").get() as Record<string, unknown>)?.quick_check ?? "unknown");
  return {
    status: integrity === "ok" ? "ok" : "degraded",
    integrity,
    node: process.version,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    dbSizeKb: existsSync(file) ? Math.round(statSync(file).size / 1024) : 0,
    migrations: (c.sql.prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version").all() as { version: string; applied_at: number }[]).map((m) => ({ version: m.version, at: m.applied_at })),
    tables: { users: count("users"), sessions: count("sessions"), groups: count("groups"), students: count("students"), grades: count("grades"), audit_log: count("audit_log"), notifications: count("notifications") },
    backups: listBackups(),
    demoMode: process.env.DEMO_MODE !== "false",
  };
}

export const systemActions = {
  "system.backup": (c: Ctx, u: SessionUser): Result => {
    requireRole(u, "tech_admin");
    const dir = backupDir();
    mkdirSync(dir, { recursive: true });
    const name = `portal-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    // VACUUM INTO делает целостную копию работающей базы
    c.sql.prepare("VACUUM INTO ?").run(path.join(dir, name));
    audit(c, { actorId: u.id, actorRole: u.role, action: "system.backup", entity: "system", entityId: name, before: null, after: null, reason: null });
    return ok(`Резервная копия создана: ${name}`);
  },
};
