// Проверка доступности для мониторинга (без персональных данных)
import { getContext } from "@/server/context";

export async function GET() {
  try {
    getContext().sql.prepare("SELECT 1").get();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
