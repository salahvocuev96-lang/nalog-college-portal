// Учётные записи и заявки на восстановление пароля: только администрация колледжа
import { getContext } from "@/server/context";
import { listAccounts, listResetRequests } from "@/server/auth";
import { currentUser, forbidden, json, unauthorized } from "@/server/http";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "college_admin") return forbidden();
  const c = getContext();
  return json({ accounts: listAccounts(c.sql, c.db), requests: listResetRequests(c.sql) });
}
