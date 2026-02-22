"use strict";
"use client";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/codecanvas.tsx
var codecanvas_exports = {};
__export(codecanvas_exports, {
  CodeCanvas: () => CodeCanvas
});
module.exports = __toCommonJS(codecanvas_exports);
var import_react = require("react");
function CodeCanvas() {
  const stateRef = (0, import_react.useRef)({
    selectionMode: false,
    hoveredElement: null,
    selectedElement: null,
    selectedDomPath: null,
    overlayRafId: null,
    inlineStyleBackups: /* @__PURE__ */ new Map(),
    highlightOverlay: null,
    tooltip: null,
    selectedOverlay: null
  });
  (0, import_react.useEffect)(() => {
    const s = stateRef.current;
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
      transition: "all 0.1s ease"
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
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
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
      display: "none"
    });
    document.body.appendChild(s.selectedOverlay);
    function getElementName(el) {
      const slot = el.getAttribute("data-slot");
      if (slot) return slot.charAt(0).toUpperCase() + slot.slice(1);
      return `<${el.tagName.toLowerCase()}>`;
    }
    function getDomPath(el) {
      const parts = [];
      let current = el;
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
    const relevantProps = [
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
      "width",
      "height",
      "min-width",
      "min-height",
      "max-width",
      "max-height",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
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
      "background-color",
      "background-image",
      "background-size",
      "background-position",
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
      "opacity",
      "box-shadow",
      "transform",
      "transition"
    ];
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
    function extractElementData(el) {
      const computed = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const computedStyles = {};
      for (const prop of relevantProps) {
        computedStyles[prop] = computed.getPropertyValue(prop);
      }
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
      let instanceSourceFile = null;
      let instanceSourceLine = null;
      let instanceSourceCol = null;
      let componentName = null;
      if (el.getAttribute("data-slot") && sourceFile) {
        let ancestor = el.parentElement;
        while (ancestor && ancestor !== document.body) {
          const ancestorSource = ancestor.getAttribute("data-source");
          if (ancestorSource) {
            const lc = ancestorSource.lastIndexOf(":");
            const slc = ancestorSource.lastIndexOf(":", lc - 1);
            if (slc > 0) {
              const ancestorFile = ancestorSource.slice(0, slc);
              if (ancestorFile !== sourceFile && !ancestor.getAttribute("data-slot")) {
                instanceSourceFile = ancestorFile;
                instanceSourceLine = parseInt(ancestorSource.slice(slc + 1, lc), 10);
                instanceSourceCol = parseInt(ancestorSource.slice(lc + 1), 10);
                break;
              }
            }
          }
          ancestor = ancestor.parentElement;
        }
        const slot = el.getAttribute("data-slot") || "";
        componentName = slot.split("-").map((s2) => s2.charAt(0).toUpperCase() + s2.slice(1)).join("");
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
        componentName
      };
    }
    function selectElement(el) {
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
              positionOverlay(s.selectedOverlay, rect);
            }
          }
        }
        s.overlayRafId = requestAnimationFrame(tick);
      }
      tick();
    }
    function onMouseMove(e) {
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
    function onClick(e) {
      if (!s.selectionMode) return;
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === s.highlightOverlay || el === s.tooltip || el === s.selectedOverlay) return;
      const selectable = findSelectableElement(el);
      selectElement(selectable);
    }
    function onMessage(e) {
      const msg = e.data;
      if (!msg || !msg.type || !msg.type.startsWith("tool:")) return;
      switch (msg.type) {
        case "tool:enterSelectionMode":
          s.selectionMode = true;
          document.body.style.cursor = "crosshair";
          break;
        case "tool:exitSelectionMode":
          s.selectionMode = false;
          document.body.style.cursor = "";
          if (s.highlightOverlay) s.highlightOverlay.style.display = "none";
          if (s.tooltip) s.tooltip.style.display = "none";
          s.hoveredElement = null;
          break;
        case "tool:previewInlineStyle": {
          if (s.selectedElement && s.selectedElement instanceof HTMLElement) {
            const prop = msg.property;
            const value = msg.value;
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
    function notifyPathChanged() {
      const fullPath = window.location.pathname + window.location.search + window.location.hash;
      window.parent.postMessage({ type: "tool:pathChanged", path: fullPath }, "*");
    }
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    window.addEventListener("popstate", notifyPathChanged);
    window.parent.postMessage({ type: "tool:injectedReady" }, "*");
    notifyPathChanged();
    return () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("popstate", notifyPathChanged);
      if (s.overlayRafId) cancelAnimationFrame(s.overlayRafId);
      s.highlightOverlay?.remove();
      s.tooltip?.remove();
      s.selectedOverlay?.remove();
    };
  }, []);
  return null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CodeCanvas
});
