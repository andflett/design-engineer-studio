import { useState, useEffect } from "react";
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
import type { ElementData } from "@designtools/core/client/lib/iframe-bridge";
import { TokenEditor } from "./token-editor.js";
import { PropertyPanel } from "./property-panel.js";

type EditMode = "token" | "component" | "instance";

interface EditorPanelProps {
  element: ElementData;
  scanData: ScanData | null;
  theme: "light" | "dark";
  iframePath: string;
  onPreviewToken: (token: string, value: string) => void;
  onPreviewClass: (elementPath: string, oldClass: string, newClass: string) => void;
  onRevertPreview: () => void;
  onClose: () => void;
  onRefreshIframe: () => void;
  onReselectElement: () => void;
}

export function EditorPanel({
  element,
  scanData,
  theme,
  iframePath,
  onPreviewToken,
  onPreviewClass,
  onRevertPreview,
  onClose,
  onRefreshIframe,
  onReselectElement,
}: EditorPanelProps) {
  const isComponent = !!element.dataSlot;
  const componentEntry = scanData?.components.components.find(
    (c: any) => c.dataSlot === element.dataSlot
  );

  const availableModes: EditMode[] = isComponent
    ? ["token", "component", "instance"]
    : ["token", "instance"];

  const [activeMode, setActiveMode] = useState<EditMode>("instance");
  const [saving, setSaving] = useState(false);
  const [pageFilePath, setPageFilePath] = useState<string | null>(null);

  // Resolve the current iframe route to a source file path for instance/element edits
  useEffect(() => {
    fetch(`/scan/resolve-route?path=${encodeURIComponent(iframePath)}`)
      .then((r) => r.json())
      .then((data) => setPageFilePath(data.filePath || null))
      .catch(() => setPageFilePath(null));
  }, [iframePath]);

  const elementName = isComponent
    ? componentEntry?.name || element.dataSlot
    : `<${element.tag}>`;

  const tokenRefs = extractTokenReferences(element.className, scanData);

  const withSave = async (fn: () => Promise<void>) => {
    setSaving(true);
    try {
      await fn();
      // After HMR updates the DOM, re-query the selected element for fresh data
      setTimeout(() => onReselectElement(), 500);
    } finally {
      setTimeout(() => setSaving(false), 1200);
    }
  };

  const instanceIdentifier = element.textContent?.slice(0, 30) || element.className.slice(0, 40);

  const modeConfig: Record<EditMode, { icon: any; label: string }> = {
    token: { icon: MixerHorizontalIcon, label: "Token" },
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
          {componentEntry?.filePath && (
            <div
              className="text-[10px] font-mono truncate"
              style={{ color: "var(--studio-text-dimmed)" }}
            >
              {componentEntry.filePath}
            </div>
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
            />
          </>
        )}

        {activeMode === "component" && componentEntry && (
          <>
            <div className="studio-tab-explainer">
              <InfoCircledIcon />
              <div>
                Edit the component definition Changes apply to all instances.
                <div className="studio-explainer-file truncate">
                  {componentEntry.filePath}
                </div>
              </div>
            </div>
            <div className="">
              {componentEntry.variants.map((dim: any) => (
                <ComponentVariantSection
                  key={dim.name}
                  dim={dim}
                  componentEntry={componentEntry}
                  scanData={scanData}
                />
              ))}

              {componentEntry.baseClasses && (
                <ComponentBaseSection
                  componentEntry={componentEntry}
                  scanData={scanData}
                />
              )}
            </div>
          </>
        )}

        {activeMode === "component" && !componentEntry && isComponent && (
          <div
            className="px-4 py-3 text-[11px]"
            style={{ color: "var(--studio-text-dimmed)" }}
          >
            Component definition not found in scan data.
          </div>
        )}

        {activeMode === "instance" && (
          <>
            <div className="studio-tab-explainer">
              <InfoCircledIcon />
              <span>
                {isComponent
                  ? "Edit this element's variant, size, and Tailwind classes."
                  : "Edit this element's Tailwind classes directly."}
              </span>
            </div>
            <div className="">
              {isComponent && componentEntry?.variants.map((dim: any) => (
                <InstanceVariantSection
                  key={dim.name}
                  dim={dim}
                  element={element}
                  componentEntry={componentEntry}
                  pageFilePath={pageFilePath}
                  instanceIdentifier={instanceIdentifier}
                  withSave={withSave}
                />
              ))}

              {element.className && (
                <PropertyPanel
                  classes={element.className}
                  onClassChange={(oldClass, newClass) => {
                    const filePath = pageFilePath || componentEntry?.filePath || "";
                    withSave(() =>
                      handleElementClassChange(
                        filePath,
                        element.className,
                        oldClass,
                        newClass
                      )
                    );
                  }}
                  tokenGroups={scanData?.tokens.groups || {}}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Collapsible variant sections ---

function InstanceVariantSection({
  dim,
  element,
  componentEntry,
  pageFilePath,
  instanceIdentifier,
  withSave,
}: {
  dim: any;
  element: ElementData;
  componentEntry: any;
  pageFilePath: string | null;
  instanceIdentifier: string;
  withSave: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const currentValue =
    dim.name === "variant"
      ? element.dataVariant
      : dim.name === "size"
        ? element.dataSize
        : null;
  const activeValue = currentValue || dim.default;

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        {dim.name}
        {collapsed && (
          <span
            className="text-[10px] font-mono font-normal ml-1"
            style={{ color: "var(--studio-text)" }}
          >
            · {activeValue}
          </span>
        )}
        <span className="count">{dim.options.length}</span>
      </button>
      {!collapsed && (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {dim.options.map((opt: string) => {
            const isActive = currentValue === opt || (!currentValue && opt === dim.default);
            return (
              <button
                key={opt}
                onClick={() =>
                  withSave(() =>
                    handleInstancePropChange(
                      pageFilePath || componentEntry?.filePath || "",
                      componentEntry.name,
                      dim.name,
                      opt,
                      instanceIdentifier
                    )
                  )
                }
                className={`studio-bp-btn ${isActive ? "active" : ""}`}
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

function ComponentVariantSection({
  dim,
  componentEntry,
  scanData,
}: {
  dim: any;
  componentEntry: any;
  scanData: ScanData | null;
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
                      handleComponentClassChange(
                        componentEntry.filePath,
                        oldClass,
                        newClass,
                        opt
                      );
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
}: {
  componentEntry: any;
  scanData: ScanData | null;
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
            onClassChange={(oldClass, newClass) => {
              handleComponentClassChange(
                componentEntry.filePath,
                oldClass,
                newClass
              );
            }}
            tokenGroups={scanData?.tokens.groups || {}}
            flat
          />
        </div>
      )}
    </div>
  );
}

// --- API call helpers ---

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

async function handleInstancePropChange(
  filePath: string,
  componentName: string,
  propName: string,
  propValue: string,
  textHint?: string
) {
  try {
    const res = await fetch("/api/element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "prop",
        filePath,
        componentName,
        propName,
        propValue,
        textHint,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Instance write failed:", data.error);
  } catch (err) {
    console.error("Instance write error:", err);
  }
}

async function handleElementClassChange(
  filePath: string,
  classIdentifier: string,
  oldClass: string,
  newClass: string
) {
  try {
    const res = await fetch("/api/element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "class",
        filePath,
        classIdentifier: truncateToWholeClass(classIdentifier, 80),
        oldClass,
        newClass,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Element write failed:", data.error);
  } catch (err) {
    console.error("Element write error:", err);
  }
}

function truncateToWholeClass(classStr: string, maxLen: number): string {
  if (classStr.length <= maxLen) return classStr;
  const truncated = classStr.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

function extractTokenReferences(
  className: string,
  scanData: ScanData | null
): string[] {
  if (!scanData) return [];

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
