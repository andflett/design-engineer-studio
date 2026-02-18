/**
 * Injection script for element selection overlay.
 * Injected into the target app's iframe to enable element selection.
 * Uses "tool:" namespace for postMessage protocol.
 */

let selectionMode = false;
let highlightOverlay: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;
let selectedOverlay: HTMLDivElement | null = null;
let hoveredElement: Element | null = null;
let selectedElement: Element | null = null;
let selectedDomPath: string | null = null;
let overlayRafId: number | null = null;
const previewBackups = new Map<Element, string>();

function createOverlays() {
  highlightOverlay = document.createElement("div");
  highlightOverlay.id = "tool-highlight";
  Object.assign(highlightOverlay.style, {
    position: "fixed",
    pointerEvents: "none",
    border: "2px solid #3b82f6",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderRadius: "2px",
    zIndex: "99999",
    display: "none",
    transition: "all 0.1s ease",
  });
  document.body.appendChild(highlightOverlay);

  tooltip = document.createElement("div");
  tooltip.id = "tool-tooltip";
  Object.assign(tooltip.style, {
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
  document.body.appendChild(tooltip);

  selectedOverlay = document.createElement("div");
  selectedOverlay.id = "tool-selected";
  Object.assign(selectedOverlay.style, {
    position: "fixed",
    pointerEvents: "none",
    border: "2px solid #f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.06)",
    borderRadius: "2px",
    zIndex: "99998",
    display: "none",
  });
  document.body.appendChild(selectedOverlay);
}

function getElementName(el: Element): string {
  const slot = el.getAttribute("data-slot");
  if (slot) {
    return slot.charAt(0).toUpperCase() + slot.slice(1);
  }
  return `<${el.tagName.toLowerCase()}>`;
}

function getDomPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    const slot = current.getAttribute("data-slot");
    if (slot) {
      selector = `[data-slot="${slot}"]`;
    } else if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === "string") {
      const cls = current.className.split(" ")[0];
      if (cls) selector += `.${cls}`;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function extractElementData(el: Element) {
  const computed = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const relevantProps = [
    "color", "backgroundColor", "borderColor", "borderRadius",
    "padding", "margin", "gap", "fontSize", "fontWeight",
    "lineHeight", "letterSpacing", "display", "flexDirection",
    "alignItems", "justifyContent", "width", "height",
    "boxShadow",
  ];
  const computedStyles: Record<string, string> = {};
  for (const prop of relevantProps) {
    computedStyles[prop] = computed.getPropertyValue(
      prop.replace(/([A-Z])/g, "-$1").toLowerCase()
    );
  }
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("data-")) {
      attributes[attr.name] = attr.value;
    }
  }
  return {
    tag: el.tagName.toLowerCase(),
    className: (el.getAttribute("class") || "").trim(),
    dataSlot: el.getAttribute("data-slot"),
    dataVariant: el.getAttribute("data-variant"),
    dataSize: el.getAttribute("data-size"),
    computedStyles,
    boundingRect: rect,
    domPath: getDomPath(el),
    textContent: (el.textContent || "").trim().slice(0, 100),
    attributes,
  };
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

function onMouseMove(e: MouseEvent) {
  if (!selectionMode || !highlightOverlay || !tooltip) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el === highlightOverlay || el === tooltip || el === selectedOverlay) return;
  const selectable = findSelectableElement(el);
  if (selectable === hoveredElement) return;
  hoveredElement = selectable;
  const rect = selectable.getBoundingClientRect();
  positionOverlay(highlightOverlay, rect);
  const name = getElementName(selectable);
  tooltip.textContent = name;
  tooltip.style.display = "block";
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.top = `${Math.max(0, rect.top - 24)}px`;
}

function onMouseLeave() {
  if (!highlightOverlay || !tooltip) return;
  highlightOverlay.style.display = "none";
  tooltip.style.display = "none";
  hoveredElement = null;
}

function onClick(e: MouseEvent) {
  if (!selectionMode) return;
  e.preventDefault();
  e.stopPropagation();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el === highlightOverlay || el === tooltip || el === selectedOverlay) return;
  const selectable = findSelectableElement(el);
  selectElement(selectable);
}

function selectElement(el: Element) {
  selectedElement = el;
  selectedDomPath = getDomPath(el);
  const data = extractElementData(el);
  if (selectedOverlay) {
    positionOverlay(selectedOverlay, data.boundingRect);
  }
  startOverlayTracking();
  window.parent.postMessage(
    { type: "tool:elementSelected", data },
    "*"
  );
}

function reselectCurrentElement() {
  if (!selectedDomPath) return;
  const el = document.querySelector(selectedDomPath);
  if (el) {
    selectedElement = el;
    const data = extractElementData(el);
    if (selectedOverlay) {
      positionOverlay(selectedOverlay, data.boundingRect);
    }
    window.parent.postMessage(
      { type: "tool:elementSelected", data },
      "*"
    );
  }
}

function startOverlayTracking() {
  if (overlayRafId) cancelAnimationFrame(overlayRafId);
  let lastRect = "";
  function tick() {
    if (selectedElement && selectedOverlay) {
      if (!document.contains(selectedElement)) {
        if (selectedDomPath) {
          const newEl = document.querySelector(selectedDomPath);
          if (newEl) {
            selectedElement = newEl;
            reselectCurrentElement();
          }
        }
      }
      if (selectedElement && document.contains(selectedElement)) {
        const rect = selectedElement.getBoundingClientRect();
        const key = `${rect.left},${rect.top},${rect.width},${rect.height}`;
        if (key !== lastRect) {
          lastRect = key;
          positionOverlay(selectedOverlay, rect);
        }
      }
    }
    overlayRafId = requestAnimationFrame(tick);
  }
  tick();
}

function onMessage(e: MessageEvent) {
  const msg = e.data;
  if (!msg || !msg.type || !msg.type.startsWith("tool:")) return;

  switch (msg.type) {
    case "tool:enterSelectionMode":
      selectionMode = true;
      document.body.style.cursor = "crosshair";
      break;
    case "tool:exitSelectionMode":
      selectionMode = false;
      document.body.style.cursor = "";
      if (highlightOverlay) highlightOverlay.style.display = "none";
      if (tooltip) tooltip.style.display = "none";
      hoveredElement = null;
      break;
    case "tool:setProperty":
      document.documentElement.style.setProperty(msg.token, msg.value);
      break;
    case "tool:previewClass": {
      const target = document.querySelector(msg.elementPath);
      if (target) {
        if (!previewBackups.has(target)) {
          previewBackups.set(target, target.getAttribute("class") || "");
        }
        const currentClass = target.getAttribute("class") || "";
        target.setAttribute(
          "class",
          currentClass.replace(msg.oldClass, msg.newClass)
        );
      }
      break;
    }
    case "tool:revertPreview":
      for (const [el, backup] of previewBackups) {
        el.setAttribute("class", backup);
      }
      previewBackups.clear();
      break;
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
  }
}

function interceptNavigation() {
  // Rewrite links that would navigate outside /proxy/ back through it.
  // The <base href="/proxy/"> tag handles most relative URLs, but
  // absolute same-origin links (href="/about") can bypass it in some frameworks.
  document.addEventListener("click", (e: MouseEvent) => {
    // Don't interfere with selection mode clicks (handled by onClick above)
    if (selectionMode) return;

    const anchor = (e.target as Element).closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    // Skip external links, anchors, javascript:, and already-proxied links
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("/proxy/")
    ) {
      return;
    }

    // Rewrite absolute paths like "/about" → "/proxy/about"
    if (href.startsWith("/")) {
      e.preventDefault();
      window.location.href = `/proxy${href}`;
    }
  }, false);
}

function init() {
  createOverlays();
  interceptNavigation();
  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("mouseleave", onMouseLeave);
  document.addEventListener("click", onClick, true);
  window.addEventListener("message", onMessage);
  window.parent.postMessage({ type: "tool:injectedReady" }, "*");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
