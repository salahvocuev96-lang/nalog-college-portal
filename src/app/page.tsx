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
    <div className="grid min-h-dvh lg:grid-cols-[55%_45%]">
      {/* Левая панель — чистый CSS-дизайн без фото */}
      <section
        className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-14"
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #0f2044 40%, #152a58 70%, #0d1f42 100%)" }}
      >
        {/* Декоративные кольца — верхний правый угол */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-[480px] rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute -right-10 -top-10 size-[340px] rounded-full border border-white/[0.08]" />
        <div className="pointer-events-none absolute right-10 top-10 size-[200px] rounded-full border border-white/[0.06]" />
        {/* Золотое сияние сверху */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-gold-400/[0.07] blur-3xl" />
        {/* Нижний акцент */}
        <div className="pointer-events-none absolute -bottom-40 -left-20 size-[500px] rounded-full bg-brand-700/20 blur-3xl" />
        {/* Сетка точек */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "36px 36px" }}
        />
        {/* Диагональная полоска-акцент */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-1 w-full"
          style={{ background: "linear-gradient(90deg, transparent, #d6a758, #f0c060, #d6a758, transparent)" }}
        />

        {/* Логотип */}
        <div className="relative flex items-center gap-3.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl p-1.5 ring-1 ring-white/20" style={{ background: "rgba(255,255,255,0.08)" }}>
            <Crest className="size-11" />
          </span>
          <div>
            <p className="text-[15px] font-bold leading-tight tracking-wide">Налоговый колледж</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-400">Education portal</p>
          </div>
        </div>

        {/* Центральный контент */}
        <div className="relative stagger">
          {/* Бейдж */}
          <p className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-gold-400 ring-1 ring-gold-400/25"
            style={{ background: "rgba(214,167,88,0.08)" }}>
            <span className="pulse-dot size-1.5 shrink-0 rounded-full bg-gold-400" />
            Цифровой колледж
          </p>
          {/* Заголовок */}
          <h1 className="text-[48px] font-black leading-[1.04] tracking-tight">
            Журнал, дневник<br />и расписание<br />
            <span style={{ background: "linear-gradient(90deg, #f0c060, #d6a758, #e8b84b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              в одной системе
            </span>
          </h1>
          <p className="mt-5 max-w-[340px] text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            Оценки появляются у&nbsp;студента и&nbsp;родителя сразу после того, как их&nbsp;выставил преподаватель
          </p>

          {/* Статистика */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {stats.map(([n, l]) => (
              <div key={l} className="rounded-2xl p-4 ring-1 ring-white/[0.08] transition-all duration-200 hover:ring-white/[0.15]"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-[34px] font-black tabular-nums leading-none text-gold-400">{n}</p>
                <p className="mt-1.5 text-xs leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>{l}</p>
              </div>
            ))}
          </div>

          {/* Фичи — горизонтальный список */}
          <div className="mt-7 flex flex-col gap-2.5">
            {[
              "Электронный журнал для каждой группы",
              "Дневник с оценками и расписанием для студентов",
              "Личный кабинет для родителей и педагогов",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                <span className="size-1.5 shrink-0 rounded-full bg-gold-400" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
          Демонстрационная версия. Студенты и&nbsp;родители вымышленные, расписание взято из&nbsp;проекта расписания колледжа
        </p>
      </section>

      {/* Правая панель — форма входа */}
      <section className="relative flex flex-col justify-center overflow-hidden px-5 pb-10 sm:px-10 lg:px-14 lg:py-10"
        style={{ background: "#f4f6fb" }}>
        {/* Верхняя цветная полоска (мобильная) */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-1 w-full lg:hidden"
          style={{ background: "linear-gradient(90deg, #1a2d6e, #d6a758, #1a2d6e)" }}
        />
        {/* Лёгкий круговой блик */}
        <div className="pointer-events-none absolute -bottom-20 -right-20 size-80 rounded-full blur-3xl" style={{ background: "rgba(30,50,120,0.06)" }} />
        <div className="pointer-events-none absolute -left-16 top-0 size-72 rounded-full blur-3xl" style={{ background: "rgba(214,167,88,0.05)" }} />
        <LoginForm demo={isDemoMode()} />
      </section>
    </div>
  );
}
