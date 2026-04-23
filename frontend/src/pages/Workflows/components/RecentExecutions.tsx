import React, { useEffect, useState } from 'react';
import { FiCheck, FiX, FiActivity, FiZap, FiUser, FiClock, FiChevronRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../../../contexts/AuthContext';
import { config } from '../../../config/appConfig';

type ExecutionSummary = {
    id: number;
    status: 'completed' | 'failed' | 'running' | 'engine_error';
    trigger_type: string;
    started_at: string;
    duration_ms: number | null;
};

const RecentExecutions: React.FC<{ workflowId: number }> = ({ workflowId }) => {
    const navigate = useNavigate();
    const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const token = getAuthToken();
                const headers: Record<string, string> = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const res = await fetch(`${config.apiBaseUrl}/workflows/${workflowId}/executions?limit=3`, { headers });
                if (res.ok) {
                    const json = await res.json();
                    const data = json.data || json;
                    const list = Array.isArray(data) ? data : [];
                    if (active) setExecutions(list.slice(0, 3));
                } else {
                    if (active) setExecutions([]);
                }
            } catch (e) {
                console.error("Failed to load executions", e);
                if (active) setExecutions([]);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [workflowId]);

    if (loading) return <div className="text-slate-500 text-xs animate-pulse">Loading runs...</div>;

    const getTriggerIcon = (type: string) => {
        switch(type.toLowerCase()) {
            case 'manual': return <FiUser size={10} />;
            case 'webhook': return <FiZap size={10} />;
            case 'schedule': return <FiClock size={10} />;
            default: return <FiActivity size={10} />;
        }
    };

    const getTriggerStyle = (type: string) => {
         switch(type.toLowerCase()) {
            case 'manual': return 'border-blue-500/30 text-blue-300 bg-blue-500/10';
            case 'webhook': return 'border-amber-500/30 text-amber-300 bg-amber-500/10';
            case 'schedule': return 'border-purple-500/30 text-purple-300 bg-purple-500/10';
            default: return 'border-slate-500/30 text-slate-300 bg-slate-500/10';
        }
    };

    return (
        <div className="space-y-3">
             <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Activity</h3>
                <button 
                    onClick={() => navigate('/executions')} 
                    className="text-[10px] font-medium text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                >
                    View History <FiChevronRight />
                </button>
            </div>
            
            <div className="space-y-1">
                {executions.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs uppercase tracking-widest">
                        No executions yet
                    </div>
                ) : executions.map((ex) => (
                    <div 
                        key={ex.id}
                        onClick={() => navigate(`/executions/${ex.id}`)}
                        className="group flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5"
                    >
                        <div className="flex items-center gap-3">
                            {/* Status Icon */}
                            <div className={`
                                w-6 h-6 rounded-full flex items-center justify-center border shadow-sm
                                ${ex.status === 'completed' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : ''}
                                ${ex.status === 'failed' || ex.status === 'engine_error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : ''}
                                ${ex.status === 'running' ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 animate-pulse' : ''}
                            `}>
                                {ex.status === 'completed' && <FiCheck size={12} />}
                                {(ex.status === 'failed' || ex.status === 'engine_error') && <FiX size={12} />}
                                {ex.status === 'running' && <div className="w-1.5 h-1.5 bg-current rounded-full" />}
                            </div>
                            
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                     <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                                        Run #{ex.id}
                                    </span>
                                    {/* Trigger Pill */}
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border ${getTriggerStyle(ex.trigger_type)}`}>
                                        {getTriggerIcon(ex.trigger_type)}
                                        <span>{ex.trigger_type}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                {new Date(ex.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                             <FiChevronRight className="text-slate-600 group-hover:text-white transition-colors w-3 h-3" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentExecutions;
