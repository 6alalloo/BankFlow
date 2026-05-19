import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[10px] px-2.5 py-0.5 text-xs font-normal tracking-tight transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#f2f2f4] text-[#0f1012] border border-[#0f1012]/[0.08]",
        secondary: "bg-[#fdfdfd] text-[#8f8f8f] border border-[#0f1012]/[0.08]",
        outline: "border border-[#0f1012]/[0.14] text-[#0f1012] bg-transparent",
        future: "bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/15",
        success: "bg-[#e8f5e9] text-[#1b5e20] border border-[#1b5e20]/15",
        danger: "bg-[#ffebee] text-[#b71c1c] border border-[#b71c1c]/15",
        warning: "bg-[#fff8e1] text-[#f57f17] border border-[#f57f17]/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
