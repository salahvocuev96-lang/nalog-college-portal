import { describe, expect, it } from "vitest";
import { average, finalGrade, studentAverage } from "@/lib/stats";
import { semesterByNumber, semesterPeriod } from "@/lib/dates";
import { homeworkStatus } from "@/lib/queries";
import { DEFAULT_SETTINGS, type DB } from "@/lib/db-types";

describe("средний балл", () => {
  it("обычное арифметическое среднее", () => {
    expect(average([5, 4, 3])).toBe(4);
    expect(average([5, 4])).toBe(4.5);
    expect(average([])).toBeNull();
  });

  it("пропуски не влияют на средний балл: в расчёт идут только оценки", () => {
    const db = {
      grades: {
        "s|m|2026-09-02": { studentId: "s", subjectId: "m", date: "2026-09-02", value: 5, teacherId: "t" },
        "s|m|2026-09-03": { studentId: "s", subjectId: "m", date: "2026-09-03", value: 3, teacherId: "t" },
      },
      attendance: { "s|m|2026-09-04": { studentId: "s", subjectId: "m", date: "2026-09-04", status: "absent" } },
    } as unknown as DB;
    expect(studentAverage(db, "s")).toBe(4);
  });

  it("итоговая оценка по настраиваемому правилу", () => {
    expect(finalGrade(3.5, "mean_round")).toBe(4);
    expect(finalGrade(3.49, "mean_round")).toBe(3);
    expect(finalGrade(3.9, "mean_floor")).toBe(3);
    expect(finalGrade(1.2, "mean_round")).toBe(2);
    expect(finalGrade(null)).toBeNull();
  });
});

describe("учебные периоды", () => {
  it("семестры берутся из настроек и не привязаны к конкретному году", () => {
    expect(semesterPeriod("2026-10-10").label).toBe("1 семестр");
    expect(semesterPeriod("2027-03-10").label).toBe("2 семестр");
    expect(semesterByNumber(2, "2026-10-10", DEFAULT_SETTINGS).from).toBe("2027-01-12");
    const custom = { semester1: { from: "09-01", to: "12-25" }, semester2: { from: "01-09", to: "06-30" } };
    expect(semesterByNumber(1, "2031-11-01", custom).to).toBe("2031-12-25");
  });
});

describe("статус домашнего задания", () => {
  const hw = { id: "h", groupId: "g", subjectId: "m", teacherId: "t", issued: "2026-10-01", due: "2026-10-10", title: "", text: "" };
  it("новое, выполняется, выполнено, просрочено", () => {
    const db = { homeworkProgress: {} } as unknown as DB;
    expect(homeworkStatus(db, hw, "s", "2026-10-05")).toBe("new");
    expect(homeworkStatus(db, hw, "s", "2026-10-11")).toBe("overdue");
    db.homeworkProgress["h|s"] = "in_progress";
    expect(homeworkStatus(db, hw, "s", "2026-10-05")).toBe("in_progress");
    db.homeworkProgress["h|s"] = "done";
    expect(homeworkStatus(db, hw, "s", "2026-10-11")).toBe("done");
  });
});
