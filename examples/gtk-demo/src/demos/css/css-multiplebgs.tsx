import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./css-multiplebgs.tsx?raw";

const PRESETS = [
    {
        name: "Gradient Stack",
        background: `
 linear-gradient(135deg, rgba(255,0,0,0.3) 0%, transparent 50%),
 linear-gradient(225deg, rgba(0,255,0,0.3) 0%, transparent 50%),
 linear-gradient(315deg, rgba(0,0,255,0.3) 0%, transparent 50%),
 linear-gradient(45deg, rgba(255,255,0,0.3) 0%, transparent 50%),
 @theme_bg_color`,
    },
    {
        name: "Radial Layers",
        background: `
 radial-gradient(circle at 20% 30%, rgba(255,0,128,0.4) 0%, transparent 40%),
 radial-gradient(circle at 80% 70%, rgba(0,200,255,0.4) 0%, transparent 40%),
 radial-gradient(circle at 50% 50%, rgba(255,200,0,0.3) 0%, transparent 60%),
 @theme_bg_color`,
    },
    {
        name: "Striped Pattern",
        background: `
 repeating-linear-gradient(
 45deg,
 transparent,
 transparent 10px,
 rgba(0,0,0,0.05) 10px,
 rgba(0,0,0,0.05) 20px
 ),
 repeating-linear-gradient(
 -45deg,
 transparent,
 transparent 10px,
 rgba(0,0,0,0.05) 10px,
 rgba(0,0,0,0.05) 20px
 ),
 linear-gradient(180deg, @accent_bg_color, shade(@accent_bg_color, 0.8))`,
    },
    {
        name: "Spotlight Effect",
        background: `
 radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.3) 0%, transparent 50%),
 linear-gradient(180deg, shade(@accent_bg_color, 1.2), shade(@accent_bg_color, 0.7))`,
    },
    {
        name: "Mesh Gradient",
        background: `
 radial-gradient(at 0% 0%, #ff6b6b 0%, transparent 50%),
 radial-gradient(at 100% 0%, #4ecdc4 0%, transparent 50%),
 radial-gradient(at 100% 100%, #45b7d1 0%, transparent 50%),
 radial-gradient(at 0% 100%, #96ceb4 0%, transparent 50%),
 #2c3e50`,
    },
];

const createMultiBgDemoStyle = (background: string, opacity: number) => css`
 background: ${background};
 opacity: ${opacity / 100};
 border-radius: 16px;
 min-height: 250px;
 transition: all 300ms ease;

 &:hover {
 transform: scale(1.02);
 }
`;

const CssMultiplebgsDemo = () => {
    const [presetIndex, setPresetIndex] = useState(0);
    const [opacity, setOpacity] = useState(100);

    const opacityAdjustment = useMemo(() => new Gtk.Adjustment(100, 0, 100, 1, 10, 0), []);

    const preset = PRESETS[presetIndex];
    const multiBgDemoStyle = createMultiBgDemoStyle(preset?.background ?? "", opacity);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Multiple Backgrounds" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="CSS allows stacking multiple background layers on a single element. Each layer can be a gradient, image, or color. Layers are drawn in order, with the first one on top."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Presets">
                <GtkBox
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                    halign={Gtk.Align.CENTER}
                >
                    {PRESETS.map((preset, index) => (
                        <GtkButton
                            key={preset.name}
                            label={preset.name}
                            cssClasses={index === presetIndex ? ["suggested-action"] : []}
                            onClicked={() => setPresetIndex(index)}
                        />
                    ))}
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
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} cssClasses={[multiBgDemoStyle]} hexpand vexpand>
                        <GtkBox
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={8}
                            halign={Gtk.Align.CENTER}
                            valign={Gtk.Align.CENTER}
                            hexpand
                            vexpand
                        >
                            <GtkLabel label={PRESETS[presetIndex]?.name ?? "Unknown"} cssClasses={["title-3"]} />
                            <GtkLabel label="Hover to see animation" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Opacity">
                <GtkBox spacing={16} marginStart={16} marginEnd={16} marginTop={16} marginBottom={16}>
                    <GtkLabel label="Opacity:" />
                    <GtkScale
                        adjustment={opacityAdjustment}
                        drawValue
                        valuePos={Gtk.PositionType.RIGHT}
                        hexpand
                        onValueChanged={(scale: Gtk.Range) => setOpacity(scale.getValue())}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="CSS Code">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel
                        label={`background: ${preset?.background?.trim() ?? ""}`}
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["monospace", "caption"]}
                        selectable
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const cssMultiplebgsDemo: Demo = {
    id: "css-multiplebgs",
    title: "Theming/Multiple Backgrounds",
    description: "Stack multiple CSS background layers",
    keywords: ["css", "background", "gradient", "layers", "multiple", "radial", "linear"],
    component: CssMultiplebgsDemo,
    sourceCode,
};
