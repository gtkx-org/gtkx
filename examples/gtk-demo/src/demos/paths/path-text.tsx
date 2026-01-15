import { type Context, FontSlant, FontWeight, LineCap } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkEntry, GtkFrame, GtkLabel, GtkScale, x } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-text.tsx?raw";

interface Point {
    x: number;
    y: number;
}

const CONTROL_POINT_RADIUS = 10;

const getQuadraticBezierPoint = (t: number, p0: Point, p1: Point, p2: Point) => {
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
};

const getQuadraticBezierTangent = (t: number, p0: Point, p1: Point, p2: Point) => {
    const u = 1 - t;
    const dx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    return Math.atan2(dy, dx);
};

const InteractiveBezierDemo = () => {
    const areaRef = useRef<Gtk.DrawingArea | null>(null);
    const [text, setText] = useState("Drag the control points!");
    const [fontSize, setFontSize] = useState(20);
    const [p0, setP0] = useState<Point>({ x: 30, y: 170 });
    const [p1, setP1] = useState<Point>({ x: 200, y: 20 });
    const [p2, setP2] = useState<Point>({ x: 370, y: 170 });
    const [dragging, setDragging] = useState<"p0" | "p1" | "p2" | null>(null);
    const [hovering, setHovering] = useState<"p0" | "p1" | "p2" | null>(null);

    const isPointNear = (px: number, py: number, point: Point) => {
        const dx = px - point.x;
        const dy = py - point.y;
        return Math.sqrt(dx * dx + dy * dy) <= CONTROL_POINT_RADIUS + 5;
    };

    const findNearestPoint = (x: number, y: number): "p0" | "p1" | "p2" | null => {
        if (isPointNear(x, y, p1)) return "p1";
        if (isPointNear(x, y, p0)) return "p0";
        if (isPointNear(x, y, p2)) return "p2";
        return null;
    };

    const handleDragBegin = useCallback(
        (startX: number, startY: number) => {
            const point = findNearestPoint(startX, startY);
            if (point) {
                setDragging(point);
            }
        },
        [p0, p1, p2],
    );

    const handleDragUpdate = useCallback(
        (offsetX: number, offsetY: number) => {
            if (!dragging) return;

            const area = areaRef.current;
            if (!area) return;

            const width = area.getWidth();
            const height = area.getHeight();

            const updatePoint = dragging === "p0" ? setP0 : dragging === "p1" ? setP1 : setP2;
            const currentPoint = dragging === "p0" ? p0 : dragging === "p1" ? p1 : p2;

            const newX = Math.max(10, Math.min(width - 10, currentPoint.x + offsetX));
            const newY = Math.max(10, Math.min(height - 10, currentPoint.y + offsetY));

            updatePoint({ x: newX, y: newY });
        },
        [dragging, p0, p1, p2],
    );

    const handleDragEnd = useCallback(() => {
        setDragging(null);
    }, []);

    const handleMotion = useCallback(
        (x: number, y: number) => {
            const point = findNearestPoint(x, y);
            setHovering(point);
        },
        [p0, p1, p2],
    );

    const handleLeave = useCallback(() => {
        setHovering(null);
    }, []);

    const drawInteractiveBezier = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
            cr.setSourceRgb(1, 1, 1).rectangle(0, 0, width, height).fill();

            cr.setSourceRgba(0.8, 0.8, 0.8, 0.5).setLineWidth(1);
            cr.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke();

            cr.setSourceRgba(0.4, 0.6, 0.9, 0.4)
                .setLineWidth(3)
                .setLineCap(LineCap.ROUND)
                .moveTo(p0.x, p0.y)
                .curveTo(
                    p0.x + (p1.x - p0.x) * 0.66,
                    p0.y + (p1.y - p0.y) * 0.66,
                    p1.x + (p2.x - p1.x) * 0.33,
                    p1.y + (p2.y - p1.y) * 0.33,
                    p2.x,
                    p2.y,
                )
                .stroke();

            cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.BOLD).setFontSize(fontSize);

            const numSamples = 100;
            let pathLength = 0;
            let prevPoint = p0;
            for (let i = 1; i <= numSamples; i++) {
                const t = i / numSamples;
                const point = getQuadraticBezierPoint(t, p0, p1, p2);
                pathLength += Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                prevPoint = point;
            }

            const charWidth = pathLength / (text.length + 2);
            let currentLength = charWidth;

            cr.setSourceRgb(0.2, 0.4, 0.8);

            for (let i = 0; i < text.length; i++) {
                let t = 0;
                let accumulatedLength = 0;
                prevPoint = p0;

                for (let j = 1; j <= numSamples; j++) {
                    const testT = j / numSamples;
                    const point = getQuadraticBezierPoint(testT, p0, p1, p2);
                    const segmentLength = Math.sqrt((point.x - prevPoint.x) ** 2 + (point.y - prevPoint.y) ** 2);
                    accumulatedLength += segmentLength;

                    if (accumulatedLength >= currentLength) {
                        t = testT;
                        break;
                    }
                    prevPoint = point;
                }

                const pos = getQuadraticBezierPoint(t, p0, p1, p2);
                const angle = getQuadraticBezierTangent(t, p0, p1, p2);

                cr.save()
                    .translate(pos.x, pos.y)
                    .rotate(angle)
                    .moveTo(-charWidth / 4, fontSize / 3)
                    .showText(text.charAt(i));
                cr.restore();

                currentLength += charWidth;
            }

            const drawControlPoint = (point: Point, label: string, isHovered: boolean, isDragged: boolean) => {
                const radius = isDragged ? CONTROL_POINT_RADIUS + 3 : isHovered ? CONTROL_POINT_RADIUS + 2 : CONTROL_POINT_RADIUS;

                if (label === "Control") {
                    cr.setSourceRgba(0.9, 0.5, 0.1, isDragged ? 1 : isHovered ? 0.9 : 0.7);
                } else {
                    cr.setSourceRgba(0.2, 0.7, 0.4, isDragged ? 1 : isHovered ? 0.9 : 0.7);
                }
                cr.arc(point.x, point.y, radius, 0, 2 * Math.PI).fill();

                cr.setSourceRgb(1, 1, 1).setFontSize(10);
                const textWidth = label.length * 5;
                cr.moveTo(point.x - textWidth / 2, point.y + 3).showText(label);
            };

            drawControlPoint(p0, "Start", hovering === "p0", dragging === "p0");
            drawControlPoint(p2, "End", hovering === "p2", dragging === "p2");
            drawControlPoint(p1, "Control", hovering === "p1", dragging === "p1");
        },
        [p0, p1, p2, text, fontSize, hovering, dragging],
    );

    const handleReset = () => {
        setP0({ x: 30, y: 170 });
        setP1({ x: 200, y: 20 });
        setP2({ x: 370, y: 170 });
    };

    return (
        <GtkFrame label="Interactive Bezier Curve">
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                marginTop={12}
                marginBottom={12}
                marginStart={12}
                marginEnd={12}
            >
                <GtkLabel
                    label="Drag the control points to reshape the curve. The text follows the path in real-time."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />

                <GtkDrawingArea
                    ref={areaRef}
                    onDraw={drawInteractiveBezier}
                    contentWidth={400}
                    contentHeight={200}
                    cssClasses={["card"]}
                    halign={Gtk.Align.CENTER}
                    onGestureDragBegin={handleDragBegin}
                    onGestureDragUpdate={handleDragUpdate}
                    onGestureDragEnd={handleDragEnd}
                    onMotion={handleMotion}
                    onLeave={handleLeave}
                />

                <GtkBox spacing={12}>
                    <GtkLabel label="Text:" cssClasses={["dim-label"]} />
                    <GtkEntry text={text} onChanged={(entry) => setText(entry.getText())} hexpand />
                </GtkBox>

                <GtkBox spacing={12}>
                    <GtkLabel label="Size:" cssClasses={["dim-label"]} />
                    <GtkScale drawValue valuePos={Gtk.PositionType.RIGHT} hexpand>
                        <x.Adjustment
                            value={fontSize}
                            lower={10}
                            upper={40}
                            stepIncrement={1}
                            pageIncrement={5}
                            onValueChanged={setFontSize}
                        />
                    </GtkScale>
                    <GtkButton label="Reset" cssClasses={["flat"]} onClicked={handleReset} />
                </GtkBox>
            </GtkBox>
        </GtkFrame>
    );
};

const drawTextOnWave = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const text = "Wavy Text Animation";
    const fontSize = 20;
    const amplitude = 30;
    const frequency = 2;

    cr.setSourceRgba(0.6, 0.6, 0.6, 0.4)
        .setLineWidth(1)
        .moveTo(20, height / 2);
    for (let x = 20; x < width - 20; x++) {
        const y = height / 2 + Math.sin(((x - 20) / (width - 40)) * frequency * Math.PI * 2) * amplitude;
        cr.lineTo(x, y);
    }
    cr.stroke();

    cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.NORMAL).setFontSize(fontSize);

    cr.setSourceRgb(0.8, 0.3, 0.5);
    const charSpacing = (width - 60) / text.length;

    for (let i = 0; i < text.length; i++) {
        const x = 30 + i * charSpacing;
        const normalizedX = (x - 20) / (width - 40);
        const y = height / 2 + Math.sin(normalizedX * frequency * Math.PI * 2) * amplitude;
        const angle = Math.atan2(
            (Math.cos(normalizedX * frequency * Math.PI * 2) * amplitude * frequency * Math.PI * 2) / (width - 40),
            1,
        );

        cr.save()
            .translate(x, y)
            .rotate(angle)
            .moveTo(0, fontSize / 3)
            .showText(text.charAt(i));
        cr.restore();
    }
};

const drawTextOnCircle = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const text = "Circular Path Text - Goes Around - ";
    const fontSize = 16;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 30;

    cr.setSourceRgba(0.6, 0.6, 0.6, 0.4)
        .setLineWidth(1)
        .arc(centerX, centerY, radius, 0, 2 * Math.PI)
        .stroke();

    cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.NORMAL).setFontSize(fontSize);

    const angleStep = (2 * Math.PI) / text.length;

    cr.setSourceRgb(0.3, 0.7, 0.4);

    for (let i = 0; i < text.length; i++) {
        const angle = -Math.PI / 2 + i * angleStep;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        cr.save()
            .translate(x, y)
            .rotate(angle + Math.PI / 2)
            .moveTo(-fontSize / 4, 0)
            .showText(text.charAt(i));
        cr.restore();
    }
};

const drawTextOnSpiral = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
    const text = "Spiral text winds inward towards the center...";
    const fontSize = 12;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 20;
    const minRadius = 20;
    const totalRotations = 2.5;

    cr.setSourceRgba(0.6, 0.6, 0.6, 0.3).setLineWidth(1);
    for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const angle = t * totalRotations * 2 * Math.PI;
        const radius = maxRadius - t * (maxRadius - minRadius);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
            cr.moveTo(x, y);
        } else {
            cr.lineTo(x, y);
        }
    }
    cr.stroke();

    cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.NORMAL).setFontSize(fontSize).setSourceRgb(0.6, 0.4, 0.8);

    for (let i = 0; i < text.length; i++) {
        const t = i / text.length;
        const angle = t * totalRotations * 2 * Math.PI;
        const radius = maxRadius - t * (maxRadius - minRadius);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        cr.save()
            .translate(x, y)
            .rotate(angle + Math.PI / 2)
            .moveTo(0, fontSize / 3)
            .showText(text.charAt(i));
        cr.restore();
    }
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

const PathTextDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Text Along Paths" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Position text glyphs along curved paths. Each character is positioned and rotated to follow the path tangent."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <InteractiveBezierDemo />

            <GtkFrame label="Trigonometric Paths">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas width={320} height={120} drawFunc={drawTextOnWave} label="Sine Wave Path" />
                    <DrawingCanvas width={200} height={200} drawFunc={drawTextOnCircle} label="Circular Path" />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Spiral Path">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <DrawingCanvas width={250} height={250} drawFunc={drawTextOnSpiral} label="Archimedean Spiral" />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathTextDemo: Demo = {
    id: "path-text",
    title: "Path/Text",
    description: "Position text glyphs along curved paths with interactive control points",
    keywords: ["path", "text", "curve", "bezier", "circle", "spiral", "wave", "glyphs", "typography", "interactive"],
    component: PathTextDemo,
    sourceCode,
};
