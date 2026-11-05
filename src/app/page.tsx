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
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="dots-pattern pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-10 top-1/3 size-40 rounded-full border border-gold-400/30" />
        {/* Золотое кольцо и синий ореол повторяют мотив герба */}
        <div className="pointer-events-none absolute -right-36 -top-36 size-[560px] rounded-full border-[44px] border-gold-500/15" />
        <div className="pointer-events-none absolute -bottom-48 -left-24 size-[480px] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-16 place-items-center rounded-2xl bg-white p-1.5 shadow-lg"><Crest className="size-14" /></span>
          <div>
            <p className="text-lg font-bold">Налоговый колледж</p>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-400">Education portal</p>
          </div>
        </div>
        <div className="relative flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nk-logo.jpg" alt="Налоговый колледж" width={200} height={200} className="rounded-3xl bg-white/90 p-4 shadow-2xl" />
        </div>
        <div className="relative max-w-xl stagger">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-400 ring-1 ring-white/15"><span className="pulse-dot size-1.5 rounded-full bg-gold-400" />Цифровой колледж</p>
          <h1 className="text-[44px] font-extrabold leading-[1.08] tracking-tight">Журнал, дневник и&nbsp;расписание колледжа в&nbsp;<span className="bg-gradient-to-r from-gold-400 to-gold-500 bg-clip-text text-transparent">одной системе</span></h1>
          <p className="mt-5 text-[17px] text-white/70">Оценки появляются у&nbsp;студента и&nbsp;родителя сразу после того, как их&nbsp;выставил преподаватель</p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {stats.map(([n, l]) => (
              <div key={l} className="lift rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <p className="text-4xl font-extrabold tabular-nums text-gold-400">{n}</p>
                <p className="mt-1 text-sm text-white/60">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">Демонстрационная версия. Студенты и&nbsp;родители вымышленные, расписание взято из&nbsp;проекта расписания колледжа</p>
      </section>
      <section className="relative flex flex-col justify-center overflow-hidden px-4 pb-10 sm:px-10 lg:px-16 lg:py-10">
        <div className="pointer-events-none absolute -right-24 -top-24 hidden size-72 rounded-full bg-brand-100/60 blur-3xl lg:block" />
        <LoginForm demo={isDemoMode()} />
      </section>
    </div>
  );
}
