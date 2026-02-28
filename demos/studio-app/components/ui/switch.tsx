"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      ref={ref}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-xl border-[10px] border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 border-4 leading-snug opacity-100",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <SwitchThumb checked={checked} />
    </button>
  )
);
Switch.displayName = "Switch";

function SwitchThumb({ checked }: { checked: boolean }) {
  return (
    <span
      data-slot="switch-thumb"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
        checked ? "translate-x-5" : "translate-x-0"
      )}
    />
  );
}

export { Switch };
