"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout, resetDemo, useStore } from "@/lib/store";
import { useConfirm, toastResult } from "@/components/feedback";
import { ROLE_LABEL } from "@/lib/nav";
import { Avatar, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SPECIALTIES } from "@/lib/constants";
import { teacherLoads } from "@/lib/access";

export function Profile() {
  const { db, session } = useStore();
  const router = useRouter();
  const confirm = useConfirm();
  const s = session!;
  const rows: [string, string][] = [["Роль", ROLE_LABEL[s.role]], ["Логин", s.login]];
  const isStaff = s.role === "college_admin" || s.role === "tech_admin";
  const exit = async () => {
    await logout();
    router.replace("/");
  };
  const reset = async () => {
    if (!(await confirm.ask("Сбросить демо-данные?", "Все изменения (оценки, сообщения, задания, аккаунты) будут удалены, база создастся заново. Вы выйдете из системы.", { confirm: "Сбросить", danger: true }))) return;
    const r = await resetDemo();
    toastResult(r);
    if (r.ok) router.replace("/");
  };
  if (s.role === "student") {
    const st = db.students.find((x) => x.id === s.id)!;
    const g = db.groups.find((x) => x.id === st.groupId)!;
    const curator = db.teachers.find((t) => t.id === g.curatorId)?.name;
    if (curator) rows.push(["Куратор", curator]);
    rows.push(["Группа", g.code], ["Курс", String(g.course)], ["Специальность", SPECIALTIES[g.specialty] ?? g.specialty], ["Эл. почта", st.email], ["Телефон", st.phone], ["Родитель", db.parents.find((p) => p.id === st.parentId)?.name ?? ""]);
  }
  if (s.role === "parent") {
    const p = db.parents.find((x) => x.id === s.id)!;
    const st = db.students.find((x) => x.id === p.childIds[0])!;
    rows.push(["Ребёнок", st.name], ["Группа", db.groups.find((g) => g.id === st.groupId)?.code ?? ""], ["Телефон", p.phone]);
  }
  if (s.role === "teacher") {
    const t = db.teachers.find((x) => x.id === s.id)!;
    const loads = teacherLoads(db, s.id);
    rows.push(["Эл. почта", t.email], ["Групп", String(new Set(loads.map((l) => l.groupId)).size)], ["Предметов", String(new Set(loads.map((l) => l.subjectId)).size)]);
    const curated = db.groups.filter((g) => g.curatorId === s.id).map((g) => g.code);
    if (curated.length) rows.push(["Куратор групп", curated.join(", ")]);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Профиль" />
      <Card>
        <div className="flex items-center gap-4 border-b border-line p-4 sm:p-5">
          <Avatar name={s.name} className="size-14 text-lg sm:size-16 sm:text-xl" />
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink [overflow-wrap:anywhere] sm:text-xl">{s.name}</p>
            <span className="mt-1 inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{ROLE_LABEL[s.role]}</span>
          </div>
        </div>
        <dl className="grid sm:grid-cols-2">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="min-w-0 border-b border-line px-4 py-3 sm:px-5 sm:odd:border-r">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardHeader icon="key" title="Безопасность" />
        <div className="flex flex-wrap gap-3 p-5">
          <Link href="/change-password/" className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-brand-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"><Icon name="key" className="size-4" />Сменить пароль</Link>
          <Button variant="outline" onClick={exit}><Icon name="logout" className="size-4" />Выйти</Button>
        </div>
      </Card>
      {isStaff && (
        <Card>
          <CardHeader icon="settings" title="Демо-режим" />
          <div className="p-5">
            <Button variant="outline" className="text-rose-600 hover:text-rose-700" onClick={reset}>Сбросить демо-данные</Button>
            <p className="mt-3 text-xs text-muted">Данные хранятся на сервере в базе SQLite. Сброс пересоздаёт базу с исходными демо-данными. В рабочей версии (DEMO_MODE=false) функция отключена.</p>
          </div>
        </Card>
      )}
      {confirm.node}
    </div>
  );
}
