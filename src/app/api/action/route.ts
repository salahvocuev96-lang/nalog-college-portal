// Все изменения данных идут через этот маршрут. Права проверяются в src/server/actions.
import { getContext } from "@/server/context";
import { runAction } from "@/server/actions";
import { snapshotFor } from "@/server/scope";
import { currentUser, json, readJson, sameOrigin, unauthorized } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const user = await currentUser();
  if (!user) return unauthorized();
  const { type, payload } = await readJson(req);
  if (typeof type !== "string") return json({ error: "Не указано действие" }, 400);
  const c = getContext();
  const result = runAction(c, user, type, payload);
  return json({ result, snapshot: snapshotFor(c, user) }, result.ok ? 200 : 422);
}
