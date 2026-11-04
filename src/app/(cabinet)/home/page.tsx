"use client";
import { RoleView } from "@/components/RoleView";
import { StudentHome } from "@/features/student/StudentHome";
import { TeacherHome } from "@/features/teacher/TeacherHome";
import { AdminHome } from "@/features/admin/Admin";
import { SystemHome } from "@/features/system/SystemHome";

export default function Page() {
  return <RoleView views={{ student: StudentHome, parent: StudentHome, teacher: TeacherHome, college_admin: AdminHome, tech_admin: SystemHome }} />;
}
