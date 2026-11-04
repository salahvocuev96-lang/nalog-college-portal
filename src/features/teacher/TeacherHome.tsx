"use client";
import Link from "next/link";
import { useTeacher } from "./useTeacher";
import { AvgBadge, Card, HeroCard, CardHeader, Empty, StatCard } from "@/components/ui";
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
    <div className="space-y-6 stagger">
      <HeroCard>
        <p className="text-sm text-white/60">{formatWithWeekday(now)}</p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Добрый день, {session!.name}</h1>
        <p className="mt-2 text-sm text-white/70">Назначения от учебной части: {groups.length} групп, {subjects.length} предметов, {weekly} пар в неделю</p>
        <Link href="/journal/" className="mt-5 inline-flex h-11 items-center rounded-xl bg-gold-500 px-5 text-sm font-semibold text-brand-950 hover:bg-gold-400">Открыть журнал</Link>
      </HeroCard>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Мои группы" value={groups.length} icon="users" />
        <StatCard label="Студентов" value={students} icon="user" />
        <StatCard label="Пар сегодня" value={day === now ? lessons.length : 0} icon="calendar" tone="gold" />
        <StatCard label="Новые сообщения" value={unread} icon="chat" tone={unread ? "red" : "green"} />
      </div>

      <Card>
        <CardHeader icon="alert" title="Необходимые действия" />
        {todo.length === 0 && unread === 0 ? <Empty icon="check" title="Всё сделано" text="Журнал за сегодня заполнен, новых сообщений нет" /> : (
          <ul className="divide-y divide-line">
            {todo.map((t) => (
              <li key={t.href}><Link href={t.href} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-page"><span className="grid size-8 place-items-center rounded-lg bg-gold-50 text-gold-600"><Icon name={t.icon} className="size-4" /></span><span className="flex-1">{t.text}</span><Icon name="chevronRight" className="size-4 text-muted" /></Link></li>
            ))}
            {unread > 0 && <li><Link href="/messages/" className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-page"><span className="grid size-8 place-items-center rounded-lg bg-gold-50 text-gold-600"><Icon name="chat" className="size-4" /></span><span className="flex-1">Ответить на сообщения: {unread}</span><Icon name="chevronRight" className="size-4 text-muted" /></Link></li>}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader icon="calendar" title={day === now ? "Мои пары сегодня" : `Пары на ${formatLong(day)}`} />
          {lessons.length === 0 ? <Empty icon="calendar" title="Пар нет" /> : (
            <ul className="divide-y divide-line">
              {lessons.map((l) => (
                <li key={l.slot + l.groupId}>
                  <Link href={day === now ? `/journal/?group=${l.groupId}&subject=${l.subjectId}&date=${day}` : "/schedule/"} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-page">
                    <div className="w-[78px] shrink-0"><p className="text-[13px] font-bold text-brand-900">{l.slot} пара</p><p className="text-xs text-muted">{l.time}</p></div>
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{l.subject}</p><p className="text-xs text-muted">Группа {l.group}{l.room && ` · ауд. ${l.room}`}</p></div>
                    <Icon name="journal" className="size-[18px] text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader icon="chart" title="Успеваемость групп" action={<span className="text-xs text-muted">{sem.label}</span>} />
          <ul className="divide-y divide-line">
            {groups.map((g) => {
              const subjIds = loads.filter((l) => l.groupId === g.id).map((l) => l.subjectId);
              const vals = subjIds.map((sid) => groupAverage(db, g.id, { subjectId: sid, period: sem })).filter((v): v is number => v !== null);
              return (
                <li key={g.id} className="flex items-center justify-between px-5 py-3">
                  <span><span className="font-semibold text-brand-900">{g.code}</span> <span className="text-xs text-muted">{g.course} курс</span></span>
                  <AvgBadge value={vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader icon="chat" title="Последние сообщения" action={<Link href="/messages/" className="text-[13px] font-semibold text-gold-600">Все</Link>} />
        {lastMessages.length === 0 ? <Empty icon="chat" title="Сообщений нет" /> : (
          <ul className="divide-y divide-line">
            {lastMessages.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-44 shrink-0 truncate font-semibold text-brand-900">{nameOf(db, m.from)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{m.text}</span>
                <span className="text-xs text-muted">{formatTime(m.at)}</span>
                {!m.read && <span className="size-2 rounded-full bg-gold-500" />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
