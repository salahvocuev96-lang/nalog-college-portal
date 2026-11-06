// Смена пароля (обязательна при первом входе с временным паролем)
import { getContext } from "@/server/context";
import { findUserById, passwordProblem, setPassword, verifyPassword } from "@/server/auth";
import { audit } from "@/server/repo";
import { currentUser, json, readJson, sameOrigin, sessionPayload, unauthorized } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJson(req);
  const current = String(body.current ?? "");
  const next = String(body.next ?? "").slice(0, 200);
  const c = await getContext();
  const row = await findUserById(c.client, user.id);
  if (!row) return unauthorized();
  if (!verifyPassword(current, row.password_hash)) return json({ error: "Текущий пароль указан неверно" }, 400);
  const problem = passwordProblem(next);
  if (problem) return json({ error: problem }, 400);
  if (next === current) return json({ error: "Новый пароль должен отличаться от текущего" }, 400);
  await setPassword(c.client, user.id, next);
  audit(c, { actorId: user.id, actorRole: user.role, action: "auth.passwordChange", entity: "user", entityId: user.id, before: null, after: null, reason: null });
  return json(sessionPayload(c, { ...user, mustChangePassword: false }));
}
