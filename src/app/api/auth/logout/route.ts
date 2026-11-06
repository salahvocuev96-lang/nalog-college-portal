import { cookies } from "next/headers";
import { getContext } from "@/server/context";
import { SESSION_COOKIE, destroySession } from "@/server/auth";
import { json, sameOrigin } from "@/server/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Запрос отклонён" }, 403);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const c = await getContext();
    await destroySession(c.client, token);
  }
  const res = json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
