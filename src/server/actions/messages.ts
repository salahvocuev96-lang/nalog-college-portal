// Сообщения и уведомления
import "server-only";
import { z } from "zod";
import { canMessage } from "@/lib/access";
import type { SessionUser } from "@/lib/types";
import { repo, type Ctx } from "../repo";
import { fail, notify, ok, uid, type Result } from "./common";

const sendSchema = z.object({ to: z.string(), text: z.string().trim().min(1, "Пустое сообщение").max(4000) });

export const messageActions = {
  "message.send": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    const p = sendSchema.parse(raw);
    if (!canMessage(c.db, u, p.to)) return fail("Нельзя написать этому пользователю");
    repo.insertMessage(c, { id: uid("m"), from: u.id, to: p.to, text: p.text, at: Date.now(), read: false });
    notify(c, p.to, "message", "Новое сообщение", `${u.name}: ${p.text.slice(0, 80)}`, "/messages/");
    return ok();
  },
  "message.markRead": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    const p = z.object({ otherId: z.string() }).parse(raw);
    repo.markMessagesRead(c, p.otherId, u.id); // помечаются только письма, адресованные самому пользователю
    return ok();
  },
  "notifications.markRead": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    const p = z.object({ id: z.string().optional() }).parse(raw ?? {});
    repo.markNotificationsRead(c, u.id, p.id);
    return ok();
  },
};
