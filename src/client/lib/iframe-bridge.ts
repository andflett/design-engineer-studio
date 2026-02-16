/**
 * Typed postMessage protocol between studio chrome and iframe.
 */

// Messages from studio → iframe
export type StudioToIframe =
  | { type: "studio:enterSelectionMode" }
  | { type: "studio:exitSelectionMode" }
  | { type: "studio:setProperty"; token: string; value: string }
  | { type: "studio:previewClass"; elementPath: string; oldClass: string; newClass: string }
  | { type: "studio:revertPreview" }
  | { type: "studio:reselectElement" }
  | { type: "studio:setTheme"; theme: "light" | "dark" };

// Messages from iframe → studio
export type IframeToStudio =
  | { type: "studio:injectedReady" }
  | { type: "studio:elementSelected"; data: ElementData };

export interface ElementData {
  tag: string;
  className: string;
  dataSlot: string | null;
  dataVariant: string | null;
  dataSize: string | null;
  computedStyles: Record<string, string>;
  boundingRect: DOMRect;
  domPath: string;
  textContent: string;
  attributes: Record<string, string>;
}

export function sendToIframe(
  iframe: HTMLIFrameElement,
  message: StudioToIframe
) {
  iframe.contentWindow?.postMessage(message, "*");
}

export function onIframeMessage(
  callback: (msg: IframeToStudio) => void
): () => void {
  const handler = (e: MessageEvent) => {
    const data = e.data;
    if (data?.type?.startsWith("studio:")) {
      callback(data as IframeToStudio);
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
