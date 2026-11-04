// Базовые UI-компоненты дизайн-системы портала
"use client";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode, SelectHTMLAttributes } from "react";
import { Icon, type IconName } from "./icons";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children, style, hover }: { className?: string; children: ReactNode; style?: CSSProperties; hover?: boolean }) {
  return (
    <div style={style} className={cx("min-w-0 rounded-[var(--radius-card)] border border-line/80 bg-white shadow-card", hover && "lift", className)}>
      {children}
    </div>
  );
}

/** Фирменный синий блок-приветствие с золотым кольцом как на гербе */
export function HeroCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-5 text-white sm:p-7 md:p-8", className)} style={{ boxShadow: "0 18px 50px -18px rgb(10 33 72 / 0.65)" }}>
      <div className="dots-pattern pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(110deg,transparent_35%,black)]" />
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border-[30px] border-gold-500/20" />
      <div className="pointer-events-none absolute -right-6 -top-10 size-40 rounded-full border border-gold-400/30" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

const headerTones = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-100",
  green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  red: "bg-rose-50 text-rose-600 ring-rose-100",
};

export function CardHeader({ title, action, icon, subtitle, tone = "gold" }: { title: ReactNode; action?: ReactNode; icon?: IconName; subtitle?: ReactNode; tone?: keyof typeof headerTones }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl ring-1", headerTones[tone])}>
            <Icon name={icon} className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold tracking-tight text-brand-900">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Ссылка-действие в шапке карточки */
export function MoreLink({ children }: { children: ReactNode }) {
  return (
    <span className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-900">
      {children}
      <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex animate-enter flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900 md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BtnVariant = "gold" | "brand" | "ghost" | "outline" | "danger";
export function Button({ variant = "brand", className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    gold: "bg-gradient-to-b from-gold-400 to-gold-500 text-brand-950 shadow-[0_6px_16px_-6px_rgb(229_169_26/0.7)] hover:shadow-[0_10px_22px_-8px_rgb(229_169_26/0.8)] hover:brightness-105",
    brand: "bg-gradient-to-b from-brand-700 to-brand-800 text-white shadow-[0_6px_16px_-6px_rgb(18_48_106/0.6)] hover:shadow-[0_10px_22px_-8px_rgb(18_48_106/0.7)] hover:from-brand-600 hover:to-brand-700",
    ghost: "text-brand-800 hover:bg-brand-50",
    outline: "border border-line bg-white text-brand-900 shadow-sm hover:border-brand-200 hover:bg-brand-50",
    danger: "bg-gradient-to-b from-rose-500 to-danger text-white shadow-[0_6px_16px_-6px_rgb(210_59_76/0.6)] hover:brightness-110",
  };
  return (
    <button
      className={cx("inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50", styles[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Select({ label, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      {label && <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>}
      <select
        className="h-10 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function Field({ label, hint, className, children }: { label: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Badge({ tone = "brand", children, className }: { tone?: "brand" | "gold" | "green" | "red" | "gray" | "sky"; children: ReactNode; className?: string }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    gold: "bg-gold-50 text-gold-700 ring-gold-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-rose-50 text-rose-600 ring-rose-100",
    gray: "bg-slate-100 text-slate-600 ring-slate-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
  };
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", tones[tone], className)}>{children}</span>;
}

/** Поле поиска с иконкой */
export function SearchInput({ value, onChange, placeholder = "Поиск", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={cx("relative block min-w-0", className)}>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(inputCls, "pl-9")} />
    </label>
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100";

const statTones = {
  brand: { icon: "from-brand-500 to-brand-800 text-white shadow-[0_8px_18px_-8px_rgb(29_65_150/0.8)]", bar: "from-brand-500 to-brand-700", glow: "bg-brand-500/10" },
  gold: { icon: "from-gold-400 to-gold-600 text-brand-950 shadow-[0_8px_18px_-8px_rgb(229_169_26/0.9)]", bar: "from-gold-400 to-gold-600", glow: "bg-gold-500/15" },
  green: { icon: "from-emerald-400 to-emerald-600 text-white shadow-[0_8px_18px_-8px_rgb(16_185_129/0.8)]", bar: "from-emerald-400 to-emerald-600", glow: "bg-emerald-500/10" },
  red: { icon: "from-rose-400 to-rose-600 text-white shadow-[0_8px_18px_-8px_rgb(244_63_94/0.8)]", bar: "from-rose-400 to-rose-600", glow: "bg-rose-500/10" },
};

/** Карточка показателя. progress (0–100) рисует шкалу внизу */
export function StatCard({ label, value, hint, icon, tone = "brand", progress }: { label: string; value: ReactNode; hint?: ReactNode; icon: IconName; tone?: keyof typeof statTones; progress?: number }) {
  const t = statTones[tone];
  return (
    <Card hover className="relative overflow-hidden p-4 sm:p-5" style={{ boxShadow: "var(--shadow-stat)" }}>
      <div className={cx("pointer-events-none absolute -right-8 -top-8 size-28 rounded-full blur-2xl", t.glow)} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="min-w-0 text-[13px] font-semibold leading-tight text-muted">{label}</p>
        <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br sm:size-11 sm:rounded-2xl", t.icon)}>
          <Icon name={icon} className="size-[18px] sm:size-5" />
        </span>
      </div>
      <p className="relative mt-1 text-[26px] font-extrabold leading-none tracking-tight text-brand-900 tabular-nums sm:mt-2 sm:text-[32px]">{value}</p>
      {progress !== undefined && (
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-brand-50">
          <div className={cx("bar-x h-full rounded-full bg-gradient-to-r", t.bar)} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {hint && <p className="relative mt-2 truncate text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Кольцевой индикатор (средний балл, посещаемость) */
export function ProgressRing({ value, size = 96, stroke = 9, color = "var(--color-gold-500)", track = "rgb(255 255 255 / 0.12)", children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={len * (1 - v / 100)}
          className="ring-anim" style={{ ["--ring-len" as string]: len } as CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Горизонтальная шкала со значением */
export function MeterRow({ label, value, max, display, tone }: { label: string; value: number; max: number; display: ReactNode; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="truncate font-medium text-ink">{label}</span>
        <span className="shrink-0 font-bold tabular-nums text-brand-900">{display}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50">
        <div className={cx("bar-x h-full rounded-full", tone)} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

/** Цвет оценки и среднего балла */
export function gradeTone(v: number | null) {
  if (v === null) return "bg-slate-100 text-slate-400";
  if (v >= 4.5) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (v >= 3.5) return "bg-brand-50 text-brand-700 ring-brand-100";
  if (v >= 2.5) return "bg-gold-50 text-gold-600 ring-gold-100";
  return "bg-rose-50 text-rose-600 ring-rose-200";
}

export function GradeChip({ value, size = "md", title }: { value: number; size?: "sm" | "md"; title?: string }) {
  return (
    <span title={title} className={cx("inline-grid place-items-center rounded-lg font-bold ring-1", gradeTone(value), size === "sm" ? "size-7 text-[13px]" : "size-9 text-base")}>
      {value}
    </span>
  );
}

export function AvgBadge({ value, className }: { value: number | null; className?: string }) {
  return (
    <span className={cx("inline-flex h-7 min-w-12 items-center justify-center rounded-lg px-2 text-[13px] font-bold tabular-nums ring-1 ring-transparent", gradeTone(value), className)}>
      {value === null ? "-" : value.toFixed(2).replace(".", ",")}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = name.replace("Родитель: ", "").split(" ");
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (
    <span className={cx("grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800", className)}>{initials}</span>
  );
}

export function Empty({ icon = "book", title, text }: { icon?: IconName; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-100">
        <Icon name={icon} />
      </span>
      <p className="mt-3 font-semibold text-brand-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-brand-50 p-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx("h-8 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold transition-all duration-200 active:scale-95", value === o.value ? "bg-white text-brand-900 shadow-[0_2px_8px_-2px_rgb(10_33_72/0.18)]" : "text-muted hover:text-brand-800")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
