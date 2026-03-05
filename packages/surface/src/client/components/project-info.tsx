/**
 * ProjectInfo — shows detected framework + styling system below the project name,
 * with a popover for additional scan details.
 */
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { useFramework, useStyling, useComponents, useTokens } from "../lib/scan-hooks.js";
import type { FrameworkInfo } from "../../server/lib/detect-framework.js";
import type { StylingSystem } from "../../server/lib/detect-styling.js";

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

const frameworkLabels: Record<FrameworkInfo["name"], string> = {
  nextjs: "Next.js",
  vite: "Vite",
  remix: "Remix",
  astro: "Astro",
  svelte: "SvelteKit",
  unknown: "Unknown",
};

const stylingLabels: Record<StylingSystem["type"], string> = {
  "tailwind-v4": "Tailwind v4",
  "tailwind-v3": "Tailwind v3",
  css: "CSS",
};

// ---------------------------------------------------------------------------
// ProjectInfo
// ---------------------------------------------------------------------------

export function ProjectInfo({ targetPort }: { targetPort: number }) {
  const [open, setOpen] = useState(false);
  const framework = useFramework();
  const styling = useStyling();
  const components = useComponents();
  const tokens = useTokens();

  if (!framework && !styling) return null;

  const fwLabel = framework ? frameworkLabels[framework.name] : null;
  const stLabel = styling ? stylingLabels[styling.type] : null;
  const subtitle = [fwLabel, stLabel].filter(Boolean).join(" + ");

  if (!subtitle) return null;

  // Build popover rows
  const rows: { label: string; value: string }[] = [];

  if (framework) {
    rows.push({ label: "Framework", value: frameworkLabels[framework.name] });
    if (framework.appDir && framework.appDirExists) {
      rows.push({ label: "App directory", value: framework.appDir });
    }
    if (framework.componentDir && framework.componentDirExists) {
      rows.push({
        label: "Components",
        value: `${framework.componentDir} (${framework.componentFileCount} files)`,
      });
    }
  }

  if (styling) {
    rows.push({ label: "Styling", value: stylingLabels[styling.type] });
    if (styling.cssFiles.length > 0) {
      rows.push({
        label: "CSS files",
        value: styling.cssFiles.length === 1
          ? styling.cssFiles[0].split("/").pop()!
          : `${styling.cssFiles.length} files`,
      });
    }
    if (styling.configPath) {
      rows.push({ label: "Config", value: styling.configPath.split("/").pop()! });
    }
    if (styling.hasDarkMode) {
      rows.push({ label: "Dark mode", value: "detected" });
    }
  }

  if (components) {
    rows.push({ label: "Components scanned", value: String(components.components.length) });
  }
  if (tokens) {
    rows.push({ label: "Tokens scanned", value: String(tokens.tokens.length) });
  }

  rows.push({ label: "Target port", value: String(targetPort) });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="text-left w-full mb-0.5 group "
          style={{ lineHeight: 1 }}
        >
          <span
            className="text-[9px] font-mono tracking-wide hover:underline cursor-pointer"
            style={{ color: "var(--studio-text-dimmed)" }}
          >
            {subtitle}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="studio-popover"
          side="bottom"
          align="start"
          sideOffset={8}
          style={{ width: 260, padding: 0 }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div
            className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-widest"
            style={{
              borderColor: "var(--studio-border-subtle)",
              color: "var(--studio-text-muted)",
            }}
          >
            Project details
          </div>
          <div className="py-1.5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between px-3 py-[3px]"
              >
                <span
                  className="text-[10px]"
                  style={{ color: "var(--studio-text-dimmed)" }}
                >
                  {row.label}
                </span>
                <span
                  className="text-[10px] font-mono text-right ml-3 truncate"
                  style={{
                    color: "var(--studio-text-secondary)",
                    maxWidth: 140,
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
