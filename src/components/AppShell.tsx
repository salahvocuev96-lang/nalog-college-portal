"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadSession, logout, markNotificationsRead, useStore } from "@/lib/store";
import { NAV, ROLE_LABEL } from "@/lib/nav";
import { formatTime, formatWithWeekday, today } from "@/lib/dates";
import { Icon } from "./icons";
import { Avatar, cx } from "./ui";
import { Crest } from "./Crest";
import { PageSkeleton, Toaster } from "./feedback";

export function AppShell({ children }: { children: ReactNode }) {
  const { session, status } = useStore();
  const router = useRouter();
  const path = usePathname();
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (status === "idle") loadSession();
  }, [status]);
  useEffect(() => {
    if (status !== "ready") return;
    if (!session) router.replace("/");
    else if (session.mustChangePassword) router.replace("/change-password/");
  }, [session, status, router]);
  useEffect(() => {
    setMore(false);
  }, [path]);

  if (status !== "ready" || !session || session.mustChangePassword)
    return (
      <div className="min-h-dvh lg:pl-72">
        <aside className="fixed inset-y-0 left-0 hidden w-72 bg-brand-900 lg:block" />
        <main className="mx-auto max-w-7xl px-4 pt-24 md:px-8"><PageSkeleton /></main>
      </div>
    );
  const items = NAV[session.role];
  const isActive = (href: string) => path === href || path === href.slice(0, -1) || path.startsWith(href);
  const onLogout = async () => {
    await logout();
    router.replace("/");
  };
  const mobileMain = items.slice(0, 4);
  const mobileMore = items.slice(4);

  return (
    <div className="min-h-dvh lg:pl-72">
      {/* Сайдбар для компьютера */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-brand-900 text-white lg:flex">
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full border-[26px] border-gold-500/[0.07]" />
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <span className="grid size-12 place-items-center rounded-xl bg-white p-1"><Crest className="size-10" /></span>
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-wide">Налоговый колледж</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">Education portal</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cx(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
                isActive(it.href) ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-gold-500)]" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon name={it.icon} className={cx("size-[19px] transition-colors", isActive(it.href) ? "text-gold-400" : "")} />
              <span className="flex-1">{it.label}</span>
              <NavCounter href={it.href} />
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <Avatar name={session.name} className="bg-gold-500 text-brand-950" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{session.name}</p>
              <p className="text-xs text-white/60">{ROLE_LABEL[session.role]}</p>
            </div>
            <button onClick={onLogout} title="Выйти" aria-label="Выйти" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white">
              <Icon name="logout" className="size-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Шапка */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 md:px-8">
          <Link href="/home/" className="flex items-center gap-2.5 lg:hidden">
            <Crest className="size-9" />
            <span className="text-[15px] font-bold text-brand-900">Налоговый колледж</span>
          </Link>
          <p className="hidden text-sm text-muted lg:block">{formatWithWeekday(today())}</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-600 ring-1 ring-gold-100 sm:inline">Демо-версия</span>
            <Bell />
          </div>
        </div>
      </header>

      <main key={path} className="mx-auto max-w-7xl animate-enter px-4 pb-28 pt-6 md:px-8 lg:pb-12">{children}</main>
      <Toaster />

      {/* Нижнее меню для телефона и планшета */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white lg:hidden">
        <div className="grid grid-cols-5">
          {mobileMain.map((it) => (
            <Link key={it.href} href={it.href} className={cx("flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium", isActive(it.href) ? "text-brand-800" : "text-muted")}>
              <span className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors duration-200", isActive(it.href) && "bg-brand-50")}>
                <Icon name={it.icon} className={cx("size-[22px]", isActive(it.href) && "text-gold-600")} />
              </span>
              <span className="max-w-full truncate px-1">{it.short}</span>
            </Link>
          ))}
          <button onClick={() => setMore((v) => !v)} aria-expanded={more} className={cx("flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium", more ? "text-brand-800" : "text-muted")}>
            <span className={cx("grid h-7 w-12 place-items-center rounded-full", more && "bg-brand-50")}><Icon name="menu" className="size-[22px]" /></span>
            Ещё
          </button>
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-20 animate-fade bg-brand-950/40 lg:hidden" onClick={() => setMore(false)}>
          <div className="safe-bottom absolute inset-x-0 bottom-[61px] max-h-[75dvh] animate-sheet overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-50 p-3">
              <Avatar name={session.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-900">{session.name}</p>
                <p className="text-xs text-muted">{ROLE_LABEL[session.role]}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {mobileMore.map((it) => (
                <Link key={it.href} href={it.href} className={cx("flex items-center gap-2.5 rounded-xl border border-line px-3 py-3 text-sm font-medium", isActive(it.href) ? "border-gold-500 bg-gold-50 text-brand-900" : "text-ink")}>
                  <Icon name={it.icon} className="size-5 text-gold-600" />
                  {it.label}
                </Link>
              ))}
              <button onClick={onLogout} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-3 text-sm font-medium text-rose-600">
                <Icon name="logout" className="size-5" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bell() {
  const { db, session } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!session) return null;
  const list = db.notifications.filter((n) => n.userId === session.id).sort((a, b) => b.at - a.at);
  const unread = list.filter((n) => !n.read).length;
  const kindIcon = KIND_ICON;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative grid size-10 place-items-center rounded-xl text-brand-800 hover:bg-brand-50" aria-label="Уведомления">
        <Icon name="bell" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-[18px] place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-bold leading-[18px] text-brand-950">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-[min(92vw,380px)] origin-top-right animate-pop overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-pop)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-brand-900">Уведомления</p>
            {unread > 0 && <button onClick={() => markNotificationsRead()} className="text-xs font-semibold text-gold-600">Прочитать все</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {list.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Новых уведомлений нет</p>}
            {list.slice(0, 8).map((n) => (
              <Link key={n.id} href={n.href} onClick={() => { setOpen(false); if (!n.read) markNotificationsRead(n.id); }} className={cx("flex gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-page", !n.read && "bg-gold-50/60")}>
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon name={kindIcon[n.kind]} className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-brand-900">{n.title}</span>
                  <span className="block truncate text-[13px] text-muted">{n.text}</span>
                  <span className="text-[11px] text-muted/80">{formatTime(n.at)}</span>
                </span>
              </Link>
            ))}
          </div>
          <Link href="/notifications/" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-[13px] font-semibold text-brand-700 hover:bg-page">Все уведомления</Link>
        </div>
      )}
    </div>
  );
}

export const KIND_ICON = { grade: "star", grade_change: "edit", message: "chat", homework: "task", attendance: "check", schedule: "calendar", announcement: "megaphone" } as const;

/** Счётчик непрочитанного рядом с пунктом меню */
function NavCounter({ href }: { href: string }) {
  const { db, session } = useStore();
  if (!session) return null;
  let n = 0;
  if (href === "/messages/") n = db.messages.filter((m) => m.to === session.id && !m.read).length;
  if (href === "/notifications/") n = db.notifications.filter((x) => x.userId === session.id && !x.read).length;
  if (!n) return null;
  return <span className="grid min-w-5 place-items-center rounded-full bg-gold-500 px-1.5 text-[11px] font-bold leading-5 text-brand-950">{n > 99 ? "99+" : n}</span>;
}
