import { AppShell } from "@/components/AppShell";

export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
