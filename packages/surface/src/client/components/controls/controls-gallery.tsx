/**
 * Dev-only gallery panel that renders every shared control side-by-side
 * for visual review. Import and render <ControlsGallery /> in the editor.
 */
import { useState } from "react";
import {
  WidthIcon,
  OpacityIcon,
  FontSizeIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  TextAlignJustifyIcon,
  PaddingIcon,
  MarginIcon,
} from "@radix-ui/react-icons";
import { StudioSelect } from "./select.js";
import { ScrubInput } from "./scrub-input.js";
import { SegmentedIcons } from "./segmented-icons.js";
import { SliderInput } from "./slider-input.js";
import { PropLabel, SubSectionLabel } from "./prop-label.js";
import { ScaleInput } from "./scale-input.js";
import { OpacitySlider } from "./opacity-slider.js";
import { KeywordControl } from "./keyword-control.js";
import { ColorInput, ColorInputSwatch } from "./color-input.js";
import { ShadowPicker } from "./shadow-picker.js";
import { GradientPicker } from "./gradient-picker.js";
import { BoxSpacingControl } from "./box-spacing.js";
import { GridInputDemo } from "./grid-input.js";
import type { UnifiedProperty } from "../../lib/computed-styles.js";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--studio-text-dimmed)",
          marginBottom: 8,
          borderBottom: "1px solid var(--studio-border-subtle)",
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 9,
          color: "var(--studio-text-dimmed)",
          width: 80,
          flexShrink: 0,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// Mock UnifiedProperty for gallery demos
function mockProp(overrides: Partial<UnifiedProperty>): UnifiedProperty {
  return {
    cssProperty: "display",
    label: "Display",
    category: "layout",
    controlType: "keyword",
    source: "class",
    tailwindValue: null,
    fullClass: null,
    computedValue: "block",
    inherited: false,
    tokenMatch: null,
    hasValue: true,
    flexGridOnly: false,
    authoredValue: null,
    isFunction: false,
    functionName: null,
    ...overrides,
  };
}

export function ControlsGallery() {
  const [selectVal, setSelectVal] = useState("flex");
  const [groupSelectVal, setGroupSelectVal] = useState("sm");
  const [scrubVal, setScrubVal] = useState("16px");
  const [scrubRemVal, setScrubRemVal] = useState("1.5rem");
  const [segVal, setSegVal] = useState("left");
  const [sliderVal, setSliderVal] = useState(50);
  const [sliderSmall, setSliderSmall] = useState(4);
  const [colorVal, setColorVal] = useState("rgb(59 130 246)");
  const [colorVal2, setColorVal2] = useState("#8b5cf6");
  const [kwValue, setKwValue] = useState("flex");

  const noop = () => {};

  return (
    <div
      style={{
        padding: 16,
        background: "var(--studio-surface)",
        color: "var(--studio-text)",
        fontFamily: "system-ui, sans-serif",
        maxWidth: 340,
        overflow: "auto",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 16,
          color: "var(--studio-text)",
        }}
      >
        Controls Gallery
      </div>

      {/* PropLabel / SubSectionLabel */}
      <Section title="Labels">
        <PropLabel label="Font Size" />
        <PropLabel label="Color" inherited />
        <SubSectionLabel label="Padding" />
      </Section>

      {/* StudioSelect */}
      <Section title="StudioSelect">
        <Row label="flat options">
          <StudioSelect
            value={selectVal}
            onChange={setSelectVal}
            options={[
              { value: "block", label: "block" },
              { value: "flex", label: "flex" },
              { value: "grid", label: "grid" },
              { value: "inline", label: "inline" },
              { value: "none", label: "none" },
            ]}
          />
        </Row>
        <Row label="with icon">
          <StudioSelect
            icon={TextAlignLeftIcon}
            tooltip="text-align"
            value={segVal}
            onChange={setSegVal}
            options={[
              { value: "left" },
              { value: "center" },
              { value: "right" },
              { value: "justify" },
            ]}
          />
        </Row>
        <Row label="grouped">
          <StudioSelect
            value={groupSelectVal}
            onChange={setGroupSelectVal}
            groups={[
              {
                label: "Small",
                options: [
                  { value: "xs", label: "xs" },
                  { value: "sm", label: "sm" },
                ],
              },
              {
                label: "Large",
                options: [
                  { value: "lg", label: "lg" },
                  { value: "xl", label: "xl" },
                  { value: "2xl", label: "2xl" },
                ],
              },
            ]}
          />
        </Row>
      </Section>

      {/* ScrubInput */}
      <Section title="ScrubInput">
        <Row label="with icon">
          <ScrubInput
            icon={WidthIcon}
            value={scrubVal}
            tooltip="Width"
            onCommit={setScrubVal}
          />
        </Row>
        <Row label="rem value">
          <ScrubInput
            icon={FontSizeIcon}
            value={scrubRemVal}
            tooltip="Font size"
            onCommit={setScrubRemVal}
          />
        </Row>
        <Row label="label only">
          <ScrubInput
            label="H"
            value="200px"
            onCommit={noop}
          />
        </Row>
      </Section>

      {/* ScaleInput */}
      <Section title="ScaleInput">
        <Row label="spacing">
          <ScaleInput
            icon={PaddingIcon}
            value="4"
            computedValue="16px"
            currentClass="p-4"
            scale={["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6", "8", "10", "12"]}
            prefix="p"
            cssProp="padding"
            onCommitClass={noop}
          />
        </Row>
        <Row label="font size">
          <ScaleInput
            icon={FontSizeIcon}
            value="lg"
            computedValue="18px"
            currentClass="text-lg"
            scale={["xs", "sm", "base", "lg", "xl", "2xl", "3xl"]}
            prefix="text"
            cssProp="font-size"
            onCommitClass={noop}
          />
        </Row>
      </Section>

      {/* SegmentedIcons */}
      <Section title="SegmentedIcons">
        <Row label="icons">
          <SegmentedIcons
            value={segVal}
            onChange={setSegVal}
            options={[
              { value: "left", icon: TextAlignLeftIcon, tooltip: "Left" },
              { value: "center", icon: TextAlignCenterIcon, tooltip: "Center" },
              { value: "right", icon: TextAlignRightIcon, tooltip: "Right" },
              { value: "justify", icon: TextAlignJustifyIcon, tooltip: "Justify" },
            ]}
          />
        </Row>
        <Row label="labels">
          <SegmentedIcons
            value="auto"
            onChange={noop}
            options={[
              { value: "auto", label: "auto" },
              { value: "fixed", label: "fixed" },
              { value: "scroll", label: "scroll" },
            ]}
          />
        </Row>
      </Section>

      {/* SliderInput */}
      <Section title="SliderInput">
        <Row label="with icon">
          <SliderInput
            icon={OpacityIcon}
            tooltip="Opacity"
            value={sliderVal}
            min={0}
            max={100}
            unit="%"
            onChange={setSliderVal}
          />
        </Row>
        <Row label="no icon">
          <SliderInput
            value={sliderSmall}
            min={0}
            max={50}
            unit="px"
            onChange={setSliderSmall}
          />
        </Row>
      </Section>

      {/* OpacitySlider */}
      <Section title="OpacitySlider">
        <Row label="opacity">
          <OpacitySlider
            value="0.75"
            scale={["0", "5", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55", "60", "65", "70", "75", "80", "85", "90", "95", "100"]}
            onPreview={noop}
            onCommitClass={noop}
          />
        </Row>
      </Section>

      {/* KeywordControl (domain wrapper: auto-resolves icon + options from CSS property) */}
      <Section title="KeywordControl">
        <Row label="display">
          <KeywordControl
            prop={mockProp({
              cssProperty: "display",
              computedValue: kwValue,
              controlType: "keyword",
            })}
            onPreviewInlineStyle={(_p, v) => setKwValue(v)}
            onCommitClass={noop}
          />
        </Row>
        <Row label="text-align">
          <KeywordControl
            prop={mockProp({
              cssProperty: "text-align",
              label: "Align",
              computedValue: "left",
              controlType: "keyword",
            })}
            onPreviewInlineStyle={noop}
            onCommitClass={noop}
          />
        </Row>
      </Section>

      {/* ColorInput */}
      <Section title="ColorInput">
        <Row label="custom only">
          <ColorInput color={colorVal} onChange={setColorVal} />
        </Row>
        <Row label="with tokens">
          <ColorInput
            color="oklch(0.637 0.237 25.331)"
            label="primary"
            tabs="both"
            defaultTab="tokens"
            tokens={[
              { name: "primary", value: "oklch(0.637 0.237 25.331)" },
              { name: "secondary", value: "oklch(0.551 0.135 264.695)" },
              { name: "accent", value: "oklch(0.7 0.17 142)" },
            ]}
            activeToken="primary"
            onSelectToken={noop}
          />
        </Row>
        <Row label="token edit">
          <ColorInput
            color="oklch(0.637 0.237 25.331)"
            label="primary"
            tabs="custom"
            tokenName="--primary"
            contrastToken={{ name: "--primary-foreground", value: "oklch(0.982 0.016 73.684)" }}
            onChange={noop}
            onSave={noop}
          />
        </Row>
        <Row label="swatch">
          <ColorInputSwatch color={colorVal2} onChange={setColorVal2} />
        </Row>
      </Section>

      {/* ShadowPicker */}
      <Section title="ShadowPicker">
        <Row label="scale value">
          <ShadowPicker
            prop={mockProp({
              cssProperty: "box-shadow",
              label: "Box Shadow",
              computedValue: "0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1)",
              tailwindValue: "md",
              fullClass: "shadow-md",
              controlType: "text",
            })}
            shadows={[
              { name: "drop-glow", value: "0 0 12px rgba(59,130,246,0.5)", cssVariable: "--shadow-glow" },
            ]}
            scale={["2xs", "xs", "sm", "", "md", "lg", "xl", "2xl"]}
            elementClassName="shadow-md rounded-lg"
            onPreviewInlineStyle={noop}
            onCommitClass={noop}
          />
        </Row>
        <Row label="none">
          <ShadowPicker
            prop={mockProp({
              cssProperty: "box-shadow",
              label: "Box Shadow",
              computedValue: "none",
              tailwindValue: null,
              fullClass: null,
              controlType: "text",
            })}
            scale={["2xs", "xs", "sm", "", "md", "lg", "xl", "2xl"]}
            elementClassName=""
            onPreviewInlineStyle={noop}
            onCommitClass={noop}
          />
        </Row>
      </Section>

      {/* GradientPicker */}
      <Section title="GradientPicker">
        <Row label="with gradient">
          <GradientPicker
            prop={mockProp({
              cssProperty: "background-image",
              label: "Gradient",
              computedValue: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              controlType: "text",
            })}
            gradients={[
              { name: "hero-gradient", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", cssVariable: "--gradient-hero" },
              { name: "sunset", value: "linear-gradient(to right, #f12711, #f5af19)", cssVariable: "--gradient-sunset" },
            ]}
            elementClassName="bg-[image:var(--gradient-hero)]"
            onPreviewInlineStyle={noop}
            onCommitClass={noop}
          />
        </Row>
        <Row label="none">
          <GradientPicker
            prop={null}
            gradients={[
              { name: "hero-gradient", value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", cssVariable: "--gradient-hero" },
            ]}
            elementClassName=""
            onPreviewInlineStyle={noop}
            onCommitClass={noop}
          />
        </Row>
      </Section>

      {/* GridInput (with Display segmented) */}
      <Section title="GridInput">
        <GridInputDemo />
      </Section>

      {/* BoxSpacingControl */}
      <Section title="BoxSpacingControl">
        <BoxSpacingControl
          box="padding"
          icon={PaddingIcon}
          activeProps={[
            mockProp({ cssProperty: "padding", computedValue: "16px", tailwindValue: "4", fullClass: "p-4" }),
          ]}
          allProperties={[
            mockProp({ cssProperty: "padding-top", computedValue: "16px", tailwindValue: "4" }),
            mockProp({ cssProperty: "padding-right", computedValue: "16px", tailwindValue: "4" }),
            mockProp({ cssProperty: "padding-bottom", computedValue: "16px", tailwindValue: "4" }),
            mockProp({ cssProperty: "padding-left", computedValue: "16px", tailwindValue: "4" }),
          ]}
          computedStyles={{
            "padding-top": "16px",
            "padding-right": "16px",
            "padding-bottom": "16px",
            "padding-left": "16px",
          }}
          onPreviewInlineStyle={noop}
          onCommitClass={noop}
        />
        <div style={{ height: 8 }} />
        <BoxSpacingControl
          box="margin"
          icon={MarginIcon}
          activeProps={[
            mockProp({ cssProperty: "margin-top", computedValue: "8px", tailwindValue: "2" }),
            mockProp({ cssProperty: "margin-bottom", computedValue: "24px", tailwindValue: "6" }),
          ]}
          allProperties={[
            mockProp({ cssProperty: "margin-top", computedValue: "8px", tailwindValue: "2" }),
            mockProp({ cssProperty: "margin-right", computedValue: "0px" }),
            mockProp({ cssProperty: "margin-bottom", computedValue: "24px", tailwindValue: "6" }),
            mockProp({ cssProperty: "margin-left", computedValue: "0px" }),
          ]}
          computedStyles={{
            "margin-top": "8px",
            "margin-right": "0px",
            "margin-bottom": "24px",
            "margin-left": "0px",
          }}
          onPreviewInlineStyle={noop}
          onCommitClass={noop}
        />
      </Section>
    </div>
  );
}
