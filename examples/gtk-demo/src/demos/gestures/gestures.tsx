import { css, cx } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkDrawingArea, GtkFrame, GtkImage, GtkLabel } from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./gestures.tsx?raw";

const gestureAreaStyle = css`
    background-color: alpha(@window_fg_color, 0.03);
    border-radius: 12px;
    min-height: 120px;
`;

const activeStyle = css`
    background-color: alpha(@accent_color, 0.15);
`;

const swipeIndicatorStyle = css`
    font-size: 32px;
`;

const GesturesDemo = () => {
    const [clickCount, setClickCount] = useState(0);
    const [clickType, setClickType] = useState<string | null>(null);
    const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

    const [swipeDirection, setSwipeDirection] = useState<string | null>(null);
    const [swipeVelocity, setSwipeVelocity] = useState<{ vx: number; vy: number } | null>(null);
    const swipeRef = useRef<Gtk.DrawingArea | null>(null);

    const [longPressActive, setLongPressActive] = useState(false);
    const [longPressPosition, setLongPressPosition] = useState<{ x: number; y: number } | null>(null);
    const longPressRef = useRef<Gtk.DrawingArea | null>(null);

    const [scale, setScale] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const zoomRotateRef = useRef<Gtk.DrawingArea | null>(null);

    const handleClick = useCallback((nPress: number, x: number, y: number) => {
        setClickCount((prev) => prev + 1);
        setClickPosition({ x: Math.round(x), y: Math.round(y) });
        if (nPress === 1) {
            setClickType("Single click");
        } else if (nPress === 2) {
            setClickType("Double click");
        } else if (nPress === 3) {
            setClickType("Triple click");
        } else {
            setClickType(`${nPress}x click`);
        }
    }, []);

    const handleDragBegin = useCallback((startX: number, startY: number) => {
        setIsDragging(true);
        setDragStart({ x: Math.round(startX), y: Math.round(startY) });
        setDragOffset({ x: 0, y: 0 });
    }, []);

    const handleDragUpdate = useCallback((offsetX: number, offsetY: number) => {
        setDragOffset({ x: Math.round(offsetX), y: Math.round(offsetY) });
    }, []);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        const widget = swipeRef.current;
        if (!widget) return;

        const swipe = new Gtk.GestureSwipe();
        swipe.connect("swipe", (_self, velocityX, velocityY) => {
            setSwipeVelocity({ vx: Math.round(velocityX), vy: Math.round(velocityY) });

            const absX = Math.abs(velocityX);
            const absY = Math.abs(velocityY);

            if (absX > absY) {
                setSwipeDirection(velocityX > 0 ? "→ Right" : "← Left");
            } else {
                setSwipeDirection(velocityY > 0 ? "↓ Down" : "↑ Up");
            }

            setTimeout(() => {
                setSwipeDirection(null);
                setSwipeVelocity(null);
            }, 1500);
        });
        widget.addController(swipe);
    }, []);

    useEffect(() => {
        const widget = longPressRef.current;
        if (!widget) return;

        const longPress = new Gtk.GestureLongPress();
        longPress.connect("pressed", (_self, x, y) => {
            setLongPressActive(true);
            setLongPressPosition({ x: Math.round(x), y: Math.round(y) });
        });
        longPress.connect("cancelled", () => {
            setLongPressActive(false);
        });
        widget.addController(longPress);

        const click = new Gtk.GestureClick();
        click.connect("released", () => {
            setLongPressActive(false);
        });
        widget.addController(click);
    }, []);

    useEffect(() => {
        const widget = zoomRotateRef.current;
        if (!widget) return;

        const zoom = new Gtk.GestureZoom();
        zoom.connect("scale-changed", (_self, newScale) => {
            setScale(newScale);
        });
        widget.addController(zoom);

        const rotate = new Gtk.GestureRotate();
        rotate.connect("angle-changed", (_self, _angle, angleDelta) => {
            setRotation(angleDelta * (180 / Math.PI));
        });
        widget.addController(rotate);
    }, []);

    const resetAll = useCallback(() => {
        setClickCount(0);
        setClickType(null);
        setClickPosition(null);
        setDragOffset({ x: 0, y: 0 });
        setDragStart(null);
        setSwipeDirection(null);
        setSwipeVelocity(null);
        setLongPressActive(false);
        setLongPressPosition(null);
        setScale(1.0);
        setRotation(0);
    }, []);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkBox spacing={12}>
                <GtkLabel label="Touch Gestures" cssClasses={["title-2"]} halign={Gtk.Align.START} hexpand />
                <GtkButton label="Reset All" onClicked={resetAll} cssClasses={["flat"]} />
            </GtkBox>

            <GtkLabel
                label="GTK provides gesture recognizers for handling multi-touch and pointer input. Try the interactive areas below to see gestures in action."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Click Gesture">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Click, double-click, or triple-click in the area below. The gesture recognizer tracks consecutive clicks."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkDrawingArea
                        contentWidth={400}
                        contentHeight={100}
                        cssClasses={[gestureAreaStyle]}
                        onPressed={handleClick}
                    />

                    <GtkBox spacing={24}>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Type:" cssClasses={["dim-label"]} />
                            <GtkLabel label={clickType ?? "—"} cssClasses={["heading"]} />
                        </GtkBox>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Position:" cssClasses={["dim-label"]} />
                            <GtkLabel
                                label={clickPosition ? `(${clickPosition.x}, ${clickPosition.y})` : "—"}
                                cssClasses={["monospace"]}
                            />
                        </GtkBox>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Total clicks:" cssClasses={["dim-label"]} />
                            <GtkLabel label={String(clickCount)} cssClasses={["monospace"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Drag Gesture">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Click and drag in the area below. The gesture tracks the offset from the starting point."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkDrawingArea
                        contentWidth={400}
                        contentHeight={100}
                        cssClasses={cx(gestureAreaStyle, isDragging && activeStyle)}
                        onGestureDragBegin={handleDragBegin}
                        onGestureDragUpdate={handleDragUpdate}
                        onGestureDragEnd={handleDragEnd}
                    />

                    <GtkBox spacing={24}>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Status:" cssClasses={["dim-label"]} />
                            <GtkLabel label={isDragging ? "Dragging" : "Idle"} cssClasses={["heading"]} />
                        </GtkBox>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Start:" cssClasses={["dim-label"]} />
                            <GtkLabel
                                label={dragStart ? `(${dragStart.x}, ${dragStart.y})` : "—"}
                                cssClasses={["monospace"]}
                            />
                        </GtkBox>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Offset:" cssClasses={["dim-label"]} />
                            <GtkLabel label={`(${dragOffset.x}, ${dragOffset.y})`} cssClasses={["monospace"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Swipe Gesture">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Quickly swipe (flick) in any direction. The gesture detects the velocity and direction of the movement."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkDrawingArea
                        ref={swipeRef}
                        contentWidth={400}
                        contentHeight={100}
                        cssClasses={cx(gestureAreaStyle, swipeDirection && activeStyle)}
                    />

                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        {swipeDirection ? (
                            <>
                                <GtkLabel label={swipeDirection} cssClasses={[swipeIndicatorStyle, "heading"]} />
                                {swipeVelocity && (
                                    <GtkLabel
                                        label={`${Math.abs(swipeVelocity.vx > swipeVelocity.vy ? swipeVelocity.vx : swipeVelocity.vy)} px/s`}
                                        cssClasses={["monospace", "dim-label"]}
                                    />
                                )}
                            </>
                        ) : (
                            <GtkLabel label="Swipe to see direction and velocity" cssClasses={["dim-label"]} />
                        )}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Long Press Gesture">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Press and hold in the area below. The gesture triggers after the system-defined delay (typically 500ms)."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkDrawingArea
                        ref={longPressRef}
                        contentWidth={400}
                        contentHeight={100}
                        cssClasses={cx(gestureAreaStyle, longPressActive && activeStyle)}
                    />

                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        {longPressActive ? (
                            <>
                                <GtkImage iconName="emblem-ok-symbolic" cssClasses={["success"]} pixelSize={24} />
                                <GtkLabel label="Long press detected!" cssClasses={["heading"]} />
                                {longPressPosition && (
                                    <GtkLabel
                                        label={`at (${longPressPosition.x}, ${longPressPosition.y})`}
                                        cssClasses={["monospace", "dim-label"]}
                                    />
                                )}
                            </>
                        ) : (
                            <GtkLabel label="Press and hold to trigger" cssClasses={["dim-label"]} />
                        )}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Zoom & Rotate Gestures (Multi-touch)">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Use two fingers to pinch (zoom) or rotate in the area below. These gestures require a touchscreen or multi-touch trackpad."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkDrawingArea
                        ref={zoomRotateRef}
                        contentWidth={400}
                        contentHeight={100}
                        cssClasses={[gestureAreaStyle]}
                    />

                    <GtkBox spacing={24}>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Scale:" cssClasses={["dim-label"]} />
                            <GtkLabel label={`${scale.toFixed(2)}x`} cssClasses={["monospace", "heading"]} />
                        </GtkBox>
                        <GtkBox spacing={8}>
                            <GtkLabel label="Rotation:" cssClasses={["dim-label"]} />
                            <GtkLabel label={`${rotation.toFixed(1)}°`} cssClasses={["monospace", "heading"]} />
                        </GtkBox>
                    </GtkBox>

                    <GtkLabel
                        label="Note: Multi-touch gestures may not work with a standard mouse. Use a touchscreen or multi-touch trackpad for best results."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label", "caption"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Gesture Controllers">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Gestures are implemented as event controllers that can be attached to any widget using addController()."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkGestureClick" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Single, double, triple clicks" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkGestureDrag" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Drag with offset tracking" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkGestureSwipe" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Quick swipes with velocity" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel
                                label="GtkGestureLongPress"
                                widthChars={18}
                                xalign={0}
                                cssClasses={["monospace"]}
                            />
                            <GtkLabel label="Press and hold detection" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkGestureZoom" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Two-finger pinch zoom" cssClasses={["dim-label"]} />
                        </GtkBox>
                        <GtkBox spacing={12}>
                            <GtkLabel label="GtkGestureRotate" widthChars={18} xalign={0} cssClasses={["monospace"]} />
                            <GtkLabel label="Two-finger rotation" cssClasses={["dim-label"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const gesturesDemo: Demo = {
    id: "gestures",
    title: "Gestures",
    description:
        "Perform gestures on touchscreens and other input devices. This demo reacts to long presses and swipes from all devices, plus multi-touch rotate and zoom gestures.",
    keywords: [
        "gesture",
        "touch",
        "swipe",
        "pinch",
        "zoom",
        "rotate",
        "drag",
        "click",
        "GtkGestureClick",
        "GtkGestureDrag",
        "GtkGestureSwipe",
        "GtkGestureZoom",
        "GtkGestureRotate",
        "multi-touch",
    ],
    component: GesturesDemo,
    sourceCode,
};
