import React from "react";
import { cn } from "../../lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-[10px] border border-[#0f1012]/[0.08] bg-[#0f1012]/[0.04] px-3 py-2 text-sm text-[#020201] shadow-sm transition-colors",
          "placeholder:text-[#8f8f8f]",
          "focus-visible:outline-none focus-visible:border-[#0f1012]/[0.18] focus-visible:ring-1 focus-visible:ring-[#0071e3]/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
