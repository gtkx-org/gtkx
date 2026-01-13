import { type Context, FontSlant, FontWeight, LineCap, LineJoin } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkLabel } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./path-explorer.tsx?raw";

interface Point {
    x: number;
    y: number;
}

type SegmentType = "line" | "quadratic" | "cubic";

interface PathSegment {
    type: SegmentType;
    points: Point[];
}

interface PathData {
    start: Point;
    segments: PathSegment[];
}

const createDefaultPath = (width: number, height: number): PathData => ({
    start: { x: 50, y: height / 2 },
    segments: [
        {
            type: "cubic",
            points: [
                { x: 100, y: 50 },
                { x: 200, y: height - 50 },
                { x: 250, y: height / 2 },
            ],
        },
        {
            type: "quadratic",
            points: [
                { x: 350, y: 50 },
                { x: 400, y: height / 2 },
            ],
        },
        {
            type: "line",
            points: [{ x: width - 50, y: height / 2 }],
        },
    ],
});

const hitTest = (point: Point, target: Point, radius: number = 15): boolean => {
    const dx = point.x - target.x;
    const dy = point.y - target.y;
    return dx * dx + dy * dy <= radius * radius;
};

const PathExplorerDemo = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const canvasWidth = 500;
    const canvasHeight = 350;

    const [path, setPath] = useState<PathData>(() => createDefaultPath(canvasWidth, canvasHeight));
    const [selectedPoint, setSelectedPoint] = useState<{ segmentIdx: number; pointIdx: number } | "start" | null>(null);
    const [showHandles, setShowHandles] = useState(true);
    const [showPath, setShowPath] = useState(true);
    const [strokeWidth] = useState(3);

    const dragStartRef = useRef<Point | null>(null);
    const originalPointRef = useRef<Point | null>(null);

    const getAllPoints = useCallback((): { point: Point; id: { segmentIdx: number; pointIdx: number } | "start" }[] => {
        const points: { point: Point; id: { segmentIdx: number; pointIdx: number } | "start" }[] = [
            { point: path.start, id: "start" },
        ];

        path.segments.forEach((segment, segmentIdx) => {
            segment.points.forEach((point, pointIdx) => {
                points.push({ point, id: { segmentIdx, pointIdx } });
            });
        });

        return points;
    }, [path]);

    const drawPath = useCallback(
        (_self: Gtk.DrawingArea, cr: Context, _width: number, _height: number) => {
            if (showPath) {
                cr.setSourceRgb(0.2, 0.5, 0.8)
                    .setLineWidth(strokeWidth)
                    .setLineCap(LineCap.ROUND)
                    .setLineJoin(LineJoin.ROUND)
                    .moveTo(path.start.x, path.start.y);

                let currentPoint = path.start;
                for (const segment of path.segments) {
                    switch (segment.type) {
                        case "line": {
                            const endpoint = segment.points[0];
                            if (endpoint) {
                                cr.lineTo(endpoint.x, endpoint.y);
                                currentPoint = endpoint;
                            }
                            break;
                        }
                        case "quadratic": {
                            const ctrl = segment.points[0];
                            const end = segment.points[1];
                            if (ctrl && end) {
                                const cp1x = currentPoint.x + (2 / 3) * (ctrl.x - currentPoint.x);
                                const cp1y = currentPoint.y + (2 / 3) * (ctrl.y - currentPoint.y);
                                const cp2x = end.x + (2 / 3) * (ctrl.x - end.x);
                                const cp2y = end.y + (2 / 3) * (ctrl.y - end.y);
                                cr.curveTo(cp1x, cp1y, cp2x, cp2y, end.x, end.y);
                                currentPoint = end;
                            }
                            break;
                        }
                        case "cubic": {
                            const p0 = segment.points[0];
                            const p1 = segment.points[1];
                            const p2 = segment.points[2];
                            if (p0 && p1 && p2) {
                                cr.curveTo(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
                                currentPoint = p2;
                            }
                            break;
                        }
                    }
                }
                cr.stroke();
            }

            if (showHandles) {
                cr.setSourceRgba(0.8, 0.4, 0.4, 0.6).setLineWidth(1);

                let prevPoint = path.start;
                for (const segment of path.segments) {
                    if (segment.type === "quadratic") {
                        const p0 = segment.points[0];
                        const p1 = segment.points[1];
                        if (p0 && p1) {
                            cr.moveTo(prevPoint.x, prevPoint.y).lineTo(p0.x, p0.y).lineTo(p1.x, p1.y).stroke();
                            prevPoint = p1;
                        }
                    } else if (segment.type === "cubic") {
                        const p0 = segment.points[0];
                        const p1 = segment.points[1];
                        const p2 = segment.points[2];
                        if (p0 && p1 && p2) {
                            cr.moveTo(prevPoint.x, prevPoint.y).lineTo(p0.x, p0.y).stroke();
                            cr.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke();
                            prevPoint = p2;
                        }
                    } else {
                        const p0 = segment.points[0];
                        if (p0) prevPoint = p0;
                    }
                }

                const allPoints = getAllPoints();
                for (const { point, id } of allPoints) {
                    const isSelected =
                        selectedPoint === id ||
                        (typeof selectedPoint === "object" &&
                            typeof id === "object" &&
                            selectedPoint?.segmentIdx === id.segmentIdx &&
                            selectedPoint?.pointIdx === id.pointIdx);

                    const isEndpoint =
                        id === "start" ||
                        (typeof id === "object" &&
                            ((path.segments[id.segmentIdx]?.type === "line" && id.pointIdx === 0) ||
                                (path.segments[id.segmentIdx]?.type === "quadratic" && id.pointIdx === 1) ||
                                (path.segments[id.segmentIdx]?.type === "cubic" && id.pointIdx === 2)));

                    if (isEndpoint) {
                        cr.setSourceRgb(isSelected ? 0.9 : 0.3, isSelected ? 0.3 : 0.6, isSelected ? 0.3 : 0.9)
                            .rectangle(point.x - 6, point.y - 6, 12, 12)
                            .fill();
                        cr.setSourceRgb(0.1, 0.1, 0.1)
                            .setLineWidth(1.5)
                            .rectangle(point.x - 6, point.y - 6, 12, 12)
                            .stroke();
                    } else {
                        cr.setSourceRgb(isSelected ? 0.9 : 0.9, isSelected ? 0.3 : 0.6, isSelected ? 0.3 : 0.3)
                            .arc(point.x, point.y, 6, 0, 2 * Math.PI)
                            .fill();
                        cr.setSourceRgb(0.1, 0.1, 0.1)
                            .setLineWidth(1.5)
                            .arc(point.x, point.y, 6, 0, 2 * Math.PI)
                            .stroke();
                    }
                }
            }

            cr.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.NORMAL)
                .setFontSize(11)
                .setSourceRgb(0.5, 0.5, 0.5)
                .moveTo(10, 20)
                .showText(`Segments: ${path.segments.length}`);

            if (selectedPoint) {
                const pointInfo =
                    selectedPoint === "start"
                        ? `Start (${Math.round(path.start.x)}, ${Math.round(path.start.y)})`
                        : `Segment ${selectedPoint.segmentIdx + 1}, Point ${selectedPoint.pointIdx + 1}`;
                cr.moveTo(10, 35).showText(`Selected: ${pointInfo}`);
            }
        },
        [path, selectedPoint, showHandles, showPath, strokeWidth, getAllPoints],
    );

    useEffect(() => {
        const area = ref.current;
        if (!area) return;

        area.setDrawFunc(drawPath);

        const drag = new Gtk.GestureDrag();

        drag.connect("drag-begin", (_gesture: Gtk.GestureDrag, startX: number, startY: number) => {
            dragStartRef.current = { x: startX, y: startY };

            const allPoints = getAllPoints();
            for (const { point, id } of allPoints) {
                if (hitTest({ x: startX, y: startY }, point)) {
                    setSelectedPoint(id);
                    if (id === "start") {
                        originalPointRef.current = { ...path.start };
                    } else {
                        const seg = path.segments[id.segmentIdx];
                        const pt = seg?.points[id.pointIdx];
                        if (pt) {
                            originalPointRef.current = { ...pt };
                        }
                    }
                    return;
                }
            }
            setSelectedPoint(null);
        });

        drag.connect("drag-update", (_gesture: Gtk.GestureDrag, offsetX: number, offsetY: number) => {
            if (!selectedPoint || !originalPointRef.current) return;

            const newX = Math.max(0, Math.min(canvasWidth, originalPointRef.current.x + offsetX));
            const newY = Math.max(0, Math.min(canvasHeight, originalPointRef.current.y + offsetY));

            if (selectedPoint === "start") {
                setPath((prev) => ({
                    ...prev,
                    start: { x: newX, y: newY },
                }));
            } else {
                setPath((prev) => {
                    const newSegments = [...prev.segments];
                    const existingSegment = newSegments[selectedPoint.segmentIdx];
                    if (!existingSegment) return prev;
                    const segment = { ...existingSegment };
                    segment.points = [...segment.points];
                    segment.points[selectedPoint.pointIdx] = { x: newX, y: newY };
                    newSegments[selectedPoint.segmentIdx] = segment;
                    return { ...prev, segments: newSegments };
                });
            }

            area.queueDraw();
        });

        drag.connect("drag-end", () => {
            dragStartRef.current = null;
            originalPointRef.current = null;
        });

        area.addController(drag);
    }, [drawPath, selectedPoint, getAllPoints, path]);

    useEffect(() => {
        if (ref.current) {
            ref.current.setDrawFunc(drawPath);
            ref.current.queueDraw();
        }
    }, [drawPath]);

    const handleReset = () => {
        setPath(createDefaultPath(canvasWidth, canvasHeight));
        setSelectedPoint(null);
    };

    const handleAddSegment = (type: SegmentType) => {
        setPath((prev) => {
            const lastSegment = prev.segments[prev.segments.length - 1];
            const lastPoint = lastSegment?.points[lastSegment.points.length - 1] ?? prev.start;

            let newSegment: PathSegment;
            switch (type) {
                case "line":
                    newSegment = {
                        type: "line",
                        points: [{ x: lastPoint.x + 50, y: lastPoint.y }],
                    };
                    break;
                case "quadratic":
                    newSegment = {
                        type: "quadratic",
                        points: [
                            { x: lastPoint.x + 25, y: lastPoint.y - 50 },
                            { x: lastPoint.x + 50, y: lastPoint.y },
                        ],
                    };
                    break;
                case "cubic":
                    newSegment = {
                        type: "cubic",
                        points: [
                            { x: lastPoint.x + 20, y: lastPoint.y - 40 },
                            { x: lastPoint.x + 40, y: lastPoint.y + 40 },
                            { x: lastPoint.x + 60, y: lastPoint.y },
                        ],
                    };
                    break;
            }

            return { ...prev, segments: [...prev.segments, newSegment] };
        });
    };

    const handleRemoveLastSegment = () => {
        setPath((prev) => {
            if (prev.segments.length === 0) return prev;
            return { ...prev, segments: prev.segments.slice(0, -1) };
        });
        setSelectedPoint(null);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Interactive Path Editor" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Drag control points to edit the path. Add or remove segments to build complex paths interactively."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Path Editor">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkDrawingArea
                        ref={ref}
                        contentWidth={canvasWidth}
                        contentHeight={canvasHeight}
                        cssClasses={["card"]}
                        halign={Gtk.Align.CENTER}
                    />

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={showPath ? "Hide Path" : "Show Path"}
                            onClicked={() => setShowPath(!showPath)}
                            cssClasses={["flat"]}
                        />
                        <GtkButton
                            label={showHandles ? "Hide Handles" : "Show Handles"}
                            onClicked={() => setShowHandles(!showHandles)}
                            cssClasses={["flat"]}
                        />
                        <GtkButton label="Reset" onClicked={handleReset} cssClasses={["destructive-action"]} />
                    </GtkBox>

                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkLabel label="Add:" cssClasses={["dim-label"]} />
                        <GtkButton label="Line" onClicked={() => handleAddSegment("line")} cssClasses={["flat"]} />
                        <GtkButton
                            label="Quadratic"
                            onClicked={() => handleAddSegment("quadratic")}
                            cssClasses={["flat"]}
                        />
                        <GtkButton label="Cubic" onClicked={() => handleAddSegment("cubic")} cssClasses={["flat"]} />
                        <GtkButton
                            label="Remove Last"
                            onClicked={handleRemoveLastSegment}
                            cssClasses={["flat"]}
                            sensitive={path.segments.length > 0}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Legend">
                <GtkBox
                    spacing={24}
                    marginTop={8}
                    marginBottom={8}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkLabel label="Square = Endpoint" cssClasses={["dim-label", "caption"]} />
                    <GtkLabel label="Circle = Control Point" cssClasses={["dim-label", "caption"]} />
                    <GtkLabel label="Red = Selected" cssClasses={["dim-label", "caption"]} />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathExplorerDemo: Demo = {
    id: "path-explorer",
    title: "Path/Path Explorer",
    description: "Interactive bezier path editor with drag handles",
    keywords: ["path", "editor", "bezier", "interactive", "drag", "control", "points", "handles", "curves"],
    component: PathExplorerDemo,
    sourceCode,
};
