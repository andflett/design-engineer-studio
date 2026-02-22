/**
 * Editor panel with three-tab structure matching the studio.
 * - Token tab: edit design tokens globally
 * - Component tab (only for data-slot elements): variant dimensions + class editing
 * - Instance/Element tab: Figma-style property editing via ComputedPropertyPanel
 *
 * Adapted from studio/src/client/components/editor-panel.tsx for codecanvas:
 * - Uses data-source coordinates instead of EID markers
 * - Calls POST /api/write-element with source coordinates
 * - Calls POST /api/component for component class changes
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Cross2Icon,
  MixerHorizontalIcon,
  Component1Icon,
  CursorArrowIcon,
  BoxIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  InfoCircledIcon,
} from "@radix-ui/react-icons";
import type { ScanData } from "../app.js";
import type { SelectedElementData, SourceLocation } from "../../shared/protocol.js";
import { TokenEditor } from "./token-editor.js";
import { PropertyPanel } from "./property-panel.js";
import { ComputedPropertyPanel } from "./computed-property-panel.js";

type EditMode = "token" | "component" | "instance";

interface EditorPanelProps {
  element: SelectedElementData | null;
  scanData: ScanData | null;
  theme: "light" | "dark";
  iframePath: string;
  onPreviewToken: (token: string, value: string) => void;
  onPreviewShadow: (variableName: string, value: string, shadowName?: string) => void;
  onPreviewInlineStyle: (property: string, value: string) => void;
  onRevertInlineStyles: () => void;
  onClose: () => void;
  onReselectElement: () => void;
  onRescan: () => void;
}

/** Open a file in the user's editor via the local server. */
function openInEditor(file: string, line?: number, col?: number) {
  const params = new URLSearchParams({ file });
  if (line != null) params.set("line", String(line));
  if (col != null) params.set("col", String(col));
  fetch(`/api/open-file?${params}`).catch(console.error);
}

export function EditorPanel({
  element,
  scanData,
  theme,
  iframePath,
  onPreviewToken,
  onPreviewShadow,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onClose,
  onReselectElement,
  onRescan,
}: EditorPanelProps) {
  const dataSlot = element?.attributes?.["data-slot"] || null;
  const isComponent = !!dataSlot;
  const componentEntry = scanData?.components.components.find(
    (c: any) => c.dataSlot === dataSlot
  );

  const availableModes: EditMode[] = isComponent
    ? ["token", "component", "instance"]
    : ["token", "instance"];

  const [activeMode, setActiveMode] = useState<EditMode>("token");
  const [saving, setSaving] = useState(false);
  // Serialize writes so only one goes at a time
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const elementName = element
    ? isComponent
      ? componentEntry?.name || dataSlot
      : `<${element.tag}>`
    : null;

  const tokenRefs = extractTokenReferences(element?.className || "", scanData);

  // Fetch current prop values for component instances (variant, size, etc.)
  const [instanceProps, setInstanceProps] = useState<Record<string, string> | null>(null);
  const [instancePropsVersion, setInstancePropsVersion] = useState(0);
  useEffect(() => {
    if (!isComponent || !element?.instanceSource || !element?.componentName) {
      setInstanceProps(null);
      return;
    }
    const src = element.instanceSource;
    const params = new URLSearchParams({
      file: src.file,
      line: String(src.line),
      componentName: element.componentName,
    });
    if (src.col != null) params.set("col", String(src.col));
    if (element.textContent) params.set("textHint", element.textContent.slice(0, 30));
    fetch(`/api/write-element/instance-props?${params}`)
      .then((r) => r.json())
      .then((data) => setInstanceProps(data.props ?? null))
      .catch(() => setInstanceProps(null));
  }, [element?.instanceSource?.file, element?.instanceSource?.line, element?.instanceSource?.col, element?.componentName, isComponent, instancePropsVersion]);

  const withSave = async (fn: () => Promise<void>) => {
    const queued = writeQueueRef.current.then(async () => {
      setSaving(true);
      try {
        await fn();
        // Wait for HMR to apply the new Tailwind class, then reselect
        // and revert any inline style previews (order matters: revert
        // AFTER HMR so there's no flicker/layout shift).
        setTimeout(() => {
          onReselectElement();
          onRevertInlineStyles();
          onRescan();
        }, 500);
      } catch (err) {
        console.error("Write error:", err);
      } finally {
        setTimeout(() => setSaving(false), 1200);
      }
    });
    writeQueueRef.current = queued;
    return queued;
  };

  const modeConfig: Record<EditMode, { icon: any; label: string }> = {
    token: { icon: MixerHorizontalIcon, label: "Tokens" },
    component: { icon: Component1Icon, label: "Component" },
    instance: { icon: isComponent ? CursorArrowIcon : BoxIcon, label: isComponent ? "Instance" : "Element" },
  };

  return (
    <div
      className="flex flex-col border-l studio-scrollbar overflow-y-auto"
      style={{
        width: 300,
        minWidth: 300,
        background: "var(--studio-surface)",
        borderColor: "var(--studio-border)",
      }}
    >
      {/* Header */}
      {element && (
        <div
          className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
          style={{ borderColor: "var(--studio-border)" }}
        >
          <div
            className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ background: "var(--studio-accent-muted)" }}
          >
            {isComponent ? (
              <Component1Icon style={{ width: 12, height: 12, color: "var(--studio-accent)" }} />
            ) : (
              <BoxIcon style={{ width: 12, height: 12, color: "var(--studio-accent)" }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[12px] font-semibold truncate"
                style={{ color: "var(--studio-text)" }}
              >
                {elementName}
              </span>
              {saving && (
                <span
                  className="flex items-center gap-0.5 text-[10px]"
                  style={{ color: "var(--studio-success)" }}
                >
                  <CheckIcon style={{ width: 10, height: 10 }} />
                  Saved
                </span>
              )}
            </div>
            {element.source && (
              <button
                onClick={() => openInEditor(element.source!.file, element.source!.line, element.source!.col)}
                className="text-[10px] font-mono truncate block text-left w-full"
                style={{ color: "var(--studio-text-dimmed)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                title="Open in editor"
              >
                {element.source.file}:{element.source.line}:{element.source.col}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="studio-icon-btn"
            style={{ width: 24, height: 24 }}
          >
            <Cross2Icon />
          </button>
        </div>
      )}

      {/* Mode switcher */}
      <div
        className="px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "var(--studio-border)" }}
      >
        <div className="studio-segmented" style={{ width: "100%" }}>
          {availableModes.map((mode) => {
            const cfg = modeConfig[mode];
            return (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={activeMode === mode ? "active" : ""}
                style={{ flex: 1 }}
              >
                <cfg.icon style={{ width: 12, height: 12 }} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode content */}
      <div className="flex-1 overflow-y-auto studio-scrollbar">
        {activeMode === "token" && (
          <>
            <div className="studio-tab-explainer">
              <InfoCircledIcon />
              <span>Edit design tokens. Changes propagate across the entire system.</span>
            </div>
            <TokenEditor
              tokenRefs={tokenRefs}
              scanData={scanData}
              theme={theme}
              onPreviewToken={onPreviewToken}
              onPreviewShadow={onPreviewShadow}
            />
          </>
        )}

        {activeMode === "component" && !element && (
          <div
            className="px-4 py-8 text-[11px] text-center"
            style={{ color: "var(--studio-text-dimmed)" }}
          >
            Select a component in the preview to edit its variants.
          </div>
        )}

        {activeMode === "component" && element && componentEntry && (
          <>
            <div className="studio-tab-explainer">
              <InfoCircledIcon />
              <div>
                Edit the component definition. Changes apply to all instances.
                <button
                  onClick={() => openInEditor(componentEntry.filePath)}
                  className="studio-explainer-file truncate block text-left w-full"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                  title="Open in editor"
                >
                  {componentEntry.filePath}
                </button>
              </div>
            </div>
            <div className="">
              {componentEntry.variants.map((dim: any) => (
                <ComponentVariantSection
                  key={dim.name}
                  dim={dim}
                  componentEntry={componentEntry}
                  scanData={scanData}
                  onClassChange={(oldClass, newClass, variantContext) => {
                    withSave(async () => {
                      await handleComponentClassChange(
                        componentEntry.filePath,
                        oldClass,
                        newClass,
                        variantContext,
                      );
                    });
                  }}
                />
              ))}

              {componentEntry.baseClasses && (
                <ComponentBaseSection
                  componentEntry={componentEntry}
                  scanData={scanData}
                  onClassChange={(oldClass, newClass) => {
                    withSave(async () => {
                      await handleComponentClassChange(
                        componentEntry.filePath,
                        oldClass,
                        newClass,
                      );
                    });
                  }}
                />
              )}
            </div>
          </>
        )}

        {activeMode === "component" && element && !componentEntry && isComponent && (
          <div
            className="px-4 py-3 text-[11px]"
            style={{ color: "var(--studio-text-dimmed)" }}
          >
            This component doesn't use variant definitions (CVA). Edit its styles directly in the Element tab.
          </div>
        )}

        {activeMode === "instance" && !element && (
          <div
            className="px-4 py-8 text-[11px] text-center"
            style={{ color: "var(--studio-text-dimmed)" }}
          >
            Select an element in the preview to edit its styles.
          </div>
        )}

        {activeMode === "instance" && element && (
          <>
            <div className="studio-tab-explainer">
              <InfoCircledIcon />
              <span>
                {isComponent
                  ? "Edit this element's variant, size, and styles."
                  : "Edit this element's styles."}
              </span>
            </div>
            {isComponent && componentEntry && componentEntry.variants.length > 0 && (
              <div className="">
                {componentEntry.variants.map((dim: any) => (
                  <InstanceVariantSection
                    key={dim.name}
                    dim={dim}
                    currentValue={instanceProps?.[dim.name] ?? dim.default ?? null}
                    onSelect={(value) => {
                      if (!element.instanceSource || !element.componentName) return;
                      withSave(async () => {
                        await handleInstancePropChange(
                          element.instanceSource!,
                          element.componentName!,
                          dim.name,
                          value,
                          element.textContent?.slice(0, 30),
                        );
                        setInstancePropsVersion((v) => v + 1);
                      });
                    }}
                  />
                ))}
              </div>
            )}
            <div className="">
              <ComputedPropertyPanel
                tag={element.tag}
                className={element.className}
                computedStyles={element.computed}
                parentComputedStyles={element.parentComputed || {}}
                tokenGroups={scanData?.tokens.groups || {}}
                onPreviewInlineStyle={onPreviewInlineStyle}
                onRevertInlineStyles={onRevertInlineStyles}
                onCommitClass={(tailwindClass, oldClass) => {
                  // Skip if the new class is the same as the old class
                  if (oldClass && tailwindClass === oldClass) return;
                  if (isComponent && element.instanceSource && element.componentName) {
                    // Component instance: write to the page file (usage site)
                    withSave(async () => {
                      await handleInstanceOverride(
                        element.instanceSource!,
                        element.componentName!,
                        tailwindClass,
                        oldClass || undefined,
                        element.textContent?.slice(0, 30),
                      );
                    });
                  } else if (element.source) {
                    // Plain element: write to the element's source file
                    const source = element.source;
                    if (oldClass) {
                      withSave(async () => {
                        await handleWriteElement(source, "replaceClass", tailwindClass, oldClass);
                      });
                    } else {
                      withSave(async () => {
                        await handleWriteElement(source, "addClass", tailwindClass);
                      });
                    }
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Collapsible variant sections ---

function ComponentVariantSection({
  dim,
  componentEntry,
  scanData,
  onClassChange,
}: {
  dim: any;
  componentEntry: any;
  scanData: ScanData | null;
  onClassChange: (oldClass: string, newClass: string, variantContext: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

  const toggleOption = (opt: string) => {
    const next = new Set(expandedOptions);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    setExpandedOptions(next);
  };

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        {dim.name}
        <span className="count">{dim.options.length}</span>
      </button>

      {!collapsed && (
        <div className="studio-tree">
          {dim.options.map((opt: string) => (
            <div key={opt} className="studio-tree-node">
              <button
                onClick={() => toggleOption(opt)}
                className="studio-section-hdr"
                style={{ fontSize: 10 }}
              >
                {expandedOptions.has(opt) ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronRightIcon />
                )}
                <span style={{ color: "var(--studio-text)", fontWeight: 600 }}>
                  {opt}
                </span>
                {opt === dim.default && (
                  <span
                    className="text-[9px] font-normal"
                    style={{ color: "var(--studio-text-dimmed)" }}
                  >
                    default
                  </span>
                )}
              </button>

              {expandedOptions.has(opt) && dim.classes[opt] && (
                <div className="studio-tree-content">
                  <PropertyPanel
                    classes={dim.classes[opt]}
                    onClassChange={(oldClass, newClass) => {
                      onClassChange(oldClass, newClass, opt);
                    }}
                    tokenGroups={scanData?.tokens.groups || {}}
                    flat
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentBaseSection({
  componentEntry,
  scanData,
  onClassChange,
}: {
  componentEntry: any;
  scanData: ScanData | null;
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        Base
      </button>
      {!collapsed && (
        <div className="px-4 pb-3">
          <PropertyPanel
            classes={componentEntry.baseClasses}
            onClassChange={onClassChange}
            tokenGroups={scanData?.tokens.groups || {}}
            flat
          />
        </div>
      )}
    </div>
  );
}

// --- Instance variant section (pill buttons for switching props) ---

function InstanceVariantSection({
  dim,
  currentValue,
  onSelect,
}: {
  dim: any;
  currentValue: string | null;
  onSelect: (value: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        <span style={{ color: "var(--studio-text-dimmed)" }}>{dim.name}</span>
        {currentValue && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{
              color: "var(--studio-accent)",
              background: "var(--studio-accent-muted)",
            }}
          >
            {currentValue}
          </span>
        )}
        <span className="count">{dim.options.length}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {dim.options.map((opt: string) => {
            const isActive = currentValue === opt || (!currentValue && opt === dim.default);
            return (
              <button
                key={opt}
                onClick={() => onSelect(opt)}
                className="studio-bp-btn"
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "1px solid",
                  borderColor: isActive ? "var(--studio-accent)" : "var(--studio-border)",
                  background: isActive ? "var(--studio-accent-muted)" : "transparent",
                  color: isActive ? "var(--studio-accent)" : "var(--studio-text-dimmed)",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- API call helpers ---

async function handleWriteElement(
  source: SourceLocation,
  type: "replaceClass" | "addClass",
  newClass: string,
  oldClass?: string
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        type,
        newClass,
        oldClass: oldClass || undefined,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Element write failed:", data.error);
  } catch (err) {
    console.error("Element write error:", err);
  }
}

async function handleInstanceOverride(
  instanceSource: SourceLocation,
  componentName: string,
  newClass: string,
  oldClass?: string,
  textHint?: string,
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "instanceOverride",
        source: instanceSource,
        componentName,
        newClass,
        oldClass: oldClass || undefined,
        textHint,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Instance override failed:", data.error);
  } catch (err) {
    console.error("Instance override error:", err);
  }
}

async function handleInstancePropChange(
  source: SourceLocation,
  componentName: string,
  propName: string,
  propValue: string,
  textHint?: string,
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "prop", source, componentName, propName, propValue, textHint }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Prop write failed:", data.error);
  } catch (err) {
    console.error("Prop write error:", err);
  }
}

async function handleComponentClassChange(
  filePath: string,
  oldClass: string,
  newClass: string,
  variantContext?: string
) {
  try {
    const res = await fetch("/api/component", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, oldClass, newClass, variantContext }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Component write failed:", data.error);
  } catch (err) {
    console.error("Component write error:", err);
  }
}

function extractTokenReferences(
  className: string,
  scanData: ScanData | null
): string[] {
  if (!scanData || !className) return [];

  const tokens = new Set<string>();
  const classes = className.split(/\s+/);

  for (const cls of classes) {
    const match = cls.match(
      /(?:bg|text|border|ring|outline|shadow)-([a-z][\w-]*)/
    );
    if (match) {
      const ref = match[1].split("/")[0];
      const tokenName = `--${ref}`;
      const found = scanData.tokens.tokens.find(
        (t: any) => t.name === tokenName
      );
      if (found) tokens.add(tokenName);
    }
  }

  return Array.from(tokens);
}
