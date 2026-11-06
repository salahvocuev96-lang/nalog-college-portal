// Учётные записи и заявки на восстановление пароля: только администрация колледжа
import { getContext } from "@/server/context";
import { listAccounts, listResetRequests } from "@/server/auth";
import { currentUser, forbidden, json, unauthorized } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "college_admin") return forbidden();
  const c = await getContext();
  return json({ accounts: await listAccounts(c.client, c.db), requests: await listResetRequests(c.client) });
}
