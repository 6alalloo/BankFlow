import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[#1b1c1e] text-white border border-white/[0.08]",
        secondary: "bg-[#07080a] text-[#9c9c9d] border border-white/[0.08]",
        outline: "border border-white/[0.18] text-white bg-transparent",
        ember: "bg-[#452324] text-[#ff6363] border border-[#ff6363]/20",
        mint: "bg-[#0d2b1a] text-[#59d499] border border-[#59d499]/20",
        sky: "bg-[#0a1f33] text-[#56c2ff] border border-[#56c2ff]/20",
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
