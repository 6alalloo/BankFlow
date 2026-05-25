import React from "react";
import { cn } from "../../lib/utils";

interface CardProps extends React.ComponentPropsWithRef<"div"> {
  as?: "div" | "section" | "article";
  variant?: "default" | "ghost";
}

function Card({ className, as: Component = "div", variant = "default", ref, ...props }: CardProps) {
  return (
    <Component
      ref={ref}
      className={cn(
        "rounded-[10px] border border-[#0f1012]/[0.08] bg-[#fdfdfd] text-[#0f1012] shadow-card",
        variant === "ghost" && "bg-transparent border-transparent shadow-none",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ref, ...props }: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-5", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ref, children, ...props }: React.ComponentPropsWithRef<"h3">) {
  return (
    <h3
      ref={ref}
      className={cn("font-medium leading-none tracking-tight text-[#0f1012]", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

function CardDescription({ className, ref, ...props }: React.ComponentPropsWithRef<"p">) {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-[#8f8f8f]", className)}
      {...props}
    />
  );
}

function CardContent({ className, ref, ...props }: React.ComponentPropsWithRef<"div">) {
  return <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />;
}

function CardFooter({ className, ref, ...props }: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-5 pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
