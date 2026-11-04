"use client";
import { RoleView } from "@/components/RoleView";
import { Profile } from "@/features/shared/Profile";

export default function Page() {
  return <RoleView views={{ student: Profile, parent: Profile, teacher: Profile, college_admin: Profile, tech_admin: Profile }} />;
}
