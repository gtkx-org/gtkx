import { type Context, FontSlant, FontWeight, Pattern } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDrawingArea, GtkScale, x } from "@gtkx/react";
import { useCallback, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./mask.tsx?raw";

const MaskDemo = () => {
    const [progress, setProgress] = useState(0.5);

    const drawMask = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            const gradient = Pattern.createLinear(width * progress - width * 0.5, 0, width * progress + width * 0.5, height)
                .addColorStopRgb(0, 0.95, 0.26, 0.21)
                .addColorStopRgb(0.33, 1.0, 0.76, 0.03)
                .addColorStopRgb(0.66, 0.3, 0.69, 0.31)
                .addColorStopRgb(1, 0.13, 0.59, 0.95);

            cr.save();

            cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.BOLD).setFontSize(Math.min(width, height) * 0.25);

            const text = "MASK";
            const extents = cr.textExtents(text);
            const textX = (width - extents.width) / 2 - extents.xBearing;
            const textY = (height - extents.height) / 2 - extents.yBearing;

            cr.moveTo(textX, textY).textPath(text).clip().setSource(gradient).paint().restore();
        },
        [progress],
    );

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkDrawingArea hexpand vexpand onDraw={drawMask} />
            <GtkScale orientation={Gtk.Orientation.HORIZONTAL}>
                <x.Adjustment
                    value={progress}
                    lower={0}
                    upper={1}
                    stepIncrement={0.1}
                    pageIncrement={0.1}
                    onValueChanged={setProgress}
                />
            </GtkScale>
        </GtkBox>
    );
};

export const maskDemo: Demo = {
    id: "mask",
    title: "Masking",
    description: "Demonstrates mask nodes. This demo uses a text node as mask for an animated linear gradient.",
    keywords: ["mask"],
    component: MaskDemo,
    sourceCode,
};
