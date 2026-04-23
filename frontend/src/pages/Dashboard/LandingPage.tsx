import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createWorkflow } from "../../api/workflows";
import { fetchExecutions } from "../../api/executions";
import { apiGet } from "../../api/apiClient";
import { 
    FiPlusCircle, 
    FiGrid, 
    FiActivity, 
    FiShield, 
    FiCpu, 
    FiArrowRight, 
    FiClock
} from "react-icons/fi";

interface RecentActivity {
    id: number;
    action: string;
    target: string;
    timestamp: string;
    type: 'workflow' | 'execution' | 'system';
}

interface ApiAuditLog {
    id: number;
    action: string;
    entity_type: string | null;
    entity_id: number | null;
    created_at: string;
}

function formatTimeAgo(dateString: string | Date) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
}

export default function LandingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role?.name === 'Admin';
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activities, setActivities] = useState<RecentActivity[]>([]);

    const handleCreateWorkflow = async () => {
        try {
            const newWorkflow = await createWorkflow({ name: "Untitled Workflow" });
            navigate(`/workflows/${newWorkflow.id}/builder`);
        } catch (error) {
            console.error("Failed to create workflow", error);
        }
    };

    // Clock effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Recent Activity
    useEffect(() => {
        const fetchActivity = async () => {
            try {
                if (isAdmin) {
                   // Admin: Fetch Audit Logs
                   const res = await apiGet<{ data: ApiAuditLog[] }>('/audit?limit=3');
                   const mapped = res.data.map((log) => ({
                       id: log.id,
                       action: log.action.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                       target: log.entity_type ? `${log.entity_type} #${log.entity_id}` : 'System',
                       timestamp: formatTimeAgo(log.created_at),
                       type: 'system' as const
                   }));
                   setActivities(mapped);
                } else {
                   // Operator: Fetch Executions
                   const execs = await fetchExecutions();
                   const sorted = execs.sort((a, b) => (b.id - a.id)).slice(0, 3);
                   const mapped = sorted.map((ex) => ({
                       id: ex.id,
                       action: `Execution ${ex.status}`,
                       target: ex.workflows?.name || 'Untitled Workflow',
                       timestamp: formatTimeAgo(ex.started_at || new Date()),
                       type: 'execution' as const
                   }));
                   setActivities(mapped);
                }
            } catch (err) {
                console.error("Failed to fetch activity", err);
            }
        };
        
        if (user) {
            fetchActivity();
        }
    }, [user, isAdmin]);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <div className="h-full flex flex-col bg-[#020408] text-white relative font-sans overflow-hidden">
            {/* Tech Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            
            {/* Ambient Glows */}
            <div className="absolute top-0 right-[-10%] w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Main Content Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 flex flex-col items-center justify-start p-6 md:p-12">
                
                {/* 1. Hero / Header */}
                <div className="max-w-5xl w-full mb-12 animate-in slide-in-from-bottom-5 duration-700 pt-16">
                    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                        <div className="space-y-2">
                             <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-600 mb-1">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                                System Online
                             </div>
                             <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                                {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{user?.full_name?.split(' ')[0] || 'User'}</span>
                             </h1>
                             <p className="text-slate-400 font-mono text-sm uppercase tracking-widest">
                                Role: <span className="text-white">{user?.role?.name || 'Operator'}</span> // ID: #{user?.id ?? '000'}
                             </p>
                        </div>

                        <div className="text-right hidden md:block">
                            <div className="flex items-center gap-3 text-3xl font-mono text-white font-light tracking-widest">
                                <FiClock className="text-cyan-800" />
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-cyan-900 font-mono text-sm tracking-[0.3em] uppercase mt-1">
                                {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Action Grid */}
                <div className={`w-full grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4 max-w-7xl' : 'lg:grid-cols-3 max-w-5xl'} gap-6 mb-12 animate-in slide-in-from-bottom-8 duration-700 delay-100 mx-auto`}>
                    
                    {/* New Workflow Card */}
                    <div onClick={handleCreateWorkflow} className="group relative bg-[#050b14] border border-white/5 rounded-xl p-6 hover:border-cyan-500/50 hover:bg-cyan-950/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(6,182,212,0.2)] cursor-pointer flex flex-col items-center text-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                        <div className="w-12 h-12 bg-cyan-950/30 border border-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                            <FiPlusCircle size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">New Workflow</h3>
                        <p className="text-xs text-slate-500 font-mono leading-relaxed">
                            Initialize a new automation workflow sequence.
                        </p>
                        <FiArrowRight className="absolute bottom-6 right-6 text-cyan-900 group-hover:text-cyan-400 transition-colors -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0" />
                    </div>

                    {/* Library Card */}
                    <Link to="/workflows" className="group relative bg-[#050b14] border border-white/5 rounded-xl p-6 hover:border-blue-500/50 hover:bg-blue-950/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(59,130,246,0.2)] flex flex-col items-center text-center">
                         <div className="w-12 h-12 bg-blue-950/30 border border-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                            <FiGrid size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">Library</h3>
                        <p className="text-xs text-slate-500 font-mono leading-relaxed">
                            Access and manage existing automation protocols.
                        </p>
                    </Link>

                    {/* History Card */}
                    <Link to="/executions" className="group relative bg-[#050b14] border border-white/5 rounded-xl p-6 hover:border-indigo-500/50 hover:bg-indigo-950/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.2)] flex flex-col items-center text-center">
                         <div className="w-12 h-12 bg-indigo-950/30 border border-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                            <FiActivity size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">Executions</h3>
                        <p className="text-xs text-slate-500 font-mono leading-relaxed">
                            Monitor live system activity and past run logs.
                        </p>
                    </Link>

                    {/* Admin Console Card (Conditional) */}
                    {isAdmin && (
                        <Link to="/admin/audit-logs" className="group relative bg-[#050b14] border border-red-500/20 rounded-xl p-6 hover:border-red-500/50 hover:bg-red-950/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(239,68,68,0.2)] flex flex-col items-center text-center">
                             <div className="w-12 h-12 bg-red-950/30 border border-red-500/20 rounded-lg flex items-center justify-center text-red-400 mb-4 group-hover:scale-110 transition-transform">
                                <FiShield size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-red-300 transition-colors">Admin Logs</h3>
                            <p className="text-xs text-slate-500 font-mono leading-relaxed">
                                Review system security and audit trails.
                            </p>
                        </Link>
                    )}
                </div>

                {/* 3. Recent Local Activity */}
                <div className="max-w-5xl w-full animate-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 flex items-center gap-2">
                             <FiCpu /> {isAdmin ? 'Recent System Audit' : 'Recent Executions'}
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>
                    
                    <div className="grid gap-2">
                        {activities.map((activity) => (
                             <div key={activity.id} className="group flex items-center justify-between p-3 bg-[#050b14] border-l-2 border-l-white/10 border-y border-r border-white/5 hover:border-l-cyan-500 hover:bg-white/[0.02] transition-colors cursor-default">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-mono text-slate-500 w-20">{activity.timestamp}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                                            activity.type === 'system' ? 'bg-purple-900/30 text-purple-400' :
                                            activity.type === 'execution' ? 'bg-emerald-900/30 text-emerald-400' :
                                            'bg-blue-900/30 text-blue-400'
                                        }`}>
                                            {activity.type}
                                        </span>
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                            {activity.action}: <span className="font-mono text-cyan-500/80">{activity.target}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-[10px] font-mono text-slate-600 group-hover:text-cyan-700 opacity-0 group-hover:opacity-100 transition-all">
                                    ID: #{activity.id}
                                </div>
                            </div>
                        ))}
                        
                        {activities.length === 0 && (
                            <div className="text-center py-6 text-slate-600 font-mono text-xs uppercase tracking-widest">
                                No recent activity recorded.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Deco */}
                <div className="mt-20 text-center opacity-30">
                    <p className="text-[9px] text-cyan-900 font-mono uppercase tracking-[0.5em]">
                        BankFlow Platform Baseline
                    </p>
                </div>
            </div>
        </div>
    );
}
