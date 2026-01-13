import type { Context } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import { GtkBox, GtkDrawingArea, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./rotated-text.tsx?raw";

const SAMPLE_TEXTS = ["GTKX", "React + GTK4", "Native Desktop Apps", "Linux"];

const RotatedTextDemo = () => {
    const [rotation, setRotation] = useState(0);
    const [fontSize, setFontSize] = useState(24);
    const [spacing, setSpacing] = useState(30);
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);

    const rotationAdjustment = useMemo(() => new Gtk.Adjustment(0, 0, 360, 1, 15, 0), []);
    const fontSizeAdjustment = useMemo(() => new Gtk.Adjustment(24, 12, 72, 1, 4, 0), []);
    const spacingAdjustment = useMemo(() => new Gtk.Adjustment(30, 0, 90, 5, 15, 0), []);

    useEffect(() => {
        const drawingArea = drawingAreaRef.current;
        if (!drawingArea) return;

        const drawFunc = (_area: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgba(0.1, 0.1, 0.1, 1).paint();

            const centerX = width / 2;
            const centerY = height / 2;

            const numTexts = SAMPLE_TEXTS.length;
            const angleStep = (360 / numTexts) * (Math.PI / 180);
            const baseAngle = rotation * (Math.PI / 180);

            for (let i = 0; i < numTexts; i++) {
                const text = SAMPLE_TEXTS[i];
                if (!text) continue;

                const angle = baseAngle + i * angleStep;

                cr.save();

                cr.translate(centerX, centerY)
                    .rotate(angle)
                    .translate(0, -80 - spacing);

                const layout = PangoCairo.createLayout(cr);
                const fontDesc = Pango.FontDescription.fromString(`Sans Bold ${fontSize}px`);
                layout.setFontDescription(fontDesc);
                layout.setText(text, -1);

                const logicalRect = new Pango.Rectangle();
                layout.getPixelExtents(undefined, logicalRect);
                cr.translate(-logicalRect.width / 2, -logicalRect.height / 2);

                cr.setSourceRgba(0, 0, 0, 0.5).translate(2, 2);
                PangoCairo.showLayout(cr, layout);
                cr.translate(-2, -2);

                const hue = (i / numTexts + rotation / 360) % 1;
                const [r, g, b] = hslToRgb(hue, 0.7, 0.6);
                cr.setSourceRgba(r, g, b, 1);
                PangoCairo.showLayout(cr, layout);

                cr.restore();
            }

            cr.arc(centerX, centerY, 10, 0, 2 * Math.PI)
                .setSourceRgba(1, 1, 1, 0.3)
                .fill();
        };

        drawingArea.setDrawFunc(drawFunc);
    }, [rotation, fontSize, spacing]);

    useEffect(() => {
        drawingAreaRef.current?.queueDraw();
    }, []);

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Rotated Text" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Text can be rotated and transformed using Cairo's transformation matrix. This demo shows text arranged in a circle with dynamic rotation, using Pango for text rendering."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Preview">
                <GtkDrawingArea ref={drawingAreaRef} contentWidth={400} contentHeight={350} hexpand />
            </GtkFrame>

            <GtkFrame label="Controls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={16}>
                        <GtkLabel label="Rotation:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale
                            adjustment={rotationAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(scale: Gtk.Range) => setRotation(scale.getValue())}
                        />
                    </GtkBox>

                    <GtkBox spacing={16}>
                        <GtkLabel label="Font Size:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale
                            adjustment={fontSizeAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(scale: Gtk.Range) => setFontSize(scale.getValue())}
                        />
                    </GtkBox>

                    <GtkBox spacing={16}>
                        <GtkLabel label="Spacing:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale
                            adjustment={spacingAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(scale: Gtk.Range) => setSpacing(scale.getValue())}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkLabel
                label="Uses cr.translate() and cr.rotate() for transformations, Pango.Layout for text measurement and rendering, and PangoCairo.showLayout() for drawing."
                wrap
                cssClasses={["dim-label", "caption"]}
                halign={Gtk.Align.START}
            />
        </GtkBox>
    );
};

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r, g, b];
}

export const rotatedTextDemo: Demo = {
    id: "rotated-text",
    title: "Pango/Rotated Text",
    description: "Text with rotation and transformation",
    keywords: ["text", "rotate", "transform", "cairo", "pango", "drawing", "graphics"],
    component: RotatedTextDemo,
    sourceCode,
};
