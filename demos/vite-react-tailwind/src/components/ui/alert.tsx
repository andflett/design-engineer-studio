import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border text-sm",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        destructive: "border-destructive/50 text-destructive bg-destructive/5 [&>svg]:text-destructive",
        success: "border-primary/50 bg-primary/5 text-foreground [&>svg]:text-primary",
        warning: "border-yellow-500/50 bg-yellow-500/5 text-yellow-700 [&>svg]:text-yellow-600",
      },
      size: {
        sm: "px-3 py-2 text-xs",
        default: "px-4 py-3",
        lg: "px-5 py-4",
      },
      border: {
        default: "border",
        thick: "border-2",
        left: "border-l-4 border-y-0 border-r-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      border: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, size, border, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    data-slot="alert"
    className={cn(alertVariants({ variant, size, border }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    data-slot="alert-title"
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="alert-description"
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
