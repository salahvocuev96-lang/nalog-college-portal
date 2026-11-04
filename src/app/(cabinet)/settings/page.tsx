"use client";
import { RoleView } from "@/components/RoleView";
import { AdminSettings } from "@/features/admin/Settings";

export default function Page() {
  return <RoleView views={{ college_admin: AdminSettings }} />;
}
