import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground border-border",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
      size: {
        sm: "px-2 py-px text-[10px]",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
      weight: {
        normal: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
        bold: "font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      weight: "semibold",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, weight, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, weight }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
