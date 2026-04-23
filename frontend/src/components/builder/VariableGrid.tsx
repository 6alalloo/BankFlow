import React, { useState } from 'react';
import { LuUser, LuMail, LuPhone, LuBuilding, LuBriefcase, LuFileText, LuCopy, LuCheck, LuHash, LuCalendar } from 'react-icons/lu';

export interface TriggerVariable {
    label: string;
    value: string;
    icon: React.ReactNode;
    group: 'case' | 'routing' | 'meta';
}

export const TRIGGER_VARIABLES: TriggerVariable[] = [
    // Case Group
    { label: 'Case Name', value: '{{trigger.name}}', icon: <LuUser className="w-3 h-3" />, group: 'case' },
    { label: 'Contact Email', value: '{{trigger.email}}', icon: <LuMail className="w-3 h-3" />, group: 'case' },
    { label: 'Phone Number', value: '{{trigger.phone}}', icon: <LuPhone className="w-3 h-3" />, group: 'case' },
    { label: 'Document URL', value: '{{trigger.resume_url}}', icon: <LuFileText className="w-3 h-3" />, group: 'case' },
    
    // Routing Group
    { label: 'Queue', value: '{{trigger.department}}', icon: <LuBuilding className="w-3 h-3" />, group: 'routing' },
    { label: 'Custom Queue', value: '{{trigger.customDepartment}}', icon: <LuBuilding className="w-3 h-3" />, group: 'routing' },
    { label: 'Case Type', value: '{{trigger.role}}', icon: <LuBriefcase className="w-3 h-3" />, group: 'routing' },
    { label: 'Requested Date', value: '{{trigger.startDate}}', icon: <LuCalendar className="w-3 h-3" />, group: 'routing' },

    // Meta Group
    { label: 'Reference ID', value: '{{trigger.formId}}', icon: <LuHash className="w-3 h-3" />, group: 'meta' },
];

const VariableGrid: React.FC = () => {
    const [copiedValue, setCopiedValue] = useState<string | null>(null);

    const handleCopy = (value: string) => {
        navigator.clipboard.writeText(value);
        setCopiedValue(value);
        setTimeout(() => setCopiedValue(null), 2000);
    };

    return (
        <div className="space-y-4">
             {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                <p className="text-xs text-blue-200">
                    Click any variable below to copy it to your clipboard. You can paste these into any "Custom" field.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {TRIGGER_VARIABLES.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => handleCopy(item.value)}
                        className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-navy-900 hover:bg-white/5 hover:border-cyan-glow/50 transition-all text-left group relative overflow-hidden"
                    >
                        <div className={`p-1.5 rounded-md bg-white/5 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-400/10 transition-colors`}>
                            {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                                {item.label}
                            </div>
                        </div>
                        
                        {/* Status Icon */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                             {copiedValue === item.value ? (
                                <LuCheck className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <LuCopy className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                        </div>
                       
                        {/* Copied Flash Effect */}
                        {copiedValue === item.value && (
                            <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default VariableGrid;
