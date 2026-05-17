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
        <div className="flex flex-col h-full bg-[#07080a] border-r border-white/[0.08] relative z-30">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6b6c] group-focus-within:text-white transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search flows..." 
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-[#6a6b6c] focus:outline-none focus:border-white/[0.18] focus:ring-1 focus:ring-white/[0.18] transition-all"
                        />
                    </div>
                    
                    <div className="relative">
                        <select 
                            value={filterStatus}
                            onChange={(e) => onFilterChange(e.target.value as 'all' | 'active' | 'inactive')}
                            className="appearance-none bg-[#111214] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-[#9c9c9d] focus:outline-none focus:border-white/[0.18] cursor-pointer pr-7 hover:bg-[#1b1c1e] transition-colors"
                            style={{ colorScheme: 'dark' }} 
                        >
                            <option value="all" className="bg-[#111214]">All</option>
                            <option value="active" className="bg-[#111214]">Active</option>
                            <option value="inactive" className="bg-[#111214]">Inactive</option>
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#6a6b6c]">
                           <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1L5 5L9 1"/></svg>
                        </div>
                    </div>

                    <button 
                        onClick={onOpenTemplates}
                        className="size-9 bg-[#111214] hover:bg-[#1b1c1e] text-[#9c9c9d] hover:text-white flex items-center justify-center transition-all rounded-lg border border-white/[0.08]"
                        title="Use Template"
                    >
                        <LuLayoutTemplate size={16} />
                    </button>
                    
                    <button 
                        onClick={onCreate}
                        disabled={isCreating}
                        className="size-9 bg-[#e6e6e6] hover:bg-white text-[#040506] flex items-center justify-center transition-all rounded-lg disabled:opacity-50"
                        title="Create New Flow"
                    >
                         {isCreating ? <div className="animate-spin size-4 border-2 border-[#040506]/30 border-t-[#040506] rounded-full" /> : <FiPlus size={18} />}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
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
                    <div className="flex flex-col items-center justify-center py-16 text-[#6a6b6c] gap-2">
                        <div className="size-10 rounded-full bg-white/[0.03] flex items-center justify-center mb-2">
                            <FiSearch size={18} className="opacity-50" />
                        </div>
                        <p className="text-sm font-medium">No flows found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlowListSidebar;
