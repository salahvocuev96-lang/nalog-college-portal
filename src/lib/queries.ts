// Выборки для экранов. Чистые функции над DB: легко покрыть тестами и перенести на сервер.
import type { DB } from "./db-types";
import type { Homework, HomeworkStatus, ID, ISODate, ScheduleSlot } from "./types";
import { addDays, BELLS, weekday } from "./dates";

export interface LessonView extends ScheduleSlot {
  subject: string;
  teacher: string;
  group: string;
  time: string;
}

function view(db: DB, s: ScheduleSlot): LessonView {
  return {
    ...s,
    subject: db.subjects.find((x) => x.id === s.subjectId)?.name ?? "",
    teacher: db.teachers.find((x) => x.id === s.teacherId)?.name ?? "",
    group: db.groups.find((x) => x.id === s.groupId)?.code ?? "",
    time: BELLS[s.slot - 1] ?? "",
  };
}

export function groupLessons(db: DB, groupId: ID, date: ISODate): LessonView[] {
  const wd = weekday(date);
  return db.schedule.filter((s) => s.groupId === groupId && s.weekday === wd).sort((a, b) => a.slot - b.slot).map((s) => view(db, s));
}

export function teacherLessons(db: DB, teacherId: ID, date: ISODate): LessonView[] {
  const wd = weekday(date);
  return db.schedule.filter((s) => s.teacherId === teacherId && s.weekday === wd).sort((a, b) => a.slot - b.slot).map((s) => view(db, s));
}

/** Ближайший учебный день начиная с даты (воскресенье пропускаем) */
export function nextSchoolDay(date: ISODate): ISODate {
  return weekday(date) === 7 ? addDays(date, 1) : date;
}

/** Даты занятий группы по предмету (для журнала) */
export function lessonDates(db: DB, groupId: ID, subjectId: ID, from: ISODate, to: ISODate): ISODate[] {
  const days = new Set(db.schedule.filter((s) => s.groupId === groupId && s.subjectId === subjectId).map((s) => s.weekday));
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (days.has(weekday(d))) out.push(d);
  return out;
}

export const subjectName = (db: DB, id: ID) => db.subjects.find((s) => s.id === id)?.name ?? "";
export const groupCode = (db: DB, id: ID) => db.groups.find((g) => g.id === id)?.code ?? "";

/** Статус задания у студента: «новое», «выполняется», «выполнено», «просрочено» */
export function homeworkStatus(db: DB, hw: Homework, studentId: ID, todayIso: ISODate): HomeworkStatus {
  const p = db.homeworkProgress[`${hw.id}|${studentId}`];
  if (p === "done") return "done";
  if (hw.due < todayIso) return "overdue";
  return p ?? "new";
}

export const HW_STATUS_META: Record<HomeworkStatus, { label: string; tone: "brand" | "gold" | "green" | "red" }> = {
  new: { label: "Новое", tone: "brand" },
  in_progress: { label: "Выполняется", tone: "gold" },
  done: { label: "Выполнено", tone: "green" },
  overdue: { label: "Просрочено", tone: "red" },
};
