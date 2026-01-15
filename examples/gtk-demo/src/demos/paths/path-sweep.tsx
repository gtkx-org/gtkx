import * as Graphene from "@gtkx/ffi/graphene";
import * as Gsk from "@gtkx/ffi/gsk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDrawingArea, GtkFrame, GtkLabel } from "@gtkx/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import worldMapData from "./path_world.txt?raw";
import sourceCode from "./path-sweep.tsx?raw";

const INTERSECTION_CIRCLE_RADIUS = 4;

type PathCommand = {
    type: "M" | "m" | "L" | "l" | "C" | "c" | "Z" | "z";
    values: number[];
};

const parsePathCommands = (pathStr: string): PathCommand[] => {
    const commands: PathCommand[] = [];
    const regex = /([MmLlCcZz])([^MmLlCcZz]*)/g;
    let match: RegExpExecArray | null = regex.exec(pathStr);

    while (match !== null) {
        const cmdChar = match[1];
        if (cmdChar) {
            const type = cmdChar as PathCommand["type"];
            const values = (match[2] ?? "")
                .trim()
                .split(/[\s,]+/)
                .filter((s) => s.length > 0)
                .map(Number)
                .filter((n) => !Number.isNaN(n));

            commands.push({ type, values });
        }
        match = regex.exec(pathStr);
    }

    return commands;
};

const renderPathToCairo = (cr: import("@gtkx/ffi/cairo").Context, commands: PathCommand[]) => {
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;

    for (const cmd of commands) {
        const { type, values } = cmd;

        switch (type) {
            case "M": {
                for (let i = 0; i < values.length; i += 2) {
                    currentX = values[i] ?? 0;
                    currentY = values[i + 1] ?? 0;
                    if (i === 0) {
                        cr.moveTo(currentX, currentY);
                        startX = currentX;
                        startY = currentY;
                    } else {
                        cr.lineTo(currentX, currentY);
                    }
                }
                break;
            }
            case "m": {
                for (let i = 0; i < values.length; i += 2) {
                    currentX += values[i] ?? 0;
                    currentY += values[i + 1] ?? 0;
                    if (i === 0) {
                        cr.moveTo(currentX, currentY);
                        startX = currentX;
                        startY = currentY;
                    } else {
                        cr.lineTo(currentX, currentY);
                    }
                }
                break;
            }
            case "L": {
                for (let i = 0; i < values.length; i += 2) {
                    currentX = values[i] ?? 0;
                    currentY = values[i + 1] ?? 0;
                    cr.lineTo(currentX, currentY);
                }
                break;
            }
            case "l": {
                for (let i = 0; i < values.length; i += 2) {
                    currentX += values[i] ?? 0;
                    currentY += values[i + 1] ?? 0;
                    cr.lineTo(currentX, currentY);
                }
                break;
            }
            case "C": {
                for (let i = 0; i < values.length; i += 6) {
                    const x1 = values[i] ?? 0;
                    const y1 = values[i + 1] ?? 0;
                    const x2 = values[i + 2] ?? 0;
                    const y2 = values[i + 3] ?? 0;
                    const x3 = values[i + 4] ?? 0;
                    const y3 = values[i + 5] ?? 0;
                    cr.curveTo(x1, y1, x2, y2, x3, y3);
                    currentX = x3;
                    currentY = y3;
                }
                break;
            }
            case "c": {
                for (let i = 0; i < values.length; i += 6) {
                    const x1 = currentX + (values[i] ?? 0);
                    const y1 = currentY + (values[i + 1] ?? 0);
                    const x2 = currentX + (values[i + 2] ?? 0);
                    const y2 = currentY + (values[i + 3] ?? 0);
                    const x3 = currentX + (values[i + 4] ?? 0);
                    const y3 = currentY + (values[i + 5] ?? 0);
                    cr.curveTo(x1, y1, x2, y2, x3, y3);
                    currentX = x3;
                    currentY = y3;
                }
                break;
            }
            case "Z":
            case "z": {
                cr.closePath();
                currentX = startX;
                currentY = startY;
                break;
            }
        }
    }
};

const PathSweepDemo = () => {
    const areaRef = useRef<Gtk.DrawingArea | null>(null);
    const [mouseY, setMouseY] = useState<number | null>(null);
    const [intersectionCount, setIntersectionCount] = useState(0);

    const worldPath = useMemo(() => {
        return Gsk.Path.parse(worldMapData);
    }, []);

    const pathCommands = useMemo(() => {
        return parsePathCommands(worldMapData);
    }, []);

    const pathBounds = useMemo(() => {
        if (!worldPath) return null;

        const stroke = new Gsk.Stroke(2.0);
        const bounds = new Graphene.Rect();
        worldPath.getStrokeBounds(stroke, bounds);

        return {
            x: bounds.getX(),
            y: bounds.getY(),
            width: bounds.getWidth(),
            height: bounds.getHeight(),
        };
    }, [worldPath]);

    const handleMotion = useCallback((_x: number, y: number) => {
        setMouseY(y);
        areaRef.current?.queueDraw();
    }, []);

    const handleEnter = useCallback((_x: number, y: number) => {
        setMouseY(y);
        areaRef.current?.queueDraw();
    }, []);

    const handleLeave = useCallback(() => {
        setMouseY(null);
        setIntersectionCount(0);
        areaRef.current?.queueDraw();
    }, []);

    const drawScene = useCallback(
        (_self: Gtk.DrawingArea, cr: import("@gtkx/ffi/cairo").Context, _width: number, _height: number) => {
            if (!worldPath || !pathBounds) return;

            cr.setSourceRgb(0.1, 0.1, 0.1).setLineWidth(1.5);
            renderPathToCairo(cr, pathCommands);
            cr.stroke();

            if (mouseY !== null) {
                cr.setSourceRgba(0.2, 0.2, 0.2, 0.8).setLineWidth(1);
                cr.moveTo(pathBounds.x - 10, mouseY);
                cr.lineTo(pathBounds.x + pathBounds.width + 10, mouseY);
                cr.stroke();

                const lineBuilder = new Gsk.PathBuilder();
                lineBuilder.moveTo(pathBounds.x - 10, mouseY);
                lineBuilder.lineTo(pathBounds.x + pathBounds.width + 10, mouseY);
                const linePath = lineBuilder.toPath();

                const intersections: { x: number; y: number }[] = [];

                worldPath.foreachIntersection(
                    (
                        path1: Gsk.Path,
                        point1: Gsk.PathPoint,
                        _path2: Gsk.Path,
                        _point2: Gsk.PathPoint,
                        _kind: Gsk.PathIntersection,
                    ) => {
                        const pos = new Graphene.Point();
                        point1.getPosition(path1, pos);
                        intersections.push({ x: pos.x, y: pos.y });
                        return true;
                    },
                    linePath,
                );

                setIntersectionCount(intersections.length);

                cr.setSourceRgb(0.9, 0.2, 0.2);
                for (const pt of intersections) {
                    cr.arc(pt.x, pt.y, INTERSECTION_CIRCLE_RADIUS, 0, 2 * Math.PI).fill();
                }

                cr.setSourceRgb(0.1, 0.1, 0.1).setLineWidth(1);
                for (const pt of intersections) {
                    cr.arc(pt.x, pt.y, INTERSECTION_CIRCLE_RADIUS, 0, 2 * Math.PI).stroke();
                }
            }
        },
        [worldPath, pathBounds, pathCommands, mouseY],
    );

    const contentWidth = pathBounds ? Math.ceil(pathBounds.width) + 20 : 800;
    const contentHeight = pathBounds ? Math.ceil(pathBounds.height) + 20 : 400;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Path Sweep Intersections" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Move your cursor over the world map to see path intersection detection in real-time. A horizontal sweep line follows your cursor and red dots appear where it intersects the map boundaries."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="World Map">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkDrawingArea
                        ref={areaRef}
                        onDraw={drawScene}
                        onMotion={handleMotion}
                        onEnter={handleEnter}
                        onLeave={handleLeave}
                        contentWidth={contentWidth}
                        contentHeight={contentHeight}
                        cssClasses={["card"]}
                        halign={Gtk.Align.CENTER}
                    />
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkLabel
                            label={mouseY !== null ? `Y Position: ${Math.round(mouseY)}px` : "Move cursor over map"}
                            cssClasses={["monospace", "dim-label"]}
                            widthChars={24}
                        />
                        <GtkLabel
                            label={`Intersections: ${intersectionCount}`}
                            cssClasses={["monospace", mouseY !== null ? [] : "dim-label"].flat()}
                            widthChars={18}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="How It Works">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={6}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Path.parse()" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                        <GtkLabel
                            label="Load world map from SVG path data (211 lines, 1569 curves)"
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel label="foreachIntersection()" widthChars={20} xalign={0} cssClasses={["monospace"]} />
                        <GtkLabel
                            label="Find all points where sweep line crosses map boundaries"
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel
                            label="PathPoint.getPosition()"
                            widthChars={20}
                            xalign={0}
                            cssClasses={["monospace"]}
                        />
                        <GtkLabel
                            label="Extract X,Y coordinates from each intersection point"
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel
                            label="onMotion/onEnter/onLeave"
                            widthChars={20}
                            xalign={0}
                            cssClasses={["monospace"]}
                        />
                        <GtkLabel label="Declarative cursor tracking via React props" cssClasses={["dim-label"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const pathSweepDemo: Demo = {
    id: "path-sweep",
    title: "Path/Sweep",
    description: "World map with real-time path intersection detection",
    keywords: ["path", "sweep", "intersection", "world", "map", "foreachIntersection", "PathPoint", "detection"],
    component: PathSweepDemo,
    sourceCode,
};
