"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useViewer } from "../useViewer";
import { Card, CardHeader, Empty, GradeChip, StatCard, ProgressRing, MeterRow, MoreLink, avgBarTone, cx } from "@/components/ui";
import { attendanceSummary, gradesOf, studentAverage, subjectAverages, fmtAvg, average } from "@/lib/stats";
import { formatLong, formatShort, formatTime, formatWithWeekday, semesterPeriod, fromISO, MONTHS, TIME_SLOTS, toMinutes } from "@/lib/dates";
import { groupLessons, homeworkStatus, nextSchoolDay, subjectName, HW_STATUS_META } from "@/lib/queries";
import { KIND_ICON } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { SPECIALTIES } from "@/lib/constants";
import { key } from "@/lib/constants";

const HW_DOT = { brand: "bg-brand-500", gold: "bg-gold-500", green: "bg-emerald-500", red: "bg-rose-500" } as const;

function useNowMinutes() {
  const [m, setM] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const d = new Date(); setM(d.getHours() * 60 + d.getMinutes()); };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return m;
}

export function StudentHome() {
  const { db, version, student, group, isParent } = useViewer();
  const now = db.serverToday;
  const nowMin = useNowMinutes();
  const data = useMemo(() => {
    if (!student || !group) return null;
    const sem = semesterPeriod(now, db.settings);
    const day = nextSchoolDay(now);
    const semGrades = gradesOf(db, student.id, { period: sem });
    const bySubject = [...subjectAverages(db, student.id, sem)]
      .map(([id, vals]) => ({ id, name: subjectName(db, id), avg: average(vals) ?? 0, count: vals.length }))
      .sort((a, b) => b.avg - a.avg);
    const byMonth = new Map<string, number[]>();
    for (const g of semGrades) { const k = g.date.slice(0, 7); byMonth.set(k, [...(byMonth.get(k) ?? []), g.value]); }
    const months = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([k, v]) => ({ k, label: MONTHS[fromISO(`${k}-01`).getMonth()].slice(0, 3), avg: average(v) ?? 0 }));
    const dist = [5, 4, 3, 2].map((v) => ({ v, n: semGrades.filter((g) => g.value === v).length }));
    const allHw = db.homework.filter((h) => h.groupId === group.id);
    const doneHw = allHw.filter((h) => homeworkStatus(db, h, student.id, now) === "done").length;
    return {
      sem, day, bySubject, months, dist, doneHw, totalHw: allHw.length,
      avg: studentAverage(db, student.id, { period: sem }),
      att: attendanceSummary(db, student.id, sem, now),
      lessons: groupLessons(db, group.id, day),
      recent: gradesOf(db, student.id).slice(-8).reverse(),
      hw: allHw.filter((h) => h.due >= now && homeworkStatus(db, h, student.id, now) !== "done").sort((a, b) => a.due.localeCompare(b.due)),
      notes: [...db.notifications].sort((a, b) => b.at - a.at).slice(0, 4),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, student, group, now]);
  if (!student || !group || !data) return <Card><Empty title="Студент не найден" /></Card>;

  const firstName = student.name.split(" ")[1];
  const isToday = data.day === now;
  const avgPct = data.avg === null ? 0 : (data.avg / 5) * 100;
  const hwPct = data.totalHw ? Math.round((data.doneHw / data.totalHw) * 100) : 100;
  const distMax = Math.max(1, ...data.dist.map((d) => d.n));
  const att = data.att;
  const attParts = [
    { n: att.present, label: "Был", cls: "bg-emerald-500" },
    { n: att.late, label: "Опоздал", cls: "bg-gold-500" },
    { n: att.sick, label: "Болел", cls: "bg-sky-500" },
    { n: att.absent, label: "Пропуск", cls: "bg-rose-500" },
  ];
  const lessonState = (slot: number) => {
    if (!isToday || nowMin === null) return "future";
    const t = TIME_SLOTS[slot - 1];
    if (!t) return "future";
    if (nowMin >= toMinutes(t.end)) return "past";
    if (nowMin >= toMinutes(t.start)) return "now";
    return "future";
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted first-letter:uppercase">{formatWithWeekday(now)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {isParent ? <>Успеваемость: {student.name.split(" ").slice(0, 2).join(" ")}</> : <>Здравствуйте, {firstName}!</>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-semibold text-brand-800">Группа {group.code}</span>
            <span className="text-slate-300">•</span>
            <span>{group.course} курс</span>
            <span className="text-slate-300">•</span>
            <span>{data.sem.label}</span>
            <span className="hidden text-slate-300 sm:inline">•</span>
            <span className="hidden truncate sm:inline">{SPECIALTIES[group.specialty] ?? group.specialty}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/diary/" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-brand-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"><Icon name="book" className="size-4" />Дневник</Link>
          <Link href="/schedule/" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-subtle"><Icon name="calendar" className="size-4" />Расписание</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Средний балл" value={fmtAvg(data.avg)} hint={data.sem.label} icon="star" tone="gold" progress={avgPct} />
        <StatCard label="Посещаемость" value={`${att.rate}%`} hint={`${att.absent} Н · ${att.sick} Б`} icon="check" tone={att.rate >= 90 ? "green" : "red"} progress={att.rate} />
        <StatCard label="Пар сегодня" value={isToday ? data.lessons.length : 0} hint={isToday ? "по расписанию" : "сегодня выходной"} icon="calendar" />
        <StatCard label="Задания" value={data.hw.length} hint={`выполнено ${data.doneHw} из ${data.totalHw}`} icon="task" tone="brand" progress={hwPct} />
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <Card>
            <CardHeader icon="calendar" title={isToday ? "Расписание на сегодня" : `Расписание на ${formatLong(data.day)}`} subtitle={`${data.lessons.length} ${data.lessons.length === 1 ? "занятие" : "занятий"}`} action={<Link href="/schedule/"><MoreLink>Неделя</MoreLink></Link>} />
            {data.lessons.length === 0 ? (
              <Empty icon="calendar" title="Пар нет" text="Можно отдохнуть или заняться заданиями" />
            ) : (
              <ol className="divide-y divide-line">
                {data.lessons.map((l) => {
                  const g = db.grades[key(student.id, l.subjectId, data.day)];
                  const t = TIME_SLOTS[l.slot - 1];
                  const st = lessonState(l.slot);
                  return (
                    <li key={l.slot} className={cx("relative flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5", st === "now" && "bg-brand-50/60", st === "past" && "text-muted")}>
                      {st === "now" && <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-700" />}
                      <div className="w-14 shrink-0 tabular-nums">
                        <p className={cx("text-sm font-semibold", st === "past" ? "text-muted" : "text-ink")}>{t?.start}</p>
                        <p className="text-xs text-muted">{t?.end}</p>
                      </div>
                      <span className={cx("grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold", st === "now" ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600")}>{l.slot}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cx("truncate font-medium", st === "past" ? "text-muted" : "text-ink")}>{l.subject}</p>
                          {st === "now" && <span className="shrink-0 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">идёт</span>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">{l.teacher}{l.room && ` · каб. ${l.room}`}</p>
                      </div>
                      {g && <GradeChip value={g.value} size="sm" />}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader icon="chart" title="Успеваемость по предметам" subtitle={data.sem.label} action={<Link href="/grades/"><MoreLink>Подробно</MoreLink></Link>} />
            {data.bySubject.length === 0 ? <Empty icon="chart" title="Пока нет данных" /> : (
              <div className="grid gap-6 p-4 sm:p-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-3.5">
                  {data.bySubject.slice(0, 6).map((s) => (
                    <MeterRow key={s.id} label={s.name} value={s.avg} max={5} display={fmtAvg(s.avg)} tone={avgBarTone(s.avg)} />
                  ))}
                </div>
                <div className="flex min-w-0 flex-col gap-5 md:border-l md:border-line md:pl-6">
                  <div>
                    <p className="text-xs font-medium text-muted">Динамика по месяцам</p>
                    <div className="mt-3 flex h-28 items-end gap-2">
                      {data.months.map((m, i) => (
                        <div key={m.k} className="flex flex-1 flex-col items-center gap-1.5">
                          <span className="text-[11px] font-semibold tabular-nums text-ink">{fmtAvg(m.avg)}</span>
                          <div className="relative flex h-16 w-full max-w-8 items-end overflow-hidden rounded bg-slate-100">
                            <div className={cx("bar-y w-full rounded", i === data.months.length - 1 ? "bg-brand-700" : "bg-brand-200")} style={{ height: `${(m.avg / 5) * 100}%`, animationDelay: `${i * 60}ms` }} />
                          </div>
                          <span className="text-[11px] capitalize text-muted">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted">Распределение оценок</p>
                    <div className="mt-2.5 grid grid-cols-4 gap-2">
                      {data.dist.map((d) => (
                        <div key={d.v} className="min-w-0 text-center">
                          <GradeChip value={d.v} size="sm" />
                          <p className="mt-1 text-sm font-semibold tabular-nums text-ink">{d.n}</p>
                          <div className="mx-auto mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100"><div className="bar-x h-full rounded-full bg-brand-600" style={{ width: `${(d.n / distMax) * 100}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5 sm:space-y-6">
          <Card>
            <CardHeader icon="star" title="Последние оценки" action={<Link href="/grades/"><MoreLink>Все</MoreLink></Link>} />
            {data.recent.length === 0 ? (
              <Empty icon="star" title="Оценок пока нет" />
            ) : (
              <ul className="divide-y divide-line">
                {data.recent.slice(0, 6).map((g) => (
                  <li key={g.subjectId + g.date} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <GradeChip value={g.value} size="sm" />
                    <p className="min-w-0 flex-1 truncate text-sm text-ink">{subjectName(db, g.subjectId)}</p>
                    <span className="shrink-0 text-xs tabular-nums text-muted">{formatShort(g.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon="task" title="Ближайшие задания" subtitle={`выполнено ${data.doneHw} из ${data.totalHw}`} action={<Link href="/homework/"><MoreLink>Все</MoreLink></Link>} />
            {data.hw.length === 0 ? (
              <Empty icon="task" title="Все задания сданы" text="Отличная работа!" />
            ) : (
              <ul className="divide-y divide-line">
                {data.hw.slice(0, 4).map((h) => {
                  const st = homeworkStatus(db, h, student.id, now);
                  const meta = HW_STATUS_META[st];
                  const days = Math.round((fromISO(h.due).getTime() - fromISO(now).getTime()) / 86_400_000);
                  const urgent = days <= 1;
                  return (
                    <li key={h.id}>
                      <Link href="/homework/" className="block px-4 py-3 transition-colors hover:bg-subtle sm:px-5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-muted">{subjectName(db, h.subjectId)}</p>
                          <span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold", urgent ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600")}>
                            {days <= 0 ? "сегодня" : days === 1 ? "завтра" : `через ${days} дн.`}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm font-medium text-ink">{h.title}</p>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted"><span className={cx("size-1.5 rounded-full", HW_DOT[meta.tone])} />{meta.label} · до {formatShort(h.due)}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon="check" tone="green" title="Посещаемость" subtitle={`${att.total} занятий в семестре`} action={<Link href="/attendance/"><MoreLink>Все</MoreLink></Link>} />
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <ProgressRing value={att.rate} size={72} stroke={8} color={att.rate >= 90 ? "#10b981" : att.rate >= 75 ? "var(--color-gold-500)" : "#f43f5e"}>
                  <p className="text-base font-bold text-ink">{att.rate}%</p>
                </ProgressRing>
                <p className="text-sm text-muted">Доля занятий, на которых студент присутствовал или опоздал</p>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                {attParts.map((p) => p.n > 0 && <div key={p.label} className={cx("bar-x h-full", p.cls)} style={{ width: `${(p.n / Math.max(1, att.total)) * 100}%` }} />)}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {attParts.map((p) => (
                  <div key={p.label} className="flex items-center gap-2 text-[13px]">
                    <span className={cx("size-2 rounded-full", p.cls)} />
                    <span className="flex-1 text-muted">{p.label}</span>
                    <span className="font-semibold tabular-nums text-ink">{p.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader icon="bell" title="Уведомления" action={<Link href="/notifications/"><MoreLink>Все</MoreLink></Link>} />
            {data.notes.length === 0 ? <Empty icon="bell" title="Уведомлений нет" /> : (
              <ul className="divide-y divide-line">
                {data.notes.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} className={cx("flex gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:px-5", !n.read && "bg-brand-50/40")}>
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600"><Icon name={KIND_ICON[n.kind]} className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink"><span className="truncate">{n.title}</span>{!n.read && <span className="size-1.5 shrink-0 rounded-full bg-brand-600" />}</span>
                        <span className="block truncate text-[13px] text-muted">{n.text}</span>
                        <span className="text-[11px] text-muted/80">{formatTime(n.at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
