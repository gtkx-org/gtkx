import { CallbackAnimationTarget, TimedAnimation } from "@gtkx/ffi/adw";
import { type Context, Pattern } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import { GtkBox, GtkButton, GtkDrawingArea, GtkEntry, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
    const [isAnimating, setIsAnimating] = useState(false);
    const areaRef = useRef<Gtk.DrawingArea | null>(null);
    const animationRef = useRef<TimedAnimation | null>(null);
    const offsetRef = useRef(0);

    const currentGradient = GRADIENT_PRESETS[gradientIndex] ?? GRADIENT_PRESETS[0];

    useEffect(() => {
        const area = areaRef.current;
        if (!area || !isAnimating) return;

        const target = new CallbackAnimationTarget((value: number) => {
            offsetRef.current = value;
            area.queueDraw();
        });

        const animation = new TimedAnimation(area, 0, 1, 2000, target);
        animation.setRepeatCount(0);
        animationRef.current = animation;
        animation.play();

        return () => {
            animation.reset();
        };
    }, [isAnimating]);

    const drawFunc = useCallback(
        (_area: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgba(0.12, 0.12, 0.12, 1).paint();

            if (!text.trim()) return;

            const layout = PangoCairo.createLayout(cr);
            const fontDesc = Pango.FontDescription.fromString(`Sans Bold ${fontSize}px`);
            layout.setFontDescription(fontDesc);
            layout.setText(text, -1);

            const logicalRect = new Pango.Rectangle();
            layout.getPixelExtents(undefined, logicalRect);
            const textWidth = logicalRect.getWidth();
            const textHeight = logicalRect.getHeight();

            const xPos = (width - textWidth) / 2;
            const yPos = (height - textHeight) / 2;

            cr.save().translate(xPos, yPos);

            const animationOffset = isAnimating ? offsetRef.current : 0;
            const gradient = Pattern.createLinear(
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
                gradient.addColorStopRgba(stop, r, g, b, 1);
            }

            PangoCairo.layoutPath(cr, layout);
            cr.clip();

            cr.setSource(gradient).paint();

            cr.restore();

            cr.save().translate(xPos, yPos);
            PangoCairo.layoutPath(cr, layout);
            cr.setSourceRgba(1, 1, 1, 0.3).setLineWidth(1).stroke().restore();
        },
        [text, fontSize, currentGradient?.colors, isAnimating],
    );

    const handleToggleAnimation = useCallback(() => {
        if (isAnimating) {
            animationRef.current?.reset();
        }
        setIsAnimating(!isAnimating);
    }, [isAnimating]);

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
                label="Text can be used as a clipping mask to reveal gradients, images, or other content. Animation uses GTK's native TimedAnimation API."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Preview">
                <GtkDrawingArea ref={areaRef} onDraw={drawFunc} contentWidth={500} contentHeight={200} hexpand />
            </GtkFrame>

            <GtkFrame label="Text">
                <GtkBox spacing={16} marginStart={16} marginEnd={16} marginTop={16} marginBottom={16}>
                    <GtkLabel label="Text:" />
                    <GtkEntry text={text} hexpand onChanged={(entry) => setText(entry.getText())} />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Gradient">
                <GtkBox
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
                    <GtkBox spacing={16}>
                        <GtkLabel label="Font Size:" widthRequest={80} halign={Gtk.Align.START} />
                        <GtkScale
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            value={fontSize}
                            lower={48}
                            upper={200}
                            stepIncrement={4}
                            pageIncrement={16}
                            onValueChanged={setFontSize}
                        />
                    </GtkBox>

                    <GtkBox spacing={16} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={isAnimating ? "Stop Animation" : "Start Animation"}
                            cssClasses={isAnimating ? ["destructive-action"] : ["suggested-action"]}
                            onClicked={handleToggleAnimation}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkLabel
                label="Uses PangoCairo.layoutPath() to create a path from text, then cr.clip() to use it as a mask. The gradient is drawn with Pattern.createLinear()."
                wrap
                cssClasses={["dim-label", "caption"]}
                halign={Gtk.Align.START}
            />
        </GtkBox>
    );
};

function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) {
        return [1, 1, 1];
    }
    return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
}

export const textmaskDemo: Demo = {
    id: "textmask",
    title: "Pango/Text Mask",
    description: "Text masking with gradient fills using GTK animation",
    keywords: ["text", "mask", "clip", "gradient", "cairo", "pango", "effects", "TimedAnimation"],
    component: TextmaskDemo,
    sourceCode,
};
