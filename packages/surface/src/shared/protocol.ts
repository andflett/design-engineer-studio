/**
 * Shared postMessage protocol types for Surface.
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
  /** Package name if element originates from node_modules (e.g. "@radix-ui/react-dialog") */
  packageName: string | null;
  /** Stable CSS selector path (nth-child based) — matches ComponentTreeNode.id */
  domPath: string | null;
  className: string;
  computed: Record<string, string>;
  parentComputed: Record<string, string>;
  boundingRect: DOMRect;
  textContent: string;
  attributes: Record<string, string>;
  /** Runtime props read from React fiber's memoizedProps (string/number/boolean only) */
  fiberProps: Record<string, string | number | boolean> | null;
  /** Authored CSS values from stylesheets (may contain CSS functions like clamp(), var()) */
  authored: Record<string, string | null>;
  /** Currently active responsive breakpoint (e.g. "md", "lg") or null for base */
  activeBreakpoint: string | null;
}

export interface ComponentTreeNode {
  /** Stable CSS selector path for selection/highlight */
  id: string;
  /** Display name: "Button", "HeroSection", "<header>" */
  name: string;
  /** Named component vs semantic HTML landmark */
  type: "component" | "element";
  /** data-slot value if present — marks design system components */
  dataSlot: string | null;
  /** data-source file:line:col if available */
  source: string | null;
  /** Routing scope — layout (persistent shell) vs page (route-specific content) */
  scope: "layout" | "page" | null;
  /** First ~40 chars of direct text content */
  textContent: string;
  /** Nested children */
  children: ComponentTreeNode[];
}

/** A single variant combination for the isolation preview grid. */
export interface PreviewCombination {
  label: string; // e.g. "variant: destructive"
  props: Record<string, string>; // e.g. { variant: "destructive", size: "default" }
}

export interface StyleChange {
  property: string;
  value: string;
  hint?: {
    tailwindClass?: string;
  };
}

/** A single visual edit accumulated in AI write mode before sending to Claude. */
export interface ChangeIntent {
  type: "class" | "style" | "prop" | "token";
  /** CSS property name, Tailwind class category, prop name, or CSS token variable */
  property: string;
  /** Current value before the edit */
  fromValue: string;
  /** Desired new value */
  toValue: string;
  /** Required for class/style/prop types; omitted for token type */
  elementSource?: SourceLocation;
  currentClassName: string;
  /** CSS file path — used for token type */
  cssFilePath?: string;
}

export type WriteMode = "deterministic" | "ai";
export type AiModel = "sonnet" | "opus";
export type ElementMode = "component" | "instance";

// Messages from target app iframe -> editor
export type IframeToEditor =
  | { type: "tool:injectedReady" }
  | { type: "tool:elementSelected"; data: SelectedElementData }
  | { type: "tool:pathChanged"; path: string }
  | { type: "tool:componentTree"; tree: ComponentTreeNode[] }
  | { type: "tool:previewReady"; cellCount: number }
  | { type: "tool:cssCustomProperties"; properties: { name: string; value: string }[] }
  /** User clicked the component/instance toggle badge on the canvas overlay */
  | { type: "tool:editModeToggled"; mode: "component" | "instance" };

export type OverlayTier = "full" | "instance-only" | "inspect-only";

// Messages from editor -> target app iframe
export type EditorToIframe =
  | { type: "tool:enterSelectionMode" }
  | { type: "tool:exitSelectionMode" }
  | { type: "tool:clearSelection" }
  | { type: "tool:previewInlineStyle"; property: string; value: string }
  | { type: "tool:previewTokenValue"; property: string; value: string }
  | { type: "tool:revertTokenValues" }
  | { type: "tool:revertInlineStyles" }
  | { type: "tool:reselectElement" }
  | { type: "tool:setTheme"; theme: "light" | "dark" }
  | { type: "tool:requestComponentTree" }
  | { type: "tool:highlightByTreeId"; id: string }
  | { type: "tool:clearHighlight" }
  | { type: "tool:selectByTreeId"; id: string }
  | { type: "tool:selectParentInstance" }
  | { type: "tool:renderPreview"; dataSlot: string; componentPath: string; exportName: string;
      combinations: PreviewCombination[]; defaultChildren: string }
  | { type: "tool:exitPreview" }
  /** Update the canvas overlay colour, badge and toggle state */
  | { type: "tool:setOverlayState";
      tier: OverlayTier;
      showToggle: boolean;
      activeMode: "component" | "instance" | null;
      isDataDriven: boolean;
      /** Element is rendered in a .map()/.flatMap()/.filter() loop */
      inLoop: boolean;
      /** Element's text/child content contains non-literal expressions */
      hasDynamicContent: boolean;
      /** Where loop data originates — only present when inLoop is true */
      dataOrigin?: "local" | "external";
      /** Truncated iterator expression, e.g. "recentItems.map(…)" */
      iteratorExpression?: string;
      packageName?: string;
    };
