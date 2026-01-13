import { type Context, FontSlant, FontWeight, Operator, Pattern } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDrawingArea, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./mask.tsx?raw";

const drawCircularMask = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    const checkSize = 10;
    for (let y = 0; y < height; y += checkSize) {
        for (let x = 0; x < width; x += checkSize) {
            const isLight = (x / checkSize + y / checkSize) % 2 === 0;
            cr.setSourceRgb(isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7)
                .rectangle(x, y, checkSize, checkSize)
                .fill();
        }
    }

    const bgGradient = Pattern.createLinear(0, 0, width, height)
        .addColorStopRgb(0, 0.9, 0.2, 0.2)
        .addColorStopRgb(0.5, 0.2, 0.9, 0.2)
        .addColorStopRgb(1, 0.2, 0.2, 0.9);

    cr.save()
        .setSource(bgGradient)
        .rectangle(0, 0, width, height)
        .arc(centerX, centerY, radius, 0, 2 * Math.PI)
        .clip()
        .paint()
        .restore();

    cr.setSourceRgba(0, 0, 0, 0.3)
        .setLineWidth(2)
        .arc(centerX, centerY, radius, 0, 2 * Math.PI)
        .stroke();
};

const drawGradientMask = (feather: number) => {
    return (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const centerX = width / 2;
        const centerY = height / 2;
        const innerRadius = 20;
        const outerRadius = Math.min(width, height) / 2 - 10;

        const checkSize = 8;
        for (let y = 0; y < height; y += checkSize) {
            for (let x = 0; x < width; x += checkSize) {
                const isLight = (x / checkSize + y / checkSize) % 2 === 0;
                cr.setSourceRgb(isLight ? 0.9 : 0.75, isLight ? 0.9 : 0.75, isLight ? 0.9 : 0.75)
                    .rectangle(x, y, checkSize, checkSize)
                    .fill();
            }
        }

        cr.setSourceRgb(0.2, 0.6, 0.9).rectangle(0, 0, width, height).fill();

        const maskRadius = innerRadius + (outerRadius - innerRadius) * (1 - feather);
        const mask = Pattern.createRadial(centerX, centerY, 0, centerX, centerY, outerRadius)
            .addColorStopRgba(0, 0, 0, 0, 1)
            .addColorStopRgba(maskRadius / outerRadius, 0, 0, 0, 1)
            .addColorStopRgba(1, 0, 0, 0, 0);

        cr.setOperator(Operator.DEST_IN).setSource(mask).paint().setOperator(Operator.OVER);
    };
};

const drawStarMask = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 15;
    const innerRadius = outerRadius * 0.4;
    const points = 5;

    const checkSize = 8;
    for (let y = 0; y < height; y += checkSize) {
        for (let x = 0; x < width; x += checkSize) {
            const isLight = (x / checkSize + y / checkSize) % 2 === 0;
            cr.setSourceRgb(isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7)
                .rectangle(x, y, checkSize, checkSize)
                .fill();
        }
    }

    const bgGradient = Pattern.createLinear(0, 0, width, height)
        .addColorStopRgb(0, 0.95, 0.8, 0.2)
        .addColorStopRgb(1, 0.9, 0.4, 0.1);

    cr.save().setSource(bgGradient).rectangle(0, 0, width, height);

    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (i === 0) {
            cr.moveTo(x, y);
        } else {
            cr.lineTo(x, y);
        }
    }
    cr.closePath().clip().paint().restore();
};

const drawHorizontalGradientMask = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const checkSize = 8;
    for (let y = 0; y < height; y += checkSize) {
        for (let x = 0; x < width; x += checkSize) {
            const isLight = (x / checkSize + y / checkSize) % 2 === 0;
            cr.setSourceRgb(isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7)
                .rectangle(x, y, checkSize, checkSize)
                .fill();
        }
    }

    cr.setSourceRgb(0.6, 0.2, 0.8).rectangle(0, 0, width, height).fill();

    const mask = Pattern.createLinear(0, 0, width, 0)
        .addColorStopRgba(0, 0, 0, 0, 0)
        .addColorStopRgba(0.3, 0, 0, 0, 1)
        .addColorStopRgba(0.7, 0, 0, 0, 1)
        .addColorStopRgba(1, 0, 0, 0, 0);

    cr.setOperator(Operator.DEST_IN).setSource(mask).paint().setOperator(Operator.OVER);
};

const drawTextMask = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const checkSize = 8;
    for (let y = 0; y < height; y += checkSize) {
        for (let x = 0; x < width; x += checkSize) {
            const isLight = (x / checkSize + y / checkSize) % 2 === 0;
            cr.setSourceRgb(isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7, isLight ? 0.85 : 0.7)
                .rectangle(x, y, checkSize, checkSize)
                .fill();
        }
    }

    const gradient = Pattern.createLinear(0, 0, width, height)
        .addColorStopRgb(0, 0.9, 0.2, 0.5)
        .addColorStopRgb(0.5, 0.5, 0.2, 0.9)
        .addColorStopRgb(1, 0.2, 0.9, 0.9);

    cr.save();

    cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.BOLD).setFontSize(48);

    const text = "MASK";
    const extents = cr.textExtents(text);
    const x = (width - extents.width) / 2 - extents.xBearing;
    const y = (height - extents.height) / 2 - extents.yBearing;

    cr.moveTo(x, y).textPath(text).clip().setSource(gradient).paint().restore();
};

const MaskDemo = () => {
    const [feather, setFeather] = useState(0.5);
    const gradientMaskRef = useRef<Gtk.DrawingArea | null>(null);
    const circularMaskRef = useRef<Gtk.DrawingArea | null>(null);
    const starMaskRef = useRef<Gtk.DrawingArea | null>(null);
    const horizontalMaskRef = useRef<Gtk.DrawingArea | null>(null);
    const textMaskRef = useRef<Gtk.DrawingArea | null>(null);

    const featherAdjustment = useMemo(() => new Gtk.Adjustment(0.5, 0, 1, 0.05, 0.1, 0), []);

    useEffect(() => {
        const area = circularMaskRef.current;
        if (area) {
            area.setDrawFunc(drawCircularMask);
        }
    }, []);

    useEffect(() => {
        const area = gradientMaskRef.current;
        if (area) {
            area.setDrawFunc(drawGradientMask(feather));
            area.queueDraw();
        }
    }, [feather]);

    useEffect(() => {
        const area = starMaskRef.current;
        if (area) {
            area.setDrawFunc(drawStarMask);
        }
    }, []);

    useEffect(() => {
        const area = horizontalMaskRef.current;
        if (area) {
            area.setDrawFunc(drawHorizontalGradientMask);
        }
    }, []);

    useEffect(() => {
        const area = textMaskRef.current;
        if (area) {
            area.setDrawFunc(drawTextMask);
        }
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
            <GtkLabel label="Masking Effects" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Cairo provides powerful masking capabilities through clipping paths, alpha gradients, and compositing operators. Masks control which parts of content are visible."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Mask Types">
                <GtkBox
                    spacing={24}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkDrawingArea
                            ref={circularMaskRef}
                            contentWidth={150}
                            contentHeight={150}
                            cssClasses={["card"]}
                        />
                        <GtkLabel label="Circular Clip" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkDrawingArea
                            ref={starMaskRef}
                            contentWidth={150}
                            contentHeight={150}
                            cssClasses={["card"]}
                        />
                        <GtkLabel label="Star Clip" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkDrawingArea
                            ref={textMaskRef}
                            contentWidth={150}
                            contentHeight={150}
                            cssClasses={["card"]}
                        />
                        <GtkLabel label="Text Mask" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Gradient Mask (Soft Edges)">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkDrawingArea
                            ref={gradientMaskRef}
                            contentWidth={200}
                            contentHeight={200}
                            cssClasses={["card"]}
                        />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} valign={Gtk.Align.CENTER}>
                            <GtkLabel
                                label="Radial gradient masks create soft, feathered edges. Adjust the feather amount to control edge softness."
                                wrap
                                widthRequest={200}
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkLabel label="Feather:" widthRequest={60} halign={Gtk.Align.START} />
                        <GtkScale
                            adjustment={featherAdjustment}
                            drawValue
                            digits={2}
                            valuePos={Gtk.PositionType.RIGHT}
                            hexpand
                            onValueChanged={(scale: Gtk.Range) => setFeather(scale.getValue())}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Linear Gradient Mask">
                <GtkBox spacing={24} marginStart={16} marginEnd={16} marginTop={16} marginBottom={16}>
                    <GtkDrawingArea
                        ref={horizontalMaskRef}
                        contentWidth={250}
                        contentHeight={120}
                        cssClasses={["card"]}
                    />
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} valign={Gtk.Align.CENTER}>
                        <GtkLabel
                            label="Linear gradient masks can create fade-in/fade-out effects, useful for content that scrolls or transitions."
                            wrap
                            widthRequest={200}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Masking Techniques">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={12}
                    marginEnd={12}
                    marginTop={12}
                    marginBottom={12}
                >
                    <GtkLabel
                        label="1. Clipping (clip/clipPreserve):"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="Define a path, then clip(). Only content inside the path is visible. Hard edges."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel
                        label="2. Alpha Masking (DEST_IN operator):"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                        marginTop={8}
                    />
                    <GtkLabel
                        label="Draw content, then use setOperator(DEST_IN) with a gradient pattern. Alpha values control transparency for soft edges."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkLabel
                        label="3. Text Path Masking:"
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                        marginTop={8}
                    />
                    <GtkLabel
                        label="Use textPath() to create a path from text, then clip() to use text as a mask shape."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Cairo Compositing Operators">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginStart={12}
                    marginEnd={12}
                    marginTop={12}
                    marginBottom={12}
                >
                    <GtkLabel label="Key operators for masking:" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label={`OVER - Default, draws source over destination
DEST_IN - Keep destination where source is opaque
DEST_OUT - Remove destination where source is opaque
SOURCE - Replace destination with source
XOR - Combine non-overlapping regions`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const maskDemo: Demo = {
    id: "mask",
    title: "Masking",
    description: "Alpha masks, gradient masks, and image-based masks with Cairo",
    keywords: ["mask", "alpha", "clip", "gradient", "cairo", "compositing", "transparency", "feather"],
    component: MaskDemo,
    sourceCode,
};
