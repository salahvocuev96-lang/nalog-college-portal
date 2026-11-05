"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTeacher } from "./useTeacher";
import { AvgBadge, Badge, Button, Card, CardHeader, Empty, Field, PageHeader, Segmented, Select, cx, inputCls } from "@/components/ui";
import { Modal, toastResult, useConfirm } from "@/components/feedback";
import { Icon } from "@/components/icons";
import { formatShort, formatTime, formatWithWeekday, monthPeriod, semesterPeriod } from "@/lib/dates";
import { lessonDates } from "@/lib/queries";
import { key } from "@/lib/constants";
import { act, setAttendance, setGrade, useStore } from "@/lib/store";
import { average } from "@/lib/stats";
import { nameOf } from "@/lib/access";
import { ATT_META, ATT_ORDER } from "@/features/shared/attendance";
import type { AttendanceStatus, AuditEntry, GradeValue } from "@/lib/types";

const GRADES: GradeValue[] = [5, 4, 3, 2];
type Draft = Record<string, { grade?: GradeValue | null; attendance?: AttendanceStatus }>;

export function Journal() {
  const { db, loads, groups } = useTeacher();
  const params = useSearchParams();
  const now = db.serverToday;
  const sem = semesterPeriod(now, db.settings);

  const [groupId, setGroupId] = useState(() => (groups.some((g) => g.id === params.get("group")) ? params.get("group")! : groups[0]?.id ?? ""));
  const subjectsForGroup = useMemo(
    () => db.subjects.filter((s) => s.graded && loads.some((l) => l.groupId === groupId && l.subjectId === s.id)),
    [db, loads, groupId],
  );
  const [subjectId, setSubjectId] = useState(() => params.get("subject") ?? "");
  useEffect(() => {
    if (!subjectsForGroup.some((s) => s.id === subjectId)) setSubjectId(subjectsForGroup[0]?.id ?? "");
  }, [subjectsForGroup, subjectId]);

  const dates = useMemo(() => (groupId && subjectId ? lessonDates(db, groupId, subjectId, sem.from, now).reverse() : []), [db, groupId, subjectId, sem.from, now]);
  const [date, setDate] = useState(() => params.get("date") ?? "");
  useEffect(() => {
    if (dates.length && !dates.includes(date)) setDate(dates[0]);
    if (!dates.length && date) setDate("");
  }, [dates, date]);

  const students = useMemo(() => db.students.filter((s) => s.groupId === groupId), [db, groupId]);
  const [mode, setMode] = useState<"quick" | "bulk">("quick");
  const [draft, setDraft] = useState<Draft>({});
  const [reasonFor, setReasonFor] = useState<{ studentId: string; value: GradeValue | null; prev: number } | null>(null);
  const [reason, setReason] = useState("");
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => setDraft({}), [groupId, subjectId, date, mode]);

  const auditByKey = useMemo(() => {
    const m = new Map<string, AuditEntry[]>();
    db.audit.forEach((e) => e.entity === "grade" && m.set(e.entityId, [...(m.get(e.entityId) ?? []), e]));
    return m;
  }, [db.audit]);

  const avgFor = (sid: string) => {
    const vals: number[] = [];
    for (const g of Object.values(db.grades)) if (g.studentId === sid && g.subjectId === subjectId && g.date >= sem.from && g.date <= sem.to) vals.push(g.value);
    return average(vals);
  };

  const month = monthPeriod(date || now);
  const monthDates = useMemo(
    () => (groupId && subjectId ? lessonDates(db, groupId, subjectId, month.from, month.to < now ? month.to : now) : []),
    [db, groupId, subjectId, month.from, month.to, now],
  );

  // ----- Быстрый режим: каждое нажатие сразу сохраняется на сервере -----
  const onGrade = async (sid: string, v: GradeValue | null) => {
    const prev = db.grades[key(sid, subjectId, date)]?.value;
    if (prev) {
      setReason("");
      setReasonFor({ studentId: sid, value: v, prev });
      return;
    }
    toastResult(await setGrade(sid, subjectId, date, v));
  };
  const saveWithReason = async () => {
    if (!reasonFor) return;
    const r = await setGrade(reasonFor.studentId, subjectId, date, reasonFor.value, reason.trim());
    toastResult(r);
    if (r.ok) setReasonFor(null);
  };
  const onAtt = async (sid: string, st: AttendanceStatus) => toastResult(await setAttendance(sid, subjectId, date, st));

  // ----- Массовый режим: черновик и сохранение одним запросом с подтверждением -----
  const valueOf = (sid: string) => {
    const k = key(sid, subjectId, date);
    const d = draft[sid];
    return {
      grade: d && "grade" in d ? d.grade ?? null : db.grades[k]?.value ?? null,
      attendance: d?.attendance ?? db.attendance[k]?.status ?? "present",
    };
  };
  const setDraftField = (sid: string, patch: Draft[string]) => setDraft((d) => ({ ...d, [sid]: { ...d[sid], ...patch } }));
  const changes = Object.entries(draft).flatMap(([sid, d]) => {
    const k = key(sid, subjectId, date);
    const row: { studentId: string; grade?: GradeValue | null; attendance?: AttendanceStatus } = { studentId: sid };
    if ("grade" in d && (d.grade ?? null) !== (db.grades[k]?.value ?? null)) row.grade = d.grade ?? null;
    if (d.attendance && d.attendance !== (db.attendance[k]?.status ?? "present")) row.attendance = d.attendance;
    return row.grade !== undefined || row.attendance ? [row] : [];
  });
  const changedExisting = new Set(changes.filter((c) => c.grade !== undefined && db.grades[key(c.studentId, subjectId, date)]).map((c) => c.studentId));

  const saveBulk = async () => {
    let why = "";
    const ok = await confirm.ask(
      "Сохранить изменения?",
      <div className="space-y-3">
        <p>Будет сохранено строк: <b>{changes.length}</b>. Студенты и родители получат уведомления о новых оценках.</p>
        {changedExisting.size > 0 && (
          <Field label={`Причина изменения выставленных оценок (${changedExisting.size})`}>
            <input className={inputCls} onChange={(e) => (why = e.target.value)} placeholder="Например: пересдача" />
          </Field>
        )}
      </div>,
      { confirm: "Сохранить" },
    );
    if (!ok) return;
    const rows = changes.map((c) => (changedExisting.has(c.studentId) ? { ...c, reason: why.trim() } : c));
    const r = await act("journal.bulk", { subjectId, date, rows });
    toastResult(r);
    if (r.ok) setDraft({});
  };

  if (!groups.length) return <Card><Empty icon="journal" title="За вами не закреплены группы" text="Назначения выдаёт учебная часть колледжа" /></Card>;

  const groupAvg = average(students.map((s) => avgFor(s.id)).filter((v): v is number => v !== null));
  const group = groups.find((g) => g.id === groupId);

  return (
    <div>
      <PageHeader
        title="Электронный журнал"
        subtitle="Оценки и посещаемость ведутся раздельно. Доступны только назначенные вам группы и предметы"
        action={<Segmented value={mode} onChange={setMode} options={[{ value: "quick", label: "Быстрый ввод" }, { value: "bulk", label: "Массовое заполнение" }]} />}
      />

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-3">
        <Select label="Группа" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
        </Select>
        <Select label="Предмет" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjectsForGroup.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select label="Дата занятия" value={date} onChange={(e) => setDate(e.target.value)}>
          {dates.map((d) => <option key={d} value={d}>{d === now ? "Сегодня, " : ""}{formatShort(d)} · {formatWithWeekday(d).split(",")[0]}</option>)}
        </Select>
      </Card>

      {!subjectsForGroup.length ? <Card><Empty icon="book" title="Нет оцениваемых предметов в этой группе" /></Card> : !date ? <Card><Empty icon="calendar" title="Занятий в этом семестре ещё не было" /></Card> : (
        <Card>
          <CardHeader
            icon="journal"
            title={<span>{formatWithWeekday(date)} <span className="font-normal text-muted">· {group?.code}</span></span>}
            action={<span className="flex items-center gap-2 text-xs text-muted"><span className="hidden sm:inline">Средний по группе</span> <AvgBadge value={groupAvg} /></span>}
          />
          {mode === "bulk" && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-gold-50/50 px-5 py-3 text-sm">
              <Icon name="edit" className="size-4 text-gold-600" />
              <span className="mr-auto text-muted">Изменения копятся в черновике и сохраняются одной кнопкой</span>
              <Button variant="outline" className="h-9" onClick={() => students.forEach((s) => setDraftField(s.id, { attendance: "present" }))}>Все присутствуют</Button>
            </div>
          )}
          <div className="hidden grid-cols-[28px_minmax(0,1fr)_auto_auto_70px] items-center gap-4 border-b border-line bg-subtle px-5 py-2.5 text-xs font-medium text-muted md:grid">
            <span>№</span><span>Студент</span><span>Посещаемость</span><span>Оценка</span><span className="text-right">Семестр</span>
          </div>
          <ul className="divide-y divide-line">
            {students.map((s, i) => {
              const k = key(s.id, subjectId, date);
              const v = mode === "bulk" ? valueOf(s.id) : { grade: db.grades[k]?.value ?? null, attendance: db.attendance[k]?.status ?? "present" };
              const away = v.attendance === "absent" || v.attendance === "sick";
              const dirty = mode === "bulk" && changes.some((c) => c.studentId === s.id);
              const history = auditByKey.get(k);
              return (
                <li key={s.id} className={cx("grid grid-cols-[28px_1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-3 transition-colors md:grid-cols-[28px_minmax(0,1fr)_auto_auto_70px]", dirty && "bg-gold-50/70")}>
                  <span className="text-sm text-muted">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.name}</span>
                    {history && history.some((e) => e.action !== "grade.create") && (
                      <button onClick={() => setHistoryKey(k)} title="История изменений" aria-label="История изменений" className="shrink-0 rounded-md p-1 text-gold-600 hover:bg-gold-50"><Icon name="history" className="size-4" /></button>
                    )}
                  </span>
                  <span className="text-right md:order-last"><AvgBadge value={avgFor(s.id)} /></span>
                  <div className="col-span-3 flex gap-1 md:col-span-1 md:col-start-3 md:row-start-1" role="group" aria-label="Посещаемость">
                    {ATT_ORDER.map((st) => (
                      <button
                        key={st}
                        title={ATT_META[st].label}
                        aria-pressed={v.attendance === st}
                        onClick={() => (mode === "bulk" ? setDraftField(s.id, { attendance: st, ...(st === "absent" || st === "sick" ? { grade: null } : {}) }) : onAtt(s.id, st))}
                        className={cx("h-10 min-w-11 rounded-lg px-2 text-xs font-bold transition-all duration-150 active:scale-95 md:h-9 md:min-w-10", v.attendance === st ? ATT_META[st].btn : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                      >
                        {ATT_META[st].short}
                      </button>
                    ))}
                  </div>
                  <div className="col-span-3 flex items-center gap-1 md:col-span-1 md:col-start-4 md:row-start-1" role="group" aria-label="Оценка">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        disabled={away}
                        aria-pressed={v.grade === g}
                        onClick={() => (mode === "bulk" ? setDraftField(s.id, { grade: v.grade === g ? null : g }) : onGrade(s.id, v.grade === g ? null : g))}
                        className={cx(
                          "size-10 rounded-lg text-sm font-bold ring-1 transition-all duration-150 active:scale-95 md:size-9",
                          v.grade === g ? "bg-brand-800 text-white ring-brand-800" : "bg-white text-brand-900 ring-line hover:ring-brand-700/40",
                          away && "opacity-30",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                    <button disabled={!v.grade} onClick={() => (mode === "bulk" ? setDraftField(s.id, { grade: null }) : onGrade(s.id, null))} title="Удалить оценку" aria-label="Удалить оценку" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-600 disabled:opacity-0 md:size-9">
                      <Icon name="close" className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {mode === "bulk" ? (
            <div className="sticky bottom-[61px] flex flex-wrap items-center gap-3 rounded-b-[var(--radius-card)] border-t border-line bg-white/95 px-5 py-3 backdrop-blur lg:bottom-0">
              <span className="mr-auto text-sm text-muted">{changes.length ? <>Несохранённых изменений: <b className="text-brand-900">{changes.length}</b></> : "Изменений нет"}</span>
              <Button variant="outline" disabled={!changes.length} onClick={() => setDraft({})}>Сбросить</Button>
              <Button variant="brand" disabled={!changes.length} onClick={saveBulk}>Сохранить</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-3 text-xs text-muted">
              {ATT_ORDER.map((st) => <span key={st}><b className="text-ink">{ATT_META[st].short}</b> {ATT_META[st].label.toLowerCase()}</span>)}
              <span>Студенту с отметкой Н или Б оценку поставить нельзя. Изменение выставленной оценки требует причины</span>
            </div>
          )}
        </Card>
      )}

      {monthDates.length > 0 && (
        <Card className="mt-6">
          <CardHeader icon="chart" title={`Сводка за ${month.label.toLowerCase()}`} action={<span className="hidden text-xs text-muted sm:inline">Нажмите на дату, чтобы открыть занятие</span>} />
          <div className="scroll-x">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="sticky left-0 z-10 bg-white px-5 py-2.5 text-left font-semibold">Студент</th>
                  {monthDates.map((d) => (
                    <th key={d} className="px-1 py-2">
                      <button onClick={() => setDate(d)} className={cx("rounded-md px-1.5 py-1 font-semibold transition", d === date ? "bg-gold-500 text-brand-950" : "hover:bg-brand-50")}>{formatShort(d).slice(0, 2)}</button>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right font-semibold">Месяц</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((s) => {
                  const vals: number[] = [];
                  return (
                    <tr key={s.id} className="hover:bg-page/70">
                      <td className="sticky left-0 z-10 max-w-[200px] truncate bg-white px-5 py-2">{s.name.split(" ").slice(0, 2).join(" ")}</td>
                      {monthDates.map((d) => {
                        const k = key(s.id, subjectId, d);
                        const g = db.grades[k]?.value;
                        const a = db.attendance[k]?.status;
                        if (g) vals.push(g);
                        return (
                          <td key={d} className={cx("px-1 py-2 text-center", d === date && "bg-gold-50")}>
                            {g ? <span className="font-bold text-brand-900">{g}</span> : a && a !== "present" ? <span className={cx("rounded px-1 text-[11px] font-bold", ATT_META[a].chip)}>{ATT_META[a].short}</span> : <span className="text-line">·</span>}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right"><AvgBadge value={average(vals)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={!!reasonFor}
        onClose={() => setReasonFor(null)}
        title={reasonFor?.value ? "Изменение оценки" : "Удаление оценки"}
        footer={<><Button variant="outline" onClick={() => setReasonFor(null)}>Отмена</Button><Button disabled={reason.trim().length < 3} onClick={saveWithReason}>Сохранить</Button></>}
      >
        {reasonFor && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-page p-3 text-sm">
              <span className="font-medium">{nameOf(db, reasonFor.studentId)}</span>
              <span className="ml-auto flex items-center gap-2 font-bold">
                <span className="text-muted line-through">{reasonFor.prev}</span>
                <Icon name="chevronRight" className="size-4 text-muted" />
                <span className="text-brand-900">{reasonFor.value ?? "нет оценки"}</span>
              </span>
            </div>
            <Field label="Причина изменения" hint="Сохраняется в журнале аудита вместе с вашим именем и временем">
              <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: пересдача, ошибка при выставлении" onKeyDown={(e) => e.key === "Enter" && reason.trim().length >= 3 && saveWithReason()} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal open={!!historyKey} onClose={() => setHistoryKey(null)} title="История изменений оценки">
        <HistoryList entries={historyKey ? auditByKey.get(historyKey) ?? [] : []} />
      </Modal>
      {confirm.node}
    </div>
  );
}

/** Хронология изменений одной оценки (из журнала аудита) */
export function HistoryList({ entries }: { entries: AuditEntry[] }) {
  const { db } = useStore();
  if (!entries.length) return <p className="text-sm text-muted">Изменений не было</p>;
  const val = (s: string | null) => (s ? (JSON.parse(s) as { value: number }).value : "—");
  return (
    <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-white bg-gold-500" />
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={e.action === "grade.create" ? "green" : e.action === "grade.delete" ? "red" : "gold"}>{e.action === "grade.create" ? "Выставлена" : e.action === "grade.delete" ? "Удалена" : "Изменена"}</Badge>
            <b className="text-brand-900">{val(e.before)} → {val(e.after)}</b>
          </p>
          <p className="mt-1 text-xs text-muted">{nameOf(db, e.actorId)} · {formatTime(e.at)}</p>
          {e.reason && <p className="mt-1 text-sm text-ink">Причина: {e.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
