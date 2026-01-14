import { type Context, LineCap, LineJoin } from "@gtkx/ffi/cairo";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkColorDialogButton, GtkDrawingArea, GtkFrame, GtkLabel, GtkScale, x } from "@gtkx/react";
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

interface Stroke {
    points: Point[];
    color: Color;
    brushSize: number;
}

const initialColor: Color = { red: 0, green: 0, blue: 0, alpha: 1 };

const PaintDemo = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [color, setColor] = useState<Color>(initialColor);
    const [brushSize, setBrushSize] = useState(4);
    const currentStrokeRef = useRef<Point[]>([]);
    const startPointRef = useRef<Point | null>(null);
    const rgba = new Gdk.RGBA(color);

    const drawCanvas = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1).rectangle(0, 0, width, height).fill();

            cr.setLineCap(LineCap.ROUND).setLineJoin(LineJoin.ROUND);

            for (const stroke of strokes) {
                const [first, ...rest] = stroke.points;
                if (!first || rest.length === 0) continue;

                cr.setSourceRgba(stroke.color.red, stroke.color.green, stroke.color.blue, stroke.color.alpha);
                cr.setLineWidth(stroke.brushSize);
                cr.moveTo(first.x, first.y);

                for (const point of rest) {
                    cr.lineTo(point.x, point.y);
                }
                cr.stroke();
            }

            const currentStroke = currentStrokeRef.current;
            const [currentFirst, ...currentRest] = currentStroke;
            if (currentFirst && currentRest.length > 0) {
                cr.setSourceRgba(color.red, color.green, color.blue, color.alpha);
                cr.setLineWidth(brushSize);
                cr.moveTo(currentFirst.x, currentFirst.y);

                for (const point of currentRest) {
                    cr.lineTo(point.x, point.y);
                }
                cr.stroke();
            }

            cr.setSourceRgb(0.8, 0.8, 0.8).setLineWidth(1).rectangle(0, 0, width, height).stroke();
        },
        [strokes, color, brushSize],
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
            setStrokes((prev) => [
                ...prev,
                {
                    points,
                    color: { ...color },
                    brushSize,
                },
            ]);
        }
        currentStrokeRef.current = [];
        startPointRef.current = null;
    }, [color, brushSize]);

    const handleClear = () => {
        setStrokes([]);
        currentStrokeRef.current = [];
        startPointRef.current = null;
    };

    const handleColorButtonNotify = (button: Gtk.ColorDialogButton, propName: string) => {
        if (propName === "rgba") {
            const rgba = button.getRgba();
            setColor({
                red: rgba.red,
                green: rgba.green,
                blue: rgba.blue,
                alpha: rgba.alpha,
            });
        }
    };

    const presetColors: { name: string; color: Color }[] = [
        { name: "Black", color: { red: 0, green: 0, blue: 0, alpha: 1 } },
        { name: "Red", color: { red: 0.9, green: 0.2, blue: 0.2, alpha: 1 } },
        { name: "Green", color: { red: 0.2, green: 0.8, blue: 0.3, alpha: 1 } },
        { name: "Blue", color: { red: 0.2, green: 0.4, blue: 0.9, alpha: 1 } },
        { name: "Yellow", color: { red: 0.95, green: 0.85, blue: 0.2, alpha: 1 } },
        { name: "Purple", color: { red: 0.6, green: 0.2, blue: 0.8, alpha: 1 } },
    ];

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={20}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Paint" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Freeform Drawing Canvas" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="A simple painting application demonstrating drawing with GtkDrawingArea and GtkGestureDrag. Draw with mouse or touch, select colors, and adjust brush size."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkFrame>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginStart={16}
                    marginEnd={16}
                    marginTop={16}
                    marginBottom={16}
                >
                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkColorDialogButton
                            dialog={new Gtk.ColorDialog()}
                            rgba={rgba}
                            onNotify={handleColorButtonNotify}
                        />

                        {presetColors.map((preset) => (
                            <GtkButton
                                key={preset.name}
                                label={preset.name.charAt(0)}
                                tooltipText={preset.name}
                                onClicked={() => setColor(preset.color)}
                                cssClasses={
                                    color.red === preset.color.red &&
                                    color.green === preset.color.green &&
                                    color.blue === preset.color.blue
                                        ? ["suggested-action"]
                                        : []
                                }
                            />
                        ))}

                        <GtkButton
                            iconName="view-refresh-symbolic"
                            tooltipText="Clear canvas"
                            onClicked={handleClear}
                            cssClasses={["destructive-action"]}
                        />
                    </GtkBox>

                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Brush Size:" />
                        <GtkScale orientation={Gtk.Orientation.HORIZONTAL} drawValue digits={0} widthRequest={200}>
                            <x.Adjustment
                                value={brushSize}
                                lower={1}
                                upper={20}
                                stepIncrement={1}
                                pageIncrement={5}
                                onValueChanged={setBrushSize}
                            />
                        </GtkScale>
                    </GtkBox>

                    <GtkDrawingArea
                        ref={ref}
                        contentWidth={500}
                        contentHeight={350}
                        cssClasses={["card"]}
                        onDraw={drawCanvas}
                        onGestureDragBegin={handleDragBegin}
                        onGestureDragUpdate={handleDragUpdate}
                        onGestureDragEnd={handleDragEnd}
                    />

                    <GtkLabel
                        label="Click and drag to draw. Use the color picker or preset buttons to change the brush color."
                        cssClasses={["dim-label", "caption"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Implementation Notes" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="This demo uses GtkGestureDrag to track mouse/touch movements. Each stroke is stored with its color and brush size, allowing for multi-colored drawings. The canvas is redrawn on every frame using Cairo graphics."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const paintDemo: Demo = {
    id: "paint",
    title: "Paint",
    description: "Freeform drawing canvas with color and brush controls.",
    keywords: ["paint", "draw", "canvas", "brush", "color", "GtkDrawingArea", "gesture", "freehand"],
    component: PaintDemo,
    sourceCode,
};
