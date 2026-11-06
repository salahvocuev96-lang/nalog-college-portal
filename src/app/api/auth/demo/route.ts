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
  const c = await getContext();
  const user = await findUserByLogin(c.client, login);
  if (!user || !user.active) return json({ error: "Демо-аккаунт недоступен" }, 403);
  const token = await createSession(c.client, user.id);
  const sessionUser = await userFromToken(c.client, c.db, token);
  const res = json(sessionPayload(c, sessionUser!));
  setSessionCookie(res, token, req);
  return res;
}
