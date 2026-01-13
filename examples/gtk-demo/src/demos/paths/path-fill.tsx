import { type Context, FillRule, Pattern } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDrawingArea, GtkFrame, GtkLabel } from "@gtkx/react";
import { useEffect, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-fill.tsx?raw";

const drawSolidFill = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.4;

    cr.save()
        .translate(centerX, centerY)
        .moveTo(0, -size * 0.3)
        .curveTo(-size * 0.8, -size, -size * 0.8, size * 0.2, 0, size * 0.6)
        .curveTo(size * 0.8, size * 0.2, size * 0.8, -size, 0, -size * 0.3)
        .closePath();

    cr.setSourceRgb(0.9, 0.2, 0.3).fillPreserve();

    cr.setSourceRgb(0.7, 0.1, 0.2).setLineWidth(3).stroke().restore();
};

const drawLinearGradient = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const padding = 20;
    const rectWidth = width - padding * 2;
    const rectHeight = height - padding * 2;

    const gradient = Pattern.createLinear(padding, padding, padding + rectWidth, padding + rectHeight)
        .addColorStopRgb(0, 0.2, 0.4, 0.8)
        .addColorStopRgb(0.5, 0.5, 0.2, 0.7)
        .addColorStopRgb(1, 0.9, 0.3, 0.5);

    const radius = 20;
    cr.moveTo(padding + radius, padding)
        .lineTo(padding + rectWidth - radius, padding)
        .arc(padding + rectWidth - radius, padding + radius, radius, -Math.PI / 2, 0)
        .lineTo(padding + rectWidth, padding + rectHeight - radius)
        .arc(padding + rectWidth - radius, padding + rectHeight - radius, radius, 0, Math.PI / 2)
        .lineTo(padding + radius, padding + rectHeight)
        .arc(padding + radius, padding + rectHeight - radius, radius, Math.PI / 2, Math.PI)
        .lineTo(padding, padding + radius)
        .arc(padding + radius, padding + radius, radius, Math.PI, (3 * Math.PI) / 2)
        .closePath()
        .setSource(gradient)
        .fill();
};

const drawRadialGradient = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    const gradient = Pattern.createRadial(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius,
    )
        .addColorStopRgb(0, 1, 1, 0.8)
        .addColorStopRgb(0.5, 0.9, 0.6, 0.1)
        .addColorStopRgb(1, 0.8, 0.3, 0);

    cr.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        .setSource(gradient)
        .fill();
};

const drawEvenOddFill = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.5;

    cr.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);

    cr.newSubPath().arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);

    cr.setFillRule(FillRule.EVEN_ODD)
        .setSourceRgb(0.3, 0.6, 0.9)
        .fillPreserve()
        .setSourceRgb(0.1, 0.3, 0.6)
        .setLineWidth(2)
        .stroke();

    cr.setFillRule(FillRule.WINDING);
};

const drawWindingFill = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2 - 10;
    const innerRadius = outerRadius * 0.5;

    cr.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);

    cr.newSubPath().arcNegative(centerX, centerY, innerRadius, 2 * Math.PI, 0);

    cr.setFillRule(FillRule.WINDING)
        .setSourceRgb(0.9, 0.5, 0.2)
        .fillPreserve()
        .setSourceRgb(0.6, 0.3, 0.1)
        .setLineWidth(2)
        .stroke();
};

const drawComplexPolygon = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 15;
    const points = 6;

    for (let i = 0; i < points; i++) {
        const angle = (i * 2 * Math.PI) / points - Math.PI / 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
            cr.moveTo(x, y);
        } else {
            cr.lineTo(x, y);
        }
    }
    cr.closePath();

    const gradient = Pattern.createLinear(0, 0, width, height)
        .addColorStopRgb(0, 0.4, 0.8, 0.4)
        .addColorStopRgb(1, 0.2, 0.5, 0.3);

    cr.setSource(gradient).fillPreserve().setSourceRgb(0.1, 0.4, 0.2).setLineWidth(3).stroke();
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
    const ref = useRef<Gtk.DrawingArea | null>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.setDrawFunc(drawFunc);
        }
    }, [drawFunc]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
            <GtkDrawingArea ref={ref} contentWidth={width} contentHeight={height} cssClasses={["card"]} />
            <GtkLabel label={label} cssClasses={["dim-label", "caption"]} />
        </GtkBox>
    );
};

const PathFillDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Vector Path Fills" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Paths can be filled with solid colors, linear gradients, or radial gradients. The fill rule determines how overlapping paths are filled."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Solid & Gradient Fills">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas width={140} height={140} drawFunc={drawSolidFill} label="Solid Fill (Heart)" />
                    <DrawingCanvas width={160} height={120} drawFunc={drawLinearGradient} label="Linear Gradient" />
                    <DrawingCanvas width={140} height={140} drawFunc={drawRadialGradient} label="Radial Gradient" />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Fill Rules">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Fill rules determine how overlapping paths are filled. Even-odd creates holes when paths overlap, while winding considers path direction."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={32} halign={Gtk.Align.CENTER}>
                        <DrawingCanvas width={140} height={140} drawFunc={drawEvenOddFill} label="Even-Odd Fill Rule" />
                        <DrawingCanvas
                            width={140}
                            height={140}
                            drawFunc={drawWindingFill}
                            label="Winding Fill Rule (CCW inner)"
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Complex Shapes">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas
                        width={160}
                        height={160}
                        drawFunc={drawComplexPolygon}
                        label="Hexagon with Gradient"
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathFillDemo: Demo = {
    id: "path-fill",
    title: "Path/Fill and Stroke",
    description: "Vector path fills with gradients and fill rules",
    keywords: ["path", "fill", "gradient", "linear", "radial", "even-odd", "winding", "vector", "cairo"],
    component: PathFillDemo,
    sourceCode,
};
