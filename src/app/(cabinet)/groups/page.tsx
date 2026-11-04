"use client";
import { RoleView } from "@/components/RoleView";
import { TeacherGroups } from "@/features/teacher/Groups";
import { AdminGroups } from "@/features/admin/Admin";

export default function Page() {
  return <RoleView views={{ teacher: TeacherGroups, college_admin: AdminGroups }} />;
}
