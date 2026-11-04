"use client";
import { RoleView } from "@/components/RoleView";
import { AdminParents } from "@/features/admin/People";

export default function Page() {
  return <RoleView views={{ college_admin: AdminParents }} />;
}
