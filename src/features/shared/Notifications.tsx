"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { markNotificationsRead, useStore } from "@/lib/store";
import { Button, Card, Empty, PageHeader, Segmented, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { KIND_ICON } from "@/components/AppShell";
import { formatTime } from "@/lib/dates";
import type { NotificationKind } from "@/lib/types";

const FILTERS: { value: string; label: string; kinds: NotificationKind[] }[] = [
  { value: "all", label: "Все", kinds: [] },
  { value: "grades", label: "Оценки", kinds: ["grade", "grade_change", "attendance"] },
  { value: "study", label: "Учёба", kinds: ["homework", "schedule"] },
  { value: "messages", label: "Сообщения", kinds: ["message", "announcement"] },
];

/** Центр уведомлений. Канал доставки сейчас один: внутри портала (см. src/server/actions/common.ts) */
export function NotificationsCenter() {
  const { db } = useStore();
  const [filter, setFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter)!;
    return [...db.notifications]
      .filter((n) => (!f.kinds.length || f.kinds.includes(n.kind)) && (!unreadOnly || !n.read))
      .sort((a, b) => b.at - a.at);
  }, [db.notifications, filter, unreadOnly]);
  const unread = db.notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Уведомления"
        subtitle={unread ? `Непрочитанных: ${unread}` : "Все уведомления прочитаны"}
        action={unread > 0 && <Button variant="outline" onClick={() => markNotificationsRead()}><Icon name="check" className="size-4" />Прочитать все</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f.value, label: f.label }))} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="size-4 accent-[var(--color-brand-800)]" />
          Только непрочитанные
        </label>
      </div>
      <Card>
        {list.length === 0 ? <Empty icon="bell" title="Здесь пока пусто" text="Новые оценки, задания и изменения расписания появятся здесь" /> : (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id}>
                <Link href={n.href} onClick={() => !n.read && markNotificationsRead(n.id)} className={cx("flex gap-3 px-5 py-4 transition hover:bg-page", !n.read && "bg-gold-50/50")}>
                  <span className={cx("mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg", n.kind === "announcement" ? "bg-gold-50 text-gold-700" : "bg-slate-100 text-slate-600")}>
                    <Icon name={KIND_ICON[n.kind]} className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-brand-900">{n.title}</span>
                      {!n.read && <span className="size-2 rounded-full bg-gold-500" aria-label="не прочитано" />}
                      <span className="ml-auto shrink-0 text-xs text-muted">{formatTime(n.at)}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{n.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">Доставка по email, push и в мессенджеры запланирована: архитектура уведомлений уже поддерживает дополнительные каналы.</p>
    </div>
  );
}
