import React, { useState } from "react";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { FiGitBranch, FiBriefcase, FiZap, FiLogOut, FiUser, FiShield, FiBarChart2, FiHome, FiUsers, FiCheckSquare } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { createFlow, fetchFlows } from "../api/flows";
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
    if (location.pathname.startsWith('/builder') || location.pathname.match(/\/flows\/\d+\/builder/)) {
      return;
    }

    setIsCreating(true);
    try {
        const flows = await fetchFlows();
        const sorted = flows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        const latest = sorted[0];
        
        if (latest && latest.name === "Untitled Flow") {
            navigate(`/flows/${latest.id}/builder`);
        } else {
            const newFlow = await createFlow({ name: "Untitled Flow" });
            navigate(`/flows/${newFlow.id}/builder`);
        }
    } catch (err) {
        console.error("Failed to handle builder click", err);
        navigate('/builder'); 
    } finally {
        setIsCreating(false);
    }
  };

  const isBuilderActive = location.pathname.includes('/builder');

  const navLinkClass = (isActive: boolean) =>
    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group no-underline " +
    (isActive
      ? "bg-[#111214] text-white font-medium border border-white/[0.08] shadow-[rgba(255,255,255,0.05)_0px_1px_0px_0px_inset,rgba(255,255,255,0.18)_0px_0px_0px_1px,rgba(0,0,0,0.2)_0px_-1px_0px_0px_inset]"
      : "text-[#9c9c9d] hover:text-white hover:bg-white/[0.03]"
    );

  return (
    <aside className="w-[260px] h-full flex flex-col bg-[#07080a] border-r border-white/[0.08] shrink-0 z-30">
      {/* Brand */}
      <div className="p-5 shrink-0 border-b border-white/[0.08]">
        <Link to="/" className="flex items-center gap-3 no-underline group">
            <Logo style={{ width: '28px', height: 'auto' }} />
            <div>
                <div className="font-semibold text-white tracking-tight leading-4 text-lg group-hover:text-white transition-colors">BankFlow</div>
                <div className="text-[#6a6b6c] font-medium text-[10px] tracking-[0.2em] mt-1 whitespace-nowrap uppercase">Case Orchestration</div>
            </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) => navLinkClass(isActive)}
        >
          <FiHome size={18} className="shrink-0" />
          <span className="text-sm tracking-wide">Home</span>
        </NavLink>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          <FiBarChart2 size={18} className="shrink-0" />
          <span className="text-sm tracking-wide">Dashboard</span>
        </NavLink>

        <NavLink
          to="/flows"
          className={({ isActive }) => navLinkClass(isActive && !isBuilderActive)}
        >
          <FiGitBranch size={18} className="shrink-0" />
          <span className="text-sm tracking-wide">Flows</span>
        </NavLink>

        <a
          href="/builder"
          onClick={handleBuilderClick}
          className={navLinkClass(isBuilderActive) + " cursor-pointer"}
        >
          <FiZap size={18} className="shrink-0" />
          <span className="text-sm tracking-wide">{isCreating ? "Loading..." : "Builder"}</span>
        </a>

        <NavLink
          to="/cases"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          <FiBriefcase size={18} className="shrink-0" />
          <span className="text-sm tracking-wide">Cases</span>
        </NavLink>

        <NavLink
          to="/tasks"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          <FiCheckSquare size={18} className="shrink-0" />
          <span className="text-sm tracking-wide">My Tasks</span>
        </NavLink>

        <NavLink
          to="/approvals"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          <FiShield size={18} className="shrink-0" />
          <span className="text-sm tracking-wide">Approvals</span>
        </NavLink>

        {user?.role?.name === "Admin" && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-[10px] font-medium text-[#6a6b6c] uppercase tracking-[0.15em]">Administration</span>
            </div>
            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <FiShield size={18} className="shrink-0" />
              <span className="text-sm tracking-wide">Audit Logs</span>
            </NavLink>
            <NavLink
              to="/admin/security"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <FiShield size={18} className="shrink-0" />
              <span className="text-sm tracking-wide">Security</span>
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <FiUsers size={18} className="shrink-0" />
              <span className="text-sm tracking-wide">User Management</span>
            </NavLink>
          </>
        )}
      </div>

      {/* User Info & Logout */}
      <div className="p-3 shrink-0 border-t border-white/[0.08] bg-[#07080a]">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-xl border border-white/[0.08] bg-[#111214] hover:bg-[#1b1c1e] transition-colors group cursor-default">
              <div className="size-8 rounded-full bg-[#1b1c1e] flex items-center justify-center text-white border border-white/[0.08] shrink-0">
                <FiUser size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[#9c9c9d] text-sm font-medium truncate group-hover:text-white transition-colors">
                  {user.full_name}
                </div>
                <div className="text-[#6a6b6c] text-[10px] font-medium uppercase tracking-wider">
                    {user.role.name}
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="size-8 flex items-center justify-center text-[#6a6b6c] hover:text-[#ff6363] hover:bg-[#452324]/30 rounded-lg transition-colors shrink-0"
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
