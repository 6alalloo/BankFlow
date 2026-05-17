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
          <div className="absolute left-3 text-[#6a6b6c]">{icon}</div>
        )}
        <input
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.05] py-2 text-sm text-white shadow-sm transition-colors",
            "placeholder:text-[#6a6b6c]",
            "focus-visible:outline-none focus-visible:border-white/[0.18] focus-visible:ring-1 focus-visible:ring-white/[0.18]",
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
