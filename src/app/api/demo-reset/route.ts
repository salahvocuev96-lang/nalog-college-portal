// Сброс демо-данных к исходному состоянию (только демо-режим и только администраторы)
import { getContext, isDemoMode, createContext } from "@/server/context";
import { currentUser, forbidden, json, sameOrigin, unauthorized } from "@/server/http";
import { batchExec } from "@/server/turso";
import { insertAll } from "@/server/repo";
import { seedAccounts } from "@/server/auth";
import { buildSeed } from "@/server/seed";

const TABLES_IN_ORDER = [
  "sessions", "audit_log", "password_reset_requests", "users",
  "homework_progress", "notifications", "messages",
  "grades", "attendance", "homework",
  "schedule_changes", "schedule_slots", "teaching_loads",
  "parent_children", "parents", "students",
  "groups", "teachers", "staff", "subjects",
];

export async function POST(req: Request) {
  if (!isDemoMode()) return json({ error: "Доступно только в демо-режиме" }, 404);
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "college_admin" && user.role !== "tech_admin") return forbidden();

  const c = await getContext();
  // Очистить все таблицы в правильном порядке (дочерние раньше родительских)
  await batchExec(c.client, TABLES_IN_ORDER.map((t) => ({ sql: `DELETE FROM ${t}` })));
  // Залить свежий сид
  const seed = buildSeed();
  await insertAll(c.client, seed);
  await seedAccounts(c.client, seed);
  // Обновить глобальный контекст
  const g = globalThis as unknown as { __nkCtx?: Promise<import("@/server/repo").Ctx> };
  g.__nkCtx = createContext();
  const res = json({ ok: true });
  res.cookies.delete("nk_session");
  return res;
}
