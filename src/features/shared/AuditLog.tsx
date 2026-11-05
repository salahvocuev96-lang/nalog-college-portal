"use client";
// Журнал аудита. Учебная часть видит все изменения с деталями, технический администратор только факты событий.
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { nameOf } from "@/lib/access";
import { Badge, Card, Empty, PageHeader, SearchInput, Select, cx } from "@/components/ui";
import { formatTime } from "@/lib/dates";
import type { AuditEntry } from "@/lib/types";
import { ATT_META } from "./attendance";

const attLabel = (s: unknown) => (typeof s === "string" && s in ATT_META ? ATT_META[s as keyof typeof ATT_META].label.toLowerCase() : "—");

export const ACTION_LABEL: Record<string, string> = {
  "grade.create": "Оценка выставлена",
  "grade.update": "Оценка изменена",
  "grade.delete": "Оценка удалена",
  "attendance.set": "Посещаемость",
  "schedule.update": "Расписание изменено",
  "schedule.delete": "Пара убрана",
  "auth.login": "Вход в систему",
  "auth.passwordChange": "Смена пароля",
  "account.create": "Создан аккаунт",
  "account.resetPassword": "Сброс пароля",
  "account.block": "Блокировка",
  "account.unblock": "Разблокировка",
  "system.backup": "Резервная копия",
  "settings.update": "Настройки",
  "announcement.send": "Объявление",
  "student.create": "Добавлен студент",
  "student.update": "Изменён студент",
  "group.create": "Создана группа",
  "group.update": "Изменена группа",
  "load.add": "Назначение",
  "load.remove": "Снято назначение",
  "teacher.create": "Добавлен преподаватель",
  "teacher.update": "Изменён преподаватель",
  "subject.create": "Добавлен предмет",
  "subject.update": "Изменён предмет",
  "parent.update": "Изменён родитель",
};

const tone = (a: string) => (a.startsWith("grade.update") || a.startsWith("grade.delete") ? "gold" : a.startsWith("auth") ? "gray" : a.startsWith("system") ? "sky" : a.startsWith("account") ? "red" : "brand");

export function AuditLog() {
  const { db, session } = useStore();
  const tech = session?.role === "tech_admin";
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("changes");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.audit.filter((e) => {
      if (kind === "changes" && (e.action === "grade.create" || e.action === "auth.login")) return false;
      if (kind !== "all" && kind !== "changes" && !e.action.startsWith(kind)) return false;
      return !t || nameOf(db, e.actorId).toLowerCase().includes(t) || (ACTION_LABEL[e.action] ?? e.action).toLowerCase().includes(t) || describe(db, e).toLowerCase().includes(t);
    });
  }, [db, q, kind]);

  return (
    <div>
      <PageHeader title={tech ? "Журнал событий" : "Журнал аудита"} subtitle="Записи нельзя изменить или удалить: таблица защищена на уровне базы данных" />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_220px]">
        <SearchInput value={q} onChange={setQ} placeholder="Поиск по сотруднику, действию, студенту" />
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Тип событий">
          <option value="changes">Изменения (без новых оценок и входов)</option>
          <option value="all">Все события</option>
          <option value="grade">Оценки</option>
          <option value="attendance">Посещаемость</option>
          <option value="schedule">Расписание</option>
          <option value="account">Аккаунты</option>
          <option value="auth">Входы</option>
          <option value="system">Система</option>
        </Select>
      </Card>
      <Card>
        {list.length === 0 ? <Empty icon="history" title="Записей нет" /> : (
          <>
            <div className="hidden grid-cols-[150px_200px_190px_1fr] gap-4 border-b border-line bg-subtle px-5 py-2.5 text-xs font-medium text-muted lg:grid">
              <span>Время</span><span>Кто</span><span>Действие</span><span>Подробности</span>
            </div>
            <ul className="divide-y divide-line">
              {list.slice(0, 200).map((e) => (
                <li key={e.id} className="grid gap-1 px-5 py-3 text-sm lg:grid-cols-[150px_200px_190px_1fr] lg:items-center lg:gap-4">
                  <span className="text-xs tabular-nums text-muted">{formatTime(e.at)}</span>
                  <span className="truncate font-medium text-brand-900">{nameOf(db, e.actorId)}</span>
                  <span><Badge tone={tone(e.action)}>{ACTION_LABEL[e.action] ?? e.action}</Badge></span>
                  <span className={cx("min-w-0 text-muted", tech && "italic")}>{tech ? "Подробности скрыты: нет доступа к учебным данным" : describe(db, e)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">Показаны последние {Math.min(list.length, 200)} записей.</p>
    </div>
  );
}

function describe(db: ReturnType<typeof useStore>["db"], e: AuditEntry): string {
  const parse = (s: string | null) => (s ? (JSON.parse(s) as Record<string, unknown>) : null);
  const b = parse(e.before);
  const a = parse(e.after);
  if (e.entity === "grade" || e.entity === "attendance") {
    const [sid, subj, date] = e.entityId.split("|");
    const who = `${nameOf(db, sid)}, «${db.subjects.find((s) => s.id === subj)?.name ?? ""}», ${date?.split("-").reverse().join(".")}`;
    const change = e.entity === "grade" ? `${b?.value ?? "—"} → ${a?.value ?? "—"}` : `${attLabel(b?.status)} → ${attLabel(a?.status)}`;
    return `${who}: ${change}${e.reason ? `. Причина: ${e.reason}` : ""}`;
  }
  if (e.entity === "schedule") {
    const [gid, wd, slot] = e.entityId.split("|");
    return `${db.groups.find((g) => g.id === gid)?.code ?? gid}, день ${wd}, ${slot} пара`;
  }
  if (e.entity === "user") return `${nameOf(db, e.entityId)}${a?.login ? ` (${a.login})` : ""}`;
  return e.entityId;
}
