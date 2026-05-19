import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
    LuMail,
    LuGlobe,
    LuDatabase,
    LuZap,
    LuSplit,
    LuClock,
    LuFileJson,
    LuPlus,
} from 'react-icons/lu';
import clsx from 'clsx';
import { getFriendlyLabel } from '../../utils/expressionLabels';
import { NODE_TYPE_MAP } from './nodePickerOptions';

const getIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
        case 'trigger': return <LuZap className="size-4 text-white" />;
        case 'email': return <LuMail className="size-4 text-white" />;
        case 'http': return <LuGlobe className="size-4 text-white" />;
        case 'condition': return <LuSplit className="size-4 text-white" />;
        case 'database': return <LuDatabase className="size-4 text-white" />;
        case 'wait': return <LuClock className="size-4 text-white" />;
        default: return <LuFileJson className="size-4 text-white" />;
    }
};

function getInlineSummary(kind: string, config: Record<string, unknown>): string {
    if (!config || Object.keys(config).length === 0) return 'Click to configure';

    switch (kind) {
        case 'trigger': {
            const name = config.name as string;
            const dept = config.department as string;
            if (name || dept) return [name, dept].filter(Boolean).join(' · ') || 'Click to configure';
            return 'Click to configure';
        }
        case 'email': {
            const to = config.to as string;
            const subject = config.subject as string;
            if (to) return `To: ${getFriendlyLabel(String(to))}${subject ? ` · ${subject}` : ''}`;
            return 'Click to configure';
        }
        case 'http': {
            const method = (config.method as string) || 'GET';
            const url = config.url as string;
            if (!url) return `${method} (configure URL)`;
            return `${method} ${url.length > 22 ? url.slice(0, 22) + '…' : url}`;
        }
        case 'condition': {
            const field = config.field as string;
            if (!field) return 'Click to configure';
            return `If ${getFriendlyLabel(String(field))} ${config.operator || ''}`;
        }
        case 'database': {
            const table = config.table as string;
            const op = config.operation as string;
            if (!table && !op) return 'Click to configure';
            return `${op || 'query'} → ${table || '?'}`;
        }
        case 'wait': {
            const dur = config.duration as number;
            const unit = config.unit as string;
            if (dur) return `Wait ${dur} ${unit || 'seconds'}`;
            return 'Click to configure';
        }
        case 'variable': {
            const vars = config.variables as unknown[];
            if (Array.isArray(vars) && vars.length > 0) return `${vars.length} variable(s) set`;
            return 'Click to configure';
        }
        case 'review':
        case 'data_capture':
        case 'document_collection':
        case 'approval_support': {
            const title = config.title as string;
            if (title) return title;
            return 'Click to configure';
        }
        case 'approval': {
            const label = config.label as string;
            if (label) return label;
            return 'Click to configure';
        }
        case 'routing': {
            const u = config.assignedUserId;
            const t = config.assignedTeamId;
            if (u || t) return `Assign to ${u ? `user ${u}` : ''}${t ? `team ${t}` : ''}`;
            return 'Click to configure';
        }
        case 'escalation': {
            const reason = config.reason as string;
            if (reason) return `Escalate: ${reason}`;
            return 'Click to configure';
        }
        case 'status_update': {
            const status = config.status as string;
            if (status) return `→ ${status.replace(/_/g, ' ')}`;
            return 'Click to configure';
        }
        case 'sla': {
            const h = config.dueInHours as number;
            if (h) return `Due in ${h}h`;
            return 'Click to configure';
        }
        default:
            return config.description as string || 'Click to configure';
    }
}

function isConfigured(kind: string, config: Record<string, unknown>): boolean {
    if (!config) return false;
    switch (kind) {
        case 'trigger': return !!(config.name || config.department);
        case 'email': return !!(config.to && config.subject);
        case 'http': return !!(config.url);
        case 'condition': return !!(config.field && config.operator);
        case 'database': return !!(config.table && config.operation);
        case 'wait': return !!(config.duration);
        case 'review':
        case 'data_capture':
        case 'document_collection':
        case 'approval_support': return !!(config.title);
        case 'approval': return !!(config.label);
        case 'routing': return !!(config.assignedUserId || config.assignedTeamId);
        case 'escalation': return !!(config.reason);
        case 'status_update': return !!(config.status);
        case 'sla': return !!(config.dueInHours);
        default: return Object.keys(config).some((k) => config[k] !== '' && config[k] !== null && config[k] !== undefined);
    }
}

const PremiumNode = ({ data, selected }: NodeProps) => {
    const { name, kind, config, onAddAfter } = data;
    const meta = NODE_TYPE_MAP[kind];
    const accent = meta?.accent || '#868788';
    const configured = isConfigured(kind, config || {});
    const summary = getInlineSummary(kind, config || {});

    return (
        <div
            className={clsx(
                'relative group transition-all duration-200 min-w-[220px]',
                'rounded-[10px] bg-[#fdfdfd] border',
                selected
                    ? 'border-[#0f1012]/[0.18] shadow-card'
                    : 'border-[#0f1012]/[0.08] hover:border-[#0f1012]/[0.14]'
            )}
        >
            {/* Category accent bar */}
            <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ backgroundColor: accent }} />

            <div className="relative z-10 flex flex-col gap-2 p-3.5 pl-4">
                <div className="flex items-center gap-2.5 border-b border-[#0f1012]/[0.06] pb-2">
                    <div
                        className="flex size-7 items-center justify-center rounded-[6px] border border-white/10 shadow-sm"
                        style={{ backgroundColor: accent }}
                    >
                        {getIcon(kind)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#868788] font-medium">
                            {kind.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-medium text-[#0f1012] leading-tight truncate">
                            {name || kind.charAt(0).toUpperCase() + kind.slice(1).replace(/_/g, ' ')}
                        </span>
                    </div>
                    {/* Status dot */}
                    <div
                        className={clsx(
                            'size-2 rounded-full border border-white',
                            configured ? 'bg-[#1b5e20]' : 'bg-[#f57f17]'
                        )}
                        title={configured ? 'Configured' : 'Needs configuration'}
                    />
                </div>

                <div className="truncate rounded-[6px] border border-[#0f1012]/[0.06] bg-[#f2f2f4] px-2 py-1.5 font-mono text-[11px] text-[#868788]">
                    {summary}
                </div>
            </div>

            {/* Hover quick-add chips */}
            {onAddAfter && (
                <>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddAfter();
                        }}
                        className="absolute -right-3 top-1/2 z-20 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-[#0f1012]/[0.12] bg-[#fdfdfd] text-[#868788] opacity-0 shadow-sm transition-all duration-200 hover:scale-110 hover:border-[#0f1012]/[0.24] hover:bg-[#0f1012] hover:text-white group-hover:opacity-100"
                        title="Add step after"
                    >
                        <LuPlus className="size-3.5" />
                    </button>
                </>
            )}

            <Handle
                type="target"
                position={Position.Left}
                className="!size-2.5 !border-2 !border-[#0f1012]/[0.12] opacity-0 group-hover:opacity-100 transition-opacity !-left-1.5"
                style={{ top: '50%', backgroundColor: '#868788' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!size-2.5 !border-2 !border-[#0f1012]/[0.18] opacity-0 group-hover:opacity-100 transition-opacity !-right-1.5"
                style={{ top: '50%', backgroundColor: '#0f1012' }}
            />
        </div>
    );
};

export default memo(PremiumNode);
