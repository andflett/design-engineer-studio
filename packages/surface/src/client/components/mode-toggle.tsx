/**
 * mode-toggle.tsx
 * AI Mode switch (Radix Switch) for the editor panel footer.
 */
import * as Switch from "@radix-ui/react-switch";
import type { WriteMode } from "../../shared/protocol.js";

interface ModeToggleProps {
  writeMode: WriteMode;
  onWriteModeChange: (mode: WriteMode) => void;
}

export function ModeToggle({ writeMode, onWriteModeChange }: ModeToggleProps) {
  const isAi = writeMode === "ai";
  return (
    <Switch.Root
      checked={isAi}
      onCheckedChange={(checked) => onWriteModeChange(checked ? "ai" : "deterministic")}
      title={isAi ? "AI mode on — changes queue as prompts" : "AI mode off — changes write instantly"}
      style={{
        width: 32,
        height: 18,
        background: isAi ? "var(--studio-accent)" : "var(--studio-border)",
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        position: "relative",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.15s",
        outline: "none",
      }}
    >
      <Switch.Thumb
        style={{
          display: "block",
          width: 14,
          height: 14,
          borderRadius: 7,
          background: "white",
          position: "absolute",
          top: 2,
          left: isAi ? 16 : 2,
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}
      />
    </Switch.Root>
  );
}
