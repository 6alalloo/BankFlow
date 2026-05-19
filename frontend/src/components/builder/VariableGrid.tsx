/* eslint-disable react-refresh/only-export-components */
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
    { label: 'Case Name', value: '{{trigger.name}}', icon: <LuUser className="size-3" />, group: 'case' },
    { label: 'Contact Email', value: '{{trigger.email}}', icon: <LuMail className="size-3" />, group: 'case' },
    { label: 'Phone Number', value: '{{trigger.phone}}', icon: <LuPhone className="size-3" />, group: 'case' },
    { label: 'Document URL', value: '{{trigger.resume_url}}', icon: <LuFileText className="size-3" />, group: 'case' },
    
    // Routing Group
    { label: 'Queue', value: '{{trigger.department}}', icon: <LuBuilding className="size-3" />, group: 'routing' },
    { label: 'Custom Queue', value: '{{trigger.customDepartment}}', icon: <LuBuilding className="size-3" />, group: 'routing' },
    { label: 'Case Type', value: '{{trigger.role}}', icon: <LuBriefcase className="size-3" />, group: 'routing' },
    { label: 'Requested Date', value: '{{trigger.startDate}}', icon: <LuCalendar className="size-3" />, group: 'routing' },

    // Meta Group
    { label: 'Reference ID', value: '{{trigger.formId}}', icon: <LuHash className="size-3" />, group: 'meta' },
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
            <div className="bg-[#0071e3]/5 border border-[#0071e3]/20 rounded-[10px] p-3">
                <p className="text-xs text-[#0071e3]">
                    Click any variable below to copy it to your clipboard. You can paste these into any "Custom" field.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {TRIGGER_VARIABLES.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => handleCopy(item.value)}
                        className="flex items-center gap-2 p-2 rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] hover:bg-[#f2f2f4] hover:border-[#0071e3]/30 transition-all text-left group relative overflow-hidden"
                    >
                        <div className={`p-1.5 rounded-[6px] bg-[#0f1012]/[0.04] text-[#868788] group-hover:text-[#0071e3] group-hover:bg-[#0071e3]/5 transition-colors`}>
                            {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[#8f8f8f] group-hover:text-[#0f1012] truncate">
                                {item.label}
                            </div>
                        </div>
                        
                        {/* Status Icon */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                             {copiedValue === item.value ? (
                                <LuCheck className="size-4 text-[#1b5e20]" />
                            ) : (
                                <LuCopy className="size-3.5 text-[#868788] opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                        </div>
                       
                        {/* Copied Flash Effect */}
                        {copiedValue === item.value && (
                            <div className="absolute inset-0 bg-[#1b5e20]/5 animate-pulse" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default VariableGrid;
