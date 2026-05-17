import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/18 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-[#e6e6e6] text-[#2f3031] hover:bg-white active:scale-[0.98] shadow-[rgba(0,0,0,0.03)_0px_7px_3px_0px,rgba(0,0,0,0.25)_0px_4px_4px_0px]",
        secondary:
          "bg-[#1b1c1e] text-white border border-white/[0.08] hover:bg-[#111214] hover:border-white/[0.18] active:scale-[0.98]",
        ghost:
          "bg-transparent text-[#9c9c9d] hover:text-white hover:bg-white/5",
        danger:
          "bg-transparent text-[#ff6363] border border-[#ff6363]/20 hover:bg-[#452324]/30 hover:border-[#ff6363]/40 active:scale-[0.98]",
        key: "bg-transparent text-[#6a6b6c] rounded-full px-5 py-5 shadow-[rgba(0,0,0,0.4)_0px_1.5px_0.5px_2.5px,rgb(0,0,0)_0px_0px_0.5px_1px,rgba(0,0,0,0.25)_0px_2px_1px_1px_inset,rgba(255,255,255,0.2)_0px_1px_1px_1px_inset] hover:text-white transition-colors",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 py-2",
        lg: "h-10 px-5 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
