/**
 * <Surface /> — Selection overlay component for the target app.
 * Mounted automatically by designtools() Vite plugin in development.
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
    tooltip: null as HTMLDivElement | null,
    selectedOverlay: null as HTMLDivElement | null,
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

    s.tooltip = document.createElement("div");
    s.tooltip.id = "tool-tooltip";
    Object.assign(s.tooltip.style, {
      position: "fixed",
      pointerEvents: "none",
      backgroundColor: "#1e1e2e",
      color: "#cdd6f4",
      padding: "3px 8px",
      borderRadius: "4px",
      fontSize: "11px",
      fontFamily: "ui-monospace, monospace",
      zIndex: "100000",
      display: "none",
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    });
    document.body.appendChild(s.tooltip);

    s.selectedOverlay = document.createElement("div");
    s.selectedOverlay.id = "tool-selected";
    Object.assign(s.selectedOverlay.style, {
      position: "fixed",
      pointerEvents: "none",
      border: "2px solid #f59e0b",
      backgroundColor: "rgba(245, 158, 11, 0.06)",
      borderRadius: "2px",
      zIndex: "99998",
      display: "none",
    });
    document.body.appendChild(s.selectedOverlay);

    // --- Helpers ---
    function getElementName(el: Element): string {
      const slot = el.getAttribute("data-slot");
      if (slot) return slot.charAt(0).toUpperCase() + slot.slice(1);
      return `<${el.tagName.toLowerCase()}>`;
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
      let el: Element | null = target;
      while (el && el !== document.body) {
        if (el.getAttribute("data-slot")) return el;
        el = el.parentElement;
      }
      return target;
    }

    // --- Component tree extraction (React Fiber) ---

    // IDs of overlay elements to skip during tree building
    const overlayIds = new Set(["tool-highlight", "tool-tooltip", "tool-selected", "surface-token-preview"]);

    // Semantic HTML elements shown as structural landmarks
    const semanticTags = new Set(["header", "main", "nav", "section", "article", "footer", "aside"]);

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
      const fiber = getFiber(rootEl);
      if (!fiber) {
        // Fallback: data-slot-only tree via DOM walk
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

      // Show semantic HTML landmarks — always show these as structural markers
      if (semanticTags.has(tag)) {
        const children: TreeNode[] = [];
        if (fiber.child) walkFiber(fiber.child, children, scope);
        const text = el ? getDirectText(el) : "";
        return {
          id: el ? getDomPath(el) : "",
          name: `<${tag}>`,
          type: "element",
          dataSlot: null,
          source: el?.getAttribute("data-source") || null,
          scope,
          textContent: text,
          children,
        };
      }

      // Show authored elements — data-source is added by our Babel transform
      // to every JSX element, so its presence proves this was deliberately
      // written in user code. Skip document/void tags that aren't meaningful.
      // In "components" mode, skip generic elements to reduce noise (only
      // data-slot components and semantic landmarks show). In "dom" mode,
      // show all authored elements.
      if (currentTreeMode === "dom" && el?.hasAttribute("data-source") && !skipTags.has(tag)) {
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
      } else if (semanticTags.has(tag)) {
        const children: TreeNode[] = [];
        for (const child of Array.from(el.children)) {
          walkDomForSlots(child, children, scope);
        }
        if (children.length > 0 || getDirectText(el)) {
          siblings.push({
            id: getDomPath(el),
            name: `<${tag}>`,
            type: "element",
            dataSlot: null,
            source: el.getAttribute("data-source") || null,
            scope,
            textContent: getDirectText(el),
            children,
          });
        }
      } else {
        // Skip this element, but walk its children
        for (const child of Array.from(el.children)) {
          walkDomForSlots(child, siblings, scope);
        }
      }
    }

    // Current tree mode — stored so MutationObserver re-sends use the same mode
    let currentTreeMode: "components" | "dom" = "components";

    function sendComponentTree(mode?: "components" | "dom") {
      if (mode) currentTreeMode = mode;
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
      if (s.tooltip) s.tooltip.style.display = "none";
      if (s.selectedOverlay) s.selectedOverlay.style.display = "none";
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
      if (s.tooltip) s.tooltip.style.display = "none";
      s.hoveredElement = null;
    }

    function clearSelection() {
      s.selectedElement = null;
      s.selectedDomPath = null;
      if (s.selectedOverlay) s.selectedOverlay.style.display = "none";
      if (s.overlayRafId) {
        cancelAnimationFrame(s.overlayRafId);
        s.overlayRafId = null;
      }
    }

    // --- Event handlers ---
    function onMouseMove(e: MouseEvent) {
      if (!s.selectionMode || !s.highlightOverlay || !s.tooltip) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === s.highlightOverlay || el === s.tooltip || el === s.selectedOverlay) return;
      const selectable = findSelectableElement(el);
      if (selectable === s.hoveredElement) return;
      s.hoveredElement = selectable;
      const rect = selectable.getBoundingClientRect();
      positionOverlay(s.highlightOverlay, rect);
      const name = getElementName(selectable);
      s.tooltip.textContent = name;
      s.tooltip.style.display = "block";
      s.tooltip.style.left = `${rect.left}px`;
      s.tooltip.style.top = `${Math.max(0, rect.top - 24)}px`;
    }

    function onMouseLeave() {
      if (!s.highlightOverlay || !s.tooltip) return;
      s.highlightOverlay.style.display = "none";
      s.tooltip.style.display = "none";
      s.hoveredElement = null;
    }

    function onClick(e: MouseEvent) {
      if (!s.selectionMode) return;
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === s.highlightOverlay || el === s.tooltip || el === s.selectedOverlay) return;
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
          sendComponentTree((msg as any).mode || "components");
          break;
        case "tool:highlightByTreeId": {
          const id = msg.id as string;
          if (!id || !s.highlightOverlay || !s.tooltip) break;
          const target = document.querySelector(id);
          if (target) {
            const rect = target.getBoundingClientRect();
            positionOverlay(s.highlightOverlay, rect);
            const name = getElementName(target);
            s.tooltip.textContent = name;
            s.tooltip.style.display = "block";
            s.tooltip.style.left = `${rect.left}px`;
            s.tooltip.style.top = `${Math.max(0, rect.top - 24)}px`;
          }
          break;
        }
        case "tool:clearHighlight":
          if (s.highlightOverlay) s.highlightOverlay.style.display = "none";
          if (s.tooltip) s.tooltip.style.display = "none";
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
      s.tooltip?.remove();
      s.selectedOverlay?.remove();
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
