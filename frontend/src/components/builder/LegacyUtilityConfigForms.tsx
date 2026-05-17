import React from 'react';
import {
    LuArrowRight,
    LuCalendar,
    LuCheck,
    LuClock,
    LuDatabase,
    LuGlobe,
    LuInfo,
    LuMail,
    LuMessageSquare,
    LuMinus,
    LuPlus,
    LuUser,
    LuX,
    LuZap,
} from 'react-icons/lu';
import { CONDITION_OPERATORS, type NodeKind } from '../../types/nodeConfigs';
import type { DatabaseTable } from '../../api/flows';
import SmartField from './SmartField';

type FlowNode = {
    id: number;
    name: string;
    kind: NodeKind;
    config: Record<string, unknown>;
};

type LegacyUtilityConfigFormProps = {
    node: FlowNode;
    localConfig: Record<string, unknown>;
    databaseTables: DatabaseTable[];
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
    hint?: string;
    icon?: React.ReactNode;
}> = ({ label, children, hint, icon }) => (
    <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
            {icon && <span className="text-zinc-500">{icon}</span>}
            {label}
        </label>
        {children}
        {hint && <p className="text-[10px] text-zinc-500">{hint}</p>}
    </div>
);

const TextInput: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    type?: string;
    icon?: React.ReactNode;
}> = ({ value, onChange, placeholder, type = 'text', icon }) => (
    <div className="relative">
        {icon && <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">{icon}</div>}
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-raycast-surface-2 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none transition-colors ${icon ? 'pl-8' : ''}`}
        />
    </div>
);

const TextArea: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    rows?: number;
}> = ({ value, onChange, placeholder, rows = 3 }) => (
    <textarea
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-raycast-surface-2 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none transition-colors resize-none"
    />
);

const Select: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string; description?: string }[];
    icon?: React.ReactNode;
}> = ({ value, onChange, options, icon }) => (
    <div className="relative">
        {icon && <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none text-sm">{icon}</div>}
        <select
            value={value || options[0]?.value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full bg-raycast-surface-2 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none transition-colors appearance-none cursor-pointer ${icon ? 'pl-8' : ''}`}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
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
        className="w-full bg-raycast-surface-2 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-white/20 focus:outline-none transition-colors"
    />
);

const QuickActionButton: React.FC<{
    label: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    selected?: boolean;
}> = ({ label, description, icon, onClick, selected }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full p-2 rounded-lg border text-left transition-all ${
            selected ? 'border-white/20 bg-white/5 shadow-raycast-highlight' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
        }`}
    >
        <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md text-sm ${selected ? 'bg-white/10 text-white' : 'bg-white/10 text-zinc-400'}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${selected ? 'text-white' : 'text-zinc-300'}`}>{label}</div>
                <div className="text-[10px] text-zinc-500 truncate">{description}</div>
            </div>
            {selected && <LuCheck className="text-white text-sm flex-shrink-0" />}
        </div>
    </button>
);

const InfoBox: React.FC<{
    children: React.ReactNode;
    variant?: 'info' | 'success' | 'warning' | 'tip';
}> = ({ children, variant = 'info' }) => {
    const styles = {
        info: 'bg-raycast-surface-2 border-white/10 text-zinc-300',
        success: 'bg-raycast-surface-2 border-white/10 text-[#59d499]',
        warning: 'bg-raycast-surface-2 border-white/10 text-zinc-300',
        tip: 'bg-raycast-surface-2 border-white/10 text-zinc-300',
    };

    return <div className={`p-2 rounded-md border text-[10px] ${styles[variant]}`}>{children}</div>;
};

const TriggerConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox>
            <div className="flex items-start gap-2">
                <LuInfo className="size-4 mt-0.5 flex-shrink-0" />
                <div>
                    <strong>Flow Starting Point</strong>
                    <p className="mt-1 opacity-80">Choose how this flow should be triggered.</p>
                </div>
            </div>
        </InfoBox>
        <div className="space-y-4 border-t border-white/5 pt-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <LuUser className="size-4 text-white" />
                Case Intake
            </h3>
            <FormField label="Case Name" icon={<LuUser className="size-3" />}>
                <TextInput value={getString(localConfig, 'name')} onChange={(val) => handleChange('name', val)} placeholder="e.g. Case-AML-1042" icon={<LuUser className="size-4" />} />
            </FormField>
            <FormField label="Contact Email" icon={<LuMail className="size-3" />}>
                <TextInput value={getString(localConfig, 'email')} onChange={(val) => handleChange('email', val)} placeholder="e.g. alerts@bankflow.local" icon={<LuMail className="size-4" />} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
                <FormField label="Queue">
                    <Select
                        value={getString(localConfig, 'department')}
                        onChange={(val) => handleChange('department', val)}
                        options={[
                            { value: '', label: 'Select queue?' },
                            { value: 'Financial Crime Operations', label: 'Financial Crime Operations' },
                            { value: 'Payments Operations', label: 'Payments Operations' },
                            { value: 'Compliance', label: 'Compliance' },
                            { value: 'Operations Control', label: 'Operations Control' },
                            { value: 'Finance', label: 'Finance' },
                            { value: 'Other', label: 'Other' },
                        ]}
                    />
                </FormField>
                <FormField label="Case Type">
                    <TextInput value={getString(localConfig, 'role')} onChange={(val) => handleChange('role', val)} placeholder="e.g. Payment Exception Review" />
                </FormField>
            </div>
            {getString(localConfig, 'department') === 'Other' && (
                <FormField label="Custom Queue">
                    <TextInput value={getString(localConfig, 'customDepartment')} onChange={(val) => handleChange('customDepartment', val)} placeholder="Enter queue name" />
                </FormField>
            )}
            <FormField label="Requested Date" icon={<LuCalendar className="size-3" />}>
                <TextInput value={getString(localConfig, 'startDate')} onChange={(val) => handleChange('startDate', val)} type="date" />
            </FormField>
        </div>
    </div>
);

const EmailConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => {
    const recipientType = getString(localConfig, 'recipientType', 'case_contact');
    return (
        <div className="space-y-5">
            <InfoBox>
                <div className="flex items-start gap-2">
                    <LuMail className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Send Email Notification</strong>
                        <p className="mt-1 opacity-80">This step will send an email when the flow reaches this point.</p>
                    </div>
                </div>
            </InfoBox>
            <div className="space-y-4 border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-white">Who should receive this email?</h3>
                <div className="space-y-2">
                    <QuickActionButton
                        label="Case Contact"
                        description="Send to the contact email from intake"
                        icon={<LuUser className="size-4" />}
                        onClick={() => {
                            handleChange('recipientType', 'case_contact');
                            handleChange('to', '{{trigger.email}}');
                        }}
                        selected={recipientType === 'case_contact'}
                    />
                    <QuickActionButton
                        label="Custom Recipient"
                        description="Enter a specific email address"
                        icon={<LuMail className="size-4" />}
                        onClick={() => {
                            handleChange('recipientType', 'custom');
                            handleChange('to', '');
                        }}
                        selected={recipientType === 'custom'}
                    />
                </div>
                {recipientType === 'custom' && (
                    <FormField label="Email Address">
                        <SmartField value={getString(localConfig, 'to')} onChange={(val) => handleChange('to', val)} placeholder="e.g. operations@bankflow.local" />
                    </FormField>
                )}
                <FormField label="Subject Line">
                    <TextInput value={getString(localConfig, 'subject')} onChange={(val) => handleChange('subject', val)} placeholder="e.g. Case update available" />
                </FormField>
                <FormField label="Email Body" hint="Write your message below">
                    <TextArea rows={6} value={getString(localConfig, 'body')} onChange={(val) => handleChange('body', val)} placeholder="Hello,\n\nYour case has moved to the next review stage.\n\nBest regards,\nOperations Team" />
                </FormField>
                <div className="flex flex-wrap gap-2">
                    {['Case update available', 'Action required on your case', 'Review completed', 'Escalation notice'].map((template) => (
                        <button key={template} type="button" onClick={() => handleChange('subject', template)} className="text-xs bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors">
                            {template}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const HttpConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => {
    const useCase = getString(localConfig, 'useCase', 'custom');
    return (
        <div className="space-y-5">
            <InfoBox>
                <div className="flex items-start gap-2">
                    <LuGlobe className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Connect to External Service</strong>
                        <p className="mt-1 opacity-80">Send data to another system or service when this step runs.</p>
                    </div>
                </div>
            </InfoBox>
            <div className="space-y-4 border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-white">What do you want to do?</h3>
                <div className="space-y-2">
                    <QuickActionButton label="Notify Slack Channel" description="Send a message to a Slack channel" icon={<LuMessageSquare className="size-4" />} onClick={() => { handleChange('useCase', 'slack'); handleChange('method', 'POST'); handleChange('url', ''); handleChange('headers', [{ key: 'Content-Type', value: 'application/json' }]); }} selected={useCase === 'slack'} />
                    <QuickActionButton label="Update Case System" description="Send case intake data to an external platform" icon={<LuDatabase className="size-4" />} onClick={() => { handleChange('useCase', 'case_api'); handleChange('method', 'POST'); }} selected={useCase === 'case_api'} />
                    <QuickActionButton label="Custom API Request" description="Configure a custom HTTP request" icon={<LuZap className="size-4" />} onClick={() => handleChange('useCase', 'custom')} selected={useCase === 'custom'} />
                </div>
                {useCase === 'slack' && (
                    <>
                        <FormField label="Slack Webhook URL" hint="Get this from your Slack app settings">
                            <SmartField value={getString(localConfig, 'url')} onChange={(val) => handleChange('url', val)} placeholder="https://hooks.slack.com/services/..." />
                        </FormField>
                        <FormField label="Message">
                            <SmartField rows={3} value={getString(localConfig, 'slackMessage') || getString(localConfig, 'body')} onChange={(val) => { handleChange('slackMessage', val); handleChange('body', JSON.stringify({ text: val })); }} placeholder="New payment exception case entered the queue" />
                        </FormField>
                    </>
                )}
                {useCase === 'case_api' && (
                    <>
                        <FormField label="API Endpoint URL" hint="The URL of your case platform or service">
                            <SmartField value={getString(localConfig, 'url')} onChange={(val) => handleChange('url', val)} placeholder="https://api.yourplatform.com/cases" />
                        </FormField>
                        <InfoBox variant="success">Trigger data from the intake step will be available for this request.</InfoBox>
                    </>
                )}
                {useCase === 'custom' && (
                    <>
                        <div className="grid grid-cols-3 gap-3">
                            <FormField label="Method">
                                <Select value={getString(localConfig, 'method', 'GET')} onChange={(val) => handleChange('method', val)} options={[{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }, { value: 'PUT', label: 'PUT' }, { value: 'DELETE', label: 'DELETE' }]} />
                            </FormField>
                            <div className="col-span-2">
                                <FormField label="URL">
                                    <SmartField value={getString(localConfig, 'url')} onChange={(val) => handleChange('url', val)} placeholder="https://api.example.com/endpoint" />
                                </FormField>
                            </div>
                        </div>
                        {['POST', 'PUT'].includes(getString(localConfig, 'method')) && (
                            <FormField label="Request Data" hint="The data to send (JSON format)">
                                <SmartField rows={4} value={getString(localConfig, 'body')} onChange={(val) => handleChange('body', val)} placeholder='{"name": "value"}' />
                            </FormField>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const DatabaseConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, databaseTables, handleChange }) => {
    const operation = getString(localConfig, 'operation', 'query');
    return (
        <div className="space-y-5">
            <InfoBox>
                <div className="flex items-start gap-2">
                    <LuDatabase className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Database Operation</strong>
                        <p className="mt-1 opacity-80">Read or write case data from a connected database.</p>
                    </div>
                </div>
            </InfoBox>
            <div className="space-y-4 border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-white">What do you want to do?</h3>
                <div className="space-y-2">
                    <QuickActionButton label="Look Up Records" description="Search and retrieve data from a table" icon={<LuDatabase className="size-4" />} onClick={() => handleChange('operation', 'query')} selected={operation === 'query'} />
                    <QuickActionButton label="Add New Record" description="Insert a new row into a table" icon={<LuPlus className="size-4" />} onClick={() => handleChange('operation', 'create')} selected={operation === 'create'} />
                    <QuickActionButton label="Update Existing Record" description="Modify data in an existing row" icon={<LuArrowRight className="size-4" />} onClick={() => handleChange('operation', 'update')} selected={operation === 'update'} />
                </div>
                <FormField label="Select Table" icon={<LuDatabase className="size-3" />}>
                    <Select
                        value={getString(localConfig, 'table')}
                        onChange={(val) => handleChange('table', val)}
                        options={[
                            { value: '', label: 'Choose a table?' },
                            ...databaseTables.map((table) => ({ value: table.name, label: table.label, description: table.description })),
                        ]}
                        icon={<LuDatabase className="size-4" />}
                    />
                </FormField>
                {(operation === 'query' || operation === 'update') && (
                    <FormField label="Filter By" hint="Which records should be affected?">
                        <Select
                            value={getString(localConfig, 'filterField', 'email')}
                            onChange={(val) => handleChange('filterField', val)}
                            options={[
                                { value: 'email', label: 'Contact Email (from trigger)' },
                                { value: 'id', label: 'Record ID' },
                                { value: 'custom', label: 'Custom filter' },
                            ]}
                        />
                        {getString(localConfig, 'filterField') === 'custom' && (
                            <div className="mt-2">
                                <SmartField value={getString(localConfig, 'whereClause')} onChange={(val) => handleChange('whereClause', val)} placeholder="e.g. department = 'Operations'" />
                            </div>
                        )}
                    </FormField>
                )}
                {operation !== 'query' && <InfoBox variant="success">Trigger data from the intake step can be mapped into record fields.</InfoBox>}
            </div>
        </div>
    );
};

const ConditionConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => {
    const operator = getString(localConfig, 'operator', 'equals');
    const checkField = getString(localConfig, 'checkField', 'department');
    return (
        <div className="space-y-5">
            <InfoBox>
                <div className="flex items-start gap-2">
                    <LuArrowRight className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Decision Point</strong>
                        <p className="mt-1 opacity-80">Split the flow based on a condition.</p>
                    </div>
                </div>
            </InfoBox>
            <div className="space-y-4 border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-white">Set Up Your Condition</h3>
                <div className="p-4 rounded-xl bg-raycast-surface-2 border border-white/10 space-y-4">
                    <div className="text-sm text-zinc-300"><span className="text-white font-medium">IF</span> the case data?</div>
                    <FormField label="Field to Check">
                        <Select
                            value={checkField}
                            onChange={(val) => {
                                handleChange('checkField', val);
                                handleChange('field', `{{trigger.${val}}}`);
                            }}
                            options={[
                                { value: 'department', label: 'Department' },
                                { value: 'role', label: 'Role/Position' },
                                { value: 'email', label: 'Email Address' },
                                { value: 'name', label: 'Name' },
                            ]}
                        />
                    </FormField>
                    <FormField label="Condition">
                        <Select value={operator} onChange={(val) => handleChange('operator', val)} options={CONDITION_OPERATORS} />
                    </FormField>
                    {!['is_empty', 'is_not_empty'].includes(operator) && (
                        <FormField label="Value">
                            <SmartField value={getString(localConfig, 'value')} onChange={(val) => handleChange('value', val)} placeholder={checkField === 'department' ? 'e.g. Operations' : 'Enter value?'} />
                        </FormField>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-raycast-surface-2 border border-white/10">
                        <div className="flex items-center gap-2 text-white text-sm font-medium"><LuCheck className="size-4" />If TRUE</div>
                        <p className="text-xs text-zinc-400 mt-1">Continue to the next step</p>
                    </div>
                    <div className="p-3 rounded-lg bg-raycast-surface-2 border border-white/10">
                        <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium"><LuX className="size-4" />If FALSE</div>
                        <p className="text-xs text-zinc-400 mt-1">Take alternate path</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const WaitConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => {
    const duration = getNumber(localConfig, 'duration', 30);
    const unit = getString(localConfig, 'unit', 'seconds');
    return (
        <div className="space-y-5">
            <InfoBox>
                <div className="flex items-start gap-2">
                    <LuClock className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Pause Flow</strong>
                        <p className="mt-1 opacity-80">Wait for a specified amount of time before continuing.</p>
                    </div>
                </div>
            </InfoBox>
            <div className="space-y-4 border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-white">How long should we wait?</h3>
                <div className="grid grid-cols-2 gap-3">
                    <FormField label="Duration">
                        <NumberInput value={duration} onChange={(val) => handleChange('duration', val)} min={1} />
                    </FormField>
                    <FormField label="Unit">
                        <Select value={unit} onChange={(val) => handleChange('unit', val)} options={[{ value: 'seconds', label: 'Seconds' }, { value: 'minutes', label: 'Minutes' }, { value: 'hours', label: 'Hours' }]} />
                    </FormField>
                </div>
                <InfoBox variant="warning">The flow will pause for <strong>{duration} {unit}</strong> before continuing.</InfoBox>
            </div>
        </div>
    );
};

const LoggerConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => (
    <div className="space-y-5">
        <InfoBox>
            <div className="flex items-start gap-2">
                <LuMessageSquare className="size-4 mt-0.5 flex-shrink-0" />
                <div>
                    <strong>Add Log Entry</strong>
                    <p className="mt-1 opacity-80">Record a message in the case event log for tracking and debugging.</p>
                </div>
            </div>
        </InfoBox>
        <div className="space-y-4 border-t border-white/5 pt-4">
            <h3 className="text-sm font-semibold text-white">What should we log?</h3>
            <FormField label="Message Type">
                <Select value={getString(localConfig, 'level', 'info')} onChange={(val) => handleChange('level', val)} options={[{ value: 'info', label: 'Information - General status update' }, { value: 'warn', label: 'Warning - Something to watch' }, { value: 'error', label: 'Error - Something went wrong' }]} />
            </FormField>
            <FormField label="Log Message" hint="This message will be recorded in the case event history">
                <TextArea rows={3} value={getString(localConfig, 'message')} onChange={(val) => handleChange('message', val)} placeholder="e.g. Case review started and assigned" />
            </FormField>
            <div className="flex flex-wrap gap-2">
                {['Flow step completed', 'Processing case data', 'Sending notification', 'Task completed successfully'].map((template) => (
                    <button key={template} type="button" onClick={() => handleChange('message', template)} className="px-2.5 py-1 text-xs rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">{template}</button>
                ))}
            </div>
        </div>
    </div>
);

const DateTimeConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => {
    const dtOperation = getString(localConfig, 'operation', 'now');
    return (
        <div className="space-y-5">
            <InfoBox>
                <div className="flex items-start gap-2">
                    <LuCalendar className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Date & Time Operation</strong>
                        <p className="mt-1 opacity-80">Work with dates and times in your flow.</p>
                    </div>
                </div>
            </InfoBox>
            <div className="space-y-4 border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-white">What do you want to do?</h3>
                <div className="space-y-2">
                    <QuickActionButton label="Get Current Date/Time" description="Capture the current moment" icon={<LuClock className="size-4" />} onClick={() => handleChange('operation', 'now')} selected={dtOperation === 'now'} />
                    <QuickActionButton label="Calculate Future Date" description="Add days/hours to a date" icon={<LuPlus className="size-4" />} onClick={() => handleChange('operation', 'add')} selected={dtOperation === 'add'} />
                    <QuickActionButton label="Calculate Past Date" description="Subtract days/hours from a date" icon={<LuMinus className="size-4" />} onClick={() => handleChange('operation', 'subtract')} selected={dtOperation === 'subtract'} />
                    <QuickActionButton label="Format Date" description="Change how a date is displayed" icon={<LuCalendar className="size-4" />} onClick={() => handleChange('operation', 'format')} selected={dtOperation === 'format'} />
                </div>
                {(dtOperation === 'add' || dtOperation === 'subtract') && (
                    <>
                        <FormField label="Starting From">
                            <Select value={getString(localConfig, 'inputField', 'trigger.startDate')} onChange={(val) => handleChange('inputField', `{{${val}}}`)} options={[{ value: 'trigger.startDate', label: 'Requested Date' }, { value: 'now', label: 'Current Date/Time' }]} />
                        </FormField>
                        <div className="grid grid-cols-2 gap-3">
                            <FormField label={dtOperation === 'add' ? 'Add' : 'Subtract'}>
                                <NumberInput value={getNumber(localConfig, 'value', 1)} onChange={(val) => handleChange('value', val)} min={1} />
                            </FormField>
                            <FormField label="Unit">
                                <Select value={getString(localConfig, 'unit', 'days')} onChange={(val) => handleChange('unit', val)} options={[{ value: 'days', label: 'Days' }, { value: 'hours', label: 'Hours' }, { value: 'minutes', label: 'Minutes' }]} />
                            </FormField>
                        </div>
                    </>
                )}
                {dtOperation === 'format' && (
                    <FormField label="Date to Format">
                        <Select value={getString(localConfig, 'inputField', 'trigger.startDate')} onChange={(val) => handleChange('inputField', `{{${val}}}`)} options={[{ value: 'trigger.startDate', label: 'Requested Date' }, { value: 'now', label: 'Current Date/Time' }]} />
                    </FormField>
                )}
                <FormField label="Output Format">
                    <Select value={getString(localConfig, 'format', 'YYYY-MM-DD')} onChange={(val) => handleChange('format', val)} options={[{ value: 'YYYY-MM-DD', label: '2025-12-21 (Standard)' }, { value: 'DD/MM/YYYY', label: '21/12/2025 (UK Format)' }, { value: 'MM/DD/YYYY', label: '12/21/2025 (US Format)' }, { value: 'MMMM D, YYYY', label: 'December 21, 2025 (Readable)' }]} />
                </FormField>
                <FormField label="Save Result As" hint="Name this so you can use it later">
                    <TextInput value={getString(localConfig, 'outputField', 'calculatedDate')} onChange={(val) => handleChange('outputField', val)} placeholder="calculatedDate" />
                </FormField>
            </div>
        </div>
    );
};

const VariableConfigForm: React.FC<LegacyUtilityConfigFormProps> = ({ localConfig, handleChange }) => {
    const variableAction = getString(localConfig, 'variableAction', 'store');
    return (
        <div className="space-y-5">
            <InfoBox>
                <div className="flex items-start gap-2">
                    <LuZap className="size-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Store Data for Later</strong>
                        <p className="mt-1 opacity-80">Save information that you want to use in later steps.</p>
                    </div>
                </div>
            </InfoBox>
            <div className="space-y-4 border-t border-white/5 pt-4">
                <h3 className="text-sm font-semibold text-white">What do you want to store?</h3>
                <div className="space-y-2">
                    <QuickActionButton label="Custom Value" description="Enter a specific value to save" icon={<LuPlus className="size-4" />} onClick={() => handleChange('variableAction', 'store')} selected={variableAction === 'store'} />
                    <QuickActionButton label="Copy from Trigger Data" description="Save case intake values for later use" icon={<LuUser className="size-4" />} onClick={() => handleChange('variableAction', 'copy')} selected={variableAction === 'copy'} />
                </div>
                {variableAction === 'store' && (
                    <>
                        <FormField label="Variable Name" hint="A short name to identify this data">
                            <TextInput value={getString(localConfig, 'variableName')} onChange={(val) => handleChange('variableName', val)} placeholder="e.g. approvalStatus" />
                        </FormField>
                        <FormField label="Value">
                            <TextInput value={getString(localConfig, 'variableValue')} onChange={(val) => handleChange('variableValue', val)} placeholder="e.g. pending" />
                        </FormField>
                    </>
                )}
                {variableAction === 'copy' && (
                    <>
                        <FormField label="What to Copy">
                            <Select value={getString(localConfig, 'copyField', 'email')} onChange={(val) => handleChange('copyField', val)} options={[{ value: 'email', label: 'Contact Email' }, { value: 'name', label: 'Case Name' }, { value: 'department', label: 'Queue' }, { value: 'role', label: 'Case Type' }, { value: 'startDate', label: 'Requested Date' }]} />
                        </FormField>
                        <FormField label="Save As" hint="Name for this stored value">
                            <TextInput value={getString(localConfig, 'variableName')} onChange={(val) => handleChange('variableName', val)} placeholder="e.g. savedEmail" />
                        </FormField>
                    </>
                )}
            </div>
        </div>
    );
};

export const LegacyUtilityConfigForm: React.FC<LegacyUtilityConfigFormProps> = (props) => {
    switch (props.node.kind) {
        case 'trigger':
            return <TriggerConfigForm {...props} />;
        case 'email':
            return <EmailConfigForm {...props} />;
        case 'http':
            return <HttpConfigForm {...props} />;
        case 'database':
            return <DatabaseConfigForm {...props} />;
        case 'condition':
            return <ConditionConfigForm {...props} />;
        case 'wait':
            return <WaitConfigForm {...props} />;
        case 'logger':
            return <LoggerConfigForm {...props} />;
        case 'datetime':
            return <DateTimeConfigForm {...props} />;
        case 'variable':
            return <VariableConfigForm {...props} />;
        default:
            return null;
    }
};
