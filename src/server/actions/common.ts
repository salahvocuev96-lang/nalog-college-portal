// Общие типы и помощники для серверных действий
import "server-only";
import { randomUUID } from "node:crypto";
import type { Notification, NotificationKind, ID, Role, SessionUser } from "@/lib/types";
import { repo, type Ctx } from "../repo";

export type Result = { ok: true; info?: string; data?: unknown } | { ok: false; error: string };
export const ok = (info?: string, data?: unknown): Result => ({ ok: true, info, data });
export const fail = (error: string): Result => ({ ok: false, error });

export class Denied extends Error {}

export function requireRole(user: SessionUser, ...roles: Role[]) {
  if (!roles.includes(user.role)) throw new Denied("Действие недоступно для вашей роли");
}

export const uid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

// ---------- Уведомления ----------
// Канал «внутри портала» реализован. Email, push и Telegram подключаются как новые каналы
// с тем же интерфейсом, без изменения кода действий.

export interface NotificationChannel {
  name: string;
  send(c: Ctx, n: Notification): void;
}

const inApp: NotificationChannel = { name: "in-app", send: (c, n) => repo.insertNotification(c, n) };
export const channels: NotificationChannel[] = [inApp];

export function notify(c: Ctx, userId: ID, kind: NotificationKind, title: string, text: string, href: string) {
  const n: Notification = { id: uid("n"), userId, kind, title, text, at: Date.now(), read: false, href };
  for (const ch of channels) ch.send(c, n);
}

export const subjName = (c: Ctx, id: ID) => c.db.subjects.find((s) => s.id === id)?.name ?? "";
export const fmtDate = (iso: string) => iso.split("-").reverse().join(".");
