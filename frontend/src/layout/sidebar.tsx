import React, { useState } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { FiGitBranch, FiActivity, FiZap, FiLogOut, FiUser, FiShield, FiBarChart2, FiHome, FiUsers } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { createWorkflow, fetchWorkflows } from "../api/workflows";
import { Logo } from "../components/common/Logo";

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleBuilderClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname.startsWith('/builder') || location.pathname.match(/\/workflows\/\d+\/builder/)) {
      // Already in builder, do nothing or maybe reset?
      return;
    }

    setIsCreating(true);
    try {
        // "Resume" logic: If the last modified workflow is a "Draft" (e.g., Untitled and recent), resume it.
        // For now, simpler heuristic: If there are workflows, pick the latest one?
        // User requested: "if there's a workflow saved but not ran".
        // We lack 'executions_count' here efficiently without fetching all executions.
        // Strategy: Create New always ensures a clean slate, BUT user asked for resume.
        // Let's Find the most recently updated workflow.
        
        const workflows = await fetchWorkflows();
        // Sort by updated_at desc
        const sorted = workflows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        
        const latest = sorted[0];
        
        // Use a heuristic: If it is named "Untitled Workflow", assume it's a draft
        if (latest && latest.name === "Untitled Workflow") {
            navigate(`/workflows/${latest.id}/builder`);
        } else {
            // Create new
            const newWorkflow = await createWorkflow({ name: "Untitled Workflow" });
            navigate(`/workflows/${newWorkflow.id}/builder`);
        }
    } catch (err) {
        console.error("Failed to handle builder click", err);
        // Fallback
        navigate('/builder'); 
    } finally {
        setIsCreating(false);
    }
  };

  const isBuilderActive = location.pathname.includes('/builder');

  return (
    <aside className="w-[280px] h-full flex flex-col bg-[#020617] border-r border-white/5 shrink-0 z-30">
      {/* Brand */}
      <div className="p-6 shrink-0 border-b border-white/5">
        <Link to="/" className="d-flex align-items-center gap-3 no-underline group">
            <Logo style={{ width: '100px', height: 'auto' }} />
            <div>
                <div className="fw-bold text-white tracking-tight leading-4 text-xl group-hover:text-cyan-400 transition-colors">HRFlow</div>
                <div className="text-cyan-500 font-medium text-[10px] tracking-[0.2em] mt-1 whitespace-nowrap drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">WORKFLOW AUTOMATION</div>
            </div>
        </Link>
      </div>

      {/* Navigation - Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-2">
        {/* Home */}
        <NavLink
          to="/"
          end
          style={{ textDecoration: 'none' }}
          className={({ isActive }) =>
            "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group !no-underline border-l-2 " +
            (isActive 
                ? "bg-gradient-to-r from-cyan-950/30 to-transparent border-cyan-400 border-b-2 border-b-cyan-400/60 !text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold" 
                : "border-transparent !text-slate-400 hover:!text-cyan-200 hover:bg-white/5 font-medium")
          }
        >
          <FiHome size={20} className="shrink-0" />
          <span className="text-base tracking-wide">Home</span>
        </NavLink>

        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          style={{ textDecoration: 'none' }}
          className={({ isActive }) =>
            "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group !no-underline border-l-2 " +
            (isActive 
                ? "bg-gradient-to-r from-cyan-950/30 to-transparent border-cyan-400 border-b-2 border-b-cyan-400/60 !text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold" 
                : "border-transparent !text-slate-400 hover:!text-cyan-200 hover:bg-white/5 font-medium")
          }
        >
          <FiBarChart2 size={20} className="shrink-0" />
          <span className="text-base tracking-wide">Dashboard</span>
        </NavLink>

        {/* Workflows */}
        <NavLink
          to="/workflows"
          style={{ textDecoration: 'none' }}
          className={({ isActive }) =>
            "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group !no-underline border-l-2 " +
            (isActive && !isBuilderActive 
                ? "bg-gradient-to-r from-cyan-950/30 to-transparent border-cyan-400 border-b-2 border-b-cyan-400/60 !text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold" 
                : "border-transparent !text-slate-400 hover:!text-cyan-200 hover:bg-white/5 font-medium")
          }
        >
          <FiGitBranch size={20} className="shrink-0" />
          <span className="text-base tracking-wide">Workflows</span>
        </NavLink>

        {/* Builder */}
        <a
          href="/builder"
          onClick={handleBuilderClick}
          style={{ textDecoration: 'none' }}
          className={
            "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 cursor-pointer group !no-underline border-l-2 " +
            (isBuilderActive 
                ? "bg-gradient-to-r from-cyan-950/30 to-transparent border-cyan-400 border-b-2 border-b-cyan-400/60 !text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold" 
                : "border-transparent !text-slate-400 hover:!text-cyan-200 hover:bg-white/5 font-medium")
          }
        >
          <FiZap size={20} className="shrink-0" />
          <span className="text-base tracking-wide">{isCreating ? "Loading..." : "Builder"}</span>
        </a>

        {/* Executions list */}
        <NavLink
          to="/executions"
          style={{ textDecoration: 'none' }}
          className={({ isActive }) =>
            "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group !no-underline border-l-2 " +
            (isActive 
                ? "bg-gradient-to-r from-cyan-950/30 to-transparent border-cyan-400 border-b-2 border-b-cyan-400/60 !text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold" 
                : "border-transparent !text-slate-400 hover:!text-cyan-200 hover:bg-white/5 font-medium")
          }
        >
          <FiActivity size={20} className="shrink-0" />
          <span className="text-base tracking-wide">Executions</span>
        </NavLink>

        {/* Admin - Audit Logs (only show for Admin users) */}
        {user?.role?.name === "Admin" && (
          <>
            <NavLink
              to="/admin/audit-logs"
              style={{ textDecoration: 'none' }}
              className={({ isActive }) =>
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group !no-underline border-l-2 " +
                (isActive 
                    ? "bg-gradient-to-r from-cyan-950/30 to-transparent border-cyan-400 border-b-2 border-b-cyan-400/60 !text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold" 
                    : "border-transparent !text-slate-400 hover:!text-cyan-200 hover:bg-white/5 font-medium")
              }
            >
              <FiShield size={20} className="shrink-0" />
              <span className="text-base tracking-wide">Audit Logs</span>
            </NavLink>
            <NavLink
              to="/admin/security"
              style={{ textDecoration: 'none' }}
              className={({ isActive }) =>
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group !no-underline border-l-2 " +
                (isActive
                    ? "bg-gradient-to-r from-green-950/30 to-transparent border-green-400 border-b-2 border-b-green-400/60 !text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)] font-bold"
                    : "border-transparent !text-slate-400 hover:!text-green-200 hover:bg-white/5 font-medium")
              }
            >
              <FiShield size={20} className="shrink-0" />
              <span className="text-base tracking-wide">Security</span>
            </NavLink>
            <NavLink
              to="/admin/users"
              style={{ textDecoration: 'none' }}
              className={({ isActive }) =>
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group !no-underline border-l-2 " +
                (isActive
                    ? "bg-gradient-to-r from-cyan-950/30 to-transparent border-cyan-400 border-b-2 border-b-cyan-400/60 !text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] font-bold"
                    : "border-transparent !text-slate-400 hover:!text-cyan-200 hover:bg-white/5 font-medium")
              }
            >
              <FiUsers size={20} className="shrink-0" />
              <span className="text-base tracking-wide">User Management</span>
            </NavLink>
          </>
        )}
      </div>

      {/* User Info & Logout - Fixed at Bottom */}
      <div className="p-4 shrink-0 border-t border-white/5 bg-[#020617]">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-cyan-900/20 shrink-0 group-hover:scale-105 transition-transform">
                <FiUser size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-slate-200 text-sm font-semibold truncate group-hover:text-cyan-200 transition-colors">
                  {user.full_name}
                </div>
                <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    {user.role.name}
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                title="Sign out"
              >
                <FiLogOut size={16} />
              </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
