import { type Context } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkDrawingArea,
    GtkFrame,
    GtkHeaderBar,
    GtkLabel,
    GtkWindow,
    createPortal,
    useApplication,
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./frames.tsx?raw";

interface Color {
    r: number;
    g: number;
    b: number;
}

const randomColor = (): Color => ({
    r: Math.random(),
    g: Math.random(),
    b: Math.random(),
});

const lerpColor = (c1: Color, c2: Color, t: number): Color => ({
    r: c1.r * (1 - t) + c2.r * t,
    g: c1.g * (1 - t) + c2.g * t,
    b: c1.b * (1 - t) + c2.b * t,
});

const TIME_SPAN = 3000;

const FramesWindow = ({ onClose }: { onClose: () => void }) => {
    const app = useApplication();
    const activeWindow = app.getActiveWindow();
    const drawingRef = useRef<Gtk.DrawingArea>(null);
    const [fps, setFps] = useState(0);

    const color1Ref = useRef<Color>(randomColor());
    const color2Ref = useRef<Color>(randomColor());
    const time2Ref = useRef<number>(Date.now() + TIME_SPAN);
    const frameCountRef = useRef(0);
    const lastFpsTimeRef = useRef(Date.now());

    const draw = useCallback((_self: Gtk.DrawingArea, cr: Context, width: number, height: number) => {
        const now = Date.now();

        if (now >= time2Ref.current) {
            time2Ref.current = now + TIME_SPAN;
            color1Ref.current = color2Ref.current;
            color2Ref.current = randomColor();
        }

        const t = 1 - (time2Ref.current - now) / TIME_SPAN;
        const color = lerpColor(color1Ref.current, color2Ref.current, t);

        cr.setSourceRgb(color.r, color.g, color.b).rectangle(0, 0, width, height).fill();
    }, []);

    useEffect(() => {
        const area = drawingRef.current;
        if (!area) return;

        area.setDrawFunc(draw);

        const interval = setInterval(() => {
            area.queueDraw();
            frameCountRef.current++;

            const now = Date.now();
            const elapsed = now - lastFpsTimeRef.current;
            if (elapsed >= 500) {
                setFps(Math.round((frameCountRef.current * 1000) / elapsed));
                frameCountRef.current = 0;
                lastFpsTimeRef.current = now;
            }
        }, 16);

        return () => clearInterval(interval);
    }, [draw]);

    if (!activeWindow) return null;

    return createPortal(
        <GtkWindow title="Frames" defaultWidth={600} defaultHeight={400} onClose={onClose}>
            <GtkHeaderBar>
                <x.PackEnd>
                    <GtkLabel label={`${fps.toFixed(2)} fps`} cssClasses={["monospace"]} />
                </x.PackEnd>
            </GtkHeaderBar>
            <GtkDrawingArea ref={drawingRef} hexpand vexpand />
        </GtkWindow>,
        activeWindow,
    );
};

const FramesDemo = () => {
    const [showWindow, setShowWindow] = useState(false);

    return (
        <>
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
                <GtkLabel label="Benchmark/Frames" cssClasses={["title-2"]} halign={Gtk.Align.START} />

                <GtkLabel
                    label="This demo is intentionally as simple as possible, to see what framerate the windowing system can deliver on its own. It does nothing but change the drawn color, for every frame."
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />

                <GtkButton
                    label={showWindow ? "Close Window" : "Open Frames Window"}
                    onClicked={() => setShowWindow(!showWindow)}
                    cssClasses={[showWindow ? "destructive-action" : "suggested-action"]}
                    halign={Gtk.Align.START}
                />

                <GtkFrame label="How It Works">
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={8}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel
                            label="The benchmark interpolates between two random colors over 3 seconds, then picks new colors. The FPS counter in the header bar shows the achieved framerate."
                            wrap
                            halign={Gtk.Align.START}
                        />
                        <GtkLabel
                            label="This measures raw rendering performance without any complex scene or layout calculations."
                            wrap
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                </GtkFrame>
            </GtkBox>

            {showWindow && <FramesWindow onClose={() => setShowWindow(false)} />}
        </>
    );
};

export const framesDemo: Demo = {
    id: "frames",
    title: "Benchmark/Frames",
    description: "Tests raw rendering performance by drawing color changes every frame",
    keywords: ["benchmark", "frames", "fps", "performance", "rendering", "GtkDrawingArea"],
    component: FramesDemo,
    sourceCode,
};
