// Общие помощники тестов: отдельная база в памяти на каждый набор тестов
import { createContext } from "@/server/context";
import { findUserByLogin } from "@/server/auth";
import { personName } from "@/server/auth";
import type { Ctx } from "@/server/repo";
import type { SessionUser } from "@/lib/types";
import { lessonDates } from "@/lib/queries";
import { addDays, today } from "@/lib/dates";

export function freshContext(): Ctx {
  return createContext(":memory:");
}

export function userByLogin(c: Ctx, login: string): SessionUser {
  const u = findUserByLogin(c.sql, login)!;
  return { id: u.id, role: u.role, login: u.login, name: personName(c.db, u.id), mustChangePassword: u.must_change_password === 1 };
}

/** Прошедшее занятие преподавателя в группе студента */
export function pastLesson(c: Ctx, teacherId: string, groupId: string) {
  const loads = c.db.loads.filter((l) => l.teacherId === teacherId && l.groupId === groupId && c.db.subjects.find((s) => s.id === l.subjectId)?.graded);
  for (const l of loads) {
    const dates = lessonDates(c.db, groupId, l.subjectId, addDays(today(), -21), addDays(today(), -1));
    if (dates.length) return { subjectId: l.subjectId, date: dates[dates.length - 1] };
  }
  throw new Error("Нет прошедших занятий");
}
