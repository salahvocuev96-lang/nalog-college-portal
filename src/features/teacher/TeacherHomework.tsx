"use client";
import { useMemo, useState } from "react";
import { useTeacher } from "./useTeacher";
import { Badge, Button, Card, CardHeader, Empty, Field, PageHeader, Select, inputCls } from "@/components/ui";
import { toastResult } from "@/components/feedback";
import { addDays, formatShort } from "@/lib/dates";
import { act } from "@/lib/store";
import { homeworkStatus } from "@/lib/queries";

export function TeacherHomework() {
  const { db, session, loads, groups } = useTeacher();
  const now = db.serverToday;
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const subs = db.subjects.filter((s) => s.graded && loads.some((l) => l.groupId === groupId && l.subjectId === s.id));
  const [subjectId, setSubjectId] = useState("");
  const sid = subs.some((s) => s.id === subjectId) ? subjectId : subs[0]?.id ?? "";
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [issued, setIssued] = useState(now);
  const [due, setDue] = useState(addDays(now, 7));
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => db.homework.filter((h) => h.teacherId === session!.id).sort((a, b) => b.issued.localeCompare(a.issued)), [db, session]);

  const submit = async () => {
    setBusy(true);
    const r = await act("homework.create", { groupId, subjectId: sid, title, text, issued, due });
    setBusy(false);
    toastResult(r);
    if (r.ok) {
      setTitle("");
      setText("");
    }
  };

  return (
    <div>
      <PageHeader title="Домашние задания" subtitle="Задание сразу появится у студентов группы и их родителей" />
      <Card className="mb-6">
        <CardHeader icon="plus" title="Новое задание" />
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <Select label="Группа" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
          </Select>
          <Select label="Предмет" value={sid} onChange={(e) => setSubjectId(e.target.value)} className="md:col-span-3">
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Field label="Заголовок" className="md:col-span-2"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Например: задачи из практикума" className={inputCls} /></Field>
          <Field label="Дата публикации"><input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} className={inputCls} /></Field>
          <Field label="Срок сдачи"><input type="date" value={due} min={issued} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
          <Field label="Описание" className="md:col-span-4"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="Что нужно сделать и как сдать" className={`${inputCls} h-auto py-2`} /></Field>
          <div className="flex flex-wrap items-center gap-3 md:col-span-4">
            <Button variant="gold" onClick={submit} disabled={!sid || title.trim().length < 3 || busy}>{busy ? "Публикуем…" : "Опубликовать задание"}</Button>
            <span className="text-xs text-muted">Вложения файлов появятся в следующей версии</span>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader icon="task" title="Выданные задания" action={<span className="text-xs text-muted">{list.length}</span>} />
        {list.length === 0 ? <Empty icon="task" title="Заданий пока нет" /> : (
          <ul className="divide-y divide-line">
            {list.map((h) => {
              const sts = db.students.filter((s) => s.groupId === h.groupId);
              const done = sts.filter((s) => homeworkStatus(db, h, s.id, now) === "done").length;
              const inWork = sts.filter((s) => homeworkStatus(db, h, s.id, now) === "in_progress").length;
              return (
                <li key={h.id} className="grid gap-x-4 gap-y-2 px-5 py-3.5 md:grid-cols-[56px_1fr_auto] md:items-center">
                  <span className="text-sm font-bold text-brand-900">{db.groups.find((g) => g.id === h.groupId)?.code}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{h.title} <span className="font-normal text-muted">· {db.subjects.find((s) => s.id === h.subjectId)?.name}</span></span>
                    <span className="block truncate text-xs text-muted">{h.text}</span>
                    <span className="mt-1.5 flex h-1.5 max-w-xs overflow-hidden rounded-full bg-brand-50">
                      <span className="bg-emerald-500 transition-[width] duration-500" style={{ width: `${(done / Math.max(sts.length, 1)) * 100}%` }} />
                      <span className="bg-gold-400 transition-[width] duration-500" style={{ width: `${(inWork / Math.max(sts.length, 1)) * 100}%` }} />
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">выполнили {done} из {sts.length}</span>
                    <Badge tone={h.due < now ? "gray" : "gold"}>{h.due < now ? "срок прошёл" : `до ${formatShort(h.due)}`}</Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
