import { useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { createWorkflow, createWorkflowNode, createWorkflowEdge } from "../../api/workflows";
import { apiGet } from "../../api/apiClient";
import { fetchDashboardStats, fetchDashboardCharts, type DashboardStats, type ChartData } from "../../api/dashboard";
import StatCard from "../../components/Dashboard/DashboardStatCard";
import { ActivityChart, StatusChart, VolumeChart } from "../../components/Dashboard/DashboardCharts";
import TemplatePreviewModal from "../../components/TemplatePreviewModal";
import { templates, type WorkflowTemplate } from "../../data/templates";
import {
    FiPlusCircle,
    FiActivity,
    FiShield,
    FiCpu,
    FiClock,
    FiUsers,
    FiLayers,
    FiCheckCircle,
    FiXCircle,
    FiBarChart2,
    FiFileText,
    FiArrowRight
} from "react-icons/fi";
import {
    LuZap,
    LuMail,
    LuGlobe,
    LuSplit,
    LuDatabase,
    LuClock,
    LuCalendar,
    LuTerminal,
    LuBox,
} from "react-icons/lu";
import type { IconType } from "react-icons";

interface RecentActivity {
    id: number;
    action: string;
    target: string;
    timestamp: string;
    type: 'workflow' | 'execution' | 'system';
    status?: string;
    duration?: string;
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

function calculateDuration(durationMs?: number | null, start?: string | null, end?: string | null): string {
    let seconds = 0;
    
    if (typeof durationMs === 'number') {
        seconds = Math.floor(durationMs / 1000);
    } else if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    } else {
        return '...';
    }
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

// Format duration from milliseconds to human readable
function formatDurationFromMs(ms: number): string {
    if (ms <= 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

const nodeIconMap: Record<string, { icon: IconType; color: string }> = {
    trigger: { icon: LuZap, color: 'text-yellow-400' },
    email: { icon: LuMail, color: 'text-blue-400' },
    http: { icon: LuGlobe, color: 'text-green-400' },
    condition: { icon: LuSplit, color: 'text-purple-400' },
    database: { icon: LuDatabase, color: 'text-rose-400' },
    variable: { icon: LuBox, color: 'text-teal-400' },
    wait: { icon: LuClock, color: 'text-amber-400' },
    datetime: { icon: LuCalendar, color: 'text-orange-400' },
    logger: { icon: LuTerminal, color: 'text-slate-300' },
};

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role?.name === 'Admin';
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activities, setActivities] = useState<RecentActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Template modal state
    const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);

    // Stats State
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        activeWorkflows: 0,
        executions24h: 0,
        totalExecutions: 0,
        avgDurationMs: 0,
        executionsByStatus: {
            completed: 0,
            failed: 0,
            running: 0,
            engine_error: 0,
        },
    });

    // Chart Data State
    const [chartData, setChartData] = useState<ChartData>({
        activityByHour: [],
        volumeByDay: [],
        statusBreakdown: [],
    });

    const handleCreateWorkflow = async () => {
        try {
            const newWorkflow = await createWorkflow({ name: "Untitled Workflow" });
            // Auto-add trigger node
            await createWorkflowNode(newWorkflow.id, { kind: 'trigger', posX: 200, posY: 200 });
            navigate(`/workflows/${newWorkflow.id}/builder`);
        } catch (error) {
            console.error("Failed to create workflow", error);
        }
    };

    const handlePreviewTemplate = (template: WorkflowTemplate) => {
        setSelectedTemplate(template);
        setIsTemplateModalOpen(true);
    };

    const handleUseTemplate = async (template: WorkflowTemplate) => {
        try {
            setIsCreatingFromTemplate(true);

            // Create new workflow with template name
            const newWorkflow = await createWorkflow({ name: template.name, description: template.description });
            const workflowId = newWorkflow.id;

            // Create a mapping of template node IDs to actual node IDs
            const nodeIdMap: Record<string, number> = {};

            // Add nodes from template
            for (const templateNode of template.nodes) {
                const nodeResponse = await createWorkflowNode(workflowId, {
                    kind: templateNode.kind,
                    name: templateNode.name,
                    posX: templateNode.pos_x,
                    posY: templateNode.pos_y,
                    config: templateNode.config,
                });
                nodeIdMap[templateNode.id] = nodeResponse.id;
            }

            // Add edges from template
            for (const templateEdge of template.edges) {
                const fromNodeId = nodeIdMap[templateEdge.from];
                const toNodeId = nodeIdMap[templateEdge.to];

                if (fromNodeId && toNodeId) {
                    await createWorkflowEdge(workflowId, {
                        fromNodeId: fromNodeId,
                        toNodeId: toNodeId,
                        label: templateEdge.label,
                        condition: templateEdge.condition,
                    });
                }
            }

            setIsTemplateModalOpen(false);
            navigate(`/workflows/${workflowId}/builder`);
        } catch (error) {
            console.error("Failed to create workflow from template", error);
        } finally {
            setIsCreatingFromTemplate(false);
        }
    };

    // Clock effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);

                // Fetch stats and charts from backend (handles admin vs operator based on user role)
                const [dashboardStats, charts] = await Promise.all([
                    fetchDashboardStats(),
                    fetchDashboardCharts(),
                ]);

                setStats(dashboardStats);
                setChartData(charts);

                // Fetch recent activities based on role
                if (isAdmin) {
                    // Admin: Fetch Audit Logs for recent system events
                    const res = await apiGet<{ data: ApiAuditLog[] }>('/audit?limit=5');
                    const mapped = res.data.map((log) => ({
                        id: log.id,
                        action: log.action.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        target: log.entity_type ? `${log.entity_type} #${log.entity_id}` : 'System',
                        timestamp: formatTimeAgo(log.created_at),
                        type: 'system' as const
                    }));
                    setActivities(mapped);
                } else {
                    // Operator: Fetch recent executions for activity feed
                    const execRes = await apiGet<{ id: number; status: string; started_at: string; duration_ms?: number; finished_at?: string; workflows?: { name: string } }[]>('/executions?limit=5');
                    const mapped = execRes.map((ex) => ({
                        id: ex.id,
                        action: `Execution ${ex.status}`,
                        target: ex.workflows?.name || 'Untitled Workflow',
                        timestamp: formatTimeAgo(ex.started_at || new Date()),
                        type: 'execution' as const,
                        status: ex.status,
                        duration: ex.status === 'completed' ? calculateDuration(ex.duration_ms, ex.started_at, ex.finished_at) : undefined
                    }));
                    setActivities(mapped);
                }
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchData();
            
            // Auto-refresh every 5 minutes (300000ms) per requirement N14
            const refreshInterval = setInterval(() => {
                fetchData();
            }, 300000); // 5 minutes

            return () => clearInterval(refreshInterval);
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
            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-6 md:p-8 pt-16">
                
                {/* 1. Header Section */}
                <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row items-end justify-between gap-6 border-b border-white/5 pb-6">
                    <div>
                         <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-1">
                            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{user?.full_name?.split(' ')[0] || 'User'}</span>
                         </h1>
                    </div>

                    <div className="text-right">
                        <div className="flex items-center justify-end gap-3 text-2xl font-mono text-white font-light tracking-widest">
                            <FiClock className="text-cyan-800" />
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-cyan-900 font-mono text-[10px] tracking-[0.3em] uppercase mt-1">
                            {currentTime.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>
                </div>

                {/* 2. Admin View: "The Data Deck" */}
                {isAdmin ? (
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 grid-rows-[auto_auto] gap-6 animate-in slide-in-from-bottom-4 duration-700">
                        {/* Row 1: Key Metrics */}
                        <StatCard
                            title="Total Users"
                            value={isLoading ? "..." : stats.totalUsers}
                            icon={FiUsers}
                            trend="neutral"
                            trendValue="All Users"
                            color="blue"
                        />
                        <StatCard
                            title="Active Workflows"
                            value={isLoading ? "..." : stats.activeWorkflows}
                            icon={FiLayers}
                            trend="neutral"
                            trendValue="Online"
                            color="cyan"
                        />
                        <StatCard
                            title="Avg. Duration"
                            value={isLoading ? "..." : formatDurationFromMs(stats.avgDurationMs)}
                            icon={FiClock}
                            trend="neutral"
                            trendValue="Per Exec"
                            color="purple"
                        />
                        <StatCard
                            title="24h Executions"
                            value={isLoading ? "..." : stats.executions24h}
                            icon={FiActivity}
                            trend="neutral"
                            trendValue="Today"
                            color="emerald"
                        />

                        {/* Row 2: Charts & Actions */}
                        <div className="md:col-span-3 bg-[#050b14] border border-white/5 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
                           <div className="flex items-center justify-between mb-6">
                                <h3 className="text-white font-mono text-sm uppercase tracking-widest flex items-center gap-2">
                                    <FiActivity className="text-cyan-500" />
                                    System Load (24h)
                                </h3>
                                <div className="flex gap-2">
                                    <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
                                    <span className="text-[10px] font-mono text-cyan-500">LIVE</span>
                                </div>
                           </div>
                           <ActivityChart data={chartData.activityByHour.map(h => ({ name: h.hour, value: h.count }))} color="#06b6d4" />
                        </div>

                        <div className="md:col-span-1 grid grid-rows-2 gap-6">
                            {/* Quick Action: Audit Logs */}
                            <Link to="/admin/audit-logs" className="bg-[#050b14] border border-red-500/20 rounded-xl p-6 hover:border-red-500/50 hover:bg-red-950/10 transition-all flex flex-col justify-center items-center text-center group">
                                <FiShield className="text-3xl text-red-500 mb-3 group-hover:scale-110 transition-transform" />
                                <h3 className="text-red-400 font-bold mb-1">Audit Logs</h3>
                                <p className="text-[10px] text-slate-500 font-mono">View Security Events</p>
                            </Link>

                             {/* Quick Action: New Workflow */}
                            <div onClick={handleCreateWorkflow} className="bg-[#050b14] border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-500/50 hover:bg-cyan-950/10 transition-all flex flex-col justify-center items-center text-center group cursor-pointer">
                                <FiPlusCircle className="text-3xl text-cyan-500 mb-3 group-hover:scale-110 transition-transform" />
                                <h3 className="text-cyan-400 font-bold mb-1">New Workflow</h3>
                                <p className="text-[10px] text-slate-500 font-mono">Deploy Protocol</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    // 3. Operator View: Personal Dashboard
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-700">
                        {/* Column 1: Stats */}
                        <div className="space-y-6">
                            <StatCard
                                title="My Executions"
                                value={isLoading ? "..." : stats.totalExecutions}
                                icon={FiActivity}
                                trend="neutral"
                                trendValue="Total"
                                color="blue"
                            />
                            <StatCard
                                title="Success Rate"
                                value={isLoading ? "..." : `${stats.totalExecutions > 0 ? Math.round((stats.executionsByStatus.completed / stats.totalExecutions) * 100) : 0}%`}
                                icon={FiCheckCircle}
                                trend={stats.executionsByStatus.completed > stats.executionsByStatus.failed ? 'up' : 'down'}
                                trendValue={stats.executionsByStatus.completed > stats.executionsByStatus.failed ? 'Good' : 'Attn'}
                                color={stats.executionsByStatus.completed > stats.executionsByStatus.failed ? 'emerald' : 'rose'}
                            />
                            <StatCard
                                title="Avg. Duration"
                                value={isLoading ? "..." : formatDurationFromMs(stats.avgDurationMs)}
                                icon={FiClock}
                                trend="neutral"
                                trendValue="Per Exec"
                                color="purple"
                            />
                        </div>

                         {/* Column 2: Status Chart & Volume */}
                        <div className="bg-[#050b14] border border-white/5 rounded-xl p-6 flex flex-col gap-6">
                            {/* Execution Status */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                     <h3 className="text-white font-mono text-sm uppercase tracking-widest flex items-center gap-2">
                                        <FiActivity className="text-indigo-400" />
                                        Execution Status
                                    </h3>
                                    <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-1 rounded">
                                        Last 7 Days
                                    </span>
                                </div>
                                <StatusChart data={chartData.statusBreakdown} />
                            </div>

                            {/* Daily Volume (Bottom Connector) */}
                             <div className="border-t border-white/5 pt-4">
                                <h3 className="text-white font-mono text-[10px] uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <FiBarChart2 className="text-sky-400" />
                                    Weekly Volume
                                </h3>
                                <VolumeChart data={chartData.volumeByDay.map(d => ({ name: d.day, value: d.count }))} />
                            </div>
                        </div>

                        {/* Column 3: Recent Activity Feed */}
                        <div className="bg-[#050b14] border border-white/5 rounded-xl p-1 flex flex-col h-full min-h-[300px]">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-white font-mono text-sm uppercase tracking-widest flex items-center gap-2">
                                    <FiCpu className="text-slate-400" />
                                    Live Feed
                                </h3>
                                <Link to="/executions" className="text-[10px] text-cyan-500 hover:text-cyan-400 font-mono uppercase">View All</Link>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {activities.map((activity) => (
                                     <div key={activity.id} className="group flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-default">
                                        {/* Status Icon */}
                                        <div className="shrink-0">
                                            {activity.status === 'completed' ? (
                                                <FiCheckCircle className="text-emerald-500 text-lg" />
                                            ) : activity.status === 'failed' ? (
                                                <FiXCircle className="text-rose-500 text-lg" />
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_#06b6d4] ml-1" />
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-200 truncate group-hover:text-white transition-colors">
                                                {activity.action}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-mono truncate">
                                                {activity.target}
                                            </p>
                                        </div>
                                        
                                        <div className="text-right">
                                            <div className="text-[9px] text-slate-600 font-mono whitespace-nowrap group-hover:text-slate-400">
                                                {activity.timestamp.replace(' ago', '')}
                                            </div>
                                            {activity.duration && (
                                                <div className="text-[9px] text-indigo-400 font-mono whitespace-nowrap mt-0.5">
                                                    {activity.duration}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {activities.length === 0 && (
                                    <div className="text-center py-10 text-slate-600 font-mono text-xs uppercase">No Activity</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 4. Common Recent (Expanded) if Admin */}
                {isAdmin && (
                    <div className="max-w-7xl mx-auto mt-6 bg-[#050b14] border border-white/5 rounded-xl p-1">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                             <h3 className="text-white font-mono text-sm uppercase tracking-widest flex items-center gap-2">
                                <FiActivity className="text-slate-400" />
                                Recent System Events
                            </h3>
                             <Link to="/admin/audit-logs" className="text-[10px] text-cyan-500 hover:text-cyan-400 font-mono uppercase">Full History</Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2">
                            {activities.map((activity) => (
                                <div key={activity.id} className="flex items-center gap-3 p-3 rounded- border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
                                    <span className="text-[10px] font-mono text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded">SYS</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-300 truncate">{activity.action}</p>
                                        <p className="text-[10px] text-slate-600 font-mono truncate">{activity.target}</p>
                                    </div>
                                    <span className="text-[9px] text-slate-600 font-mono">{activity.timestamp}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                 {/* 5. Quick Start Templates Section */}
                <div className="max-w-7xl mx-auto mt-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <FiFileText className="text-cyan-500" />
                                Quick Start Templates
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Start with a banking-oriented starter flow and adapt it to your operating model
                            </p>
                        </div>
                        <Link
                            to="/workflows"
                            className="text-xs text-cyan-500 hover:text-cyan-400 font-mono uppercase flex items-center gap-1"
                        >
                            All Workflows <FiArrowRight className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="group bg-[#050b14] border border-white/5 rounded-xl p-5 hover:border-cyan-500/30 hover:bg-cyan-950/5 transition-all cursor-pointer"
                                onClick={() => handlePreviewTemplate(template)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                            template.category === 'hr'
                                                ? 'bg-blue-500/10 text-blue-400'
                                                : template.category === 'it'
                                                ? 'bg-green-500/10 text-green-400'
                                                : 'bg-slate-500/10 text-slate-400'
                                        }`}
                                    >
                                        {template.category}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-mono">
                                        {template.nodes.length} steps
                                    </span>
                                </div>
                                <h3 className="text-white font-semibold mb-2 group-hover:text-cyan-400 transition-colors">
                                    {template.name}
                                </h3>
                                <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                                    {template.description}
                                </p>
                                <div className="flex items-center justify-between">
                                    <div className="flex -space-x-1">
                                        {template.nodes.slice(0, 4).map((node) => {
                                            const nodeConfig = nodeIconMap[node.kind] ?? { icon: LuBox, color: 'text-slate-400' };
                                            const NodeIcon = nodeConfig.icon;
                                            return (
                                                <div
                                                    key={node.id}
                                                    className="w-6 h-6 rounded-full bg-navy-900 border border-white/10 flex items-center justify-center"
                                                    title={node.name}
                                                >
                                                    <NodeIcon className={`w-3.5 h-3.5 ${nodeConfig.color}`} />
                                                </div>
                                            );
                                        })}
                                        {template.nodes.length > 4 && (
                                            <div className="w-6 h-6 rounded-full bg-navy-900 border border-white/10 flex items-center justify-center text-[10px] text-slate-400">
                                                +{template.nodes.length - 4}
                                            </div>
                                        )}
                                    </div>
                                    <button className="text-xs text-cyan-500 hover:text-cyan-400 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Preview <FiArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Create Blank Workflow Card */}
                        <div
                            className="group bg-[#050b14] border border-dashed border-white/10 rounded-xl p-5 hover:border-cyan-500/30 hover:bg-cyan-950/5 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[180px]"
                            onClick={handleCreateWorkflow}
                        >
                            <FiPlusCircle className="text-3xl text-slate-600 group-hover:text-cyan-500 transition-colors mb-3" />
                            <h3 className="text-white font-semibold mb-1 group-hover:text-cyan-400 transition-colors">
                                Blank Workflow
                            </h3>
                            <p className="text-xs text-slate-500 text-center">
                                Start from scratch with an empty canvas
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Deco */}
                <div className="mt-12 text-center opacity-30">
                    <p className="text-[9px] text-cyan-900 font-mono uppercase tracking-[0.5em]">
                        BankFlow Platform Baseline
                    </p>
                </div>

            </div>

            {/* Template Preview Modal */}
            <TemplatePreviewModal
                isOpen={isTemplateModalOpen}
                template={selectedTemplate}
                onClose={() => setIsTemplateModalOpen(false)}
                onUseTemplate={handleUseTemplate}
            />
        </div>
    );
}
