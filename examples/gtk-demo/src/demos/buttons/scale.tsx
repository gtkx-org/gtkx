import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./scale.tsx?raw";

const ScaleDemo = () => {
    const [horizontalValue, setHorizontalValue] = useState(50);
    const [verticalValue, setVerticalValue] = useState(25);
    const [markedValue, setMarkedValue] = useState(0);

    const horizontalAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);
    const verticalAdjustment = useMemo(() => new Gtk.Adjustment(25, 0, 100, 1, 10, 0), []);
    const markedAdjustment = useMemo(() => new Gtk.Adjustment(0, -10, 10, 1, 5, 0), []);
    const brightnessAdjustment = useMemo(() => new Gtk.Adjustment(50, 0, 100, 1, 10, 0), []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Scale" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkScale is a slider widget for selecting a numeric value from a range. It can be horizontal or vertical and supports marks for indicating specific values."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Horizontal Scale">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkScale
                        onValueChanged={(scale: Gtk.Range) => setHorizontalValue(scale.getValue())}
                        adjustment={horizontalAdjustment}
                        drawValue
                        valuePos={Gtk.PositionType.TOP}
                        hexpand
                    />
                    <GtkLabel
                        label={`Value: ${Math.round(horizontalValue)}`}
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Vertical Scale">
                <GtkBox spacing={24} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                    <GtkScale
                        orientation={Gtk.Orientation.VERTICAL}
                        onValueChanged={(scale: Gtk.Range) => setVerticalValue(scale.getValue())}
                        adjustment={verticalAdjustment}
                        drawValue
                        valuePos={Gtk.PositionType.LEFT}
                        inverted
                        heightRequest={150}
                    />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} valign={Gtk.Align.CENTER}>
                        <GtkLabel label="Volume Control" cssClasses={["heading"]} />
                        <GtkLabel label={`Level: ${Math.round(verticalValue)}%`} cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Scale with Origin">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkScale
                        onValueChanged={(scale: Gtk.Range) => setMarkedValue(scale.getValue())}
                        adjustment={markedAdjustment}
                        drawValue
                        hasOrigin
                        hexpand
                    />
                    <GtkLabel
                        label={`Temperature offset: ${markedValue > 0 ? "+" : ""}${Math.round(markedValue)}`}
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Minimal Scale">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Brightness:" halign={Gtk.Align.START} />
                        <GtkScale adjustment={brightnessAdjustment} hexpand />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const scaleDemo: Demo = {
    id: "scale",
    title: "Scales",
    description: "Slider widget for selecting numeric values",
    keywords: ["scale", "slider", "range", "GtkScale", "horizontal", "vertical", "marks", "value"],
    component: ScaleDemo,
    sourceCode,
};
