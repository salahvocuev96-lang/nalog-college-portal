// Быстрый вход для демонстрации. При DEMO_MODE=false маршрут отключён.
import { getContext, isDemoMode } from "@/server/context";
import { createSession, findUserByLogin, userFromToken } from "@/server/auth";
import { json, readJson, sameOrigin, sessionPayload, setSessionCookie } from "@/server/http";

const DEMO_LOGINS = new Set(["student", "teacher", "parent", "admin", "tech"]);

export async function POST(req: Request) {
  if (!isDemoMode()) return json({ error: "Демо-вход отключён" }, 404);
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const { login } = await readJson(req);
  if (typeof login !== "string" || !DEMO_LOGINS.has(login)) return json({ error: "Неизвестная демо-роль" }, 400);
  const c = getContext();
  const user = findUserByLogin(c.sql, login);
  if (!user || !user.active) return json({ error: "Демо-аккаунт недоступен" }, 403);
  const token = createSession(c.sql, user.id);
  const res = json(sessionPayload(userFromToken(c.sql, c.db, token)!));
  setSessionCookie(res, token, req);
  return res;
}
