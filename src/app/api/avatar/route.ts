import { getContext } from "@/server/context";
import { currentUser, json, sameOrigin, unauthorized } from "@/server/http";

const MAX_BYTES = 400_000; // ~300KB base64 ≈ ~220KB файл

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await req.json() as { photo?: unknown };
  const photo = body.photo;
  if (typeof photo !== "string" || !photo.startsWith("data:image/")) return json({ error: "Неверный формат" }, 400);
  if (photo.length > MAX_BYTES) return json({ error: "Файл слишком большой (макс. 300 КБ)" }, 400);
  const c = getContext();
  c.sql.prepare("UPDATE users SET photo = ? WHERE id = ?").run(photo, user.id);
  c.db.userPhotos[user.id] = photo;
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const user = await currentUser();
  if (!user) return unauthorized();
  const c = getContext();
  c.sql.prepare("UPDATE users SET photo = NULL WHERE id = ?").run(user.id);
  delete c.db.userPhotos[user.id];
  return json({ ok: true });
}
