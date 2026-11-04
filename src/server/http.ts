// Помощники для API-маршрутов: текущий пользователь, защита от CSRF, ответы
import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/types";
import { getContext } from "./context";
import { SESSION_COOKIE, SESSION_TTL_MS, userFromToken } from "./auth";
import { snapshotFor } from "./scope";

export async function currentUser(): Promise<SessionUser | null> {
  const c = getContext();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userFromToken(c.sql, c.db, token);
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const unauthorized = () => json({ error: "Требуется вход" }, 401);
export const forbidden = (msg = "Недостаточно прав") => json({ error: msg }, 403);

/** Запросы, меняющие данные, принимаются только со своего сайта */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function sessionPayload(user: SessionUser) {
  const c = getContext();
  return { user, snapshot: user.mustChangePassword ? null : snapshotFor(c, user) };
}

/** Cookie помечается Secure, когда сайт открыт по HTTPS (напрямую или через обратный прокси) */
export function setSessionCookie(res: NextResponse, token: string, req: Request) {
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: https || process.env.FORCE_SECURE_COOKIES === "true",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}
