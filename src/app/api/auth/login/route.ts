import { getContext } from "@/server/context";
import { clearFailures, createSession, findUserByLogin, loginBlocked, registerFailure, userFromToken, verifyPassword } from "@/server/auth";
import { audit } from "@/server/repo";
import { json, readJson, sameOrigin, sessionPayload, setSessionCookie } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const body = await readJson(req);
  const login = String(body.login ?? "").trim().toLowerCase().slice(0, 64);
  const password = String(body.password ?? "").slice(0, 200);
  if (!login || !password) return json({ error: "Введите логин и пароль" }, 400);
  const wait = loginBlocked(login);
  if (wait) return json({ error: `Слишком много попыток. Повторите через ${wait} с` }, 429);
  const c = getContext();
  const user = findUserByLogin(c.sql, login);
  if (!user || !verifyPassword(password, user.password_hash)) {
    registerFailure(login);
    return json({ error: "Неверный логин или пароль" }, 401);
  }
  if (!user.active) return json({ error: "Учётная запись заблокирована. Обратитесь в учебную часть" }, 403);
  clearFailures(login);
  const token = createSession(c.sql, user.id);
  audit(c, { actorId: user.id, actorRole: user.role, action: "auth.login", entity: "user", entityId: user.id, before: null, after: null, reason: null });
  const res = json(sessionPayload(userFromToken(c.sql, c.db, token)!));
  setSessionCookie(res, token, req);
  return res;
}
