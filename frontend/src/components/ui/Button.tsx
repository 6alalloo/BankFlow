import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/25 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-[#0f1012] text-white hover:bg-[#020201] active:scale-[0.98]",
        secondary:
          "bg-[#fdfdfd] text-[#0f1012] border border-[#0f1012]/10 hover:border-[#0f1012]/20 hover:bg-white active:scale-[0.98] shadow-subtle",
        ghost:
          "bg-transparent text-[#8f8f8f] hover:text-[#0f1012] hover:bg-[#0f1012]/[0.04]",
        danger:
          "bg-transparent text-[#b71c1c] border border-[#b71c1c]/20 hover:bg-[#ffebee] hover:border-[#b71c1c]/40 active:scale-[0.98]",
        key: "bg-transparent text-[#868788] rounded-full px-5 py-5 shadow-subtle hover:text-[#0f1012] transition-colors",
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
  extends React.ComponentPropsWithRef<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, ref, ...props }: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
}

export { Button };
