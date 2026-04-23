import React from 'react';
import { LuZap, LuPenTool, LuChevronDown } from 'react-icons/lu';
import { TRIGGER_VARIABLES } from './VariableGrid';

interface SmartFieldProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    label?: string; // Optional internal label if needed, usually handled by parent
    rows?: number; // If set, renders as textarea in Custom mode
}

const SmartField: React.FC<SmartFieldProps> = ({ value, onChange, placeholder, rows }) => {
    // Determine mode based on whether the value matches a known variable exactly
    const matchedVariable = TRIGGER_VARIABLES.find(v => v.value === value);
    const mode = matchedVariable ? 'variable' : 'custom';

    const handleModeSwitch = (newMode: 'variable' | 'custom') => {
        if (newMode === 'variable') {
            // If switching to variable, default to the first one if current value isn't a variable
            if (!matchedVariable) {
                onChange(TRIGGER_VARIABLES[0].value);
            }
        } else {
            // If switching to custom, keep the current value (even if it was a variable string)
            // This allows users to "break out" of variable mode to edit the raw string if they really want to
        }
    };

    return (
        <div className="space-y-2">
            {/* Mode Toggles */}
            <div className="flex bg-navy-950 p-1 rounded-lg border border-white/10 w-full">
                <button
                    type="button"
                    onClick={() => handleModeSwitch('variable')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                        mode === 'variable'
                            ? 'bg-cyan-glow/20 text-cyan-glow shadow-sm'
                            : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <LuZap className="w-3 h-3" />
                    Pick Variable
                </button>
                <button
                    type="button"
                    onClick={() => handleModeSwitch('custom')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                        mode === 'custom'
                            ? 'bg-purple-500/20 text-purple-300 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <LuPenTool className="w-3 h-3" />
                    Custom Value
                </button>
            </div>

            {/* Input Area */}
            {mode === 'variable' ? (
                <div className="relative">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-glow pointer-events-none">
                        <LuZap className="w-4 h-4" />
                    </div>
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full bg-navy-900 border border-cyan-glow/30 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:border-cyan-glow appearance-none cursor-pointer"
                        style={{
                            backgroundImage: 'none' // Remove default arrow to style custom one
                        }}
                    >
                        {TRIGGER_VARIABLES.map((v) => (
                            <option key={v.value} value={v.value}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <LuChevronDown className="w-4 h-4" />
                    </div>
                </div>
            ) : (
                <div className="relative">
                     {rows ? (
                        <textarea
                            rows={rows}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none transition-colors resize-none font-mono"
                        />
                     ) : (
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-navy-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none transition-colors font-mono"
                        />
                     )}
                </div>
            )}
        </div>
    );
};

export default SmartField;
