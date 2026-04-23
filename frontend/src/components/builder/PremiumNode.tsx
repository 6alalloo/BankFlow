
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

// Map node kinds to icons
const getIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
        case 'trigger': return <LuZap className="w-5 h-5 text-amber-400" />;
        case 'email': return <LuMail className="w-5 h-5 text-blue-400" />;
        case 'http': return <LuGlobe className="w-5 h-5 text-green-400" />;
        case 'condition': return <LuSplit className="w-5 h-5 text-purple-400" />;
        case 'database': return <LuDatabase className="w-5 h-5 text-rose-400" />;
        case 'wait': return <LuClock className="w-5 h-5 text-gray-400" />;
        default: return <LuFileJson className="w-5 h-5 text-cyan-400" />;
    }
}

const PremiumNode = ({ data, selected }: NodeProps) => {
    const { name, kind, config } = data;

    // Config summary generation with friendly labels
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
            // Replace expressions with friendly labels and truncate
            const msg = replaceExpressionsWithLabels(String(config.message));
            return msg.length > 35 ? msg.slice(0, 35) + '...' : msg;
        }
        if (kind === 'database') {
            const table = config.table || '';
            const op = config.operation || '';
            if (!table && !op) return "Click to configure";
            return `${op} → ${table}`.trim();
        }
        if (kind === 'cv_parser' || kind === 'cv_parse') {
            return "Parse uploaded CV";
        }
        if (kind === 'trigger') {
            // Count how many fields are configured
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
            "relative group transition-all duration-300 min-w-[240px]",
            "rounded-xl bg-navy-900/90 backdrop-blur-md border-[1.5px]",
            selected ? "border-cyan-glow shadow-glow-md scale-105" : "border-white/10 hover:border-white/20 shadow-lg"
        )}>
            {/* Glow backing */}
            <div className={clsx(
                "absolute -inset-0.5 rounded-xl opacity-0 transition-opacity duration-300",
                selected ? "bg-cyan-glow/20 opacity-100 blur-sm" : "group-hover:opacity-30 bg-white/5"
            )} />

            <div className="relative p-4 flex flex-col gap-2 z-10">
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                    <div className="p-2 rounded-lg bg-white/5 ring-1 ring-white/10">
                        {getIcon(kind)}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                            {kind}
                        </span>
                        <span className="text-sm font-bold text-white leading-tight">
                            {name || kind.charAt(0).toUpperCase() + kind.slice(1)}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="text-xs text-slate-400 font-mono bg-navy-950/50 rounded p-2 border border-white/5 truncate">
                    {summary}
                </div>
            </div>

            {/* Connection Handles - visible on hover for manual edge creation */}
            <Handle 
                type="target" 
                position={Position.Left} 
                className="!w-3 !h-3 !bg-slate-600 !border-2 !border-slate-400 opacity-0 group-hover:opacity-100 transition-opacity !-left-1.5"
                style={{ top: '50%' }}
            />
            <Handle 
                type="source" 
                position={Position.Right} 
                className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity !-right-1.5"
                style={{ top: '50%' }}
            />
        </div>
    );
};

export default memo(PremiumNode);
