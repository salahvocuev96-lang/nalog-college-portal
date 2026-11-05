"use client";
import Link from "next/link";
import { useTeacher } from "./useTeacher";
import { AvgBadge, Card, CardHeader, Empty, MoreLink, StatCard, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatLong, formatTime, formatWithWeekday, semesterPeriod } from "@/lib/dates";
import { nextSchoolDay, teacherLessons } from "@/lib/queries";
import { groupAverage } from "@/lib/stats";
import { nameOf } from "@/lib/access";
import { key } from "@/lib/constants";

export function TeacherHome() {
  const { db, session, loads, groups, subjects } = useTeacher();
  const now = db.serverToday;
  const day = nextSchoolDay(now);
  const lessons = teacherLessons(db, session!.id, day);
  const sem = semesterPeriod(now, db.settings);
  // Необходимые действия: сегодняшние занятия без единой отметки, непрочитанные письма
  const todo: { text: string; href: string; icon: "journal" | "chat" | "task" }[] = [];
  if (day === now) {
    const seen = new Set<string>();
    for (const l of lessons) {
      const id = l.groupId + l.subjectId;
      if (seen.has(id) || !db.subjects.find((x) => x.id === l.subjectId)?.graded) continue;
      seen.add(id);
      const sts = db.students.filter((x) => x.groupId === l.groupId);
      const filled = sts.some((x) => db.grades[key(x.id, l.subjectId, now)] || db.attendance[key(x.id, l.subjectId, now)]);
      if (!filled) todo.push({ text: `Заполнить журнал: ${l.group}, «${l.subject}»`, href: `/journal/?group=${l.groupId}&subject=${l.subjectId}&date=${now}`, icon: "journal" });
    }
  }
  const lastMessages = [...db.messages].filter((m) => m.to === session!.id).sort((a, b) => b.at - a.at).slice(0, 4);
  const students = db.students.filter((s) => groups.some((g) => g.id === s.groupId)).length;
  const unread = db.messages.filter((m) => m.to === session!.id && !m.read).length;
  const weekly = db.schedule.filter((s) => s.teacherId === session!.id).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted first-letter:uppercase">{formatWithWeekday(now)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Добрый день, {session!.name}</h1>
          <p className="mt-2 text-sm text-muted">Назначения учебной части: {groups.length} групп, {subjects.length} предметов, {weekly} пар в неделю</p>
        </div>
        <div className="flex gap-2">
          <Link href="/journal/" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-brand-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"><Icon name="journal" className="size-4" />Открыть журнал</Link>
          <Link href="/homework/" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-subtle"><Icon name="task" className="size-4" />Задания</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Мои группы" value={groups.length} icon="users" />
        <StatCard label="Студентов" value={students} icon="user" />
        <StatCard label="Пар сегодня" value={day === now ? lessons.length : 0} icon="calendar" tone="gold" />
        <StatCard label="Новые сообщения" value={unread} icon="chat" tone={unread ? "red" : "green"} />
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <Card>
            <CardHeader icon="calendar" title={day === now ? "Мои пары сегодня" : `Пары на ${formatLong(day)}`} subtitle={day === now ? "Нажмите на пару, чтобы открыть журнал" : undefined} />
            {lessons.length === 0 ? <Empty icon="calendar" title="Пар нет" /> : (
              <ul className="divide-y divide-line">
                {lessons.map((l) => (
                  <li key={l.slot + l.groupId}>
                    <Link href={day === now ? `/journal/?group=${l.groupId}&subject=${l.subjectId}&date=${day}` : "/schedule/"} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:gap-4 sm:px-5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-xs font-bold text-slate-600">{l.slot}</span>
                      <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{l.subject}</p><p className="truncate text-xs text-muted">Группа {l.group}{l.room && ` · ауд. ${l.room}`} · {l.time}</p></div>
                      <span className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">Журнал<Icon name="chevronRight" className="size-3.5" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader icon="chat" title="Последние сообщения" action={<Link href="/messages/"><MoreLink>Все</MoreLink></Link>} />
            {lastMessages.length === 0 ? <Empty icon="chat" title="Сообщений нет" /> : (
              <ul className="divide-y divide-line">
                {lastMessages.map((m) => (
                  <li key={m.id}>
                    <Link href="/messages/" className="flex flex-col gap-0.5 px-4 py-3 text-sm transition-colors hover:bg-subtle sm:flex-row sm:items-center sm:gap-3 sm:px-5">
                      <span className="flex items-center gap-2 sm:w-44 sm:shrink-0">{!m.read && <span className="size-1.5 shrink-0 rounded-full bg-brand-600" />}<span className={cx("truncate", m.read ? "text-ink" : "font-semibold text-ink")}>{nameOf(db, m.from)}</span></span>
                      <span className="min-w-0 flex-1 truncate text-muted">{m.text}</span>
                      <span className="shrink-0 text-xs text-muted">{formatTime(m.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <Card>
            <CardHeader icon="alert" tone="gold" title="Необходимые действия" />
            {todo.length === 0 && unread === 0 ? <Empty icon="check" title="Всё сделано" text="Журнал за сегодня заполнен, новых сообщений нет" /> : (
              <ul className="divide-y divide-line">
                {todo.map((t) => (
                  <li key={t.href}><Link href={t.href} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-subtle sm:px-5"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-gold-50 text-gold-700"><Icon name={t.icon} className="size-4" /></span><span className="min-w-0 flex-1">{t.text}</span><Icon name="chevronRight" className="size-4 shrink-0 text-muted" /></Link></li>
                ))}
                {unread > 0 && <li><Link href="/messages/" className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-subtle sm:px-5"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-gold-50 text-gold-700"><Icon name="chat" className="size-4" /></span><span className="flex-1">Ответить на сообщения: {unread}</span><Icon name="chevronRight" className="size-4 text-muted" /></Link></li>}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader icon="chart" title="Успеваемость групп" subtitle={sem.label} />
            <ul className="divide-y divide-line">
              {groups.map((g) => {
                const subjIds = loads.filter((l) => l.groupId === g.id).map((l) => l.subjectId);
                const vals = subjIds.map((sid) => groupAverage(db, g.id, { subjectId: sid, period: sem })).filter((v): v is number => v !== null);
                return (
                  <li key={g.id} className="flex items-center justify-between px-4 py-2.5 sm:px-5">
                    <span className="text-sm"><span className="font-semibold text-ink">{g.code}</span> <span className="text-xs text-muted">· {g.course} курс</span></span>
                    <AvgBadge value={vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
