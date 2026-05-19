import React from "react";
import { cn } from "../../lib/utils";

interface CommandBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const CommandBar = React.forwardRef<HTMLInputElement, CommandBarProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className={cn("relative flex items-center", className)}>
        {icon && (
          <div className="absolute left-3 text-[#868788]">{icon}</div>
        )}
        <input
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-[10px] border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.04] py-2 text-sm text-[#020201] shadow-sm transition-colors",
            "placeholder:text-[#8f8f8f]",
            "focus-visible:outline-none focus-visible:border-[#0f1012]/[0.18] focus-visible:ring-1 focus-visible:ring-[#0071e3]/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            icon ? "pl-9 pr-4" : "px-4"
          )}
          {...props}
        />
      </div>
    );
  }
);
CommandBar.displayName = "CommandBar";

export { CommandBar };
