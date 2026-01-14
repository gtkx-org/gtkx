import { type Context, LineCap, LineJoin, Operator } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./drawingarea.tsx?raw";

const drawCircle = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    cr.setSourceRgb(0.2, 0.6, 0.9)
        .arc(centerX, centerY, radius, 0, 2 * Math.PI)
        .fill();

    cr.setSourceRgb(0.1, 0.4, 0.7)
        .setLineWidth(3)
        .arc(centerX, centerY, radius, 0, 2 * Math.PI)
        .stroke();
};

const drawShapes = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const padding = 20;

    cr.setSourceRgb(0.9, 0.3, 0.3).rectangle(padding, padding, 80, 60).fill();

    cr.setSourceRgb(0.3, 0.8, 0.3)
        .arc(width / 2, height / 2, 40, 0, 2 * Math.PI)
        .fill();

    cr.setSourceRgb(0.3, 0.3, 0.9)
        .moveTo(width - padding - 40, height - padding)
        .lineTo(width - padding, height - padding)
        .lineTo(width - padding - 20, height - padding - 60)
        .closePath()
        .fill();

    cr.setSourceRgb(0.8, 0.5, 0.2)
        .setLineWidth(4)
        .moveTo(padding, height - padding)
        .curveTo(width / 4, padding, (3 * width) / 4, height - padding, width - padding, padding)
        .stroke();
};

const ovalPath = (cr: Context, xc: number, yc: number, xr: number, yr: number) => {
    cr.save()
        .translate(xc, yc)
        .scale(1, yr / xr)
        .arc(0, 0, xr, 0, 2 * Math.PI)
        .restore();
};

const fillChecks = (cr: Context, width: number, height: number) => {
    const checkSize = 8;
    cr.setSourceRgb(0.4, 0.4, 0.4).rectangle(0, 0, width, height).fill();

    cr.setSourceRgb(0.6, 0.6, 0.6);
    for (let y = 0; y < height; y += checkSize * 2) {
        for (let x = 0; x < width; x += checkSize * 2) {
            cr.rectangle(x, y, checkSize, checkSize).rectangle(x + checkSize, y + checkSize, checkSize, checkSize);
        }
    }
    cr.fill();
};

const draw3Circles = (cr: Context, xc: number, yc: number, radius: number) => {
    const subradius = radius * 0.7;

    cr.setSourceRgba(1, 0, 0, 0.5);
    ovalPath(cr, xc + radius / 2, yc - subradius / 2, subradius, subradius);
    cr.fill();

    cr.setSourceRgba(0, 1, 0, 0.5);
    ovalPath(cr, xc, yc + subradius / 2, subradius, subradius);
    cr.fill();

    cr.setSourceRgba(0, 0, 1, 0.5);
    ovalPath(cr, xc - radius / 2, yc - subradius / 2, subradius, subradius);
    cr.fill();
};

const drawCompositing = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const radius = Math.min(width, height) / 2 - 10;
    const xc = width / 2;
    const yc = height / 2;

    fillChecks(cr, width, height);

    draw3Circles(cr, xc, yc, radius);
};

const drawKnockout = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const radius = Math.min(width, height) / 2 - 10;
    const xc = width / 2;
    const yc = height / 2;

    fillChecks(cr, width, height);

    cr.setSourceRgb(1, 1, 1)
        .arc(xc, yc, radius, 0, 2 * Math.PI)
        .fill();

    cr.setOperator(Operator.DEST_OUT);
    draw3Circles(cr, xc, yc, radius);

    cr.setOperator(Operator.OVER);
};

const drawStar = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.4;
    const points = 5;

    cr.setSourceRgb(0.95, 0.8, 0.2);

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
    cr.closePath().fill();

    cr.setSourceRgb(0.8, 0.6, 0.1).setLineWidth(2);
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
    cr.closePath().stroke();
};

const DrawingCanvas = ({
    width,
    height,
    drawFunc,
    label,
}: {
    width: number;
    height: number;
    drawFunc: (self: Gtk.DrawingArea, cr: Context, width: number, height: number) => void;
    label: string;
}) => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
            <GtkDrawingArea onDraw={drawFunc} contentWidth={width} contentHeight={height} cssClasses={["card"]} />
            <GtkLabel label={label} cssClasses={["dim-label", "caption"]} />
        </GtkBox>
    );
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

            cr.setSourceRgb(0, 0, 0).setLineWidth(3).setLineCap(LineCap.ROUND).setLineJoin(LineJoin.ROUND);

            for (const stroke of strokes) {
                const [first, ...rest] = stroke;
                if (!first || rest.length === 0) continue;
                cr.moveTo(first.x, first.y);
                for (const point of rest) {
                    cr.lineTo(point.x, point.y);
                }
                cr.stroke();
            }

            const currentStroke = currentStrokeRef.current;
            const [currentFirst, ...currentRest] = currentStroke;
            if (currentFirst && currentRest.length > 0) {
                cr.moveTo(currentFirst.x, currentFirst.y);
                for (const point of currentRest) {
                    cr.lineTo(point.x, point.y);
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

    const handleClear = () => {
        setStrokes([]);
        currentStrokeRef.current = [];
        startPointRef.current = null;
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <GtkDrawingArea
                ref={ref}
                contentWidth={300}
                contentHeight={200}
                cssClasses={["card"]}
                onDraw={drawScribble}
                onGestureDragBegin={handleDragBegin}
                onGestureDragUpdate={handleDragUpdate}
                onGestureDragEnd={handleDragEnd}
            />
            <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                <GtkLabel label="Draw with mouse or touch" cssClasses={["dim-label", "caption"]} />
                <GtkButton label="Clear" onClicked={handleClear} cssClasses={["flat"]} />
            </GtkBox>
        </GtkBox>
    );
};

const DrawingAreaDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Drawing Area" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkDrawingArea allows custom drawing using Cairo graphics. Set a draw function to render shapes, paths, and patterns."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Interactive Scribble">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <ScribbleArea />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Basic Shapes">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas width={120} height={120} drawFunc={drawCircle} label="Circle" />
                    <DrawingCanvas width={200} height={150} drawFunc={drawShapes} label="Multiple Shapes" />
                    <DrawingCanvas width={120} height={120} drawFunc={drawStar} label="Star" />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Compositing & Alpha Blending">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas width={150} height={150} drawFunc={drawCompositing} label="Alpha Blending" />
                    <DrawingCanvas width={150} height={150} drawFunc={drawKnockout} label="Knockout (DEST_OUT)" />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Cairo Drawing API">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="Available Cairo methods:" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label={`Path: moveTo, lineTo, curveTo, arc, rectangle, closePath
Draw: fill, stroke, paint, setOperator
Style: setSourceRgb/Rgba, setLineWidth, setLineCap/Join
Transform: save, restore, translate, scale, rotate`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const drawingAreaDemo: Demo = {
    id: "drawingarea",
    title: "Drawing Area",
    description: "Custom drawing with Cairo graphics",
    keywords: ["drawing", "canvas", "cairo", "GtkDrawingArea", "custom", "graphics", "shapes", "paths", "scribble"],
    component: DrawingAreaDemo,
    sourceCode,
};
