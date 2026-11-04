"use client";
import { useMemo, useState } from "react";
import { useViewer } from "../useViewer";
import { Badge, Card, Empty, PageHeader, Segmented, cx } from "@/components/ui";
import { toastResult } from "@/components/feedback";
import { Icon } from "@/components/icons";
import { formatShort } from "@/lib/dates";
import { HW_STATUS_META, homeworkStatus, subjectName } from "@/lib/queries";
import { act } from "@/lib/store";
import type { HomeworkStatus } from "@/lib/types";

type Tab = "active" | "done" | "overdue";

export function StudentHomework() {
  const { db, student, isParent } = useViewer();
  const [tab, setTab] = useState<Tab>("active");
  const now = db.serverToday;
  const list = useMemo(() => {
    if (!student) return [];
    return db.homework
      .filter((h) => h.groupId === student.groupId)
      .map((h) => ({ ...h, status: homeworkStatus(db, h, student.id, now) }))
      .sort((a, b) => a.due.localeCompare(b.due));
  }, [db, student, now]);
  if (!student) return null;
  const inTab = (s: HomeworkStatus) => (tab === "done" ? s === "done" : tab === "overdue" ? s === "overdue" : s === "new" || s === "in_progress");
  const shown = list.filter((h) => inTab(h.status));
  const count = (t: Tab) => list.filter((h) => (t === "done" ? h.status === "done" : t === "overdue" ? h.status === "overdue" : h.status === "new" || h.status === "in_progress")).length;

  const setStatus = async (id: string, status: "new" | "in_progress" | "done") => toastResult(await act("homework.setProgress", { homeworkId: id, status }));

  return (
    <div>
      <PageHeader
        title="Домашние задания"
        subtitle={isParent ? "Задания группы и отметки ребёнка о выполнении" : "Отмечайте статус, чтобы ничего не потерять. Отметка видна преподавателю"}
        action={<Segmented value={tab} onChange={setTab} options={[{ value: "active", label: `Актуальные · ${count("active")}` }, { value: "overdue", label: `Просрочено · ${count("overdue")}` }, { value: "done", label: "Выполнено" }]} />}
      />
      {shown.length === 0 ? <Card><Empty icon="task" title={tab === "done" ? "Пока ничего не отмечено" : tab === "overdue" ? "Просроченных заданий нет" : "Актуальных заданий нет"} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 stagger">
          {shown.map((h) => {
            const meta = HW_STATUS_META[h.status];
            return (
              <Card key={h.id} className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">{subjectName(db, h.subjectId)}</p>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="mt-2 font-semibold leading-snug text-brand-900">{h.title}</p>
                <p className="mt-1 flex-1 text-sm text-muted">{h.text}</p>
                <div className="mt-3 flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>{db.teachers.find((t) => t.id === h.teacherId)?.name}</span>
                  <span>выдано {formatShort(h.issued)}</span>
                  <span className={cx(h.status === "overdue" && "font-semibold text-rose-600")}>срок {formatShort(h.due)}</span>
                </div>
                {!isParent && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {h.status !== "done" && h.status !== "in_progress" && (
                      <button onClick={() => setStatus(h.id, "in_progress")} className="h-10 rounded-xl border border-line text-sm font-semibold text-brand-800 transition hover:bg-brand-50">В работе</button>
                    )}
                    {h.status === "in_progress" && (
                      <button onClick={() => setStatus(h.id, "new")} className="h-10 rounded-xl border border-line text-sm font-semibold text-muted transition hover:bg-brand-50">Сбросить</button>
                    )}
                    <button
                      onClick={() => setStatus(h.id, h.status === "done" ? "in_progress" : "done")}
                      className={cx("flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.98]", h.status === "done" ? "col-span-2 bg-emerald-50 text-emerald-700" : "bg-brand-800 text-white hover:bg-brand-700")}
                    >
                      <Icon name="check" className="size-4" />
                      {h.status === "done" ? "Выполнено · отменить" : "Выполнено"}
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">Сдача файлов через портал появится в следующей версии. Сейчас студент отмечает выполнение сам.</p>
    </div>
  );
}
