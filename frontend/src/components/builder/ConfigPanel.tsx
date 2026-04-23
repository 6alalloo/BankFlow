import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    LuX, LuTrash2, LuPlus, LuMinus, LuUpload, LuFile,
    LuMail, LuUser, LuCalendar, LuClock, LuDatabase, LuGlobe,
    LuMessageSquare, LuZap, LuArrowRight, LuInfo, LuCheck, LuLoader,
    LuCopy, LuExternalLink
} from 'react-icons/lu';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CONDITION_OPERATORS, CV_PARSER_FIELDS } from '../../types/nodeConfigs';
import { fetchDatabaseTables, type DatabaseTable } from '../../api/workflows';
import { apiUploadFile } from '../../api/apiClient';
import type { NodeKind } from '../../types/nodeConfigs';
import SmartField from './SmartField';

// Node structure from the workflow builder
interface WorkflowNode {
    id: number;
    name: string;
    kind: NodeKind;
    config: Record<string, unknown>;
}

type ConfigPanelProps = {
    isOpen: boolean;
    node: WorkflowNode | null;
    onClose: () => void;
    onUpdate: (id: number, update: { config?: Record<string, unknown>; name?: string }) => void;
    onDelete: (id: number) => void;
};

// Type-safe accessor helpers for localConfig
// type KeyValuePair = { key: string; value: string }; // Unused for now

const getString = (config: Record<string, unknown>, key: string, fallback = ''): string => {
    const val = config[key];
    return typeof val === 'string' ? val : fallback;
};

const getNumber = (config: Record<string, unknown>, key: string, fallback = 0): number => {
    const val = config[key];
    return typeof val === 'number' ? val : fallback;
};

// Commented out - currently unused but may be needed in future
// const getKeyValueArray = (config: Record<string, unknown>, key: string): KeyValuePair[] => {
//     const val = config[key];
//     return Array.isArray(val) ? val as KeyValuePair[] : [];
// };

const getStringArray = (config: Record<string, unknown>, key: string): string[] => {
    const val = config[key];
    return Array.isArray(val) ? val as string[] : [];
};

// Reusable form field components
const FormField: React.FC<{
    label: string;
    children: React.ReactNode;
    hint?: string;
    icon?: React.ReactNode;
}> = ({ label, children, hint, icon }) => (
    <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            {icon && <span className="text-slate-500">{icon}</span>}
            {label}
        </label>
        {children}
        {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
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
        {icon && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                {icon}
            </div>
        )}
        <input
            type={type}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-navy-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-cyan-glow focus:outline-none transition-colors ${icon ? 'pl-8' : ''}`}
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
        className="w-full bg-navy-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-cyan-glow focus:outline-none transition-colors resize-none"
    />
);

const Select: React.FC<{
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string; description?: string }[];
    icon?: React.ReactNode;
}> = ({ value, onChange, options, icon }) => (
    <div className="relative">
        {icon && (
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-sm">
                {icon}
            </div>
        )}
        <select
            value={value || options[0]?.value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full bg-navy-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-cyan-glow focus:outline-none transition-colors appearance-none cursor-pointer ${icon ? 'pl-8' : ''}`}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
);

const NumberInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
}> = ({ value, onChange, min = 0, max }) => (
    <input
        type="number"
        value={value ?? 0}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        className="w-full bg-navy-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:border-cyan-glow focus:outline-none transition-colors"
    />
);

// Quick Action Button Component
const QuickActionButton: React.FC<{
    label: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    selected?: boolean;
    disabled?: boolean;
}> = ({ label, description, icon, onClick, selected, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-full p-2 rounded-lg border text-left transition-all ${
            disabled
                ? 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed'
                : selected
                    ? 'border-cyan-glow bg-cyan-glow/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
        }`}
    >
        <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md text-sm ${selected ? 'bg-cyan-glow/20 text-cyan-glow' : 'bg-white/10 text-slate-400'}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${selected ? 'text-cyan-glow' : 'text-white'}`}>{label}</div>
                <div className="text-[10px] text-slate-500 truncate">{description}</div>
            </div>
            {selected && <LuCheck className="text-cyan-glow text-sm flex-shrink-0" />}
        </div>
    </button>
);

// Info Box Component
const InfoBox: React.FC<{
    children: React.ReactNode;
    variant?: 'info' | 'success' | 'warning' | 'tip' | 'error';
}> = ({ children, variant = 'info' }) => {
    const styles = {
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-200',
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-200',
        tip: 'bg-purple-500/10 border-purple-500/20 text-purple-200',
        error: 'bg-red-500/10 border-red-500/20 text-red-200',
    };

    return (
        <div className={`p-2 rounded-md border text-[10px] ${styles[variant]}`}>
            {children}
        </div>
    );
};

// Checkbox Group Component
const CheckboxGroup: React.FC<{
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
}> = ({ options, selected = [], onChange }) => {
    const handleToggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <div className="grid grid-cols-2 gap-1.5">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggle(opt.value)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border transition-all text-left ${
                        selected.includes(opt.value)
                            ? 'border-cyan-glow bg-cyan-glow/10 text-white'
                            : 'border-white/10 hover:border-white/20 text-slate-400 hover:text-white'
                    }`}
                >
                    <div
                        className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${
                            selected.includes(opt.value)
                                ? 'bg-cyan-glow border-cyan-glow'
                                : 'border-white/30'
                        }`}
                    >
                        {selected.includes(opt.value) && (
                            <svg className="w-2 h-2 text-navy-950" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        )}
                    </div>
                    <span className="text-xs">{opt.label}</span>
                </button>
            ))}
        </div>
    );
};

// File Upload Component - currently unused, commented out to fix build
// const FileUploadButton: React.FC<{
//     onFileSelect: (file: File) => void;
//     accept?: string;
//     currentFile?: string;
// }> = ({ onFileSelect, accept = ".pdf,.docx,.doc", currentFile }) => {
//     const fileInputRef = useRef<HTMLInputElement>(null);
//     const [isDragging, setIsDragging] = useState(false);

//     const handleDrop = (e: React.DragEvent) => {
//         e.preventDefault();
//         setIsDragging(false);
//         const file = e.dataTransfer.files[0];
//         if (file) onFileSelect(file);
//     };

//     return (
//         <div
//             onClick={() => fileInputRef.current?.click()}
//             onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
//             onDragLeave={() => setIsDragging(false)}
//             onDrop={handleDrop}
//             className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
//                 isDragging
//                     ? 'border-cyan-glow bg-cyan-glow/10'
//                     : 'border-white/20 hover:border-white/40 hover:bg-white/5'
//             }`}
//         >
//             <input
//                 ref={fileInputRef}
//                 type="file"
//                 accept={accept}
//                 onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
//                 className="hidden"
//             />
//             <div className="flex flex-col items-center gap-3">
//                 {currentFile ? (
//                     <>
//                         <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
//                             <LuFile className="w-6 h-6 text-emerald-400" />
//                         </div>
//                         <div>
//                             <div className="text-sm font-medium text-white">{currentFile}</div>
//                             <div className="text-xs text-slate-500 mt-1">Click to change file</div>
//                         </div>
//                     </>
//                 ) : (
//                     <>
//                         <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
//                             <LuUpload className="w-6 h-6 text-slate-400" />
//                         </div>
//                         <div>
//                             <div className="text-sm font-medium text-white">Upload CV/Resume</div>
//                             <div className="text-xs text-slate-500 mt-1">
//                                 Drag & drop or click to browse
//                             </div>
//                             <div className="text-xs text-slate-600 mt-1">
//                                 Supports PDF, DOCX (max 5MB)
//                             </div>
//                         </div>
//                     </>
//                 )}
//             </div>
//         </div>
//     );
// };

const ConfigPanel: React.FC<ConfigPanelProps> = ({ isOpen, node, onClose, onUpdate, onDelete }) => {
    // Use useMemo to derive initial config, avoiding setState in effect
    const initialConfig = useMemo(() => node?.config || {}, [node]);
    const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
    const firstInputRef = React.useRef<HTMLInputElement>(null);

    // CV parser file upload state (always declared, conditionally used)
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync localConfig when node changes - this is intentional state synchronization
    const nodeId = node?.id;
    useEffect(() => {
        setLocalConfig(initialConfig);
    }, [nodeId, initialConfig]);

    // Fetch database tables on mount
    useEffect(() => {
        fetchDatabaseTables()
            .then(setDatabaseTables)
            .catch(console.error);
    }, []);

    // Focus first input when panel opens
    useEffect(() => {
        if (isOpen && firstInputRef.current) {
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Keyboard navigation handler
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showDeleteConfirm) {
                    setShowDeleteConfirm(false);
                } else {
                    onClose();
                }
                e.preventDefault();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (node) {
                    onUpdate(node.id, { config: localConfig });
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (node) {
                    onUpdate(node.id, { config: localConfig });
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showDeleteConfirm, node, localConfig, onClose, onUpdate]);

    const handleChange = (key: string, val: unknown) => {
        setLocalConfig((prev) => ({ ...prev, [key]: val }));
    };

    // Debounced autosave - saves automatically after 500ms of no changes
    const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedConfigRef = useRef<string>('');

    useEffect(() => {
        if (!node) return;

        const currentConfigStr = JSON.stringify(localConfig);

        // Don't autosave if config hasn't changed from last save
        if (currentConfigStr === lastSavedConfigRef.current) return;

        // Clear any pending autosave
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        // Set up new autosave after 500ms
        autosaveTimeoutRef.current = setTimeout(() => {
            onUpdate(node.id, { config: localConfig });
            lastSavedConfigRef.current = currentConfigStr;
        }, 500);

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [localConfig, node, onUpdate]);

    // Update lastSavedConfigRef when node changes (to prevent immediate autosave on open)
    useEffect(() => {
        if (node) {
            lastSavedConfigRef.current = JSON.stringify(localConfig);
        }
    }, [node?.id]); // Only when node ID changes, not on every localConfig change

    const handleSave = useCallback(() => {
        if (node) {
            // Clear any pending autosave
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
            onUpdate(node.id, { config: localConfig });
            lastSavedConfigRef.current = JSON.stringify(localConfig);
            // Close panel after explicit save
            onClose();
        }
    }, [node, localConfig, onUpdate, onClose]);

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (node) {
            onDelete(node.id);
            onClose();
        }
        setShowDeleteConfirm(false);
    };

    if (!isOpen || !node) return null;

    // Render form based on node kind
    const renderForm = () => {
        switch (node.kind) {
            case 'trigger': {
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuInfo className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Workflow Starting Point</strong>
                                    <p className="mt-1 opacity-80">Choose how this workflow should be triggered.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <LuUser className="w-4 h-4 text-cyan-glow" />
                                    Case Intake
                                </h3>

                                <FormField label="Case Name" icon={<LuUser className="w-3 h-3" />}>
                                    <TextInput
                                        value={getString(localConfig, 'name')}
                                        onChange={(val) => handleChange('name', val)}
                                        placeholder="e.g. Case-AML-1042"
                                        icon={<LuUser className="w-4 h-4" />}
                                    />
                                </FormField>

                                <FormField label="Contact Email" icon={<LuMail className="w-3 h-3" />}>
                                    <TextInput
                                        value={getString(localConfig, 'email')}
                                        onChange={(val) => handleChange('email', val)}
                                        placeholder="e.g. alerts@bankflow.local"
                                        icon={<LuMail className="w-4 h-4" />}
                                    />
                                </FormField>

                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Queue">
                                        <Select
                                            value={getString(localConfig, 'department')}
                                            onChange={(val) => handleChange('department', val)}
                                            options={[
                                                { value: '', label: 'Select queue...' },
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
                                        <TextInput
                                            value={getString(localConfig, 'role')}
                                            onChange={(val) => handleChange('role', val)}
                                            placeholder="e.g. Payment Exception Review"
                                        />
                                    </FormField>
                                </div>

                                {getString(localConfig, 'department') === 'Other' && (
                                    <FormField label="Custom Queue">
                                        <TextInput
                                            value={getString(localConfig, 'customDepartment')}
                                            onChange={(val) => handleChange('customDepartment', val)}
                                            placeholder="Enter queue name"
                                        />
                                    </FormField>
                                )}

                                <FormField label="Requested Date" icon={<LuCalendar className="w-3 h-3" />}>
                                    <div className="relative">
                                        <DatePicker
                                            selected={getString(localConfig, 'startDate') ? new Date(getString(localConfig, 'startDate')) : null}
                                            onChange={(date: Date | null) => {
                                                if (date) {
                                                    const year = date.getFullYear();
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    handleChange('startDate', `${year}-${month}-${day}`);
                                                } else {
                                                    handleChange('startDate', '');
                                                }
                                            }}
                                            dateFormat="MMMM d, yyyy"
                                            placeholderText="Click to select date"
                                            className="w-full bg-navy-950 border border-white/10 rounded-lg px-2.5 py-1.5 pl-7 text-sm text-white focus:border-cyan-glow focus:outline-none transition-colors cursor-pointer"
                                            calendarClassName="bg-navy-900 border border-white/10 rounded-xl shadow-2xl"
                                            wrapperClassName="w-full"
                                            showPopperArrow={false}
                                        />
                                        <LuCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                    </div>
                                </FormField>
                            </div>
                    </div>
                );
            }

            case 'email': {
                const recipientType = getString(localConfig, 'recipientType', 'case_contact');
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuMail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Send Email Notification</strong>
                                    <p className="mt-1 opacity-80">This step will send an email when the workflow reaches this point.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">Who should receive this email?</h3>

                            <div className="space-y-2">
                                <QuickActionButton
                                    label="Case Contact"
                                    description="Send to the contact email from intake"
                                    icon={<LuUser className="w-4 h-4" />}
                                    onClick={() => {
                                        handleChange('recipientType', 'case_contact');
                                        handleChange('to', '{{trigger.email}}');
                                    }}
                                    selected={recipientType === 'case_contact'}
                                />
                                <QuickActionButton
                                    label="Custom Recipient"
                                    description="Enter a specific email address"
                                    icon={<LuMail className="w-4 h-4" />}
                                    onClick={() => {
                                        handleChange('recipientType', 'custom');
                                        handleChange('to', '');
                                    }}
                                    selected={recipientType === 'custom'}
                                />
                            </div>

                            {recipientType === 'custom' && (
                                <FormField label="Email Address">
                                    <SmartField
                                        value={getString(localConfig, 'to')}
                                        onChange={(val) => handleChange('to', val)}
                                        placeholder="e.g. operations@bankflow.local"
                                    />
                                </FormField>
                            )}

                            <FormField label="Subject Line">
                                <TextInput
                                    value={getString(localConfig, 'subject')}
                                    onChange={(val) => handleChange('subject', val)}
                                    placeholder="e.g. Case update available"
                                />
                            </FormField>

                            <FormField label="Email Body" hint="Write your message below">
                                <TextArea
                                    rows={6}
                                    value={getString(localConfig, 'body')}
                                    onChange={(val) => handleChange('body', val)}
                                    placeholder="Hello,

Your case has moved to the next review stage.

Best regards,
Operations Team"
                                />
                            </FormField>

                            <div className="flex flex-wrap gap-2">
                                {[
                                    'Case update available',
                                    'Action required on your case',
                                    'Review completed',
                                    'Escalation notice',
                                ].map((template) => (
                                    <button
                                        key={template}
                                        type="button"
                                        onClick={() => handleChange('subject', template)}
                                        className="text-xs bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors"
                                    >
                                        {template}
                                    </button>
                                ))}
                            </div>

                            <InfoBox variant="tip">
                                <strong>Tip:</strong> You can personalize the email with values like case name, queue, case type, or requested date.
                            </InfoBox>
                        </div>
                    </div>
                );
            }

            case 'http': {
                const useCase = getString(localConfig, 'useCase', 'custom');
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuGlobe className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Connect to External Service</strong>
                                    <p className="mt-1 opacity-80">Send data to another system or service when this step runs.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">What do you want to do?</h3>

                            <div className="space-y-2">
                                <QuickActionButton
                                    label="Notify Slack Channel"
                                    description="Send a message to a Slack channel"
                                    icon={<LuMessageSquare className="w-4 h-4" />}
                                    onClick={() => {
                                        handleChange('useCase', 'slack');
                                        handleChange('method', 'POST');
                                        handleChange('url', '');
                                        handleChange('headers', [{ key: 'Content-Type', value: 'application/json' }]);
                                    }}
                                    selected={useCase === 'slack'}
                                />
                                <QuickActionButton
                                    label="Update Case System"
                                    description="Send case intake data to an external platform"
                                    icon={<LuDatabase className="w-4 h-4" />}
                                    onClick={() => {
                                        handleChange('useCase', 'case_api');
                                        handleChange('method', 'POST');
                                    }}
                                    selected={useCase === 'case_api'}
                                />
                                <QuickActionButton
                                    label="Custom API Request"
                                    description="Configure a custom HTTP request"
                                    icon={<LuZap className="w-4 h-4" />}
                                    onClick={() => handleChange('useCase', 'custom')}
                                    selected={useCase === 'custom'}
                                />
                            </div>

                            {useCase === 'slack' && (
                                <>
                                    <FormField label="Slack Webhook URL" hint="Get this from your Slack app settings">
                                        <SmartField
                                            value={getString(localConfig, 'url')}
                                            onChange={(val) => handleChange('url', val)}
                                            placeholder="https://hooks.slack.com/services/..."
                                        />
                                    </FormField>
                                    <FormField label="Message">
                                        <SmartField
                                            rows={3}
                                            value={getString(localConfig, 'slackMessage') || getString(localConfig, 'body')}
                                            onChange={(val) => {
                                                handleChange('slackMessage', val);
                                                handleChange('body', JSON.stringify({ text: val }));
                                            }}
                                            placeholder="New payment exception case entered the queue"
                                        />
                                    </FormField>
                                </>
                            )}

                            {useCase === 'case_api' && (
                                <>
                                    <FormField label="API Endpoint URL" hint="The URL of your case platform or service">
                                        <SmartField
                                            value={getString(localConfig, 'url')}
                                            onChange={(val) => handleChange('url', val)}
                                            placeholder="https://api.yourplatform.com/cases"
                                        />
                                    </FormField>
                                    <InfoBox variant="success">
                                        Trigger data from the intake step will be available for this request.
                                    </InfoBox>
                                </>
                            )}

                            {useCase === 'custom' && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <FormField label="Method">
                                            <Select
                                                value={getString(localConfig, 'method', 'GET')}
                                                onChange={(val) => handleChange('method', val)}
                                                options={[
                                                    { value: 'GET', label: 'GET' },
                                                    { value: 'POST', label: 'POST' },
                                                    { value: 'PUT', label: 'PUT' },
                                                    { value: 'DELETE', label: 'DELETE' },
                                                ]}
                                            />
                                        </FormField>
                                        <div className="col-span-2">
                                            <FormField label="URL">
                                                <SmartField
                                                    value={getString(localConfig, 'url')}
                                                    onChange={(val) => handleChange('url', val)}
                                                    placeholder="https://api.example.com/endpoint"
                                                />
                                            </FormField>
                                        </div>
                                    </div>

                                    {(getString(localConfig, 'method') === 'POST' || getString(localConfig, 'method') === 'PUT') && (
                                        <FormField label="Request Data" hint="The data to send (JSON format)">
                                            <SmartField
                                                rows={4}
                                                value={getString(localConfig, 'body')}
                                                onChange={(val) => handleChange('body', val)}
                                                placeholder='{"name": "value"}'
                                            />
                                        </FormField>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                );
            }

            case 'database': {
                const operation = getString(localConfig, 'operation', 'query');
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuDatabase className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Database Operation</strong>
                                    <p className="mt-1 opacity-80">Read or write data from your HR database.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">What do you want to do?</h3>

                            <div className="space-y-2">
                                <QuickActionButton
                                    label="Look Up Records"
                                    description="Search and retrieve data from a table"
                                    icon={<LuDatabase className="w-4 h-4" />}
                                    onClick={() => handleChange('operation', 'query')}
                                    selected={operation === 'query'}
                                />
                                <QuickActionButton
                                    label="Add New Record"
                                    description="Insert a new row into a table"
                                    icon={<LuPlus className="w-4 h-4" />}
                                    onClick={() => handleChange('operation', 'create')}
                                    selected={operation === 'create'}
                                />
                                <QuickActionButton
                                    label="Update Existing Record"
                                    description="Modify data in an existing row"
                                    icon={<LuArrowRight className="w-4 h-4" />}
                                    onClick={() => handleChange('operation', 'update')}
                                    selected={operation === 'update'}
                                />
                            </div>

                            <FormField label="Select Table" icon={<LuDatabase className="w-3 h-3" />}>
                                <Select
                                    value={getString(localConfig, 'table')}
                                    onChange={(val) => handleChange('table', val)}
                                    options={[
                                        { value: '', label: 'Choose a table...' },
                                        ...databaseTables.map(t => ({
                                            value: t.name,
                                            label: t.label,
                                            description: t.description
                                        }))
                                    ]}
                                    icon={<LuDatabase className="w-4 h-4" />}
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
                                            <SmartField
                                                value={getString(localConfig, 'whereClause')}
                                                onChange={(val) => handleChange('whereClause', val)}
                                                placeholder="e.g. department = 'Engineering'"
                                            />
                                        </div>
                                    )}
                                </FormField>
                            )}

                            {operation !== 'query' && (
                                <InfoBox variant="success">
                                    Trigger data from the intake step can be mapped into record fields.
                                </InfoBox>
                            )}
                        </div>
                    </div>
                );
            }

            case 'condition': {
                const operator = getString(localConfig, 'operator', 'equals');
                const checkField = getString(localConfig, 'checkField', 'department');
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Decision Point</strong>
                                    <p className="mt-1 opacity-80">Split the workflow based on a condition. Different paths will be taken depending on the result.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">Set Up Your Condition</h3>

                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                <div className="text-sm text-slate-300">
                                    <span className="text-white font-medium">IF</span> the case data...
                                </div>

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
                                    <Select
                                        value={operator}
                                        onChange={(val) => handleChange('operator', val)}
                                        options={CONDITION_OPERATORS}
                                    />
                                </FormField>

                                {!['is_empty', 'is_not_empty'].includes(operator) && (
                                    <FormField label="Value">
                                        <SmartField
                                            value={getString(localConfig, 'value')}
                                            onChange={(val) => handleChange('value', val)}
                                            placeholder={checkField === 'department' ? 'e.g. Engineering' : 'Enter value...'}
                                        />
                                    </FormField>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                                        <LuCheck className="w-4 h-4" />
                                        If TRUE
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Continue to the next step</p>
                                </div>
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                        <LuX className="w-4 h-4" />
                                        If FALSE
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Take alternate path</p>
                                </div>
                            </div>

                            <InfoBox variant="tip">
                                <strong>Tip:</strong> Connect two separate paths from this node - one for when the condition is true, and one for when it's false.
                            </InfoBox>
                        </div>
                    </div>
                );
            }

            case 'cv_parser': {
                const extractFields = getStringArray(localConfig, 'extractFields');
                const fileId = getString(localConfig, 'fileId', '');
                const fileName = getString(localConfig, 'fileName', '');

                const handleFileUpload = async (file: File) => {
                    setIsUploading(true);
                    setUploadError(null);
                    try {
                        const response = await apiUploadFile('/files/upload', file);
                        if (response.success) {
                            handleChange('fileId', response.file.id);
                            handleChange('fileName', response.file.originalName);
                        }
                    } catch (err) {
                        setUploadError(err instanceof Error ? err.message : 'Upload failed');
                    } finally {
                        setIsUploading(false);
                    }
                };

                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuFile className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>CV/Resume Parser</strong>
                                    <p className="mt-1 opacity-80">Extract information from a CV or resume file automatically.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">Upload CV/Resume</h3>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.doc"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                }}
                                className="hidden"
                            />

                            <div
                                onClick={() => !isUploading && fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                                    isUploading
                                        ? 'border-cyan-glow/50 bg-cyan-glow/5'
                                        : fileId
                                            ? 'border-emerald-500/30 bg-emerald-500/5'
                                            : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                                }`}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    {isUploading ? (
                                        <>
                                            <div className="w-12 h-12 rounded-xl bg-cyan-glow/20 flex items-center justify-center">
                                                <LuLoader className="w-6 h-6 text-cyan-glow animate-spin" />
                                            </div>
                                            <div className="text-sm text-cyan-glow">Uploading...</div>
                                        </>
                                    ) : fileId && fileName ? (
                                        <>
                                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                                <LuFile className="w-6 h-6 text-emerald-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{fileName}</div>
                                                <div className="text-xs text-slate-500 mt-1">Click to change file</div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                                                <LuUpload className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">Drop file here or click to upload</div>
                                                <div className="text-xs text-slate-500 mt-1">PDF or DOCX (max 10MB)</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {uploadError && (
                                <InfoBox variant="error">
                                    <strong>Upload failed:</strong> {uploadError}
                                </InfoBox>
                            )}

                            <FormField label="Information to Extract" hint="Select what you want to pull from the CV">
                                <CheckboxGroup
                                    options={CV_PARSER_FIELDS}
                                    selected={extractFields}
                                    onChange={(selected) => handleChange('extractFields', selected)}
                                />
                            </FormField>

                            {extractFields.length > 0 && (
                                <InfoBox variant="success">
                                    <strong>Extracted data will include:</strong>
                                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                                        {extractFields.map((field: string) => (
                                            <li key={field}>{CV_PARSER_FIELDS.find(f => f.value === field)?.label || field}</li>
                                        ))}
                                    </ul>
                                </InfoBox>
                            )}
                        </div>
                    </div>
                );
            }

            case 'wait': {
                const duration = getNumber(localConfig, 'duration', 30);
                const unit = getString(localConfig, 'unit', 'seconds');
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuClock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Pause Workflow</strong>
                                    <p className="mt-1 opacity-80">Wait for a specified amount of time before continuing to the next step.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">How long should we wait?</h3>

                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Duration">
                                    <NumberInput
                                        value={duration}
                                        onChange={(val) => handleChange('duration', val)}
                                        min={1}
                                    />
                                </FormField>
                                <FormField label="Unit">
                                    <Select
                                        value={unit}
                                        onChange={(val) => handleChange('unit', val)}
                                        options={[
                                            { value: 'seconds', label: 'Seconds' },
                                            { value: 'minutes', label: 'Minutes' },
                                            { value: 'hours', label: 'Hours' },
                                        ]}
                                    />
                                </FormField>
                            </div>

                            <InfoBox variant="warning">
                                <div className="flex items-center gap-2">
                                    <LuClock className="w-4 h-4" />
                                    <span>
                                        The workflow will pause for <strong>{duration} {unit}</strong> before continuing.
                                    </span>
                                </div>
                            </InfoBox>
                        </div>
                    </div>
                );
            }

            case 'logger':
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuMessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Add Log Entry</strong>
                                    <p className="mt-1 opacity-80">Record a message in the workflow execution log for tracking and debugging.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">What should we log?</h3>

                            <FormField label="Message Type">
                                <Select
                                    value={getString(localConfig, 'level', 'info')}
                                    onChange={(val) => handleChange('level', val)}
                                    options={[
                                        { value: 'info', label: 'Information - General status update' },
                                        { value: 'warn', label: 'Warning - Something to watch' },
                                        { value: 'error', label: 'Error - Something went wrong' },
                                    ]}
                                />
                            </FormField>

                            <FormField label="Log Message" hint="This message will be recorded in the execution history">
                                <TextArea
                                    rows={3}
                                    value={getString(localConfig, 'message')}
                                    onChange={(val) => handleChange('message', val)}
                                    placeholder="e.g. Case review started and assigned"
                                />
                            </FormField>

                            <div className="text-xs text-slate-500">
                                <strong>Quick templates:</strong>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    'Workflow step completed',
                                    'Processing case data',
                                    'Sending notification',
                                    'Task completed successfully',
                                ].map((template) => (
                                    <button
                                        key={template}
                                        type="button"
                                        onClick={() => handleChange('message', template)}
                                        className="px-2.5 py-1 text-xs rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                    >
                                        {template}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'datetime': {
                const dtOperation = getString(localConfig, 'operation', 'now');
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuCalendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Date & Time Operation</strong>
                                    <p className="mt-1 opacity-80">Work with dates and times in your workflow.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">What do you want to do?</h3>

                            <div className="space-y-2">
                                <QuickActionButton
                                    label="Get Current Date/Time"
                                    description="Capture the current moment"
                                    icon={<LuClock className="w-4 h-4" />}
                                    onClick={() => handleChange('operation', 'now')}
                                    selected={dtOperation === 'now'}
                                />
                                <QuickActionButton
                                    label="Calculate Future Date"
                                    description="Add days/hours to a date"
                                    icon={<LuPlus className="w-4 h-4" />}
                                    onClick={() => handleChange('operation', 'add')}
                                    selected={dtOperation === 'add'}
                                />
                                <QuickActionButton
                                    label="Calculate Past Date"
                                    description="Subtract days/hours from a date"
                                    icon={<LuMinus className="w-4 h-4" />}
                                    onClick={() => handleChange('operation', 'subtract')}
                                    selected={dtOperation === 'subtract'}
                                />
                                <QuickActionButton
                                    label="Format Date"
                                    description="Change how a date is displayed"
                                    icon={<LuCalendar className="w-4 h-4" />}
                                    onClick={() => handleChange('operation', 'format')}
                                    selected={dtOperation === 'format'}
                                />
                            </div>

                            {(dtOperation === 'add' || dtOperation === 'subtract') && (
                                <>
                                    <FormField label="Starting From">
                                        <Select
                                            value={getString(localConfig, 'inputField', 'trigger.startDate')}
                                            onChange={(val) => handleChange('inputField', `{{${val}}}`)}
                                            options={[
                                                { value: 'trigger.startDate', label: "Requested Date" },
                                                { value: 'now', label: "Current Date/Time" },
                                            ]}
                                        />
                                    </FormField>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField label={dtOperation === 'add' ? 'Add' : 'Subtract'}>
                                            <NumberInput
                                                value={getNumber(localConfig, 'value', 1)}
                                                onChange={(val) => handleChange('value', val)}
                                                min={1}
                                            />
                                        </FormField>
                                        <FormField label="Unit">
                                            <Select
                                                value={getString(localConfig, 'unit', 'days')}
                                                onChange={(val) => handleChange('unit', val)}
                                                options={[
                                                    { value: 'days', label: 'Days' },
                                                    { value: 'hours', label: 'Hours' },
                                                    { value: 'minutes', label: 'Minutes' },
                                                ]}
                                            />
                                        </FormField>
                                    </div>
                                </>
                            )}

                            {dtOperation === 'format' && (
                                <FormField label="Date to Format">
                                    <Select
                                        value={getString(localConfig, 'inputField', 'trigger.startDate')}
                                        onChange={(val) => handleChange('inputField', `{{${val}}}`)}
                                        options={[
                                            { value: 'trigger.startDate', label: "Requested Date" },
                                            { value: 'now', label: "Current Date/Time" },
                                        ]}
                                    />
                                </FormField>
                            )}

                            <FormField label="Output Format">
                                <Select
                                    value={getString(localConfig, 'format', 'YYYY-MM-DD')}
                                    onChange={(val) => handleChange('format', val)}
                                    options={[
                                        { value: 'YYYY-MM-DD', label: '2025-12-21 (Standard)' },
                                        { value: 'DD/MM/YYYY', label: '21/12/2025 (UK Format)' },
                                        { value: 'MM/DD/YYYY', label: '12/21/2025 (US Format)' },
                                        { value: 'MMMM D, YYYY', label: 'December 21, 2025 (Readable)' },
                                    ]}
                                />
                            </FormField>

                            <FormField label="Save Result As" hint="Name this so you can use it later">
                                <TextInput
                                    value={getString(localConfig, 'outputField', 'calculatedDate')}
                                    onChange={(val) => handleChange('outputField', val)}
                                    placeholder="calculatedDate"
                                />
                            </FormField>
                        </div>
                    </div>
                );
            }

            case 'variable': {
                const variableAction = getString(localConfig, 'variableAction', 'store');
                return (
                    <div className="space-y-5">
                        <InfoBox variant="info">
                            <div className="flex items-start gap-2">
                                <LuZap className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Store Data for Later</strong>
                                    <p className="mt-1 opacity-80">Save information that you want to use in later steps of this workflow.</p>
                                </div>
                            </div>
                        </InfoBox>

                        <div className="space-y-4 border-t border-white/5 pt-4">
                            <h3 className="text-sm font-bold text-white">What do you want to store?</h3>

                            <div className="space-y-2">
                                <QuickActionButton
                                    label="Custom Value"
                                    description="Enter a specific value to save"
                                    icon={<LuPlus className="w-4 h-4" />}
                                    onClick={() => handleChange('variableAction', 'store')}
                                    selected={variableAction === 'store'}
                                />
                                <QuickActionButton
                                    label="Copy from Trigger Data"
                                    description="Save case intake values for later use"
                                    icon={<LuUser className="w-4 h-4" />}
                                    onClick={() => handleChange('variableAction', 'copy')}
                                    selected={variableAction === 'copy'}
                                />
                            </div>

                            {variableAction === 'store' && (
                                <>
                                    <FormField label="Variable Name" hint="A short name to identify this data">
                                        <TextInput
                                            value={getString(localConfig, 'variableName')}
                                            onChange={(val) => handleChange('variableName', val)}
                                            placeholder="e.g. approvalStatus"
                                        />
                                    </FormField>
                                    <FormField label="Value">
                                        <TextInput
                                            value={getString(localConfig, 'variableValue')}
                                            onChange={(val) => handleChange('variableValue', val)}
                                            placeholder="e.g. pending"
                                        />
                                    </FormField>
                                </>
                            )}

                            {variableAction === 'copy' && (
                                <>
                                    <FormField label="What to Copy">
                                        <Select
                                            value={getString(localConfig, 'copyField', 'email')}
                                            onChange={(val) => handleChange('copyField', val)}
                                            options={[
                                                { value: 'email', label: 'Contact Email' },
                                                { value: 'name', label: 'Case Name' },
                                                { value: 'department', label: 'Queue' },
                                                { value: 'role', label: 'Case Type' },
                                                { value: 'startDate', label: 'Requested Date' },
                                            ]}
                                        />
                                    </FormField>
                                    <FormField label="Save As" hint="Name for this stored value">
                                        <TextInput
                                            value={getString(localConfig, 'variableName')}
                                            onChange={(val) => handleChange('variableName', val)}
                                            placeholder="e.g. savedEmail"
                                        />
                                    </FormField>
                                </>
                            )}

                            <InfoBox variant="tip">
                                <strong>Example use:</strong> Store an approval status here, then use a Condition node later to check it and take different actions.
                            </InfoBox>
                        </div>
                    </div>
                );
            }

            default:
                return (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                        Configuration for <strong>{node.kind}</strong> is not yet available.
                    </div>
                );
        }
    };

    return (
        <>
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-4 top-4 bottom-4 w-[420px] bg-navy-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/5">
                    <div>
                        <h2 className="text-lg font-bold text-white">{node.name || 'Configure Step'}</h2>
                        <span className="text-xs text-cyan-glow uppercase tracking-wider font-semibold">{node.kind.replace('_', ' ')}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <LuX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content (Form) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    {/* Node-specific forms */}
                    {renderForm()}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-transparent space-y-2">
                    {/* Keyboard hints */}
                    <div className="flex justify-center gap-3 text-[9px] text-slate-500 font-mono">
                        <span><kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Esc</kbd> Close</span>
                        <span><kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Ctrl+S</kbd> Save</span>
                        <span><kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Tab</kbd> Navigate</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDeleteClick}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5"
                            tabIndex={0}
                        >
                            <LuTrash2 className="w-3.5 h-3.5" />
                            Delete
                        </button>

                        <button
                            onClick={handleSave}
                            className="flex-[2] px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-glow text-navy-950 hover:bg-white transition-all flex items-center justify-center gap-1.5"
                            tabIndex={0}
                        >
                            <LuCheck className="w-3.5 h-3.5" />
                            Done
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl space-y-4">
                        <h3 className="text-xl font-bold text-white">Delete Step?</h3>
                        <p className="text-slate-300 text-sm">
                            Are you sure you want to delete this step? This action cannot be undone and will remove connected edges.
                        </p>
                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                Delete Step
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ConfigPanel;
