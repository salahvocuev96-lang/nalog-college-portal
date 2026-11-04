"use client";
import { RoleView } from "@/components/RoleView";
import { NotificationsCenter } from "@/features/shared/Notifications";

export default function Page() {
  return <RoleView views={{ student: NotificationsCenter, parent: NotificationsCenter, teacher: NotificationsCenter, college_admin: NotificationsCenter, tech_admin: NotificationsCenter }} />;
}
