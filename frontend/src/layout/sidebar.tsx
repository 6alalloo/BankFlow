import { useState } from "react";
import { flushSync } from "react-dom";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import {
  FiGitBranch, FiBriefcase, FiZap, FiLogOut, FiUser, FiShield, FiBarChart2, FiUsers, FiCheckSquare
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { createFlow, fetchFlows } from "../api/flows";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCreating, setIsCreating] = useState(false);

  const handleLogout = (event?: React.MouseEvent<HTMLAnchorElement> | React.PointerEvent<HTMLAnchorElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    window.localStorage.removeItem("bankflow_token");
    window.localStorage.removeItem("bankflow_user");
    flushSync(() => logout());
    navigate("/logout", { replace: true });
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
    "flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-200 group no-underline " +
    (isActive
      ? "bg-[#0f1012]/[0.06] text-[#0f1012] font-medium relative"
      : "text-[#8f8f8f] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.03]"
    );

  return (
    <aside className="w-[240px] h-[100dvh] sticky top-0 flex flex-col shrink-0 z-30 bg-[#fdfdfd] border-r border-[#0f1012]/[0.06]">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-3 no-underline group">
            <img src="/favicon.png" alt="" className="size-7" />
            <div>
                <div className="font-medium text-[#0f1012] tracking-tight leading-4 text-[15px] group-hover:text-[#0071e3] transition-colors">BankFlow</div>
                <div className="text-[#868788] font-normal text-[9px] tracking-[0.15em] mt-0.5 whitespace-nowrap uppercase">Case Orchestration</div>
            </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar space-y-0.5">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
              <FiBarChart2 size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="text-sm tracking-tight">Dashboard</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/flows"
          className={({ isActive }) => navLinkClass(isActive && !isBuilderActive)}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
              <FiGitBranch size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="text-sm tracking-tight">Flows</span>
            </>
          )}
        </NavLink>

        <a
          href="/builder"
          onClick={handleBuilderClick}
          className={navLinkClass(isBuilderActive) + " cursor-pointer relative"}
        >
          {isBuilderActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
          <FiZap size={18} strokeWidth={1.5} className="shrink-0" />
          <span className="text-sm tracking-tight">{isCreating ? "Loading..." : "Builder"}</span>
        </a>

        <NavLink
          to="/cases"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
              <FiBriefcase size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="text-sm tracking-tight">Cases</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/tasks"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
              <FiCheckSquare size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="text-sm tracking-tight">My Tasks</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/approvals"
          className={({ isActive }) => navLinkClass(isActive)}
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
              <FiShield size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="text-sm tracking-tight">Approvals</span>
            </>
          )}
        </NavLink>

        {user?.role?.name === "Admin" && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-[10px] font-normal text-[#868788] uppercase tracking-[0.15em]">Administration</span>
            </div>
            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
                  <FiShield size={18} strokeWidth={1.5} className="shrink-0" />
                  <span className="text-sm tracking-tight">Audit Logs</span>
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/security"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
                  <FiShield size={18} strokeWidth={1.5} className="shrink-0" />
                  <span className="text-sm tracking-tight">Security</span>
                </>
              )}
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#0071e3] rounded-r-full" />}
                  <FiUsers size={18} strokeWidth={1.5} className="shrink-0" />
                  <span className="text-sm tracking-tight">User Management</span>
                </>
              )}
            </NavLink>
          </>
        )}
      </div>

      {/* User Info & Logout */}
      <div className="p-3 shrink-0 border-t border-[#0f1012]/[0.06]">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-[10px] bg-[#0f1012]/[0.03] hover:bg-[#0f1012]/[0.05] transition-colors group cursor-default">
              <div className="size-8 rounded-full bg-[#f2f2f4] flex items-center justify-center text-[#0f1012] border border-[#0f1012]/[0.08] shrink-0">
                <FiUser size={14} strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[#8f8f8f] text-sm font-normal truncate group-hover:text-[#0f1012] transition-colors">
                  {user.full_name}
                </div>
                <div className="text-[#868788] text-[10px] font-normal uppercase tracking-wider">
                    {user.role.name}
                </div>
              </div>
              
              <a
                href="/logout"
                role="button"
                onPointerDown={handleLogout}
                onClick={handleLogout}
                className="size-8 flex items-center justify-center text-[#868788] hover:text-[#b71c1c] hover:bg-[#ffebee] rounded-lg transition-colors shrink-0"
                aria-label="Sign out"
                title="Sign out"
              >
                <FiLogOut size={16} strokeWidth={1.5} />
              </a>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
