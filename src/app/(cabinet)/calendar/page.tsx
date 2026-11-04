"use client";
import { RoleView } from "@/components/RoleView";
import { StudentCalendar } from "@/features/student/Calendar";

export default function Page() {
  return <RoleView views={{ student: StudentCalendar, parent: StudentCalendar }} />;
}
