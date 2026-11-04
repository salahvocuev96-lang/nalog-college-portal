"use client";
import { RoleView } from "@/components/RoleView";
import { AuditLog } from "@/features/shared/AuditLog";

export default function Page() {
  return <RoleView views={{ college_admin: AuditLog, tech_admin: AuditLog }} />;
}
