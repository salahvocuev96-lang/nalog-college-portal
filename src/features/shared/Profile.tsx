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
    <div className="max-w-3xl">
      <PageHeader title="Профиль" />
      <Card className="overflow-hidden">
        <div className="relative h-24 overflow-hidden bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 sm:h-28">
          <div className="dots-pattern absolute inset-0 opacity-60" />
          <div className="absolute -right-10 -top-16 size-48 rounded-full border-[20px] border-white/25" />
        </div>
        <div className="-mt-12 flex flex-col items-center gap-3 px-5 pb-6 text-center sm:-mt-10 sm:flex-row sm:items-end sm:gap-5 sm:text-left">
          <Avatar name={s.name} className="relative size-24 shrink-0 bg-gradient-to-br from-brand-700 to-brand-950 text-2xl text-gold-400 shadow-[0_12px_30px_-10px_rgb(10_33_72/0.6)] ring-4 ring-white sm:size-28" />
          <div className="min-w-0 sm:pb-1">
            <p className="text-xl font-extrabold tracking-tight text-brand-900 [overflow-wrap:anywhere] sm:text-2xl">{s.name}</p>
            <span className="mt-1 inline-flex rounded-full bg-brand-50 px-3 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">{ROLE_LABEL[s.role]}</span>
          </div>
        </div>
        <dl className="grid gap-2 border-t border-line/80 p-4 sm:grid-cols-2 sm:p-5">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="lift min-w-0 rounded-xl border border-line/70 bg-page/50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink [overflow-wrap:anywhere]">{v || "-"}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="mt-6">
        <CardHeader icon="key" title="Безопасность" />
        <div className="flex flex-wrap gap-3 p-5">
          <Link href="/change-password/" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-700 to-brand-800 px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgb(18_48_106/0.6)] transition-all hover:-translate-y-px active:scale-[0.97]"><Icon name="key" className="size-4" />Сменить пароль</Link>
          <Button variant="outline" onClick={exit}><Icon name="logout" className="size-4" />Выйти</Button>
        </div>
      </Card>
      {isStaff && (
        <Card className="mt-6">
          <CardHeader icon="settings" title="Демо-режим" />
          <div className="p-5">
            <Button variant="outline" className="text-rose-600" onClick={reset}>Сбросить демо-данные</Button>
            <p className="mt-3 text-xs text-muted">Данные хранятся на сервере в базе SQLite. Сброс пересоздаёт базу с исходными демо-данными. В рабочей версии (DEMO_MODE=false) функция отключена.</p>
          </div>
        </Card>
      )}
      {confirm.node}
    </div>
  );
}
