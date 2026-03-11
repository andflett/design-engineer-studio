/**
 * instruction-panel.tsx
 * Three-layer instruction editor, shown in AI mode below the editor panel.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

export interface LayerContent {
  layer1: string;
  layer2: string;
  layer3: string;
  layer1Default: string;
  layer2Default: string;
  stylingType: string;
}

interface InstructionPanelProps {
  layers: LayerContent;
  onLayersChange: (updated: Partial<LayerContent>) => void;
}

const DEBOUNCE_MS = 800;

function LayerSection({
  label,
  badge,
  badgeTitle,
  value,
  placeholder,
  onChange,
  onReset,
  showReset,
  defaultExpanded,
}: {
  label: string;
  badge: string;
  badgeTitle?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  showReset?: boolean;
  defaultExpanded?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        className="studio-section-hdr"
        onClick={() => setCollapsed((c) => !c)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 4, paddingRight: 8 }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
        <span
          style={{
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            background: "var(--studio-surface-hover)",
            color: "var(--studio-text-dimmed)",
            fontWeight: 400,
            textTransform: "none",
            letterSpacing: 0,
          }}
          title={badgeTitle}
        >
          {badge}
        </span>
        {showReset && onReset && (
          <button
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            style={{
              fontSize: 9,
              color: "var(--studio-text-dimmed)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "1px 4px",
              borderRadius: 3,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--studio-accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--studio-text-dimmed)")}
            title="Reset to default"
          >
            Reset
          </button>
        )}
        <span style={{ opacity: 0.35, display: "flex", alignItems: "center" }}>
          {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </span>
      </button>
      {!collapsed && (
        <div style={{ padding: "6px 8px 8px" }}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={8}
            style={{
              width: "100%",
              resize: "vertical",
              fontSize: 10,
              fontFamily: "var(--font-mono, monospace)",
              lineHeight: 1.5,
              background: "var(--studio-bg)",
              color: "var(--studio-text)",
              border: "1px solid var(--studio-border)",
              borderRadius: 4,
              padding: "6px 8px",
              boxSizing: "border-box",
              outline: "none",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--studio-accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--studio-border)")}
          />
        </div>
      )}
    </div>
  );
}

export function InstructionPanel({ layers, onLayersChange }: InstructionPanelProps) {
  const [collapsed, setCollapsed] = useState(true);

  // Local state for textarea values (debounced save)
  const [layer1, setLayer1] = useState(layers.layer1);
  const [layer2, setLayer2] = useState(layers.layer2);
  const [layer3, setLayer3] = useState(layers.layer3);

  // Sync when layers prop changes (e.g. after fetch)
  useEffect(() => { setLayer1(layers.layer1); }, [layers.layer1]);
  useEffect(() => { setLayer2(layers.layer2); }, [layers.layer2]);
  useEffect(() => { setLayer3(layers.layer3); }, [layers.layer3]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleUpdate = useCallback(
    (partial: Partial<LayerContent>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onLayersChange(partial);
      }, DEBOUNCE_MS);
    },
    [onLayersChange],
  );

  const layer2Label = layers.stylingType
    ? `Layer 2 — ${layers.stylingType}`
    : "Layer 2 — Styling";

  return (
    <div
      style={{
        borderTop: "1px solid var(--studio-border)",
        background: "var(--studio-surface)",
      }}
    >
      {/* Panel header */}
      <button
        className="studio-section-hdr"
        onClick={() => setCollapsed((c) => !c)}
        style={{ width: "100%", display: "flex", alignItems: "center", paddingRight: 8 }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>Claude Instructions</span>
        <span style={{ opacity: 0.35, display: "flex", alignItems: "center" }}>
          {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </span>
      </button>

      {!collapsed && (
        <>
          <div style={{ padding: "4px 8px 4px", fontSize: 10, color: "var(--studio-text-dimmed)" }}>
            These instructions are prepended to every AI prompt. Edits auto-save to{" "}
            <code style={{ fontSize: 9 }}>.surface/instructions.json</code>.
          </div>

          <LayerSection
            label="Layer 1 — Framework"
            badge="built-in"
            badgeTitle="Default framework & code quality guidelines"
            value={layer1}
            onChange={(v) => {
              setLayer1(v);
              scheduleUpdate({ layer1: v });
            }}
            onReset={() => {
              setLayer1(layers.layer1Default);
              scheduleUpdate({ layer1: layers.layer1Default });
            }}
            showReset={layer1 !== layers.layer1Default}
          />

          <LayerSection
            label={layer2Label}
            badge="auto-detected"
            badgeTitle="Guidelines for the detected styling system"
            value={layer2}
            onChange={(v) => {
              setLayer2(v);
              scheduleUpdate({ layer2: v });
            }}
            onReset={() => {
              setLayer2(layers.layer2Default);
              scheduleUpdate({ layer2: layers.layer2Default });
            }}
            showReset={layer2 !== layers.layer2Default}
          />

          <LayerSection
            label="Layer 3 — Project Conventions"
            badge="editable"
            badgeTitle="Your project-specific rules (shared with your team)"
            value={layer3}
            placeholder="Add your project's conventions here — component patterns, naming rules, token usage..."
            onChange={(v) => {
              setLayer3(v);
              scheduleUpdate({ layer3: v });
            }}
            defaultExpanded
          />
        </>
      )}
    </div>
  );
}
