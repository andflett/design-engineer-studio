"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const checkboxVariants = cva(
  "shrink-0 border ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
  {
    variants: {
      size: {
        sm: "h-3.5 w-3.5 rounded-sm",
        default: "h-4 w-4 rounded-sm",
        lg: "h-5 w-5 rounded",
      },
      variant: {
        default: "border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=unchecked]:bg-background",
        muted: "border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-background data-[state=unchecked]:bg-background",
        destructive: "border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground data-[state=unchecked]:bg-background",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);

interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    VariantProps<typeof checkboxVariants> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, size, variant, ...props }, ref) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      ref={ref}
      data-slot="checkbox"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(checkboxVariants({ size, variant }), className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      {checked && (
        <svg
          data-slot="checkbox-indicator"
          className="h-full w-full"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
);
Checkbox.displayName = "Checkbox";

export { Checkbox, checkboxVariants };
