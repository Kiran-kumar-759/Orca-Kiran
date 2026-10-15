import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { WorkspaceNav } from "./WorkspaceNav";

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-orca-dark text-slate-100">
      <Header />
      <WorkspaceNav />
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
      <footer className="border-t border-orca-border/50 py-4 px-6 text-center text-xs text-orca-muted">
        ORCA — Open-Source Marine & Coastal Intelligence Platform | Real Data First • Evidence-Backed • Deterministic
      </footer>
    </div>
  );
};
