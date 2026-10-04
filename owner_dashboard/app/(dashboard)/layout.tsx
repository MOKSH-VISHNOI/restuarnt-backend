import DashboardShell from "@/components/layout/DashboardShell";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return <DashboardShell>{children}</DashboardShell>;
}