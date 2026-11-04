"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useViewer } from "../useViewer";
import { Card, HeroCard, CardHeader, Empty, GradeChip, StatCard, ProgressRing, MeterRow, MoreLink, cx } from "@/components/ui";
import { attendanceSummary, gradesOf, studentAverage, subjectAverages, fmtAvg, average } from "@/lib/stats";
import { formatLong, formatShort, formatTime, formatWithWeekday, semesterPeriod, fromISO, MONTHS, TIME_SLOTS, toMinutes } from "@/lib/dates";
import { groupLessons, homeworkStatus, nextSchoolDay, subjectName, HW_STATUS_META } from "@/lib/queries";
import { KIND_ICON } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { SPECIALTIES } from "@/lib/constants";
import { key } from "@/lib/constants";

const avgBar = (v: number) => (v >= 4.5 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : v >= 3.5 ? "bg-gradient-to-r from-brand-500 to-brand-700" : v >= 2.5 ? "bg-gradient-to-r from-gold-400 to-gold-600" : "bg-gradient-to-r from-rose-400 to-rose-600");
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
    <div className="space-y-5 stagger sm:space-y-6">
      <HeroCard>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15 backdrop-blur">
              <span className="pulse-dot size-1.5 rounded-full bg-gold-400" />
              {formatWithWeekday(now)}
            </p>
            <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {isParent ? <>Успеваемость: <span className="text-gold-400">{student.name.split(" ").slice(0, 2).join(" ")}</span></> : <>Здравствуйте, <span className="text-gold-400">{firstName}</span>!</>}
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/65">
              {isToday && data.lessons.length ? `Сегодня ${data.lessons.length} ${data.lessons.length === 1 ? "пара" : data.lessons.length < 5 ? "пары" : "пар"}` : "Сегодня занятий нет"}
              {data.hw.length > 0 && ` · ${data.hw.length} ${data.hw.length === 1 ? "задание ждёт" : "заданий ждут"} выполнения`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] sm:text-[13px]">
              <span className="rounded-full bg-gradient-to-b from-gold-400 to-gold-500 px-3 py-1 font-bold text-brand-950 shadow-[0_4px_12px_-4px_rgb(229_169_26/0.8)]">Группа {group.code}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/10">{group.course} курс</span>
              <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/10">{data.sem.label}</span>
              <span className="max-w-full truncate rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/10">{SPECIALTIES[group.specialty] ?? group.specialty}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-around gap-4 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur sm:gap-5 sm:p-4">
            <ProgressRing value={avgPct} size={88}>
              <div><p className="text-xl font-extrabold leading-none">{fmtAvg(data.avg)}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/60">балл</p></div>
            </ProgressRing>
            <ProgressRing value={att.rate} size={88} color="#34d399">
              <div><p className="text-xl font-extrabold leading-none">{att.rate}%</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/60">явка</p></div>
            </ProgressRing>
          </div>
        </div>
      </HeroCard>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Средний балл" value={fmtAvg(data.avg)} hint={data.sem.label} icon="star" tone="gold" progress={avgPct} />
        <StatCard label="Посещаемость" value={`${att.rate}%`} hint={`${att.absent} Н · ${att.sick} Б`} icon="check" tone={att.rate >= 90 ? "green" : "red"} progress={att.rate} />
        <StatCard label="Пар сегодня" value={isToday ? data.lessons.length : 0} hint={isToday ? "по расписанию" : "сегодня выходной"} icon="calendar" />
        <StatCard label="Задания" value={data.hw.length} hint={`выполнено ${data.doneHw} из ${data.totalHw}`} icon="task" tone="brand" progress={hwPct} />
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader icon="calendar" tone="brand" title={isToday ? "Расписание на сегодня" : `Расписание на ${formatLong(data.day)}`} subtitle={`${data.lessons.length} ${data.lessons.length === 1 ? "занятие" : "занятий"}`} action={<Link href="/schedule/"><MoreLink>Неделя</MoreLink></Link>} />
          {data.lessons.length === 0 ? (
            <Empty icon="calendar" title="Пар нет" text="Можно отдохнуть или заняться заданиями" />
          ) : (
            <ol className="relative px-4 py-3 sm:px-5">
              <span className="absolute bottom-6 left-[35px] top-6 w-px bg-gradient-to-b from-brand-200 via-line to-transparent sm:left-[39px]" />
              {data.lessons.map((l) => {
                const g = db.grades[key(student.id, l.subjectId, data.day)];
                const t = TIME_SLOTS[l.slot - 1];
                const st = lessonState(l.slot);
                return (
                  <li key={l.slot} className={cx("relative flex items-center gap-3 rounded-xl py-2.5 pr-2 transition-colors sm:gap-4", st === "now" && "bg-gradient-to-r from-gold-50 to-transparent", st === "past" && "opacity-60")}>
                    <span className={cx("relative z-10 grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold ring-4 ring-white sm:size-12",
                      st === "now" ? "bg-gradient-to-br from-gold-400 to-gold-600 text-brand-950 shadow-[0_6px_16px_-6px_rgb(229_169_26/0.9)]" : "bg-gradient-to-br from-brand-700 to-brand-900 text-white")}>
                      {l.slot}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-brand-900">{l.subject}</p>
                        {st === "now" && <span className="shrink-0 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-950">идёт</span>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{l.teacher}{l.room && ` · каб. ${l.room}`}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {g ? <GradeChip value={g.value} size="sm" /> : t && (
                        <p className="text-[12px] font-semibold tabular-nums leading-tight text-brand-800">{t.start}<span className="block font-normal text-muted">{t.end}</span></p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader icon="star" title="Последние оценки" subtitle="новые сверху" action={<Link href="/grades/"><MoreLink>Все</MoreLink></Link>} />
          {data.recent.length === 0 ? (
            <Empty icon="star" title="Оценок пока нет" />
          ) : (
            <ul className="divide-y divide-line/70">
              {data.recent.map((g) => (
                <li key={g.subjectId + g.date} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-50/50 sm:px-5">
                  <GradeChip value={g.value} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{subjectName(db, g.subjectId)}</p>
                    <p className="text-[11px] text-muted">{formatShort(g.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon="chart" tone="brand" title="Успеваемость по предметам" subtitle={data.sem.label} action={<Link href="/grades/"><MoreLink>Подробно</MoreLink></Link>} />
          {data.bySubject.length === 0 ? <Empty icon="chart" title="Пока нет данных" /> : (
            <div className="grid gap-6 p-4 sm:p-5 md:grid-cols-[1.3fr_1fr]">
              <div className="min-w-0 space-y-3.5">
                {data.bySubject.slice(0, 6).map((s) => (
                  <MeterRow key={s.id} label={s.name} value={s.avg} max={5} display={fmtAvg(s.avg)} tone={avgBar(s.avg)} />
                ))}
              </div>
              <div className="flex min-w-0 flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Динамика по месяцам</p>
                  <div className="mt-3 flex h-32 items-end gap-2">
                    {data.months.map((m, i) => (
                      <div key={m.k} className="flex flex-1 flex-col items-center gap-1.5">
                        <span className="text-[11px] font-bold tabular-nums text-brand-900">{fmtAvg(m.avg)}</span>
                        <div className="relative flex h-20 w-full max-w-9 items-end overflow-hidden rounded-lg bg-brand-50">
                          <div className={cx("bar-y w-full rounded-lg", i === data.months.length - 1 ? "bg-gradient-to-t from-gold-500 to-gold-400" : "bg-gradient-to-t from-brand-800 to-brand-500")} style={{ height: `${(m.avg / 5) * 100}%`, animationDelay: `${i * 70}ms` }} />
                        </div>
                        <span className="text-[11px] capitalize text-muted">{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Распределение оценок</p>
                  <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:gap-2">
                    {data.dist.map((d) => (
                      <div key={d.v} className="min-w-0 rounded-xl border border-line/80 bg-page/60 p-2 text-center">
                        <GradeChip value={d.v} size="sm" />
                        <p className="mt-1 text-sm font-bold tabular-nums text-brand-900">{d.n}</p>
                        <div className="mx-auto mt-1 h-1 w-full overflow-hidden rounded-full bg-brand-50"><div className="bar-x h-full rounded-full bg-brand-600" style={{ width: `${(d.n / distMax) * 100}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader icon="check" tone="green" title="Посещаемость" subtitle={`${att.total} занятий в семестре`} action={<Link href="/attendance/"><MoreLink>Все</MoreLink></Link>} />
          <div className="flex flex-col items-center gap-5 p-5">
            <ProgressRing value={att.rate} size={128} stroke={12} color={att.rate >= 90 ? "#10b981" : att.rate >= 75 ? "var(--color-gold-500)" : "#f43f5e"} track="var(--color-brand-50)">
              <div><p className="text-3xl font-extrabold leading-none text-brand-900">{att.rate}%</p><p className="mt-1 text-[11px] text-muted">присутствие</p></div>
            </ProgressRing>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-brand-50">
              {attParts.map((p) => p.n > 0 && <div key={p.label} className={cx("bar-x h-full", p.cls)} style={{ width: `${(p.n / Math.max(1, att.total)) * 100}%` }} />)}
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              {attParts.map((p) => (
                <div key={p.label} className="flex items-center gap-2 rounded-xl bg-page/70 px-3 py-2">
                  <span className={cx("size-2.5 rounded-full", p.cls)} />
                  <span className="flex-1 text-[13px] text-muted">{p.label}</span>
                  <span className="text-sm font-bold tabular-nums text-brand-900">{p.n}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader icon="task" title="Ближайшие задания" subtitle={`выполнено ${data.doneHw} из ${data.totalHw}`} action={<Link href="/homework/"><MoreLink>Все</MoreLink></Link>} />
          {data.hw.length === 0 ? (
            <Empty icon="task" title="Все задания сданы" text="Отличная работа!" />
          ) : (
            <ul className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
              {data.hw.slice(0, 4).map((h) => {
                const st = homeworkStatus(db, h, student.id, now);
                const meta = HW_STATUS_META[st];
                const days = Math.round((fromISO(h.due).getTime() - fromISO(now).getTime()) / 86_400_000);
                const urgent = days <= 1;
                return (
                  <li key={h.id}>
                    <Link href="/homework/" className="lift group relative block min-w-0 overflow-hidden rounded-2xl border border-line/80 bg-white p-4 pl-5 shadow-sm">
                      <span className={cx("absolute inset-y-0 left-0 w-1.5", urgent ? "bg-gradient-to-b from-rose-400 to-rose-600" : "bg-gradient-to-b from-gold-400 to-gold-600")} />
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-bold uppercase tracking-wide text-brand-700">{subjectName(db, h.subjectId)}</p>
                        <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1", urgent ? "bg-rose-50 text-rose-600 ring-rose-200" : "bg-gold-50 text-gold-700 ring-gold-200")}>
                          {days <= 0 ? "сегодня" : days === 1 ? "завтра" : `через ${days} дн.`}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{h.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{h.text}</p>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-muted"><span className={cx("size-2 rounded-full", HW_DOT[meta.tone])} />{meta.label}</span>
                        <span className="text-muted">до {formatShort(h.due)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader icon="bell" tone="brand" title="Уведомления" action={<Link href="/notifications/"><MoreLink>Все</MoreLink></Link>} />
          {data.notes.length === 0 ? <Empty icon="bell" title="Уведомлений нет" /> : (
            <ul className="space-y-1 p-2">
              {data.notes.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} className={cx("flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-50/60", !n.read && "bg-gold-50/50")}>
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-100"><Icon name={KIND_ICON[n.kind]} className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-900"><span className="truncate">{n.title}</span>{!n.read && <span className="size-2 shrink-0 rounded-full bg-gold-500" />}</span>
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
  );
}
