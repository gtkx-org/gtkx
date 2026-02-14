import { createRef } from "@gtkx/ffi";
import type { Context } from "@gtkx/ffi/cairo";
import { LinearPattern } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import * as PangoCairo from "@gtkx/ffi/pangocairo";
import { GtkBox, GtkDrawingArea, GtkLabel } from "@gtkx/react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./rotated-text.tsx?raw";

const TEXT = "I \u2665 GTK";
const N_WORDS = 5;
const RADIUS = 150;
const FONT = "Serif 18";
const HEART_CODEPOINT = 0x2665;

const drawHeart = (cr: Context, doPath: boolean) => {
    cr.moveTo(0.5, 0.0);
    cr.lineTo(0.9, -0.4);
    cr.curveTo(1.1, -0.8, 0.5, -0.9, 0.5, -0.5);
    cr.curveTo(0.5, -0.9, -0.1, -0.8, 0.1, -0.4);
    cr.closePath();

    if (!doPath) {
        cr.setSourceRgb(1.0, 0.0, 0.0);
        cr.fill();
    }
};

const createFancyAttrListForLayout = (layout: Pango.Layout): Pango.AttrList => {
    const fontDesc = layout.getFontDescription();
    const context = layout.getContext();
    const metrics = context.getMetrics(fontDesc, undefined);
    const ascent = metrics.getAscent();

    const inkRect = new Pango.Rectangle({
        x: 0,
        y: -ascent,
        width: ascent,
        height: ascent,
    });
    const logicalRect = new Pango.Rectangle({
        x: 0,
        y: -ascent,
        width: ascent,
        height: ascent,
    });

    const attrs = new Pango.AttrList();

    let byteIndex = 0;
    for (let i = 0; i < TEXT.length; i++) {
        const char = TEXT[i];
        const codepoint = TEXT.codePointAt(i);

        if (codepoint === HEART_CODEPOINT) {
            const attr = Pango.attrShapeNewWithData(inkRect, logicalRect, codepoint);
            attr.setStartIndex(byteIndex);
            attr.setEndIndex(byteIndex + 3);
            attrs.insert(attr);
        }

        if (codepoint !== undefined && codepoint > 0xffff) {
            byteIndex += 4;
            i++;
        } else if (char !== undefined) {
            byteIndex += Buffer.byteLength(char, "utf8");
        }
    }

    return attrs;
};

const RotatedTextDemo = () => {
    const labelRef = useRef<Gtk.Label | null>(null);
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);
    const shapeRendererSetup = useRef(false);

    const fancyShapeRenderer = useCallback((cr: Context, attr: Pango.AttrShape, doPath: boolean) => {
        const currentPoint = cr.getCurrentPoint();
        if (currentPoint) {
            cr.translate(currentPoint.x, currentPoint.y);
        }

        cr.scale(attr.getInkRect().getWidth() / Pango.SCALE, attr.getInkRect().getHeight() / Pango.SCALE);

        if (attr.getData() === HEART_CODEPOINT) {
            drawHeart(cr, doPath);
        }
    }, []);

    const drawFunc = useCallback(
        (cr: Context, width: number, height: number) => {
            const deviceRadius = Math.min(width, height) / 2;

            cr.translate(deviceRadius + (width - 2 * deviceRadius) / 2, deviceRadius + (height - 2 * deviceRadius) / 2);
            cr.scale(deviceRadius / RADIUS, deviceRadius / RADIUS);

            const gradient = new LinearPattern(-RADIUS, -RADIUS, RADIUS, RADIUS);
            gradient.addColorStopRgb(0, 0.5, 0.0, 0.0);
            gradient.addColorStopRgb(1, 0.0, 0.0, 0.5);
            cr.setSource(gradient);

            const context = drawingAreaRef.current?.createPangoContext();
            if (!context) return;
            PangoCairo.contextSetShapeRenderer(context, fancyShapeRenderer);

            const layout = new Pango.Layout(context);
            const fontDesc = Pango.FontDescription.fromString(FONT);
            layout.setFontDescription(fontDesc);
            layout.setText(TEXT, -1);

            const attrs = createFancyAttrListForLayout(layout);
            layout.setAttributes(attrs);

            for (let i = 0; i < N_WORDS; i++) {
                PangoCairo.updateLayout(cr, layout);

                const widthRef = createRef(0);
                const heightRef = createRef(0);
                layout.getPixelSize(widthRef, heightRef);
                const layoutWidth = widthRef.value;

                cr.moveTo(-layoutWidth / 2, -RADIUS * 0.9);
                PangoCairo.showLayout(cr, layout);

                cr.rotate((2 * Math.PI) / N_WORDS);
            }
        },
        [fancyShapeRenderer],
    );

    useLayoutEffect(() => {
        const label = labelRef.current;
        if (!label || shapeRendererSetup.current) return;

        shapeRendererSetup.current = true;

        const layout = label.getLayout();
        const context = layout.getContext();
        PangoCairo.contextSetShapeRenderer(context, fancyShapeRenderer);

        const attrs = createFancyAttrListForLayout(layout);
        label.setAttributes(attrs);
    }, [fancyShapeRenderer]);

    return (
        <GtkBox orientation={Gtk.Orientation.HORIZONTAL} homogeneous spacing={0}>
            <GtkDrawingArea ref={drawingAreaRef} onDraw={drawFunc} cssClasses={["view"]} />
            <GtkLabel ref={labelRef} label={TEXT} />
        </GtkBox>
    );
};

export const rotatedTextDemo: Demo = {
    id: "rotated-text",
    title: "Pango/Rotated Text",
    description: "Custom shape rendering with Pango",
    keywords: ["text", "rotate", "transform", "cairo", "pango", "drawing", "graphics", "heart", "shape"],
    component: RotatedTextDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 300,
};
