/**
 * Shared UI primitives: Tooltip, ExplainerNote.
 */
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";

interface TooltipProps {
  content: string | undefined | null;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
}

// ---------------------------------------------------------------------------
// ExplainerNote — styled callout for contextual help text
// ---------------------------------------------------------------------------

export function ExplainerNote({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`studio-tab-explainer ${className}`}>
      <span className="text-[12px]" style={{ color: "var(--studio-text-dimmed)", lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={300} skipDelayDuration={100}>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration,
}: TooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="studio-tooltip"
          side={side}
          align={align}
          sideOffset={4}
        >
          {content}
          <RadixTooltip.Arrow className="studio-tooltip-arrow" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
