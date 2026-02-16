"use strict";
(() => {
  // src/inject/selection.ts
  var selectionMode = false;
  var highlightOverlay = null;
  var tooltip = null;
  var selectedOverlay = null;
  var hoveredElement = null;
  var selectedElement = null;
  var selectedDomPath = null;
  var overlayRafId = null;
  var previewBackups = /* @__PURE__ */ new Map();
  function createOverlays() {
    highlightOverlay = document.createElement("div");
    highlightOverlay.id = "studio-highlight";
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
    tooltip.id = "studio-tooltip";
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
    selectedOverlay.id = "studio-selected";
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
      "color",
      "backgroundColor",
      "borderColor",
      "borderRadius",
      "padding",
      "margin",
      "gap",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "display",
      "flexDirection",
      "alignItems",
      "justifyContent",
      "width",
      "height"
    ];
    const computedStyles = {};
    for (const prop of relevantProps) {
      computedStyles[prop] = computed.getPropertyValue(
        prop.replace(/([A-Z])/g, "-$1").toLowerCase()
      );
    }
    const attributes = {};
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
      attributes
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
      { type: "studio:elementSelected", data },
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
        { type: "studio:elementSelected", data },
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
    if (!msg || !msg.type || !msg.type.startsWith("studio:")) return;
    switch (msg.type) {
      case "studio:enterSelectionMode":
        selectionMode = true;
        document.body.style.cursor = "crosshair";
        break;
      case "studio:exitSelectionMode":
        selectionMode = false;
        document.body.style.cursor = "";
        if (highlightOverlay) highlightOverlay.style.display = "none";
        if (tooltip) tooltip.style.display = "none";
        hoveredElement = null;
        break;
      case "studio:setProperty":
        document.documentElement.style.setProperty(msg.token, msg.value);
        break;
      case "studio:previewClass": {
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
      case "studio:revertPreview":
        for (const [el, backup] of previewBackups) {
          el.setAttribute("class", backup);
        }
        previewBackups.clear();
        break;
      case "studio:reselectElement":
        reselectCurrentElement();
        break;
      case "studio:setTheme":
        if (msg.theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        break;
    }
  }
  function init() {
    createOverlays();
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "studio:injectedReady" }, "*");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
