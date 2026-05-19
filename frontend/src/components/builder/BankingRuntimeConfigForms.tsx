import React from 'react';
import type { NodeKind } from '../../types/nodeConfigs';

type FlowNode = {
    id: number;
    name: string;
    kind: NodeKind;
    config: Record<string, unknown>;
};

type RuntimeConfigFormProps = {
    node: FlowNode;
    localConfig: Record<string, unknown>;
    handleChange: (key: string, value: unknown) => void;
};

const getString = (config: Record<string, unknown>, key: string, fallback = ''): string => {
    const val = config[key];
    return typeof val === 'string' ? val : fallback;
};

const getNumber = (config: Record<string, unknown>, key: string, fallback = 0): number => {
    const val = config[key];
    return typeof val === 'number' ? val : fallback;
};

const FormField: React.FC<{
    label: string;
    children: React.ReactNode;
}> = ({ label, children }) => (
    <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#868788] uppercase tracking-wide">
            {label}
        </label>
        {children}
    </div>
);

const TextInput: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
    <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[10px] px-2.5 py-1.5 text-sm text-[#0f1012] focus:border-[#0071e3]/40 focus:outline-none transition-colors"
    />
);

const NumberInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    min?: number;
}> = ({ value, onChange, min = 0 }) => (
    <input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        className="w-full bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[10px] px-2.5 py-1.5 text-sm text-[#0f1012] focus:border-[#0071e3]/40 focus:outline-none transition-colors"
    />
);

const Select: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
    <div className="relative">
        <select
            value={value || options[0]?.value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[10px] px-2.5 py-1.5 text-sm text-[#0f1012] focus:border-[#0071e3]/40 focus:outline-none transition-colors appearance-none cursor-pointer"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8f8f8f] pointer-events-none">
            <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
);

const InfoBox: React.FC<{
    children: React.ReactNode;
    variant?: 'info' | 'warning';
}> = ({ children, variant = 'info' }) => (
    <div className={`p-2 rounded-[6px] border text-[10px] ${
        variant === 'warning'
            ? 'bg-[#f2f2f4] border-[#0f1012]/[0.08] text-[#8f8f8f]'
            : 'bg-[#f2f2f4] border-[#0f1012]/[0.08] text-[#8f8f8f]'
    }`}>
        {children}
    </div>
);

export const TaskConfigForm: React.FC<RuntimeConfigFormProps> = ({ node, localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox>
            <strong>Blocking Case Task</strong>
            <p className="mt-1 opacity-80">The case runtime pauses here until this task is completed.</p>
        </InfoBox>
        <div className="space-y-4 border-t border-[#0f1012]/[0.08] pt-4">
            <FormField label="Task Title">
                <TextInput
                    value={getString(localConfig, 'title', node.name)}
                    onChange={(val) => handleChange('title', val)}
                    placeholder="Review case"
                />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="Assigned User ID">
                    <NumberInput
                        value={getNumber(localConfig, 'assignedUserId', 0)}
                        onChange={(val) => handleChange('assignedUserId', val || null)}
                        min={0}
                    />
                </FormField>
                <FormField label="Assigned Team ID">
                    <NumberInput
                        value={getNumber(localConfig, 'assignedTeamId', 0)}
                        onChange={(val) => handleChange('assignedTeamId', val || null)}
                        min={0}
                    />
                </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="Claim Policy">
                    <Select
                        value={getString(localConfig, 'claimPolicy', 'claim_required')}
                        onChange={(val) => handleChange('claimPolicy', val)}
                        options={[
                            { value: 'claim_required', label: 'Claim Required' },
                            { value: 'direct_assign', label: 'Direct Assign' },
                        ]}
                    />
                </FormField>
                <FormField label="Due In Hours">
                    <NumberInput
                        value={getNumber(localConfig, 'dueInHours', 0)}
                        onChange={(val) => handleChange('dueInHours', val || undefined)}
                        min={0}
                    />
                </FormField>
            </div>
        </div>
    </div>
);

export const ApprovalConfigForm: React.FC<RuntimeConfigFormProps> = ({ node, localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox>
            <strong>Approval Gate</strong>
            <p className="mt-1 opacity-80">The case runtime pauses until the requested approval is approved or rejected.</p>
        </InfoBox>
        <div className="space-y-4 border-t border-[#0f1012]/[0.08] pt-4">
            <FormField label="Approval Label">
                <TextInput
                    value={getString(localConfig, 'label', node.name)}
                    onChange={(val) => handleChange('label', val)}
                    placeholder="Approval required"
                />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="Approver User ID">
                    <NumberInput value={getNumber(localConfig, 'requestedFromUserId', 0)} onChange={(val) => handleChange('requestedFromUserId', val || null)} min={0} />
                </FormField>
                <FormField label="Approver Team ID">
                    <NumberInput value={getNumber(localConfig, 'requestedFromTeamId', 0)} onChange={(val) => handleChange('requestedFromTeamId', val || null)} min={0} />
                </FormField>
            </div>
            <FormField label="Due In Hours">
                <NumberInput value={getNumber(localConfig, 'dueInHours', 0)} onChange={(val) => handleChange('dueInHours', val || undefined)} min={0} />
            </FormField>
        </div>
    </div>
);

export const RoutingConfigForm: React.FC<RuntimeConfigFormProps> = ({ localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox>Assign the case to a user or queue without creating a blocking task.</InfoBox>
        <div className="grid grid-cols-2 gap-3 border-t border-[#0f1012]/[0.08] pt-4">
            <FormField label="Assigned User ID">
                <NumberInput value={getNumber(localConfig, 'assignedUserId', 0)} onChange={(val) => handleChange('assignedUserId', val || null)} min={0} />
            </FormField>
            <FormField label="Assigned Team ID">
                <NumberInput value={getNumber(localConfig, 'assignedTeamId', 0)} onChange={(val) => handleChange('assignedTeamId', val || null)} min={0} />
            </FormField>
        </div>
    </div>
);

export const SlaConfigForm: React.FC<RuntimeConfigFormProps> = ({ localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox>Set the due date used by the next task or approval.</InfoBox>
        <FormField label="Due In Hours">
            <NumberInput value={getNumber(localConfig, 'dueInHours', 8)} onChange={(val) => handleChange('dueInHours', val)} min={1} />
        </FormField>
    </div>
);

export const EscalationConfigForm: React.FC<RuntimeConfigFormProps> = ({ localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox variant="warning">Escalate the case and assign it to a target user or team.</InfoBox>
        <div className="space-y-4 border-t border-[#0f1012]/[0.08] pt-4">
            <FormField label="Reason">
                <TextInput value={getString(localConfig, 'reason', 'Case escalated')} onChange={(val) => handleChange('reason', val)} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="Target User ID">
                    <NumberInput value={getNumber(localConfig, 'toUserId', 0)} onChange={(val) => handleChange('toUserId', val || null)} min={0} />
                </FormField>
                <FormField label="Target Team ID">
                    <NumberInput value={getNumber(localConfig, 'toTeamId', 0)} onChange={(val) => handleChange('toTeamId', val || null)} min={0} />
                </FormField>
            </div>
        </div>
    </div>
);

export const StatusUpdateConfigForm: React.FC<RuntimeConfigFormProps> = ({ localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox>Update the case status. Resolved, closed, and cancelled stop the runtime.</InfoBox>
        <FormField label="Status">
            <Select
                value={getString(localConfig, 'status', 'in_review')}
                onChange={(val) => handleChange('status', val)}
                options={[
                    { value: 'intake', label: 'Intake' },
                    { value: 'in_review', label: 'In Review' },
                    { value: 'pending_approval', label: 'Pending Approval' },
                    { value: 'pending_action', label: 'Pending Action' },
                    { value: 'escalated', label: 'Escalated' },
                    { value: 'resolved', label: 'Resolved' },
                    { value: 'closed', label: 'Closed' },
                    { value: 'cancelled', label: 'Cancelled' },
                ]}
            />
        </FormField>
    </div>
);

export const BankingRuntimeConfigForm: React.FC<RuntimeConfigFormProps> = (props) => {
    switch (props.node.kind) {
        case 'review':
        case 'data_capture':
        case 'document_collection':
        case 'approval_support':
        case 'decision_followup':
        case 'escalation_followup':
            return <TaskConfigForm {...props} />;
        case 'approval':
            return <ApprovalConfigForm {...props} />;
        case 'routing':
            return <RoutingConfigForm {...props} />;
        case 'sla':
        case 'timer':
            return <SlaConfigForm {...props} />;
        case 'escalation':
            return <EscalationConfigForm {...props} />;
        case 'status_update':
            return <StatusUpdateConfigForm {...props} />;
        default:
            return null;
    }
};
