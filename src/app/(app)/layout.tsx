import { AppShell } from "@/shared/peacock/shell";

export default function AppLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <AppShell>{children}</AppShell>;
}
