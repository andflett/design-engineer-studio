"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const switchVariants = cva(
  "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        default: "h-6 w-11",
        lg: "h-7 w-14",
      },
      variant: {
        default: "",
        accent: "",
        destructive: "",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);

const switchCheckedColors = {
  default: "bg-primary",
  accent: "bg-ring",
  destructive: "bg-destructive",
} as const;

const thumbSizes = {
  default: "h-5 w-5",
  sm: "h-4 w-4",
  lg: "h-6 w-6",
} as const;

const thumbTranslate = {
  default: "translate-x-5",
  sm: "translate-x-4",
  lg: "translate-x-7",
} as const;

interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    VariantProps<typeof switchVariants> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, size = "default", variant = "default", ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      ref={ref}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        switchVariants({ size, variant }),
        checked ? switchCheckedColors[variant || "default"] : "bg-input",
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        data-state={checked ? "checked" : "unchecked"}
        className={cn(
          "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform",
          thumbSizes[size || "default"],
          checked ? thumbTranslate[size || "default"] : "translate-x-0"
        )}
      />
    </button>
  )
);
Switch.displayName = "Switch";

export { Switch, switchVariants };
