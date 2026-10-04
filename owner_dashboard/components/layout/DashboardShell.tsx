import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[#05090d] text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main application area */}
      <div className="ml-64 min-h-screen">
        {/* Top navigation */}
        <Topbar />

        {/* Page content */}
        <main className="min-h-[calc(100vh-5rem)] px-7 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}