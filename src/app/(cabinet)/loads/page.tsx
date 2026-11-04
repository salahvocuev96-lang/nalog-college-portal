"use client";
import { RoleView } from "@/components/RoleView";
import { AdminLoads } from "@/features/admin/Loads";

export default function Page() {
  return <RoleView views={{ college_admin: AdminLoads }} />;
}
