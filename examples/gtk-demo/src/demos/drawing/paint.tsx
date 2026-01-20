import { type Context, LineCap, Operator, type Surface } from "@gtkx/ffi/cairo";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkColorDialogButton, GtkDrawingArea, GtkLabel, GtkScale } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paint.tsx?raw";

interface Color {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

interface StylusInfo {
    pressure: number;
    tiltX: number;
    tiltY: number;
    isStylus: boolean;
}

const initialColor: Color = { red: 0, green: 0, blue: 0, alpha: 1 };

const PaintDemo = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const surfaceRef = useRef<Surface | null>(null);
    const [color, setColor] = useState<Color>(initialColor);
    const [baseWidth, setBaseWidth] = useState(6);
    const [stylusInfo, setStylusInfo] = useState<StylusInfo>({ pressure: 0, tiltX: 0, tiltY: 0, isStylus: false });
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
        (x: number, y: number, pressure: number = 1.0) => {
            const drawingArea = ref.current;
            if (!drawingArea || !surfaceRef.current) return;

            const strokeWidth = baseWidth * (0.5 + pressure * 1.5);

            const surfaceCr = surfaceRef.current.createContext();
            surfaceCr.moveTo(x, y);
            surfaceCr.lineTo(x, y);
            surfaceCr.setLineWidth(strokeWidth);
            surfaceCr.setLineCap(LineCap.ROUND);
            surfaceCr.setOperator(Operator.SATURATE);
            surfaceCr.setSourceRgba(color.red, color.green, color.blue, color.alpha);
            surfaceCr.stroke();

            drawingArea.queueDraw();
        },
        [color, baseWidth],
    );

    const handleStylusDown = useCallback(
        (x: number, y: number, pressure: number, tiltX: number, tiltY: number) => {
            setStylusInfo({ pressure, tiltX, tiltY, isStylus: true });
            drawBrush(x, y, pressure);
        },
        [drawBrush],
    );

    const handleStylusMotion = useCallback(
        (x: number, y: number, pressure: number, tiltX: number, tiltY: number) => {
            setStylusInfo({ pressure, tiltX, tiltY, isStylus: true });
            drawBrush(x, y, pressure);
        },
        [drawBrush],
    );

    const handleStylusUp = useCallback(() => {
        setStylusInfo({ pressure: 0, tiltX: 0, tiltY: 0, isStylus: false });
    }, []);

    const handleClear = useCallback(() => {
        surfaceRef.current = null;
        ref.current?.queueDraw();
    }, []);

    const handleColorButtonNotify = useCallback((button: Gtk.ColorDialogButton, propName: string) => {
        if (propName === "rgba") {
            const rgba = button.getRgba();
            setColor({
                red: rgba.getRed(),
                green: rgba.getGreen(),
                blue: rgba.getBlue(),
                alpha: rgba.getAlpha(),
            });
        }
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkBox halign={Gtk.Align.END} marginTop={8} marginEnd={8} marginStart={8} spacing={12}>
                <GtkBox spacing={8} hexpand>
                    <GtkLabel label="Width:" cssClasses={["dim-label"]} />
                    <GtkScale
                        drawValue
                        valuePos={Gtk.PositionType.RIGHT}
                        widthRequest={100}
                        value={baseWidth}
                        lower={1}
                        upper={20}
                        stepIncrement={1}
                        pageIncrement={2}
                        onValueChanged={setBaseWidth}
                    />
                </GtkBox>

                {stylusInfo.isStylus && (
                    <GtkBox spacing={8}>
                        <GtkLabel
                            label={`Pressure: ${(stylusInfo.pressure * 100).toFixed(0)}%`}
                            cssClasses={["dim-label", "caption"]}
                        />
                        <GtkLabel
                            label={`Tilt: ${stylusInfo.tiltX.toFixed(1)}°, ${stylusInfo.tiltY.toFixed(1)}°`}
                            cssClasses={["dim-label", "caption"]}
                        />
                    </GtkBox>
                )}

                <GtkColorDialogButton dialog={new Gtk.ColorDialog()} rgba={rgba} onNotify={handleColorButtonNotify} />
                <GtkButton iconName="view-refresh-symbolic" onClicked={handleClear} tooltipText="Clear canvas" />
            </GtkBox>

            <GtkLabel
                label="Use a stylus/tablet for pressure-sensitive strokes, or mouse for regular drawing"
                cssClasses={["dim-label", "caption"]}
                marginStart={8}
                marginBottom={4}
                halign={Gtk.Align.START}
            />

            <GtkDrawingArea
                ref={ref}
                hexpand
                vexpand
                onDraw={drawCanvas}
                onStylusDown={handleStylusDown}
                onStylusMotion={handleStylusMotion}
                onStylusUp={handleStylusUp}
            />
        </GtkBox>
    );
};

export const paintDemo: Demo = {
    id: "paint",
    title: "Drawing/Paint",
    description:
        "Drawing with tablet/stylus support. Uses GtkGestureStylus for pressure sensitivity and tilt detection via declarative props (onStylusDown, onStylusMotion, onStylusUp).",
    keywords: ["paint", "drawing", "stylus", "tablet", "pressure", "GtkGestureStylus", "GtkDrawingArea", "cairo"],
    component: PaintDemo,
    sourceCode,
};
