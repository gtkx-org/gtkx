import { type Context, LineCap } from "@gtkx/ffi/cairo";
import type * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel, GtkScale, GtkSpinButton, x } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-walk.tsx?raw";

type PathPoint = { x: number; y: number; angle: number };

const getCubicBezierPoint = (
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
): PathPoint => {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const px = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
    const py = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

    const dx = 3 * uu * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * tt * (p3.x - p2.x);
    const dy = 3 * uu * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * tt * (p3.y - p2.y);
    const angle = Math.atan2(dy, dx);

    return { x: px, y: py, angle };
};

interface PathSegment {
    p0: { x: number; y: number };
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    p3: { x: number; y: number };
}

const buildPathTable = (
    segments: PathSegment[],
    numSamplesPerSegment: number = 100,
): { points: PathPoint[]; totalLength: number; lengths: number[] } => {
    const points: PathPoint[] = [];
    const lengths: number[] = [0];
    let totalLength = 0;

    for (const seg of segments) {
        for (let i = 0; i <= numSamplesPerSegment; i++) {
            if (i === 0 && points.length > 0) continue;
            const t = i / numSamplesPerSegment;
            const point = getCubicBezierPoint(t, seg.p0, seg.p1, seg.p2, seg.p3);
            points.push(point);

            if (points.length > 1) {
                const prev = points[points.length - 2] as PathPoint;
                const segmentLength = Math.sqrt((point.x - prev.x) ** 2 + (point.y - prev.y) ** 2);
                totalLength += segmentLength;
                lengths.push(totalLength);
            }
        }
    }

    return { points, totalLength, lengths };
};

const getPointAtLength = (
    targetLength: number,
    pathTable: { points: PathPoint[]; totalLength: number; lengths: number[] },
): PathPoint => {
    const { points, lengths, totalLength } = pathTable;

    const normalizedLength = ((targetLength % totalLength) + totalLength) % totalLength;

    let low = 0;
    let high = lengths.length - 1;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if ((lengths[mid] as number) < normalizedLength) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    const idx = Math.max(0, low - 1);
    const nextIdx = Math.min(lengths.length - 1, idx + 1);

    if (idx === nextIdx) {
        return points[idx] as PathPoint;
    }

    const segmentStart = lengths[idx] as number;
    const segmentEnd = lengths[nextIdx] as number;
    const segmentLength = segmentEnd - segmentStart;
    const t = segmentLength > 0 ? (normalizedLength - segmentStart) / segmentLength : 0;

    const p1 = points[idx] as PathPoint;
    const p2 = points[nextIdx] as PathPoint;

    return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
        angle: p1.angle + (p2.angle - p1.angle) * t,
    };
};

const drawArrow = (cr: Context, x: number, y: number, angle: number, size: number, alpha: number = 1) => {
    cr.save().translate(x, y).rotate(angle);

    cr.setSourceRgba(0.9, 0.4, 0.2, alpha)
        .moveTo(size * 0.5, 0)
        .lineTo(-size * 0.3, -size * 0.35)
        .lineTo(-size * 0.1, 0)
        .lineTo(-size * 0.3, size * 0.35)
        .closePath()
        .fill();

    cr.restore();
};

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const ARROW_SIZE = 12;
const DEFAULT_ARROW_COUNT = 100;
const DEFAULT_SPACING = 15;

const PathWalkDemo = () => {
    const areaRef = useRef<Gtk.DrawingArea | null>(null);
    const [speed, setSpeed] = useState(1);
    const [arrowCount, setArrowCount] = useState(DEFAULT_ARROW_COUNT);
    const [spacing, setSpacing] = useState(DEFAULT_SPACING);
    const [isRunning, setIsRunning] = useState(true);
    const [showPath, setShowPath] = useState(true);
    const progressRef = useRef(0);
    const tickIdRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number | null>(null);
    const speedRef = useRef(speed);
    speedRef.current = speed;

    const pathSegments = useMemo<PathSegment[]>(() => {
        const padding = 50;
        const w = CANVAS_WIDTH;
        const h = CANVAS_HEIGHT;

        return [
            {
                p0: { x: padding, y: h - padding },
                p1: { x: w * 0.2, y: padding },
                p2: { x: w * 0.3, y: h - padding },
                p3: { x: w * 0.4, y: h / 2 },
            },
            {
                p0: { x: w * 0.4, y: h / 2 },
                p1: { x: w * 0.5, y: padding },
                p2: { x: w * 0.6, y: h - padding },
                p3: { x: w * 0.7, y: h / 2 },
            },
            {
                p0: { x: w * 0.7, y: h / 2 },
                p1: { x: w * 0.8, y: padding },
                p2: { x: w * 0.9, y: h - padding },
                p3: { x: w - padding, y: padding },
            },
        ];
    }, []);

    const pathTable = useMemo(() => buildPathTable(pathSegments), [pathSegments]);

    const drawScene = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, _width: number, _height: number) => {
            const progress = progressRef.current;
            const { totalLength } = pathTable;

            if (showPath) {
                cr.setSourceRgba(0.5, 0.5, 0.5, 0.3).setLineWidth(2).setLineCap(LineCap.ROUND);

                for (const seg of pathSegments) {
                    cr.moveTo(seg.p0.x, seg.p0.y).curveTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
                }
                cr.stroke();
            }

            const baseDistance = progress * totalLength;
            const actualSpacing = spacing;

            for (let i = 0; i < arrowCount; i++) {
                const distance = baseDistance - i * actualSpacing;
                const point = getPointAtLength(distance, pathTable);

                const depthFactor = 1 - i / arrowCount;
                const alpha = 0.3 + depthFactor * 0.7;
                const size = ARROW_SIZE * (0.6 + depthFactor * 0.4);

                drawArrow(cr, point.x, point.y, point.angle, size, alpha);
            }
        },
        [pathSegments, pathTable, showPath, arrowCount, spacing],
    );

    const tickCallback = useCallback((_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
        const frameTime = frameClock.getFrameTime();
        if (lastFrameTimeRef.current !== null) {
            const delta = (frameTime - lastFrameTimeRef.current) / 1_000_000;
            progressRef.current = (progressRef.current + delta * 0.15 * speedRef.current) % 1;
            areaRef.current?.queueDraw();
        }
        lastFrameTimeRef.current = frameTime;
        return true;
    }, []);

    const startAnimation = useCallback(() => {
        const area = areaRef.current;
        if (!area || tickIdRef.current !== null) return;
        lastFrameTimeRef.current = null;
        tickIdRef.current = area.addTickCallback(tickCallback);
    }, [tickCallback]);

    const stopAnimation = useCallback(() => {
        const area = areaRef.current;
        if (!area || tickIdRef.current === null) return;
        area.removeTickCallback(tickIdRef.current);
        tickIdRef.current = null;
        lastFrameTimeRef.current = null;
    }, []);

    const handleAreaRef = useCallback((area: Gtk.DrawingArea | null) => {
        if (areaRef.current && tickIdRef.current !== null) {
            areaRef.current.removeTickCallback(tickIdRef.current);
            tickIdRef.current = null;
        }
        areaRef.current = area;
    }, []);

    const handleToggleRunning = useCallback(() => {
        setIsRunning((prev) => {
            if (prev) {
                stopAnimation();
            } else {
                startAnimation();
            }
            return !prev;
        });
    }, [startAnimation, stopAnimation]);

    useEffect(() => {
        if (isRunning) {
            startAnimation();
        }
        return stopAnimation;
    }, [isRunning, startAnimation, stopAnimation]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Path Walk" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Multiple arrows following a bezier path with proper tangent rotation. Each arrow maintains constant spacing using arc-length parameterization."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Arrow Stream">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkDrawingArea
                        ref={handleAreaRef}
                        onDraw={drawScene}
                        contentWidth={CANVAS_WIDTH}
                        contentHeight={CANVAS_HEIGHT}
                        cssClasses={["card"]}
                        halign={Gtk.Align.CENTER}
                    />

                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Arrows:" widthChars={8} xalign={0} cssClasses={["dim-label"]} />
                            <GtkSpinButton widthChars={5}>
                                <x.Adjustment
                                    value={arrowCount}
                                    lower={10}
                                    upper={500}
                                    stepIncrement={10}
                                    pageIncrement={50}
                                    onValueChanged={(v) => setArrowCount(Math.round(v))}
                                />
                            </GtkSpinButton>
                        </GtkBox>

                        <GtkBox spacing={8}>
                            <GtkLabel label="Spacing:" widthChars={8} xalign={0} cssClasses={["dim-label"]} />
                            <GtkSpinButton widthChars={5}>
                                <x.Adjustment
                                    value={spacing}
                                    lower={5}
                                    upper={50}
                                    stepIncrement={1}
                                    pageIncrement={5}
                                    onValueChanged={(v) => setSpacing(Math.round(v))}
                                />
                            </GtkSpinButton>
                        </GtkBox>
                    </GtkBox>

                    <GtkBox spacing={16} halign={Gtk.Align.CENTER}>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Speed:" cssClasses={["dim-label"]} />
                            <GtkScale drawValue valuePos={Gtk.PositionType.RIGHT} digits={1} widthRequest={120}>
                                <x.Adjustment
                                    value={speed}
                                    lower={0.2}
                                    upper={3}
                                    stepIncrement={0.1}
                                    pageIncrement={0.5}
                                    onValueChanged={setSpeed}
                                />
                            </GtkScale>
                        </GtkBox>
                        <GtkButton
                            label={isRunning ? "Pause" : "Play"}
                            onClicked={handleToggleRunning}
                            cssClasses={isRunning ? ["destructive-action"] : ["suggested-action"]}
                        />
                        <GtkButton
                            label={showPath ? "Hide Path" : "Show Path"}
                            onClicked={() => setShowPath(!showPath)}
                            cssClasses={["flat"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Implementation">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={6}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Arc-length table" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                        <GtkLabel label="Pre-computed cumulative path lengths" cssClasses={["dim-label"]} />
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel label="Binary search" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                        <GtkLabel label="O(log n) lookup for position at distance" cssClasses={["dim-label"]} />
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel label="Tangent angle" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                        <GtkLabel label="atan2(dy, dx) from curve derivative" cssClasses={["dim-label"]} />
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel label="Depth fade" widthChars={16} xalign={0} cssClasses={["monospace"]} />
                        <GtkLabel label="Size and opacity decrease for trailing arrows" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathWalkDemo: Demo = {
    id: "path-walk",
    title: "Path/Walk",
    description: "Multiple arrows following bezier paths with arc-length parameterization",
    keywords: ["path", "walk", "animation", "bezier", "tangent", "rotation", "arc-length", "arrows", "stream"],
    component: PathWalkDemo,
    sourceCode,
};
