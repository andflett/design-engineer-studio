export interface ShadowPreset {
  name: string;
  value: string;
}

/**
 * Tailwind CSS default shadow presets.
 * These are the built-in shadows that ship with Tailwind.
 */
export const TAILWIND_SHADOW_PRESETS: ShadowPreset[] = [
  {
    name: "shadow-2xs",
    value: "0 1px rgb(0 0 0 / 0.05)",
  },
  {
    name: "shadow-xs",
    value: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  },
  {
    name: "shadow-sm",
    value: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  },
  {
    name: "shadow",
    value: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  },
  {
    name: "shadow-md",
    value: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  },
  {
    name: "shadow-lg",
    value: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  },
  {
    name: "shadow-xl",
    value: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  },
  {
    name: "shadow-2xl",
    value: "0 50px 100px -20px rgb(0 0 0 / 0.25)",
  },
  {
    name: "shadow-inner",
    value: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
  },
  {
    name: "shadow-none",
    value: "none",
  },
];

/**
 * Curated presets that ship with the shadows tool.
 * These are common shadow patterns designers use.
 */
export interface DesignPreset {
  name: string;
  label: string;
  value: string;
  category: "subtle" | "medium" | "dramatic" | "colored" | "layered";
}

export const DESIGN_PRESETS: DesignPreset[] = [
  // Subtle
  {
    name: "soft-sm",
    label: "Soft Small",
    value: "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
    category: "subtle",
  },
  {
    name: "soft-md",
    label: "Soft Medium",
    value: "0 2px 8px -2px rgb(0 0 0 / 0.05), 0 4px 12px -2px rgb(0 0 0 / 0.08)",
    category: "subtle",
  },
  {
    name: "soft-lg",
    label: "Soft Large",
    value: "0 4px 16px -4px rgb(0 0 0 / 0.08), 0 8px 24px -4px rgb(0 0 0 / 0.1)",
    category: "subtle",
  },
  // Medium
  {
    name: "card",
    label: "Card",
    value: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    category: "medium",
  },
  {
    name: "dropdown",
    label: "Dropdown",
    value: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    category: "medium",
  },
  {
    name: "modal",
    label: "Modal",
    value: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    category: "medium",
  },
  // Dramatic
  {
    name: "elevated",
    label: "Elevated",
    value: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
    category: "dramatic",
  },
  {
    name: "floating",
    label: "Floating",
    value: "0 20px 60px -15px rgb(0 0 0 / 0.3)",
    category: "dramatic",
  },
  {
    name: "deep",
    label: "Deep",
    value: "0 30px 60px -10px rgb(0 0 0 / 0.2), 0 18px 36px -18px rgb(0 0 0 / 0.15)",
    category: "dramatic",
  },
  // Layered (multiple layers for realism)
  {
    name: "layered-sm",
    label: "Layered Small",
    value: "0 1px 1px rgb(0 0 0 / 0.04), 0 2px 2px rgb(0 0 0 / 0.04), 0 4px 4px rgb(0 0 0 / 0.04)",
    category: "layered",
  },
  {
    name: "layered-md",
    label: "Layered Medium",
    value: "0 1px 1px rgb(0 0 0 / 0.03), 0 2px 2px rgb(0 0 0 / 0.03), 0 4px 4px rgb(0 0 0 / 0.03), 0 8px 8px rgb(0 0 0 / 0.03), 0 16px 16px rgb(0 0 0 / 0.03)",
    category: "layered",
  },
  {
    name: "layered-lg",
    label: "Layered Large",
    value: "0 1px 2px rgb(0 0 0 / 0.02), 0 2px 4px rgb(0 0 0 / 0.02), 0 4px 8px rgb(0 0 0 / 0.03), 0 8px 16px rgb(0 0 0 / 0.04), 0 16px 32px rgb(0 0 0 / 0.05), 0 32px 64px rgb(0 0 0 / 0.06)",
    category: "layered",
  },
  // Colored
  {
    name: "blue-glow",
    label: "Blue Glow",
    value: "0 4px 14px 0 rgb(59 130 246 / 0.3)",
    category: "colored",
  },
  {
    name: "purple-glow",
    label: "Purple Glow",
    value: "0 4px 14px 0 rgb(147 51 234 / 0.3)",
    category: "colored",
  },
  {
    name: "green-glow",
    label: "Green Glow",
    value: "0 4px 14px 0 rgb(34 197 94 / 0.3)",
    category: "colored",
  },
];
