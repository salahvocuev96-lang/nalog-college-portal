// Восстановление пароля: заявка попадает администрации
import { getContext } from "@/server/context";
import { createResetRequest } from "@/server/auth";
import { json, readJson, sameOrigin } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const { login } = await readJson(req);
  if (typeof login !== "string" || login.trim().length < 3) return json({ error: "Введите логин" }, 400);
  const c = await getContext();
  await createResetRequest(c.client, login);
  return json({ ok: true, info: "Заявка отправлена в учебную часть. Новый временный пароль выдаст администратор" });
}
