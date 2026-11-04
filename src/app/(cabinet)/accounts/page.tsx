"use client";
import { RoleView } from "@/components/RoleView";
import { AdminAccounts } from "@/features/admin/Accounts";

export default function Page() {
  return <RoleView views={{ college_admin: AdminAccounts }} />;
}
