/**
 * Editor panel with three-tab structure matching the studio.
 * - Token tab: edit design tokens globally
 * - Component tab (only for data-slot elements): variant dimensions + class editing
 * - Instance/Element tab: Figma-style property editing via ComputedPropertyPanel
 *
 * Adapted from studio/src/client/components/editor-panel.tsx for surface:
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
  ResetIcon,
  LayersIcon,
  DesktopIcon,
  FrameIcon,
  TransformIcon,
  RulerSquareIcon,
  DimensionsIcon,
  CornersIcon,
  ComponentInstanceIcon,
  TokensIcon,
} from "@radix-ui/react-icons";
import type { SelectedElementData, SourceLocation } from "../../shared/protocol.js";
import type { ComponentEntry } from "../../server/lib/scan-components.js";
import { TokenEditor } from "./token-editor.js";
import { PropertyPanel } from "./property-panel.js";
import { ComputedPropertyPanel } from "./computed-property-panel.js";
import { Tooltip, ExplainerNote } from "./tooltip.js";
import { ControlsGallery } from "./controls/controls-gallery.js";
import { StudioSelect, ToggleControl } from "./controls/index.js";
import {
  Maximize,
  Palette,
  Columns3,
  AlignLeft,
  Circle,
  ToggleLeft,
  Type,
  Bold,
  ArrowRightToLine,
  Activity,
  Layers,
  PanelTop,
  Sparkles,
} from "lucide-react";
import { useTokens, useComponents } from "../lib/scan-hooks.js";
import type { IndexedTokenMap } from "../lib/scan-store.js";

type EditMode = "token" | "component" | "instance";

interface EditorPanelProps {
  element: SelectedElementData | null;
  theme: "light" | "dark";
  iframePath: string;
  onPreviewToken: (token: string, value: string) => void;
  onClearTokenPreview: () => void;
  onPreviewShadow: (variableName: string, value: string, shadowName?: string) => void;
  onPreviewInlineStyle: (property: string, value: string) => void;
  onRevertInlineStyles: () => void;
  onClose: () => void;
  onReselectElement: () => void;
  onToggleUsagePanel?: () => void;
  onIsolate?: (entry: ComponentEntry) => void;
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
  theme,
  iframePath,
  onPreviewToken,
  onClearTokenPreview,
  onPreviewShadow,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onClose,
  onReselectElement,
  onToggleUsagePanel,
  onIsolate,
}: EditorPanelProps) {
  const tokenData = useTokens();
  const componentData = useComponents();

  const dataSlot = element?.attributes?.["data-slot"] || null;
  const isComponent = !!dataSlot;
  const componentEntry = dataSlot
    ? componentData?.byDataSlot.get(dataSlot) ?? null
    : null;

  const availableModes: EditMode[] = isComponent
    ? ["token", "component", "instance"]
    : ["token", "instance"];

  const [activeMode, setActiveMode] = useState<EditMode>("token");

  // Auto-select tab when a new element is selected
  useEffect(() => {
    if (!element) return;
    setActiveMode("instance");
    if (isComponent) {
      const hasVariants = componentEntry?.variants && componentEntry.variants.length > 0;
      setInstanceSubTab(hasVariants ? "props" : "styles");
    }
  }, [element?.source?.file, element?.source?.line, element?.source?.col]);

  const [componentSubTab, setComponentSubTab] = useState<"styles" | "props">("props");
  const [instanceSubTab, setInstanceSubTab] = useState<"props" | "styles">("props");
  const [saving, setSaving] = useState(false);
  // Serialize writes so only one goes at a time
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const elementName = element
    ? isComponent
      ? componentEntry?.name || dataSlot
      : `<${element.tag}>`
    : null;

  const tokenRefs = extractTokenReferences(element?.className || "", tokenData);

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
    token: { icon: TokensIcon, label: "Tokens" },
    component: { icon: Component1Icon, label: "Component" },
    instance: { icon: isComponent ? ComponentInstanceIcon : BoxIcon, label: isComponent ? "Instance" : "Element" },
  };

  return (
    <div
      className="flex flex-col border-l studio-scrollbar overflow-y-auto"
      style={{
        width: 350,
        minWidth: 350,
        background: "var(--studio-surface)",
        borderColor: "var(--studio-border)",
      }}
    >
      {/* Header */}
      {element && (
        <div
          className="border-b shrink-0"
          style={{ borderColor: "var(--studio-border)" }}
        >
          {/* Name row + actions */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ background: "var(--studio-accent-muted)" }}
            >
              {isComponent ? (
                <Component1Icon
                  style={{
                    width: 12,
                    height: 12,
                    color: "var(--studio-accent)",
                  }}
                />
              ) : (
                <BoxIcon
                  style={{
                    width: 12,
                    height: 12,
                    color: "var(--studio-accent)",
                  }}
                />
              )}
            </div>
            <span
              className="text-[12px] font-semibold truncate flex-1 min-w-0"
              style={{ color: "var(--studio-text)" }}
            >
              {elementName}
            </span>
            {saving && (
              <span
                className="flex items-center gap-0.5 text-[10px] shrink-0"
                style={{ color: "var(--studio-success)" }}
              >
                <CheckIcon style={{ width: 10, height: 10 }} />
                Saved
              </span>
            )}
            <div className="flex items-center shrink-0" style={{ gap: 2 }}>
              {isComponent && onToggleUsagePanel && (
                <Tooltip content="View usage across pages">
                  <button
                    onClick={onToggleUsagePanel}
                    className="studio-icon-btn"
                    style={{ width: 24, height: 24 }}
                  >
                    <LayersIcon />
                  </button>
                </Tooltip>
              )}
              {isComponent && onIsolate && componentEntry && (
                <Tooltip content="Isolate component">
                  <button
                    onClick={() => onIsolate(componentEntry)}
                    className="studio-icon-btn"
                    style={{ width: 24, height: 24 }}
                  >
                    <TransformIcon />
                  </button>
                </Tooltip>
              )}
              {isComponent &&
                element.instanceSource &&
                element.componentName && (
                  <Tooltip content="Reset instance overrides">
                    <button
                      onClick={() => {
                        if (!element.instanceSource || !element.componentName)
                          return;
                        withSave(async () => {
                          await handleResetInstanceClassName(
                            element.instanceSource!,
                            element.componentName!,
                          );
                        });
                      }}
                      className="studio-icon-btn"
                      style={{ width: 24, height: 24 }}
                    >
                      <ResetIcon />
                    </button>
                  </Tooltip>
                )}
              <button
                onClick={onClose}
                className="studio-icon-btn"
                style={{ width: 24, height: 24 }}
              >
                <Cross2Icon />
              </button>
            </div>
          </div>

          {/* File path — prefer element.source, fall back to scanned component filePath */}
          {(element.source || componentEntry?.filePath) && (
            <div className="px-4 pb-2.5 pt-0.5">
              <button
                onClick={() => {
                  if (element.source) {
                    openInEditor(element.source.file, element.source.line, element.source.col);
                  } else if (componentEntry?.filePath) {
                    openInEditor(componentEntry.filePath, 1, 0);
                  }
                }}
                className="text-[10px] font-mono truncate block text-left w-full"
                style={{
                  color: "var(--studio-text-dimmed)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.textDecoration = "underline")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.textDecoration = "none")
                }
                title="Open in editor"
              >
                {element.source
                  ? `${element.source.file}:${element.source.line}:${element.source.col}`
                  : componentEntry?.filePath}
              </button>
            </div>
          )}
        </div>
      )}

      {!element && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("gallery") ? (
        <div className="flex-1 overflow-y-auto studio-scrollbar">
          <ControlsGallery />
        </div>
      ) : !element ? (
        <SelectionPlaceholder />
      ) : null}

      {element && (
        /* Mode switcher */
        <div
          className="px-4 py-2.5 shrink-0"
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
      )}

      {/* Mode content */}
      <div className="flex-1 overflow-y-auto studio-scrollbar">
        {!element && (
          <div>
            <div
              className="px-4 pt-3 pb-3"
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                style={{ color: "var(--studio-text-muted)" }}
              >
                Design Tokens
              </div>
              <p className="text-[11px]" style={{ color: "var(--studio-text-dimmed)" }}>
                Global design tokens defined in your project. Edit values here to update every usage at once.
              </p>
            </div>
            <TokenEditor
              tokenRefs={tokenRefs}
              theme={theme}
              onPreviewToken={onPreviewToken}
              onClearTokenPreview={onClearTokenPreview}
              onPreviewShadow={onPreviewShadow}
            />
          </div>
        )}

        {activeMode === "token" && element && (
          <TokenEditor
            tokenRefs={tokenRefs}
            theme={theme}
            onPreviewToken={onPreviewToken}
            onClearTokenPreview={onClearTokenPreview}
            onPreviewShadow={onPreviewShadow}
          />
        )}

        {activeMode === "component" && element && isComponent && (
          <>
            {/* Sub-tabs: Props vs Styles */}
            <div
              className="px-4 py-2 border-t"
              style={{ borderColor: "var(--studio-border)" }}
            >
              <div className="studio-segmented" style={{ width: "100%" }}>
                <button
                  onClick={() => setComponentSubTab("props")}
                  className={componentSubTab === "props" ? "active" : ""}
                  style={{ flex: 1 }}
                >
                  Props
                </button>
                <button
                  onClick={() => setComponentSubTab("styles")}
                  className={componentSubTab === "styles" ? "active" : ""}
                  style={{ flex: 1 }}
                >
                  Styles
                </button>
              </div>
            </div>

            {componentSubTab === "styles" && (
              <div className="">
                <ComputedPropertyPanel
                  tag={element.tag}
                  className={element.className}
                  computedStyles={element.computed}
                  parentComputedStyles={element.parentComputed || {}}
                  onPreviewInlineStyle={onPreviewInlineStyle}
                  onRevertInlineStyles={onRevertInlineStyles}
                  onCommitClass={(tailwindClass, oldClass) => {
                    if (oldClass && tailwindClass === oldClass) return;
                    const isCva =
                      componentEntry && componentEntry.variants.length > 0;
                    if (isCva) {
                      // CVA components: classes live in the cva() call, not on the
                      // JSX element. Use the component/regex write API.
                      if (oldClass) {
                        withSave(async () => {
                          await handleComponentClassChange(
                            componentEntry.filePath,
                            oldClass,
                            tailwindClass,
                          );
                        });
                      } else if (element.source) {
                        // addClass: fall back to element write (appends to JSX className)
                        const source = element.source;
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "addClass",
                            tailwindClass,
                          );
                        });
                      }
                    } else if (element.source) {
                      // Non-CVA components (cn("classes", className)) and plain elements:
                      // classes are in the JSX className expression, AST approach works.
                      const source = element.source;
                      if (oldClass) {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "replaceClass",
                            tailwindClass,
                            oldClass,
                          );
                        });
                      } else {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "addClass",
                            tailwindClass,
                          );
                        });
                      }
                    }
                  }}
                />
              </div>
            )}

            {componentSubTab === "props" &&
              componentEntry &&
              componentEntry.variants.length > 0 && (
                <div className="">
                  {componentEntry.variants.map((dim: any) => (
                    <ComponentVariantSection
                      key={dim.name}
                      dim={dim}
                      componentEntry={componentEntry}
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

                </div>
              )}

            {componentSubTab === "props" &&
              (!componentEntry || componentEntry.variants.length === 0) && (
                <div className="px-4 py-3">
                  <ExplainerNote>
                    This component has no predefined style props. Edit its styles directly in the "Styles" tab.
                  </ExplainerNote>
                </div>
              )}
          </>
        )}

      

        {activeMode === "instance" && element && (
          <>
            {isComponent &&
            componentEntry &&
            componentEntry.variants.length > 0 ? (
              <>
                {/* Sub-tabs: Props vs Styles */}
                <div
                  className="px-4 py-2 border-t"
                  style={{ borderColor: "var(--studio-border)" }}
                >
                  <div className="studio-segmented" style={{ width: "100%" }}>
                    <button
                      onClick={() => setInstanceSubTab("props")}
                      className={instanceSubTab === "props" ? "active" : ""}
                      style={{ flex: 1 }}
                    >
                      Props
                    </button>
                    <button
                      onClick={() => setInstanceSubTab("styles")}
                      className={instanceSubTab === "styles" ? "active" : ""}
                      style={{ flex: 1 }}
                    >
                      Styles
                    </button>
                  </div>
                </div>

                {instanceSubTab === "props" && (
                  <div className="">
                    {componentEntry.variants.map((dim: any) => (
                      <InstanceVariantSection
                        key={dim.name}
                        dim={dim}
                        currentValue={
                          (element?.fiberProps?.[dim.name] != null ? String(element.fiberProps[dim.name]) : null)
                            ?? instanceProps?.[dim.name]
                            ?? dim.default
                            ?? null
                        }
                        onSelect={(value) => {
                          if (!element.instanceSource || !element.componentName)
                            return;
                          withSave(async () => {
                            await handleInstancePropChange(
                              element.instanceSource!,
                              element.componentName!,
                              dim.name,
                              value,
                            );
                            setInstancePropsVersion((v) => v + 1);
                          });
                        }}
                      />
                    ))}
                  </div>
                )}

                {instanceSubTab === "styles" && (
                  <div className="">
                    <ComputedPropertyPanel
                      tag={element.tag}
                      className={element.className}
                      computedStyles={element.computed}
                      parentComputedStyles={element.parentComputed || {}}
                      onPreviewInlineStyle={onPreviewInlineStyle}
                      onRevertInlineStyles={onRevertInlineStyles}
                      onCommitClass={(tailwindClass, oldClass) => {
                        if (oldClass && tailwindClass === oldClass) return;
                        if (element.instanceSource && element.componentName) {
                          withSave(async () => {
                            await handleInstanceOverride(
                              element.instanceSource!,
                              element.componentName!,
                              tailwindClass,
                              oldClass || undefined,
                            );
                          });
                        }
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="">
                <ComputedPropertyPanel
                  tag={element.tag}
                  className={element.className}
                  computedStyles={element.computed}
                  parentComputedStyles={element.parentComputed || {}}
                  onPreviewInlineStyle={onPreviewInlineStyle}
                  onRevertInlineStyles={onRevertInlineStyles}
                  onCommitClass={(tailwindClass, oldClass) => {
                    if (oldClass && tailwindClass === oldClass) return;
                    if (element.source) {
                      const source = element.source;
                      if (oldClass) {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "replaceClass",
                            tailwindClass,
                            oldClass,
                          );
                        });
                      } else {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "addClass",
                            tailwindClass,
                          );
                        });
                      }
                    }
                  }}
                />
              </div>
            )}
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
  onClassChange,
}: {
  dim: any;
  componentEntry: any;
  onClassChange: (oldClass: string, newClass: string, variantContext: string) => void;
}) {
  const tokenData = useTokens();
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
                    tokenGroups={tokenData?.groups || {}}
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

// --- No-selection placeholder ---

function SelectionPlaceholder() {
  const color = "var(--studio-accent)";
  const handleSize = 8;
  const h = handleSize / 2.5;

  const Handle = ({ style }: { style: React.CSSProperties }) => (
    <div
      className="absolute"
      style={{
        width: handleSize,
        height: handleSize,
        background: color,
        border: `1.5px solid ${color}`,
        borderRadius: 1,
        opacity: 0.8,
        ...style,
      }}
    />
  );

  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-8"
      style={{ borderBottom: "1px solid var(--studio-border)" }}
    >
      {/* Selection box */}
      <div className="relative" style={{ width: 190, height: 88 }}>
        {/* Border */}
        <div
          className="absolute inset-0"
          style={{ border: `1.5px solid ${color}`, background: "color-mix(in srgb, var(--studio-accent) 10%, transparent)" }}
        />
        {/* Text inside */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[12px] text-center select-none leading-snug"
            style={{ color: "var(--studio-text-muted)", opacity: 1 }}
          >
            Select an element to edit
          </span>
        </div>
        {/* Corner handles */}
        <Handle style={{ top: -h, left: -h }} />
        <Handle style={{ top: -h, right: -h }} />
        <Handle style={{ bottom: -h, left: -h }} />
        <Handle style={{ bottom: -h, right: -h }} />
        {/* Animated cursor */}
        <div
          className="absolute"
          style={{
            bottom: 10,
            right: 10,
            color,
            opacity: 0.8,
            animation: "cursor-drift 3s ease-in-out infinite",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2L2 10.5L4.5 8L6.5 12L8 11.5L6 7.5L9.5 7L2 2Z" fill="currentColor" />
          </svg>
        </div>
      </div>
      <style>{`
        @keyframes cursor-drift {
          0%, 100% { transform: translate(0, 0); }
          40% { transform: translate(4px, 3px); }
          70% { transform: translate(-2px, 4px); }
        }
      `}</style>
    </div>
  );
}

// --- Instance variant section (label + StudioSelect dropdown) ---

const PROP_ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  variant: ComponentInstanceIcon,
  size: DimensionsIcon,
  color: Palette,
  layout: Columns3,
  align: AlignLeft,
  alignment: AlignLeft,
  shape: Circle,
  radius: CornersIcon,
  type: Type,
  disabled: ToggleLeft,
  state: ToggleLeft,
  weight: Bold,
  fullwidth: ArrowRightToLine,
  status: Activity,
  elevation: Layers,
  border: PanelTop,
  animation: Sparkles,
};

function isBooleanDim(dim: any): boolean {
  const opts = dim.options.map((o: string) => o.toLowerCase());
  return opts.length === 2 && opts.includes("true") && opts.includes("false");
}

function InstanceVariantSection({
  dim,
  currentValue,
  onSelect,
}: {
  dim: any;
  currentValue: string | null;
  onSelect: (value: string) => void;
}) {
  const effectiveValue = currentValue ?? dim.default ?? dim.options[0] ?? "";
  const propKey = dim.name.toLowerCase();
  const icon = PROP_ICON_MAP[propKey];
  const isBoolean = isBooleanDim(dim);

  return (
    <div className="px-4 py-2" style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <div
        className="text-[10px] font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--studio-text-muted)" }}
      >
        {dim.name}
      </div>
      {isBoolean ? (
        <ToggleControl
          value={effectiveValue === "true"}
          onChange={(checked) => onSelect(String(checked))}
          label={effectiveValue === "true" ? "On" : "Off"}
          icon={icon}
          tooltip={dim.name}
        />
      ) : (
        <StudioSelect
          value={effectiveValue}
          onChange={onSelect}
          options={dim.options.map((opt: string) => ({ value: opt, label: opt }))}
          icon={icon}
          tooltip={dim.name}
        />
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
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "prop", source, componentName, propName, propValue }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Prop write failed:", data.error);
  } catch (err) {
    console.error("Prop write error:", err);
  }
}

async function handleResetInstanceClassName(
  instanceSource: SourceLocation,
  componentName: string,
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "resetInstanceClassName",
        source: instanceSource,
        componentName,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Reset instance className failed:", data.error);
  } catch (err) {
    console.error("Reset instance className error:", err);
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
  tokenData: IndexedTokenMap | null,
): string[] {
  if (!tokenData || !className) return [];

  const tokens = new Set<string>();
  const classes = className.split(/\s+/);

  for (const cls of classes) {
    const match = cls.match(
      /(?:bg|text|border|ring|outline|shadow)-([a-z][\w-]*)/
    );
    if (match) {
      const ref = match[1].split("/")[0];
      const tokenName = `--${ref}`;
      if (tokenData.byName.has(tokenName)) tokens.add(tokenName);
    }
  }

  return Array.from(tokens);
}
