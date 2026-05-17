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
    if (path.startsWith('/flows')) {
        if (path.includes('/builder')) return ['Flows', 'Builder'];
        if (path.split('/').length > 2 && !path.endsWith('/flows')) return ['Flows', 'Detail'];
        return ['Flows', 'Overview'];
    }
    if (path.startsWith('/cases')) {
        if (path.split('/').length > 2 && !path.endsWith('/cases')) return ['Cases', 'Detail'];
        return ['Cases', 'Work Queue'];
    }
    if (path.startsWith('/admin')) return ['Admin', 'Audit Logs'];
    return ['Platform', 'Overview'];
  };

  const [section, page] = getBreadcrumbs(location.pathname);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#040506] text-white">
        {/* Left sidebar */}
        <Sidebar />

        {/* Right side: header + page content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative bg-[#040506]">
            {/* Top bar */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-white/[0.08] bg-[#07080a] z-20 shrink-0 h-14">
                {/* Left: Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-[#6a6b6c] font-medium">{section}</span>
                    <span className="text-[#363739]">/</span>
                    <span className="text-white font-semibold tracking-wide">{page}</span>
                </div>

                {/* Right: User Indicator */}
                <div className="flex items-center gap-4">
                    {user && (
                        <div className="flex items-center gap-3 pl-4 border-l border-white/[0.08]">
                             <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111214] border border-white/[0.08]">
                                <div className="size-6 rounded-full bg-[#1b1c1e] flex items-center justify-center text-[10px] font-semibold text-white border border-white/[0.08]">
                                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                                </div>
                                <span className="text-xs text-[#9c9c9d] font-medium">{user.email}</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Page content */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {children}
            </div>
        </main>
    </div>
  );
};

export default AppLayout;
