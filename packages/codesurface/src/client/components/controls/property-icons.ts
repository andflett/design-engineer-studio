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
  UnderlineIcon,
  LetterCaseUppercaseIcon,
  BorderWidthIcon,
  CornerTopLeftIcon,
  CornerTopRightIcon,
  CornerBottomLeftIcon,
  CornerBottomRightIcon,
  OpacityIcon,
  ShadowIcon,
  LayersIcon,
  MoveIcon,
  ColumnSpacingIcon,
  RowSpacingIcon,
} from "@radix-ui/react-icons";
import { createElement } from "react";
import { SquareArrowRightExit } from "lucide-react";

function OverflowIcon({ style }: { style?: React.CSSProperties }) {
  return createElement(SquareArrowRightExit, { style, strokeWidth: 1.5, size: 12 });
}

const ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  "width": WidthIcon,
  "height": HeightIcon,
  "min-width": WidthIcon,
  "min-height": HeightIcon,
  "max-width": WidthIcon,
  "max-height": HeightIcon,
  "padding-top": PaddingIcon,
  "padding-right": PaddingIcon,
  "padding-bottom": PaddingIcon,
  "padding-left": PaddingIcon,
  "margin-top": MarginIcon,
  "margin-right": MarginIcon,
  "margin-bottom": MarginIcon,
  "margin-left": MarginIcon,
  "gap": ColumnSpacingIcon,
  "row-gap": RowSpacingIcon,
  "column-gap": ColumnSpacingIcon,
  "font-family": FontFamilyIcon,
  "font-size": FontSizeIcon,
  "font-weight": FontBoldIcon,
  "line-height": LineHeightIcon,
  "letter-spacing": LetterSpacingIcon,
  "text-align": TextAlignLeftIcon,
  "text-decoration": UnderlineIcon,
  "text-transform": LetterCaseUppercaseIcon,
  "border-top-width": BorderWidthIcon,
  "border-right-width": BorderWidthIcon,
  "border-bottom-width": BorderWidthIcon,
  "border-left-width": BorderWidthIcon,
  "border-top-left-radius": CornerTopLeftIcon,
  "border-top-right-radius": CornerTopRightIcon,
  "border-bottom-left-radius": CornerBottomLeftIcon,
  "border-bottom-right-radius": CornerBottomRightIcon,
  "opacity": OpacityIcon,
  "box-shadow": ShadowIcon,
  "overflow": OverflowIcon,
  "z-index": LayersIcon,
  "top": MoveIcon,
  "right": MoveIcon,
  "bottom": MoveIcon,
  "left": MoveIcon,
};

export function getPropertyIcon(cssProp: string): React.ComponentType<{ style?: React.CSSProperties }> | undefined {
  return ICON_MAP[cssProp];
}
