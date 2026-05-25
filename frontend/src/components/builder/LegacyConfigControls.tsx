import React from "react";
import { LuCheck } from "react-icons/lu";

export const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}> = ({ label, children, hint, icon }) => (
  <div className="space-y-1">
    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-[#868788] uppercase tracking-wide">
      {icon && <span className="text-[#8f8f8f]">{icon}</span>}
      {label}
    </label>
    {children}
    {hint && <p className="text-[10px] text-[#868788]">{hint}</p>}
  </div>
);

export const TextInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}> = ({ value, onChange, placeholder, type = "text", icon }) => (
  <div className="relative">
    {icon && <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8f8f8f] text-sm">{icon}</div>}
    <input
      type={type}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[10px] px-2.5 py-1.5 text-sm text-[#0f1012] focus:border-[#0071e3]/40 focus:outline-none transition-colors ${icon ? "pl-8" : ""}`}
    />
  </div>
);

export const TextArea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    rows={rows}
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[10px] px-2.5 py-1.5 text-sm text-[#0f1012] focus:border-[#0071e3]/40 focus:outline-none transition-colors resize-none"
  />
);

export const Select: React.FC<{
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; description?: string }[];
  icon?: React.ReactNode;
}> = ({ value, onChange, options, icon }) => (
  <div className="relative">
    {icon && <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8f8f8f] pointer-events-none text-sm">{icon}</div>}
    <select
      value={value || options[0]?.value || ""}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-[#f2f2f4] border border-[#0f1012]/[0.08] rounded-[10px] px-2.5 py-1.5 text-sm text-[#0f1012] focus:border-[#0071e3]/40 focus:outline-none transition-colors appearance-none cursor-pointer ${icon ? "pl-8" : ""}`}
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

export const NumberInput: React.FC<{
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

export const QuickActionButton: React.FC<{
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
}> = ({ label, description, icon, onClick, selected }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full p-2 rounded-[10px] border text-left transition-all ${
      selected ? "border-[#0f1012]/[0.18] bg-[#0f1012]/[0.04] shadow-card" : "border-[#0f1012]/[0.08] hover:border-[#0f1012]/[0.14] hover:bg-[#0f1012]/[0.02]"
    }`}
  >
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-[6px] text-sm ${selected ? "bg-[#0f1012]/[0.08] text-[#0f1012]" : "bg-[#0f1012]/[0.04] text-[#868788]"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${selected ? "text-[#0f1012]" : "text-[#8f8f8f]"}`}>{label}</div>
        <div className="text-[10px] text-[#868788] truncate">{description}</div>
      </div>
      {selected && <LuCheck className="text-[#0f1012] text-sm flex-shrink-0" />}
    </div>
  </button>
);

export const InfoBox: React.FC<{
  children: React.ReactNode;
  variant?: "info" | "success" | "warning" | "tip";
}> = ({ children, variant = "info" }) => {
  const styles = {
    info: "bg-[#f2f2f4] border-[#0f1012]/[0.08] text-[#8f8f8f]",
    success: "bg-[#f2f2f4] border-[#0f1012]/[0.08] text-[#1b5e20]",
    warning: "bg-[#f2f2f4] border-[#0f1012]/[0.08] text-[#8f8f8f]",
    tip: "bg-[#f2f2f4] border-[#0f1012]/[0.08] text-[#8f8f8f]",
  };

  return <div className={`p-2 rounded-[6px] border text-[10px] ${styles[variant]}`}>{children}</div>;
};
