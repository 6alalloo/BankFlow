// src/layout/appLayout.tsx
import React from "react";
import Sidebar from "./sidebar";
import { useAuth } from "../contexts/useAuth";

type AppLayoutProps = {
  children: React.ReactNode;
};

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className="h-[100dvh] w-full flex bg-[#f2f2f4] text-[#0f1012] overflow-hidden">
        {/* Left sidebar - sticky to viewport */}
        <div className="shrink-0">
            <Sidebar />
        </div>

        {/* Right side: header + page content */}
        <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
            {/* Top bar */}
            <header className="sticky top-0 flex items-center justify-end px-6 py-3 z-20 shrink-0 h-14 bg-[#fdfdfd]/80 backdrop-blur-md border-b border-[#0f1012]/[0.06]">
                {/* Right: User Indicator */}
                <div className="flex items-center gap-4">
                    {user && (
                        <div className="flex items-center gap-3">
                             <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-[26px] bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.06] hover:bg-[#0f1012]/[0.07] transition-colors">
                                <div className="size-6 rounded-full bg-[#f2f2f4] flex items-center justify-center text-[10px] font-medium text-[#0f1012] border border-[#0f1012]/[0.08]">
                                    {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
                                </div>
                                <span className="text-xs text-[#8f8f8f] font-normal">{user.email}</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Page content */}
            <div className="flex-1 relative flex flex-col min-h-0">
                {children}
            </div>
        </main>
    </div>
  );
};

export default AppLayout;
