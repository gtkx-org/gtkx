import { type Context, LineCap, Operator } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDrawingArea, GtkFrame, GtkLabel } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./drawingarea.tsx?raw";

const CHECK_SIZE = 16;

const ovalPath = (cr: Context, xc: number, yc: number, xr: number, yr: number) => {
    cr.save()
        .translate(xc, yc)
        .scale(1, yr / xr)
        .moveTo(xr, 0)
        .arc(0, 0, xr, 0, 2 * Math.PI)
        .closePath()
        .restore();
};

const fillChecks = (cr: Context, width: number, height: number) => {
    cr.rectangle(0, 0, width, height).setSourceRgb(0.4, 0.4, 0.4).fill();

    for (let j = 0; j < height; j += CHECK_SIZE) {
        for (let i = 0; i < width; i += CHECK_SIZE) {
            if ((Math.floor(i / CHECK_SIZE) + Math.floor(j / CHECK_SIZE)) % 2 === 0) {
                cr.rectangle(i, j, CHECK_SIZE, CHECK_SIZE);
            }
        }
    }
    cr.setSourceRgb(0.7, 0.7, 0.7).fill();
};

const draw3Circles = (cr: Context, xc: number, yc: number, radius: number, alpha: number) => {
    const subradius = radius * (2 / 3 - 0.1);

    cr.setSourceRgba(1, 0, 0, alpha);
    ovalPath(cr, xc + (radius / 3) * Math.cos(Math.PI * 0.5), yc - (radius / 3) * Math.sin(Math.PI * 0.5), subradius, subradius);
    cr.fill();

    cr.setSourceRgba(0, 1, 0, alpha);
    ovalPath(cr, xc + (radius / 3) * Math.cos(Math.PI * (0.5 + 2 / 0.3)), yc - (radius / 3) * Math.sin(Math.PI * (0.5 + 2 / 0.3)), subradius, subradius);
    cr.fill();

    cr.setSourceRgba(0, 0, 1, alpha);
    ovalPath(cr, xc + (radius / 3) * Math.cos(Math.PI * (0.5 + 4 / 0.3)), yc - (radius / 3) * Math.sin(Math.PI * (0.5 + 4 / 0.3)), subradius, subradius);
    cr.fill();
};

const drawKnockoutGroups = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const radius = 0.5 * Math.min(width, height) - 10;
    const xc = width / 2;
    const yc = height / 2;

    fillChecks(cr, width, height);

    const overlay = cr.getTarget().createSimilar("COLOR_ALPHA", width, height);
    const punch = cr.getTarget().createSimilar("ALPHA", width, height);
    const circles = cr.getTarget().createSimilar("COLOR_ALPHA", width, height);

    const overlayCr = overlay.createContext();
    overlayCr.setSourceRgb(0, 0, 0);
    ovalPath(overlayCr, xc, yc, radius, radius);
    overlayCr.fill();

    const punchCr = punch.createContext();
    draw3Circles(punchCr, xc, yc, radius, 1.0);

    overlayCr.setOperator(Operator.DEST_OUT);
    overlayCr.setSourceSurface(punch, 0, 0);
    overlayCr.paint();

    const circlesCr = circles.createContext();
    circlesCr.setOperator(Operator.OVER);
    draw3Circles(circlesCr, xc, yc, radius, 0.5);

    overlayCr.setOperator(Operator.ADD);
    overlayCr.setSourceSurface(circles, 0, 0);
    overlayCr.paint();

    cr.setSourceSurface(overlay, 0, 0);
    cr.paint();
};

interface Point {
    x: number;
    y: number;
}

type Stroke = Point[];

const ScribbleArea = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const currentStrokeRef = useRef<Stroke>([]);
    const startPointRef = useRef<Point | null>(null);

    const drawScribble = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1).rectangle(0, 0, width, height).fill();

            cr.setSourceRgb(0, 0, 0).setLineWidth(6).setLineCap(LineCap.ROUND);

            for (const stroke of strokes) {
                const [first, ...rest] = stroke;
                if (!first) continue;
                cr.moveTo(first.x, first.y);
                if (rest.length === 0) {
                    cr.lineTo(first.x, first.y);
                } else {
                    for (const point of rest) {
                        cr.lineTo(point.x, point.y);
                    }
                }
                cr.stroke();
            }

            const currentStroke = currentStrokeRef.current;
            const [currentFirst, ...currentRest] = currentStroke;
            if (currentFirst) {
                cr.moveTo(currentFirst.x, currentFirst.y);
                if (currentRest.length === 0) {
                    cr.lineTo(currentFirst.x, currentFirst.y);
                } else {
                    for (const point of currentRest) {
                        cr.lineTo(point.x, point.y);
                    }
                }
                cr.stroke();
            }
        },
        [strokes],
    );

    const handleDragBegin = useCallback((startX: number, startY: number) => {
        startPointRef.current = { x: startX, y: startY };
        currentStrokeRef.current = [{ x: startX, y: startY }];
        ref.current?.queueDraw();
    }, []);

    const handleDragUpdate = useCallback((offsetX: number, offsetY: number) => {
        if (startPointRef.current) {
            const x = startPointRef.current.x + offsetX;
            const y = startPointRef.current.y + offsetY;
            currentStrokeRef.current.push({ x, y });
            ref.current?.queueDraw();
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        const points = [...currentStrokeRef.current];
        if (points.length > 0) {
            setStrokes((prev) => [...prev, points]);
        }
        currentStrokeRef.current = [];
        startPointRef.current = null;
    }, []);

    const handleResize = useCallback(() => {
        setStrokes([]);
        currentStrokeRef.current = [];
        startPointRef.current = null;
    }, []);

    return (
        <GtkDrawingArea
            ref={ref}
            contentWidth={100}
            contentHeight={100}
            onDraw={drawScribble}
            onGestureDragBegin={handleDragBegin}
            onGestureDragUpdate={handleDragUpdate}
            onGestureDragEnd={handleDragEnd}
            onResize={handleResize}
        />
    );
};

const DrawingAreaDemo = () => {
    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            marginStart={16}
            marginEnd={16}
            marginTop={16}
            marginBottom={16}
        >
            <GtkLabel label="Knockout groups" cssClasses={["heading"]} />
            <GtkFrame vexpand>
                <GtkDrawingArea onDraw={drawKnockoutGroups} contentWidth={100} contentHeight={100} />
            </GtkFrame>

            <GtkLabel label="Scribble area" cssClasses={["heading"]} />
            <GtkFrame vexpand>
                <ScribbleArea />
            </GtkFrame>
        </GtkBox>
    );
};

export const drawingAreaDemo: Demo = {
    id: "drawingarea",
    title: "Drawing Area",
    description:
        "GtkDrawingArea is a blank area where you can draw custom displays of various kinds. This demo has two drawing areas. The checkerboard area shows how you can just draw something; all you have to do is set a function via gtk_drawing_area_set_draw_func. The scribble area is a bit more advanced, and shows how to handle events such as button presses and mouse motion. Click the mouse and drag in the scribble area to draw squiggles. Resize the window to clear the area.",
    keywords: ["drawing", "GtkDrawingArea"],
    component: DrawingAreaDemo,
    sourceCode,
};
