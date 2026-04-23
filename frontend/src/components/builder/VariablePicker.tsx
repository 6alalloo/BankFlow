
// frontend/src/components/builder/VariablePicker.tsx
// Component for picking variables from upstream nodes to insert into text fields

import { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiBox, FiDatabase, FiMail, FiGlobe, FiClock, FiFile, FiCode, FiZap } from "react-icons/fi";

interface UpstreamNode {
    id: number;
    name: string;
    kind: string;
}

interface VariableOption {
    label: string;
    value: string;
    description?: string;
}

interface VariablePickerProps {
    upstreamNodes: UpstreamNode[];
    onInsert: (variable: string) => void;
    disabled?: boolean;
}

// Map node kinds to common output variables
function getVariablesForNodeKind(kind: string, nodeId: number, nodeName: string): VariableOption[] {
    const basePath = `$node["HRFlow ${nodeId} ${nodeName}"].json`;

    switch (kind.toLowerCase()) {
        case "trigger":
            return [
                { label: "Case Name", value: `{{${basePath}.name}}`, description: "Primary case label" },
                { label: "Contact Email", value: `{{${basePath}.email}}`, description: "Contact email address" },
                { label: "Phone", value: `{{${basePath}.phone}}`, description: "Phone number" },
                { label: "Queue", value: `{{${basePath}.department}}`, description: "Assigned queue or team" },
                { label: "Case Type", value: `{{${basePath}.role}}`, description: "Case or review type" },
                { label: "Document URL", value: `{{${basePath}.resume_url}}`, description: "Linked supporting document" },
                { label: "Requested Date", value: `{{${basePath}.start_date}}`, description: "Requested or event date" },
                { label: "Escalation Email", value: `{{${basePath}.manager_email}}`, description: "Escalation contact" },
            ];
        case "http":
            return [
                { label: "Response Body", value: `{{${basePath}.data}}`, description: "HTTP response data" },
                { label: "Status Code", value: `{{${basePath}.status}}`, description: "HTTP status code" },
            ];
        case "database":
            return [
                { label: "Query Result", value: `{{${basePath}}}`, description: "Database query result" },
                { label: "Row Count", value: `{{${basePath}.length}}`, description: "Number of returned rows" },
            ];
        case "cv_parse":
            return [
                { label: "Full Name", value: `{{${basePath}.name}}`, description: "Parsed document name" },
                { label: "Email", value: `{{${basePath}.email}}`, description: "Parsed email" },
                { label: "Phone", value: `{{${basePath}.phone}}`, description: "Phone number" },
                { label: "Skills", value: `{{${basePath}.skills}}`, description: "Skills list" },
                { label: "Education", value: `{{${basePath}.education}}`, description: "Education details" },
                { label: "Experience", value: `{{${basePath}.experience}}`, description: "Experience summary" },
            ];
        case "variable":
            return [
                { label: "Variable Value", value: `{{${basePath}.value}}`, description: "Stored variable value" },
            ];
        case "datetime":
            return [
                { label: "Formatted Date", value: `{{${basePath}.formatted_date}}`, description: "Formatted date string" },
                { label: "Modified Date", value: `{{${basePath}.modified_date}}`, description: "Date after add/subtract" },
            ];
        default:
            return [
                { label: "Output", value: `{{${basePath}}}`, description: "Node output data" },
            ];
    }
}

// Icon for each node kind
function getNodeIcon(kind: string) {
    switch (kind.toLowerCase()) {
        case "trigger": return <FiZap className="text-amber-400" />;
        case "http": return <FiGlobe className="text-blue-400" />;
        case "database": return <FiDatabase className="text-emerald-400" />;
        case "email": return <FiMail className="text-purple-400" />;
        case "cv_parse": return <FiFile className="text-pink-400" />;
        case "datetime": return <FiClock className="text-cyan-400" />;
        case "variable": return <FiBox className="text-orange-400" />;
        default: return <FiCode className="text-slate-400" />;
    }
}

export default function VariablePicker({ upstreamNodes, onInsert, disabled = false }: VariablePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedNode, setExpandedNode] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (upstreamNodes.length === 0) {
        return null;
    }

    return (
        <div ref={dropdownRef} className="relative inline-block">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="px-2 py-1 text-xs font-medium text-cyan-400 border border-cyan-500/30 rounded bg-cyan-950/20 hover:bg-cyan-950/40 hover:border-cyan-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Insert variable from upstream node"
            >
                <FiBox size={12} />
                Variable
                <FiChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 left-0 min-w-[280px] max-h-[320px] overflow-y-auto bg-[#0a0e1a] border border-white/10 rounded-lg shadow-2xl">
                    {upstreamNodes.map((node) => (
                        <div key={node.id} className="border-b border-white/5 last:border-b-0">
                            {/* Node Header */}
                            <button
                                type="button"
                                onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
                                className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-white/5 transition-colors"
                            >
                                {getNodeIcon(node.kind)}
                                <span className="text-sm text-white font-medium truncate flex-1">
                                    {node.name || node.kind}
                                </span>
                                <span className="text-[10px] text-slate-500 uppercase">{node.kind}</span>
                                <FiChevronDown
                                    size={14}
                                    className={`text-slate-500 transition-transform ${expandedNode === node.id ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {/* Variables List */}
                            {expandedNode === node.id && (
                                <div className="pl-6 pr-2 pb-2 space-y-1">
                                    {getVariablesForNodeKind(node.kind, node.id, node.name || node.kind).map((variable) => (
                                        <button
                                            key={variable.value}
                                            type="button"
                                            onClick={() => {
                                                onInsert(variable.value);
                                                setIsOpen(false);
                                            }}
                                            className="w-full px-2 py-1.5 flex items-center gap-2 text-left rounded hover:bg-cyan-500/10 transition-colors group"
                                        >
                                            <span className="text-xs text-cyan-400 group-hover:text-cyan-300">
                                                {variable.label}
                                            </span>
                                            {variable.description && (
                                                <span className="text-[10px] text-slate-500 ml-auto">
                                                    {variable.description}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Help Text */}
                    <div className="px-3 py-2 text-[10px] text-slate-500 bg-slate-900/50">
                        Select a variable to insert into the field
                    </div>
                </div>
            )}
        </div>
    );
}
