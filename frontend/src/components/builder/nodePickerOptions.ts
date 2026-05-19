import {
    LuMail,
    LuGlobe,
    LuSplit,
    LuDatabase,
    LuClock,
    LuZap,
    LuTerminal,
    LuCalendar,
    LuBox,
    LuClipboardCheck,
    LuFileCheck,
    LuGitBranch,
    LuRoute,
    LuShieldCheck,
    LuTriangleAlert,
    LuUserCheck,
} from "react-icons/lu";

export type NodeCategory = 'case' | 'utility' | 'decision';

export interface NodeTypeDef {
    kind: string;
    label: string;
    icon: React.ElementType;
    description: string;
    category: NodeCategory;
    accent: string;
}

export const NODE_TYPES: NodeTypeDef[] = [
    // Case / Runtime
    { kind: "trigger", label: "Trigger", icon: LuZap, description: "Starts the flow. Configure your case intake values here.", category: "case", accent: "#1b5e20" },
    { kind: "review", label: "Manual Task", icon: LuClipboardCheck, description: "Creates a blocking operational review task.", category: "case", accent: "#0071e3" },
    { kind: "data_capture", label: "Data Capture", icon: LuDatabase, description: "Creates a task to collect structured case data.", category: "case", accent: "#0071e3" },
    { kind: "document_collection", label: "Document", icon: LuFileCheck, description: "Creates a task for required case documents.", category: "case", accent: "#0071e3" },
    { kind: "approval", label: "Approval", icon: LuShieldCheck, description: "Requests an approval before the case can continue.", category: "case", accent: "#0071e3" },
    { kind: "approval_support", label: "Approval Prep", icon: LuUserCheck, description: "Creates a task to prepare an approval package.", category: "case", accent: "#0071e3" },
    { kind: "routing", label: "Route Case", icon: LuRoute, description: "Updates the case assignee or queue.", category: "case", accent: "#0071e3" },
    { kind: "sla", label: "SLA Timer", icon: LuClock, description: "Sets the due date for the next blocking step.", category: "case", accent: "#0071e3" },
    { kind: "escalation", label: "Escalation", icon: LuTriangleAlert, description: "Escalates the case to a user or team.", category: "case", accent: "#0071e3" },
    { kind: "status_update", label: "Status Update", icon: LuGitBranch, description: "Updates case status or completes the runtime.", category: "case", accent: "#0071e3" },

    // Decision
    { kind: "condition", label: "Decision", icon: LuSplit, description: "Branches flow based on logic (If/Else).", category: "decision", accent: "#f57f17" },

    // Utility
    { kind: "email", label: "Send Email", icon: LuMail, description: "Records or requests an email notification.", category: "utility", accent: "#868788" },
    { kind: "http", label: "HTTP Request", icon: LuGlobe, description: "Records or requests an external API call.", category: "utility", accent: "#868788" },
    { kind: "database", label: "Database", icon: LuDatabase, description: "Records or requests a database operation.", category: "utility", accent: "#868788" },
    { kind: "variable", label: "Set Variable", icon: LuBox, description: "Store and manipulate data for use in later steps.", category: "utility", accent: "#868788" },
    { kind: "wait", label: "Wait", icon: LuClock, description: "Sets a due date for the next blocking step.", category: "utility", accent: "#868788" },
    { kind: "datetime", label: "Date/Time", icon: LuCalendar, description: "Format, calculate, or get current date/time.", category: "utility", accent: "#868788" },
    { kind: "logger", label: "Logger", icon: LuTerminal, description: "Writes an audit-style log entry for traceability.", category: "utility", accent: "#868788" },
];

export const NODE_TYPE_MAP: Record<string, NodeTypeDef> = NODE_TYPES.reduce((acc, t) => {
    acc[t.kind] = t;
    return acc;
}, {} as Record<string, NodeTypeDef>);

export const runtimeNodes = NODE_TYPES.filter((n) => n.category === 'case');
export const utilityNodes = NODE_TYPES.filter((n) => n.category === 'utility');
export const decisionNodes = NODE_TYPES.filter((n) => n.category === 'decision');
