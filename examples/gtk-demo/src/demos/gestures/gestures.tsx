import { createRef } from "@gtkx/ffi";
import type { Context } from "@gtkx/ffi/cairo";
import { LinearPattern } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkDrawingArea, GtkGestureLongPress, GtkGestureRotate, GtkGestureSwipe, GtkGestureZoom } from "@gtkx/react";
import { useCallback, useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./gestures.tsx?raw";

interface GestureState {
    swipeX: number;
    swipeY: number;
    longPressed: boolean;
}

const GesturesDemo = () => {
    const gestureStateRef = useRef<GestureState>({
        swipeX: 0,
        swipeY: 0,
        longPressed: false,
    });
    const rotateRef = useRef<Gtk.GestureRotate | null>(null);
    const zoomRef = useRef<Gtk.GestureZoom | null>(null);
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);

    const queueDraw = useCallback(() => {
        drawingAreaRef.current?.queueDraw();
    }, []);

    const handleSwipe = useCallback(
        (velocityX: number, velocityY: number) => {
            gestureStateRef.current.swipeX = velocityX / 10;
            gestureStateRef.current.swipeY = velocityY / 10;
            queueDraw();
        },
        [queueDraw],
    );

    const handleLongPressPressed = useCallback(() => {
        gestureStateRef.current.longPressed = true;
        queueDraw();
    }, [queueDraw]);

    const handleLongPressEnd = useCallback(() => {
        gestureStateRef.current.longPressed = false;
        queueDraw();
    }, [queueDraw]);

    const handleRotateChanged = useCallback(() => {
        queueDraw();
    }, [queueDraw]);

    const handleZoomChanged = useCallback(() => {
        queueDraw();
    }, [queueDraw]);

    const drawFunc = useCallback((cr: Context, width: number, height: number) => {
        const { swipeX, swipeY, longPressed } = gestureStateRef.current;

        if (swipeX !== 0 || swipeY !== 0) {
            cr.save();
            cr.setLineWidth(6);
            cr.moveTo(width / 2, height / 2);
            cr.relLineTo(swipeX, swipeY);
            cr.setSourceRgba(1, 0, 0, 0.5);
            cr.stroke();
            cr.restore();
        }

        const rotate = rotateRef.current;
        const zoom = zoomRef.current;

        if (rotate?.isRecognized() || zoom?.isRecognized()) {
            const xRef = createRef(0);
            const yRef = createRef(0);
            const rectSize = 200;

            let centerX = width / 2;
            let centerY = height / 2;

            if (zoom?.getBoundingBoxCenter(xRef, yRef)) {
                centerX = xRef.value;
                centerY = yRef.value;
            }

            const angle = rotate?.getAngleDelta() ?? 0;
            const scale = zoom?.getScaleDelta() ?? 1;

            cr.save();
            cr.translate(centerX, centerY);
            cr.rotate(angle);
            cr.scale(scale, scale);

            const pattern = new LinearPattern(-rectSize / 2, 0, rectSize, 0);
            pattern.addColorStopRgb(0, 0, 0, 1);
            pattern.addColorStopRgb(1, 1, 0, 0);
            cr.setSource(pattern);

            cr.rectangle(-rectSize / 2, -rectSize / 2, rectSize, rectSize);
            cr.fill();

            cr.restore();
        }

        if (longPressed) {
            cr.save();
            cr.arc(width / 2, height / 2, 50, 0, 2 * Math.PI);
            cr.setSourceRgba(0, 1, 0, 0.5);
            cr.stroke();
            cr.restore();
        }
    }, []);

    return (
        <GtkDrawingArea ref={drawingAreaRef} contentWidth={400} contentHeight={400} onDraw={drawFunc}>
            <GtkGestureSwipe propagationPhase={Gtk.PropagationPhase.BUBBLE} onSwipe={handleSwipe} />
            <GtkGestureSwipe
                propagationPhase={Gtk.PropagationPhase.BUBBLE}
                nPoints={3}
                onBegin={(_sequence, self) => {
                    if (_sequence !== null) self.setState(Gtk.EventSequenceState.DENIED);
                }}
                onSwipe={handleSwipe}
            />
            <GtkGestureLongPress
                propagationPhase={Gtk.PropagationPhase.BUBBLE}
                onPressed={handleLongPressPressed}
                onEnd={handleLongPressEnd}
            />
            <GtkGestureRotate
                propagationPhase={Gtk.PropagationPhase.BUBBLE}
                ref={(g: Gtk.GestureRotate | null) => {
                    rotateRef.current = g;
                }}
                onAngleChanged={handleRotateChanged}
            />
            <GtkGestureZoom
                propagationPhase={Gtk.PropagationPhase.BUBBLE}
                ref={(g: Gtk.GestureZoom | null) => {
                    zoomRef.current = g;
                }}
                onScaleChanged={handleZoomChanged}
            />
        </GtkDrawingArea>
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
    defaultWidth: 400,
    defaultHeight: 400,
};
