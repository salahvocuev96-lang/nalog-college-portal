"use client";
import { useState } from "react";
import { Crest } from "@/components/Crest";
import { Icon, type IconName } from "@/components/icons";
import { Button, Field, cx, inputCls } from "@/components/ui";
import { Modal } from "@/components/feedback";
import { demoLogin, login, requestPasswordReset } from "@/lib/store";

const DEMO: { login: string; title: string; text: string; icon: IconName }[] = [
  { login: "student", title: "Студент", text: "Дневник, оценки, задания", icon: "book" },
  { login: "teacher", title: "Преподаватель", text: "Журнал своих групп", icon: "journal" },
  { login: "parent", title: "Родитель", text: "Успеваемость ребёнка", icon: "users" },
  { login: "admin", title: "Учебная часть", text: "Управление колледжем", icon: "shield" },
  { login: "tech", title: "Тех. администратор", text: "Мониторинг и копии", icon: "server" },
];

export function LoginForm({ demo }: { demo: boolean }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [recover, setRecover] = useState(false);
  const [recoverLogin, setRecoverLogin] = useState("");
  const [recoverMsg, setRecoverMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const done = (r: { ok: boolean; error?: string }) => {
    // Полная навигация: кэш роутера мог запомнить переадресацию, сделанную до входа
    if (r.ok) window.location.assign("/home/");
    else {
      setError(r.error ?? "Ошибка входа");
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !password) return setError("Введите логин и пароль");
    setBusy("form");
    done(await login(name, password));
  };

  return (
    <div className="mx-auto w-full max-w-md animate-enter">
      <div className="mb-8 flex flex-col items-center text-center lg:hidden">
        <Crest className="size-24" />
        <p className="mt-3 text-xl font-bold text-brand-900">Налоговый колледж</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-600">Education portal</p>
      </div>
      <h2 className="text-2xl font-bold text-brand-900 md:text-3xl">Вход в&nbsp;личный кабинет</h2>
      <p className="mt-2 text-sm text-muted">Логин и&nbsp;временный пароль выдаёт учебная часть колледжа</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Логин">
          <input className={cx(inputCls, "h-12")} autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" spellCheck={false} />
        </Field>
        <Field label="Пароль">
          <span className="relative block">
            <input className={cx(inputCls, "h-12 pr-12")} type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Скрыть пароль" : "Показать пароль"} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-brand-50">
              <Icon name="eye" className="size-[18px]" />
            </button>
          </span>
        </Field>
        {error && (
          <p role="alert" className="flex animate-enter items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <Icon name="alert" className="mt-px size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" variant="gold" className="h-12 w-full text-[15px]" disabled={!!busy}>
          {busy === "form" ? "Проверяем…" : "Войти"}
          <Icon name="chevronRight" className="size-4" />
        </Button>
        <button type="button" onClick={() => { setRecover(true); setRecoverMsg(null); setRecoverLogin(name); }} className="w-full text-center text-sm font-semibold text-brand-700 hover:text-brand-900">
          Забыли пароль?
        </button>
      </form>

      {demo && (
        <div className="mt-8 rounded-2xl border border-dashed border-gold-500/60 bg-gold-50/50 p-4">
          <p className="text-sm font-semibold text-brand-900">Демонстрационный вход</p>
          <p className="mt-0.5 text-xs text-muted">Открыть кабинет без пароля. В рабочей версии этот блок отключается</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEMO.map((d) => (
              <button
                key={d.login}
                disabled={!!busy}
                onClick={async () => { setBusy(d.login); setError(""); done(await demoLogin(d.login)); }}
                className="group flex flex-col items-start rounded-xl border border-line bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-card disabled:opacity-60"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-900 group-hover:text-gold-400">
                  <Icon name={d.icon} className="size-[18px]" />
                </span>
                <span className="mt-2 text-[13px] font-semibold text-brand-900">{busy === d.login ? "Входим…" : d.title}</span>
                <span className="text-[11px] leading-tight text-muted">{d.text}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Вход с паролем: <code className="rounded bg-white px-1">teacher</code> / <code className="rounded bg-white px-1">demo2026</code>. Первый вход с временным паролем: <code className="rounded bg-white px-1">newstudent</code> / <code className="rounded bg-white px-1">temp-2026</code></p>
        </div>
      )}

      <Modal open={recover} onClose={() => setRecover(false)} title="Восстановление пароля"
        footer={recoverMsg?.ok ? <Button onClick={() => setRecover(false)}>Понятно</Button> : (
          <>
            <Button variant="outline" onClick={() => setRecover(false)}>Отмена</Button>
            <Button onClick={async () => { const r = await requestPasswordReset(recoverLogin); setRecoverMsg(r.ok ? { ok: true, text: r.info ?? "" } : { ok: false, text: r.error }); }}>Отправить заявку</Button>
          </>
        )}>
        {recoverMsg?.ok ? <p className="text-sm text-ink">{recoverMsg.text}</p> : (
          <div className="space-y-3">
            <p className="text-sm text-muted">Укажите логин. Заявка придёт в учебную часть, вам выдадут новый временный пароль. Отправка по email появится в следующей версии.</p>
            <Field label="Логин"><input className={inputCls} value={recoverLogin} onChange={(e) => setRecoverLogin(e.target.value)} /></Field>
            {recoverMsg && <p className="text-sm text-rose-600">{recoverMsg.text}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
