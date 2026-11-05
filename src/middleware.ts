// Без cookie сессии кабинет не открывается. Полная проверка сессии и прав выполняется в API.
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (!req.cookies.get("nk_session")) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|crest.jpg|nk-logo.jpg|favicon.ico|$).+)"],
};
