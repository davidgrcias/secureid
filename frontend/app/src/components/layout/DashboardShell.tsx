"use client";

import { useEffect } from "react";
import Footer from "./Footer";
import SideNav from "./SideNav";
import TopNav from "./TopNav";
import { useUiStore } from "@/stores/uiStore";

type DashboardShellProps = {
  children: React.ReactNode;
};

export default function DashboardShell({ children }: DashboardShellProps) {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const openSidebar = useUiStore((state) => state.openSidebar);
  const closeSidebar = useUiStore((state) => state.closeSidebar);

  useEffect(() => {
    closeSidebar();
  }, [closeSidebar]);

  return (
    <div className="min-h-dvh bg-background">
      <TopNav variant="dashboard" onMenuClick={openSidebar} />
      <SideNav open={isSidebarOpen} onClose={closeSidebar} />

      <main className="min-h-[calc(100dvh-64px)] px-4 pb-8 pt-6 lg:ml-72 lg:px-8">{children}</main>
      <div className="lg:ml-72">
        <Footer />
      </div>
    </div>
  );
}
