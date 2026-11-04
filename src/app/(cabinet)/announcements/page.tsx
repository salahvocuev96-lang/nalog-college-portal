"use client";
import { RoleView } from "@/components/RoleView";
import { AdminAnnouncements } from "@/features/admin/Announcements";

export default function Page() {
  return <RoleView views={{ college_admin: AdminAnnouncements }} />;
}
