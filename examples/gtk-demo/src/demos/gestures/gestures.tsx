import type { Context } from "@gtkx/gi/cairo";
import { Pattern } from "@gtkx/gi/cairo";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkDrawingArea, GtkGestureLongPress, GtkGestureRotate, GtkGestureSwipe, GtkGestureZoom } from "@gtkx/jsx/gtk";
import { useRef } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./gestures.tsx?raw";

type GestureState = {
    swipeX: number;
    swipeY: number;
    isLongPressed: boolean;
};

type DrawGesturesArgs = {
    width: number;
    height: number;
    state: GestureState;
    rotate: Gtk.GestureRotate | null;
    zoom: Gtk.GestureZoom | null;
};

type GestureControllersProps = {
    handlers: ReturnType<typeof useGesturesHandlers>;
    queueDraw: () => void;
    setRotate: (gesture: Gtk.GestureRotate | null) => void;
    setZoom: (gesture: Gtk.GestureZoom | null) => void;
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

    return { handleSwipe, handleLongPressPressed, handleLongPressEnd };
}

const drawGestures = (cr: Context, args: DrawGesturesArgs) => {
    const { width, height, state, rotate, zoom } = args;
    drawSwipe(cr, width, height, state);

    if (rotate?.isRecognized() || zoom?.isRecognized()) {
        drawRotateZoom(cr, { width, height, rotate, zoom });
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

const drawRotateZoom = (
    cr: Context,
    {
        width,
        height,
        rotate,
        zoom,
    }: { width: number; height: number; rotate: Gtk.GestureRotate | null; zoom: Gtk.GestureZoom | null },
) => {
    const rectSize = 200;
    let centerX = width / 2;
    let centerY = height / 2;
    const center = zoom?.getBoundingBoxCenter();

    if (center?.[0]) {
        centerX = center[1];
        centerY = center[2];
    }

    const angle = rotate?.getAngleDelta() ?? 0;
    const scale = zoom?.getScaleDelta() ?? 1;
    cr.save();
    cr.translate(centerX, centerY);
    cr.rotate(angle);
    cr.scale(scale, scale);
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

const GestureControllers = ({ handlers, queueDraw, setRotate, setZoom }: GestureControllersProps) => (
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
            ref={setRotate}
            onAngleChanged={queueDraw}
        />
        <GtkGestureZoom propagationPhase={Gtk.PropagationPhase.BUBBLE} ref={setZoom} onScaleChanged={queueDraw} />
    </>
);

function GesturesDemo() {
    const gestureStateRef = useRef<GestureState>({ swipeX: 0, swipeY: 0, isLongPressed: false });
    const rotateRef = useRef<Gtk.GestureRotate | null>(null);
    const zoomRef = useRef<Gtk.GestureZoom | null>(null);
    const drawingAreaRef = useRef<Gtk.DrawingArea | null>(null);
    const queueDraw = () => drawingAreaRef.current?.queueDraw();
    const handlers = useGesturesHandlers(gestureStateRef, queueDraw);

    const drawFunc = (_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        drawGestures(cr, {
            width,
            height,
            state: gestureStateRef.current,
            rotate: rotateRef.current,
            zoom: zoomRef.current,
        });
    };

    return (
        <GtkDrawingArea
            name="drawing-area"
            ref={drawingAreaRef}
            contentWidth={400}
            contentHeight={400}
            drawFunc={drawFunc}
            controllers={(
                <GestureControllers
                    handlers={handlers}
                    queueDraw={queueDraw}
                    setRotate={(gesture) => {
                        rotateRef.current = gesture;
                    }}
                    setZoom={(gesture) => {
                        zoomRef.current = gesture;
                    }}
                />
            )}
        />
    );
}

export { gesturesDemo };
