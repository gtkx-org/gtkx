import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-blendmodes.tsx?raw";

const BLEND_MODES = [
    { name: "Normal", value: "normal" },
    { name: "Multiply", value: "multiply" },
    { name: "Screen", value: "screen" },
    { name: "Overlay", value: "overlay" },
    { name: "Darken", value: "darken" },
    { name: "Lighten", value: "lighten" },
    { name: "Color Dodge", value: "color-dodge" },
    { name: "Color Burn", value: "color-burn" },
    { name: "Hard Light", value: "hard-light" },
    { name: "Soft Light", value: "soft-light" },
    { name: "Difference", value: "difference" },
    { name: "Exclusion", value: "exclusion" },
    { name: "Hue", value: "hue" },
    { name: "Saturation", value: "saturation" },
    { name: "Color", value: "color" },
    { name: "Luminosity", value: "luminosity" },
];

const COLORS = [
    { name: "Red", value: "#e01b24" },
    { name: "Orange", value: "#ff7800" },
    { name: "Yellow", value: "#f6d32d" },
    { name: "Green", value: "#33d17a" },
    { name: "Blue", value: "#3584e4" },
    { name: "Purple", value: "#9141ac" },
    { name: "Pink", value: "#ed82c2" },
];

const createBlendDemoContainerStyle = (color: string) => css`
 background: linear-gradient(135deg, ${color} 0%, shade(${color}, 0.6) 100%);
 border-radius: 12px;
 padding: 24px;
`;

const createBlendDemoImageStyle = (blendMode: string) => css`
 background-blend-mode: ${blendMode};
 border-radius: 8px;
`;

const CssBlendmodesDemo = () => {
    const [blendModeIndex, setBlendModeIndex] = useState(2); // Screen
    const [colorIndex, setColorIndex] = useState(4); // Blue

    const blendMode = BLEND_MODES[blendModeIndex]?.value ?? "normal";
    const color = COLORS[colorIndex]?.value ?? "#3584e4";

    const blendDemoContainerStyle = createBlendDemoContainerStyle(color);
    const blendDemoImageStyle = createBlendDemoImageStyle(blendMode);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="CSS Blend Modes" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="CSS blend modes determine how colors blend when layers overlap. GTK supports standard CSS blend modes like multiply, screen, overlay, and more. These are useful for creating visual effects and compositing."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Controls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkLabel label="Blend Mode" halign={Gtk.Align.START} cssClasses={["dim-label"]} />
                        <GtkBox spacing={4}>
                            {BLEND_MODES.slice(0, 8).map((mode, index) => (
                                <GtkButton
                                    key={mode.value}
                                    label={mode.name}
                                    cssClasses={blendModeIndex === index ? ["suggested-action"] : []}
                                    onClicked={() => setBlendModeIndex(index)}
                                />
                            ))}
                        </GtkBox>
                        <GtkBox spacing={4}>
                            {BLEND_MODES.slice(8).map((mode, index) => (
                                <GtkButton
                                    key={mode.value}
                                    label={mode.name}
                                    cssClasses={blendModeIndex === index + 8 ? ["suggested-action"] : []}
                                    onClicked={() => setBlendModeIndex(index + 8)}
                                />
                            ))}
                        </GtkBox>
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkLabel label="Overlay Color" halign={Gtk.Align.START} cssClasses={["dim-label"]} />
                        <GtkBox spacing={4}>
                            {COLORS.map((c, index) => (
                                <GtkButton
                                    key={c.value}
                                    label={c.name}
                                    cssClasses={colorIndex === index ? ["suggested-action"] : []}
                                    onClicked={() => setColorIndex(index)}
                                />
                            ))}
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Preview">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        cssClasses={[blendDemoContainerStyle]}
                        halign={Gtk.Align.CENTER}
                    >
                        <GtkImage
                            iconName="emblem-photos-symbolic"
                            pixelSize={200}
                            cssClasses={[blendDemoImageStyle]}
                        />
                    </GtkBox>

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Current mode:" cssClasses={["dim-label"]} />
                        <GtkLabel
                            label={`${BLEND_MODES[blendModeIndex]?.name} (${blendMode})`}
                            cssClasses={["heading"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="All Blend Modes">
                <GtkBox
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                    halign={Gtk.Align.CENTER}
                >
                    {BLEND_MODES.slice(0, 8).map((mode) => (
                        <GtkBox key={mode.value} orientation={Gtk.Orientation.VERTICAL} spacing={4}>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                widthRequest={60}
                                heightRequest={60}
                                cssClasses={["card"]}
                                halign={Gtk.Align.CENTER}
                            />
                            <GtkLabel label={mode.name} cssClasses={["caption", "dim-label"]} />
                        </GtkBox>
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkLabel
                label="Blend modes: normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity."
                wrap
                cssClasses={["dim-label", "caption"]}
                halign={Gtk.Align.START}
            />
        </GtkBox>
    );
};

export const cssBlendmodesDemo: Demo = {
    id: "css-blendmodes",
    title: "Theming/CSS Blend Modes",
    description: "Demonstrate CSS blend modes for compositing effects",
    keywords: ["css", "blend", "mode", "multiply", "screen", "overlay", "compositing", "mix-blend-mode"],
    component: CssBlendmodesDemo,
    sourceCode,
};
