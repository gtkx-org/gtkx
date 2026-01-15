import { css } from "@gtkx/css";
import type * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkFixed, GtkFrame, x } from "@gtkx/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./layoutmanager.tsx?raw";

const CHILD_COUNT = 16;
const COLUMNS = 4;
const CHILD_SIZE = 50;
const CONTAINER_SIZE = 500;
const MARGIN = 4;

const COLORS = [
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "grey",
    "magenta",
    "lime",
    "yellow",
    "firebrick",
    "aqua",
    "purple",
    "tomato",
    "pink",
    "thistle",
    "maroon",
];

const childStyles = COLORS.map(
    (color) => css`
        frame& {
            background-color: ${color};
        }
    `,
);

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

interface ChildData {
    id: number;
    circlePosition: number;
}

/**
 * Layout Manager/Transition demo matching the official GTK gtk-demo.
 * Shows a custom layout manager placing children in a grid or circle,
 * animating the transition between layouts.
 */
const LayoutManagerDemo = () => {
    const [transitionProgress, setTransitionProgress] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [targetProgress, setTargetProgress] = useState(0);

    const fixedRef = useRef<Gtk.Fixed | null>(null);
    const tickIdRef = useRef<number | null>(null);
    const animStartTimeRef = useRef<number | null>(null);
    const animStartProgressRef = useRef<number>(0);

    const [children, setChildren] = useState<ChildData[]>(() =>
        Array.from({ length: CHILD_COUNT }, (_, i) => ({
            id: i,
            circlePosition: i,
        })),
    );

    const centerX = CONTAINER_SIZE / 2;
    const centerY = CONTAINER_SIZE / 2;
    const gridCellSize = CHILD_SIZE + MARGIN * 2;
    const circleRadius = (COLUMNS * gridCellSize) / Math.PI;

    const getGridPosition = useCallback(
        (index: number) => {
            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);
            const gridWidth = COLUMNS * gridCellSize;
            const gridHeight = COLUMNS * gridCellSize;
            const startX = centerX - gridWidth / 2;
            const startY = centerY - gridHeight / 2;
            return {
                x: startX + col * gridCellSize + MARGIN,
                y: startY + row * gridCellSize + MARGIN,
            };
        },
        [centerX, centerY, gridCellSize],
    );

    const getCirclePosition = useCallback(
        (circlePos: number) => {
            const angle = (circlePos * Math.PI) / (CHILD_COUNT / 2);
            return {
                x: centerX + Math.sin(angle) * circleRadius - CHILD_SIZE / 2,
                y: centerY + Math.cos(angle) * circleRadius - CHILD_SIZE / 2,
            };
        },
        [centerX, centerY, circleRadius],
    );

    const getChildPosition = useCallback(
        (index: number, circlePos: number, t: number) => {
            const grid = getGridPosition(index);
            const circle = getCirclePosition(circlePos);
            const easedT = easeInOutCubic(t);
            return {
                x: lerp(grid.x, circle.x, easedT),
                y: lerp(grid.y, circle.y, easedT),
            };
        },
        [getGridPosition, getCirclePosition],
    );

    const ANIM_DURATION_MS = 500;

    const tickCallback = useCallback(
        (_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
            const frameTime = frameClock.getFrameTime();

            if (animStartTimeRef.current === null) {
                animStartTimeRef.current = frameTime;
                animStartProgressRef.current = transitionProgress;
            }

            const elapsed = (frameTime - animStartTimeRef.current) / 1000;
            const duration = ANIM_DURATION_MS;
            const rawT = Math.min(elapsed / duration, 1);

            const startP = animStartProgressRef.current;
            const endP = targetProgress;
            const newProgress = lerp(startP, endP, rawT);

            setTransitionProgress(newProgress);

            if (rawT >= 1) {
                setIsAnimating(false);
                animStartTimeRef.current = null;
                return false;
            }

            return true;
        },
        [targetProgress, transitionProgress],
    );

    const startAnimation = useCallback(
        (newTarget: number) => {
            const fixed = fixedRef.current;
            if (!fixed) return;

            if (tickIdRef.current !== null) {
                fixed.removeTickCallback(tickIdRef.current);
            }

            setTargetProgress(newTarget);
            animStartTimeRef.current = null;
            animStartProgressRef.current = transitionProgress;
            tickIdRef.current = fixed.addTickCallback(tickCallback);
            setIsAnimating(true);
        },
        [tickCallback, transitionProgress],
    );

    const handleClick = useCallback(
        (_nPress: number, _x: number, _y: number) => {
            if (isAnimating) return;

            const newTarget = transitionProgress < 0.5 ? 1 : 0;

            if (newTarget === 0) {
                setChildren((prev) => {
                    const shuffled = [...prev];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        const itemI = shuffled[i];
                        const itemJ = shuffled[j];
                        if (itemI && itemJ) {
                            const temp = itemI.circlePosition;
                            itemI.circlePosition = itemJ.circlePosition;
                            itemJ.circlePosition = temp;
                        }
                    }
                    return shuffled;
                });
            }

            startAnimation(newTarget);
        },
        [isAnimating, transitionProgress, startAnimation],
    );

    useEffect(() => {
        return () => {
            if (fixedRef.current && tickIdRef.current !== null) {
                fixedRef.current.removeTickCallback(tickIdRef.current);
            }
        };
    }, []);

    const handleFixedRef = useCallback((fixed: Gtk.Fixed | null) => {
        if (fixedRef.current && tickIdRef.current !== null) {
            fixedRef.current.removeTickCallback(tickIdRef.current);
            tickIdRef.current = null;
        }
        fixedRef.current = fixed;
    }, []);

    const childPositions = useMemo(() => {
        return children.map((child, index) => ({
            ...child,
            position: getChildPosition(index, child.circlePosition, transitionProgress),
        }));
    }, [children, transitionProgress, getChildPosition]);

    return (
        <GtkFixed
            ref={handleFixedRef}
            widthRequest={CONTAINER_SIZE}
            heightRequest={CONTAINER_SIZE}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            onReleased={handleClick}
        >
            {childPositions.map((child) => (
                <x.FixedChild key={child.id} x={child.position.x} y={child.position.y}>
                    <GtkFrame
                        widthRequest={CHILD_SIZE}
                        heightRequest={CHILD_SIZE}
                        cssClasses={[childStyles[child.id] ?? ""]}
                    />
                </x.FixedChild>
            ))}
        </GtkFixed>
    );
};

export const layoutManagerDemo: Demo = {
    id: "layoutmanager",
    title: "Layout Manager/Transition",
    description:
        "This demo shows a simple example of a custom layout manager and a widget using it. The layout manager places the children of the widget in a grid or a circle. The widget is animating the transition between the two layouts. Click to start the transition.",
    keywords: ["layout", "GtkLayoutManager", "grid", "circle", "transition", "animation"],
    component: LayoutManagerDemo,
    sourceCode,
};
