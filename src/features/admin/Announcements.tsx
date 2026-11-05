"use client";
import { useState } from "react";
import { act, useStore } from "@/lib/store";
import { Button, Card, CardHeader, Empty, Field, PageHeader, Select, inputCls } from "@/components/ui";
import { toastResult, useConfirm } from "@/components/feedback";
import { formatTime } from "@/lib/dates";

export function AdminAnnouncements() {
  const { db } = useStore();
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const confirm = useConfirm();
  const sent = db.audit.filter((e) => e.action === "announcement.send").slice(0, 10);
  const label = (a: string) => ({ all: "Все", students: "Все студенты", parents: "Все родители", teachers: "Все преподаватели" })[a] ?? `Группа ${db.groups.find((g) => `group:${g.id}` === a)?.code ?? ""}`;
  const send = async () => {
    if (!(await confirm.ask("Отправить объявление?", `Получатели: ${label(audience).toLowerCase()}. Отменить отправку будет нельзя.`, { confirm: "Отправить" }))) return;
    const r = await act("announcement.send", { audience, title, text });
    toastResult(r);
    if (r.ok) {
      setTitle("");
      setText("");
    }
  };
  return (
    <div className="max-w-4xl">
      <PageHeader title="Объявления" subtitle="Объявление приходит в центр уведомлений выбранным пользователям" />
      <Card className="mb-6 space-y-4 p-5">
        <Select label="Кому" value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option value="all">Все</option><option value="students">Все студенты</option><option value="parents">Все родители</option><option value="teachers">Все преподаватели</option>
          {db.groups.map((g) => <option key={g.id} value={`group:${g.id}`}>Группа {g.code} и родители</option>)}
        </Select>
        <Field label="Заголовок"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
        <Field label="Текст"><textarea className={`${inputCls} h-auto py-2`} rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} /></Field>
        <Button variant="brand" onClick={send} disabled={title.trim().length < 3 || text.trim().length < 3}>Отправить</Button>
      </Card>
      <Card>
        <CardHeader icon="megaphone" title="Отправленные" />
        {sent.length === 0 ? <Empty icon="megaphone" title="Объявлений ещё не было" /> : (
          <ul className="divide-y divide-line">
            {sent.map((e) => {
              const a = JSON.parse(e.after ?? "{}") as { title?: string; recipients?: number };
              return <li key={e.id} className="flex flex-wrap gap-x-4 px-5 py-3 text-sm"><span className="font-semibold text-brand-900">{a.title}</span><span className="text-muted">{label(e.entityId)} · {a.recipients} получателей</span><span className="ml-auto text-xs text-muted">{formatTime(e.at)}</span></li>;
            })}
          </ul>
        )}
      </Card>
      {confirm.node}
    </div>
  );
}
