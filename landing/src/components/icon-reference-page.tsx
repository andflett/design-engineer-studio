/**
 * Icon Reference Page
 *
 * Lists every icon used on property editing controls and section headers
 * in the @designtools/surface editor. Designed to be human-scannable and
 * LLM-readable.
 *
 * Each icon shows: visual preview, name, library, usage context,
 * and a collapsible SVG source block.
 */
import { useState, type ComponentType, type ReactElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
  render: () => ReactElement;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wrap a Radix icon (15×15 viewBox) */
const radix = (Icon: ComponentType<{ width?: number; height?: number }>) => () =>
  createElement(Icon, { width: 20, height: 20 });

/** Wrap a Lucide icon (24×24 viewBox, stroke-based) */
const lucide = (Icon: ComponentType<{ size?: number; strokeWidth?: number }>) => () =>
  createElement(Icon, { size: 20, strokeWidth: 1.5 });

// ─── Icon Registry ───────────────────────────────────────────────────────────
// Only property editing controls and section headers.

const ICONS: IconEntry[] = [
  // ── Section Headers ────────────────────────────────────────────────────────
  {
    name: "LayoutGrid",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Layout section header icon",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: lucide(LayoutGrid),
  },
  {
    name: "Maximize2",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Size section header icon",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: lucide(Maximize2),
  },
  {
    name: "Move",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Spacing section header icon",
    usedIn: ["computed-property-panel.tsx", "token-editor.tsx"],
    render: lucide(Move),
  },
  {
    name: "Type",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Typography section header icon",
    usedIn: ["computed-property-panel.tsx", "editor-panel.tsx"],
    render: lucide(Type),
  },
  {
    name: "Palette",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Color section header icon",
    usedIn: ["computed-property-panel.tsx", "token-editor.tsx", "editor-panel.tsx"],
    render: lucide(Palette),
  },
  {
    name: "Square (lucide)",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Border section header icon",
    usedIn: ["computed-property-panel.tsx"],
    render: lucide(Square),
  },
  {
    name: "Sparkles",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Effects section header; used-by-selected tokens indicator",
    usedIn: ["computed-property-panel.tsx", "editor-panel.tsx", "token-editor.tsx"],
    render: lucide(Sparkles),
  },
  {
    name: "Layers (lucide)",
    library: "lucide",
    importPath: "lucide-react",
    category: "Section Headers",
    usedFor: "Shadows section header icon",
    usedIn: ["token-editor.tsx", "editor-panel.tsx"],
    render: lucide(Layers),
  },

  // ── Size Controls ──────────────────────────────────────────────────────────
  {
    name: "WidthIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Size Controls",
    usedFor: "Width, min-width, max-width scale input icon",
    usedIn: ["property-icons.ts", "property-panel.tsx", "controls-gallery.tsx"],
    render: radix(WidthIcon),
  },
  {
    name: "HeightIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Size Controls",
    usedFor: "Height, min-height, max-height scale input icon",
    usedIn: ["property-icons.ts", "property-panel.tsx"],
    render: radix(HeightIcon),
  },

  // ── Spacing Controls ───────────────────────────────────────────────────────
  {
    name: "PaddingIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Spacing Controls",
    usedFor: "Padding control icon (all sides)",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx", "controls-gallery.tsx", "box-spacing.tsx"],
    render: radix(PaddingIcon),
  },
  {
    name: "MarginIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Spacing Controls",
    usedFor: "Margin control icon (all sides)",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx", "controls-gallery.tsx", "box-spacing.tsx"],
    render: radix(MarginIcon),
  },
  {
    name: "ColumnSpacingIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Spacing Controls",
    usedFor: "Column gap / horizontal gap control icon",
    usedIn: ["property-icons.ts", "property-panel.tsx"],
    render: radix(ColumnSpacingIcon),
  },
  {
    name: "RowSpacingIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Spacing Controls",
    usedFor: "Row gap / vertical gap control icon",
    usedIn: ["property-icons.ts", "property-panel.tsx"],
    render: radix(RowSpacingIcon),
  },
  {
    name: "BoxModelIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Spacing Controls",
    usedFor: "Box model toggle in box-spacing control",
    usedIn: ["box-spacing.tsx"],
    render: radix(BoxModelIcon),
  },
  {
    name: "PanelTopDashed",
    library: "lucide",
    importPath: "lucide-react",
    category: "Spacing Controls",
    usedFor: "Top spacing side selector",
    usedIn: ["box-spacing.tsx"],
    render: lucide(PanelTopDashed),
  },
  {
    name: "PanelRightDashed",
    library: "lucide",
    importPath: "lucide-react",
    category: "Spacing Controls",
    usedFor: "Right spacing side selector",
    usedIn: ["box-spacing.tsx"],
    render: lucide(PanelRightDashed),
  },
  {
    name: "PanelBottomDashed",
    library: "lucide",
    importPath: "lucide-react",
    category: "Spacing Controls",
    usedFor: "Bottom spacing side selector",
    usedIn: ["box-spacing.tsx"],
    render: lucide(PanelBottomDashed),
  },
  {
    name: "PanelLeftDashed",
    library: "lucide",
    importPath: "lucide-react",
    category: "Spacing Controls",
    usedFor: "Left spacing side selector",
    usedIn: ["box-spacing.tsx"],
    render: lucide(PanelLeftDashed),
  },
  {
    name: "PanelLeftRightDashed",
    library: "lucide",
    importPath: "lucide-react",
    category: "Spacing Controls",
    usedFor: "Horizontal axis (X) spacing selector",
    usedIn: ["box-spacing.tsx"],
    render: lucide(PanelLeftRightDashed),
  },
  {
    name: "PanelTopBottomDashed",
    library: "lucide",
    importPath: "lucide-react",
    category: "Spacing Controls",
    usedFor: "Vertical axis (Y) spacing selector",
    usedIn: ["box-spacing.tsx"],
    render: lucide(PanelTopBottomDashed),
  },

  // ── Layout & Display Controls ──────────────────────────────────────────────
  {
    name: "LayoutIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Layout & Display Controls",
    usedFor: "Display flex indicator in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(LayoutIcon),
  },
  {
    name: "GridIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Layout & Display Controls",
    usedFor: "Display grid indicator in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(GridIcon),
  },
  {
    name: "BoxIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Layout & Display Controls",
    usedFor: "Display block indicator in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(BoxIcon),
  },
  {
    name: "EyeNoneIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Layout & Display Controls",
    usedFor: "Display none indicator in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(EyeNoneIcon),
  },
  {
    name: "RowsIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Layout & Display Controls",
    usedFor: "Flex direction row option in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(RowsIcon),
  },
  {
    name: "ColumnsIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Layout & Display Controls",
    usedFor: "Flex direction column option in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(ColumnsIcon),
  },
  {
    name: "Columns3",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Flex direction row option (alternative) in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: lucide(Columns3),
  },
  {
    name: "WrapText",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Flex wrap option in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: lucide(WrapText),
  },
  {
    name: "AlignJustify (lucide)",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Flex nowrap option in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: lucide(AlignJustify),
  },
  {
    name: "ArrowRight",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Flex direction row indicator arrow",
    usedIn: ["property-panel.tsx", "computed-property-panel.tsx"],
    render: lucide(ArrowRight),
  },
  {
    name: "ArrowDown",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Flex direction column indicator arrow",
    usedIn: ["property-panel.tsx"],
    render: lucide(ArrowDown),
  },
  {
    name: "ArrowLeft",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Flex direction row-reverse indicator arrow",
    usedIn: ["property-panel.tsx"],
    render: lucide(ArrowLeft),
  },
  {
    name: "ArrowUp",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Flex direction column-reverse indicator arrow",
    usedIn: ["property-panel.tsx"],
    render: lucide(ArrowUp),
  },
  {
    name: "Plus (lucide)",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Add grid track button in grid-input control",
    usedIn: ["grid-input.tsx"],
    render: lucide(Plus),
  },
  {
    name: "Minus",
    library: "lucide",
    importPath: "lucide-react",
    category: "Layout & Display Controls",
    usedFor: "Remove grid track button in grid-input control",
    usedIn: ["grid-input.tsx"],
    render: lucide(Minus),
  },

  // ── Alignment Controls ─────────────────────────────────────────────────────
  {
    name: "AlignLeftIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Justify content flex-start in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(AlignLeftIcon),
  },
  {
    name: "AlignCenterHorizontallyIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Justify content center in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(AlignCenterHorizontallyIcon),
  },
  {
    name: "AlignRightIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Justify content flex-end in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(AlignRightIcon),
  },
  {
    name: "SpaceBetweenHorizontallyIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Justify content space-between in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(SpaceBetweenHorizontallyIcon),
  },
  {
    name: "SpaceEvenlyHorizontallyIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Justify content space-evenly in segmented control",
    usedIn: ["property-panel.tsx"],
    render: radix(SpaceEvenlyHorizontallyIcon),
  },
  {
    name: "AlignTopIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Align items flex-start in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(AlignTopIcon),
  },
  {
    name: "AlignCenterVerticallyIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Align items center in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(AlignCenterVerticallyIcon),
  },
  {
    name: "AlignBottomIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Align items flex-end in segmented control",
    usedIn: ["computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(AlignBottomIcon),
  },
  {
    name: "StretchHorizontallyIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Alignment Controls",
    usedFor: "Align items stretch in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(StretchHorizontallyIcon),
  },

  // ── Typography Controls ────────────────────────────────────────────────────
  {
    name: "FontFamilyIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Font family select input icon",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx"],
    render: radix(FontFamilyIcon),
  },
  {
    name: "FontSizeIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Font size scale input icon",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx", "property-panel.tsx", "controls-gallery.tsx"],
    render: radix(FontSizeIcon),
  },
  {
    name: "FontBoldIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Font weight scale input icon",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx", "property-panel.tsx"],
    render: radix(FontBoldIcon),
  },
  {
    name: "LineHeightIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Line height scale input icon",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx"],
    render: radix(LineHeightIcon),
  },
  {
    name: "LetterSpacingIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Letter spacing scale input icon",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx"],
    render: radix(LetterSpacingIcon),
  },
  {
    name: "TextAlignLeftIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text align left in segmented control",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx", "controls-gallery.tsx"],
    render: radix(TextAlignLeftIcon),
  },
  {
    name: "TextAlignCenterIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text align center in segmented control",
    usedIn: ["computed-property-panel.tsx", "controls-gallery.tsx"],
    render: radix(TextAlignCenterIcon),
  },
  {
    name: "TextAlignRightIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text align right in segmented control",
    usedIn: ["computed-property-panel.tsx", "controls-gallery.tsx"],
    render: radix(TextAlignRightIcon),
  },
  {
    name: "TextAlignJustifyIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text align justify in segmented control",
    usedIn: ["computed-property-panel.tsx", "controls-gallery.tsx"],
    render: radix(TextAlignJustifyIcon),
  },
  {
    name: "TextAlignTopIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Vertical align top in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(TextAlignTopIcon),
  },
  {
    name: "TextAlignBottomIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Vertical align bottom in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(TextAlignBottomIcon),
  },
  {
    name: "UnderlineIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text decoration underline in segmented control",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx"],
    render: radix(UnderlineIcon),
  },
  {
    name: "StrikethroughIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text decoration line-through in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(StrikethroughIcon),
  },
  {
    name: "TextNoneIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text decoration none in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(TextNoneIcon),
  },
  {
    name: "LetterCaseUppercaseIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text transform uppercase in segmented control",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx"],
    render: radix(LetterCaseUppercaseIcon),
  },
  {
    name: "LetterCaseLowercaseIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text transform lowercase in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(LetterCaseLowercaseIcon),
  },
  {
    name: "LetterCaseCapitalizeIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Typography Controls",
    usedFor: "Text transform capitalize in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: radix(LetterCaseCapitalizeIcon),
  },

  // ── Border & Corner Controls ───────────────────────────────────────────────
  {
    name: "BorderWidthIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Border & Corner Controls",
    usedFor: "Border width scale input icon (all sides)",
    usedIn: ["property-icons.ts", "computed-property-panel.tsx", "token-editor.tsx"],
    render: radix(BorderWidthIcon),
  },
  {
    name: "BorderStyleIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Border & Corner Controls",
    usedFor: "Border style select input icon",
    usedIn: ["property-icons.ts"],
    render: radix(BorderStyleIcon),
  },
  {
    name: "CornersIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Border & Corner Controls",
    usedFor: "Uniform border radius control; radius section toggle",
    usedIn: ["computed-property-panel.tsx", "box-radius.tsx", "token-editor.tsx"],
    render: radix(CornersIcon),
  },
  {
    name: "CornerTopLeftIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Border & Corner Controls",
    usedFor: "Border top-left radius input icon",
    usedIn: ["property-icons.ts", "box-radius.tsx"],
    render: radix(CornerTopLeftIcon),
  },
  {
    name: "CornerTopRightIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Border & Corner Controls",
    usedFor: "Border top-right radius input icon",
    usedIn: ["property-icons.ts", "box-radius.tsx"],
    render: radix(CornerTopRightIcon),
  },
  {
    name: "CornerBottomLeftIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Border & Corner Controls",
    usedFor: "Border bottom-left radius input icon",
    usedIn: ["property-icons.ts", "box-radius.tsx"],
    render: radix(CornerBottomLeftIcon),
  },
  {
    name: "CornerBottomRightIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Border & Corner Controls",
    usedFor: "Border bottom-right radius input icon",
    usedIn: ["property-icons.ts", "box-radius.tsx"],
    render: radix(CornerBottomRightIcon),
  },

  // ── Opacity & Shadow Controls ──────────────────────────────────────────────
  {
    name: "OpacityIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Opacity & Shadow Controls",
    usedFor: "Opacity slider icon",
    usedIn: ["property-icons.ts", "opacity-slider.tsx", "controls-gallery.tsx"],
    render: radix(OpacityIcon),
  },
  {
    name: "ShadowIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Opacity & Shadow Controls",
    usedFor: "Box shadow picker icon",
    usedIn: ["property-icons.ts", "shadow-picker.tsx"],
    render: radix(ShadowIcon),
  },

  // ── Overflow & Position Controls ───────────────────────────────────────────
  {
    name: "SquareArrowRightExit",
    library: "lucide",
    importPath: "lucide-react",
    category: "Overflow & Position Controls",
    usedFor: "Overflow property icon (content exiting container)",
    usedIn: ["property-icons.ts"],
    render: lucide(SquareArrowRightExit),
  },
  {
    name: "MoveIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Overflow & Position Controls",
    usedFor: "Position offset (top/right/bottom/left) scale input icon",
    usedIn: ["property-icons.ts"],
    render: radix(MoveIcon),
  },
  {
    name: "Crosshair",
    library: "lucide",
    importPath: "lucide-react",
    category: "Overflow & Position Controls",
    usedFor: "Position absolute option in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: lucide(Crosshair),
  },
  {
    name: "Pin",
    library: "lucide",
    importPath: "lucide-react",
    category: "Overflow & Position Controls",
    usedFor: "Position fixed option in segmented control",
    usedIn: ["computed-property-panel.tsx"],
    render: lucide(Pin),
  },

  // ── Scale Input Mode Toggles ───────────────────────────────────────────────
  {
    name: "CodeIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Scale Input Mode Toggles",
    usedFor: "Switch to arbitrary/code value mode in scale input",
    usedIn: ["scale-input.tsx"],
    render: radix(CodeIcon),
  },
  {
    name: "TokensIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Scale Input Mode Toggles",
    usedFor: "Switch to token/scale value mode in scale input",
    usedIn: ["scale-input.tsx"],
    render: radix(TokensIcon),
  },
  {
    name: "MagnifyingGlassIcon",
    library: "radix",
    importPath: "@radix-ui/react-icons",
    category: "Scale Input Mode Toggles",
    usedFor: "Search/filter icon inside select dropdown",
    usedIn: ["select.tsx"],
    render: radix(MagnifyingGlassIcon),
  },
];

// Custom inline SVG icons for position segmented control
const CUSTOM_ICONS: {
  name: string;
  category: string;
  usedFor: string;
  usedIn: string[];
  svgSource: string;
}[] = [
  {
    name: "StaticIcon",
    category: "Overflow & Position Controls",
    usedFor: "Position static option — default document flow (box with text lines)",
    usedIn: ["computed-property-panel.tsx"],
    svgSource: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="3" width="10" height="8" rx="1"/><line x1="4" y1="6" x2="10" y2="6"/><line x1="4" y1="8.5" x2="8" y2="8.5"/></svg>`,
  },
  {
    name: "RelativeIcon",
    category: "Overflow & Position Controls",
    usedFor: "Position relative option — offset from normal position (dashed original + solid moved)",
    usedIn: ["computed-property-panel.tsx"],
    svgSource: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="3" width="8" height="8" rx="1" stroke-dasharray="2 2"/><rect x="4.5" y="1.5" width="8" height="8" rx="1"/></svg>`,
  },
  {
    name: "StickyIcon",
    category: "Overflow & Position Controls",
    usedFor: "Position sticky option — pinned header with scrollable body (solid bar + dashed body)",
    usedIn: ["computed-property-panel.tsx"],
    svgSource: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="1.5" width="10" height="3" rx="0.75"/><rect x="2" y="6" width="10" height="6.5" rx="1" stroke-dasharray="2 2"/></svg>`,
  },
];

// ─── SVG Source Helper ───────────────────────────────────────────────────────

function getSvgSource(entry: IconEntry): string {
  const markup = renderToStaticMarkup(entry.render());
  return markup
    .replace(/></g, ">\n  <")
    .replace(/<\/svg>/, "\n</svg>")
    .replace(/^\s*</, "<");
}

// ─── Components ──────────────────────────────────────────────────────────────

function LibraryBadge({ library }: { library: "radix" | "lucide" | "custom" }) {
  const colors = {
    radix: "bg-violet-100 text-violet-800 border-violet-200",
    lucide: "bg-sky-100 text-sky-800 border-sky-200",
    custom: "bg-amber-100 text-amber-800 border-amber-200",
  };
  const labels = {
    radix: "@radix-ui/react-icons",
    lucide: "lucide-react",
    custom: "Custom SVG",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono rounded border ${colors[library]}`}>
      {labels[library]}
    </span>
  );
}

function SvgSourceBlock({ source, forceOpen }: { source: string; forceOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const isOpen = forceOpen || open;
  return (
    <div className="mt-2">
      {!forceOpen && (
        <button
          onClick={() => setOpen(!open)}
          className="text-[11px] font-mono text-ink2 hover:text-ink underline cursor-pointer"
        >
          {isOpen ? "Hide SVG source" : "Show SVG source"}
        </button>
      )}
      {isOpen && (
        <pre className="mt-1 p-2 bg-zinc-100 border border-edge rounded text-[11px] font-mono text-ink2 overflow-x-auto whitespace-pre-wrap break-all">
          {source}
        </pre>
      )}
    </div>
  );
}

function IconCardWithExpand({ entry, forceExpand }: { entry: IconEntry; forceExpand: boolean }) {
  const svgSource = getSvgSource(entry);
  return (
    <div className="flex gap-4 items-start py-3 px-4 border border-edge rounded-lg hover:border-edge-subtle hover:bg-raised/50 transition-colors">
      <div className="shrink-0 w-10 h-10 rounded-md bg-zinc-900 text-white flex items-center justify-center">
        {entry.render()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold text-ink">{entry.name}</span>
          <LibraryBadge library={entry.library} />
        </div>
        <p className="text-xs text-ink2 mt-0.5">{entry.usedFor}</p>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <span className="text-[10px] text-ink3 uppercase tracking-wide">Used in:</span>
          {entry.usedIn.map((f) => (
            <span key={f} className="text-[10px] font-mono text-ink2 bg-muted px-1 py-0.5 rounded">
              {f}
            </span>
          ))}
        </div>
        <SvgSourceBlock source={svgSource} forceOpen={forceExpand} />
      </div>
    </div>
  );
}

function CustomIconCard({ entry }: { entry: (typeof CUSTOM_ICONS)[number] }) {
  return (
    <div className="flex gap-4 items-start py-3 px-4 border border-edge rounded-lg hover:border-edge-subtle hover:bg-raised/50 transition-colors">
      <div
        className="shrink-0 w-10 h-10 rounded-md bg-zinc-900 text-white flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: entry.svgSource }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-semibold text-ink">{entry.name}</span>
          <LibraryBadge library="custom" />
        </div>
        <p className="text-xs text-ink2 mt-0.5">{entry.usedFor}</p>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <span className="text-[10px] text-ink3 uppercase tracking-wide">Used in:</span>
          {entry.usedIn.map((f) => (
            <span key={f} className="text-[10px] font-mono text-ink2 bg-muted px-1 py-0.5 rounded">
              {f}
            </span>
          ))}
        </div>
        <pre className="mt-2 p-2 bg-zinc-100 border border-edge rounded text-[11px] font-mono text-ink2 overflow-x-auto whitespace-pre-wrap break-all">
          {entry.svgSource}
        </pre>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function IconReferencePage() {
  const [filter, setFilter] = useState("");
  const [expandAll, setExpandAll] = useState(false);

  // Group by category
  const categories = ICONS.reduce<Record<string, IconEntry[]>>((acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  }, {});

  const categoryOrder = Object.keys(categories);

  const lowerFilter = filter.toLowerCase();
  const filteredCategories = categoryOrder
    .map((cat) => ({
      name: cat,
      icons: categories[cat].filter(
        (e) =>
          !filter ||
          e.name.toLowerCase().includes(lowerFilter) ||
          e.usedFor.toLowerCase().includes(lowerFilter) ||
          e.usedIn.some((f) => f.toLowerCase().includes(lowerFilter)) ||
          e.category.toLowerCase().includes(lowerFilter),
      ),
    }))
    .filter((c) => c.icons.length > 0);

  const filteredCustom = CUSTOM_ICONS.filter(
    (e) =>
      !filter ||
      e.name.toLowerCase().includes(lowerFilter) ||
      e.usedFor.toLowerCase().includes(lowerFilter) ||
      e.category.toLowerCase().includes(lowerFilter),
  );

  const totalCount = ICONS.length + CUSTOM_ICONS.length;
  const radixCount = ICONS.filter((e) => e.library === "radix").length;
  const lucideCount = ICONS.filter((e) => e.library === "lucide").length;
  const customCount = CUSTOM_ICONS.length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 font-sans">
      <h1 className="text-2xl font-bold text-ink">Icon Reference</h1>
      <p className="text-sm text-ink2 mt-1">
        Property editing controls and section headers used in the{" "}
        <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">@designtools/surface</code> editor.
      </p>

      {/* Summary */}
      <div className="mt-6 p-4 bg-raised border border-edge rounded-lg text-sm text-ink2">
        <p>
          <strong className="text-ink">{totalCount} icons</strong> from{" "}
          <strong className="text-ink">3 sources</strong>:
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            <LibraryBadge library="radix" /> — {radixCount} icons. 15&times;15 viewBox, fill-based.{" "}
            <a href="https://www.radix-ui.com/icons" className="underline text-sel" target="_blank" rel="noreferrer">
              radix-ui.com/icons
            </a>
          </li>
          <li>
            <LibraryBadge library="lucide" /> — {lucideCount} icons. 24&times;24 viewBox, stroke-based (strokeWidth 1.5).{" "}
            <a href="https://lucide.dev/icons" className="underline text-sel" target="_blank" rel="noreferrer">
              lucide.dev/icons
            </a>
          </li>
          <li>
            <LibraryBadge library="custom" /> — {customCount} icons. Inline SVGs in{" "}
            <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono">computed-property-panel.tsx</code>{" "}
            for position indicators.
          </li>
        </ul>
      </div>

      {/* LLM note */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <strong>For LLMs:</strong> Click &ldquo;Show SVG source&rdquo; on any icon to see its full SVG markup,
        or use &ldquo;Expand all SVG sources&rdquo; to reveal all at once.
        Custom inline SVGs always show their source.
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, usage, file, or category..."
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-edge rounded-lg bg-white placeholder:text-ink3 focus:outline-none focus:ring-2 focus:ring-sel/30 focus:border-sel"
        />
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="px-3 py-2 text-xs font-medium border border-edge rounded-lg bg-white hover:bg-raised transition-colors"
        >
          {expandAll ? "Collapse all SVG sources" : "Expand all SVG sources"}
        </button>
      </div>

      {/* Icon listing */}
      <div className="mt-8 space-y-10">
        {filteredCategories.map(({ name, icons }) => (
          <section key={name}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink3 mb-3 border-b border-edge pb-1">
              {name}
              <span className="ml-2 text-ink3/60 font-normal normal-case tracking-normal">({icons.length})</span>
            </h2>
            <div className="space-y-2">
              {icons.map((entry) => (
                <IconCardWithExpand key={entry.name} entry={entry} forceExpand={expandAll} />
              ))}
            </div>
          </section>
        ))}

        {filteredCustom.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink3 mb-3 border-b border-edge pb-1">
              Custom Inline SVGs (Position)
              <span className="ml-2 text-ink3/60 font-normal normal-case tracking-normal">({filteredCustom.length})</span>
            </h2>
            <div className="space-y-2">
              {filteredCustom.map((entry) => (
                <CustomIconCard key={entry.name} entry={entry} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 pt-6 border-t border-edge text-xs text-ink3">
        <p>
          Source:{" "}
          <code className="bg-muted px-1 py-0.5 rounded font-mono">packages/surface/src/client/components/</code>
        </p>
        <p className="mt-1">
          Not shown: toolbar/chrome icons, navigation chevrons, generic action icons (close, check, trash, etc.),
          and panel structure icons. These are used in the editor but not on property controls.
        </p>
      </footer>
    </div>
  );
}
