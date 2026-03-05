import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-secondary",
  {
    variants: {
      size: {
        sm: "h-1.5",
        default: "h-2",
        lg: "h-3",
        xl: "h-4",
      },
      variant: {
        default: "",
        gradient: "",
        muted: "",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);

interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, size, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      data-slot="progress"
      className={cn(progressVariants({ size, variant }), className)}
      {...props}
    >
      <ProgressIndicator
        variant={variant}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  )
);
Progress.displayName = "Progress";

const ProgressIndicator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "gradient" | "muted" | null;
  }
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="progress-indicator"
    className={cn(
      "h-full rounded-full transition-all",
      variant === "gradient" ? "bg-[image:var(--gradient-1)]" : variant === "muted" ? "bg-muted-foreground" : "bg-primary",
      className
    )}
    {...props}
  />
));
ProgressIndicator.displayName = "ProgressIndicator";

export { Progress, progressVariants };
