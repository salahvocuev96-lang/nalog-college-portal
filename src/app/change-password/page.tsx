"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crest } from "@/components/Crest";
import { Button, Card, Field, inputCls } from "@/components/ui";
import { Icon } from "@/components/icons";
import { changePassword, loadSession, logout, useStore } from "@/lib/store";

/** Обязательная смена временного пароля при первом входе (и добровольная из профиля) */
export default function ChangePasswordPage() {
  const { session, status } = useStore();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "idle") loadSession();
    if (status === "ready" && !session) router.replace("/");
  }, [status, session, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== repeat) return setError("Пароли не совпадают");
    setBusy(true);
    const r = await changePassword(current, next);
    setBusy(false);
    if (r.ok) router.replace("/home/");
    else setError(r.error);
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-page px-4 py-10">
      <Card className="w-full max-w-md animate-pop p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Crest className="size-12" />
          <div>
            <p className="font-bold text-brand-900">Налоговый колледж</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600">Education portal</p>
          </div>
        </div>
        <h1 className="mt-6 text-xl font-bold text-brand-900">{session?.mustChangePassword ? "Придумайте постоянный пароль" : "Смена пароля"}</h1>
        {session?.mustChangePassword && <p className="mt-1 text-sm text-muted">Вы вошли с временным паролем. Перед работой его нужно заменить.</p>}
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label={session?.mustChangePassword ? "Временный пароль" : "Текущий пароль"}><input type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
          <Field label="Новый пароль" hint="Не короче 8 символов, буквы и цифры"><input type="password" autoComplete="new-password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label="Повторите пароль"><input type="password" autoComplete="new-password" className={inputCls} value={repeat} onChange={(e) => setRepeat(e.target.value)} /></Field>
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700"><Icon name="alert" className="mt-px size-4 shrink-0" />{error}</p>}
          <Button type="submit" variant="gold" className="h-11 w-full" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить пароль"}</Button>
          <button type="button" onClick={async () => { if (session?.mustChangePassword) { await logout(); router.replace("/"); } else router.back(); }} className="w-full text-center text-sm text-muted hover:text-brand-800">
            {session?.mustChangePassword ? "Выйти" : "Отмена"}
          </button>
        </form>
      </Card>
    </div>
  );
}
