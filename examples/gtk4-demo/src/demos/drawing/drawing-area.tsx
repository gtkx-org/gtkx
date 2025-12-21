import * as cairo from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDrawingArea, GtkLabel } from "@gtkx/react";
import { useCallback, useRef } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

/**
 * Draw callback that renders Cairo graphics.
 * This is called whenever the widget needs to be redrawn.
 */
function drawCallback(_self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) {
    if (width <= 0 || height <= 0) return;

    // White background
    cairo.setSourceRgb(cr, 1, 1, 1);
    cairo.paint(cr);

    // Draw a filled blue circle in the center
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    cairo.arc(cr, centerX, centerY, radius, 0, 2 * Math.PI);
    cairo.setSourceRgba(cr, 0.2, 0.4, 0.8, 1.0);
    cairo.fill(cr);

    // Draw a red ring around it
    cairo.arc(cr, centerX, centerY, radius + 20, 0, 2 * Math.PI);
    cairo.setSourceRgba(cr, 0.8, 0.2, 0.2, 1.0);
    cairo.setLineWidth(cr, 4);
    cairo.stroke(cr);

    // Draw some decorative shapes
    cairo.save(cr);

    // Green rectangle in top-left
    cairo.rectangle(cr, 20, 20, 60, 40);
    cairo.setSourceRgba(cr, 0.2, 0.7, 0.3, 0.8);
    cairo.fill(cr);

    // Orange triangle in bottom-right
    cairo.moveTo(cr, width - 80, height - 20);
    cairo.lineTo(cr, width - 20, height - 20);
    cairo.lineTo(cr, width - 50, height - 70);
    cairo.closePath(cr);
    cairo.setSourceRgba(cr, 0.9, 0.5, 0.1, 0.8);
    cairo.fill(cr);

    // Purple dashed arc in top-right
    cairo.setDash(cr, [8, 4], 0);
    cairo.arc(cr, width - 50, 50, 30, 0, Math.PI);
    cairo.setSourceRgba(cr, 0.6, 0.2, 0.8, 1.0);
    cairo.setLineWidth(cr, 3);
    cairo.stroke(cr);

    cairo.restore(cr);
}

const DrawingAreaDemo = () => {
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);

    const handleRealize = useCallback((self: Gtk.Widget) => {
        const area = self as Gtk.DrawingArea;
        drawingAreaRef.current = area;

        // Set the draw function - it will be called whenever the widget needs redrawing
        area.setDrawFunc(drawCallback);
    }, []);

    const handleResize = useCallback((self: Gtk.DrawingArea) => {
        self.queueDraw();
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Drawing Area" cssClasses={["title-2"]} halign={Gtk.Align.START} />
            <GtkLabel
                label="GtkDrawingArea provides a canvas for custom drawing with Cairo. This demo shows basic shapes: a filled circle, a stroked ring, a rectangle, a triangle, and a dashed arc."
                wrap
                cssClasses={["dim-label"]}
            />

            <GtkDrawingArea
                contentWidth={300}
                contentHeight={300}
                vexpand
                hexpand
                onRealize={handleRealize}
                onResize={handleResize}
            />
        </GtkBox>
    );
};

export const drawingAreaDemo: Demo = {
    id: "drawingarea",
    title: "Drawing Area",
    description: "Custom 2D drawing with Cairo in a GtkDrawingArea widget.",
    keywords: ["drawing", "cairo", "graphics", "canvas", "vector", "shapes", "custom"],
    component: DrawingAreaDemo,
    sourcePath: getSourcePath(import.meta.url, "drawing-area.tsx"),
};
