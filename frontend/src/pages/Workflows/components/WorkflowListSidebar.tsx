import React from 'react';
import { FiSearch, FiPlus } from 'react-icons/fi';
import { LuLayoutTemplate } from 'react-icons/lu';
import type { WorkflowApi } from '../../../api/workflows';
import WorkflowCard from './WorkflowCard';

type WorkflowListSidebarProps = {
    workflows: WorkflowApi[];
    activeWorkflowId: number | null;
    onSelect: (id: number) => void;
    onCreate: () => void;
    onOpenTemplates: () => void;
    isCreating: boolean;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    filterStatus: 'all' | 'active' | 'inactive';
    onFilterChange: (s: 'all' | 'active' | 'inactive') => void;
};

const WorkflowListSidebar: React.FC<WorkflowListSidebarProps> = ({
    workflows,
    activeWorkflowId,
    onSelect,
    onCreate,
    onOpenTemplates,
    isCreating,
    searchQuery,
    onSearchChange,
    filterStatus,
    onFilterChange
}) => {
    // 1. Filter Logic
    const filtered = workflows.filter(wf => {
        // Status Filter
        if (filterStatus === 'active' && !wf.is_active) return false;
        if (filterStatus === 'inactive' && wf.is_active) return false;

        // Search Filter
        const q = searchQuery.toLowerCase();
        return (
            wf.name.toLowerCase().includes(q) ||
            (wf.description || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="flex flex-col h-full bg-navy-950/80 backdrop-blur-xl border-r border-white/5 relative z-30">
            {/* Header / Toolbar */}
            <div className="p-4 border-b border-white/5 space-y-4">
                {/* Search & Filters Row */}
                <div className="flex items-center gap-3">
                    {/* Search Bar - Wide */}
                    <div className="relative flex-1 group">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-700 group-focus-within:text-cyan-400 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="SEARCH" 
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-black/40 border border-cyan-900/30 rounded-none pl-9 pr-3 py-2 text-xs font-mono text-cyan-100 placeholder:text-cyan-900/50 focus:outline-none focus:border-cyan-500/50 focus:bg-black/60 focus:ring-1 focus:ring-cyan-500/20 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all uppercase tracking-wider"
                        />
                    </div>
                    
                    {/* Status Dropdown */}
                    <div className="relative">
                        <select 
                            value={filterStatus}
                            onChange={(e) => onFilterChange(e.target.value as 'all' | 'active' | 'inactive')}
                            className="appearance-none bg-[#020617] border border-cyan-900/30 rounded-none px-4 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 cursor-pointer pr-8 hover:bg-cyan-950/20 transition-colors uppercase tracking-widest"
                            style={{ colorScheme: 'dark' }} 
                        >
                            <option value="all" className="bg-[#020617] text-cyan-400">ALL STATUS</option>
                            <option value="active" className="bg-[#020617] text-cyan-400">ONLINE</option>
                            <option value="inactive" className="bg-[#020617] text-cyan-400">OFFLINE</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-700">
                           <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1"/></svg>
                        </div>
                    </div>

                     {/* Time Range (Functional Select) */}
                     <div className="relative hidden xl:block">
                        <select 
                            className="appearance-none bg-[#020617] border border-cyan-900/30 rounded-none px-4 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 cursor-pointer pr-8 hover:bg-cyan-950/20 transition-colors uppercase tracking-widest"
                            style={{ colorScheme: 'dark' }}
                        >
                            <option value="24h" className="bg-[#020617] text-cyan-400">24H RANGE</option>
                            <option value="7d" className="bg-[#020617] text-cyan-400">7 DAYS</option>
                            <option value="30d" className="bg-[#020617] text-cyan-400">30 DAYS</option>
                        </select>
                         <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-700">
                             <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1"/></svg>
                        </div>
                    </div>
                    
                    {/* Template Button */}
                    <button 
                        onClick={onOpenTemplates}
                        className="w-10 h-full min-h-[34px] bg-purple-600 hover:bg-purple-400 text-white flex items-center justify-center transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                        title="Use Template"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)' }}
                    >
                        <LuLayoutTemplate size={18} />
                    </button>
                    
                    {/* Create Button (Futuristic) */}
                    <button 
                        onClick={onCreate}
                        disabled={isCreating}
                        className="w-10 h-full min-h-[34px] bg-cyan-600 hover:bg-cyan-400 text-black flex items-center justify-center transition-all disabled:opacity-50 hover:shadow-[0_0_15px_rgba(34,211,238,0.6)]"
                        title="Create New Workflow"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)' }}
                    >
                         {isCreating ? <div className="animate-spin w-4 h-4 border-2 border-black/30 border-t-black rounded-full" /> : <FiPlus size={20} className="stroke-[3px]" />}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {filtered.length > 0 ? (
                    filtered.map(wf => (
                        <WorkflowCard 
                            key={wf.id}
                            workflow={wf}
                            isActive={wf.id === activeWorkflowId}
                            onClick={() => onSelect(wf.id)}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600 gap-2">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
                            <FiSearch size={20} opacity={0.5} />
                        </div>
                        <p className="text-sm font-medium">No workflows found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkflowListSidebar;
