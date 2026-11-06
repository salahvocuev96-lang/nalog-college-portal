// Слой хранения. Данные держатся в памяти (быстрые выборки), записи идут в Turso.
// Запись внутри runAction буферизуется в _pending и фиксируется одним batch после действия.
import "server-only";
import type { Client, InValue } from "./turso";
import { batchExec, type Statement } from "./turso";
import type { DB } from "@/lib/db-types";
import { DEFAULT_SETTINGS } from "@/lib/db-types";
import { key } from "@/lib/constants";
import type {
  Attendance, AuditEntry, Grade, Group, Homework, HomeworkProgress, ID, Load, Message, Notification,
  Role, ScheduleSlot, Settings, Student, Subject, Teacher,
} from "@/lib/types";

export interface Ctx {
  client: Client;
  db: DB;
  _pending?: Statement[]; // буфер записей внутри runAction
}

type Row = Record<string, unknown>;

const S = (v: unknown) => (v == null ? "" : String(v));
const N = (v: unknown) => (v == null ? 0 : typeof v === "bigint" ? Number(v) : Number(v));

/** Поставить SQL в буфер (внутри runAction) или выполнить сразу */
function write(c: Ctx, sql: string, args: InValue[] = []) {
  if (c._pending) {
    c._pending.push({ sql, args });
  } else {
    void c.client.execute({ sql, args });
  }
}

// ---------- Загрузка из Turso ----------

export async function loadDB(client: Client): Promise<DB> {
  const [
    pcRes, groupRes, studRes, parRes, tchRes, stfRes, subjRes, schRes, loadRes,
    hwRes, msgRes, notifRes, settRes, gradeRes, attRes, hwpRes, photoRes, scRes, auditRes,
  ] = await client.batch(
    [
      { sql: "SELECT parent_id, student_id FROM parent_children" },
      { sql: "SELECT * FROM groups ORDER BY course, code" },
      { sql: "SELECT * FROM students ORDER BY name" },
      { sql: "SELECT * FROM parents" },
      { sql: "SELECT * FROM teachers ORDER BY name" },
      { sql: "SELECT * FROM staff" },
      { sql: "SELECT * FROM subjects ORDER BY name" },
      { sql: "SELECT * FROM schedule_slots" },
      { sql: "SELECT * FROM teaching_loads" },
      { sql: "SELECT * FROM homework" },
      { sql: "SELECT * FROM messages ORDER BY at" },
      { sql: "SELECT * FROM notifications ORDER BY at" },
      { sql: "SELECT key, value FROM settings" },
      { sql: "SELECT * FROM grades" },
      { sql: "SELECT * FROM attendance" },
      { sql: "SELECT * FROM homework_progress" },
      { sql: "SELECT id, photo FROM users WHERE photo IS NOT NULL" },
      { sql: "SELECT * FROM schedule_changes ORDER BY date, slot" },
      { sql: "SELECT * FROM audit_log ORDER BY id DESC LIMIT 1000" },
    ],
    "read",
  );

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const r of pcRes.rows as unknown as Row[]) {
    parentOf.set(S(r.student_id), S(r.parent_id));
    childrenOf.set(S(r.parent_id), [...(childrenOf.get(S(r.parent_id)) ?? []), S(r.student_id)]);
  }

  const settings: Settings = structuredClone(DEFAULT_SETTINGS);
  for (const r of settRes.rows as unknown as Row[]) {
    try { (settings as unknown as Record<string, unknown>)[S(r.key)] = JSON.parse(S(r.value)); } catch { /* ignore */ }
  }

  const grades: Record<string, Grade> = {};
  for (const r of gradeRes.rows as unknown as Row[]) {
    const g: Grade = { studentId: S(r.student_id), subjectId: S(r.subject_id), date: S(r.date), value: N(r.value) as Grade["value"], teacherId: S(r.teacher_id), updatedAt: N(r.updated_at) };
    grades[key(g.studentId, g.subjectId, g.date)] = g;
  }

  const attendance: Record<string, Attendance> = {};
  for (const r of attRes.rows as unknown as Row[]) {
    const a: Attendance = { studentId: S(r.student_id), subjectId: S(r.subject_id), date: S(r.date), status: S(r.status) as Attendance["status"] };
    attendance[key(a.studentId, a.subjectId, a.date)] = a;
  }

  const homeworkProgress: Record<string, HomeworkProgress> = {};
  for (const r of hwpRes.rows as unknown as Row[]) {
    homeworkProgress[`${S(r.homework_id)}|${S(r.student_id)}`] = S(r.status) as HomeworkProgress;
  }

  const userPhotos: Record<string, string> = {};
  for (const r of photoRes.rows as unknown as Row[]) userPhotos[S(r.id)] = S(r.photo);

  return {
    auditLog: (auditRes.rows as unknown as Row[]).map((r) => ({
      id: N(r.id), at: N(r.at), actorId: S(r.actor_id), actorRole: S(r.actor_role) as Role,
      action: S(r.action), entity: S(r.entity), entityId: S(r.entity_id),
      before: (r.before as string) ?? null, after: (r.after as string) ?? null, reason: (r.reason as string) ?? null,
    })),
    groups: (groupRes.rows as unknown as Row[]).map((r) => ({
      id: S(r.id), code: S(r.code), course: N(r.course) as Group["course"], specialty: S(r.specialty),
      ...(r.curator_id ? { curatorId: S(r.curator_id) } : {}), ...(N(r.is_demo) ? { isDemo: true } : {}),
    })),
    students: (studRes.rows as unknown as Row[]).map((r) => ({
      id: S(r.id), name: S(r.name), groupId: S(r.group_id), parentId: parentOf.get(S(r.id)) ?? "", email: S(r.email), phone: S(r.phone),
    })),
    parents: (parRes.rows as unknown as Row[]).map((r) => ({ id: S(r.id), name: S(r.name), phone: S(r.phone), childIds: childrenOf.get(S(r.id)) ?? [] })),
    teachers: (tchRes.rows as unknown as Row[]).map((r) => ({ id: S(r.id), name: S(r.name), email: S(r.email) })),
    staff: (stfRes.rows as unknown as Row[]).map((r) => ({ id: S(r.id), name: S(r.name), role: S(r.role) as "college_admin" | "tech_admin" })),
    subjects: (subjRes.rows as unknown as Row[]).map((r) => ({ id: S(r.id), name: S(r.name), graded: N(r.graded) === 1 })),
    schedule: (schRes.rows as unknown as Row[]).map((r) => ({
      id: N(r.id), groupId: S(r.group_id), weekday: N(r.weekday), slot: N(r.slot), subjectId: S(r.subject_id), teacherId: S(r.teacher_id), room: S(r.room),
    })),
    loads: (loadRes.rows as unknown as Row[]).map((r) => ({ teacherId: S(r.teacher_id), subjectId: S(r.subject_id), groupId: S(r.group_id) })),
    grades, attendance, homework: (hwRes.rows as unknown as Row[]).map((r) => ({
      id: S(r.id), groupId: S(r.group_id), subjectId: S(r.subject_id), teacherId: S(r.teacher_id),
      issued: S(r.issued), due: S(r.due), title: S(r.title), text: S(r.description), fileUrl: S(r.file_url ?? ""),
    })),
    homeworkProgress,
    messages: (msgRes.rows as unknown as Row[]).map((r) => ({ id: S(r.id), from: S(r.from_id), to: S(r.to_id), text: S(r.text), at: N(r.at), read: N(r.read) === 1 })),
    notifications: (notifRes.rows as unknown as Row[]).map((r) => ({
      id: S(r.id), userId: S(r.user_id), kind: S(r.kind) as Notification["kind"], title: S(r.title), text: S(r.text), at: N(r.at), read: N(r.read) === 1, href: S(r.href),
    })),
    settings, userPhotos,
    scheduleChanges: (scRes.rows as unknown as Row[]).map((r) => ({
      id: N(r.id), date: S(r.date), groupId: S(r.group_id), slot: N(r.slot),
      kind: S(r.kind) as "cancel" | "substitute",
      newTeacherId: r.new_teacher_id ? S(r.new_teacher_id) : undefined,
      newRoom: r.new_room != null ? S(r.new_room) : undefined,
      note: r.note ? S(r.note) : undefined,
      createdAt: N(r.created_at),
    })),
  };
}

// ---------- Первичное заполнение ----------

export async function isEmpty(client: Client): Promise<boolean> {
  const r = await client.execute("SELECT COUNT(*) AS n FROM groups");
  return N((r.rows[0] as unknown as Row)?.n) === 0;
}

export async function insertAll(client: Client, db: DB): Promise<void> {
  const batch1: Statement[] = [
    ...db.teachers.map((x) => ({ sql: "INSERT INTO teachers (id, name, email) VALUES (?, ?, ?)", args: [x.id, x.name, x.email] as InValue[] })),
    ...db.staff.map((x) => ({ sql: "INSERT INTO staff (id, name, role) VALUES (?, ?, ?)", args: [x.id, x.name, x.role] as InValue[] })),
    ...db.subjects.map((x) => ({ sql: "INSERT INTO subjects (id, name, graded) VALUES (?, ?, ?)", args: [x.id, x.name, x.graded ? 1 : 0] as InValue[] })),
  ];
  await batchExec(client, batch1);

  await batchExec(client, db.groups.map((g) => ({
    sql: "INSERT INTO groups (id, code, course, specialty, curator_id, is_demo) VALUES (?, ?, ?, ?, ?, ?)",
    args: [g.id, g.code, g.course, g.specialty, g.curatorId ?? null, g.isDemo ? 1 : 0] as InValue[],
  })));

  await batchExec(client, db.students.map((s) => ({
    sql: "INSERT INTO students (id, name, group_id, email, phone) VALUES (?, ?, ?, ?, ?)",
    args: [s.id, s.name, s.groupId, s.email, s.phone] as InValue[],
  })));

  const parentStmts: Statement[] = [
    ...db.parents.map((p) => ({ sql: "INSERT INTO parents (id, name, phone) VALUES (?, ?, ?)", args: [p.id, p.name, p.phone] as InValue[] })),
    ...db.parents.flatMap((p) => p.childIds.map((c) => ({ sql: "INSERT INTO parent_children (parent_id, student_id) VALUES (?, ?)", args: [p.id, c] as InValue[] }))),
  ];
  await batchExec(client, parentStmts);

  const loadSlotStmts: Statement[] = [
    ...db.loads.map((l) => ({ sql: "INSERT INTO teaching_loads (teacher_id, subject_id, group_id) VALUES (?, ?, ?)", args: [l.teacherId, l.subjectId, l.groupId] as InValue[] })),
    ...db.schedule.map((s) => ({ sql: "INSERT INTO schedule_slots (id, group_id, weekday, slot, subject_id, teacher_id, room) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [s.id, s.groupId, s.weekday, s.slot, s.subjectId, s.teacherId, s.room] as InValue[] })),
  ];
  await batchExec(client, loadSlotStmts);

  const now = Date.now();
  await batchExec(client, Object.values(db.grades).map((g) => ({
    sql: "INSERT INTO grades (student_id, subject_id, date, value, teacher_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [g.studentId, g.subjectId, g.date, g.value, g.teacherId, g.updatedAt ?? now] as InValue[],
  })));

  await batchExec(client, Object.values(db.attendance)
    .filter((a) => a.status !== "present")
    .map((a) => ({ sql: "INSERT INTO attendance (student_id, subject_id, date, status) VALUES (?, ?, ?, ?)", args: [a.studentId, a.subjectId, a.date, a.status] as InValue[] })));

  const hwMsgNotifStmts: Statement[] = [
    ...db.homework.map((h) => ({ sql: "INSERT INTO homework (id, group_id, subject_id, teacher_id, issued, due, title, description, file_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [h.id, h.groupId, h.subjectId, h.teacherId, h.issued, h.due, h.title, h.text, h.fileUrl ?? ""] as InValue[] })),
    ...db.messages.map((m) => ({ sql: "INSERT INTO messages (id, from_id, to_id, text, at, read) VALUES (?, ?, ?, ?, ?, ?)", args: [m.id, m.from, m.to, m.text, m.at, m.read ? 1 : 0] as InValue[] })),
    ...db.notifications.map((n) => ({ sql: "INSERT INTO notifications (id, user_id, kind, title, text, at, read, href) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: [n.id, n.userId, n.kind, n.title, n.text, n.at, n.read ? 1 : 0, n.href] as InValue[] })),
  ];
  await batchExec(client, hwMsgNotifStmts);
}

// ---------- Записи (SQL + кэш в памяти) ----------

export const repo = {
  putGrade(c: Ctx, g: Grade) {
    write(c, "INSERT INTO grades (student_id, subject_id, date, value, teacher_id, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (student_id, subject_id, date) DO UPDATE SET value = excluded.value, teacher_id = excluded.teacher_id, updated_at = excluded.updated_at",
      [g.studentId, g.subjectId, g.date, g.value, g.teacherId, g.updatedAt ?? Date.now()]);
    c.db.grades[key(g.studentId, g.subjectId, g.date)] = g;
  },
  deleteGrade(c: Ctx, studentId: ID, subjectId: ID, date: string) {
    write(c, "DELETE FROM grades WHERE student_id = ? AND subject_id = ? AND date = ?", [studentId, subjectId, date]);
    delete c.db.grades[key(studentId, subjectId, date)];
  },
  putAttendance(c: Ctx, a: Attendance) {
    const k = key(a.studentId, a.subjectId, a.date);
    if (a.status === "present") {
      write(c, "DELETE FROM attendance WHERE student_id = ? AND subject_id = ? AND date = ?", [a.studentId, a.subjectId, a.date]);
      delete c.db.attendance[k];
      return;
    }
    write(c, "INSERT INTO attendance (student_id, subject_id, date, status) VALUES (?, ?, ?, ?) ON CONFLICT (student_id, subject_id, date) DO UPDATE SET status = excluded.status",
      [a.studentId, a.subjectId, a.date, a.status]);
    c.db.attendance[k] = a;
  },
  insertHomework(c: Ctx, h: Homework) {
    write(c, "INSERT INTO homework (id, group_id, subject_id, teacher_id, issued, due, title, description, file_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [h.id, h.groupId, h.subjectId, h.teacherId, h.issued, h.due, h.title, h.text, h.fileUrl ?? ""]);
    c.db.homework.push(h);
  },
  setHomeworkProgress(c: Ctx, hwId: ID, studentId: ID, status: HomeworkProgress | null) {
    const k = `${hwId}|${studentId}`;
    if (status === null) {
      write(c, "DELETE FROM homework_progress WHERE homework_id = ? AND student_id = ?", [hwId, studentId]);
      delete c.db.homeworkProgress[k];
      return;
    }
    write(c, "INSERT INTO homework_progress (homework_id, student_id, status) VALUES (?, ?, ?) ON CONFLICT (homework_id, student_id) DO UPDATE SET status = excluded.status",
      [hwId, studentId, status]);
    c.db.homeworkProgress[k] = status;
  },
  insertMessage(c: Ctx, m: Message) {
    write(c, "INSERT INTO messages (id, from_id, to_id, text, at, read) VALUES (?, ?, ?, ?, ?, ?)", [m.id, m.from, m.to, m.text, m.at, m.read ? 1 : 0]);
    c.db.messages.push(m);
  },
  markMessagesRead(c: Ctx, fromId: ID, toId: ID) {
    write(c, "UPDATE messages SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0", [fromId, toId]);
    c.db.messages.forEach((m) => m.from === fromId && m.to === toId && (m.read = true));
  },
  insertNotification(c: Ctx, n: Notification) {
    write(c, "INSERT INTO notifications (id, user_id, kind, title, text, at, read, href) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [n.id, n.userId, n.kind, n.title, n.text, n.at, n.read ? 1 : 0, n.href]);
    c.db.notifications.push(n);
  },
  markNotificationsRead(c: Ctx, userId: ID, id?: ID) {
    if (id) write(c, "UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?", [userId, id]);
    else write(c, "UPDATE notifications SET read = 1 WHERE user_id = ?", [userId]);
    c.db.notifications.forEach((n) => n.userId === userId && (!id || n.id === id) && (n.read = true));
  },
  insertGroup(c: Ctx, g: Group) {
    write(c, "INSERT INTO groups (id, code, course, specialty, curator_id, is_demo) VALUES (?, ?, ?, ?, ?, ?)",
      [g.id, g.code, g.course, g.specialty, g.curatorId ?? null, g.isDemo ? 1 : 0]);
    c.db.groups.push(g);
    c.db.groups.sort((a, b) => a.course - b.course || a.code.localeCompare(b.code, "ru"));
  },
  updateGroup(c: Ctx, id: ID, patch: { curatorId?: ID | null }) {
    write(c, "UPDATE groups SET curator_id = ? WHERE id = ?", [patch.curatorId ?? null, id]);
    const g = c.db.groups.find((x) => x.id === id);
    if (g) {
      if (patch.curatorId) g.curatorId = patch.curatorId;
      else delete g.curatorId;
    }
  },
  insertStudentWithParent(c: Ctx, s: Student, parentName: string) {
    write(c, "INSERT INTO students (id, name, group_id, email, phone) VALUES (?, ?, ?, ?, ?)", [s.id, s.name, s.groupId, s.email, s.phone]);
    write(c, "INSERT INTO parents (id, name, phone) VALUES (?, ?, '')", [s.parentId, parentName]);
    write(c, "INSERT INTO parent_children (parent_id, student_id) VALUES (?, ?)", [s.parentId, s.id]);
    c.db.students.push(s);
    c.db.parents.push({ id: s.parentId, name: parentName, childIds: [s.id], phone: "" });
  },
  updateStudent(c: Ctx, id: ID, patch: { name: string; groupId: ID; email: string; phone: string }) {
    write(c, "UPDATE students SET name = ?, group_id = ?, email = ?, phone = ? WHERE id = ?", [patch.name, patch.groupId, patch.email, patch.phone, id]);
    const s = c.db.students.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
  },
  insertTeacher(c: Ctx, t: Teacher) {
    write(c, "INSERT INTO teachers (id, name, email) VALUES (?, ?, ?)", [t.id, t.name, t.email]);
    c.db.teachers.push(t);
    c.db.teachers.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  },
  updateTeacher(c: Ctx, id: ID, patch: { name: string; email: string }) {
    write(c, "UPDATE teachers SET name = ?, email = ? WHERE id = ?", [patch.name, patch.email, id]);
    const t = c.db.teachers.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  },
  updateParent(c: Ctx, id: ID, patch: { name: string; phone: string }) {
    write(c, "UPDATE parents SET name = ?, phone = ? WHERE id = ?", [patch.name, patch.phone, id]);
    const p = c.db.parents.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  },
  insertSubject(c: Ctx, s: Subject) {
    write(c, "INSERT INTO subjects (id, name, graded) VALUES (?, ?, ?)", [s.id, s.name, s.graded ? 1 : 0]);
    c.db.subjects.push(s);
    c.db.subjects.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  },
  updateSubject(c: Ctx, id: ID, patch: { name: string; graded: boolean }) {
    write(c, "UPDATE subjects SET name = ?, graded = ? WHERE id = ?", [patch.name, patch.graded ? 1 : 0, id]);
    const s = c.db.subjects.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
  },
  insertLoad(c: Ctx, l: Load) {
    write(c, "INSERT OR IGNORE INTO teaching_loads (teacher_id, subject_id, group_id) VALUES (?, ?, ?)", [l.teacherId, l.subjectId, l.groupId]);
    if (!c.db.loads.some((x) => x.teacherId === l.teacherId && x.subjectId === l.subjectId && x.groupId === l.groupId)) c.db.loads.push(l);
  },
  deleteLoad(c: Ctx, l: Load) {
    write(c, "DELETE FROM teaching_loads WHERE teacher_id = ? AND subject_id = ? AND group_id = ?", [l.teacherId, l.subjectId, l.groupId]);
    c.db.loads = c.db.loads.filter((x) => !(x.teacherId === l.teacherId && x.subjectId === l.subjectId && x.groupId === l.groupId));
  },
  upsertSlot(c: Ctx, s: Omit<ScheduleSlot, "id">): ScheduleSlot {
    const existing = c.db.schedule.find((x) => x.groupId === s.groupId && x.weekday === s.weekday && x.slot === s.slot);
    const id = existing?.id ?? (Date.now() * 1000 + Math.floor(Math.random() * 1000));
    write(c,
      "INSERT INTO schedule_slots (id, group_id, weekday, slot, subject_id, teacher_id, room) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (group_id, weekday, slot) DO UPDATE SET id=id, subject_id=excluded.subject_id, teacher_id=excluded.teacher_id, room=excluded.room",
      [id, s.groupId, s.weekday, s.slot, s.subjectId, s.teacherId, s.room]);
    const slot: ScheduleSlot = { id, ...s };
    c.db.schedule = c.db.schedule.filter((x) => !(x.groupId === s.groupId && x.weekday === s.weekday && x.slot === s.slot));
    c.db.schedule.push(slot);
    return slot;
  },
  deleteSlot(c: Ctx, groupId: ID, weekday: number, slot: number) {
    write(c, "DELETE FROM schedule_slots WHERE group_id = ? AND weekday = ? AND slot = ?", [groupId, weekday, slot]);
    c.db.schedule = c.db.schedule.filter((x) => !(x.groupId === groupId && x.weekday === weekday && x.slot === slot));
  },
  saveSettings(c: Ctx, s: Settings) {
    for (const [k, v] of Object.entries(s)) {
      write(c, "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [k, JSON.stringify(v)]);
    }
    c.db.settings = s;
  },
};

// ---------- Аудит ----------

export function audit(c: Ctx, e: Omit<AuditEntry, "id" | "at">) {
  const at = Date.now();
  write(c, "INSERT INTO audit_log (at, actor_id, actor_role, action, entity, entity_id, before, after, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [at, e.actorId, e.actorRole, e.action, e.entity, e.entityId, e.before, e.after, e.reason]);
  // Добавляем в кэш и обрезаем до 1000 записей
  c.db.auditLog.unshift({ id: at, at, ...e });
  if (c.db.auditLog.length > 1000) c.db.auditLog.length = 1000;
}

export function readAudit(c: Ctx, opts: { entityPrefix?: string; entityIds?: string[]; limit?: number } = {}): AuditEntry[] {
  let entries = c.db.auditLog;
  if (opts.entityPrefix) entries = entries.filter((e) => e.entity === opts.entityPrefix);
  if (opts.entityIds) {
    if (!opts.entityIds.length) return [];
    const set = new Set(opts.entityIds);
    entries = entries.filter((e) => set.has(e.entityId));
  }
  return entries.slice(0, Math.min(opts.limit ?? 200, 1000));
}
