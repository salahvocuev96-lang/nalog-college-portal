// Проверка доступности для мониторинга
import { getContext } from "@/server/context";

export async function GET() {
  try {
    const c = await getContext();
    await c.client.execute("SELECT 1");
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
