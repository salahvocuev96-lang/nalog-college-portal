// Состояние системы: только технический администратор
import { getContext } from "@/server/context";
import { systemHealth } from "@/server/actions/system";
import { currentUser, forbidden, json, unauthorized } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "tech_admin") return forbidden();
  return json(systemHealth(getContext()));
}
