import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
    LuMail,
    LuGlobe,
    LuDatabase,
    LuZap,
    LuSplit,
    LuClock,
    LuFileJson
} from 'react-icons/lu';
import clsx from 'clsx';
import { getFriendlyLabel, replaceExpressionsWithLabels } from '../../utils/expressionLabels';

const getIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
        case 'trigger': return <LuZap className="size-4 text-white" />;
        case 'email': return <LuMail className="size-4 text-[#9c9c9d]" />;
        case 'http': return <LuGlobe className="size-4 text-[#9c9c9d]" />;
        case 'condition': return <LuSplit className="size-4 text-[#9c9c9d]" />;
        case 'database': return <LuDatabase className="size-4 text-[#9c9c9d]" />;
        case 'wait': return <LuClock className="size-4 text-[#9c9c9d]" />;
        default: return <LuFileJson className="size-4 text-[#9c9c9d]" />;
    }
}

const PremiumNode = ({ data, selected }: NodeProps) => {
    const { name, kind, config } = data;

    const summary = React.useMemo(() => {
        if (!config) return "Click to configure";
        if (kind === 'email') {
            if (!config.to || config.to === '') return "Click to configure";
            const toLabel = getFriendlyLabel(String(config.to));
            return `To: ${toLabel}`;
        }
        if (kind === 'http') {
            const method = config.method || 'GET';
            const url = config.url ? String(config.url) : '';
            if (!url) return `${method} (configure URL)`;
            return `${method} ${url.length > 25 ? url.slice(0, 25) + '...' : url}`;
        }
        if (kind === 'condition') {
            if (!config.field) return "Click to configure";
            const fieldLabel = getFriendlyLabel(String(config.field));
            return `If ${fieldLabel} ${config.operator || ''}`;
        }
        if (kind === 'logger') {
            if (!config.message || config.message === '') return "Click to configure";
            const msg = replaceExpressionsWithLabels(String(config.message));
            return msg.length > 35 ? msg.slice(0, 35) + '...' : msg;
        }
        if (kind === 'database') {
            const table = config.table || '';
            const op = config.operation || '';
            if (!table && !op) return "Click to configure";
            return `${op} → ${table}`.trim();
        }
        if (kind === 'trigger') {
            const configuredFields = Object.entries(config).filter(
                ([, v]) => v !== '' && v !== null && v !== undefined
            ).length;
            if (configuredFields > 0) {
                return `${configuredFields} field(s) configured`;
            }
            return "Click to configure";
        }
        if (kind === 'variable') {
            if (Array.isArray(config.variables) && config.variables.length > 0) {
                return `${config.variables.length} variable(s) set`;
            }
            return "Click to configure";
        }
        if (kind === 'wait') {
            if (config.duration) {
                return `Wait ${config.duration} ${config.unit || 'seconds'}`;
            }
            return "Click to configure";
        }
        return config.description || "Click to configure";
    }, [config, kind]);

    return (
        <div className={clsx(
            "relative group transition-all duration-200 min-w-[220px]",
            "rounded-xl bg-[#111214] border",
            selected 
                ? "border-white/[0.18] shadow-[rgba(255,255,255,0.05)_0px_1px_0px_0px_inset,rgba(255,255,255,0.18)_0px_0px_0px_1px,rgba(0,0,0,0.2)_0px_-1px_0px_0px_inset]" 
                : "border-white/[0.08] hover:border-white/[0.14]"
        )}>
            <div className="relative p-3.5 flex flex-col gap-2 z-10">
                <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-2">
                    <div className="p-1.5 rounded-md bg-white/[0.05] border border-white/[0.08]">
                        {getIcon(kind)}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-[#6a6b6c] font-semibold">
                            {kind}
                        </span>
                        <span className="text-sm font-medium text-white leading-tight truncate">
                            {name || kind.charAt(0).toUpperCase() + kind.slice(1)}
                        </span>
                    </div>
                </div>

                <div className="text-[11px] text-[#6a6b6c] font-mono bg-[#07080a] rounded-md px-2 py-1.5 border border-white/[0.06] truncate">
                    {summary}
                </div>
            </div>

            <Handle 
                type="target" 
                position={Position.Left} 
                className="!size-2.5 !bg-[#6a6b6c] !border-2 !border-[#363739] opacity-0 group-hover:opacity-100 transition-opacity !-left-1.5"
                style={{ top: '50%' }}
            />
            <Handle 
                type="source" 
                position={Position.Right} 
                className="!size-2.5 !bg-white !border-2 !border-white/[0.18] opacity-0 group-hover:opacity-100 transition-opacity !-right-1.5"
                style={{ top: '50%' }}
            />
        </div>
    );
};

export default memo(PremiumNode);
