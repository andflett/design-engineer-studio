/**
 * settings-page.tsx
 * Full-screen settings overlay with left nav.
 * Tabs: General | Instructions | Info
 */
import { useState, useEffect, useCallback } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Info, RotateCw } from "lucide-react";
import { useFramework, useStyling, useComponents, useTokens } from "../lib/scan-hooks.js";

type SettingsTab = "info" | "instructions";

interface SettingsPageProps {
  initialTab?: SettingsTab;
  instructions: string;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Section parsing — split .claude/surface.md into visual sections by ## headings
// ──────────────────────────────────────────────────────────────────────────────

interface ParsedSections {
  preamble: string;   // Everything before the first ## heading
  sections: { heading: string; body: string }[];
}

function parseSections(content: string): ParsedSections {
  const lines = content.split("\n");
  let preamble = "";
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
      }
      currentHeading = line;
      currentBody = [];
    } else if (!currentHeading) {
      preamble += line + "\n";
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeading) {
    sections.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
  }

  return { preamble: preamble.trim(), sections };
}

function assembleSections(parsed: ParsedSections): string {
  const parts: string[] = [];
  if (parsed.preamble) parts.push(parsed.preamble);
  for (const s of parsed.sections) {
    parts.push(`${s.heading}\n\n${s.body}`);
  }
  return parts.join("\n\n") + "\n";
}

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────

export function SettingsPage({
  initialTab = "info",
  instructions,
  onClose,
  onSave,
}: SettingsPageProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === ",") { e.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const navItems: { id: SettingsTab; label: string }[] = [
    { id: "info", label: "Project Info" },
    { id: "instructions", label: "Instructions" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "min(860px, 90vw)",
          height: "min(640px, 85vh)",
          background: "var(--studio-surface)",
          border: "1px solid var(--studio-border)",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 20px",
            borderBottom: "1px solid var(--studio-border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--studio-text)", flex: 1 }}>
            Settings
          </span>
          <button
            onClick={onClose}
            className="studio-icon-btn"
            style={{ width: 24, height: 24 }}
            title="Close (Esc)"
          >
            <Cross2Icon />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left nav */}
          <div
            style={{
              width: 160,
              borderRight: "1px solid var(--studio-border)",
              padding: "16px 0",
              flexShrink: 0,
            }}
          >
            {navItems.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 20px",
                  fontSize: 12,
                  fontWeight: tab === id ? 600 : 400,
                  color: tab === id ? "var(--studio-text)" : "var(--studio-text-dimmed)",
                  background: tab === id ? "var(--studio-surface-hover)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "background 0.1s, color 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (tab !== id) e.currentTarget.style.background = "rgba(128,128,128,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = tab === id ? "var(--studio-surface-hover)" : "transparent";
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
            {tab === "info" && <InfoTab />}
            {tab === "instructions" && (
              <InstructionsTab
                instructions={instructions}
                onSave={onSave}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Instructions tab
// ──────────────────────────────────────────────────────────────────────────────

function SectionEditor({
  heading,
  body,
  placeholder,
  onChange,
}: {
  heading: string;
  body: string;
  placeholder?: string;
  onChange: (body: string) => void;
}) {
  // Strip "## " prefix for display
  const label = heading.replace(/^##\s*/, "");

  return (
    <div
      style={{
        border: "1px solid var(--studio-border)",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--studio-border)",
          background: "var(--studio-surface-hover)",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--studio-text)" }}>
          {label}
        </span>
      </div>
      <div style={{ padding: 16 }}>
        <textarea
          value={body}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
          style={{
            width: "100%",
            resize: "vertical",
            fontSize: 11,
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
            lineHeight: 1.6,
            background: "var(--studio-bg)",
            color: "var(--studio-text)",
            border: "1px solid var(--studio-border)",
            borderRadius: 6,
            padding: "10px 12px",
            boxSizing: "border-box",
            outline: "none",
            minHeight: 120,
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--studio-accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--studio-border)")}
        />
      </div>
    </div>
  );
}

function InstructionsTab({
  instructions,
  onSave,
}: {
  instructions: string;
  onSave: (content: string) => Promise<void>;
}) {
  const [parsed, setParsed] = useState(() => parseSections(instructions));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync when prop changes
  useEffect(() => {
    setParsed(parseSections(instructions));
    setDirty(false);
  }, [instructions]);

  const updateSection = useCallback((index: number, body: string) => {
    setParsed((prev) => {
      const next = { ...prev, sections: [...prev.sections] };
      next.sections[index] = { ...next.sections[index], body };
      return next;
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(assembleSections(parsed));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [parsed, onSave]);

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6, gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--studio-text)", flex: 1, margin: 0 }}>
          Instructions
        </h2>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 500,
            background: dirty ? "var(--studio-accent)" : "var(--studio-surface-hover)",
            color: dirty ? "#fff" : "var(--studio-text-dimmed)",
            border: "none",
            borderRadius: 5,
            cursor: dirty && !saving ? "pointer" : "default",
            opacity: dirty ? 1 : 0.5,
            transition: "background 0.15s, opacity 0.15s",
          }}
        >
          <RotateCw size={11} />
          {saving ? "Saving…" : "Save & Reload Chat"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--studio-text-dimmed)", marginBottom: 24, lineHeight: 1.6 }}>
        Instructions saved to <code style={{ fontSize: 10 }}>.claude/surface.md</code> and
        loaded by Claude Code automatically via CLAUDE.md.
        Editing restarts the Chat session so Claude picks up the changes.
      </p>

      {parsed.sections.map((section, i) => (
        <SectionEditor
          key={i}
          heading={section.heading}
          body={section.body}
          placeholder={i === parsed.sections.length - 1
            ? "Add your project's conventions here — component patterns, naming rules, token usage…"
            : undefined
          }
          onChange={(body) => updateSection(i, body)}
        />
      ))}

      {/* Info box */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          background: "color-mix(in srgb, var(--studio-accent) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--studio-accent) 20%, transparent)",
          display: "flex",
          gap: 10,
        }}
      >
        <Info size={14} style={{ color: "var(--studio-accent)", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11, color: "var(--studio-text-dimmed)", lineHeight: 1.6, margin: 0 }}>
          These sections are stored as a single <code style={{ fontSize: 10 }}>.claude/surface.md</code> file.
          Commit it to git so your team shares the same editing context.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Info tab
// ──────────────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--studio-border-subtle)",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--studio-text-dimmed)", width: 140, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--studio-text)", fontWeight: 500 }}>
        {String(value)}
      </span>
    </div>
  );
}

function InfoTab() {
  const framework = useFramework();
  const styling = useStyling();
  const components = useComponents();
  const tokens = useTokens();

  const frameworkLabels: Record<string, string> = {
    nextjs: "Next.js", vite: "Vite", remix: "Remix",
    astro: "Astro", svelte: "SvelteKit", unknown: "Unknown",
  };

  const stylingLabels: Record<string, string> = {
    "tailwind-v4": "Tailwind v4", "tailwind-v3": "Tailwind v3", css: "CSS",
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--studio-text)", marginBottom: 6 }}>
        Project Info
      </h2>
      <p style={{ fontSize: 12, color: "var(--studio-text-dimmed)", marginBottom: 24, lineHeight: 1.6 }}>
        Detected from your project source files. Run Rescan to refresh.
      </p>

      <div>
        <InfoRow
          label="Framework"
          value={framework?.name ? frameworkLabels[framework.name] ?? framework.name : undefined}
        />
        <InfoRow
          label="Styling system"
          value={styling?.type ? stylingLabels[styling.type] ?? styling.type : undefined}
        />
        <InfoRow
          label="Config file"
          value={styling?.configPath ?? (styling?.cssFiles?.[0] ?? undefined)}
        />
        <InfoRow
          label="Components"
          value={components ? `${components.components.length} found` : undefined}
        />
        <InfoRow
          label="Design tokens"
          value={tokens ? `${tokens.tokens.length} found` : undefined}
        />
      </div>

      {components && components.components.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--studio-text-dimmed)",
              marginBottom: 8,
            }}
          >
            Components
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {components.components.slice(0, 40).map((c) => (
              <span
                key={c.dataSlot}
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: "var(--studio-surface-hover)",
                  border: "1px solid var(--studio-border)",
                  color: "var(--studio-text-dimmed)",
                }}
              >
                {c.name}
              </span>
            ))}
            {components.components.length > 40 && (
              <span style={{ fontSize: 10, color: "var(--studio-text-dimmed)", padding: "2px 4px" }}>
                +{components.components.length - 40} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
