// Электронный журнал: оценки, посещаемость, домашние задания
import "server-only";
import { z } from "zod";
import { key } from "@/lib/constants";
import { canEditJournal } from "@/lib/access";
import { lessonDates } from "@/lib/queries";
import { addDays, today } from "@/lib/dates";
import type { AttendanceStatus, GradeValue, ID, SessionUser } from "@/lib/types";
import { audit, repo, type Ctx } from "../repo";
import { Denied, fail, fmtDate, notify, ok, requireRole, subjName, uid, type Result } from "./common";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Неверная дата");
const gradeValue = z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const attStatus = z.enum(["present", "late", "absent", "sick"]);
const reason = z.string().trim().max(300).optional();

/** Проверки, общие для любой записи в журнал */
function checkLesson(c: Ctx, user: SessionUser, studentId: ID, subjectId: ID, date: string) {
  requireRole(user, "teacher");
  const st = c.db.students.find((s) => s.id === studentId);
  if (!st) throw new Denied("Студент не найден");
  if (!canEditJournal(c.db, user, st.groupId, subjectId)) throw new Denied("Нет прав на этот предмет и группу");
  if (date > today()) throw new Denied("Нельзя заполнять журнал на будущую дату");
  if (!lessonDates(c.db, st.groupId, subjectId, date, date).length) throw new Denied("В этот день у группы нет такого занятия");
  return st;
}

function applyGrade(c: Ctx, user: SessionUser, studentId: ID, subjectId: ID, date: string, value: GradeValue | null, why?: string): string | undefined {
  const st = checkLesson(c, user, studentId, subjectId, date);
  const k = key(studentId, subjectId, date);
  const prev = c.db.grades[k];
  const att = c.db.attendance[k]?.status;
  if (value !== null && (att === "absent" || att === "sick")) throw new Denied("Студент отсутствовал на занятии: сначала измените посещаемость");
  if (prev?.value === value || (!prev && value === null)) return;
  // Изменение или удаление уже выставленной оценки требует причины
  if (prev && (!why || why.length < 3)) throw new Denied("Укажите причину изменения оценки");
  const subject = subjName(c, subjectId);
  if (value === null) {
    repo.deleteGrade(c, studentId, subjectId, date);
  } else {
    repo.putGrade(c, { studentId, subjectId, date, value, teacherId: user.id, updatedAt: Date.now() });
  }
  audit(c, {
    actorId: user.id, actorRole: user.role,
    action: !prev ? "grade.create" : value === null ? "grade.delete" : "grade.update",
    entity: "grade", entityId: k,
    before: prev ? JSON.stringify({ value: prev.value }) : null,
    after: value === null ? null : JSON.stringify({ value }),
    reason: prev ? why ?? null : null,
  });
  const text = !prev
    ? `${value} по предмету «${subject}» за ${fmtDate(date)}`
    : value === null
      ? `Оценка ${prev.value} по предмету «${subject}» за ${fmtDate(date)} удалена`
      : `${prev.value} → ${value} по предмету «${subject}» за ${fmtDate(date)}`;
  const kind = prev ? "grade_change" : "grade";
  notify(c, studentId, kind, prev ? "Оценка изменена" : "Новая оценка", text, "/grades/");
  if (st.parentId) notify(c, st.parentId, kind, prev ? "Оценка ребёнка изменена" : "Новая оценка ребёнка", text, "/grades/");
  return undefined;
}

function applyAttendance(c: Ctx, user: SessionUser, studentId: ID, subjectId: ID, date: string, status: AttendanceStatus): string | undefined {
  const st = checkLesson(c, user, studentId, subjectId, date);
  const k = key(studentId, subjectId, date);
  const prev = c.db.attendance[k]?.status ?? "present";
  if (prev === status) return;
  let info: string | undefined;
  if ((status === "absent" || status === "sick") && c.db.grades[k]) {
    // Отсутствующему оценку не ставим: снимаем её с записью в аудит
    const g = c.db.grades[k];
    repo.deleteGrade(c, studentId, subjectId, date);
    audit(c, { actorId: user.id, actorRole: user.role, action: "grade.delete", entity: "grade", entityId: k, before: JSON.stringify({ value: g.value }), after: null, reason: "Студент отмечен как отсутствующий" });
    info = "Оценка за это занятие снята, так как студент отсутствовал";
  }
  repo.putAttendance(c, { studentId, subjectId, date, status });
  audit(c, { actorId: user.id, actorRole: user.role, action: "attendance.set", entity: "attendance", entityId: k, before: JSON.stringify({ status: prev }), after: JSON.stringify({ status }), reason: null });
  if (status === "absent" && st.parentId) notify(c, st.parentId, "attendance", "Пропуск занятия", `«${subjName(c, subjectId)}», ${fmtDate(date)}`, "/attendance/");
  return info;
}

const setGradeSchema = z.object({ studentId: z.string(), subjectId: z.string(), date: isoDate, value: gradeValue.nullable(), reason });
const setAttSchema = z.object({ studentId: z.string(), subjectId: z.string(), date: isoDate, status: attStatus });
const bulkSchema = z.object({
  subjectId: z.string(),
  date: isoDate,
  rows: z.array(z.object({ studentId: z.string(), grade: gradeValue.nullable().optional(), attendance: attStatus.optional(), reason })).min(1).max(60),
});
const hwSchema = z.object({
  groupId: z.string(),
  subjectId: z.string(),
  title: z.string().trim().min(3, "Заголовок слишком короткий").max(120),
  text: z.string().trim().max(2000),
  issued: isoDate.optional(),
  due: isoDate,
  fileUrl: z.string().trim().max(2000).optional(),
});
const hwProgressSchema = z.object({ homeworkId: z.string(), status: z.enum(["new", "in_progress", "done"]) });

export const journalActions = {
  "journal.setGrade": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    const p = setGradeSchema.parse(raw);
    applyGrade(c, u, p.studentId, p.subjectId, p.date, p.value, p.reason);
    return ok(p.value ? `Оценка ${p.value} сохранена` : "Оценка удалена");
  },
  "journal.setAttendance": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    const p = setAttSchema.parse(raw);
    return ok(applyAttendance(c, u, p.studentId, p.subjectId, p.date, p.status) ?? "Посещаемость сохранена");
  },
  /** Массовое сохранение: всё или ничего */
  "journal.bulk": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    const p = bulkSchema.parse(raw);
    let changed = 0;
    // Диспетчер выполняет действие в одной транзакции: ошибка в любой строке откатывает всё
    for (const r of p.rows) {
      if (r.attendance) {
        applyAttendance(c, u, r.studentId, p.subjectId, p.date, r.attendance);
        changed++;
      }
      if (r.grade !== undefined) {
        applyGrade(c, u, r.studentId, p.subjectId, p.date, r.grade, r.reason);
        changed++;
      }
    }
    return ok(`Сохранено изменений: ${changed}`);
  },
  "homework.create": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    requireRole(u, "teacher");
    const p = hwSchema.parse(raw);
    if (!canEditJournal(c.db, u, p.groupId, p.subjectId)) return fail("Нет прав на этот предмет и группу");
    const issued = p.issued ?? today();
    if (p.due < issued) return fail("Срок сдачи раньше даты публикации");
    if (p.due > addDays(issued, 120)) return fail("Срок сдачи слишком далёкий");
    const hw = { id: uid("hw"), groupId: p.groupId, subjectId: p.subjectId, teacherId: u.id, issued, due: p.due, title: p.title, text: p.text, fileUrl: p.fileUrl ?? "" };
    repo.insertHomework(c, hw);
    for (const s of c.db.students.filter((x) => x.groupId === p.groupId)) {
      notify(c, s.id, "homework", "Новое домашнее задание", `«${subjName(c, p.subjectId)}»: ${hw.title}, срок ${fmtDate(hw.due)}`, "/homework/");
      if (s.parentId) notify(c, s.parentId, "homework", "Новое задание ребёнка", `«${subjName(c, p.subjectId)}»: ${hw.title}`, "/homework/");
    }
    return ok("Задание опубликовано");
  },
  "homework.setProgress": (c: Ctx, u: SessionUser, raw: unknown): Result => {
    requireRole(u, "student");
    const p = hwProgressSchema.parse(raw);
    const hw = c.db.homework.find((h) => h.id === p.homeworkId);
    const st = c.db.students.find((s) => s.id === u.id);
    if (!hw || !st || hw.groupId !== st.groupId) return fail("Задание не найдено");
    repo.setHomeworkProgress(c, hw.id, u.id, p.status === "new" ? null : p.status);
    return ok(p.status === "done" ? "Отмечено как выполненное" : p.status === "in_progress" ? "Задание в работе" : "Статус сброшен");
  },
};
