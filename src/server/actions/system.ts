// Техническое обслуживание: состояние системы.
import "server-only";
import type { SessionUser } from "@/lib/types";
import { audit, type Ctx } from "../repo";
import { ok, requireRole, type Result } from "./common";

const startedAt = Date.now();

export async function systemHealth(c: Ctx) {
  const count = async (t: string) => {
    const r = await c.client.execute({ sql: `SELECT COUNT(*) AS n FROM ${t}`, args: [] });
    const val = (r.rows[0] as unknown as Record<string, unknown>)?.n;
    return Number(typeof val === "bigint" ? val : val ?? 0);
  };
  const [users, sessions, groups, students, grades, audit_log, notifications] = await Promise.all([
    count("users"), count("sessions"), count("groups"), count("students"),
    count("grades"), count("audit_log"), count("notifications"),
  ]);
  return {
    status: "ok",
    node: process.version,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    tables: { users, sessions, groups, students, grades, audit_log, notifications },
    demoMode: process.env.DEMO_MODE !== "false",
  };
}

export const systemActions: Record<string, (c: Ctx, u: SessionUser, raw: unknown) => Result | Promise<Result>> = {
  "system.backup": (c: Ctx, u: SessionUser): Result => {
    requireRole(u, "tech_admin");
    audit(c, { actorId: u.id, actorRole: u.role, action: "system.backup", entity: "system", entityId: "turso", before: null, after: null, reason: null });
    return ok("Данные хранятся в Turso — облачном SQLite. Экспорт через панель управления Turso: turso.tech");
  },
};
