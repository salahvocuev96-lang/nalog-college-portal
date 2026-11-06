// Диспетчер действий: единая точка изменения данных.
// Записи буферизуются в c._pending и фиксируются одним batch после успешного действия.
import "server-only";
import { ZodError } from "zod";
import type { SessionUser } from "@/lib/types";
import { loadDB, type Ctx } from "../repo";
import { Denied, fail, type Result } from "./common";
import { journalActions } from "./journal";
import { messageActions } from "./messages";
import { adminActions } from "./admin";
import { systemActions } from "./system";

type Handler = (c: Ctx, u: SessionUser, raw: unknown) => Result | Promise<Result>;

const handlers: Record<string, Handler> = {
  ...journalActions,
  ...messageActions,
  ...adminActions,
  ...systemActions,
};

export const ACTION_TYPES = Object.keys(handlers);

export async function runAction(c: Ctx, user: SessionUser, type: string, payload: unknown): Promise<Result> {
  const h = handlers[type];
  if (!h) return fail("Неизвестное действие");
  if (user.mustChangePassword) return fail("Сначала смените временный пароль");

  c._pending = [];
  try {
    const r = await Promise.resolve(h(c, user, payload));
    if (r.ok) {
      if (c._pending.length > 0) {
        await c.client.batch(c._pending, "write");
      }
    } else {
      c.db = await loadDB(c.client);
    }
    c._pending = undefined;
    return r;
  } catch (e) {
    c._pending = undefined;
    c.db = await loadDB(c.client);
    return errorResult(e);
  }
}

function errorResult(e: unknown): Result {
  if (e instanceof Denied) return fail(e.message);
  if (e instanceof ZodError) return fail(e.issues.map((i) => i.message).join("; "));
  console.error("[action]", e);
  return fail("Внутренняя ошибка сервера. Изменения не сохранены");
}
