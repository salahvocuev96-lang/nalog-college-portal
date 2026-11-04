// Диспетчер действий: единая точка изменения данных.
// Каждое действие выполняется в транзакции; при ошибке база откатывается, кэш перечитывается.
import "server-only";
import { ZodError } from "zod";
import type { SessionUser } from "@/lib/types";
import { loadDB, type Ctx } from "../repo";
import { Denied, fail, type Result } from "./common";
import { journalActions } from "./journal";
import { messageActions } from "./messages";
import { adminActions } from "./admin";
import { systemActions } from "./system";

const handlers: Record<string, (c: Ctx, u: SessionUser, raw: unknown) => Result> = {
  ...journalActions,
  ...messageActions,
  ...adminActions,
  ...systemActions,
};

export const ACTION_TYPES = Object.keys(handlers);

export function runAction(c: Ctx, user: SessionUser, type: string, payload: unknown): Result {
  const h = handlers[type];
  if (!h) return fail("Неизвестное действие");
  if (user.mustChangePassword) return fail("Сначала смените временный пароль");
  // VACUUM нельзя выполнять внутри транзакции
  if (type === "system.backup") return safe(() => h(c, user, payload));
  c.sql.exec("BEGIN");
  try {
    const r = h(c, user, payload);
    if (r.ok) c.sql.exec("COMMIT");
    else {
      c.sql.exec("ROLLBACK");
      c.db = loadDB(c.sql);
    }
    return r;
  } catch (e) {
    c.sql.exec("ROLLBACK");
    c.db = loadDB(c.sql);
    return errorResult(e);
  }
}

function safe(fn: () => Result): Result {
  try {
    return fn();
  } catch (e) {
    return errorResult(e);
  }
}

function errorResult(e: unknown): Result {
  if (e instanceof Denied) return fail(e.message);
  if (e instanceof ZodError) return fail(e.issues.map((i) => i.message).join("; "));
  console.error("[action]", e);
  return fail("Внутренняя ошибка сервера. Изменения не сохранены");
}
