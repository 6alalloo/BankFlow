// src/layout/appLayout.tsx
import React from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./sidebar";
import { useAuth } from "../contexts/AuthContext";

type AppLayoutProps = {
  children: React.ReactNode;
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const getBreadcrumbs = (path: string) => {
    if (path.startsWith('/workflows')) {
        if (path.includes('/builder')) return ['Workflows', 'Builder'];
        // Check if it's a detail page (has ID)
        if (path.split('/').length > 2 && !path.endsWith('/workflows')) return ['Workflows', 'Detail'];
        return ['Workflows', 'Overview'];
    }
    if (path.startsWith('/executions')) {
        if (path.split('/').length > 2 && !path.endsWith('/executions')) return ['Executions', 'Detail'];
        return ['Executions', 'History'];
    }
    if (path.startsWith('/admin')) return ['Admin', 'Audit Logs'];
    return ['Platform', 'Overview'];
  };

  const [section, page] = getBreadcrumbs(location.pathname);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#020617] text-white selection:bg-blue-500/30">
        {/* Left sidebar - Fixed width, handled by the component itself */}
        <Sidebar />

        {/* Right side: header + page content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative bg-gradient-to-br from-[#020617] via-[#050b1d] to-[#020617]">
            {/* Top bar - Modernized Glass Header */}
            <header className="flex items-center justify-between px-8 py-3 border-b border-white/5 bg-white/[0.01] backdrop-blur-xl z-20 shrink-0">
                {/* Left: Breadcrumbs / Context */}
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500 font-medium">{section}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-200 font-semibold tracking-wide">{page}</span>
                </div>

                {/* Right: User Indicator (Static) */}
                <div className="flex items-center gap-6">
                    {/* User Pill - Data Display Only */}
                    {user && (
                        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                             <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
                                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                                </div>
                                <span className="text-xs text-slate-300 font-medium">{user.email}</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Page content - Independent scroll */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {children}
            </div>
        </main>
    </div>
  );
};

export default AppLayout;