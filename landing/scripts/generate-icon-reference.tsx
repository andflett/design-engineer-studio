/**
 * Generates static outputs for the icon reference page:
 *   1. public/icon-reference.md — markdown for LLMs to fetch directly
 *   2. Prerenders icon-reference.html with full content in the markup
 *
 * Run: npx tsx scripts/generate-icon-reference.tsx
 */
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Radix UI Icons ──────────────────────────────────────────────────────────
import {
  WidthIcon,
  HeightIcon,
  PaddingIcon,
  MarginIcon,
  FontFamilyIcon,
  FontSizeIcon,
  FontBoldIcon,
  LineHeightIcon,
  LetterSpacingIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  TextAlignJustifyIcon,
  TextAlignTopIcon,
  TextAlignBottomIcon,
  UnderlineIcon,
  StrikethroughIcon,
  LetterCaseUppercaseIcon,
  LetterCaseLowercaseIcon,
  LetterCaseCapitalizeIcon,
  TextNoneIcon,
  BorderWidthIcon,
  BorderStyleIcon,
  CornersIcon,
  CornerTopLeftIcon,
  CornerTopRightIcon,
  CornerBottomLeftIcon,
  CornerBottomRightIcon,
  OpacityIcon,
  ShadowIcon,
  MoveIcon,
  ColumnSpacingIcon,
  RowSpacingIcon,
  LayoutIcon,
  GridIcon,
  BoxIcon,
  RowsIcon,
  ColumnsIcon,
  AlignLeftIcon,
  AlignCenterHorizontallyIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignCenterVerticallyIcon,
  AlignBottomIcon,
  SpaceBetweenHorizontallyIcon,
  SpaceEvenlyHorizontallyIcon,
  StretchHorizontallyIcon,
  EyeNoneIcon,
  BoxModelIcon,
  CodeIcon,
  TokensIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";

// ─── Lucide Icons ────────────────────────────────────────────────────────────
import {
  SquareArrowRightExit,
  Maximize2,
  LayoutGrid,
  Palette,
  Move,
  Type,
  Sparkles,
  Square,
  Crosshair,
  Pin,
  WrapText,
  AlignJustify,
  Columns3,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Plus,
  Minus,
  Layers,
  PanelTopDashed,
  PanelRightDashed,
  PanelBottomDashed,
  PanelLeftDashed,
  PanelLeftRightDashed,
  PanelTopBottomDashed,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface IconEntry {
  name: string;
  library: "radix" | "lucide" | "custom";
  importPath: string;
  category: string;
  usedFor: string;
  usedIn: string[];
  svgMarkup: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderRadix(Icon: ComponentType<{ width?: number; height?: number }>): string {
  return renderToStaticMarkup(createElement(Icon, { width: 15, height: 15 }));
}

function renderLucide(Icon: ComponentType<{ size?: number; strokeWidth?: number }>): string {
  return renderToStaticMarkup(createElement(Icon, { size: 24, strokeWidth: 1.5 }));
}

// ─── Icon Registry ───────────────────────────────────────────────────────────

const ICONS: IconEntry[] = [
  // Section Headers
  { name: "LayoutGrid", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Layout section header icon", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderLucide(LayoutGrid) },
  { name: "Maximize2", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Size section header icon", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderLucide(Maximize2) },
  { name: "Move", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Spacing section header icon", usedIn: ["computed-property-panel.tsx", "token-editor.tsx"], svgMarkup: renderLucide(Move) },
  { name: "Type", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Typography section header icon", usedIn: ["computed-property-panel.tsx", "editor-panel.tsx"], svgMarkup: renderLucide(Type) },
  { name: "Palette", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Color section header icon", usedIn: ["computed-property-panel.tsx", "token-editor.tsx", "editor-panel.tsx"], svgMarkup: renderLucide(Palette) },
  { name: "Square", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Border section header icon", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderLucide(Square) },
  { name: "Sparkles", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Effects section header; used-by-selected tokens indicator", usedIn: ["computed-property-panel.tsx", "editor-panel.tsx", "token-editor.tsx"], svgMarkup: renderLucide(Sparkles) },
  { name: "Layers", library: "lucide", importPath: "lucide-react", category: "Section Headers", usedFor: "Shadows section header icon", usedIn: ["token-editor.tsx", "editor-panel.tsx"], svgMarkup: renderLucide(Layers) },

  // Size Controls
  { name: "WidthIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Size Controls", usedFor: "Width, min-width, max-width scale input icon", usedIn: ["property-icons.ts", "property-panel.tsx", "controls-gallery.tsx"], svgMarkup: renderRadix(WidthIcon) },
  { name: "HeightIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Size Controls", usedFor: "Height, min-height, max-height scale input icon", usedIn: ["property-icons.ts", "property-panel.tsx"], svgMarkup: renderRadix(HeightIcon) },

  // Spacing Controls
  { name: "PaddingIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Spacing Controls", usedFor: "Padding control icon (all sides)", usedIn: ["computed-property-panel.tsx", "property-panel.tsx", "controls-gallery.tsx", "box-spacing.tsx"], svgMarkup: renderRadix(PaddingIcon) },
  { name: "MarginIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Spacing Controls", usedFor: "Margin control icon (all sides)", usedIn: ["computed-property-panel.tsx", "property-panel.tsx", "controls-gallery.tsx", "box-spacing.tsx"], svgMarkup: renderRadix(MarginIcon) },
  { name: "ColumnSpacingIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Spacing Controls", usedFor: "Column gap / horizontal gap control icon", usedIn: ["property-icons.ts", "property-panel.tsx"], svgMarkup: renderRadix(ColumnSpacingIcon) },
  { name: "RowSpacingIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Spacing Controls", usedFor: "Row gap / vertical gap control icon", usedIn: ["property-icons.ts", "property-panel.tsx"], svgMarkup: renderRadix(RowSpacingIcon) },
  { name: "BoxModelIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Spacing Controls", usedFor: "Box model toggle in box-spacing control", usedIn: ["box-spacing.tsx"], svgMarkup: renderRadix(BoxModelIcon) },
  { name: "PanelTopDashed", library: "lucide", importPath: "lucide-react", category: "Spacing Controls", usedFor: "Top spacing side selector", usedIn: ["box-spacing.tsx"], svgMarkup: renderLucide(PanelTopDashed) },
  { name: "PanelRightDashed", library: "lucide", importPath: "lucide-react", category: "Spacing Controls", usedFor: "Right spacing side selector", usedIn: ["box-spacing.tsx"], svgMarkup: renderLucide(PanelRightDashed) },
  { name: "PanelBottomDashed", library: "lucide", importPath: "lucide-react", category: "Spacing Controls", usedFor: "Bottom spacing side selector", usedIn: ["box-spacing.tsx"], svgMarkup: renderLucide(PanelBottomDashed) },
  { name: "PanelLeftDashed", library: "lucide", importPath: "lucide-react", category: "Spacing Controls", usedFor: "Left spacing side selector", usedIn: ["box-spacing.tsx"], svgMarkup: renderLucide(PanelLeftDashed) },
  { name: "PanelLeftRightDashed", library: "lucide", importPath: "lucide-react", category: "Spacing Controls", usedFor: "Horizontal axis (X) spacing selector", usedIn: ["box-spacing.tsx"], svgMarkup: renderLucide(PanelLeftRightDashed) },
  { name: "PanelTopBottomDashed", library: "lucide", importPath: "lucide-react", category: "Spacing Controls", usedFor: "Vertical axis (Y) spacing selector", usedIn: ["box-spacing.tsx"], svgMarkup: renderLucide(PanelTopBottomDashed) },

  // Layout & Display Controls
  { name: "LayoutIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Layout & Display Controls", usedFor: "Display flex indicator in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(LayoutIcon) },
  { name: "GridIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Layout & Display Controls", usedFor: "Display grid indicator in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(GridIcon) },
  { name: "BoxIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Layout & Display Controls", usedFor: "Display block indicator in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(BoxIcon) },
  { name: "EyeNoneIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Layout & Display Controls", usedFor: "Display none indicator in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(EyeNoneIcon) },
  { name: "RowsIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Layout & Display Controls", usedFor: "Flex direction row option in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(RowsIcon) },
  { name: "ColumnsIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Layout & Display Controls", usedFor: "Flex direction column option in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(ColumnsIcon) },
  { name: "Columns3", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Flex direction row option (alternative) in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderLucide(Columns3) },
  { name: "WrapText", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Flex wrap option in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderLucide(WrapText) },
  { name: "AlignJustify", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Flex nowrap option in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderLucide(AlignJustify) },
  { name: "ArrowRight", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Flex direction row indicator arrow", usedIn: ["property-panel.tsx", "computed-property-panel.tsx"], svgMarkup: renderLucide(ArrowRight) },
  { name: "ArrowDown", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Flex direction column indicator arrow", usedIn: ["property-panel.tsx"], svgMarkup: renderLucide(ArrowDown) },
  { name: "ArrowLeft", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Flex direction row-reverse indicator arrow", usedIn: ["property-panel.tsx"], svgMarkup: renderLucide(ArrowLeft) },
  { name: "ArrowUp", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Flex direction column-reverse indicator arrow", usedIn: ["property-panel.tsx"], svgMarkup: renderLucide(ArrowUp) },
  { name: "Plus", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Add grid track button in grid-input control", usedIn: ["grid-input.tsx"], svgMarkup: renderLucide(Plus) },
  { name: "Minus", library: "lucide", importPath: "lucide-react", category: "Layout & Display Controls", usedFor: "Remove grid track button in grid-input control", usedIn: ["grid-input.tsx"], svgMarkup: renderLucide(Minus) },

  // Alignment Controls
  { name: "AlignLeftIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Justify content flex-start in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(AlignLeftIcon) },
  { name: "AlignCenterHorizontallyIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Justify content center in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(AlignCenterHorizontallyIcon) },
  { name: "AlignRightIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Justify content flex-end in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(AlignRightIcon) },
  { name: "SpaceBetweenHorizontallyIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Justify content space-between in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(SpaceBetweenHorizontallyIcon) },
  { name: "SpaceEvenlyHorizontallyIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Justify content space-evenly in segmented control", usedIn: ["property-panel.tsx"], svgMarkup: renderRadix(SpaceEvenlyHorizontallyIcon) },
  { name: "AlignTopIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Align items flex-start in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(AlignTopIcon) },
  { name: "AlignCenterVerticallyIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Align items center in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(AlignCenterVerticallyIcon) },
  { name: "AlignBottomIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Align items flex-end in segmented control", usedIn: ["computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(AlignBottomIcon) },
  { name: "StretchHorizontallyIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Alignment Controls", usedFor: "Align items stretch in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(StretchHorizontallyIcon) },

  // Typography Controls
  { name: "FontFamilyIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Font family select input icon", usedIn: ["property-icons.ts", "computed-property-panel.tsx"], svgMarkup: renderRadix(FontFamilyIcon) },
  { name: "FontSizeIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Font size scale input icon", usedIn: ["property-icons.ts", "computed-property-panel.tsx", "property-panel.tsx", "controls-gallery.tsx"], svgMarkup: renderRadix(FontSizeIcon) },
  { name: "FontBoldIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Font weight scale input icon", usedIn: ["property-icons.ts", "computed-property-panel.tsx", "property-panel.tsx"], svgMarkup: renderRadix(FontBoldIcon) },
  { name: "LineHeightIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Line height scale input icon", usedIn: ["property-icons.ts", "computed-property-panel.tsx"], svgMarkup: renderRadix(LineHeightIcon) },
  { name: "LetterSpacingIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Letter spacing scale input icon", usedIn: ["property-icons.ts", "computed-property-panel.tsx"], svgMarkup: renderRadix(LetterSpacingIcon) },
  { name: "TextAlignLeftIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text align left in segmented control", usedIn: ["property-icons.ts", "computed-property-panel.tsx", "controls-gallery.tsx"], svgMarkup: renderRadix(TextAlignLeftIcon) },
  { name: "TextAlignCenterIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text align center in segmented control", usedIn: ["computed-property-panel.tsx", "controls-gallery.tsx"], svgMarkup: renderRadix(TextAlignCenterIcon) },
  { name: "TextAlignRightIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text align right in segmented control", usedIn: ["computed-property-panel.tsx", "controls-gallery.tsx"], svgMarkup: renderRadix(TextAlignRightIcon) },
  { name: "TextAlignJustifyIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text align justify in segmented control", usedIn: ["computed-property-panel.tsx", "controls-gallery.tsx"], svgMarkup: renderRadix(TextAlignJustifyIcon) },
  { name: "TextAlignTopIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Vertical align top in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(TextAlignTopIcon) },
  { name: "TextAlignBottomIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Vertical align bottom in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(TextAlignBottomIcon) },
  { name: "UnderlineIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text decoration underline in segmented control", usedIn: ["property-icons.ts", "computed-property-panel.tsx"], svgMarkup: renderRadix(UnderlineIcon) },
  { name: "StrikethroughIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text decoration line-through in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(StrikethroughIcon) },
  { name: "TextNoneIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text decoration none in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(TextNoneIcon) },
  { name: "LetterCaseUppercaseIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text transform uppercase in segmented control", usedIn: ["property-icons.ts", "computed-property-panel.tsx"], svgMarkup: renderRadix(LetterCaseUppercaseIcon) },
  { name: "LetterCaseLowercaseIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text transform lowercase in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(LetterCaseLowercaseIcon) },
  { name: "LetterCaseCapitalizeIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Typography Controls", usedFor: "Text transform capitalize in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderRadix(LetterCaseCapitalizeIcon) },

  // Border & Corner Controls
  { name: "BorderWidthIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Border & Corner Controls", usedFor: "Border width scale input icon (all sides)", usedIn: ["property-icons.ts", "computed-property-panel.tsx", "token-editor.tsx"], svgMarkup: renderRadix(BorderWidthIcon) },
  { name: "BorderStyleIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Border & Corner Controls", usedFor: "Border style select input icon", usedIn: ["property-icons.ts"], svgMarkup: renderRadix(BorderStyleIcon) },
  { name: "CornersIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Border & Corner Controls", usedFor: "Uniform border radius control; radius section toggle", usedIn: ["computed-property-panel.tsx", "box-radius.tsx", "token-editor.tsx"], svgMarkup: renderRadix(CornersIcon) },
  { name: "CornerTopLeftIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Border & Corner Controls", usedFor: "Border top-left radius input icon", usedIn: ["property-icons.ts", "box-radius.tsx"], svgMarkup: renderRadix(CornerTopLeftIcon) },
  { name: "CornerTopRightIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Border & Corner Controls", usedFor: "Border top-right radius input icon", usedIn: ["property-icons.ts", "box-radius.tsx"], svgMarkup: renderRadix(CornerTopRightIcon) },
  { name: "CornerBottomLeftIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Border & Corner Controls", usedFor: "Border bottom-left radius input icon", usedIn: ["property-icons.ts", "box-radius.tsx"], svgMarkup: renderRadix(CornerBottomLeftIcon) },
  { name: "CornerBottomRightIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Border & Corner Controls", usedFor: "Border bottom-right radius input icon", usedIn: ["property-icons.ts", "box-radius.tsx"], svgMarkup: renderRadix(CornerBottomRightIcon) },

  // Opacity & Shadow Controls
  { name: "OpacityIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Opacity & Shadow Controls", usedFor: "Opacity slider icon", usedIn: ["property-icons.ts", "opacity-slider.tsx", "controls-gallery.tsx"], svgMarkup: renderRadix(OpacityIcon) },
  { name: "ShadowIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Opacity & Shadow Controls", usedFor: "Box shadow picker icon", usedIn: ["property-icons.ts", "shadow-picker.tsx"], svgMarkup: renderRadix(ShadowIcon) },

  // Overflow & Position Controls
  { name: "SquareArrowRightExit", library: "lucide", importPath: "lucide-react", category: "Overflow & Position Controls", usedFor: "Overflow property icon (content exiting container)", usedIn: ["property-icons.ts"], svgMarkup: renderLucide(SquareArrowRightExit) },
  { name: "MoveIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Overflow & Position Controls", usedFor: "Position offset (top/right/bottom/left) scale input icon", usedIn: ["property-icons.ts"], svgMarkup: renderRadix(MoveIcon) },
  { name: "Crosshair", library: "lucide", importPath: "lucide-react", category: "Overflow & Position Controls", usedFor: "Position absolute option in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderLucide(Crosshair) },
  { name: "Pin", library: "lucide", importPath: "lucide-react", category: "Overflow & Position Controls", usedFor: "Position fixed option in segmented control", usedIn: ["computed-property-panel.tsx"], svgMarkup: renderLucide(Pin) },

  // Scale Input Mode Toggles
  { name: "CodeIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Scale Input Mode Toggles", usedFor: "Switch to arbitrary/code value mode in scale input", usedIn: ["scale-input.tsx"], svgMarkup: renderRadix(CodeIcon) },
  { name: "TokensIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Scale Input Mode Toggles", usedFor: "Switch to token/scale value mode in scale input", usedIn: ["scale-input.tsx"], svgMarkup: renderRadix(TokensIcon) },
  { name: "MagnifyingGlassIcon", library: "radix", importPath: "@radix-ui/react-icons", category: "Scale Input Mode Toggles", usedFor: "Search/filter icon inside select dropdown", usedIn: ["select.tsx"], svgMarkup: renderRadix(MagnifyingGlassIcon) },
];

// Custom inline SVGs
const CUSTOM_ICONS: Omit<IconEntry, "render">[] = [
  { name: "StaticIcon", library: "custom", importPath: "computed-property-panel.tsx (inline)", category: "Overflow & Position Controls", usedFor: "Position static option — default document flow", usedIn: ["computed-property-panel.tsx"], svgMarkup: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="10" height="8" rx="1"/><line x1="4" y1="6" x2="10" y2="6"/><line x1="4" y1="8.5" x2="8" y2="8.5"/></svg>` },
  { name: "RelativeIcon", library: "custom", importPath: "computed-property-panel.tsx (inline)", category: "Overflow & Position Controls", usedFor: "Position relative option — offset from normal position", usedIn: ["computed-property-panel.tsx"], svgMarkup: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="3" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="4.5" y="1.5" width="8" height="8" rx="1"/></svg>` },
  { name: "StickyIcon", library: "custom", importPath: "computed-property-panel.tsx (inline)", category: "Overflow & Position Controls", usedFor: "Position sticky option — pinned header with scrollable body", usedIn: ["computed-property-panel.tsx"], svgMarkup: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="1.5" width="10" height="3" rx="0.75"/><rect x="2" y="6" width="10" height="6.5" rx="1" stroke-dasharray="2 2"/></svg>` },
];

const ALL = [...ICONS, ...CUSTOM_ICONS];

// ─── Generate Markdown ───────────────────────────────────────────────────────

function generateMarkdown(): string {
  const lines: string[] = [];

  lines.push("# Icon Reference — @designtools/surface Editor Controls");
  lines.push("");
  lines.push("Property editing controls and section headers used in the editor.");
  lines.push(`${ALL.length} icons total from 3 sources.`);
  lines.push("");
  lines.push("## Libraries");
  lines.push("");
  lines.push("| Library | Icons | ViewBox | Style | Docs |");
  lines.push("|---------|-------|---------|-------|------|");
  lines.push(`| \`@radix-ui/react-icons\` | ${ICONS.filter(i => i.library === "radix").length} | 15×15 | Fill-based | https://www.radix-ui.com/icons |`);
  lines.push(`| \`lucide-react\` | ${ICONS.filter(i => i.library === "lucide").length} | 24×24 | Stroke (1.5) | https://lucide.dev/icons |`);
  lines.push(`| Custom inline SVG | ${CUSTOM_ICONS.length} | 14×14 | Stroke (1.5) | Defined in computed-property-panel.tsx |`);
  lines.push("");

  // Group by category
  const categories = new Map<string, typeof ALL>();
  for (const icon of ALL) {
    if (!categories.has(icon.category)) categories.set(icon.category, []);
    categories.get(icon.category)!.push(icon);
  }

  for (const [category, icons] of categories) {
    lines.push(`## ${category}`);
    lines.push("");

    for (const icon of icons) {
      lines.push(`### ${icon.name}`);
      lines.push("");
      lines.push(`- **Library:** \`${icon.importPath}\``);
      lines.push(`- **Used for:** ${icon.usedFor}`);
      lines.push(`- **Used in:** ${icon.usedIn.map(f => `\`${f}\``).join(", ")}`);
      lines.push("");
      lines.push("```svg");
      lines.push(icon.svgMarkup);
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("*Not included: toolbar/chrome icons, navigation chevrons, generic actions (close, check, trash), panel structure icons.*");
  lines.push("");
  lines.push(`*Source: \`packages/surface/src/client/components/\`*`);

  return lines.join("\n");
}

// ─── Generate prerendered HTML ───────────────────────────────────────────────

function generateStaticHtml(): string {
  // Group by category
  const categories = new Map<string, typeof ALL>();
  for (const icon of ALL) {
    if (!categories.has(icon.category)) categories.set(icon.category, []);
    categories.get(icon.category)!.push(icon);
  }

  const radixCount = ICONS.filter(i => i.library === "radix").length;
  const lucideCount = ICONS.filter(i => i.library === "lucide").length;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Icon Reference — @designtools/surface</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,600;14..32,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Inter", system-ui, sans-serif; background: #fff; color: #09090b; -webkit-font-smoothing: antialiased; max-width: 56rem; margin: 0 auto; padding: 3rem 1.5rem; }
    code, pre { font-family: "JetBrains Mono", monospace; }
    h1 { font-size: 1.5rem; font-weight: 700; }
    .subtitle { font-size: 0.875rem; color: #71717a; margin-top: 0.25rem; }
    .summary { margin-top: 1.5rem; padding: 1rem; background: #f8f8f9; border: 1px solid #e4e4e7; border-radius: 0.5rem; font-size: 0.875rem; color: #71717a; }
    .summary strong { color: #09090b; }
    .summary a { color: #3b82f6; }
    .category { margin-top: 2.5rem; }
    .category h2 { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; border-bottom: 1px solid #e4e4e7; padding-bottom: 0.25rem; margin-bottom: 0.75rem; }
    .category h2 span { font-weight: 400; text-transform: none; letter-spacing: normal; opacity: 0.6; margin-left: 0.5rem; }
    .icon-card { display: flex; gap: 1rem; align-items: flex-start; padding: 0.75rem 1rem; border: 1px solid #e4e4e7; border-radius: 0.5rem; margin-bottom: 0.5rem; }
    .icon-card:hover { background: rgba(248,248,249,0.5); }
    .icon-preview { flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 0.375rem; background: #18181b; color: #fff; display: flex; align-items: center; justify-content: center; }
    .icon-preview svg { display: block; }
    .icon-details { flex: 1; min-width: 0; }
    .icon-name { font-family: "JetBrains Mono", monospace; font-size: 0.875rem; font-weight: 600; }
    .badge { display: inline-block; padding: 0.125rem 0.375rem; font-size: 0.625rem; font-family: "JetBrains Mono", monospace; border-radius: 0.25rem; border: 1px solid; margin-left: 0.5rem; vertical-align: middle; }
    .badge-radix { background: #ede9fe; color: #5b21b6; border-color: #ddd6fe; }
    .badge-lucide { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
    .badge-custom { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .icon-usage { font-size: 0.75rem; color: #71717a; margin-top: 0.125rem; }
    .icon-files { font-size: 0.625rem; color: #a1a1aa; margin-top: 0.25rem; }
    .icon-files code { background: #f0f0f2; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.625rem; color: #71717a; }
    details { margin-top: 0.5rem; }
    details summary { font-size: 0.6875rem; font-family: "JetBrains Mono", monospace; color: #71717a; cursor: pointer; }
    details summary:hover { color: #09090b; }
    details pre { margin-top: 0.25rem; padding: 0.5rem; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 0.25rem; font-size: 0.6875rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: #71717a; }
    footer { margin-top: 4rem; padding-top: 1.5rem; border-top: 1px solid #e4e4e7; font-size: 0.75rem; color: #a1a1aa; }
    footer p + p { margin-top: 0.25rem; }
    footer code { background: #f0f0f2; padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.625rem; }
    .md-link { margin-top: 1rem; padding: 0.75rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 0.5rem; font-size: 0.75rem; color: #1e40af; }
    .md-link a { color: #2563eb; }
    .md-link code { background: #dbeafe; padding: 0.125rem 0.25rem; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <h1>Icon Reference</h1>
  <p class="subtitle">Property editing controls and section headers used in the <code>@designtools/surface</code> editor.</p>

  <div class="summary">
    <p><strong>${ALL.length} icons</strong> from <strong>3 sources</strong>:</p>
    <ul style="margin-top:0.5rem;padding-left:1.25rem;font-size:0.75rem;list-style:disc;">
      <li><strong>@radix-ui/react-icons</strong> — ${radixCount} icons. 15×15 viewBox, fill-based. <a href="https://www.radix-ui.com/icons" target="_blank">radix-ui.com/icons</a></li>
      <li><strong>lucide-react</strong> — ${lucideCount} icons. 24×24 viewBox, stroke-based (strokeWidth 1.5). <a href="https://lucide.dev/icons" target="_blank">lucide.dev/icons</a></li>
      <li><strong>Custom inline SVG</strong> — ${CUSTOM_ICONS.length} icons in <code>computed-property-panel.tsx</code> for position indicators.</li>
    </ul>
  </div>

  <div class="md-link">
    <strong>For LLMs:</strong> A machine-readable version is available at <a href="/icon-reference.md"><code>/icon-reference.md</code></a> with full SVG sources in fenced code blocks.
  </div>
`;

  for (const [category, icons] of categories) {
    html += `\n  <section class="category">
    <h2>${category}<span>(${icons.length})</span></h2>\n`;

    for (const icon of icons) {
      const badgeClass = icon.library === "radix" ? "badge-radix" : icon.library === "lucide" ? "badge-lucide" : "badge-custom";
      const badgeLabel = icon.library === "radix" ? "@radix-ui/react-icons" : icon.library === "lucide" ? "lucide-react" : "Custom SVG";
      const filesHtml = icon.usedIn.map(f => `<code>${f}</code>`).join(" ");
      const svgForPreview = icon.svgMarkup;

      html += `    <div class="icon-card">
      <div class="icon-preview">${svgForPreview}</div>
      <div class="icon-details">
        <div><span class="icon-name">${icon.name}</span><span class="badge ${badgeClass}">${badgeLabel}</span></div>
        <p class="icon-usage">${icon.usedFor}</p>
        <p class="icon-files">Used in: ${filesHtml}</p>
        <details>
          <summary>SVG source</summary>
          <pre>${escapeHtml(icon.svgMarkup)}</pre>
        </details>
      </div>
    </div>\n`;
    }

    html += `  </section>\n`;
  }

  html += `
  <footer>
    <p>Source: <code>packages/surface/src/client/components/</code></p>
    <p>Not shown: toolbar/chrome icons, navigation chevrons, generic actions (close, check, trash), panel structure icons.</p>
  </footer>
</body>
</html>`;

  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Main ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const landingRoot = join(__dirname, "..");

// 1. Write markdown to public/ (served as static file)
const publicDir = join(landingRoot, "public");
mkdirSync(publicDir, { recursive: true });
const mdPath = join(publicDir, "icon-reference.md");
writeFileSync(mdPath, generateMarkdown(), "utf-8");
console.log(`✓ Generated ${mdPath}`);

// 2. Write prerendered HTML (replaces the Vite SPA shell)
const htmlPath = join(landingRoot, "icon-reference.html");
writeFileSync(htmlPath, generateStaticHtml(), "utf-8");
console.log(`✓ Generated ${htmlPath} (prerendered, no JS needed)`);

console.log(`\n  ${ALL.length} icons across ${new Set(ALL.map(i => i.category)).size} categories`);
