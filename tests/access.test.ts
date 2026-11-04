// Разделение прав: сервер не отдаёт и не даёт менять чужие данные, даже при прямом запросе
import { beforeAll, describe, expect, it } from "vitest";
import { freshContext, pastLesson, userByLogin } from "./helpers";
import { snapshotFor } from "@/server/scope";
import { runAction } from "@/server/actions";
import type { Ctx } from "@/server/repo";

let c: Ctx;
beforeAll(() => {
  c = freshContext();
});

describe("снимок данных по ролям", () => {
  it("студент видит только свои оценки и свою группу", () => {
    const u = userByLogin(c, "student");
    const s = snapshotFor(c, u);
    expect(s.students.map((x) => x.id)).toEqual([u.id]);
    expect(Object.values(s.grades).every((g) => g.studentId === u.id)).toBe(true);
    expect(Object.values(s.attendance).every((a) => a.studentId === u.id)).toBe(true);
    expect(s.groups).toHaveLength(1);
    expect(s.messages.every((m) => m.from === u.id || m.to === u.id)).toBe(true);
    expect(s.notifications.every((n) => n.userId === u.id)).toBe(true);
  });

  it("родитель видит только своего ребёнка", () => {
    const u = userByLogin(c, "parent");
    const s = snapshotFor(c, u);
    const child = c.db.parents.find((p) => p.id === u.id)!.childIds;
    expect(s.students.map((x) => x.id)).toEqual(child);
    expect(Object.values(s.grades).every((g) => child.includes(g.studentId))).toBe(true);
  });

  it("преподаватель видит только свои группы и свои предметы", () => {
    const u = userByLogin(c, "teacher");
    const s = snapshotFor(c, u);
    const myGroups = new Set(c.db.loads.filter((l) => l.teacherId === u.id).map((l) => l.groupId));
    c.db.groups.forEach((g) => g.curatorId === u.id && myGroups.add(g.id));
    expect(s.groups.every((g) => myGroups.has(g.id))).toBe(true);
    expect(s.students.every((st) => myGroups.has(st.groupId))).toBe(true);
    expect(s.groups.length).toBeLessThan(c.db.groups.length);
  });

  it("учебная часть получает агрегаты, но не сырые оценки", () => {
    const s = snapshotFor(c, userByLogin(c, "admin"));
    expect(s.groups).toHaveLength(34);
    expect(Object.keys(s.grades)).toHaveLength(0);
    expect(s.groupStats).toHaveLength(34);
  });

  it("технический администратор не видит учебные и персональные данные", () => {
    const s = snapshotFor(c, userByLogin(c, "tech"));
    expect(s.students).toHaveLength(0);
    expect(Object.keys(s.grades)).toHaveLength(0);
    expect(s.audit.every((e) => e.before === null && e.after === null)).toBe(true);
  });
});

describe("запрет действий", () => {
  it("студент и тех. администратор не могут выставить оценку", () => {
    const t = userByLogin(c, "teacher");
    const st = userByLogin(c, "student");
    const lesson = pastLesson(c, t.id, "2p1");
    for (const login of ["student", "tech", "admin", "parent"]) {
      const r = runAction(c, userByLogin(c, login), "journal.setGrade", { studentId: st.id, ...lesson, value: 5 });
      expect(r.ok, login).toBe(false);
    }
  });

  it("преподаватель не может ставить оценки в чужой группе", () => {
    const t = userByLogin(c, "teacher");
    const foreign = c.db.students.find((s) => !c.db.loads.some((l) => l.teacherId === t.id && l.groupId === s.groupId))!;
    const r = runAction(c, t, "journal.setGrade", { studentId: foreign.id, subjectId: c.db.subjects[0].id, date: "2026-10-01", value: 5 });
    expect(r).toEqual({ ok: false, error: "Нет прав на этот предмет и группу" });
  });

  it("преподаватель не может назначить себе группу", () => {
    const t = userByLogin(c, "teacher");
    const r = runAction(c, t, "load.add", { teacherId: t.id, subjectId: c.db.subjects[0].id, groupId: c.db.groups[0].id });
    expect(r.ok).toBe(false);
  });

  it("студент не может писать другим студентам и отмечать чужие задания", () => {
    const st = userByLogin(c, "student");
    const other = c.db.students.find((s) => s.groupId !== "2p1")!;
    expect(runAction(c, st, "message.send", { to: other.id, text: "привет" }).ok).toBe(false);
    const foreignHw = c.db.homework.find((h) => h.groupId !== "2p1")!;
    expect(runAction(c, st, "homework.setProgress", { homeworkId: foreignHw.id, status: "done" }).ok).toBe(false);
  });

  it("пользователь с временным паролем не может выполнять действия до смены пароля", () => {
    const u = userByLogin(c, "newstudent");
    expect(u.mustChangePassword).toBe(true);
    expect(runAction(c, u, "notifications.markRead", {})).toEqual({ ok: false, error: "Сначала смените временный пароль" });
  });

  it("неизвестное действие и неверные данные отклоняются", () => {
    const t = userByLogin(c, "teacher");
    expect(runAction(c, t, "grades.dropAll", {}).ok).toBe(false);
    expect(runAction(c, t, "journal.setGrade", { studentId: "x", subjectId: "y", date: "вчера", value: 7 }).ok).toBe(false);
  });
});
