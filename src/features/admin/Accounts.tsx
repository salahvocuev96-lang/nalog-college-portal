"use client";
// Учётные записи. Доступ выдаёт только учебная часть: временный пароль показывается один раз.
import { useCallback, useEffect, useMemo, useState } from "react";
import { act, fetchJson, useStore } from "@/lib/store";
import { Badge, Button, Card, CardHeader, Empty, Field, PageHeader, SearchInput, Select, inputCls } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { Modal, Skeleton, toastResult, useConfirm } from "@/components/feedback";
import { Icon } from "@/components/icons";
import { ROLE_LABEL } from "@/lib/nav";
import { formatTime } from "@/lib/dates";
import { translit } from "@/lib/names";
import type { Account, PasswordResetRequest } from "@/lib/types";

export function AdminAccounts() {
  const { db, session } = useStore();
  const [data, setData] = useState<{ accounts: Account[]; requests: PasswordResetRequest[] } | null>(null);
  const [q, setQ] = useState("");
  const [issued, setIssued] = useState<{ login: string; tempPassword: string } | null>(null);
  const [create, setCreate] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ name: string; login: string; tempPassword: string }[] | null>(null);
  const confirm = useConfirm();
  const load = useCallback(async () => setData(await fetchJson("/api/accounts")), []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (type: string, payload: unknown) => {
    const r = await act(type, payload);
    toastResult(r);
    if (r.ok && r.data) setIssued(r.data as { login: string; tempPassword: string });
    load();
    return r;
  };
  const reset = async (a: Account, requestId?: number) => {
    if (await confirm.ask("Выдать временный пароль?", `Текущий пароль ${a.name} перестанет работать, все сеансы завершатся. При входе потребуется сменить пароль.`, { confirm: "Выдать" })) run("account.resetPassword", { id: a.id, requestId });
  };

  if (!data) return <div className="space-y-4"><Skeleton className="h-9 w-56" /><Skeleton className="h-80 rounded-xl" /></div>;
  const t = q.trim().toLowerCase();
  const rows = data.accounts.filter((a) => !t || a.name.toLowerCase().includes(t) || a.login.includes(t));
  const open = data.requests.filter((r) => r.status === "open");

  return (
    <div>
      <PageHeader title="Аккаунты" subtitle="Учётные записи создаёт только учебная часть. Пользователь меняет временный пароль при первом входе"
        action={<span className="flex gap-2"><Button variant="outline" onClick={async () => { const r = await run("account.createAllTeachers", {}); if (r.ok && r.data) setBulkResult((r.data as { created: { name: string; login: string; tempPassword: string }[] }).created); }}><Icon name="users" className="size-4" />Аккаунты всем преподавателям</Button><Button variant="brand" onClick={() => setCreate(true)}><Icon name="plus" className="size-4" />Выдать доступ</Button></span>} />
      {open.length > 0 && (
        <Card className="mb-6 border-gold-500/50">
          <CardHeader icon="key" title={`Заявки на восстановление пароля · ${open.length}`} />
          <ul className="divide-y divide-line">
            {open.map((r) => {
              const acc = data.accounts.find((a) => a.login === r.login);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="font-mono font-semibold">{r.login}</span>
                  <span className="text-muted">{acc ? acc.name : "логин не найден"}</span>
                  <span className="text-xs text-muted">{formatTime(r.at)}</span>
                  <span className="ml-auto flex gap-2">
                    {acc && <Button className="h-9" onClick={() => reset(acc, r.id)}>Выдать пароль</Button>}
                    <Button variant="outline" className="h-9" onClick={() => run("resetRequest.close", { id: r.id })}>Закрыть</Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Card className="mb-4 p-4"><SearchInput value={q} onChange={setQ} placeholder="Поиск по имени или логину" /></Card>
      <Card>
        <DataTable rows={rows} rowKey={(a) => a.id} columns={[
          { key: "name", label: "Пользователь", primary: true, render: (a) => a.name, sort: (a) => a.name },
          { key: "login", label: "Логин", render: (a) => <span className="font-mono text-xs">{a.login}</span>, sort: (a) => a.login },
          { key: "role", label: "Роль", render: (a) => ROLE_LABEL[a.role], sort: (a) => a.role },
          { key: "state", label: "Состояние", render: (a) => !a.active ? <Badge tone="red">заблокирован</Badge> : a.mustChangePassword ? <Badge tone="gold">временный пароль</Badge> : <Badge tone="green">активен</Badge> },
          { key: "act", label: "", className: "text-right", render: (a) => a.role === "college_admin" || a.role === "tech_admin" ? <span className="text-xs text-muted">сотрудник</span> : (
            <span className="inline-flex flex-wrap gap-1">
              <button onClick={() => reset(a)} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">Сброс пароля</button>
              {a.id !== session?.id && <button onClick={() => run("account.setActive", { id: a.id, active: !a.active })} className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">{a.active ? "Заблокировать" : "Разблокировать"}</button>}
            </span>
          ) },
        ]} />
      </Card>
      <p className="mt-3 text-xs text-muted">В демо-версии аккаунты есть не у всех студентов: выдайте доступ любому человеку кнопкой «Выдать доступ».</p>

      {create && <CreateAccount existing={new Set(data.accounts.map((a) => a.id))} onClose={() => setCreate(false)} onCreate={(personId, login) => run("account.create", { personId, login }).then((r) => r.ok && setCreate(false))} />}
      <Modal open={!!issued} onClose={() => setIssued(null)} title="Временный пароль выдан" footer={<Button onClick={() => setIssued(null)}>Готово</Button>}>
        {issued && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Передайте данные пользователю лично. Пароль показывается один раз и не хранится в открытом виде.</p>
            <div className="rounded-xl bg-brand-900 p-4 font-mono text-white">
              <p className="text-xs text-white/50">Логин</p><p className="text-lg">{issued.login}</p>
              <p className="mt-2 text-xs text-white/50">Временный пароль</p><p className="text-lg text-gold-400">{issued.tempPassword}</p>
            </div>
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(`${issued.login} / ${issued.tempPassword}`).then(() => toastResult({ ok: true, info: "Скопировано" }))}>Скопировать</Button>
          </div>
        )}
      </Modal>
      {confirm.node}
      {db.students.length === 0 && <Empty title="Нет данных" />}
      <Modal open={!!bulkResult} onClose={() => setBulkResult(null)} title={`Создано аккаунтов: ${bulkResult?.length ?? 0}`} footer={<><Button variant="outline" onClick={() => { const text = (bulkResult ?? []).map((r) => `${r.name}: ${r.login} / ${r.tempPassword}`).join("\n"); navigator.clipboard?.writeText(text).then(() => toastResult({ ok: true, info: "Скопировано" })); }}>Скопировать всё</Button><Button onClick={() => setBulkResult(null)}>Готово</Button></>}>
        {bulkResult && bulkResult.length > 0 ? (
          <div className="max-h-96 overflow-y-auto space-y-2">
            <p className="text-sm text-muted mb-3">Передайте каждому преподавателю его логин и пароль. При первом входе пароль нужно сменить.</p>
            {bulkResult.map((r) => (
              <div key={r.login} className="rounded-lg bg-brand-900 px-4 py-2 font-mono text-white text-sm">
                <p className="text-white/50 text-xs">{r.name}</p>
                <p>{r.login} <span className="text-gold-400">/ {r.tempPassword}</span></p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">У всех преподавателей уже есть аккаунты.</p>}
      </Modal>
    </div>
  );
}

function CreateAccount({ existing, onClose, onCreate }: { existing: Set<string>; onClose: () => void; onCreate: (id: string, login: string) => void }) {
  const { db } = useStore();
  const [kind, setKind] = useState<"student" | "teacher" | "parent">("student");
  const [q, setQ] = useState("");
  const [personId, setPersonId] = useState("");
  const [login, setLogin] = useState("");
  const people = useMemo(() => {
    const list = kind === "student" ? db.students : kind === "teacher" ? db.teachers : db.parents;
    const t = q.trim().toLowerCase();
    return list.filter((p) => !existing.has(p.id) && (!t || p.name.toLowerCase().includes(t))).slice(0, 50);
  }, [db, kind, q, existing]);
  const pick = (id: string) => {
    setPersonId(id);
    const p = [...db.students, ...db.teachers, ...db.parents].find((x) => x.id === id);
    if (p) {
      const [f, n] = p.name.split(" ");
      setLogin(`${translit(f ?? "")}.${translit(n?.[0] ?? "")}${Math.floor(Math.random() * 90 + 10)}`.toLowerCase().replace(/[^a-z0-9.]/g, ""));
    }
  };
  return (
    <Modal open onClose={onClose} title="Выдать доступ" footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button disabled={!personId || login.length < 3} onClick={() => onCreate(personId, login)}>Создать аккаунт</Button></>}>
      <div className="space-y-4">
        <Select label="Кому" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setPersonId(""); }}>
          <option value="student">Студенту</option><option value="teacher">Преподавателю</option><option value="parent">Родителю</option>
        </Select>
        <SearchInput value={q} onChange={setQ} placeholder="Поиск по ФИО" />
        <div className="max-h-48 overflow-y-auto rounded-xl border border-line">
          {people.length === 0 ? <p className="p-4 text-sm text-muted">Никого не найдено (или у всех уже есть доступ)</p> : people.map((p) => (
            <button key={p.id} onClick={() => pick(p.id)} className={`block w-full border-b border-line px-3 py-2 text-left text-sm last:border-0 ${personId === p.id ? "bg-gold-50 font-semibold" : "hover:bg-page"}`}>{p.name}</button>
          ))}
        </div>
        <Field label="Логин" hint="Латиница, цифры, точка и дефис"><input className={inputCls} value={login} onChange={(e) => setLogin(e.target.value.toLowerCase())} /></Field>
      </div>
    </Modal>
  );
}
