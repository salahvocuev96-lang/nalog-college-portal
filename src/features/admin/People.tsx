"use client";
import { useState } from "react";
import { act, useStore } from "@/lib/store";
import { Button, Card, Field, PageHeader, SearchInput, inputCls } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { Modal, toastResult } from "@/components/feedback";
import type { Parent } from "@/lib/types";

export function AdminParents() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Parent | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const child = (p: Parent) => db.students.find((s) => s.id === p.childIds[0]);
  const t = q.trim().toLowerCase();
  const rows = db.parents.filter((p) => !t || p.name.toLowerCase().includes(t) || (child(p)?.name.toLowerCase().includes(t) ?? false));
  return (
    <div>
      <PageHeader title="Родители" subtitle="Родитель видит данные только привязанного ребёнка. Новые родители создаются вместе со студентом" />
      <Card className="mb-4 p-4"><SearchInput value={q} onChange={setQ} placeholder="Поиск по ФИО родителя или ребёнка" /></Card>
      <Card>
        <DataTable rows={rows} rowKey={(p) => p.id} onRowClick={(p) => { setEdit(p); setName(p.name); setPhone(p.phone); }} columns={[
          { key: "name", label: "ФИО", primary: true, render: (p) => p.name, sort: (p) => p.name },
          { key: "child", label: "Ребёнок", render: (p) => child(p)?.name ?? "—", sort: (p) => child(p)?.name ?? "" },
          { key: "group", label: "Группа", render: (p) => db.groups.find((g) => g.id === child(p)?.groupId)?.code ?? "—" },
          { key: "phone", label: "Телефон", render: (p) => p.phone || "—" },
        ]} />
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Родитель"
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Отмена</Button><Button onClick={async () => { const r = await act("parent.update", { id: edit!.id, name, phone }); toastResult(r); if (r.ok) setEdit(null); }}>Сохранить</Button></>}>
        <div className="space-y-4">
          <Field label="ФИО"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Телефон"><input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
