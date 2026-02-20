let selectionMode = false;
let highlightOverlay = null;
let tooltip = null;
let selectedOverlay = null;
let hoveredElement = null;
let selectedElement = null;
let selectedDomPath = null;
let overlayRafId = null;
const previewBackups = /* @__PURE__ */ new Map();
const inlineStyleBackups = /* @__PURE__ */ new Map();
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
    transition: "all 0.1s ease"
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
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
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
    display: "none"
  });
  document.body.appendChild(selectedOverlay);
}
function getElementName(el) {
  const slot = el.getAttribute("data-slot");
  if (slot) {
    return slot.charAt(0).toUpperCase() + slot.slice(1);
  }
  return `<${el.tagName.toLowerCase()}>`;
}
function getDomPath(el) {
  const parts = [];
  let current = el;
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
function extractElementData(el) {
  const computed = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const relevantProps = [
    // Layout
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "overflow",
    "overflow-x",
    "overflow-y",
    // Flexbox / Grid
    "flex-direction",
    "flex-wrap",
    "justify-content",
    "align-items",
    "align-self",
    "flex-grow",
    "flex-shrink",
    "flex-basis",
    "order",
    "grid-template-columns",
    "grid-template-rows",
    "gap",
    "row-gap",
    "column-gap",
    // Size
    "width",
    "height",
    "min-width",
    "min-height",
    "max-width",
    "max-height",
    // Spacing
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    // Typography
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-decoration",
    "text-transform",
    "color",
    "white-space",
    // Background
    "background-color",
    "background-image",
    "background-size",
    "background-position",
    // Border
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-style",
    "border-color",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    // Effects
    "opacity",
    "box-shadow",
    "transform",
    "transition"
  ];
  const computedStyles = {};
  for (const prop of relevantProps) {
    computedStyles[prop] = computed.getPropertyValue(prop);
  }
  const inheritableProps = [
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-align",
    "text-transform",
    "white-space"
  ];
  const parentComputedStyles = {};
  const parentEl = el.parentElement;
  if (parentEl) {
    const parentComputed = getComputedStyle(parentEl);
    for (const prop of inheritableProps) {
      parentComputedStyles[prop] = parentComputed.getPropertyValue(prop);
    }
  }
  const attributes = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("data-")) {
      attributes[attr.name] = attr.value;
    }
  }
  let sourceFile = null;
  let sourceLine = null;
  let sourceCol = null;
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
  return {
    tag: el.tagName.toLowerCase(),
    className: (el.getAttribute("class") || "").trim(),
    dataSlot: el.getAttribute("data-slot"),
    dataVariant: el.getAttribute("data-variant"),
    dataSize: el.getAttribute("data-size"),
    computedStyles,
    parentComputedStyles,
    boundingRect: rect,
    domPath: getDomPath(el),
    textContent: (el.textContent || "").trim().slice(0, 100),
    attributes,
    sourceFile,
    sourceLine,
    sourceCol
  };
}
function positionOverlay(overlay, rect) {
  Object.assign(overlay.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: "block"
  });
}
function findSelectableElement(target) {
  let el = target;
  while (el && el !== document.body) {
    if (el.getAttribute("data-slot")) return el;
    el = el.parentElement;
  }
  return target;
}
function onMouseMove(e) {
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
function onClick(e) {
  if (!selectionMode) return;
  e.preventDefault();
  e.stopPropagation();
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el === highlightOverlay || el === tooltip || el === selectedOverlay) return;
  const selectable = findSelectableElement(el);
  selectElement(selectable);
}
function selectElement(el) {
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
function onMessage(e) {
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
    case "tool:previewShadow": {
      let previewStyle = document.getElementById("tool-shadow-preview");
      if (!previewStyle) {
        previewStyle = document.createElement("style");
        previewStyle.id = "tool-shadow-preview";
        document.head.appendChild(previewStyle);
      }
      const cls = msg.className;
      const val = msg.value;
      if (val === "none" || val === "0 0 #0000") {
        previewStyle.textContent = `.${CSS.escape(cls)} { --tw-shadow: 0 0 #0000 !important; box-shadow: none !important; }`;
      } else {
        previewStyle.textContent = `.${CSS.escape(cls)} { --tw-shadow: ${val} !important; }`;
      }
      break;
    }
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
    case "tool:previewInlineStyle": {
      if (selectedElement && selectedElement instanceof HTMLElement) {
        const prop = msg.property;
        const value = msg.value;
        if (!inlineStyleBackups.has(prop)) {
          inlineStyleBackups.set(prop, selectedElement.style.getPropertyValue(prop));
        }
        selectedElement.style.setProperty(prop, value, "important");
      }
      break;
    }
    case "tool:revertInlineStyles": {
      if (selectedElement && selectedElement instanceof HTMLElement) {
        for (const [prop, original] of inlineStyleBackups) {
          if (original) {
            selectedElement.style.setProperty(prop, original);
          } else {
            selectedElement.style.removeProperty(prop);
          }
        }
        inlineStyleBackups.clear();
      }
      break;
    }
    case "tool:setTheme":
      if (msg.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      break;
  }
}
function notifyPathChanged() {
  const fullPath = window.location.pathname + window.location.search + window.location.hash;
  const appPath = fullPath.startsWith("/proxy") ? fullPath.slice(6) || "/" : fullPath;
  window.parent.postMessage({ type: "tool:pathChanged", path: appPath }, "*");
}
function interceptNavigation() {
  document.addEventListener("click", (e) => {
    if (selectionMode) return;
    const anchor = e.target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("/proxy/")) {
      return;
    }
    if (href.startsWith("/")) {
      e.preventDefault();
      window.location.href = `/proxy${href}`;
    }
  }, false);
  window.addEventListener("popstate", () => notifyPathChanged());
  notifyPathChanged();
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
