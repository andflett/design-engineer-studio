"use client";

/**
 * <Surface /> — Selection overlay component for the target app.
 * Mounted automatically by withDesigntools() in development.
 * Communicates with the editor UI via postMessage.
 *
 * Refactored from core/src/inject/selection.ts into a React component
 * with proper lifecycle management.
 */

import { useEffect, useRef, useState, createElement } from "react";
import { createPortal } from "react-dom";

// Overlay elements are created imperatively (not React-rendered)
// because they need to be fixed-position overlays that don't interfere
// with the app's React tree.

interface PreviewCombination {
  label: string;
  props: Record<string, string>;
}

/**
 * Extract CSS custom properties from :root / * / html rules in the document's stylesheets.
 * Returns {name, value}[] for all --* properties found on global selectors.
 */
function extractCssCustomProperties(): { name: string; value: string }[] {
  const props: { name: string; value: string }[] = [];
  const seen = new Set<string>();

  try {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules;
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (!(rule instanceof CSSStyleRule)) continue;
          const sel = rule.selectorText.trim();
          if (sel !== ":root" && sel !== "*" && sel !== "html" && sel !== ":root, :host") continue;

          for (let j = 0; j < rule.style.length; j++) {
            const name = rule.style[j];
            if (!name.startsWith("--")) continue;
            if (seen.has(name)) continue;
            seen.add(name);
            const value = rule.style.getPropertyValue(name).trim();
            if (value) props.push({ name, value });
          }
        }
      } catch {
        // CORS — skip cross-origin stylesheets
      }
    }
  } catch {
    // No stylesheets accessible
  }

  return props;
}

export function Surface() {
  const stateRef = useRef({
    selectionMode: false,
    hoveredElement: null as Element | null,
    selectedElement: null as Element | null,
    selectedDomPath: null as string | null,
    overlayRafId: null as number | null,
    inlineStyleBackups: new Map<string, string>(),
    tokenValueBackups: new Map<string, string>(),
    tokenPreviewValues: new Map<string, string>(),
    tokenPreviewStyle: null as HTMLStyleElement | null,
    highlightOverlay: null as HTMLDivElement | null,
    selectedOverlay: null as HTMLDivElement | null,
    toggleBadge: null as HTMLDivElement | null,
    overlayState: null as {
      tier: "full" | "instance-only" | "inspect-only";
      showToggle: boolean;
      activeMode: "component" | "instance" | null;
      isDataDriven: boolean;
      inLoop: boolean;
      hasDynamicContent: boolean;
      dataOrigin?: "local" | "external";
      iteratorExpression?: string;
      packageName?: string;
    } | null,
  });

  // Preview overlay state
  const [previewComponent, setPreviewComponent] = useState<React.ComponentType<any> | null>(null);
  const [previewCombinations, setPreviewCombinations] = useState<PreviewCombination[]>([]);
  const [previewDefaultChildren, setPreviewDefaultChildren] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Ref so the imperative useEffect can trigger state updates
  const setPreviewRef = useRef({
    setPreviewComponent,
    setPreviewCombinations,
    setPreviewDefaultChildren,
    setPreviewError,
    setShowPreview,
  });
  setPreviewRef.current = {
    setPreviewComponent,
    setPreviewCombinations,
    setPreviewDefaultChildren,
    setPreviewError,
    setShowPreview,
  };

  useEffect(() => {
    const s = stateRef.current;

    // --- Create overlay DOM elements ---
    s.highlightOverlay = document.createElement("div");
    s.highlightOverlay.id = "tool-highlight";
    Object.assign(s.highlightOverlay.style, {
      position: "fixed",
      pointerEvents: "none",
      border: "2px solid #3b82f6",
      backgroundColor: "rgba(59, 130, 246, 0.08)",
      borderRadius: "2px",
      zIndex: "99999",
      display: "none",
      transition: "all 0.1s ease",
    });
    document.body.appendChild(s.highlightOverlay);

    s.selectedOverlay = document.createElement("div");
    s.selectedOverlay.id = "tool-selected";
    Object.assign(s.selectedOverlay.style, {
      position: "fixed",
      pointerEvents: "none",
      border: "2px solid #3b82f6",
      backgroundColor: "transparent",
      borderRadius: "2px",
      zIndex: "99998",
      display: "none",
    });
    document.body.appendChild(s.selectedOverlay);

    s.toggleBadge = document.createElement("div");
    s.toggleBadge.id = "tool-toggle-badge";
    Object.assign(s.toggleBadge.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "100001",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "3px",
      padding: "0",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      background: "none",
      border: "none",
      userSelect: "none",
    });
    document.body.appendChild(s.toggleBadge);

    // --- Helpers ---
    function getElementName(el: Element): string {
      const slot = el.getAttribute("data-slot");
      if (slot) return slot.charAt(0).toUpperCase() + slot.slice(1);
      if (!el.getAttribute("data-source")) return `~ <${el.tagName.toLowerCase()}>`;
      return `<${el.tagName.toLowerCase()}>`;
    }

    // SVG icons (inline, sized 11x11) for component and instance modes
    const ICON_COMPONENT = `<svg width="11" height="11" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.67129 3.14634C4.47603 3.34161 4.47603 3.65819 4.67129 3.85345L7.14616 6.32833C7.34142 6.52359 7.65801 6.52359 7.85327 6.32833L10.3281 3.85345C10.5234 3.65819 10.5234 3.34161 10.3281 3.14634L7.85327 0.671471C7.65801 0.476209 7.34142 0.476209 7.14616 0.671471L4.67129 3.14634ZM7.49971 5.26766L5.73195 3.4999L7.49971 1.73213L9.26748 3.4999L7.49971 5.26766ZM8.67129 7.14634C8.47603 7.34161 8.47603 7.65819 8.67129 7.85345L11.1462 10.3283C11.3414 10.5236 11.658 10.5236 11.8533 10.3283L14.3281 7.85345C14.5234 7.65819 14.5234 7.34161 14.3281 7.14634L11.8533 4.67147C11.658 4.47621 11.3414 4.47621 11.1462 4.67147L8.67129 7.14634ZM11.4997 9.26766L9.73195 7.4999L11.4997 5.73213L13.2675 7.4999L11.4997 9.26766ZM4.67129 11.8535C4.47603 11.6582 4.47603 11.3416 4.67129 11.1463L7.14616 8.67147C7.34142 8.47621 7.65801 8.47621 7.85327 8.67147L10.3281 11.1463C10.5234 11.3416 10.5234 11.6582 10.3281 11.8535L7.85327 14.3283C7.65801 14.5236 7.34142 14.5236 7.14616 14.3283L4.67129 11.8535ZM5.73195 11.4999L7.49971 13.2677L9.26748 11.4999L7.49971 9.73213L5.73195 11.4999ZM0.671288 7.14649C0.476026 7.34175 0.476026 7.65834 0.671288 7.8536L3.14616 10.3285C3.34142 10.5237 3.65801 10.5237 3.85327 10.3285L6.32814 7.8536C6.5234 7.65834 6.5234 7.34175 6.32814 7.14649L3.85327 4.67162C3.65801 4.47636 3.34142 4.47636 3.14616 4.67162L0.671288 7.14649ZM3.49972 9.26781L1.73195 7.50005L3.49972 5.73228L5.26748 7.50005L3.49972 9.26781Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>`;
    const ICON_INSTANCE = `<svg width="11" height="11" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.1465 1.48959C7.34176 1.29432 7.65835 1.29432 7.85361 1.48959L13.5105 7.14644C13.7057 7.3417 13.7057 7.65829 13.5105 7.85355L7.85361 13.5104C7.65835 13.7057 7.34176 13.7057 7.1465 13.5104L1.48965 7.85355C1.29439 7.65829 1.29439 7.3417 1.48965 7.14644L7.1465 1.48959ZM7.50005 2.55025L2.55031 7.49999L7.50005 12.4497L12.4498 7.49999L7.50005 2.55025Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>`;

    /** Build an inline chip HTML span. iconColor defaults to color if omitted. */
    function chip(label: string, color: string, bg: string, icon?: string, iconColor?: string): string {
      const safe = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const iconHtml = icon ? `<span style="display:flex;align-items:center;color:${iconColor ?? color}">${icon}</span>` : "";
      return `<span style="display:inline-flex;align-items:center;gap:4px;color:${color};background:${bg};border-radius:4px;padding:3px 8px;font-size:11px;font-family:ui-monospace,monospace;white-space:nowrap;line-height:1.4">${iconHtml}${safe}</span>`;
    }

    /** Update selectedOverlay border colour based on overlay state. Badge row is rebuilt on hover. */
    function updateOverlayState(state: typeof s.overlayState) {
      if (!state) return;
      s.overlayState = state;
      const { tier, activeMode, inLoop, hasDynamicContent } = state;

      // --- Border colour (priority: loop > dynamic > component > instance > inspect) ---
      if (s.selectedOverlay) {
        if (tier === "inspect-only") {
          s.selectedOverlay.style.border = "2px solid rgba(107,114,128,0.5)";
        } else if (inLoop) {
          s.selectedOverlay.style.border = "2px dashed rgba(139,92,246,0.7)";
        } else if (hasDynamicContent) {
          s.selectedOverlay.style.border = "2px solid rgba(20,184,166,0.7)";
        } else if (activeMode === "component") {
          s.selectedOverlay.style.border = "2px solid rgba(249,115,22,0.6)";
        } else {
          s.selectedOverlay.style.border = "2px solid rgba(59,130,246,0.6)";
        }
        s.selectedOverlay.style.backgroundColor = "transparent";
      }
    }

    function getDomPath(el: Element): string {
      // Build a pure structural path using nth-child at every level.
      // This is stable across class changes (HMR only replaces attributes,
      // not DOM structure) and guaranteed unique.
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body) {
        const parent = current.parentElement;
        if (parent) {
          const idx = Array.from(parent.children).indexOf(current) + 1;
          parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${idx})`);
        } else {
          parts.unshift(current.tagName.toLowerCase());
        }
        current = current.parentElement;
      }
      return parts.join(" > ");
    }

    function positionOverlay(overlay: HTMLDivElement, rect: DOMRect) {
      Object.assign(overlay.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        display: "block",
      });
    }

    function findSelectableElement(target: Element): Element {
      // Walk up to find the nearest data-slot ancestor
      let dataSlotEl: Element | null = null;
      let el: Element | null = target;
      while (el && el !== document.body) {
        if (el.getAttribute("data-slot")) { dataSlotEl = el; break; }
        el = el.parentElement;
      }

      if (!dataSlotEl) {
        // No data-slot ancestor — plain authored element, select directly
        return target;
      }

      // Check if the target is "slot content" authored in a different file than the component.
      // data-source format: "file:line:col" — split on ":" to get the file path.
      const targetSrc = target.getAttribute("data-source");
      const slotSrc = dataSlotEl.getAttribute("data-source");
      if (targetSrc && slotSrc) {
        // Find the last ":" that separates col, then line, to extract just the file path
        // Simpler: split on ":" and take everything except the last two segments
        const targetFile = targetSrc.split(":").slice(0, -2).join(":");
        const slotFile = slotSrc.split(":").slice(0, -2).join(":");
        if (targetFile && slotFile && targetFile !== slotFile) {
          // Target is from a different source file → it's slot/page content, select it directly
          return target;
        }
      }

      // Target is component-internal → select the component root
      return dataSlotEl;
    }

    // --- Component tree extraction (React Fiber) ---

    // IDs of overlay elements to skip during tree building
    const overlayIds = new Set(["tool-highlight", "tool-selected", "tool-toggle-badge", "surface-token-preview"]);

    // Tags to skip even if authored — document-level elements and void
    // elements that aren't meaningful to designers
    const skipTags = new Set([
      "html", "body", "head",                // document structure
      "br", "hr", "wbr",                     // void/formatting
      "template", "slot",                    // shadow DOM
    ]);

    // React and Next.js framework components to hide from the tree
    const frameworkPatterns = [
      /^Fragment$/, /^Suspense$/, /^ErrorBoundary$/,
      /^Provider$/, /^Consumer$/, /Context$/,
      /^ForwardRef$/, /^Memo$/, /^Lazy$/,
      // Next.js routing internals
      /^InnerLayoutRouter$/, /^OuterLayoutRouter$/, /^LayoutRouter$/,
      /^RenderFromTemplateContext$/, /^TemplateContext$/,
      /^RedirectBoundary$/, /^RedirectErrorBoundary$/,
      /^NotFoundBoundary$/, /^LoadingBoundary$/,
      /^HTTPAccessFallbackBoundary$/, /^HTTPAccessFallbackErrorBoundary$/,
      /^ClientPageRoot$/, /^HotReload$/, /^ReactDevOverlay$/,
      /^PathnameContextProviderAdapter$/,
      // Next.js App Router internals (segment tree)
      /^SegmentViewNode$/, /^SegmentTrieNode$/,
      /^SegmentViewStateNode$/, /^SegmentBoundaryTriggerNode$/,
      /^SegmentStateProvider$/,
      /^ScrollAndFocusHandler$/, /^InnerScrollAndFocusHandler$/,
      /^AppRouter$/, /^Router$/, /^Root$/, /^ServerRoot$/,
      /^RootErrorBoundary$/, /^ErrorBoundaryHandler$/,
      /^AppRouterAnnouncer$/, /^HistoryUpdater$/, /^RuntimeStyles$/,
      /^DevRootHTTPAccessFallbackBoundary$/,
      /^AppDevOverlayErrorBoundary$/, /^ReplaySsrOnlyErrors$/,
      /^HeadManagerContext$/, /^Head$/,
      /^MetadataOutlet$/, /^AsyncMetadataOutlet$/,
      /^__next_/,  // All __next_ prefixed components
    ];

    function isFrameworkComponent(name: string): boolean {
      return frameworkPatterns.some(p => p.test(name));
    }

    /**
     * Get the React fiber for a DOM element.
     * React attaches fibers via __reactFiber$<randomKey> in dev mode.
     * Stable since React 17 through React 19.
     */
    function getFiber(el: Element): any | null {
      const key = Object.keys(el).find(k => k.startsWith("__reactFiber$"));
      return key ? (el as any)[key] : null;
    }

    /**
     * Get direct text content of an element (not descendant text).
     */
    function getDirectText(el: Element): string {
      let text = "";
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += (node.textContent || "").trim();
        }
      }
      return text.slice(0, 40);
    }

    interface TreeNode {
      id: string;
      name: string;
      type: "component" | "element";
      dataSlot: string | null;
      source: string | null;
      scope: "layout" | "page" | null;
      textContent: string;
      children: TreeNode[];
    }

    /**
     * Infer routing scope from a data-source or data-instance-source path.
     * Framework-specific: Next.js uses layout.tsx / page.tsx file naming.
     */
    function inferScope(sourcePath: string | null): "layout" | "page" | null {
      if (!sourcePath) return null;
      // data-source format is "file:line:col" — extract the file part
      const colonIdx = sourcePath.indexOf(":");
      const file = colonIdx > 0 ? sourcePath.slice(0, colonIdx) : sourcePath;
      if (/\/layout\.[tjsx]+$/i.test(file) || /^layout\.[tjsx]+$/i.test(file)) return "layout";
      if (/\/page\.[tjsx]+$/i.test(file) || /^page\.[tjsx]+$/i.test(file)) return "page";
      return null;
    }

    /**
     * Determine scope for a component by checking its instance-source
     * (where it's used) or its own source (where it's defined).
     * Instance source takes priority — a Button in layout.tsx has layout scope.
     */
    function getScopeForElement(el: Element | null, parentScope: "layout" | "page" | null): "layout" | "page" | null {
      if (!el) return parentScope;
      // Check instance-source first (where this component is used)
      const instanceSource = el.getAttribute("data-instance-source");
      const fromInstance = inferScope(instanceSource);
      if (fromInstance) return fromInstance;
      // Check own source (where this element is defined)
      const source = el.getAttribute("data-source");
      const fromSource = inferScope(source);
      if (fromSource) return fromSource;
      // Inherit from parent context
      return parentScope;
    }

    /**
     * Build a component tree by walking the React fiber tree.
     * Filters to: user-defined components, data-slot components, semantic HTML.
     */
    function buildComponentTree(rootEl: Element): TreeNode[] {
      // Try to get fiber from the root element or its first few children
      // (React attaches fibers to the container like #root, not body)
      let fiber = getFiber(rootEl);
      if (!fiber) {
        for (const child of Array.from(rootEl.children)) {
          fiber = getFiber(child);
          if (fiber) break;
        }
      }

      if (!fiber) {
        // Fallback: DOM walk (no fiber access)
        return buildDataSlotTree(rootEl);
      }

      // Walk up to the fiber root
      let fiberRoot = fiber;
      while (fiberRoot.return) fiberRoot = fiberRoot.return;

      const results: TreeNode[] = [];
      walkFiber(fiberRoot.child, results, null);
      return results;
    }

    function walkFiber(fiber: any | null, siblings: TreeNode[], parentScope: "layout" | "page" | null): void {
      while (fiber) {
        const node = processFiber(fiber, parentScope);
        if (node) {
          siblings.push(node);
        } else {
          // This fiber was filtered out — but still walk its children
          // so nested visible components bubble up.
          // Infer scope from this invisible fiber for its children.
          if (fiber.child) {
            let childScope = parentScope;
            if (typeof fiber.type === "string" && fiber.stateNode instanceof Element) {
              // Host element (div, html, body, etc.) — check its data-source
              childScope = getScopeForElement(fiber.stateNode, parentScope);
            } else if (typeof fiber.type === "function" || typeof fiber.type === "object") {
              // Filtered-out component — check its root host element for scope.
              // This catches cases like RootLayout -> <html data-source="app/layout.tsx:...">
              // where the component itself is filtered but its root element carries scope.
              const hostEl = findOwnHostElement(fiber);
              if (hostEl) {
                childScope = getScopeForElement(hostEl, parentScope);
              }
            }
            walkFiber(fiber.child, siblings, childScope);
          }
        }
        fiber = fiber.sibling;
      }
    }

    function processFiber(fiber: any, parentScope: "layout" | "page" | null): TreeNode | null {
      // Skip text nodes and fragments
      if (typeof fiber.type === "string") {
        // This is a host element (div, span, etc.)
        return processHostFiber(fiber, parentScope);
      }

      if (typeof fiber.type === "function" || typeof fiber.type === "object") {
        return processComponentFiber(fiber, parentScope);
      }

      // Other fiber types (portals, etc.) — walk children transparently
      return null;
    }

    function processHostFiber(fiber: any, parentScope: "layout" | "page" | null): TreeNode | null {
      const tag = fiber.type as string;
      const el = fiber.stateNode as Element | null;

      // Skip our overlay elements
      if (el && el.id && overlayIds.has(el.id)) return null;

      // Skip script, style, link, noscript
      if (["script", "style", "link", "noscript"].includes(tag)) return null;

      const scope = getScopeForElement(el, parentScope);

      // Check for data-slot — this is a design system component root element
      const dataSlot = el?.getAttribute("data-slot") || null;
      if (dataSlot) {
        const name = dataSlot.split("-").map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
        const children: TreeNode[] = [];
        if (fiber.child) walkFiber(fiber.child, children, scope);
        return {
          id: el ? getDomPath(el) : "",
          name,
          type: "component",
          dataSlot,
          source: el?.getAttribute("data-source") || null,
          scope,
          textContent: el ? getDirectText(el) : "",
          children,
        };
      }

      // Show all authored elements (have data-source from our Babel transform).
      // The client-side page-explorer handles collapsing nested div chains.
      if (el?.hasAttribute("data-source") && !skipTags.has(tag)) {
        const children: TreeNode[] = [];
        if (fiber.child) walkFiber(fiber.child, children, scope);
        const text = el ? getDirectText(el) : "";
        return {
          id: getDomPath(el),
          name: `<${tag}>`,
          type: "element",
          dataSlot: null,
          source: el.getAttribute("data-source"),
          scope,
          textContent: text,
          children,
        };
      }

      // Generic containers and elements without data-source: skip this node,
      // but walk children (children bubble up to parent's list via walkFiber)
      return null;
    }

    function processComponentFiber(fiber: any, parentScope: "layout" | "page" | null): TreeNode | null {
      // Get component name
      const type = fiber.type;
      const name = type?.displayName || type?.name || null;

      // No name = anonymous component, skip
      if (!name) return null;

      // Skip framework internals
      if (isFrameworkComponent(name)) return null;

      // Skip the Surface component itself
      if (name === "Surface") return null;

      // Find this component's own root host element — only walk down through
      // non-host fibers (other components, fragments, etc.) to find the first
      // DOM element this component directly renders. Don't descend into child
      // components, which would give us a different component's element.
      const hostEl = findOwnHostElement(fiber);

      // Check if this component comes from user code by looking for
      // data-instance-source (set on component JSX by our Babel transform)
      // on the host element. data-instance-source proves the component
      // usage was in a user file processed by our loader.
      // Also accept data-slot as proof of being a known component.
      const hasInstanceSource = hostEl?.getAttribute("data-instance-source");
      const hasDataSlot = hostEl?.getAttribute("data-slot");
      if (!hasInstanceSource && !hasDataSlot) return null;

      const scope = getScopeForElement(hostEl, parentScope);
      const dataSlot = hasDataSlot || null;
      const children: TreeNode[] = [];

      // When this component's root host element has data-slot, the child
      // walker would also pick it up via processHostFiber and create a
      // duplicate node. To avoid that, find the host fiber and walk its
      // children directly (skipping the host element itself).
      const hostFiber = dataSlot ? findHostFiber(fiber) : null;
      const childFiber = hostFiber ? hostFiber.child : fiber.child;
      if (childFiber) walkFiber(childFiber, children, scope);

      // Collapse: if this component has exactly one child component and no
      // direct text, skip this wrapper and promote the child
      if (children.length === 1 && !dataSlot && !(hostEl && getDirectText(hostEl))) {
        const child = children[0];
        if (child.type === "component") {
          return child;
        }
      }

      return {
        id: hostEl ? getDomPath(hostEl) : "",
        name,
        type: "component",
        dataSlot,
        source: hostEl?.getAttribute("data-source") || null,
        scope,
        textContent: hostEl ? getDirectText(hostEl) : "",
        children,
      };
    }

    /**
     * Find a component fiber's own root host fiber (not the element).
     * Same walk as findOwnHostElement but returns the fiber itself,
     * so we can skip it in the tree walk and avoid data-slot duplication.
     */
    function findHostFiber(fiber: any): any | null {
      let child = fiber.child;
      while (child) {
        if (child.stateNode instanceof Element) return child;
        const tag = child.tag;
        const isComponentBoundary = tag === 0 || tag === 1 || tag === 11 || tag === 14 || tag === 15;
        if (!isComponentBoundary && child.child) {
          const found = findHostFiber(child);
          if (found) return found;
        }
        child = child.sibling;
      }
      return null;
    }

    /**
     * Find a component fiber's own root host DOM element.
     * Walks through transparent fibers (fragments, mode, profiler) but
     * stops at component boundaries (function/class/forwardRef/memo) to
     * avoid descending into child components.
     */
    function findOwnHostElement(fiber: any): Element | null {
      let child = fiber.child;
      while (child) {
        // Found a DOM element — this is our root host element
        if (child.stateNode instanceof Element) return child.stateNode;

        // Check fiber tag to determine if this is a component boundary.
        // React fiber tags: 0=FunctionComponent, 1=ClassComponent,
        // 11=ForwardRef, 14=MemoComponent, 15=SimpleMemoComponent.
        // These are component boundaries — don't descend.
        const tag = child.tag;
        const isComponentBoundary = tag === 0 || tag === 1 || tag === 11 || tag === 14 || tag === 15;

        if (!isComponentBoundary && child.child) {
          // Transparent fiber (fragment, mode, context, etc.) — walk through
          const found = findOwnHostElement(child);
          if (found) return found;
        }

        child = child.sibling;
      }
      return null;
    }

    /**
     * Fallback: build tree from DOM using only data-slot elements.
     * Used when React fiber access is unavailable.
     */
    function buildDataSlotTree(root: Element): TreeNode[] {
      const results: TreeNode[] = [];
      for (const child of Array.from(root.children)) {
        walkDomForSlots(child, results, null);
      }
      return results;
    }

    function walkDomForSlots(el: Element, siblings: TreeNode[], parentScope: "layout" | "page" | null): void {
      // Skip overlay elements
      if (el.id && overlayIds.has(el.id)) return;

      const dataSlot = el.getAttribute("data-slot");
      const tag = el.tagName.toLowerCase();
      const scope = getScopeForElement(el, parentScope);

      if (dataSlot) {
        const name = dataSlot.split("-").map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
        const children: TreeNode[] = [];
        for (const child of Array.from(el.children)) {
          walkDomForSlots(child, children, scope);
        }
        siblings.push({
          id: getDomPath(el),
          name,
          type: "component",
          dataSlot,
          source: el.getAttribute("data-source") || null,
          scope,
          textContent: getDirectText(el),
          children,
        });
      } else if (el.hasAttribute("data-source") && !skipTags.has(tag)) {
        // Show all authored elements — client-side handles chain collapsing
        const children: TreeNode[] = [];
        for (const child of Array.from(el.children)) {
          walkDomForSlots(child, children, scope);
        }
        const text = getDirectText(el);
        siblings.push({
          id: getDomPath(el),
          name: `<${tag}>`,
          type: "element",
          dataSlot: null,
          source: el.getAttribute("data-source") || null,
          scope,
          textContent: text,
          children,
        });
      } else {
        // No data-source or skipTag — walk children transparently
        for (const child of Array.from(el.children)) {
          walkDomForSlots(child, siblings, scope);
        }
      }
    }

    function sendComponentTree() {
      const tree = buildComponentTree(document.body);
      window.parent.postMessage({ type: "tool:componentTree", tree }, "*");
    }

    // Debounce helper for MutationObserver
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    function debouncedSendTree() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => sendComponentTree(), 300);
    }

    // MutationObserver to send updated tree on DOM changes (HMR, dynamic content)
    const treeObserver = new MutationObserver(debouncedSendTree);
    treeObserver.observe(document.body, { childList: true, subtree: true });

    const relevantProps = [
      "display", "position", "top", "right", "bottom", "left",
      "z-index", "overflow", "overflow-x", "overflow-y",
      "flex-direction", "flex-wrap", "justify-content", "align-items",
      "align-self", "flex-grow", "flex-shrink", "flex-basis", "order",
      "grid-template-columns", "grid-template-rows",
      "gap", "row-gap", "column-gap",
      "width", "height", "min-width", "min-height", "max-width", "max-height",
      "margin-top", "margin-right", "margin-bottom", "margin-left",
      "padding-top", "padding-right", "padding-bottom", "padding-left",
      "font-family", "font-size", "font-weight", "line-height",
      "letter-spacing", "text-align", "text-decoration", "text-transform",
      "color", "white-space",
      "background-color", "background-image", "background-size", "background-position",
      "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
      "border-style", "border-color",
      "border-top-left-radius", "border-top-right-radius",
      "border-bottom-right-radius", "border-bottom-left-radius",
      "opacity", "box-shadow", "transform", "transition",
    ];

    const inheritableProps = [
      "color", "font-family", "font-size", "font-weight", "line-height",
      "letter-spacing", "text-align", "text-transform", "white-space",
    ];

    /**
     * Walk UP the fiber tree from a DOM element's fiber to find the
     * component that renders this element as its root host element.
     * Checks tags 0 (Function), 1 (Class), 11 (ForwardRef),
     * 14 (Memo), 15 (SimpleMemo) as component boundaries.
     */
    function findComponentFiberAbove(el: Element): any | null {
      const fiber = getFiber(el);
      if (!fiber) return null;
      let candidate = fiber.return;
      while (candidate) {
        const tag = candidate.tag;
        if (tag === 0 || tag === 1 || tag === 11 || tag === 14 || tag === 15) {
          // Check if this component's root host element is our element
          if (findOwnHostElement(candidate) === el) return candidate;
        }
        candidate = candidate.return;
      }
      return null;
    }

    /**
     * Read memoizedProps from a fiber, filtering to simple values only.
     * Skips children, ref, key, className, style, and data-* props.
     */
    function extractFiberProps(fiber: any): Record<string, string | number | boolean> | null {
      const props = fiber?.memoizedProps;
      if (!props || typeof props !== "object") return null;
      const skipKeys = new Set(["children", "ref", "key", "className", "style"]);
      const result: Record<string, string | number | boolean> = {};
      let count = 0;
      for (const k of Object.keys(props)) {
        if (skipKeys.has(k)) continue;
        if (k.startsWith("data-")) continue;
        const v = props[k];
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          result[k] = v;
          count++;
        }
      }
      return count > 0 ? result : null;
    }

    // Known Tailwind breakpoint names sorted by min-width
    const BREAKPOINTS: Array<{ name: string; px: number }> = [
      { name: "sm", px: 640 },
      { name: "md", px: 768 },
      { name: "lg", px: 1024 },
      { name: "xl", px: 1280 },
      { name: "2xl", px: 1536 },
    ];

    /** Map longhand CSS properties to their shorthand parent */
    const LONGHAND_TO_SHORTHAND: Record<string, string> = {
      "padding-top": "padding", "padding-right": "padding",
      "padding-bottom": "padding", "padding-left": "padding",
      "margin-top": "margin", "margin-right": "margin",
      "margin-bottom": "margin", "margin-left": "margin",
      "border-top-width": "border-width", "border-right-width": "border-width",
      "border-bottom-width": "border-width", "border-left-width": "border-width",
    };

    function walkRules(
      rules: CSSRuleList,
      el: Element,
      props: string[],
      result: Record<string, string>
    ): void {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          try {
            if (el.matches(rule.selectorText)) {
              for (const prop of props) {
                // Inline style takes precedence — skip if element has inline style for this prop
                if ((el as HTMLElement).style.getPropertyValue(prop)) continue;
                let val = rule.style.getPropertyValue(prop);
                // If longhand not found, check the shorthand (e.g. padding → padding-top)
                if (!val) {
                  const shorthand = LONGHAND_TO_SHORTHAND[prop];
                  if (shorthand) val = rule.style.getPropertyValue(shorthand);
                }
                if (val) result[prop] = val.trim();
              }
            }
          } catch { /* invalid selector — skip */ }
        } else if (rule instanceof CSSMediaRule) {
          // Only recurse if the media query is currently active
          if (window.matchMedia(rule.conditionText).matches) {
            walkRules(rule.cssRules, el, props, result);
          }
        } else if ("cssRules" in rule && (rule as any).cssRules) {
          // CSSLayerBlockRule, CSSSupportsRule, etc.
          walkRules((rule as any).cssRules as CSSRuleList, el, props, result);
        }
      }
    }

    function getAuthoredStyles(el: Element, props: string[]): Record<string, string | null> {
      const rawResult: Record<string, string> = {};
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walkRules(sheet.cssRules, el, props, rawResult);
        } catch { /* cross-origin sheet — skip */ }
      }
      const out: Record<string, string | null> = {};
      for (const prop of props) {
        out[prop] = rawResult[prop] || null;
      }
      return out;
    }

    function getActiveBreakpoint(): string | null {
      const found: Array<{ name: string; minWidth: number }> = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (!(rule instanceof CSSMediaRule)) continue;
            // Match both Tailwind v3 (min-width: 768px) and v4 (width >= 768px)
            const mwMatch =
              rule.conditionText.match(/min-width:\s*([\d.]+)px/) ||
              rule.conditionText.match(/width\s*>=\s*([\d.]+)px/);
            if (!mwMatch) continue;
            const minWidth = parseFloat(mwMatch[1]);
            if (!window.matchMedia(rule.conditionText).matches) continue;
            const bp = BREAKPOINTS.find((b) => Math.abs(b.px - minWidth) < 1);
            if (bp && !found.some((f) => f.name === bp.name)) {
              found.push({ name: bp.name, minWidth });
            }
          }
        } catch { /* cross-origin — skip */ }
      }
      if (found.length === 0) return null;
      return found.sort((a, b) => b.minWidth - a.minWidth)[0].name;
    }

    function extractElementData(el: Element) {
      const computed = getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      const computedStyles: Record<string, string> = {};
      for (const prop of relevantProps) {
        computedStyles[prop] = computed.getPropertyValue(prop);
      }

      const parentComputedStyles: Record<string, string> = {};
      const parentEl = el.parentElement;
      if (parentEl) {
        const parentComputed = getComputedStyle(parentEl);
        for (const prop of inheritableProps) {
          parentComputedStyles[prop] = parentComputed.getPropertyValue(prop);
        }
      }

      const attributes: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith("data-")) {
          attributes[attr.name] = attr.value;
        }
      }

      // Parse data-source
      let sourceFile: string | null = null;
      let sourceLine: number | null = null;
      let sourceCol: number | null = null;

      const dataSource = el.getAttribute("data-source");
      if (dataSource) {
        const lastColon = dataSource.lastIndexOf(":");
        const secondLastColon = dataSource.lastIndexOf(":", lastColon - 1);
        if (secondLastColon > 0) {
          sourceFile = dataSource.slice(0, secondLastColon);
          sourceLine = parseInt(dataSource.slice(secondLastColon + 1, lastColon), 10);
          sourceCol = parseInt(dataSource.slice(lastColon + 1), 10);
        }
      }

      // For component instances: read data-instance-source directly from the DOM element.
      let instanceSourceFile: string | null = null;
      let instanceSourceLine: number | null = null;
      let instanceSourceCol: number | null = null;
      let componentName: string | null = null;
      let packageName: string | null = null;

      const dataSlot = el.getAttribute("data-slot");
      const instanceSource = el.getAttribute("data-instance-source");
      if (instanceSource) {
        const lc = instanceSource.lastIndexOf(":");
        const slc = instanceSource.lastIndexOf(":", lc - 1);
        if (slc > 0) {
          instanceSourceFile = instanceSource.slice(0, slc);
          instanceSourceLine = parseInt(instanceSource.slice(slc + 1, lc), 10);
          instanceSourceCol = parseInt(instanceSource.slice(lc + 1), 10);
        }

        if (dataSlot) {
          // Derive component name from data-slot (e.g. "card-title" -> "CardTitle")
          componentName = dataSlot
            .split("-")
            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
            .join("");
        }
      }

      // Extract runtime props and derive componentName/packageName from React fiber
      const compFiber = (dataSlot || instanceSource) ? findComponentFiberAbove(el) : null;

      let fiberProps: Record<string, string | number | boolean> | null = null;
      if (compFiber) {
        fiberProps = extractFiberProps(compFiber);

        // Derive componentName from fiber when data-slot is not present
        if (!componentName && instanceSource) {
          const name = compFiber.type?.displayName || compFiber.type?.name;
          if (name) componentName = name;
        }

        // Extract packageName from fiber._debugSource for npm components
        const debugFile = compFiber._debugSource?.fileName;
        if (debugFile) {
          packageName = extractPackageName(debugFile);
        }
      }

      // Also check data-source for packageName if no fiber source
      if (!packageName && !sourceFile) {
        // No project source — try walking up fibers to find node_modules origin
        const anyFiber = findComponentFiberAbove(el);
        if (anyFiber) {
          const debugFile = anyFiber._debugSource?.fileName;
          if (debugFile) {
            packageName = extractPackageName(debugFile);
          }
        }
      }

      const authoredStyles = getAuthoredStyles(el, relevantProps);
      const activeBreakpoint = getActiveBreakpoint();

      return {
        tag: el.tagName.toLowerCase(),
        className: (el.getAttribute("class") || "").trim(),
        computedStyles,
        parentComputedStyles,
        boundingRect: rect,
        domPath: getDomPath(el),
        textContent: (el.textContent || "").trim().slice(0, 100),
        attributes,
        sourceFile,
        sourceLine,
        sourceCol,
        instanceSourceFile,
        instanceSourceLine,
        instanceSourceCol,
        componentName,
        packageName,
        fiberProps,
        authoredStyles,
        activeBreakpoint,
      };
    }

    function extractPackageName(filePath: string): string | null {
      const nmIdx = filePath.lastIndexOf("node_modules/");
      if (nmIdx === -1) return null;
      const rest = filePath.slice(nmIdx + "node_modules/".length);
      if (rest.startsWith("@")) {
        const parts = rest.split("/");
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
      }
      return rest.split("/")[0] || null;
    }

    function selectElement(el: Element) {
      s.selectedElement = el;
      s.selectedDomPath = getDomPath(el);
      const data = extractElementData(el);
      if (s.selectedOverlay) {
        positionOverlay(s.selectedOverlay, data.boundingRect);
      }
      startOverlayTracking();
      window.parent.postMessage({ type: "tool:elementSelected", data }, "*");
    }

    function reselectCurrentElement() {
      if (!s.selectedDomPath) return;
      const el = document.querySelector(s.selectedDomPath);
      if (el) {
        s.selectedElement = el;
        const data = extractElementData(el);
        if (s.selectedOverlay) {
          positionOverlay(s.selectedOverlay, data.boundingRect);
        }
        window.parent.postMessage({ type: "tool:elementSelected", data }, "*");
      }
    }

    function startOverlayTracking() {
      if (s.overlayRafId) cancelAnimationFrame(s.overlayRafId);
      let lastRect = "";
      function tick() {
        if (s.selectedElement && s.selectedOverlay) {
          if (!document.contains(s.selectedElement)) {
            if (s.selectedDomPath) {
              const newEl = document.querySelector(s.selectedDomPath);
              if (newEl) {
                s.selectedElement = newEl;
                reselectCurrentElement();
              }
            }
          }
          if (s.selectedElement && document.contains(s.selectedElement)) {
            const rect = s.selectedElement.getBoundingClientRect();
            const key = `${rect.left},${rect.top},${rect.width},${rect.height}`;
            if (key !== lastRect) {
              lastRect = key;
              positionOverlay(s.selectedOverlay!, rect);
            }
          }
        }
        s.overlayRafId = requestAnimationFrame(tick);
      }
      tick();
    }

    // --- Helper to hide/show selection overlays ---
    function hideSelectionOverlays() {
      if (s.highlightOverlay) s.highlightOverlay.style.display = "none";
      if (s.selectedOverlay) s.selectedOverlay.style.display = "none";
      if (s.toggleBadge) s.toggleBadge.style.display = "none";
      s.hoveredElement = null;
    }

    function enterSelectionMode() {
      s.selectionMode = true;
      document.body.style.cursor = "crosshair";
    }

    function exitSelectionMode() {
      s.selectionMode = false;
      document.body.style.cursor = "";
      if (s.highlightOverlay) s.highlightOverlay.style.display = "none";
      if (s.toggleBadge) s.toggleBadge.style.display = "none";
      s.hoveredElement = null;
    }

    function clearSelection() {
      s.selectedElement = null;
      s.selectedDomPath = null;
      s.overlayState = null;
      if (s.selectedOverlay) s.selectedOverlay.style.display = "none";
      if (s.overlayRafId) {
        cancelAnimationFrame(s.overlayRafId);
        s.overlayRafId = null;
      }
    }

    // --- Event handlers ---
    function onMouseMove(e: MouseEvent) {
      if (!s.selectionMode || !s.highlightOverlay) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === s.highlightOverlay || el === s.selectedOverlay || s.toggleBadge?.contains(el as Node)) return;
      const selectable = findSelectableElement(el);
      if (selectable === s.hoveredElement) return;
      s.hoveredElement = selectable;
      const rect = selectable.getBoundingClientRect();
      positionOverlay(s.highlightOverlay, rect);

      if (!s.toggleBadge) return;
      const name = getElementName(selectable) || selectable.tagName.toLowerCase();
      const isSelected = selectable === s.selectedElement;
      const os = isSelected ? s.overlayState : null;

      // Read DOM-annotated signals (set at build time by the transform) as instant fallback
      const domLoop = selectable.hasAttribute("data-loop");
      const domDynamic = selectable.hasAttribute("data-dynamic");
      const inLoop = os?.inLoop ?? domLoop;
      const hasDynamicContent = os?.hasDynamicContent ?? domDynamic;

      // Tint the highlight overlay to preview what the selection border will look like
      if (inLoop) {
        s.highlightOverlay.style.border = "2px dashed rgba(139,92,246,0.5)";
        s.highlightOverlay.style.backgroundColor = "rgba(139,92,246,0.06)";
      } else if (hasDynamicContent) {
        s.highlightOverlay.style.border = "2px solid rgba(20,184,166,0.5)";
        s.highlightOverlay.style.backgroundColor = "rgba(20,184,166,0.06)";
      } else {
        s.highlightOverlay.style.border = "2px solid rgba(59,130,246,0.6)";
        s.highlightOverlay.style.backgroundColor = "rgba(59,130,246,0.08)";
      }

      const isDark = document.documentElement.classList.contains("dark") ||
        window.matchMedia?.("(prefers-color-scheme: dark)").matches;

      const chips: string[] = [];

      if (os?.tier === "inspect-only") {
        chips.push(chip(os.packageName || name, "#cdd6f4", "#1e1e2e"));
      } else {
        // Name chip: dark bg + white text, coloured icon only
        const compActive = os?.activeMode === "component";
        const nameIcon = compActive ? ICON_COMPONENT : ICON_INSTANCE;
        const iconColor = compActive ? "#f97316" : "#3b82f6";
        chips.push(chip(name, "#cdd6f4", "#1e1e2e", nameIcon, iconColor));
        if (inLoop) chips.push(chip("repeated",
          isDark ? "#c4b5fd" : "#5b21b6",
          isDark ? "#2e1065" : "#ede9fe"
        ));
        if (hasDynamicContent) chips.push(chip("dynamic",
          isDark ? "#5eead4" : "#0f766e",
          isDark ? "#042f2e" : "#ccfbf1"
        ));
      }

      s.toggleBadge.innerHTML = chips.join("");
      s.toggleBadge.style.gap = "4px";
      const badgeH = 22;
      const top = rect.top >= badgeH + 4 ? rect.top - badgeH - 2 : rect.bottom + 2;
      s.toggleBadge.style.left = `${rect.left}px`;
      s.toggleBadge.style.top = `${top}px`;
      s.toggleBadge.style.display = "flex";
    }

    function onMouseLeave() {
      if (!s.highlightOverlay) return;
      s.highlightOverlay.style.display = "none";
      if (s.toggleBadge) s.toggleBadge.style.display = "none";
      s.hoveredElement = null;
    }

    function onClick(e: MouseEvent) {
      if (!s.selectionMode) return;
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === s.highlightOverlay || el === s.selectedOverlay || s.toggleBadge?.contains(el as Node)) return;
      const selectable = findSelectableElement(el);
      selectElement(selectable);
    }

    function onMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg || !msg.type || !msg.type.startsWith("tool:")) return;

      switch (msg.type) {
        case "tool:enterSelectionMode":
          enterSelectionMode();
          break;
        case "tool:exitSelectionMode":
          exitSelectionMode();
          break;
        case "tool:clearSelection":
          clearSelection();
          break;
        case "tool:previewInlineStyle": {
          if (s.selectedElement && s.selectedElement instanceof HTMLElement) {
            const prop = msg.property as string;
            const value = msg.value as string;
            if (!s.inlineStyleBackups.has(prop)) {
              s.inlineStyleBackups.set(prop, s.selectedElement.style.getPropertyValue(prop));
            }
            s.selectedElement.style.setProperty(prop, value, "important");
          }
          break;
        }
        case "tool:revertInlineStyles": {
          if (s.selectedElement && s.selectedElement instanceof HTMLElement) {
            for (const [prop, original] of s.inlineStyleBackups) {
              if (original) {
                s.selectedElement.style.setProperty(prop, original);
              } else {
                s.selectedElement.style.removeProperty(prop);
              }
            }
            s.inlineStyleBackups.clear();
          }
          break;
        }
        case "tool:previewTokenValue": {
          const prop = msg.property as string;
          const value = msg.value as string;
          s.tokenPreviewValues.set(prop, value);
          if (!s.tokenPreviewStyle) {
            s.tokenPreviewStyle = document.createElement("style");
            s.tokenPreviewStyle.id = "surface-token-preview";
            document.head.appendChild(s.tokenPreviewStyle);
          }
          const cssRules: string[] = [];
          for (const [k, v] of s.tokenPreviewValues) {
            if (k.startsWith("--shadow")) {
              const cls = k.slice(2);
              cssRules.push(`.${cls}, [class*="${cls}"] { box-shadow: ${v} !important; }`);
            } else {
              cssRules.push(`*, *::before, *::after { ${k}: ${v} !important; }`);
            }
          }
          s.tokenPreviewStyle.textContent = cssRules.join("\n");
          break;
        }
        case "tool:revertTokenValues": {
          if (s.tokenPreviewStyle) {
            s.tokenPreviewStyle.remove();
            s.tokenPreviewStyle = null;
          }
          s.tokenPreviewValues.clear();
          s.tokenValueBackups.clear();
          break;
        }
        case "tool:reselectElement":
          reselectCurrentElement();
          break;
        case "tool:setTheme":
          if (msg.theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
          break;
        case "tool:requestComponentTree":
          sendComponentTree();
          break;
        case "tool:highlightByTreeId": {
          const id = msg.id as string;
          if (!id || !s.highlightOverlay) break;
          const target = document.querySelector(id);
          if (target) {
            const rect = target.getBoundingClientRect();
            positionOverlay(s.highlightOverlay, rect);
            if (s.toggleBadge) {
              const name = getElementName(target);
              s.toggleBadge.innerHTML = chip(name, "#d1d5db", "#1f2937");
              s.toggleBadge.style.gap = "0";
              const badgeH = 22;
              const top = rect.top >= badgeH + 4 ? rect.top - badgeH - 2 : rect.bottom + 2;
              s.toggleBadge.style.left = `${rect.left}px`;
              s.toggleBadge.style.top = `${top}px`;
              s.toggleBadge.style.display = "flex";
            }
          }
          break;
        }
        case "tool:clearHighlight":
          if (s.highlightOverlay) s.highlightOverlay.style.display = "none";
          if (s.toggleBadge) s.toggleBadge.style.display = "none";
          break;
        case "tool:selectByTreeId": {
          const id = msg.id as string;
          if (!id) break;
          const target = document.querySelector(id);
          if (target) {
            const selectable = findSelectableElement(target);
            selectElement(selectable);
          }
          break;
        }
        case "tool:setOverlayState":
          updateOverlayState({
            tier: msg.tier,
            showToggle: msg.showToggle,
            activeMode: msg.activeMode,
            isDataDriven: msg.isDataDriven,
            inLoop: msg.inLoop ?? false,
            hasDynamicContent: msg.hasDynamicContent ?? false,
            dataOrigin: msg.dataOrigin,
            iteratorExpression: msg.iteratorExpression,
            packageName: msg.packageName,
          });
          break;
        case "tool:selectParentInstance": {
          if (!s.selectedElement) break;
          let el: Element | null = s.selectedElement.parentElement;
          while (el && el !== document.body) {
            if (el.getAttribute("data-instance-source")) {
              selectElement(el);
              break;
            }
            el = el.parentElement;
          }
          break;
        }
        case "tool:renderPreview": {
          const { componentPath, exportName, combinations: combos, defaultChildren: children } = msg;
          const currentRegistry = (window as any).__DESIGNTOOLS_REGISTRY__ as Record<string, () => Promise<any>> | undefined;

          if (!currentRegistry) {
            setPreviewRef.current.setPreviewError("No component registry available. Ensure designtools-registry.ts is imported.");
            setPreviewRef.current.setShowPreview(true);
            return;
          }

          const loader = currentRegistry[componentPath];
          if (!loader) {
            setPreviewRef.current.setPreviewError(
              `Component "${componentPath}" not found in registry. Available: ${Object.keys(currentRegistry).join(", ")}`
            );
            setPreviewRef.current.setShowPreview(true);
            return;
          }

          // Disable selection mode and hide overlays
          exitSelectionMode();
          hideSelectionOverlays();

          // Load the component
          loader().then((mod: any) => {
            const Comp = mod[exportName] || mod.default;
            if (!Comp) {
              setPreviewRef.current.setPreviewError(`Export "${exportName}" not found in ${componentPath}`);
              setPreviewRef.current.setShowPreview(true);
              return;
            }

            setPreviewRef.current.setPreviewError(null);
            setPreviewRef.current.setPreviewComponent(() => Comp);
            setPreviewRef.current.setPreviewCombinations(combos || []);
            setPreviewRef.current.setPreviewDefaultChildren(children || exportName);
            setPreviewRef.current.setShowPreview(true);

            // Notify editor that preview is ready
            window.parent.postMessage(
              { type: "tool:previewReady", cellCount: (combos || []).length },
              "*"
            );
          }).catch((err: any) => {
            setPreviewRef.current.setPreviewError(`Failed to load component: ${err.message}`);
            setPreviewRef.current.setShowPreview(true);
          });
          break;
        }
        case "tool:exitPreview": {
          setPreviewRef.current.setShowPreview(false);
          setPreviewRef.current.setPreviewComponent(null);
          setPreviewRef.current.setPreviewCombinations([]);
          setPreviewRef.current.setPreviewDefaultChildren("");
          setPreviewRef.current.setPreviewError(null);

          // Restore selection mode
          enterSelectionMode();
          break;
        }
      }
    }

    function notifyPathChanged() {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      window.parent.postMessage({ type: "tool:pathChanged", path: fullPath }, "*");
    }

    // --- Init ---
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    window.addEventListener("popstate", notifyPathChanged);

    // Notify editor that we're ready
    window.parent.postMessage({ type: "tool:injectedReady" }, "*");
    notifyPathChanged();

    // Send CSS custom properties for non-Tailwind projects (scale discovery)
    const cssProps = extractCssCustomProperties();
    if (cssProps.length > 0) {
      window.parent.postMessage({ type: "tool:cssCustomProperties", properties: cssProps }, "*");
    }

    // --- Cleanup ---
    return () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("popstate", notifyPathChanged);

      treeObserver.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (s.overlayRafId) cancelAnimationFrame(s.overlayRafId);
      s.tokenPreviewStyle?.remove();
      s.highlightOverlay?.remove();
      s.selectedOverlay?.remove();
      s.toggleBadge?.remove();
    };
  }, []);

  // --- Preview overlay rendered via portal ---
  if (!showPreview) return null;

  if (previewError) {
    return createPortal(
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "var(--background, white)",
        overflow: "auto",
        padding: 32,
      }}>
        <div style={{ color: "var(--destructive, #ef4444)", fontFamily: "monospace", fontSize: 14 }}>
          {previewError}
        </div>
      </div>,
      document.body
    );
  }

  if (!previewComponent) {
    return createPortal(
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "var(--background, white)",
        overflow: "auto",
        padding: 32,
      }}>
        <div style={{ color: "var(--muted-foreground, #888)", fontFamily: "inherit", fontSize: 14 }}>
          Loading component...
        </div>
      </div>,
      document.body
    );
  }

  const Component = previewComponent;

  return createPortal(
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 999999,
      background: "var(--background, white)",
      overflow: "auto",
      padding: 32,
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 24,
      }}>
        {previewCombinations.map((combo, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--muted-foreground, #888)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}>
              {combo.label}
            </div>
            <div style={{
              padding: 16,
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 64,
              background: "var(--card, var(--background, #fff))",
            }}>
              {createElement(Component, combo.props, previewDefaultChildren)}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
