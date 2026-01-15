import { type Context, type Surface, LineCap, Operator } from "@gtkx/ffi/cairo";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkColorDialogButton, GtkDrawingArea } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paint.tsx?raw";

interface Point {
    x: number;
    y: number;
}

interface Color {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

const initialColor: Color = { red: 0, green: 0, blue: 0, alpha: 1 };

const PaintDemo = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const surfaceRef = useRef<Surface | null>(null);
    const [color, setColor] = useState<Color>(initialColor);
    const startPointRef = useRef<Point | null>(null);
    const rgba = new Gdk.RGBA(color);

    const drawCanvas = useCallback((_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        if (!surfaceRef.current) {
            surfaceRef.current = cr.getTarget().createSimilar("COLOR_ALPHA", width, height);
        }

        cr.setSourceRgb(1, 1, 1).paint();

        cr.setSourceSurface(surfaceRef.current, 0, 0);
        cr.paint();

        cr.setSourceRgb(0.6, 0.6, 0.6).rectangle(0, 0, width, height).stroke();
    }, []);

    const drawBrush = useCallback(
        (x: number, y: number) => {
            const drawingArea = ref.current;
            if (!drawingArea || !surfaceRef.current) return;

            const surfaceCr = surfaceRef.current.createContext();
            surfaceCr.moveTo(x, y);
            surfaceCr.lineTo(x, y);
            surfaceCr.setLineWidth(6);
            surfaceCr.setLineCap(LineCap.ROUND);
            surfaceCr.setOperator(Operator.SATURATE);
            surfaceCr.setSourceRgba(color.red, color.green, color.blue, color.alpha);
            surfaceCr.stroke();

            drawingArea.queueDraw();
        },
        [color],
    );

    const handleDragBegin = useCallback(
        (startX: number, startY: number) => {
            startPointRef.current = { x: startX, y: startY };
            drawBrush(startX, startY);
        },
        [drawBrush],
    );

    const handleDragUpdate = useCallback(
        (offsetX: number, offsetY: number) => {
            if (startPointRef.current) {
                const x = startPointRef.current.x + offsetX;
                const y = startPointRef.current.y + offsetY;
                drawBrush(x, y);
            }
        },
        [drawBrush],
    );

    const handleDragEnd = useCallback(() => {
        startPointRef.current = null;
    }, []);

    const handleClear = useCallback(() => {
        surfaceRef.current = null;
        ref.current?.queueDraw();
    }, []);

    const handleColorButtonNotify = useCallback((button: Gtk.ColorDialogButton, propName: string) => {
        if (propName === "rgba") {
            const rgba = button.getRgba();
            setColor({
                red: rgba.red,
                green: rgba.green,
                blue: rgba.blue,
                alpha: rgba.alpha,
            });
        }
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkBox halign={Gtk.Align.END} marginTop={8} marginEnd={8} spacing={6}>
                <GtkColorDialogButton dialog={new Gtk.ColorDialog()} rgba={rgba} onNotify={handleColorButtonNotify} />
                <GtkButton iconName="view-refresh-symbolic" onClicked={handleClear} />
            </GtkBox>
            <GtkDrawingArea
                ref={ref}
                hexpand
                vexpand
                onDraw={drawCanvas}
                onGestureDragBegin={handleDragBegin}
                onGestureDragUpdate={handleDragUpdate}
                onGestureDragEnd={handleDragEnd}
            />
        </GtkBox>
    );
};

export const paintDemo: Demo = {
    id: "paint",
    title: "Paint",
    description: "Demonstrates practical handling of drawing tablets in a real world usecase.",
    keywords: ["paint", "GdkDrawingArea", "GtkGesture"],
    component: PaintDemo,
    sourceCode,
};
