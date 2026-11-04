// Сквозные сценарии журнала: преподаватель -> база -> дневник студента и родителя
import { beforeEach, describe, expect, it } from "vitest";
import { freshContext, pastLesson, userByLogin } from "./helpers";
import { snapshotFor } from "@/server/scope";
import { runAction } from "@/server/actions";
import { readAudit, type Ctx } from "@/server/repo";
import { key } from "@/lib/constants";
import { addDays, today } from "@/lib/dates";
import { studentAverage } from "@/lib/stats";

let c: Ctx;
let teacher: ReturnType<typeof userByLogin>;
let student: ReturnType<typeof userByLogin>;
let lesson: { subjectId: string; date: string };

beforeEach(() => {
  c = freshContext();
  teacher = userByLogin(c, "teacher");
  student = userByLogin(c, "student");
  lesson = pastLesson(c, teacher.id, "2p1");
  runAction(c, teacher, "journal.setAttendance", { studentId: student.id, ...lesson, status: "present" });
  const k = key(student.id, lesson.subjectId, lesson.date);
  if (c.db.grades[k]) runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: null, reason: "подготовка теста" });
});

describe("оценки", () => {
  it("оценка преподавателя появляется в дневнике студента и у родителя, с уведомлением", () => {
    const r = runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 5 });
    expect(r.ok).toBe(true);
    const k = key(student.id, lesson.subjectId, lesson.date);
    expect(snapshotFor(c, student).grades[k]?.value).toBe(5);
    expect(snapshotFor(c, userByLogin(c, "parent")).grades[k]?.value).toBe(5);
    expect(snapshotFor(c, student).notifications.some((n) => n.kind === "grade" && n.text.startsWith("5"))).toBe(true);
    // Оценка сохранена в SQLite, а не только в памяти
    const row = c.sql.prepare("SELECT value FROM grades WHERE student_id = ? AND subject_id = ? AND date = ?").get(student.id, lesson.subjectId, lesson.date) as { value: number };
    expect(row.value).toBe(5);
  });

  it("изменение оценки требует причины и пишется в аудит с прежним значением", () => {
    runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 3 });
    expect(runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 5 })).toEqual({ ok: false, error: "Укажите причину изменения оценки" });
    expect(runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 5, reason: "пересдача" }).ok).toBe(true);
    const k = key(student.id, lesson.subjectId, lesson.date);
    const last = readAudit(c, { entityIds: [k] })[0];
    expect(last.action).toBe("grade.update");
    expect(JSON.parse(last.before!)).toEqual({ value: 3 });
    expect(JSON.parse(last.after!)).toEqual({ value: 5 });
    expect(last.reason).toBe("пересдача");
    expect(last.actorId).toBe(teacher.id);
  });

  it("журнал аудита нельзя изменить или удалить даже прямым SQL", () => {
    runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 4 });
    expect(() => c.sql.exec("UPDATE audit_log SET reason = 'подделка'")).toThrow(/append-only/);
    expect(() => c.sql.exec("DELETE FROM audit_log")).toThrow(/append-only/);
  });

  it("средний балл пересчитывается после новой оценки", () => {
    const before = studentAverage(c.db, student.id, { subjectId: lesson.subjectId });
    runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 2 });
    const after = studentAverage(c.db, student.id, { subjectId: lesson.subjectId });
    expect(after).not.toBe(before);
    expect(after!).toBeLessThan(before ?? 5);
  });

  it("нельзя ставить оценки на будущее и в день без занятия", () => {
    expect(runAction(c, teacher, "journal.setGrade", { studentId: student.id, subjectId: lesson.subjectId, date: addDays(today(), 14), value: 5 }).ok).toBe(false);
    const sunday = (() => { let d = addDays(today(), -1); while (new Date(d).getDay() !== 0) d = addDays(d, -1); return d; })();
    expect(runAction(c, teacher, "journal.setGrade", { studentId: student.id, subjectId: lesson.subjectId, date: sunday, value: 5 }).ok).toBe(false);
  });
});

describe("посещаемость", () => {
  it("отсутствие снимает оценку и блокирует новую; родитель получает уведомление", () => {
    runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 4 });
    const r = runAction(c, teacher, "journal.setAttendance", { studentId: student.id, ...lesson, status: "absent" });
    expect(r.ok && r.info).toMatch(/снята/);
    const k = key(student.id, lesson.subjectId, lesson.date);
    expect(c.db.grades[k]).toBeUndefined();
    expect(c.db.attendance[k]?.status).toBe("absent");
    expect(runAction(c, teacher, "journal.setGrade", { studentId: student.id, ...lesson, value: 5 }).ok).toBe(false);
    const parent = userByLogin(c, "parent");
    expect(snapshotFor(c, parent).notifications.some((n) => n.kind === "attendance")).toBe(true);
  });

  it("массовое сохранение: всё или ничего", () => {
    const sts = c.db.students.filter((s) => s.groupId === "2p1");
    sts.forEach((s) => runAction(c, teacher, "journal.setAttendance", { studentId: s.id, ...lesson, status: "present" }));
    const gradesBefore = sts.map((s) => c.db.grades[key(s.id, lesson.subjectId, lesson.date)]?.value ?? null);
    // Вторая строка с ошибкой (чужой студент): ни одна оценка не должна сохраниться
    const foreign = c.db.students.find((s) => s.groupId !== "2p1" && !c.db.loads.some((l) => l.teacherId === teacher.id && l.groupId === s.groupId))!;
    const bad = runAction(c, teacher, "journal.bulk", { ...lesson, rows: [{ studentId: sts[0].id, attendance: "late" }, { studentId: foreign.id, grade: 5 }] });
    expect(bad.ok).toBe(false);
    expect(c.db.attendance[key(sts[0].id, lesson.subjectId, lesson.date)]).toBeUndefined();
    expect(sts.map((s) => c.db.grades[key(s.id, lesson.subjectId, lesson.date)]?.value ?? null)).toEqual(gradesBefore);

    const ok = runAction(c, teacher, "journal.bulk", { ...lesson, rows: [{ studentId: sts[0].id, attendance: "late" }, { studentId: sts[2].id, attendance: "sick" }] });
    expect(ok.ok).toBe(true);
    expect(c.db.attendance[key(sts[2].id, lesson.subjectId, lesson.date)]?.status).toBe("sick");
  });
});

describe("задания, сообщения, расписание", () => {
  it("новое задание видят студенты группы, студент меняет статус", () => {
    const r = runAction(c, teacher, "homework.create", { groupId: "2p1", subjectId: lesson.subjectId, title: "Тестовое задание", text: "Описание", due: addDays(today(), 5) });
    expect(r.ok).toBe(true);
    const hw = snapshotFor(c, student).homework.find((h) => h.title === "Тестовое задание")!;
    expect(hw).toBeTruthy();
    expect(snapshotFor(c, student).notifications.some((n) => n.kind === "homework")).toBe(true);
    expect(runAction(c, student, "homework.setProgress", { homeworkId: hw.id, status: "done" }).ok).toBe(true);
    expect(snapshotFor(c, teacher).homeworkProgress[`${hw.id}|${student.id}`]).toBe("done");
  });

  it("студент пишет преподавателю, преподаватель отвечает, чужие не видят", () => {
    expect(runAction(c, student, "message.send", { to: teacher.id, text: "Вопрос" }).ok).toBe(true);
    expect(runAction(c, teacher, "message.send", { to: student.id, text: "Ответ" }).ok).toBe(true);
    const parent = userByLogin(c, "parent");
    expect(snapshotFor(c, parent).messages.some((m) => m.text === "Вопрос")).toBe(false);
    expect(snapshotFor(c, student).messages.filter((m) => ["Вопрос", "Ответ"].includes(m.text))).toHaveLength(2);
  });

  it("учебная часть меняет расписание: конфликт преподавателя отклоняется, студенты получают уведомление", () => {
    const admin = userByLogin(c, "admin");
    const busy = c.db.schedule.find((s) => s.teacherId === teacher.id && s.groupId !== "2p1" && !c.db.groups.find((g) => g.id === s.groupId)?.isDemo)!;
    const conflict = runAction(c, admin, "schedule.setSlot", { groupId: "1p1", weekday: busy.weekday, slot: busy.slot, subjectId: busy.subjectId, teacherId: teacher.id, room: "" });
    expect(conflict.ok).toBe(false);
    const free = [1, 2, 3, 4, 5, 6].find((n) => !c.db.schedule.some((s) => s.groupId === "2p1" && s.weekday === 6 && s.slot === n) && !c.db.schedule.some((s) => s.teacherId === teacher.id && s.weekday === 6 && s.slot === n))!;
    const r = runAction(c, admin, "schedule.setSlot", { groupId: "2p1", weekday: 6, slot: free, subjectId: lesson.subjectId, teacherId: teacher.id, room: "999" });
    expect(r.ok).toBe(true);
    expect(snapshotFor(c, student).notifications.some((n) => n.kind === "schedule")).toBe(true);
    expect(snapshotFor(c, student).schedule.some((s) => s.weekday === 6 && s.slot === free)).toBe(true);
  });
});

describe("администрирование", () => {
  it("учебная часть создаёт аккаунт с временным паролем", () => {
    const admin = userByLogin(c, "admin");
    const person = c.db.students.find((s) => s.groupId === "1p1")!;
    const r = runAction(c, admin, "account.create", { personId: person.id, login: "test.user" });
    expect(r.ok).toBe(true);
    const data = (r as { data: { tempPassword: string } }).data;
    expect(data.tempPassword).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/);
    expect(userByLogin(c, "test.user").mustChangePassword).toBe(true);
    expect(runAction(c, admin, "account.create", { personId: person.id, login: "test.user2" }).ok).toBe(false);
  });

  it("импорт CSV: ошибка в строке отменяет весь импорт, корректный файл импортируется", () => {
    const admin = userByLogin(c, "admin");
    const before = c.db.students.length;
    expect(runAction(c, admin, "import.studentsCsv", { csv: "ФИО;Группа\nИванов Иван;2П1\nПетров Пётр;9Я9" }).ok).toBe(false);
    expect(c.db.students.length).toBe(before);
    expect(runAction(c, admin, "import.studentsCsv", { csv: "Иванов Иван Иванович;2П1;Иванова Мария\nПетров Пётр;1Б1" }).ok).toBe(true);
    expect(c.db.students.length).toBe(before + 2);
  });

  it("новая группа добавляется без изменения кода", () => {
    const admin = userByLogin(c, "admin");
    const r = runAction(c, admin, "group.create", { course: 4, specialty: "П" });
    expect(r.ok).toBe(true);
    expect(c.db.groups).toHaveLength(35);
  });
});
