"use client";
import { RoleView } from "@/components/RoleView";
import { About } from "@/features/shared/About";

export default function Page() {
  return <RoleView views={{ student: About, parent: About, teacher: About, college_admin: About, tech_admin: About }} />;
}
