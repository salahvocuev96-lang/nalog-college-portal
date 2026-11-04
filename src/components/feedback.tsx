"use client";
// Обратная связь интерфейса: уведомления-тосты, модальные окна, подтверждения, skeleton-заглушки
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { Button, cx } from "./ui";

// ---------- Тосты ----------

type ToastItem = { id: number; msg: string; tone: "ok" | "err" };
let toasts: ToastItem[] = [];
let tid = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

export function toast(msg: string, tone: "ok" | "err" = "ok") {
  const id = ++tid;
  toasts = [...toasts.slice(-2), { id, msg, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, tone === "err" ? 5000 : 2800);
}

/** Показать результат серверного действия */
export function toastResult(r: { ok: boolean; info?: string; error?: string }, okText = "Сохранено") {
  if (r.ok) toast(r.info ?? okText);
  else toast(r.error ?? "Ошибка", "err");
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-24 left-1/2 z-[70] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 lg:bottom-8">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            "pointer-events-auto relative left-1/2 flex animate-toast items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium whitespace-pre-line shadow-[var(--shadow-pop)]",
            t.tone === "ok" ? "bg-brand-900 text-white" : "bg-danger text-white",
          )}
        >
          <Icon name={t.tone === "ok" ? "check" : "alert"} className="mt-px size-[18px] shrink-0 text-gold-400" />
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ---------- Модальное окно ----------

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex animate-fade items-end justify-center bg-brand-950/45 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          "safe-bottom flex max-h-[92dvh] w-full animate-sheet flex-col overflow-hidden rounded-t-3xl bg-white shadow-[var(--shadow-pop)] sm:animate-pop sm:rounded-3xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-brand-900">{title}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-brand-50">
            <Icon name="close" className="size-[18px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-page/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Подтверждение важного действия */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; text: ReactNode; confirm: string; danger?: boolean; resolve: (v: boolean) => void } | null>(null);
  const ask = (title: string, text: ReactNode, opts: { confirm?: string; danger?: boolean } = {}) =>
    new Promise<boolean>((resolve) => setState({ title, text, confirm: opts.confirm ?? "Подтвердить", danger: opts.danger, resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const node = (
    <Modal
      open={!!state}
      onClose={() => close(false)}
      title={state?.title ?? ""}
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>Отмена</Button>
          <Button variant={state?.danger ? "danger" : "brand"} onClick={() => close(true)}>{state?.confirm}</Button>
        </>
      }
    >
      <div className="text-sm text-ink">{state?.text}</div>
    </Modal>
  );
  return { ask, node };
}

// ---------- Skeleton ----------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Загрузка">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
