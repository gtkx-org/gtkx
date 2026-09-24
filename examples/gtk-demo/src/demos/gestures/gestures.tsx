import type { Context } from "@gtkx/cairo";
import { Pattern } from "@gtkx/cairo";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkDrawingArea, GtkGestureLongPress, GtkGestureRotate, GtkGestureSwipe, GtkGestureZoom } from "@gtkx/jsx/gtk";
import { useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./gestures.tsx?raw";

type GestureState = {
    swipeX: number;
    swipeY: number;
    isLongPressed: boolean;
    isRotating: boolean;
    isZooming: boolean;
    angle: number;
    scale: number;
    center: [number, number] | null;
};

type DrawGesturesArgs = {
    width: number;
    height: number;
    state: GestureState;
};

type GestureControllersProps = {
    handlers: ReturnType<typeof useGesturesHandlers>;
};

const gesturesDemo: Demo = {
    id: "gestures",
    title: "Gestures",
    description:
        "Perform gestures on touchscreens and other input devices. This demo reacts to long presses and " +
        "swipes from all devices, plus multi-touch rotate and zoom gestures.",
    keywords: ["GtkGesture"],
    component: GesturesDemo,
    sourceCode,
    defaultWidth: 400,
    defaultHeight: 400,
};

function useGesturesHandlers(gestureStateRef: React.RefObject<GestureState>, queueDraw: () => void) {
    const handleSwipe = (velocityX: number, velocityY: number) => {
        gestureStateRef.current.swipeX = velocityX / 10;
        gestureStateRef.current.swipeY = velocityY / 10;
        queueDraw();
    };

    const handleLongPressPressed = () => {
        gestureStateRef.current.isLongPressed = true;
        queueDraw();
    };

    const handleLongPressEnd = () => {
        gestureStateRef.current.isLongPressed = false;
        queueDraw();
    };

    const handleAngleChanged = (_angle: number, angleDelta: number) => {
        gestureStateRef.current.angle = angleDelta;
        gestureStateRef.current.isRotating = true;
        queueDraw();
    };

    const handleRotateEnd = () => {
        gestureStateRef.current.angle = 0;
        gestureStateRef.current.isRotating = false;
        queueDraw();
    };

    const handleScaleChanged = (scale: number, gesture: Gtk.GestureZoom) => {
        const center = gesture.getBoundingBoxCenter();
        gestureStateRef.current.scale = scale;
        gestureStateRef.current.center = center[0] ? [center[1], center[2]] : null;
        gestureStateRef.current.isZooming = true;
        queueDraw();
    };

    const handleZoomEnd = () => {
        gestureStateRef.current.scale = 1;
        gestureStateRef.current.center = null;
        gestureStateRef.current.isZooming = false;
        queueDraw();
    };

    return {
        handleSwipe,
        handleLongPressPressed,
        handleLongPressEnd,
        handleAngleChanged,
        handleRotateEnd,
        handleScaleChanged,
        handleZoomEnd,
    };
}

const drawGestures = (cr: Context, args: DrawGesturesArgs) => {
    const { width, height, state } = args;
    drawSwipe(cr, width, height, state);

    if (state.isRotating || state.isZooming) {
        drawRotateZoom(cr, width, height, state);
    }

    if (state.isLongPressed) {
        drawLongPress(cr, width, height);
    }
};

const drawSwipe = (cr: Context, width: number, height: number, state: GestureState) => {
    if (state.swipeX === 0 && state.swipeY === 0) {
        return;
    }

    cr.save();
    cr.setLineWidth(6);
    cr.moveTo(width / 2, height / 2);
    cr.relLineTo(state.swipeX, state.swipeY);
    cr.setSourceRgba(1, 0, 0, 0.5);
    cr.stroke();
    cr.restore();
};

const drawRotateZoom = (cr: Context, width: number, height: number, state: GestureState) => {
    const rectSize = 200;
    const centerX = state.center?.[0] ?? width / 2;
    const centerY = state.center?.[1] ?? height / 2;
    cr.save();
    cr.translate(centerX, centerY);
    cr.rotate(state.angle);
    cr.scale(state.scale, state.scale);
    const pattern = Pattern.createLinear(-rectSize / 2, 0, rectSize, 0);
    pattern.addColorStopRgb(0, 0, 0, 1);
    pattern.addColorStopRgb(1, 1, 0, 0);
    cr.setSource(pattern);
    cr.rectangle(-rectSize / 2, -rectSize / 2, rectSize, rectSize);
    cr.fill();
    cr.restore();
};

const drawLongPress = (cr: Context, width: number, height: number) => {
    cr.save();
    cr.arc(width / 2, height / 2, 50, 0, 2 * Math.PI);
    cr.setSourceRgba(0, 1, 0, 0.5);
    cr.stroke();
    cr.restore();
};

const GestureControllers = ({ handlers }: GestureControllersProps) => (
    <>
        <GtkGestureSwipe propagationPhase={Gtk.PropagationPhase.BUBBLE} onSwipe={handlers.handleSwipe} />
        <GtkGestureSwipe
            propagationPhase={Gtk.PropagationPhase.BUBBLE}
            nPoints={3}
            onBegin={(_sequence, self) => {
                if (_sequence !== null) {
                    self.setState(Gtk.EventSequenceState.DENIED);
                }
            }}
            onSwipe={handlers.handleSwipe}
        />
        <GtkGestureLongPress
            propagationPhase={Gtk.PropagationPhase.BUBBLE}
            onPressed={handlers.handleLongPressPressed}
            onEnd={handlers.handleLongPressEnd}
        />
        <GtkGestureRotate
            propagationPhase={Gtk.PropagationPhase.BUBBLE}
            onAngleChanged={handlers.handleAngleChanged}
            onEnd={handlers.handleRotateEnd}
        />
        <GtkGestureZoom
            propagationPhase={Gtk.PropagationPhase.BUBBLE}
            onScaleChanged={handlers.handleScaleChanged}
            onEnd={handlers.handleZoomEnd}
        />
    </>
);

function GesturesDemo() {
    const gestureStateRef = useRef<GestureState>({
        swipeX: 0,
        swipeY: 0,
        isLongPressed: false,
        isRotating: false,
        isZooming: false,
        angle: 0,
        scale: 1,
        center: null,
    });
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);
    const queueDraw = () => drawingAreaRef.current?.queueDraw();
    const handlers = useGesturesHandlers(gestureStateRef, queueDraw);

    const drawFunc = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        drawGestures(cr, {
            width,
            height,
            state: gestureStateRef.current,
        });
    };

    return (
        <GtkDrawingArea
            name="drawing-area"
            accessibleLabel="Gesture canvas"
            ref={drawingAreaRef}
            contentWidth={400}
            contentHeight={400}
            drawFunc={drawFunc}
            controllers={<GestureControllers handlers={handlers} />}
        />
    );
}

export { gesturesDemo };
