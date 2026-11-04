"use client";
// Календарь месяца: занятия, оценки, пропуски и сроки заданий на одной сетке
import { useMemo, useState } from "react";
import { useViewer } from "../useViewer";
import { Badge, Button, Card, CardHeader, Empty, GradeChip, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { MONTHS, addDays, formatWithWeekday, fromISO, startOfWeek, toISO, weekday } from "@/lib/dates";
import { groupLessons, subjectName } from "@/lib/queries";
import { key } from "@/lib/constants";
import { ATT_META } from "@/features/shared/attendance";

export function StudentCalendar() {
  const { db, student } = useViewer();
  const now = db.serverToday;
  const [month, setMonth] = useState(now.slice(0, 7));
  const [selected, setSelected] = useState(now);
  const first = `${month}-01`;
  const days = useMemo(() => {
    const start = startOfWeek(first);
    const d = fromISO(first);
    const last = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const out: string[] = [];
    for (let x = start; x <= last || weekday(x) !== 1; x = addDays(x, 1)) out.push(x);
    return out;
  }, [first]);
  if (!student) return null;

  const info = (d: string) => {
    const lessons = weekday(d) === 7 ? [] : groupLessons(db, student.groupId, d);
    const grades = lessons.map((l) => db.grades[key(student.id, l.subjectId, d)]).filter(Boolean);
    const absent = lessons.some((l) => ["absent", "sick"].includes(db.attendance[key(student.id, l.subjectId, d)]?.status ?? ""));
    const due = db.homework.filter((h) => h.groupId === student.groupId && h.due === d);
    return { lessons, grades, absent, due };
  };
  const shift = (n: number) => {
    const d = fromISO(first);
    setMonth(toISO(new Date(d.getFullYear(), d.getMonth() + n, 1)).slice(0, 7));
  };
  const sel = info(selected);

  return (
    <div>
      <PageHeader
        title="Календарь"
        subtitle="Занятия, оценки, пропуски и сроки домашних заданий"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-9" onClick={() => shift(-1)} aria-label="Предыдущий месяц"><Icon name="chevronLeft" className="size-4" /></Button>
            <span className="min-w-28 text-center font-semibold text-brand-900">{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
            <Button variant="outline" className="h-9" onClick={() => shift(1)} aria-label="Следующий месяц"><Icon name="chevronRight" className="size-4" /></Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = d.startsWith(month);
              const x = info(d);
              return (
                <button key={d} onClick={() => setSelected(d)} aria-pressed={selected === d}
                  className={cx("flex aspect-square flex-col items-center justify-start gap-1 rounded-xl p-1 text-sm transition sm:aspect-[1.1]", !inMonth && "opacity-35",
                    selected === d ? "bg-brand-900 text-white" : d === now ? "bg-gold-50 ring-1 ring-gold-500" : "hover:bg-brand-50")}>
                  <span className="font-semibold tabular-nums">{Number(d.slice(8))}</span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {x.grades.length > 0 && <span className={cx("size-1.5 rounded-full", selected === d ? "bg-gold-400" : "bg-brand-600")} />}
                    {x.absent && <span className="size-1.5 rounded-full bg-rose-500" />}
                    {x.due.length > 0 && <span className="size-1.5 rounded-full bg-gold-500" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 px-1 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-600" />оценки</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" />пропуск</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-gold-500" />срок задания</span>
          </div>
        </Card>
        <Card>
          <CardHeader icon="calendar" title={formatWithWeekday(selected)} />
          {sel.lessons.length === 0 && sel.due.length === 0 ? <Empty icon="calendar" title="Занятий нет" /> : (
            <div className="divide-y divide-line">
              {sel.due.map((h) => (
                <div key={h.id} className="flex items-center gap-3 bg-gold-50/60 px-5 py-3 text-sm">
                  <Icon name="task" className="size-4 text-gold-600" />
                  <span className="min-w-0 flex-1 truncate"><b>Срок сдачи:</b> {h.title} · {subjectName(db, h.subjectId)}</span>
                </div>
              ))}
              {sel.lessons.map((l) => {
                const g = db.grades[key(student.id, l.subjectId, selected)];
                const a = db.attendance[key(student.id, l.subjectId, selected)];
                return (
                  <div key={l.slot} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-14 shrink-0 text-xs text-muted">{l.slot} пара<br />{l.time.split("-")[0]}</span>
                    <span className="min-w-0 flex-1 text-sm">{l.subject}</span>
                    {a && <Badge tone={a.status === "late" ? "gold" : "red"}>{ATT_META[a.status].short}</Badge>}
                    {g && <GradeChip value={g.value} size="sm" />}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
