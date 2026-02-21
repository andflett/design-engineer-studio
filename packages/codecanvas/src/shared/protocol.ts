/**
 * Shared postMessage protocol types for CodeCanvas.
 * Both server and client import from here.
 */

export interface SourceLocation {
  file: string;
  line: number;
  col: number;
}

export interface SelectedElementData {
  tag: string;
  source: SourceLocation | null;
  /** For component instances: the usage site in the page file (where <CardTitle> is written) */
  instanceSource: SourceLocation | null;
  /** For component instances: the component name (e.g. "CardTitle") */
  componentName: string | null;
  className: string;
  computed: Record<string, string>;
  parentComputed: Record<string, string>;
  boundingRect: DOMRect;
  textContent: string;
  attributes: Record<string, string>;
}

export interface StyleChange {
  property: string;
  value: string;
  hint?: {
    tailwindClass?: string;
  };
}

// Messages from target app iframe -> editor
export type IframeToEditor =
  | { type: "tool:injectedReady" }
  | { type: "tool:elementSelected"; data: SelectedElementData }
  | { type: "tool:pathChanged"; path: string };

// Messages from editor -> target app iframe
export type EditorToIframe =
  | { type: "tool:enterSelectionMode" }
  | { type: "tool:exitSelectionMode" }
  | { type: "tool:previewInlineStyle"; property: string; value: string }
  | { type: "tool:revertInlineStyles" }
  | { type: "tool:reselectElement" }
  | { type: "tool:setTheme"; theme: "light" | "dark" };
