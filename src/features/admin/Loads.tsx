"use client";
// Назначения: преподаватель + предмет + группа. Именно они дают преподавателю доступ к журналу.
import { useState } from "react";
import { act, useStore } from "@/lib/store";
import { Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { Modal, toastResult, useConfirm } from "@/components/feedback";
import { Icon } from "@/components/icons";
import { nameOf } from "@/lib/access";
import type { Load } from "@/lib/types";

export function AdminLoads() {
  const { db } = useStore();
  const [groupId, setGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [add, setAdd] = useState(false);
  const [form, setForm] = useState({ teacherId: db.teachers[0]?.id ?? "", subjectId: db.subjects[0]?.id ?? "", groupId: db.groups[0]?.id ?? "" });
  const confirm = useConfirm();
  const rows = db.loads.filter((l) => (!groupId || l.groupId === groupId) && (!teacherId || l.teacherId === teacherId));
  const code = (id: string) => db.groups.find((g) => g.id === id)?.code ?? "";
  const subj = (id: string) => db.subjects.find((s) => s.id === id)?.name ?? "";
  const pairs = (l: Load) => db.schedule.filter((s) => s.teacherId === l.teacherId && s.subjectId === l.subjectId && s.groupId === l.groupId).length;

  const remove = async (l: Load) => {
    if (!(await confirm.ask("Снять назначение?", `${nameOf(db, l.teacherId)} потеряет доступ к журналу «${subj(l.subjectId)}» в группе ${code(l.groupId)}. Выставленные оценки сохранятся.`, { confirm: "Снять", danger: true }))) return;
    toastResult(await act("load.remove", l));
  };

  return (
    <div>
      <PageHeader title="Назначения преподавателей" subtitle="Преподаватель видит в журнале только назначенные ему группы и предметы. Сам себе назначения он выдать не может"
        action={<Button variant="gold" onClick={() => setAdd(true)}><Icon name="plus" className="size-4" />Назначить</Button>} />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Группа"><option value="">Все группы</option>{db.groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}</Select>
        <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Преподаватель"><option value="">Все преподаватели</option>{db.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
      </Card>
      <Card>
        <DataTable rows={rows} rowKey={(l) => `${l.teacherId}|${l.subjectId}|${l.groupId}`} columns={[
          { key: "teacher", label: "Преподаватель", primary: true, render: (l) => nameOf(db, l.teacherId), sort: (l) => nameOf(db, l.teacherId) },
          { key: "subject", label: "Предмет", render: (l) => subj(l.subjectId), sort: (l) => subj(l.subjectId) },
          { key: "group", label: "Группа", render: (l) => code(l.groupId), sort: (l) => code(l.groupId) },
          { key: "pairs", label: "В расписании", render: (l) => pairs(l) ? `${pairs(l)} пар/нед` : <Badge tone="gold">нет пар</Badge> },
          { key: "x", label: "", render: (l) => <button onClick={() => remove(l)} className="rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-rose-600" aria-label="Снять назначение"><Icon name="trash" className="size-4" /></button>, className: "w-10 text-right" },
        ]} />
      </Card>
      <Modal open={add} onClose={() => setAdd(false)} title="Новое назначение"
        footer={<><Button variant="outline" onClick={() => setAdd(false)}>Отмена</Button><Button onClick={async () => { const r = await act("load.add", form); toastResult(r); if (r.ok) setAdd(false); }}>Назначить</Button></>}>
        <div className="space-y-4">
          <Select label="Преподаватель" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>{db.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          <Select label="Предмет" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>{db.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select label="Группа" value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>{db.groups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}</Select>
          <p className="text-xs text-muted">Пары для назначения добавляются в разделе «Расписание». Преподаватель получит уведомление.</p>
        </div>
      </Modal>
      {confirm.node}
    </div>
  );
}
