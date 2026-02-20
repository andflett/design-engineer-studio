/**
 * Typed postMessage protocol between tool chrome and iframe.
 * Tools extend these base types with their own messages.
 */

// Base messages all tools support
export type BaseToolToIframe =
  | { type: "tool:enterSelectionMode" }
  | { type: "tool:exitSelectionMode" }
  | { type: "tool:setProperty"; token: string; value: string }
  | { type: "tool:previewShadow"; className: string; value: string }
  | { type: "tool:previewClass"; elementPath: string; oldClass: string; newClass: string }
  | { type: "tool:revertPreview" }
  | { type: "tool:reselectElement" }
  | { type: "tool:setTheme"; theme: "light" | "dark" }
  | { type: "tool:previewInlineStyle"; property: string; value: string }
  | { type: "tool:revertInlineStyles" };

export type BaseIframeToTool =
  | { type: "tool:injectedReady" }
  | { type: "tool:elementSelected"; data: ElementData }
  | { type: "tool:pathChanged"; path: string };

export interface ElementData {
  tag: string;
  className: string;
  dataSlot: string | null;
  dataVariant: string | null;
  dataSize: string | null;
  computedStyles: Record<string, string>;
  parentComputedStyles: Record<string, string>;
  boundingRect: DOMRect;
  domPath: string;
  textContent: string;
  attributes: Record<string, string>;
}

export function sendToIframe(
  iframe: HTMLIFrameElement,
  message: BaseToolToIframe
) {
  iframe.contentWindow?.postMessage(message, "*");
}

export function onIframeMessage(
  callback: (msg: BaseIframeToTool) => void
): () => void {
  const handler = (e: MessageEvent) => {
    const data = e.data;
    if (data?.type?.startsWith("tool:")) {
      callback(data as BaseIframeToTool);
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
