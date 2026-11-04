// Сброс демо-данных к исходному состоянию (только демо-режим и только администраторы)
import { rmSync } from "node:fs";
import { getContext, isDemoMode, createContext, dbPath } from "@/server/context";
import { currentUser, forbidden, json, sameOrigin, unauthorized } from "@/server/http";

export async function POST(req: Request) {
  if (!isDemoMode()) return json({ error: "Доступно только в демо-режиме" }, 404);
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "college_admin" && user.role !== "tech_admin") return forbidden();
  const g = globalThis as unknown as { __nkCtx?: ReturnType<typeof getContext> };
  getContext().sql.close();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath() + suffix, { force: true });
  g.__nkCtx = createContext(dbPath());
  const res = json({ ok: true });
  res.cookies.delete("nk_session");
  return res;
}
