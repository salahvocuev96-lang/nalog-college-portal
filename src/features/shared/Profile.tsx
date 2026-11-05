"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout, resetDemo, loadSession, useStore } from "@/lib/store";
import { useConfirm, toastResult, toast } from "@/components/feedback";
import { ROLE_LABEL } from "@/lib/nav";
import { Avatar, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SPECIALTIES } from "@/lib/constants";
import { teacherLoads } from "@/lib/access";

function resizeToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 300;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) { const r = MAX / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function Profile() {
  const { db, session } = useStore();
  const router = useRouter();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const s = session!;

  async function pickPhoto() { fileRef.current?.click(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Выберите файл изображения", "err"); return; }
    setUploading(true);
    try {
      const photo = await resizeToBase64(file);
      const res = await fetch("/api/avatar/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo }), credentials: "same-origin" });
      if (!res.ok) { const d = await res.json() as { error?: string }; toast(d.error ?? "Ошибка загрузки", "err"); return; }
      await loadSession();
      toast("Фото обновлено");
    } catch { toast("Ошибка загрузки", "err"); }
    finally { setUploading(false); }
  }

  async function removePhoto() {
    if (!(await confirm.ask("Удалить фото?", "Вместо фото будет отображаться аватар с инициалами.", { confirm: "Удалить", danger: true }))) return;
    setUploading(true);
    try {
      await fetch("/api/avatar/", { method: "DELETE", credentials: "same-origin" });
      await loadSession();
      toast("Фото удалено");
    } finally { setUploading(false); }
  }
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
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <div className="group relative shrink-0">
            {s.photo
              ? <img src={s.photo} alt={s.name} className="size-14 rounded-full object-cover sm:size-16" />
              : <Avatar name={s.name} className="size-14 text-lg sm:size-16 sm:text-xl" />}
            <button onClick={pickPhoto} disabled={uploading} title="Загрузить фото" className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-wait">
              <Icon name={uploading ? "clock" : "camera"} className="size-5 text-white" />
            </button>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink [overflow-wrap:anywhere] sm:text-xl">{s.name}</p>
            <span className="mt-1 inline-flex rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{ROLE_LABEL[s.role]}</span>
            {s.photo && (
              <button onClick={removePhoto} className="ml-2 mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-rose-600">
                <Icon name="close" className="size-3" />удалить фото
              </button>
            )}
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
