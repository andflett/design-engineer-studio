/**
 * Typed postMessage bridge for CodeCanvas.
 * Handles communication between editor and target app iframe.
 */

import type {
  EditorToIframe,
  IframeToEditor,
  SelectedElementData,
} from "../../shared/protocol.js";

/** ElementData format from the inject script (flat fields) */
interface RawElementData {
  tag: string;
  className: string;
  computedStyles: Record<string, string>;
  parentComputedStyles: Record<string, string>;
  boundingRect: DOMRect;
  textContent: string;
  attributes: Record<string, string>;
  sourceFile: string | null;
  sourceLine: number | null;
  sourceCol: number | null;
  instanceSourceFile?: string | null;
  instanceSourceLine?: number | null;
  instanceSourceCol?: number | null;
  componentName?: string | null;
}

/** Normalize raw ElementData into SelectedElementData */
function normalizeElementData(data: RawElementData | SelectedElementData): SelectedElementData {
  // Already in new format
  if ("source" in data) return data as SelectedElementData;

  const raw = data as RawElementData;
  return {
    tag: raw.tag,
    className: raw.className,
    computed: raw.computedStyles,
    parentComputed: raw.parentComputedStyles,
    boundingRect: raw.boundingRect,
    textContent: raw.textContent,
    attributes: raw.attributes,
    source:
      raw.sourceFile != null
        ? { file: raw.sourceFile, line: raw.sourceLine!, col: raw.sourceCol! }
        : null,
    instanceSource:
      raw.instanceSourceFile != null
        ? { file: raw.instanceSourceFile, line: raw.instanceSourceLine!, col: raw.instanceSourceCol! }
        : null,
    componentName: raw.componentName || null,
  };
}

export function sendToIframe(
  iframe: HTMLIFrameElement,
  message: EditorToIframe
): void {
  iframe.contentWindow?.postMessage(message, "*");
}

export function onIframeMessage(
  callback: (msg: IframeToEditor) => void
): () => void {
  const handler = (e: MessageEvent) => {
    const data = e.data;
    if (!data?.type?.startsWith("tool:")) return;

    // Normalize elementSelected data
    if (data.type === "tool:elementSelected" && data.data) {
      callback({
        type: "tool:elementSelected",
        data: normalizeElementData(data.data),
      });
      return;
    }

    callback(data as IframeToEditor);
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
