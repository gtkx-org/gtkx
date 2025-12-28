import * as Cairo from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import { GtkBox, GtkButton, GtkDrawingArea, GtkEntry, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./textmask.tsx?raw";

const GRADIENT_PRESETS = [
    { name: "Rainbow", colors: ["#e01b24", "#ff7800", "#f6d32d", "#33d17a", "#3584e4", "#9141ac"] },
    { name: "Ocean", colors: ["#1a5fb4", "#3584e4", "#62a0ea", "#99c1f1"] },
    { name: "Sunset", colors: ["#a51d2d", "#e01b24", "#ff7800", "#f6d32d"] },
    { name: "Forest", colors: ["#1c4a1c", "#26a269", "#33d17a", "#8ff0a4"] },
    { name: "Fire", colors: ["#a51d2d", "#e01b24", "#ff7800", "#f6d32d", "#fff8e5"] },
];

const TextmaskDemo = () => {
    const [text, setText] = useState("GTKX");
    const [fontSize, setFontSize] = useState(120);
    const [gradientIndex, setGradientIndex] = useState(0);
    const [animationOffset, setAnimationOffset] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);

    const fontSizeAdjustment = useMemo(() => new Gtk.Adjustment(120, 48, 200, 4, 16, 0), []);

    const currentGradient = GRADIENT_PRESETS[gradientIndex] ?? GRADIENT_PRESETS[0];

    // Animation loop
    useEffect(() => {
        if (!isAnimating) return;

        const interval = setInterval(() => {
            setAnimationOffset((prev) => (prev + 0.02) % 1);
        }, 50);

        return () => clearInterval(interval);
    }, [isAnimating]);

    useEffect(() => {
        const drawingArea = drawingAreaRef.current;
        if (!drawingArea) return;

        const drawFunc = (_area: Gtk.DrawingArea, cr: Cairo.Context, width: number, height: number) => {
            // Clear background
            Cairo.setSourceRgba(cr, 0.12, 0.12, 0.12, 1);
            Cairo.paint(cr);

            if (!text.trim()) return;

            // Create Pango layout for text
            const layout = PangoCairo.createLayout(cr);
            const fontDesc = Pango.FontDescription.fromString(`Sans Bold ${fontSize}px`);
            layout.setFontDescription(fontDesc);
            layout.setText(text, -1);

            // Get text dimensions
            const logicalRect = new Pango.Rectangle();
            layout.getPixelExtents(undefined, logicalRect);
            const textWidth = logicalRect.width;
            const textHeight = logicalRect.height;

            // Center the text
            const x = (width - textWidth) / 2;
            const y = (height - textHeight) / 2;

            Cairo.save(cr);
            Cairo.translate(cr, x, y);

            // Create gradient pattern
            const gradient = Cairo.patternCreateLinear(
                animationOffset * textWidth - textWidth * 0.5,
                0,
                animationOffset * textWidth + textWidth * 0.5,
                textHeight,
            );

            const colors = currentGradient?.colors ?? ["#ffffff"];
            const colorCount = colors.length;
            for (let i = 0; i < colorCount; i++) {
                const color = colors[i];
                if (!color) continue;
                const stop = i / (colorCount - 1);
                const [r, g, b] = hexToRgb(color);
                Cairo.patternAddColorStopRgba(gradient, stop, r, g, b, 1);
            }

            // Use text as a clip mask
            PangoCairo.layoutPath(cr, layout);
            Cairo.clip(cr);

            // Fill with gradient
            Cairo.setSource(cr, gradient);
            Cairo.paint(cr);

            Cairo.restore(cr);

            // Draw outline around text
            Cairo.save(cr);
            Cairo.translate(cr, x, y);
            PangoCairo.layoutPath(cr, layout);
            Cairo.setSourceRgba(cr, 1, 1, 1, 0.3);
            Cairo.setLineWidth(cr, 1);
            Cairo.stroke(cr);
            Cairo.restore(cr);

            Cairo.patternDestroy(gradient);
        };

        drawingArea.setDrawFunc(drawFunc);
    }, [text, fontSize, animationOffset, currentGradient?.colors]);

    // Trigger redraw when parameters change
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
            <GtkLabel label="Text Mask" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Text can be used as a clipping mask to reveal gradients, images, or other content. This technique uses Cairo's clip path with Pango text layouts."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Preview">
                <GtkDrawingArea ref={drawingAreaRef} contentWidth={500} contentHeight={200} hexpand />
            </GtkFrame>

            <GtkFrame label="Text">
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkLabel label="Text:" />
                    <GtkEntry text={text} hexpand onChanged={(entry) => setText(entry.getText())} />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Gradient">
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={8}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                    halign={Gtk.Align.CENTER}
                >
                    {GRADIENT_PRESETS.map((preset, index) => (
                        <GtkButton
                            key={preset.name}
                            label={preset.name}
                            cssClasses={index === gradientIndex ? ["suggested-action"] : []}
                            onClicked={() => setGradientIndex(index)}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Settings">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16}>
                        <GtkLabel label="Font Size:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale
                            orientation={Gtk.Orientation.HORIZONTAL}
                            adjustment={fontSizeAdjustment}
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(scale: Gtk.Range) => setFontSize(scale.getValue())}
                        />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={16} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={isAnimating ? "Stop Animation" : "Start Animation"}
                            cssClasses={isAnimating ? ["destructive-action"] : ["suggested-action"]}
                            onClicked={() => setIsAnimating(!isAnimating)}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkLabel
                label="Uses PangoCairo.layoutPath() to create a path from text, then Cairo.clip() to use it as a mask. The gradient is drawn with Cairo.patternCreateLinear()."
                wrap
                cssClasses={["dim-label", "caption"]}
                halign={Gtk.Align.START}
            />
        </GtkBox>
    );
};

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) {
        return [1, 1, 1];
    }
    return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
}

export const textmaskDemo: Demo = {
    id: "textmask",
    title: "Text Mask",
    description: "Text masking with gradient fills",
    keywords: ["text", "mask", "clip", "gradient", "cairo", "pango", "effects"],
    component: TextmaskDemo,
    sourceCode,
};
