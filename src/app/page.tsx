// Страница входа. Серверный компонент: цифры колледжа берутся из базы, форма работает на клиенте.
import { Crest } from "@/components/Crest";
import { LoginForm } from "@/features/auth/LoginForm";
import { getContext, isDemoMode } from "@/server/context";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const { db } = getContext();
  const stats: [number, string][] = [
    [db.groups.length, "учебных групп"],
    [db.teachers.length, "преподавателей"],
    [db.subjects.length, "дисциплин"],
  ];
  return (
    <div className="grid min-h-dvh bg-brand-950 lg:grid-cols-[55%_45%]">
      {/* Левая панель — фото + контент */}
      <section className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nk-logo.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" />
        {/* Градиент: фото видно сверху, темнеет к низу */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-950/30 via-brand-950/60 to-brand-950/95" />
        {/* Золотое свечение справа */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(214,167,88,0.07),transparent)]" />

        {/* Логотип */}
        <div className="relative flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur-sm">
            <Crest className="size-11" />
          </span>
          <div>
            <p className="text-[15px] font-bold leading-tight">Налоговый колледж</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-400">Education portal</p>
          </div>
        </div>

        {/* Заголовок и статистика */}
        <div className="relative stagger">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-gold-400/10 px-3.5 py-1.5 text-xs font-semibold text-gold-400 ring-1 ring-gold-400/20">
            <span className="pulse-dot size-1.5 shrink-0 rounded-full bg-gold-400" />
            Цифровой колледж
          </p>
          <h1 className="text-[46px] font-black leading-[1.06] tracking-tight">
            Журнал, дневник<br />и расписание<br />
            <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-amber-400 bg-clip-text text-transparent">в одной системе</span>
          </h1>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-white/60">
            Оценки появляются у&nbsp;студента и&nbsp;родителя сразу после того, как их&nbsp;выставил преподаватель
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {stats.map(([n, l]) => (
              <div key={l} className="rounded-2xl border border-white/8 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10">
                <p className="text-[36px] font-black tabular-nums leading-none text-gold-400">{n}</p>
                <p className="mt-1.5 text-xs leading-tight text-white/50">{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-white/30">Демонстрационная версия. Студенты и&nbsp;родители вымышленные, расписание взято из&nbsp;проекта расписания колледжа</p>
      </section>

      {/* Правая панель — форма входа */}
      <section className="relative flex flex-col justify-center overflow-hidden bg-white px-5 pb-10 sm:px-10 lg:px-14 lg:py-10">
        {/* Декоративный фон */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_10%_0%,rgba(30,42,120,0.06),transparent)]" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 size-96 rounded-full bg-brand-50 blur-3xl" />
        <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-brand-700 via-gold-400 to-brand-700 lg:hidden" />
        <LoginForm demo={isDemoMode()} />
      </section>
    </div>
  );
}
