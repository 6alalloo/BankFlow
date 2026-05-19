import React from 'react';
import { FiSearch, FiPlus } from 'react-icons/fi';
import { LuLayoutTemplate } from 'react-icons/lu';
import type { FlowApi } from '../../../api/flows';
import FlowCard from './FlowCard';

type FlowListSidebarProps = {
    flows: FlowApi[];
    activeFlowId: number | null;
    onSelect: (id: number) => void;
    onCreate: () => void;
    onOpenTemplates: () => void;
    isCreating: boolean;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    filterStatus: 'all' | 'active' | 'inactive';
    onFilterChange: (s: 'all' | 'active' | 'inactive') => void;
};

const FlowListSidebar: React.FC<FlowListSidebarProps> = ({
    flows,
    activeFlowId,
    onSelect,
    onCreate,
    onOpenTemplates,
    isCreating,
    searchQuery,
    onSearchChange,
    filterStatus,
    onFilterChange
}) => {
    const filtered = flows.filter(wf => {
        if (filterStatus === 'active' && !wf.is_active) return false;
        if (filterStatus === 'inactive' && wf.is_active) return false;
        const q = searchQuery.toLowerCase();
        return (
            wf.name.toLowerCase().includes(q) ||
            (wf.description || '').toLowerCase().includes(q)
        );
    });

    return (
        <div className="flex flex-col h-full bg-[#fdfdfd]/80 border-r border-[#0f1012]/[0.06] relative z-30">
            {/* Header */}
            <div className="p-4 border-b border-[#0f1012]/[0.06] space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#868788] group-focus-within:text-[#0f1012] transition-colors" size={14} strokeWidth={1.5} />
                        <input 
                            type="text" 
                            placeholder="Search flows..." 
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-[#0f1012]/[0.04] border border-[#0f1012]/[0.08] rounded-[10px] pl-9 pr-3 py-2 text-xs text-[#0f1012] placeholder:text-[#868788] focus:outline-none focus:border-[#0f1012]/[0.18] focus:ring-1 focus:ring-[#0071e3]/20 transition-all"
                        />
                    </div>
                    
                    <div className="relative">
                        <select 
                            value={filterStatus}
                            onChange={(e) => onFilterChange(e.target.value as 'all' | 'active' | 'inactive')}
                            className="appearance-none bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[10px] px-3 py-2 text-xs text-[#8f8f8f] focus:outline-none focus:border-[#0f1012]/[0.18] cursor-pointer pr-7 hover:bg-[#fdfdfd] transition-colors"
                        >
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#868788]">
                           <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1"/></svg>
                        </div>
                    </div>

                    <button 
                        onClick={onOpenTemplates}
                        className="size-9 bg-[#0f1012]/[0.04] hover:bg-[#0f1012]/[0.07] text-[#8f8f8f] hover:text-[#0f1012] flex items-center justify-center transition-all rounded-[10px] border border-[#0f1012]/[0.08]"
                        title="Use Template"
                    >
                        <LuLayoutTemplate size={16} />
                    </button>
                    
                    <button 
                        onClick={onCreate}
                        disabled={isCreating}
                        className="size-9 bg-[#0f1012] hover:bg-[#020201] text-white flex items-center justify-center transition-all rounded-[10px] disabled:opacity-50"
                        title="Create New Flow"
                    >
                         {isCreating ? <div className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full" /> : <FiPlus size={18} strokeWidth={2.5} />}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5 custom-scrollbar">
                {filtered.length > 0 ? (
                    filtered.map(wf => (
                        <FlowCard 
                            key={wf.id}
                            flow={wf}
                            isActive={wf.id === activeFlowId}
                            onClick={() => onSelect(wf.id)}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-[#868788] gap-2">
                        <div className="size-10 rounded-full bg-[#0f1012]/[0.03] flex items-center justify-center mb-2">
                            <FiSearch size={18} className="opacity-50" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-normal">No flows found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlowListSidebar;
